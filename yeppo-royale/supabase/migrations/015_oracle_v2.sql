-- yeppo oracle v2: bot ladders, fresh wallets, the dev's record.
--  * five new features (14-18): how straight the last 2 minutes went up (bot "ladders" rug), the share of
--    holders yeppo never saw close a trade, how alike the last minute's buys were, whether the dev sold,
--    and the dev's rug rate on earlier coins. Older snapshots have 13; a missing feature adds nothing to a
--    distance.
--  * yr_dev: every creator's record, filled when a followed coin is retired: coins, rugs (dev sold and the
--    coin fell 60%+ from its high), dead (fell 50%+), graduates (350+ SOL market cap), best high.
--  * yr_xray and yr_oracle_hot add the pattern and the dev's record. Additive.

create table if not exists yr_dev (
  dev text primary key,
  coins int not null default 0,
  rugs int not null default 0,
  grads int not null default 0,
  dead int not null default 0,
  best real not null default 0,
  first_t bigint not null,
  last_t bigint not null
);
create index if not exists yr_dev_last on yr_dev (last_t);
alter table yr_dev enable row level security;
create index if not exists yr_oc_dev on yr_oc (dev);

-- the shape of the last 2 minutes: er (|net move| / path, 1 = a straight line), buy share, trades, drift,
-- spread of the last minute's buy sizes (cv), share of holders with no closed trade (fresh), and the
-- ladder flag: a straight climb made of buys
create or replace function yr_opattern(p_mint text, p_b int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; v_er real; v_bs real; v_n int; v_drift real; v_cv real; v_fresh real; cut bigint;
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then return null; end if;
  cut := o.t0 + (p_b + 1)::bigint * 10000;
  select abs(sum(d)) / nullif(sum(abs(d)), 0), sum(d) into v_er, v_drift
    from (select ln(x.c / nullif(lag(x.c) over (order by x.b), 0)) d from yr_ob x where x.mint = p_mint and x.b between p_b - 11 and p_b) q;
  select sum(x.nb)::real / nullif(sum(x.nb + x.ns), 0), sum(x.nb + x.ns) into v_bs, v_n
    from yr_ob x where x.mint = p_mint and x.b between p_b - 11 and p_b;
  select stddev_pop(x.sol) / nullif(avg(x.sol), 0) into v_cv
    from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > cut - 60000 and x.t <= cut;
  select avg((w.who is null)::int) into v_fresh
    from yr_oh h left join yr_ow w on w.who = h.who where h.mint = p_mint and h.tok > 0;
  return jsonb_build_object('er', round(v_er::numeric, 3), 'bshare', round(v_bs::numeric, 3), 'n', coalesce(v_n, 0),
    'drift', round(v_drift::numeric, 3), 'cv', round(v_cv::numeric, 3), 'fresh', round(v_fresh::numeric, 3),
    'ladder', coalesce(v_er >= 0.6 and v_bs >= 0.8 and v_drift > 0 and v_n >= 30, false));
end $$;

-- a creator's record: retired coins from yr_dev, plus the other coins they have live right now
create or replace function yr_odev(p_dev text, p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'coins', coalesce(d.coins, 0), 'rugs', coalesce(d.rugs, 0), 'grads', coalesce(d.grads, 0), 'dead', coalesce(d.dead, 0),
    'best', d.best, 'since', d.first_t,
    'live', (select count(*) from yr_oc z where z.dev = p_dev and z.mint <> p_mint),
    'live_sold', (select count(*) from yr_oc z join yr_oh h on h.mint = z.mint and h.who = z.dev
                  where z.dev = p_dev and z.mint <> p_mint and h.ns > 0 and h.tok < h.bought * 0.2),
    'live_dead', (select count(*) from yr_oc z where z.dev = p_dev and z.mint <> p_mint
                  and coalesce((select x.c from yr_ob x where x.mint = z.mint order by x.b desc limit 1), 0) <= z.ath * 0.4))
  from (select 1) one left join yr_dev d on d.dev = p_dev
  where p_dev is not null
$$;

-- features 1-13 as in 012, then:
-- 14 er (straightness of the last 2 minutes)   15 fresh holders   16 cv of the last minute's buys
-- 17 dev sold (1/0)                              18 the dev's rug rate on retired coins
create or replace function yr_ofeat(p_mint text, p_b int) returns real[]
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; cut bigint; v_mc real; lastb int; mch real; mc1 real; v_ath real; ntot int;
  nb6 int; ns6 int; vb6 real; vs6 real; nu int; v_dev real; top10 real; snip real; pt jsonb; v_sold real; v_drug real;
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
  pt := yr_opattern(p_mint, p_b);
  select (h.ns > 0 and h.tok < h.bought * 0.2)::int into v_sold from yr_oh h where h.mint = p_mint and h.who = o.dev;
  select d.rugs::real / nullif(d.coins, 0) into v_drug from yr_dev d where d.dev = o.dev;
  return array[
    ln(v_mc / 27.96), ln(v_mc / coalesce(nullif(mch, 0), 27.96)), ln(v_mc / coalesce(nullif(mc1, 0), 27.96)),
    ln(greatest(v_ath, v_mc) / v_mc),
    ln(1 + nb6 + ns6), (nb6 + 1)::real / (nb6 + ns6 + 2), (vb6 - vs6) / (vb6 + vs6 + 0.5),
    ln(1 + ntot), ln(1 + nu), v_dev, top10, snip, ln(1 + greatest(p_b - lastb, 0)),
    coalesce((pt->>'er')::real, 0.5), coalesce((pt->>'fresh')::real, 0.5), least(coalesce((pt->>'cv')::real, 1), 3),
    coalesce(v_sold, 0), coalesce(v_drug, 0)
  ]::real[];
end $$;

-- weighted, standardized distance between two feature vectors; a feature missing on either side adds 0
create or replace function yr_odist(a real[], b real[], s real[]) returns real
language sql immutable as $$
  select (
      1.3 * coalesce(((a[1] - b[1]) / s[1]) ^ 2, 0) + 1.0 * coalesce(((a[2] - b[2]) / s[2]) ^ 2, 0) + 1.0 * coalesce(((a[3] - b[3]) / s[3]) ^ 2, 0)
    + 0.8 * coalesce(((a[4] - b[4]) / s[4]) ^ 2, 0) + 1.0 * coalesce(((a[5] - b[5]) / s[5]) ^ 2, 0) + 0.5 * coalesce(((a[6] - b[6]) / s[6]) ^ 2, 0)
    + 0.5 * coalesce(((a[7] - b[7]) / s[7]) ^ 2, 0) + 0.6 * coalesce(((a[8] - b[8]) / s[8]) ^ 2, 0) + 0.8 * coalesce(((a[9] - b[9]) / s[9]) ^ 2, 0)
    + 0.5 * coalesce(((a[10] - b[10]) / s[10]) ^ 2, 0) + 0.6 * coalesce(((a[11] - b[11]) / s[11]) ^ 2, 0) + 0.5 * coalesce(((a[12] - b[12]) / s[12]) ^ 2, 0)
    + 1.0 * coalesce(((a[13] - b[13]) / s[13]) ^ 2, 0) + 1.0 * coalesce(((a[14] - b[14]) / s[14]) ^ 2, 0) + 0.6 * coalesce(((a[15] - b[15]) / s[15]) ^ 2, 0)
    + 0.6 * coalesce(((a[16] - b[16]) / s[16]) ^ 2, 0) + 0.8 * coalesce(((a[17] - b[17]) / s[17]) ^ 2, 0) + 0.8 * coalesce(((a[18] - b[18]) / s[18]) ^ 2, 0)
  )::real
$$;

-- the spread of every feature among the snapshots of one checkpoint
create or replace function yr_ospread(p_cp int) returns real[]
language sql stable security definer set search_path = public as $$
  select array[
    coalesce(nullif(stddev_pop(f[1]), 0), 1), coalesce(nullif(stddev_pop(f[2]), 0), 1), coalesce(nullif(stddev_pop(f[3]), 0), 1),
    coalesce(nullif(stddev_pop(f[4]), 0), 1), coalesce(nullif(stddev_pop(f[5]), 0), 1), coalesce(nullif(stddev_pop(f[6]), 0), 1),
    coalesce(nullif(stddev_pop(f[7]), 0), 1), coalesce(nullif(stddev_pop(f[8]), 0), 1), coalesce(nullif(stddev_pop(f[9]), 0), 1),
    coalesce(nullif(stddev_pop(f[10]), 0), 1), coalesce(nullif(stddev_pop(f[11]), 0), 1), coalesce(nullif(stddev_pop(f[12]), 0), 1),
    coalesce(nullif(stddev_pop(f[13]), 0), 1), coalesce(nullif(stddev_pop(f[14]), 0), 1), coalesce(nullif(stddev_pop(f[15]), 0), 1),
    coalesce(nullif(stddev_pop(f[16]), 0), 1), coalesce(nullif(stddev_pop(f[17]), 0), 1), coalesce(nullif(stddev_pop(f[18]), 0), 1)
  ]::real[]
  from yr_os where cp = p_cp and fut is not null
$$;

create or replace function yr_ofuture_core(p_mint text, p_k int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o yr_oc; now_ms bigint := yr_now(); age_b int; v_cp int; q real[]; s real[]; res jsonb;
  cps int[] := '{3,6,9,12,18,24,30,45,60,90,120,180}';
begin
  select * into o from yr_oc where mint = p_mint;
  if not found then return null; end if;
  age_b := ((now_ms - o.t0) / 10000)::int;
  if age_b > 240 then return jsonb_build_object('old', true, 'age_b', age_b); end if;
  select c into v_cp from unnest(cps) c order by abs(ln(c::float) - ln(greatest(age_b, 2)::float)) limit 1;
  q := yr_ofeat(p_mint, age_b);
  if q is null then return null; end if;
  s := yr_ospread(v_cp);
  with base as (
    select x.mint, x.f, x.fut, x.mx, x.mn from yr_os x where x.cp = v_cp and x.fut is not null and x.mint <> p_mint),
  st as (
    select count(*) n, avg((mx >= 2)::int) b2x, avg((mx >= 1.5)::int) b50, avg((mn <= 0.5)::int) bdump, avg((fut[30] <= 0.5)::int) bend
    from base),
  d as (
    select b.mint, b.fut, b.mx, b.mn, yr_odist(b.f, q, s) dist from base b order by 5 limit p_k)
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

create or replace function yr_obacktest(p_cp int, p_n int, p_k int default 30, p_since bigint default 0)
returns table (cp int, mint text, at bigint, n_train int, p50 real, p2x real, dump real, med real, score int, tone text,
               mx real, mn real, fin real, path real[])
language plpgsql stable security definer set search_path = public as $$
declare t record; s real[]; t100 bigint;
begin
  -- tests start once 100 outcomes were known; only active coins (5+ trades in the minute), the ones people scan
  select x.at + 600000 into t100 from yr_os x where x.cp = p_cp and x.fut is not null order by x.at offset 99 limit 1;
  if t100 is null then return; end if;
  s := yr_ospread(p_cp);
  for t in
    select x.* from yr_os x
    where x.cp = p_cp and x.fut is not null and x.at > greatest(p_since, t100) and x.f[5] >= 1.79
    order by md5(x.mint) limit p_n
  loop
    return query
    with d as (
      select b.fut bf, b.mx bmx, b.mn bmn, yr_odist(b.f, t.f, s) dist
      from yr_os b
      where b.cp = p_cp and b.fut is not null and b.at < t.at - 600000 and b.mint <> t.mint
      order by 4
      limit p_k),
    o as (
      select count(*)::int k, avg((bmx >= 1.5)::int)::real q50, avg((bmx >= 2)::int)::real q2x, avg((bmn <= 0.5)::int)::real qd,
             (percentile_cont(0.5) within group (order by bf[30]))::real qm
      from d),
    v as (
      select o.*, round(greatest(1, least(99, 50 + (o.q50 - o.qd) * 55 + greatest(-1, least(1, ln(greatest(o.qm, 0.05)))) * 45)))::int sc,
             (o.q50 + o.qd < 0.1 and abs(o.qm - 1) < 0.1) quiet
      from o)
    select p_cp, t.mint, t.at,
      (select count(*)::int from yr_os x where x.cp = p_cp and x.fut is not null and x.at < t.at - 600000),
      v.q50, v.q2x, v.qd, v.qm, v.sc,
      case when v.quiet then 'flat' when v.sc >= 60 then 'up' when v.sc >= 42 then 'mid' else 'down' end,
      t.mx, t.mn, t.fut[30], t.fut
    from v;
  end loop;
end $$;
revoke all on function yr_obacktest(int, int, int, bigint) from public, anon, authenticated;

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
             from h where tok > 1 and wn >= 3),
    'tags', (select jsonb_object_agg(who, cls) from (
               select who, cls from h where cls in ('dev', 'sniper', 'flipper', 'smart') order by tl desc limit 400) t),
    'pattern', yr_opattern(p_mint, ((now_ms - o.t0) / 10000)::int),
    'devhist', yr_odev(o.dev, p_mint))
  into res;
  return res;
