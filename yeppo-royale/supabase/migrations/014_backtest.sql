-- yeppo oracle: an honest track record.
-- yr_obacktest replays the oracle on past snapshots. Each test snapshot only sees look-alikes whose outcome
-- was already known at that moment (taken more than 10 minutes before it), exactly like a live scan. It
-- returns, per test, the oracle's call and what really happened. yr_otrack_refresh (hourly) stores the
-- aggregates that the site shows. Additive.

create or replace function yr_obacktest(p_cp int, p_n int, p_k int default 30, p_since bigint default 0)
returns table (cp int, mint text, at bigint, n_train int, p50 real, p2x real, dump real, med real, score int, tone text,
               mx real, mn real, fin real, path real[])
language plpgsql stable security definer set search_path = public as $$
declare t record; st record; t100 bigint;
begin
  -- tests start once 100 outcomes were known
  select x.at + 600000 into t100 from yr_os x where x.cp = p_cp and x.fut is not null order by x.at offset 99 limit 1;
  if t100 is null then return; end if;
  -- one set of feature spreads per checkpoint (spreads move slowly; they carry no outcome)
  select coalesce(nullif(stddev_pop(s.f[1]), 0), 1) s1, coalesce(nullif(stddev_pop(s.f[2]), 0), 1) s2,
         coalesce(nullif(stddev_pop(s.f[3]), 0), 1) s3, coalesce(nullif(stddev_pop(s.f[4]), 0), 1) s4,
         coalesce(nullif(stddev_pop(s.f[5]), 0), 1) s5, coalesce(nullif(stddev_pop(s.f[6]), 0), 1) s6,
         coalesce(nullif(stddev_pop(s.f[7]), 0), 1) s7, coalesce(nullif(stddev_pop(s.f[8]), 0), 1) s8,
         coalesce(nullif(stddev_pop(s.f[9]), 0), 1) s9, coalesce(nullif(stddev_pop(s.f[10]), 0), 1) s10,
         coalesce(nullif(stddev_pop(s.f[11]), 0), 1) s11, coalesce(nullif(stddev_pop(s.f[12]), 0), 1) s12,
         coalesce(nullif(stddev_pop(s.f[13]), 0), 1) s13
    into st from yr_os s where s.cp = p_cp and s.fut is not null;
  for t in
    select s.* from yr_os s
    where s.cp = p_cp and s.fut is not null and s.at > greatest(p_since, t100)
    order by md5(s.mint) limit p_n
  loop
    return query
    with d as (
      select b.fut bf, b.mx bmx, b.mn bmn,
        ( 1.3 * ((b.f[1] - t.f[1]) / st.s1) ^ 2 + 1.0 * ((b.f[2] - t.f[2]) / st.s2) ^ 2 + 1.0 * ((b.f[3] - t.f[3]) / st.s3) ^ 2
        + 0.8 * ((b.f[4] - t.f[4]) / st.s4) ^ 2 + 1.0 * ((b.f[5] - t.f[5]) / st.s5) ^ 2 + 0.5 * ((b.f[6] - t.f[6]) / st.s6) ^ 2
        + 0.5 * ((b.f[7] - t.f[7]) / st.s7) ^ 2 + 0.6 * ((b.f[8] - t.f[8]) / st.s8) ^ 2 + 0.8 * ((b.f[9] - t.f[9]) / st.s9) ^ 2
        + 0.5 * ((b.f[10] - t.f[10]) / st.s10) ^ 2 + 0.6 * ((b.f[11] - t.f[11]) / st.s11) ^ 2 + 0.5 * ((b.f[12] - t.f[12]) / st.s12) ^ 2
        + 1.0 * ((b.f[13] - t.f[13]) / st.s13) ^ 2 ) dist
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

-- a trade on a call: buy at the scan, sell at +50%, at -30% or after 10 minutes, whichever comes first
-- (20 s steps), minus 2% for pump.fun's fees both ways
create or replace function yr_otrade(p real[]) returns real
language sql immutable as $$
  select coalesce(
    (select case when x >= 1.5 then 0.5 when x <= 0.7 then -0.3 end
     from unnest(p) with ordinality u(x, i) where x >= 1.5 or x <= 0.7 order by i limit 1),
    p[array_length(p, 1)] - 1) - 0.02
$$;

-- hourly: the oracle's record on the last 3 days, every checkpoint, stored for the site
create or replace function yr_otrack_refresh(p_n int default 120) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  create temp table _bt on commit drop as
    select b.* from unnest('{6,12,18,30,60}'::int[]) c(cp), lateral yr_obacktest(c.cp, p_n) b;
  select jsonb_build_object(
    'at', yr_now(),
    'tests', count(*),
    'coins', count(distinct mint),
    'calls', jsonb_build_object(
      'up', count(*) filter (where tone = 'up'), 'mid', count(*) filter (where tone = 'mid'),
      'down', count(*) filter (where tone = 'down'), 'flat', count(*) filter (where tone = 'flat')),
    -- strong setup: how often it really pumped, and the simple trade on it
    'up', (select jsonb_build_object('n', count(*), 'hit50', avg((mx >= 1.5)::int), 'higher', avg((fin > 1)::int),
             'win', avg((yr_otrade(path) > 0)::int), 'ret', avg(yr_otrade(path))) from _bt where tone = 'up'),
    -- likely dump: how often it really dumped
    'down', (select jsonb_build_object('n', count(*), 'dump50', avg((mn <= 0.5)::int), 'lower', avg((fin < 1)::int),
               'win', avg((yr_otrade(path) > 0)::int), 'ret', avg(yr_otrade(path))) from _bt where tone = 'down'),
    -- every coin, no oracle: the baseline
    'all', (select jsonb_build_object('n', count(*), 'hit50', avg((mx >= 1.5)::int), 'dump50', avg((mn <= 0.5)::int),
              'higher', avg((fin > 1)::int), 'lower', avg((fin < 1)::int),
              'win', avg((yr_otrade(path) > 0)::int), 'ret', avg(yr_otrade(path))) from _bt),
    -- up and down calls that ended on the right side 10 minutes later
    'direction', (select avg(((tone = 'up' and fin > 1) or (tone = 'down' and fin < 1))::int) from _bt where tone in ('up', 'down')),
    -- calibration: predicted chance of +50% vs what happened, in five bands
    'calib', (select jsonb_agg(jsonb_build_array(band, n, pred, real) order by band) from (
               select least(width_bucket(p50, 0, 1, 5), 5) band, count(*) n, round(avg(p50)::numeric, 3) pred, round(avg((mx >= 1.5)::int)::numeric, 3) real
               from _bt group by 1) c))
  into res from _bt;
  insert into yr_tcache (k, at, data) values ('otrack', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;
revoke all on function yr_otrack_refresh(int) from public, anon, authenticated;

create or replace function yr_otrack() returns jsonb
language sql stable security definer set search_path = public as $$
  select data from yr_tcache where k = 'otrack'
$$;
grant execute on function yr_otrack() to anon, authenticated;
