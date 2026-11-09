-- yeppo, lighter: the look-alike engine goes, the creator index comes in.
-- The engine snapshotted every coin 12 times, tracked every wallet's position in every coin and rebuilt it all
-- every 10 seconds: most of the free database's work, for an "OK to buy" it gave on 1% of coins. What a short-term
-- trader needs is who made the coin and what happened to that creator's other coins. yr_cc keeps one row per
-- pump.fun coin: its creator, its high and when, what the creator bought and when they sold, and its price for
-- the first 20 minutes (30 s steps, only for coins that traded). Rows live 14 days.

-- 1. stop the old jobs
do $do$ declare j text; begin
  foreach j in array array['yr-oracle-roll', 'yr-otrack', 'yr-ohot', 'yr-metas', 'yr-social', 'yr-bot'] loop
    begin
      perform cron.unschedule(j);
    exception when others then
      null;
    end;
  end loop;
end $do$;

-- 2. the creator index
create table if not exists yr_cc (
  mint text primary key,
  dev text not null,
  t0 bigint not null,                 -- launch, ms
  sym text,
  name text,
  n int not null default 0,           -- trades seen
  last_t bigint,
  mc real,                            -- last market cap, SOL
  ath real not null default 0,        -- highest market cap, SOL
  ath_s int,                          -- seconds from launch to the high
  dev_buy real not null default 0,    -- SOL the creator spent
  dev_sell real not null default 0,   -- SOL the creator got back
  dev_tok double precision not null default 0,   -- tokens the creator holds (from trades yeppo saw)
  dev_max double precision not null default 0,   -- the most the creator held
  sold_s int,                         -- seconds from launch to the creator's first sell
  sold_mc real,                       -- market cap at that sell
  out_s int,                          -- seconds from launch to the creator holding under 10% of their peak
  grad boolean not null default false,
  p real[]                            -- market cap every 30 s for the first 20 min; '{}' when it barely traded
);
create index if not exists yr_cc_dev on yr_cc (dev, t0 desc);
create index if not exists yr_cc_t0 on yr_cc using brin (t0);
create index if not exists yr_cc_open on yr_cc (t0) where p is null;

-- the 30 s steps of coins still in their first 20 minutes, folded into yr_cc.p then deleted
create table if not exists yr_cb (
  mint text not null,
  b smallint not null,
  c real not null,
  primary key (mint, b)
);

alter table yr_cc enable row level security;
alter table yr_cb enable row level security;

-- the coins of the last day, from the launch feed and the engine's own records (their highs and first 20 minutes)
insert into yr_cc (mint, dev, t0, sym, name, n, last_t, mc, ath, p)
select b.mint, b.dev, b.t, left(b.symbol, 16), left(b.name, 40), coalesce(o.n, 0), o.last_t, o.ath, coalesce(o.ath, 0),
       case when b.t < yr_now() - 1230000 then '{}'::real[] end
from yr_obirth b left join yr_oc o on o.mint = b.mint
where b.dev is not null
on conflict do nothing;

update yr_cc c set p = z.p
from (
  select s.mint, array_agg(coalesce(s.c, 28)::real order by s.g) p
  from (
    select o.mint, g, (select x.c from yr_ob x where x.mint = o.mint and x.b <= g * 3 + 2 order by x.b desc limit 1) c
    from yr_oc o cross join generate_series(0, 39) g
    where o.n >= 20 and o.t0 < yr_now() - 1230000) s
  group by s.mint) z
where c.mint = z.mint;

-- 3. drop the engine's functions, then its tables
do $do$ declare f regprocedure; begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'yr_oracle_roll', 'yr_future', 'yr_ofuture_core', 'yr_xray', 'yr_guard', 'yr_odev', 'yr_ofeat', 'yr_oexitsoon',
      'yr_opattern', 'yr_obacktest', 'yr_ospread', 'yr_odist', 'yr_oracle_hot_build', 'yr_oracle_hot', 'yr_oracle_board',
      'yr_oracle_one', 'yr_otrack', 'yr_otrack_refresh', 'yr_metas', 'yr_metas_build', 'yr_scout_feed', 'yr_grads_recent',
      'yr_social_recent', 'yr_board'])
  loop
    execute format('drop function %s', f);
  end loop;
