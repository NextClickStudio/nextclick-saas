-- What a rug is. The first index called a coin "rugged" when its creator sold near the top and the price later
-- halved: that also caught coins that simply faded. A rug is a dump: the creator's own sells crash the price in
-- seconds. yr_cc now records it trade by trade: rug_s (seconds from launch) and rug_drop (how far the price fell,
-- 0.6 = -60%) when the creator's sells within 5 seconds take 60% or more off the price.
alter table yr_cc add column if not exists rug_s int;
alter table yr_cc add column if not exists rug_drop real;

-- The launch bundle: wallets (not the creator) that buy within 3 seconds of the launch, usually the creator's own
-- wallets or bots, and dump together. yr_bw follows how many tokens they still hold; yr_cc.bun is their share of the
-- supply now, bun0 the most they held.
create table if not exists yr_bw (
  mint text not null,
  who text not null,
  tok double precision not null default 0,
  primary key (mint, who)
);
alter table yr_bw enable row level security;
alter table yr_cc add column if not exists bun real;
alter table yr_cc add column if not exists bun0 real;

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
    select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.who, (x.vsol / x.vtok * 1e9)::real mc, c.t0, c.dev,
      -- the price just before this trade
      (case when x.k = 1 then (x.vsol - x.sol) / nullif(x.vtok + x.tok, 0) else (x.vsol + x.sol) / nullif(x.vtok - x.tok, 0) end * 1e9)::real pre
    from yr_ticks x join yr_cc c on c.mint = x.mint
    where x.t > wm and x.t <= hi and x.vsol > 0 and x.vtok > 0;
  get diagnostics n_t = row_count;

  -- price, high, activity
  update yr_cc c set
    n = c.n + a.n,
    last_t = greatest(coalesce(c.last_t, 0), a.lt),
    mc = a.last_mc,
    ath = greatest(c.ath, a.mx),
    ath_s = case when a.mx > c.ath then a.mx_s else c.ath_s end,
    mc0 = coalesce(c.mc0, case when c.n = 0 and a.ft < c.t0 + 60000 then a.first_pre end)
  from (
    select x.mint, count(*)::int n, max(x.t) lt, max(x.mc) mx, min(x.t) ft,
      (array_agg(x.pre order by x.t, x.ix))[1] first_pre,
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

  -- a rug: the creator's own sells crash the price by 60% or more within 5 seconds (measured from the price just
  -- before their first sell in the window to the price right after their last one)
  update yr_cc c set
    rug_s = coalesce(c.rug_s, d.s),
    rug_drop = greatest(coalesce(c.rug_drop, 0), d.drop)
  from (
    select a.mint, min((a.t - a.t0) / 1000)::int s, max(1 - b.mc / nullif(a.pre, 0))::real drop
    from _t a
    join _t b on b.mint = a.mint and b.who = b.dev and b.k = 2 and b.t <= a.t + 5000 and (b.t > a.t or (b.t = a.t and b.ix >= a.ix))
    where a.who = a.dev and a.k = 2
    group by a.mint
    having max(1 - b.mc / nullif(a.pre, 0)) >= 0.6) d
  where d.mint = c.mint;

  -- the launch bundle: its first buys, then everything those wallets do after
  insert into yr_bw as w (mint, who, tok)
  select x.mint, x.who, sum(x.tok) from _t x
  where x.k = 1 and x.who <> x.dev and x.t <= x.t0 + 3000
  group by x.mint, x.who
  on conflict (mint, who) do update set tok = w.tok + excluded.tok;
  update yr_bw w set tok = greatest(0, w.tok + a.d)
  from (
    select x.mint, x.who, sum(case when x.k = 1 then x.tok else -x.tok end) d
    from _t x join yr_bw b on b.mint = x.mint and b.who = x.who
    where x.t > x.t0 + 3000 group by x.mint, x.who) a
  where w.mint = a.mint and w.who = a.who;
  update yr_cc c set bun = a.s / 1e9, bun0 = greatest(coalesce(c.bun0, 0), a.s / 1e9)
  from (select b.mint, sum(b.tok) s from yr_bw b where b.mint in (select distinct mint from _t) group by b.mint) a
  where a.mint = c.mint;

  -- the 30 s steps of the first 20 minutes
  insert into yr_cb as s (mint, b, c)
  select x.mint, ((x.t - x.t0) / 30000)::smallint, (array_agg(x.mc order by x.t desc, x.ix desc))[1]
  from _t x where x.t >= x.t0 and x.t < x.t0 + 1200000
  group by x.mint, ((x.t - x.t0) / 30000)::smallint
  on conflict (mint, b) do update set c = excluded.c;

  -- coins past 20 minutes: fold their steps into one array (each step carries the last price forward)
  with f as (
    select c.mint, c.n, c.mc0 from yr_cc c where c.p is null and c.t0 + 1230000 <= hi order by c.t0 limit 400),
  s as (
    select f.mint, f.mc0, g, cb.c, count(cb.c) over (partition by f.mint order by g) grp
    from f cross join generate_series(0, 39) g left join yr_cb cb on cb.mint = f.mint and cb.b = g
    where f.n >= 20),
  v as (
    select s.mint, g, coalesce(first_value(s.c) over (partition by s.mint, s.grp order by g), s.mc0, 28) val from s),
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
    delete from yr_bw b where not exists (select 1 from yr_cc c where c.mint = b.mint and c.t0 > now_ms - 3600000);
    delete from yr_obirth where t < now_ms - 86400000;
    delete from yr_grad where t < now_ms - 86400000;
  end if;

  return jsonb_build_object('n', n_t, 'new', n_new, 'fin', n_fin);
end $$;

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
      'sold_s', me.sold_s, 'sold_mc', me.sold_mc, 'out_s', me.out_s, 'grad', me.grad, 'p', me.p, 'mc0', me.mc0, 'rug_s', me.rug_s, 'rug_drop', me.rug_drop, 'bun', me.bun, 'bun0', me.bun0) end,
    'uri', (select b.uri from yr_obirth b where b.mint = p_mint),
    'total', (select count(*) from yr_cc where dev = d),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, c.ath, c.ath_s, c.mc, c.dev_buy, c.dev_sell,
                                         c.sold_s, c.sold_mc, c.out_s, c.grad, c.p, c.mc0, c.rug_s, c.rug_drop) order by c.t0 desc)
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


-- open paper positions on coins with no curve trade in the last minute: refresh their DexScreener pool every 15 s,
-- so take profit and stop fire even with no page open (the anon key is public)
select cron.schedule('yr-px', '15 seconds', $job$
  select net.http_post(
    url := 'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-px',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5b2J0Z3Vidm9wemZtb216ZXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDU2NTMsImV4cCI6MjEwODkyMTY1M30.ive4HTtn_DYstwrSPYQervq7KlpPWIuVIsH4ZWpUhWw'),
    body := jsonb_build_object('mints', z.m),
    timeout_milliseconds := 8000)
  from (select jsonb_agg(distinct p.mint) m from yr_paper_pos p
        where not exists (select 1 from yr_ticks x where x.mint = p.mint and x.t > yr_now() - 60000)) z
  where z.m is not null
$job$);
