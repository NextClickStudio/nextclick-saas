-- yeppo oracle: what happened next to the coins that looked like this one.
-- Every pump.fun coin born while yeppo watches gets its first hour recorded in 10 s buckets (yr_ob) and the
-- position of every wallet that trades it (yr_oh). At fixed ages (checkpoints) a snapshot stores how the coin
-- looked then (features) and, 10 minutes later, what happened next (yr_os). Every closed position feeds the
-- habits of the wallet that held it (yr_ow): how long it holds, how often it wins.
-- yr_future finds the past snapshots closest to a live coin; yr_xray splits its holders by habit.
-- Everything is rolled from yr_ticks by yr_oracle_roll every 10 seconds. Additive.

create table if not exists yr_obirth (          -- every launch the capture sees, with its creator
  mint text primary key,
  t bigint not null,
  dev text,
  name text,
  symbol text,
  uri text
);
create index if not exists yr_obirth_t on yr_obirth (t);

create table if not exists yr_oc (              -- coins followed from birth
  mint text primary key,
  t0 bigint not null,                           -- birth (ms)
  dev text,
  last_t bigint not null,
  n int not null default 0,                     -- trades
  ath real not null default 0,                  -- highest market cap (SOL)
  cp smallint not null default 0                -- index of the next checkpoint to snapshot
);
create index if not exists yr_oc_last on yr_oc (last_t);

create table if not exists yr_ob (              -- 10 s buckets of the first hour
  mint text not null,
  b smallint not null,                          -- (t - t0) / 10 s
  c real not null,                              -- market cap (SOL) at the last trade of the bucket
  h real not null,
  l real not null,
  nb int not null default 0,
  ns int not null default 0,
  vb real not null default 0,                   -- SOL bought
  vs real not null default 0,                   -- SOL sold
  primary key (mint, b)
);

create table if not exists yr_oh (              -- each wallet's position in each followed coin
  mint text not null,
  who text not null,
  tok real not null default 0,                  -- tokens held now (from the trades yeppo saw)
  bought real not null default 0,
  sin real not null default 0,                  -- SOL in
  sout real not null default 0,                 -- SOL out
  t1 bigint not null,                           -- first trade
  tl bigint not null,                           -- last trade
  nb int not null default 0,
  ns int not null default 0,
  closed boolean not null default false,
  primary key (mint, who)
);

create table if not exists yr_ow (              -- trading habits of each wallet, from its closed positions
  who text primary key,
  n int not null default 0,
  hold real not null default 0,                 -- seconds held, summed
  quick int not null default 0,                 -- closed within 60 s
  win int not null default 0,
  pnl real not null default 0,                  -- SOL
  last_t bigint not null
);
create index if not exists yr_ow_last on yr_ow (last_t);

create table if not exists yr_os (              -- snapshots at checkpoints, with what came next
  cp smallint not null,                         -- age in 10 s buckets
  mint text not null,
  at bigint not null,
  f real[] not null,                            -- features (yr_ofeat)
  mc real not null,                             -- market cap at the checkpoint
  fut real[],                                   -- market cap / mc every 20 s for the next 10 minutes (30 points)
  mx real,                                      -- highest / mc in those 10 minutes
  mn real,                                      -- lowest / mc
  primary key (cp, mint)
);
create index if not exists yr_os_open on yr_os (mint) where fut is null;
create index if not exists yr_os_at on yr_os (at);

create table if not exists yr_okv (k text primary key, v bigint not null);

alter table yr_obirth enable row level security;
alter table yr_oc enable row level security;
alter table yr_ob enable row level security;
alter table yr_oh enable row level security;
alter table yr_ow enable row level security;
alter table yr_os enable row level security;
alter table yr_okv enable row level security;