end $do$;

drop table if exists yr_os, yr_oh, yr_ow, yr_ob, yr_oc, yr_dev, yr_social, yr_board_cache;

-- 4. the roll: every 15 s, the ticks since the last roll
create or replace function yr_cc_roll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare wm bigint; hi bigint; now_ms bigint := yr_now(); n_t int; n_new int; n_fin int;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_cc_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'cc_wm';
  wm := greatest(coalesce(wm, now_ms - 60000), now_ms - 600000);
  hi := least(now_ms - 3000, wm + 60000);
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  -- new coins, from the launch feed
  insert into yr_cc (mint, dev, t0, sym, name)
  select b.mint, b.dev, b.t, left(b.symbol, 16), left(b.name, 40)
  from yr_obirth b where b.t > wm - 120000 and b.t <= hi and b.dev is not null
  on conflict do nothing;
  get diagnostics n_new = row_count;

  create temp table _t on commit drop as
    select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.who, (x.vsol / x.vtok * 1e9)::real mc, c.t0, c.dev
    from yr_ticks x join yr_cc c on c.mint = x.mint
    where x.t > wm and x.t <= hi and x.vsol > 0 and x.vtok > 0;
  get diagnostics n_t = row_count;

  -- price, high, activity
  update yr_cc c set
    n = c.n + a.n,
    last_t = greatest(coalesce(c.last_t, 0), a.lt),
    mc = a.last_mc,
    ath = greatest(c.ath, a.mx),
    ath_s = case when a.mx > c.ath then a.mx_s else c.ath_s end
  from (
    select x.mint, count(*)::int n, max(x.t) lt, max(x.mc) mx,
      (array_agg(x.mc order by x.t desc, x.ix desc))[1] last_mc,
      ((array_agg(x.t order by x.mc desc, x.t))[1] - min(x.t0)) / 1000 mx_s
    from _t x group by x.mint) a
  where a.mint = c.mint;

  -- the creator's own trades
  update yr_cc c set
    dev_buy = c.dev_buy + a.buy,
    dev_sell = c.dev_sell + a.sell,
    dev_tok = greatest(0, c.dev_tok + a.dtok),
    dev_max = greatest(c.dev_max, c.dev_tok + a.peak),
    sold_s = coalesce(c.sold_s, a.sold_s),
    sold_mc = coalesce(c.sold_mc, a.sold_mc),
    out_s = coalesce(c.out_s, case when greatest(c.dev_max, c.dev_tok + a.peak) > 0
                                     and c.dev_tok + a.dtok <= greatest(c.dev_max, c.dev_tok + a.peak) * 0.1
                                   then a.last_s end)
  from (
    select x.mint,
      coalesce(sum(x.sol) filter (where x.k = 1), 0) buy,
      coalesce(sum(x.sol) filter (where x.k = 2), 0) sell,
      sum(case when x.k = 1 then x.tok else -x.tok end) dtok,
      greatest(0, coalesce(sum(x.tok) filter (where x.k = 1), 0)) peak,
      (min(x.t) filter (where x.k = 2) - min(x.t0)) / 1000 sold_s,
      (array_agg(x.mc order by x.t) filter (where x.k = 2))[1] sold_mc,
      (max(x.t) - min(x.t0)) / 1000 last_s
    from _t x where x.who = x.dev group by x.mint) a
  where a.mint = c.mint;

  -- the 30 s steps of the first 20 minutes
  insert into yr_cb as s (mint, b, c)
  select x.mint, ((x.t - x.t0) / 30000)::smallint, (array_agg(x.mc order by x.t desc, x.ix desc))[1]
  from _t x where x.t >= x.t0 and x.t < x.t0 + 1200000
  group by x.mint, ((x.t - x.t0) / 30000)::smallint
  on conflict (mint, b) do update set c = excluded.c;

  -- coins past 20 minutes: fold their steps into one array (each step carries the last price forward)
  with f as (
    select c.mint, c.n from yr_cc c where c.p is null and c.t0 + 1230000 <= hi order by c.t0 limit 400),
  s as (
    select f.mint, g, cb.c, count(cb.c) over (partition by f.mint order by g) grp
    from f cross join generate_series(0, 39) g left join yr_cb cb on cb.mint = f.mint and cb.b = g
    where f.n >= 20),
  v as (
    select s.mint, g, coalesce(first_value(s.c) over (partition by s.mint, s.grp order by g), 28) val from s),
  arr as (select v.mint, array_agg(v.val::real order by g) p from v group by v.mint),
  upd as (
    update yr_cc c set p = coalesce(arr.p, '{}')
    from f left join arr on arr.mint = f.mint where c.mint = f.mint
    returning c.mint)
  delete from yr_cb cb using upd where cb.mint = upd.mint;
  get diagnostics n_fin = row_count;

  insert into yr_okv (k, v) values ('cc_wm', hi) on conflict (k) do update set v = excluded.v;

  -- once a minute: graduations, and the old rows out
  if extract(second from clock_timestamp()) < 15 then
    update yr_cc c set grad = true from yr_grad g where g.mint = c.mint and not c.grad;
    delete from yr_cc where t0 < now_ms - 14 * 86400000::bigint;
    delete from yr_cb cb where not exists (select 1 from yr_cc c where c.mint = cb.mint and c.p is null);
    delete from yr_obirth where t < now_ms - 86400000;
    delete from yr_grad where t < now_ms - 86400000;
  end if;

  return jsonb_build_object('n', n_t, 'new', n_new, 'fin', n_fin);
