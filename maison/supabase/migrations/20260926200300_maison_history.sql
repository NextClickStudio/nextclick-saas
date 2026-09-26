-- Daily closing values per trend (last point of each UTC day), one row per trend.
create or replace function public.maison_history(p_ids text[] default null, p_days int default 30)
returns table (trend_id text, points numeric[])
language sql stable set search_path = '' as $$
  select d.trend_id, array_agg(d.value order by d.day)
  from (
    select distinct on (p.trend_id, date_trunc('day', p.ts)) p.trend_id, date_trunc('day', p.ts) as day, p.value
    from public.maison_trend_points p
    where p.ts > now() - make_interval(days => p_days)
      and (p_ids is null or p.trend_id = any (p_ids))
    order by p.trend_id, date_trunc('day', p.ts), p.ts desc
  ) d
  group by d.trend_id
$$;