-- what a coin looks like at age p_b (in 10 s buckets):
--  1 level      ln(mc / launch mc)
--  2 trend      ln(mc / mc at half the age)
--  3 momentum   ln(mc / mc a minute ago)
--  4 drawdown   ln(ath / mc)
--  5 activity   ln(1 + trades in the last minute)
--  6 buy share  of the trades in the last minute
--  7 flow       (SOL bought - SOL sold) / volume, last minute
--  8 trades     ln(1 + trades so far)
--  9 traders    ln(1 + wallets so far)
-- 10 dev        share of supply the creator still holds
-- 11 top 10     share of supply held by the 10 biggest wallets
-- 12 snipers    share of supply still held by wallets that bought in the first 2 seconds
-- 13 idle       ln(1 + buckets since the last trade)
create or replace function yr_ofeat(p_mint text, p_b int) returns real[]
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; cut bigint; v_mc real; lastb int; mch real; mc1 real; v_ath real; ntot int;
  nb6 int; ns6 int; vb6 real; vs6 real; nu int; v_dev real; top10 real; snip real;
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then return null; end if;
  select x.c, x.b into v_mc, lastb from yr_ob x where x.mint = p_mint and x.b <= p_b order by x.b desc limit 1;
  if v_mc is null or v_mc <= 0 then return null; end if;
  select x.c into mch from yr_ob x where x.mint = p_mint and x.b <= p_b / 2 order by x.b desc limit 1;
  select x.c into mc1 from yr_ob x where x.mint = p_mint and x.b <= p_b - 6 order by x.b desc limit 1;
  select max(x.h), sum(x.nb + x.ns),
         coalesce(sum(x.nb) filter (where x.b > p_b - 6), 0), coalesce(sum(x.ns) filter (where x.b > p_b - 6), 0),
         coalesce(sum(x.vb) filter (where x.b > p_b - 6), 0), coalesce(sum(x.vs) filter (where x.b > p_b - 6), 0)
    into v_ath, ntot, nb6, ns6, vb6, vs6
    from yr_ob x where x.mint = p_mint and x.b <= p_b;
  cut := o.t0 + (p_b + 1)::bigint * 10000;
  select count(*) filter (where h.t1 < cut),
         coalesce(sum(greatest(h.tok, 0)) filter (where h.who = o.dev), 0) / 1e9,
         coalesce(sum(greatest(h.tok, 0)) filter (where h.t1 <= o.t0 + 2000 and h.who is distinct from o.dev), 0) / 1e9
    into nu, v_dev, snip
    from yr_oh h where h.mint = p_mint;
  select coalesce(sum(t.tok), 0) / 1e9 into top10
    from (select h.tok from yr_oh h where h.mint = p_mint and h.tok > 0 order by h.tok desc limit 10) t;
  return array[
    ln(v_mc / 27.96), ln(v_mc / coalesce(nullif(mch, 0), 27.96)), ln(v_mc / coalesce(nullif(mc1, 0), 27.96)),
    ln(greatest(v_ath, v_mc) / v_mc),
    ln(1 + nb6 + ns6), (nb6 + 1)::real / (nb6 + ns6 + 2), (vb6 - vs6) / (vb6 + vs6 + 0.5),
    ln(1 + ntot), ln(1 + nu), v_dev, top10, snip, ln(1 + greatest(p_b - lastb, 0))
  ]::real[];
end $$;

