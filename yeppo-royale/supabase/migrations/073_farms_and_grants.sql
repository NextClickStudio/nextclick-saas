-- 073: farms judged by what their coins do, and no table rights left to the public API (3 Nov 2026).
-- 1. The radar kept out every coin of a creator with 40+ coins in 14 days. Measured on those 14 days: farms whose coins
--    went ×5 or graduated at least 1 time in 20 made ×5 9.0% of the time and graduated 2.2% (other creators: 10.8% and
--    3.4%); only farms below that are traps (×5 1-5%, graduated 0.3-1.1%). 'farm' now means the second kind.
-- 2. Every table already has row security with no policy (nothing readable through the API), but anon and
--    authenticated still held Supabase's default rights on them (TRUNCATE among them). They go, now and for new tables.
do $$
declare d text := pg_get_functiondef('yr_quick_row(yr_cc,bigint)'::regprocedure);
begin
  d := replace(d, $x$'farm', (select count(*) from yr_cc d where d.dev = c.dev) >= 40,$x$,
    $x$'farm', (select count(*) >= 40 and count(*) filter (where d.grad or d.ath >= coalesce(nullif(d.mc0, 0), 27.96) * 5)
       < 0.05 * greatest(1, count(*) filter (where d.t0 < now_ms - 1200000)) from yr_cc d where d.dev = c.dev),$x$);
  if position('greatest(1, count(*) filter' in d) = 0 then raise exception 'yr_quick_row: farm line not found'; end if;
  execute d;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