end $$;

-- 5. what the panel needs for one coin: the coin, its creator's other coins, and its live market
create or replace function yr_creator(p_mint text, p_dev text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me yr_cc; d text; now_ms bigint := yr_now(); t_from bigint;
begin
  select * into me from yr_cc where mint = p_mint;
  d := coalesce(me.dev, nullif(p_dev, ''));
  t_from := greatest(coalesce(me.t0, 0), now_ms - 1200000);
  return jsonb_build_object(
    'now', now_ms,
    'dev', d,
    'me', case when me.mint is null then null else jsonb_build_object(
      't0', me.t0, 'sym', me.sym, 'name', me.name, 'n', me.n, 'mc', me.mc, 'ath', me.ath, 'ath_s', me.ath_s,
      'dev_buy', me.dev_buy, 'dev_sell', me.dev_sell, 'dev_tok', me.dev_tok, 'dev_max', me.dev_max,
      'sold_s', me.sold_s, 'sold_mc', me.sold_mc, 'out_s', me.out_s, 'grad', me.grad) end,
    'total', (select count(*) from yr_cc where dev = d),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, c.ath, c.ath_s, c.mc, c.dev_buy, c.dev_sell,
                                         c.sold_s, c.sold_mc, c.out_s, c.grad, c.p) order by c.t0 desc)
      from (select * from yr_cc where dev = d and mint <> p_mint order by t0 desc limit 30) c), '[]'::jsonb),
    -- 10 s steps of the last 20 minutes: [step, close, high, low, buys, sells, SOL in, SOL out]
    'steps', coalesce((
      select jsonb_agg(jsonb_build_array(z.b, z.c, z.h, z.l, z.nb, z.ns, z.vb, z.vs) order by z.b)
      from (
        select ((x.t - t_from) / 10000)::int b,
          ((array_agg(x.vsol / x.vtok order by x.t desc))[1] * 1e9)::real c,
          (max(x.vsol / x.vtok) * 1e9)::real h, (min(x.vsol / x.vtok) * 1e9)::real l,
          count(*) filter (where x.k = 1) nb, count(*) filter (where x.k = 2) ns,
          round(coalesce(sum(x.sol) filter (where x.k = 1), 0)::numeric, 3) vb,
          round(coalesce(sum(x.sol) filter (where x.k = 2), 0)::numeric, 3) vs
        from yr_ticks x where x.mint = p_mint and x.t > t_from and x.vsol > 0 and x.vtok > 0
        group by 1) z), '[]'::jsonb),
    'from', t_from,
    'w60', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 60000),
    'w120', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 120000));
end $$;

grant execute on function yr_creator(text, text) to anon, authenticated;
revoke execute on function yr_cc_roll() from public, anon, authenticated;

-- 6. the jobs: the roll every 15 s (the capture and the paper exits stay as they are)
select cron.schedule('yr-cc-roll', '15 seconds', 'select yr_cc_roll()');