-- service: fold the new ticks into buckets, positions, habits and snapshots (pg_cron, every 10 s)
create or replace function yr_oracle_roll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare wm bigint; hi bigint; now_ms bigint := yr_now(); n_t int; n_new int; n_snap int; n_fut int;
  cps smallint[] := '{3,6,9,12,18,24,30,45,60,90,120,180}';
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_oracle_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'wm';
  wm := greatest(coalesce(wm, now_ms - 60000), now_ms - 600000);
  hi := now_ms - 3000;                          -- ticks land within a second or two of their time
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  create temp table _t on commit drop as
    select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.vsol, x.vtok, x.who, (x.vsol / x.vtok * 1e9)::real mc
    from yr_ticks x where x.t > wm and x.t <= hi and x.vsol > 0 and x.vtok > 0;
  get diagnostics n_t = row_count;

  -- new coins: announced by the launch feed a moment before, or a first buy on a fresh curve
  insert into yr_oc (mint, t0, dev, last_t)
  select f.mint, least(coalesce(br.t, f.t), f.t), coalesce(br.dev, f.who), f.t
  from (select distinct on (x.mint) x.mint, x.t, x.k, x.tok, x.vtok, x.who from _t x order by x.mint, x.t, x.ix) f
  left join yr_obirth br on br.mint = f.mint
  where not exists (select 1 from yr_oc o where o.mint = f.mint)
    and ((br.mint is not null and br.t > f.t - 120000)
         or (f.k = 1 and abs(f.vtok + f.tok - 1073000000) < 2))
  on conflict do nothing;
  get diagnostics n_new = row_count;

  insert into yr_ob as o (mint, b, c, h, l, nb, ns, vb, vs)
  select x.mint, ((x.t - oc.t0) / 10000)::smallint,
         (array_agg(x.mc order by x.t desc, x.ix desc))[1], max(x.mc), min(x.mc),
         count(*) filter (where x.k = 1), count(*) filter (where x.k = 2),
         coalesce(sum(x.sol) filter (where x.k = 1), 0), coalesce(sum(x.sol) filter (where x.k = 2), 0)
  from _t x join yr_oc oc on oc.mint = x.mint
  where x.t >= oc.t0 and x.t < oc.t0 + 3600000
  group by x.mint, ((x.t - oc.t0) / 10000)::smallint
  on conflict (mint, b) do update set c = excluded.c, h = greatest(o.h, excluded.h), l = least(o.l, excluded.l),
    nb = o.nb + excluded.nb, ns = o.ns + excluded.ns, vb = o.vb + excluded.vb, vs = o.vs + excluded.vs;

  update yr_oc o set last_t = greatest(o.last_t, a.lt), n = o.n + a.n, ath = greatest(o.ath, a.mx)
  from (select x.mint, max(x.t) lt, count(*)::int n, max(x.mc) mx from _t x group by x.mint) a
  where a.mint = o.mint;

  insert into yr_oh as h (mint, who, tok, bought, sin, sout, t1, tl, nb, ns)
  select x.mint, x.who,
    sum(case when x.k = 1 then x.tok else -x.tok end), coalesce(sum(x.tok) filter (where x.k = 1), 0),
    coalesce(sum(x.sol) filter (where x.k = 1), 0), coalesce(sum(x.sol) filter (where x.k = 2), 0),
    min(x.t), max(x.t), count(*) filter (where x.k = 1), count(*) filter (where x.k = 2)
  from _t x join yr_oc oc on oc.mint = x.mint
  group by x.mint, x.who
  on conflict (mint, who) do update set tok = h.tok + excluded.tok, bought = h.bought + excluded.bought,
    sin = h.sin + excluded.sin, sout = h.sout + excluded.sout, tl = excluded.tl,
    nb = h.nb + excluded.nb, ns = h.ns + excluded.ns,
    closed = h.closed and excluded.nb = 0;

  -- positions sold out in this batch become habits
  with c as (
    update yr_oh h set closed = true
    from (select distinct x.mint, x.who from _t x where x.k = 2) s
    where h.mint = s.mint and h.who = s.who and not h.closed and h.ns > 0 and h.bought > 0 and h.tok <= h.bought * 0.02
    returning h.who, (h.tl - h.t1) / 1000.0 hold, h.sout - h.sin pnl, h.tl)
  insert into yr_ow as w (who, n, hold, quick, win, pnl, last_t)
  select c.who, count(*), sum(c.hold), count(*) filter (where c.hold < 60), count(*) filter (where c.pnl > 0), sum(c.pnl), max(c.tl)
  from c group by c.who
  on conflict (who) do update set n = w.n + excluded.n, hold = w.hold + excluded.hold, quick = w.quick + excluded.quick,
    win = w.win + excluded.win, pnl = w.pnl + excluded.pnl, last_t = greatest(w.last_t, excluded.last_t);

  -- checkpoints reached: snapshot the coins that traded in the 2 minutes before
  insert into yr_os (cp, mint, at, f, mc)
  select z.cp, z.mint, now_ms, yr_ofeat(z.mint, z.cp), z.c
  from (
    select o.mint, cps[o.cp + 1] cp, b.c, b.b
    from yr_oc o
    cross join lateral (select x.c, x.b from yr_ob x where x.mint = o.mint and x.b <= cps[o.cp + 1] order by x.b desc limit 1) b
    where o.cp < 12 and o.t0 + (cps[o.cp + 1] + 1)::bigint * 10000 <= hi) z
  where z.b > z.cp - 12 and z.c > 0
  on conflict do nothing;
  get diagnostics n_snap = row_count;
  update yr_oc o set cp = o.cp + 1 where o.cp < 12 and o.t0 + (cps[o.cp + 1] + 1)::bigint * 10000 <= hi;

  -- 10 minutes after a checkpoint: what happened next
  update yr_os s set fut = z.fut, mx = z.mx, mn = z.mn
  from (
    select s2.cp, s2.mint,
      array(select coalesce((select x.c from yr_ob x where x.mint = s2.mint and x.b <= s2.cp + 2 * g order by x.b desc limit 1), s2.mc) / s2.mc
            from generate_series(1, 30) g order by g)::real[] fut,
      coalesce((select max(x.h) from yr_ob x where x.mint = s2.mint and x.b > s2.cp and x.b <= s2.cp + 60), s2.mc) / s2.mc mx,
      coalesce((select min(x.l) from yr_ob x where x.mint = s2.mint and x.b > s2.cp and x.b <= s2.cp + 60), s2.mc) / s2.mc mn
    from yr_os s2 join yr_oc o on o.mint = s2.mint
    where s2.fut is null and o.t0 + (s2.cp + 61)::bigint * 10000 <= hi) z
  where s.cp = z.cp and s.mint = z.mint;
  get diagnostics n_fut = row_count;

  insert into yr_okv (k, v) values ('wm', hi) on conflict (k) do update set v = excluded.v;

  -- once a minute: housekeeping
  if extract(second from clock_timestamp()) < 10 then
    insert into yr_okv (k, v) values ('recorded', (select count(*) from yr_os where fut is not null))
    on conflict (k) do update set v = excluded.v;
    with gone as (
      delete from yr_oc o
      where (o.t0 < now_ms - 5400000 and o.last_t < now_ms - 900000) or o.t0 < now_ms - 21600000
      returning o.mint)
    , g1 as (delete from yr_ob x using gone where x.mint = gone.mint)
    delete from yr_oh h using gone where h.mint = gone.mint;
    delete from yr_os where fut is null and at < now_ms - 1800000;   -- the coin was dropped before its outcome
    delete from yr_os where at < now_ms - 7 * 86400000;
    delete from yr_ow where last_t < now_ms - 3 * 86400000;
    delete from yr_obirth where t < now_ms - 86400000;
  end if;

  return jsonb_build_object('n', n_t, 'new', n_new, 'snap', n_snap, 'fut', n_fut);
