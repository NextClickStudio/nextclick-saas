-- 086: the record counts every call of a coin's first 2 hours, and yr-launch keeps up (4 Nov 2026).
--  * yr_call_log took only calls in a coin's first 20 minutes (yr_cc keeps its price every 30 s for that long), so a
--    call on a 46-minute-old coin that then ran never showed. Now up to 2 hours: the price at the call is the 30 s
--    step when there is one, else the call's own × launch; "after" is the highest of the steps after it, the high
--    when it came after the call, and the price now; "fell 50%" is the lowest of the steps after it and the price now
--    (a rug after minute 20 counts too).
--  * calls are kept 14 days (the page shows 7), not 3, so the best wins of the week stay listed.
--  * yr-launch reads coins from 50 trades, not 20: about 8,000 a day, what the free node's pace keeps up with, and
--    the coins people open.
create or replace function yr_call_log(p_mint text, p_word text, p_age integer, p_x real, p_p2 real) returns void
language plpgsql security definer set search_path to 'public' set synchronous_commit to 'off' as $function$
begin
  perform yr_guard();
  if p_word not in ('Momentum', 'Opportunity', 'Wait', 'Don''t buy') or p_age < 0 or p_age > 7200 or p_x is null or p_x <= 0 then return; end if;
  insert into yr_calls (mint, word, t, age, x, p2) values (left(p_mint, 44), p_word, yr_now(), p_age, p_x, p_p2)
  on conflict do nothing;
end $function$;

-- a call's move after it: [price at the call, highest after / at, lowest after / at]
create or replace function yr_call_move(k yr_calls, c yr_cc) returns real[]
language sql immutable as $$
  select array[a.at,
    greatest(case when k.age <= 1170 then (select max(v) from unnest(c.p[(k.age / 30) + 2:40]) v) end, case when c.ath_s > k.age then c.ath end, c.mc) / a.at,
    least(case when k.age <= 1170 then (select min(v) from unnest(c.p[(k.age / 30) + 2:40]) v) end, c.mc) / a.at]::real[]
  from (select case when k.age <= 1170 and c.p[(k.age / 30) + 1] > 0 then c.p[(k.age / 30) + 1]
                    else k.x * coalesce(nullif(c.mc0, 0), 27.96) end at) a
  where a.at > 0;
$$;

create or replace function yr_record_calc() returns integer
language plpgsql security definer set search_path to 'public' set statement_timeout to '60s' set synchronous_commit to 'off' as $function$
declare nrows int;
begin
  create temp table _r on commit drop as
  select (to_timestamp(z.t / 1000) at time zone 'utc')::date d, z.word, z.p2, z.m[2] up, z.m[3] dn
  from (select k.t, k.word, k.p2, yr_call_move(k, c) m from yr_calls k join yr_cc c on c.mint = k.mint where k.t < yr_now() - 1800000) z
  where z.m is not null;

  insert into yr_record (day, word, n, x2, x3, down)
  select d, word, count(*), count(*) filter (where up >= 2), count(*) filter (where up >= 3), count(*) filter (where dn <= 0.5)
  from _r group by 1, 2
  union all
  select d, case when p2 < 0.05 then 'Odds 0-5%' when p2 < 0.1 then 'Odds 5-10%' when p2 < 0.2 then 'Odds 10-20%' else 'Odds 20%+' end,
    count(*), count(*) filter (where up >= 2), count(*) filter (where up >= 3), count(*) filter (where dn <= 0.5)
  from _r where p2 is not null group by 1, 2
  on conflict (day, word) do update set n = excluded.n, x2 = excluded.x2, x3 = excluded.x3, down = excluded.down;
  get diagnostics nrows = row_count;
  delete from yr_calls where t < yr_now() - 14 * 86400000::bigint;
  delete from yr_record where day < current_date - 60;
  return nrows;
end $function$;

-- the week's best calls: Momentum or Opportunity, then ×2 or more, biggest first
create or replace function yr_wins_s() returns jsonb
language plpgsql stable security definer set search_path to 'public' set statement_timeout to '10s' as $function$
begin
  perform yr_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_array(mint, sym, word, round(up::numeric, 1), t) order by up desc)
    from (
      select distinct on (k.mint) k.mint, c.sym, k.word, k.t, (yr_call_move(k, c))[2] up
      from yr_calls k join yr_cc c on c.mint = k.mint
      where k.word in ('Momentum', 'Opportunity') and k.t > yr_now() - 7 * 86400000::bigint and k.t < yr_now() - 600000
      order by k.mint, (yr_call_move(k, c))[2] desc nulls last) w
    where up >= 2 order by up desc limit 12), '[]'::jsonb);
end $function$;

create or replace function yr_launch_need(p_n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(a.mint), '[]'::jsonb) from (
    select c.mint from yr_cc c
    where c.t0 > (select yr_now() - 1800000) and c.t0 < (select yr_now() - 15000) and c.n >= 50
      and not exists (select 1 from yr_launch l where l.mint = c.mint)
      and not exists (select 1 from yr_launch_try x where x.mint = c.mint and (x.final or x.n >= 3 or x.t > (select yr_now() - 60000)))
    order by c.t0 desc limit least(greatest(p_n, 1), 50)) a;
$$;