end $$;

-- [mint, name, symbol, uri, born ms, mc SOL, ath SOL, trades 2m, buys 2m, SOL 2m, oracle (no matches), pattern, dev record]
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
    select o.mint, o.t0, o.ath, o.dev, a.n2, a.b2, a.v2 from a join yr_oc o on o.mint = a.mint
    where o.t0 > now_ms - 3600000 order by a.n2 desc limit 30)
  select jsonb_build_object('now', now_ms, 'recorded', (select v from yr_okv where k = 'recorded'),
    'coins', coalesce(jsonb_agg(jsonb_build_array(
      h.mint, coalesce(br.name, co.name, tm.name), coalesce(br.symbol, co.symbol, tm.symbol), coalesce(br.uri, co.uri, tm.uri), h.t0,
      (select x.c from yr_ob x where x.mint = h.mint order by x.b desc limit 1), h.ath, h.n2, h.b2, round(h.v2::numeric, 2),
      yr_ofuture_core(h.mint, 30) - 'matches' - 'f',
      yr_opattern(h.mint, ((now_ms - h.t0) / 10000)::int),
      yr_odev(h.dev, h.mint)) order by h.n2 desc), '[]'::jsonb))
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

revoke all on function yr_opattern(text, int) from public, anon, authenticated;
revoke all on function yr_odev(text, text) from public, anon, authenticated;
revoke all on function yr_ospread(int) from public, anon, authenticated;

