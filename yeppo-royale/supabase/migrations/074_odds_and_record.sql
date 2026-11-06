-- 074: the odds of coins like this one, and yeppo's own record (3 Nov 2026). Both cost the database next to nothing.
-- 1. yr_odds: for every coin of the last days, at 30 s, 1, 2, 4, 8, 12 and 16 minutes: how often it then made ×2 and ×3,
--    grouped by what yeppo knows at that moment: the creator (first coin, clean, some rugs, rugger, a farm whose coins
--    never take off), the price against launch, and whether the creator already sold everything. ~250 rows, rebuilt
--    once a night. Tested before shipping (3 Nov 2026): built on the first 2.5 days and checked on the 1.5 days after,
--    each fifth of coins came out as predicted (1.5% predicted / 1.6% real, 3.5/3.5, 5.6/6.0, 8.8/9.2, 15.4/15.5).
--    The read keeps the table in memory: no database work per coin read.
-- 2. yr_calls: the call yeppo showed on a coin, once per coin and word, with the price, age and odds at that moment
--    (a few thousand short rows a day, 3 days kept). yr_record: each night, what those coins did next, per day and word,
--    and how the odds held up. The /record page reads it.

create table if not exists yr_odds (
  i smallint not null, cre text not null, xb smallint not null, dout boolean not null,
  n int not null, p2 real not null, p3 real not null,
  primary key (i, cre, xb, dout)
);
alter table yr_odds enable row level security;

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
    greatest((select max(v) from unnest(p[s.i + 1:40]) v), case when ath_s > s.i * 30 then ath end) / p[s.i] fut
  from c cross join (values (1), (2), (4), (8), (16), (24), (32)) s(i)
  where p[s.i] > 0;

  delete from yr_odds;
  insert into yr_odds (i, cre, xb, dout, n, p2, p3)
  select i, cre, xb, dout, count(*), avg((fut >= 2)::int), avg((fut >= 3)::int) from _o group by 1, 2, 3, 4 having count(*) >= 60
  union all
  select i, '*', xb, dout, count(*), avg((fut >= 2)::int), avg((fut >= 3)::int) from _o group by 1, 3, 4 having count(*) >= 60;
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function yr_odds_calc() from public, anon, authenticated;

create or replace function yr_odds_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return coalesce((select jsonb_agg(jsonb_build_array(i, cre, xb, dout, n, round(p2::numeric, 4), round(p3::numeric, 4))) from yr_odds), '[]'::jsonb);
end $$;
revoke all on function yr_odds_s() from public;
grant execute on function yr_odds_s() to anon, authenticated;

-- 2 ---------------------------------------------------------------------------------------------------------------
create table if not exists yr_calls (
  mint text not null, word text not null, t bigint not null, age int not null, x real not null, p2 real,
  primary key (mint, word)
);
alter table yr_calls enable row level security;
create index if not exists yr_calls_t on yr_calls (t);

create or replace function yr_call_log(p_mint text, p_word text, p_age int, p_x real, p_p2 real) returns void
language plpgsql security definer set search_path = public set synchronous_commit = off as $$
begin
  perform yr_guard();
  if p_word not in ('Momentum', 'Opportunity', 'Wait', 'Don''t buy') or p_age < 0 or p_age > 1170 or p_x is null or p_x <= 0 then return; end if;
  insert into yr_calls (mint, word, t, age, x, p2) values (left(p_mint, 44), p_word, yr_now(), p_age, p_x, p_p2)
  on conflict do nothing;
end $$;
revoke all on function yr_call_log(text, text, int, real, real) from public;
grant execute on function yr_call_log(text, text, int, real, real) to anon, authenticated;

create table if not exists yr_record (
  day date not null, word text not null, n int not null, x2 int not null, x3 int not null, down int not null,
  primary key (day, word)
);
alter table yr_record enable row level security;

-- what each call's coin did after it (30 s steps of its first 20 minutes, and its high when that came later), for calls
-- whose coin is 30+ minutes old. "Odds n-m%" rows check the odds the same way.
create or replace function yr_record_calc() returns int
language plpgsql security definer set search_path = public set statement_timeout = '60s' set synchronous_commit = off as $$
declare k int;
begin
  create temp table _r on commit drop as
  select (to_timestamp(k.t / 1000) at time zone 'utc')::date d, k.word, k.p2,
    greatest((select max(v) from unnest(c.p[(k.age / 30) + 2:40]) v), case when c.ath_s > k.age then c.ath end) / c.p[(k.age / 30) + 1] up,
    (select min(v) from unnest(c.p[(k.age / 30) + 2:40]) v) / c.p[(k.age / 30) + 1] dn
  from yr_calls k join yr_cc c on c.mint = k.mint
  where c.p is not null and c.p[(k.age / 30) + 1] > 0 and k.t < yr_now() - 1800000;

  insert into yr_record (day, word, n, x2, x3, down)
  select d, word, count(*), count(*) filter (where up >= 2), count(*) filter (where up >= 3), count(*) filter (where dn <= 0.5)
  from _r group by 1, 2
  union all
  select d, case when p2 < 0.05 then 'Odds 0-5%' when p2 < 0.1 then 'Odds 5-10%' when p2 < 0.2 then 'Odds 10-20%' else 'Odds 20%+' end,
    count(*), count(*) filter (where up >= 2), count(*) filter (where up >= 3), count(*) filter (where dn <= 0.5)
  from _r where p2 is not null group by 1, 2
  on conflict (day, word) do update set n = excluded.n, x2 = excluded.x2, x3 = excluded.x3, down = excluded.down;
  get diagnostics k = row_count;
  delete from yr_calls where t < yr_now() - 3 * 86400000::bigint;
  delete from yr_record where day < current_date - 60;
  return k;
end $$;
revoke all on function yr_record_calc() from public, anon, authenticated;

create or replace function yr_record_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return coalesce((select jsonb_agg(jsonb_build_array(day, word, n, x2, x3, down) order by day desc, word) from yr_record where day > current_date - 30), '[]'::jsonb);
end $$;
revoke all on function yr_record_s() from public;
grant execute on function yr_record_s() to anon, authenticated;

select cron.schedule('yr-odds', '20 4 * * *', 'select yr_odds_calc(); select yr_record_calc();');
select cron.schedule('yr-record', '50 * * * *', 'select yr_record_calc();');
