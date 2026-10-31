-- yeppo oracle: the track record measured on the calls the site makes.
--  runner potential: 20%+ of the look-alikes went up 50% and at most 10% dumped
--  likely dump:      25%+ of the look-alikes dumped 50%
-- (thresholds picked from the first backtest; red flags such as bot ladders and serial ruggers are not
-- replayed here, they only make the site more careful). Additive. The hourly job uses 80 tests per
-- checkpoint so a refresh stays around a minute.

create or replace function yr_otrack_refresh(p_n int default 150) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  create temp table _bt on commit drop as
    select b.* from unnest('{6,12,18,30,60}'::int[]) c(cp), lateral yr_obacktest(c.cp, p_n) b;
  alter table _bt add column call text;
  update _bt set call = case when dump >= 0.25 then 'down' when p50 >= 0.2 and dump <= 0.1 then 'up'
                             when p50 + dump < 0.1 then 'flat' else 'mid' end;
  select jsonb_build_object(
    'at', yr_now(),
    'tests', count(*),
    'coins', count(distinct mint),
    'calls', jsonb_build_object(
      'up', count(*) filter (where call = 'up'), 'mid', count(*) filter (where call = 'mid'),
      'down', count(*) filter (where call = 'down'), 'flat', count(*) filter (where call = 'flat')),
    'up', (select jsonb_build_object('n', count(*), 'hit50', avg((mx >= 1.5)::int), 'higher', avg((fin > 1)::int),
             'win', avg((yr_otrade(path) > 0)::int), 'ret', avg(yr_otrade(path))) from _bt where call = 'up'),
    'down', (select jsonb_build_object('n', count(*), 'dump50', avg((mn <= 0.5)::int), 'lower', avg((fin < 1)::int))
             from _bt where call = 'down'),
    'all', (select jsonb_build_object('n', count(*), 'hit50', avg((mx >= 1.5)::int), 'dump50', avg((mn <= 0.5)::int),
              'higher', avg((fin > 1)::int), 'lower', avg((fin < 1)::int),
              'win', avg((yr_otrade(path) > 0)::int), 'ret', avg(yr_otrade(path))) from _bt),
    'direction', (select avg(((call = 'up' and fin > 1) or (call = 'down' and fin < 1))::int) from _bt where call in ('up', 'down')),
    'calib', (select jsonb_agg(jsonb_build_array(band, n, pred, real) order by band) from (
               select least(width_bucket(p50, 0, 1, 5), 5) band, count(*) n, round(avg(p50)::numeric, 3) pred,
                      round(avg((mx >= 1.5)::int)::numeric, 3) real
               from _bt group by 1) c))
  into res from _bt;
  insert into yr_tcache (k, at, data) values ('otrack', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;
revoke all on function yr_otrack_refresh(int) from public, anon, authenticated;

select cron.alter_job((select jobid from cron.job where jobname = 'yr-otrack'), command := 'select yr_otrack_refresh(80)');