-- the roll retires coins once a minute: record them in their creator's history first
do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_roll';
  if position('insert into yr_dev' in src) = 0 then
    src := replace(src, '    with gone as (
      delete from yr_oc o', '    insert into yr_dev as d (dev, coins, rugs, grads, dead, best, first_t, last_t)
    select z.dev, count(*), count(*) filter (where z.rug), count(*) filter (where z.ath >= 350),
           count(*) filter (where not z.rug and z.fin <= z.ath * 0.5), max(z.ath), min(z.t0), max(z.t0)
    from (
      select o.dev, o.t0, o.ath, f.fin,
             coalesce((select h.ns > 0 and h.tok < h.bought * 0.2 from yr_oh h where h.mint = o.mint and h.who = o.dev), false)
               and f.fin <= o.ath * 0.4 rug
      from yr_oc o
      cross join lateral (select coalesce((select x.c from yr_ob x where x.mint = o.mint order by x.b desc limit 1), 0) fin) f
      where o.dev is not null
        and ((o.t0 < now_ms - 5400000 and o.last_t < now_ms - 900000) or o.t0 < now_ms - 21600000)) z
    group by z.dev
    on conflict (dev) do update set coins = d.coins + excluded.coins, rugs = d.rugs + excluded.rugs, grads = d.grads + excluded.grads,
      dead = d.dead + excluded.dead, best = greatest(d.best, excluded.best), first_t = least(d.first_t, excluded.first_t),
      last_t = greatest(d.last_t, excluded.last_t);
    delete from yr_dev where last_t < now_ms - 2592000000;   -- 30 days
    with gone as (
      delete from yr_oc o');
    execute format('create or replace function yr_oracle_roll() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;

-- the track record, every hour
select cron.schedule('yr-otrack', '17 * * * *', 'select yr_otrack_refresh(150)');
