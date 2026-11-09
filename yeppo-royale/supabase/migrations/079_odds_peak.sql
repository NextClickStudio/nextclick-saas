-- 079: when coins like this one peak (3 Nov 2026). yr_odds gains pk: for the coins of the group that went ×2 from that
-- point, the median time from that point to their high, in seconds (from the 30 s price steps of their first 20
-- minutes). The read shows "peak usually after ~N min" next to the odds.
alter table yr_odds add column if not exists pk int;

create or replace function yr_odds_calc() returns int
language plpgsql security definer set search_path = public set statement_timeout = '120s' set work_mem = '64MB'
  set synchronous_commit = off as $$
declare k int;
begin
  create temp table _o on commit drop as
  with c as (
    select p, coalesce(nullif(mc0, 0), 27.96) b, ath, ath_s, out_s,
      count(*) over w prev, count(*) filter (where rug_s is not null) over w prev_rug,
      count(*) filter (where grad or ath / coalesce(nullif(mc0, 0), 27.96) >= 5) over w prev_ran
    from yr_cc where dev is not null and n >= 20 and p is not null and t0 < yr_now() - 1800000
    window w as (partition by dev order by t0 rows between unbounded preceding and 1 preceding))
  select s.i,
    case when prev = 0 then 'first' when prev_rug >= 2 and prev_rug >= prev * 0.4 then 'rugger'
         when prev >= 40 and prev_ran < prev * 0.05 then 'deadfarm' when prev_rug > 0 then 'somerug' else 'clean' end cre,
    case when p[s.i] / b < 1.2 then 0 when p[s.i] / b < 2 then 1 when p[s.i] / b < 3.5 then 2 else 3 end::smallint xb,
    (out_s is not null and out_s < s.i * 30) dout,
    greatest((select max(v) from unnest(p[s.i + 1:40]) v), case when ath_s > s.i * 30 then ath end) / p[s.i] fut,
    -- seconds from this point to the high of its first 20 minutes
    ((select o from unnest(p[s.i + 1:40]) with ordinality u(v, o) order by v desc, o limit 1) * 30)::int pk
  from c cross join (values (1), (2), (4), (8), (16), (24), (32)) s(i)
  where p[s.i] > 0;

  delete from yr_odds;
  insert into yr_odds (i, cre, xb, dout, n, p2, p3, pk)
  select i, cre, xb, dout, count(*), avg((fut >= 2)::int), avg((fut >= 3)::int),
    (percentile_cont(0.5) within group (order by pk) filter (where fut >= 2))::int
  from _o group by 1, 2, 3, 4 having count(*) >= 60
  union all
  select i, '*', xb, dout, count(*), avg((fut >= 2)::int), avg((fut >= 3)::int),
    (percentile_cont(0.5) within group (order by pk) filter (where fut >= 2))::int
  from _o group by 1, 3, 4 having count(*) >= 60;
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function yr_odds_calc() from public, anon, authenticated;

create or replace function yr_odds_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return coalesce((select jsonb_agg(jsonb_build_array(i, cre, xb, dout, n, round(p2::numeric, 4), round(p3::numeric, 4), pk)) from yr_odds), '[]'::jsonb);
end $$;

select yr_odds_calc();
