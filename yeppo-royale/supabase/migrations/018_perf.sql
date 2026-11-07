-- yeppo oracle: keep the database light.
-- After v2 the roll fell behind: a slow batch timed out, the next one carried even more ticks, and the
-- database choked. Now a roll folds at most 30 s of ticks (it catches up a little every 10 s), snapshots at
-- most 300 coins, the fresh-holder share reads the 100 biggest holders, the look-alike search reads the
-- latest 5,000 snapshots of a checkpoint, and the hot board is cached 20 s for its 20 coins. Additive.

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
    from (select x.who from yr_oh x where x.mint = p_mint and x.tok > 0 order by x.tok desc limit 100) h
    left join yr_ow w on w.who = h.who;
  return jsonb_build_object('er', round(v_er::numeric, 3), 'bshare', round(v_bs::numeric, 3), 'n', coalesce(v_n, 0),
    'drift', round(v_drift::numeric, 3), 'cv', round(v_cv::numeric, 3), 'fresh', round(v_fresh::numeric, 3),
    'ladder', coalesce(v_er >= 0.6 and v_bs >= 0.8 and v_drift > 0 and v_n >= 30, false));
end $$;

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
  from (select f from yr_os where cp = p_cp and fut is not null order by at desc limit 5000) r
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
    select x.mint, x.f, x.fut, x.mx, x.mn from yr_os x where x.cp = v_cp and x.fut is not null and x.mint <> p_mint
    order by x.at desc limit 5000),
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
      from (select y.fut, y.mx, y.mn, y.f from yr_os y
            where y.cp = p_cp and y.fut is not null and y.at < t.at - 600000 and y.mint <> t.mint
            order by y.at desc limit 5000) b
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

create or replace function yr_oracle_hot() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c yr_tcache; now_ms bigint := yr_now(); res jsonb;
begin
  select * into c from yr_tcache where k = 'ohot';
  if found and c.at > clock_timestamp() - interval '20 seconds' then return c.data; end if;
  if not pg_try_advisory_xact_lock(hashtext('yr_oracle_hot')) then
    return coalesce(c.data, jsonb_build_object('now', now_ms, 'coins', '[]'::jsonb));
  end if;
  with a as (
    select x.mint, count(*)::int n2, count(*) filter (where x.k = 1)::int b2, sum(x.sol) v2
    from yr_ticks x where x.t > now_ms - 120000 and x.vsol > 0 group by x.mint),
  h as (
    select o.mint, o.t0, o.ath, o.dev, a.n2, a.b2, a.v2 from a join yr_oc o on o.mint = a.mint
    where o.t0 > now_ms - 3600000 order by a.n2 desc limit 20)
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

do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_roll';
  if position('wm + 30000' in src) = 0 then
    src := replace(src, '  hi := now_ms - 3000;', '  hi := least(now_ms - 3000, wm + 30000);   -- at most 30 s of ticks per roll');
    src := replace(src, '    where o.cp < 12 and o.t0 + (cps[o.cp + 1] + 1)::bigint * 10000 <= hi) z',
                        '    where o.cp < 12 and o.t0 + (cps[o.cp + 1] + 1)::bigint * 10000 <= hi limit 300) z');
    execute format('create or replace function yr_oracle_roll() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;