end $$;

-- the k past snapshots closest to how this coin looks now, with what they did next
create or replace function yr_ofuture_core(p_mint text, p_k int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; now_ms bigint := yr_now(); age_b int; v_cp int; q real[]; res jsonb;
  cps int[] := '{3,6,9,12,18,24,30,45,60,90,120,180}';
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then return null; end if;
  age_b := ((now_ms - o.t0) / 10000)::int;
  if age_b > 240 then return jsonb_build_object('old', true, 'age_b', age_b); end if;
  select c into v_cp from unnest(cps) c order by abs(ln(c::float) - ln(greatest(age_b, 2)::float)) limit 1;
  q := yr_ofeat(p_mint, age_b);
  if q is null then return null; end if;
  with base as (
    select s.mint, s.f, s.fut, s.mx, s.mn from yr_os s where s.cp = v_cp and s.fut is not null and s.mint <> p_mint),
  st as (
    select count(*) n,
      coalesce(nullif(stddev_pop(f[1]), 0), 1) s1, coalesce(nullif(stddev_pop(f[2]), 0), 1) s2,
      coalesce(nullif(stddev_pop(f[3]), 0), 1) s3, coalesce(nullif(stddev_pop(f[4]), 0), 1) s4,
      coalesce(nullif(stddev_pop(f[5]), 0), 1) s5, coalesce(nullif(stddev_pop(f[6]), 0), 1) s6,
      coalesce(nullif(stddev_pop(f[7]), 0), 1) s7, coalesce(nullif(stddev_pop(f[8]), 0), 1) s8,
      coalesce(nullif(stddev_pop(f[9]), 0), 1) s9, coalesce(nullif(stddev_pop(f[10]), 0), 1) s10,
      coalesce(nullif(stddev_pop(f[11]), 0), 1) s11, coalesce(nullif(stddev_pop(f[12]), 0), 1) s12,
      coalesce(nullif(stddev_pop(f[13]), 0), 1) s13,
      avg((mx >= 2)::int) b2x, avg((mx >= 1.5)::int) b50, avg((mn <= 0.5)::int) bdump, avg((fut[30] <= 0.5)::int) bend
    from base),
  d as (
    select b.mint, b.fut, b.mx, b.mn,
      ( 1.3 * ((b.f[1] - q[1]) / st.s1) ^ 2 + 1.0 * ((b.f[2] - q[2]) / st.s2) ^ 2 + 1.0 * ((b.f[3] - q[3]) / st.s3) ^ 2
      + 0.8 * ((b.f[4] - q[4]) / st.s4) ^ 2 + 1.0 * ((b.f[5] - q[5]) / st.s5) ^ 2 + 0.5 * ((b.f[6] - q[6]) / st.s6) ^ 2
      + 0.5 * ((b.f[7] - q[7]) / st.s7) ^ 2 + 0.6 * ((b.f[8] - q[8]) / st.s8) ^ 2 + 0.8 * ((b.f[9] - q[9]) / st.s9) ^ 2
      + 0.5 * ((b.f[10] - q[10]) / st.s10) ^ 2 + 0.6 * ((b.f[11] - q[11]) / st.s11) ^ 2 + 0.5 * ((b.f[12] - q[12]) / st.s12) ^ 2
      + 1.0 * ((b.f[13] - q[13]) / st.s13) ^ 2 )::real dist
    from base b, st
    order by 5
    limit p_k)
  select jsonb_build_object(
    'cp', v_cp, 'age_b', age_b, 'n', (select n from st), 'f', to_jsonb(q),
    'base', (select jsonb_build_object('p2x', round(b2x, 3), 'p50', round(b50, 3), 'dump', round(bdump, 3), 'end', round(bend, 3)) from st),
    'odds', (select jsonb_build_object('k', count(*), 'p2x', round(avg((mx >= 2)::int), 3), 'p50', round(avg((mx >= 1.5)::int), 3),
                 'dump', round(avg((mn <= 0.5)::int), 3), 'end', round(avg((fut[30] <= 0.5)::int), 3),
                 'up', round(avg((fut[30] >= 1)::int), 3),
                 'med', round(percentile_cont(0.5) within group (order by fut[30])::numeric, 3),
                 'best', round(percentile_cont(0.5) within group (order by mx)::numeric, 3),
                 'dist', round(avg(dist)::numeric, 2)) from d),
    'matches', (select jsonb_agg(jsonb_build_array(d.mint, round(d.dist::numeric, 2), round(d.mx::numeric, 3), round(d.mn::numeric, 3),
                   (select jsonb_agg(round(x::numeric, 3)) from unnest(d.fut) x), coalesce(br.symbol, co.symbol)) order by d.dist)
                from d left join yr_obirth br on br.mint = d.mint left join yr_coins co on co.mint = d.mint))
  into res;
  return res;
end $$;

-- a coin's chart since birth and its oracle
create or replace function yr_future(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; now_ms bigint := yr_now();
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then
    return jsonb_build_object('tracked', false, 'now', now_ms, 'recorded', (select v from yr_okv where k = 'recorded'));
  end if;
  return jsonb_build_object('tracked', true, 'now', now_ms, 't0', o.t0, 'dev', o.dev, 'n', o.n, 'ath', o.ath,
    'recorded', (select v from yr_okv where k = 'recorded'),
    'meta', (select jsonb_build_array(name, symbol, uri) from yr_obirth where mint = p_mint),
    'path', (select jsonb_agg(jsonb_build_array(x.b, x.c, x.h, x.l, x.nb, x.ns, round(x.vb::numeric, 3), round(x.vs::numeric, 3)) order by x.b)
             from yr_ob x where x.mint = p_mint),
    'oracle', yr_ofuture_core(p_mint, 30));
end $$;

-- who holds a coin, by habit: [who, supply %, kind, first trade, SOL in, SOL out, closed positions, avg hold s, win rate, pnl]
-- exit: holders with known habits, [seconds until their usual exit (negative: overdue), supply %, kind]
create or replace function yr_xray(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; now_ms bigint := yr_now(); res jsonb;
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then return jsonb_build_object('tracked', false, 'now', now_ms); end if;
  with h as (
    select h.who, h.tok, h.bought, h.sin, h.sout, h.t1, h.tl, h.nb, h.ns, w.n wn, w.hold wh, w.win ww, w.pnl wp,
      case when h.who = o.dev then 'dev'
           when h.t1 <= o.t0 + 2000 then 'sniper'
           when w.n >= 3 and w.hold / w.n < 90 then 'flipper'
           when w.n >= 5 and w.win::real / w.n >= 0.55 and w.pnl > 0 then 'smart'
           when w.n is null then 'fresh'
           else 'trader' end cls
    from yr_oh h left join yr_ow w on w.who = h.who
    where h.mint = p_mint)
  select jsonb_build_object(
    'tracked', true, 'now', now_ms, 't0', o.t0, 'dev', o.dev,
    'holders', (select count(*) from h where tok > 1),
    'traders', (select count(*) from h),
    'known', (select count(*) from h where wn is not null),
    'kinds', (select jsonb_object_agg(cls, jsonb_build_array(n, sh)) from (
                select cls, count(*) n, round((sum(greatest(tok, 0)) / 1e7)::numeric, 2) sh from h where tok > 1 group by cls) c),
    'devpos', (select jsonb_build_array(round((bought / 1e7)::numeric, 3), round((greatest(tok, 0) / 1e7)::numeric, 3),
                 round(sin::numeric, 3), round(sout::numeric, 3), ns, tl) from h where who = o.dev),
    'top', (select jsonb_agg(jsonb_build_array(who, round((tok / 1e7)::numeric, 3), cls, t1, round(sin::numeric, 3), round(sout::numeric, 3),
               wn, case when wn > 0 then round((wh / wn)::numeric) end, case when wn > 0 then round(ww::numeric / wn, 2) end,
               round(coalesce(wp, 0)::numeric, 2)) order by tok desc)
            from (select * from h where tok > 1 order by tok desc limit 20) t),
    'exit', (select jsonb_agg(jsonb_build_array(round(((t1 - now_ms) / 1000.0 + (wh / wn)::numeric)), round((tok / 1e7)::numeric, 3), cls))
             from h where tok > 1 and wn >= 3))
  into res;
  return res;
end $$;

-- the most traded coins followed from birth, with their odds
-- [mint, name, symbol, uri, t0, mc, ath, trades 2m, buys 2m, SOL 2m, oracle (no matches)]
create or replace function yr_oracle_hot() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c yr_tcache; now_ms bigint := yr_now(); res jsonb;
begin
  select * into c from yr_tcache where k = 'ohot';
  if found and c.at > clock_timestamp() - interval '8 seconds' then return c.data; end if;
  if not pg_try_advisory_xact_lock(hashtext('yr_oracle_hot')) then
    return coalesce(c.data, jsonb_build_object('now', now_ms, 'coins', '[]'::jsonb));
  end if;
  with a as (
    select x.mint, count(*)::int n2, count(*) filter (where x.k = 1)::int b2, sum(x.sol) v2
    from yr_ticks x where x.t > now_ms - 120000 and x.vsol > 0 group by x.mint),
  h as (
    select o.mint, o.t0, o.ath, a.n2, a.b2, a.v2 from a join yr_oc o on o.mint = a.mint
    where o.t0 > now_ms - 3600000 order by a.n2 desc limit 30)
  select jsonb_build_object('now', now_ms, 'recorded', (select v from yr_okv where k = 'recorded'),
    'coins', coalesce(jsonb_agg(jsonb_build_array(
      h.mint, coalesce(br.name, co.name, tm.name), coalesce(br.symbol, co.symbol, tm.symbol), coalesce(br.uri, co.uri, tm.uri), h.t0,
      (select x.c from yr_ob x where x.mint = h.mint order by x.b desc limit 1), h.ath, h.n2, h.b2, round(h.v2::numeric, 2),
      yr_ofuture_core(h.mint, 30) - 'matches' - 'f') order by h.n2 desc), '[]'::jsonb))
  into res
  from h
  left join yr_obirth br on br.mint = h.mint
  left join yr_coins co on co.mint = h.mint
  left join yr_tmeta tm on tm.mint = h.mint
  where coalesce(br.name, co.name, tm.name, '') || ' ' || coalesce(br.symbol, co.symbol, tm.symbol, '')
        !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)';
  insert into yr_tcache (k, at, data) values ('ohot', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;

revoke all on function yr_ofeat(text, int) from public, anon, authenticated;
revoke all on function yr_oracle_roll() from public, anon, authenticated;
revoke all on function yr_ofuture_core(text, int) from public, anon, authenticated;
grant execute on function yr_future(text) to anon, authenticated;
grant execute on function yr_xray(text) to anon, authenticated;
grant execute on function yr_oracle_hot() to anon, authenticated;

select cron.schedule('yr-oracle-roll', '10 seconds', 'select yr_oracle_roll()');
