-- MAISON v3 — learn fashion: lessons, XP, streaks, weekly leagues, quiz duels.
-- The trend market tables stay (the live lessons read maison_trends).

alter table public.maison_houses add column if not exists xp int not null default 0;
alter table public.maison_houses add column if not exists lesson_streak int not null default 0;
alter table public.maison_houses add column if not exists best_streak int not null default 0;
alter table public.maison_houses add column if not exists last_lesson_day date;
alter table public.maison_houses add column if not exists duels_won int not null default 0;

create table public.maison_lessons_done (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  lesson_id text not null,
  best int not null default 0,
  runs int not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.maison_xp_days (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  day date not null,
  xp int not null default 0,
  primary key (user_id, day)
);
create index maison_xp_days_day_idx on public.maison_xp_days (day);

create table public.maison_quiz_duels (
  id uuid primary key default gen_random_uuid(),
  questions text[] not null,
  a uuid not null references public.maison_houses (user_id) on delete cascade,
  b uuid references public.maison_houses (user_id) on delete cascade,
  invite boolean not null default false,
  a_score int,
  a_ms int,
  b_score int,
  b_ms int,
  winner uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index maison_quiz_duels_open_idx on public.maison_quiz_duels (created_at) where b is null and not invite;

alter table public.maison_lessons_done enable row level security;
alter table public.maison_xp_days enable row level security;
alter table public.maison_quiz_duels enable row level security;
create policy "own lessons" on public.maison_lessons_done for select to authenticated using (user_id = (select auth.uid()));
create policy "xp days are public" on public.maison_xp_days for select using (true);
create policy "own duels" on public.maison_quiz_duels for select to authenticated
  using (a = (select auth.uid()) or b = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- XP
-- ---------------------------------------------------------------------------
create or replace function public.maison_add_xp(uid uuid, n int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if n <= 0 then return; end if;
  update public.maison_houses set xp = xp + n where user_id = uid;
  insert into public.maison_xp_days (user_id, day, xp) values (uid, public.maison_today(), n)
  on conflict (user_id, day) do update set xp = public.maison_xp_days.xp + excluded.xp;
end $$;
revoke execute on function public.maison_add_xp(uuid, int) from public, anon, authenticated;

-- Monday of the current UTC week.
create or replace function public.maison_week_start()
returns date language sql stable set search_path = '' as $$
  select (date_trunc('week', now() at time zone 'utc'))::date
$$;

-- A finished lesson: XP, streak, progress.
create or replace function public.maison_finish_lesson(p_lesson text, p_correct int, p_total int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.maison_houses;
  today date := public.maison_today();
  gained int;
  new_streak int;
  runs_today int;
begin
  select * into h from public.maison_houses where user_id = uid for update;
  if h.user_id is null then raise exception 'no_house'; end if;
  if p_total is null or p_total < 1 or p_total > 30 or p_correct < 0 or p_correct > p_total then raise exception 'bad_result'; end if;
  if p_lesson !~ '^[a-z]+-[0-9]+$' then raise exception 'bad_lesson'; end if;

  -- Replays of the same lesson on the same day earn less.
  select count(*) into runs_today from public.maison_lessons_done
    where user_id = uid and lesson_id = p_lesson and last_at::date = today;
  gained := case when runs_today > 0 then 5 else 10 end + case when p_correct = p_total then 5 else 0 end;

  new_streak := case
    when h.last_lesson_day = today then h.lesson_streak
    when h.last_lesson_day = today - 1 then h.lesson_streak + 1
    else 1 end;
  update public.maison_houses set lesson_streak = new_streak, best_streak = greatest(best_streak, new_streak), last_lesson_day = today
  where user_id = uid;

  insert into public.maison_lessons_done (user_id, lesson_id, best) values (uid, p_lesson, p_correct)
  on conflict (user_id, lesson_id) do update set
    best = greatest(public.maison_lessons_done.best, excluded.best),
    runs = public.maison_lessons_done.runs + 1,
    last_at = now();

  perform public.maison_add_xp(uid, gained);
  return jsonb_build_object('xp', gained, 'streak', new_streak, 'extended', h.last_lesson_day is distinct from today);
end $$;

-- Everything the app needs, in one call.
create or replace function public.maison_learn_state()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.maison_houses;
  wk date := public.maison_week_start();
  today date := public.maison_today();
begin
  if uid is null then return jsonb_build_object('house', null); end if;
  select * into h from public.maison_houses where user_id = uid;
  if h.user_id is null then return jsonb_build_object('house', null); end if;
  -- A streak is lost after a full day without lessons.
  if h.last_lesson_day is not null and h.last_lesson_day < today - 1 and h.lesson_streak > 0 then
    update public.maison_houses set lesson_streak = 0 where user_id = uid returning * into h;
  end if;
  return jsonb_build_object(
    'house', jsonb_build_object('user_id', h.user_id, 'name', h.name, 'monogram', h.monogram, 'palette', h.palette,
                                'manifesto', h.manifesto, 'xp', h.xp, 'streak', h.lesson_streak, 'best_streak', h.best_streak,
                                'last_lesson_day', h.last_lesson_day, 'duels_won', h.duels_won),
    'today', today,
    'week_start', wk,
    'today_xp', coalesce((select xp from public.maison_xp_days where user_id = uid and day = today), 0),
    'week_xp', coalesce((select sum(xp) from public.maison_xp_days where user_id = uid and day >= wk), 0),
    'progress', coalesce((select jsonb_object_agg(lesson_id, jsonb_build_object('best', best, 'runs', runs))
                          from public.maison_lessons_done where user_id = uid), '{}'),
    'board', coalesce((
      select jsonb_agg(r order by r.xp desc) from (
        select x.user_id, hh.name, hh.monogram, hh.palette, sum(x.xp)::int as xp
        from public.maison_xp_days x join public.maison_houses hh on hh.user_id = x.user_id
        where x.day >= wk group by x.user_id, hh.name, hh.monogram, hh.palette
        order by xp desc limit 50) r), '[]'),
    'duels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'questions', d.questions, 'me_a', d.a = uid,
        'my_score', case when d.a = uid then d.a_score else d.b_score end,
        'my_ms', case when d.a = uid then d.a_ms else d.b_ms end,
        'their_score', case when d.a = uid then d.b_score else d.a_score end,
        'opponent', (select jsonb_build_object('name', o.name, 'monogram', o.monogram, 'palette', o.palette)
                     from public.maison_houses o where o.user_id = case when d.a = uid then d.b else d.a end),
        'invite', d.invite, 'winner', d.winner, 'created_at', d.created_at, 'finished_at', d.finished_at)
        order by d.created_at desc)
      from (select * from public.maison_quiz_duels where a = uid or b = uid order by created_at desc limit 30) d), '[]')
  );
end $$;

-- All-time leaderboard.
create or replace function public.maison_learn_board(lim int default 50)
returns table (user_id uuid, name text, monogram text, palette text[], xp int, streak int, duels_won int)
language sql stable security definer set search_path = '' as $$
  select user_id, name, monogram, palette, xp, lesson_streak, duels_won from public.maison_houses
  order by xp desc limit lim
$$;

-- ---------------------------------------------------------------------------
-- Quiz duels
-- ---------------------------------------------------------------------------
create or replace function public.maison_duel_json(d public.maison_quiz_duels, uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'questions', d.questions, 'me_a', d.a = uid,
    'my_score', case when d.a = uid then d.a_score else d.b_score end,
    'my_ms', case when d.a = uid then d.a_ms else d.b_ms end,
    'their_score', case when d.a = uid then d.b_score else d.a_score end,
    'opponent', (select jsonb_build_object('name', o.name, 'monogram', o.monogram, 'palette', o.palette)
                 from public.maison_houses o where o.user_id = case when d.a = uid then d.b else d.a end),
    'invite', d.invite, 'winner', d.winner, 'created_at', d.created_at, 'finished_at', d.finished_at)
$$;
revoke execute on function public.maison_duel_json(public.maison_quiz_duels, uuid) from public, anon, authenticated;

-- Join the oldest open duel from someone else, or open a new one.
create or replace function public.maison_duel_quick(p_questions text[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  d public.maison_quiz_duels;
begin
  if not exists (select 1 from public.maison_houses where user_id = uid) then raise exception 'no_house'; end if;
  if array_length(p_questions, 1) is null or array_length(p_questions, 1) > 15 then raise exception 'bad_questions'; end if;
  select * into d from public.maison_quiz_duels
    where b is null and not invite and a <> uid and a_score is not null
    order by created_at limit 1 for update skip locked;
  if d.id is not null then
    update public.maison_quiz_duels set b = uid where id = d.id returning * into d;
  else
    insert into public.maison_quiz_duels (questions, a) values (p_questions, uid) returning * into d;
  end if;
  return public.maison_duel_json(d, uid);
end $$;

create or replace function public.maison_duel_invite(p_questions text[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  d public.maison_quiz_duels;
begin
  if not exists (select 1 from public.maison_houses where user_id = uid) then raise exception 'no_house'; end if;
  if array_length(p_questions, 1) is null or array_length(p_questions, 1) > 15 then raise exception 'bad_questions'; end if;
  insert into public.maison_quiz_duels (questions, a, invite) values (p_questions, uid, true) returning * into d;
  return public.maison_duel_json(d, uid);
end $$;

create or replace function public.maison_duel_join(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  d public.maison_quiz_duels;
begin
  if not exists (select 1 from public.maison_houses where user_id = uid) then raise exception 'no_house'; end if;
  select * into d from public.maison_quiz_duels where id = p_id for update;
  if d.id is null then raise exception 'duel_not_found'; end if;
  if d.a = uid or d.b = uid then return public.maison_duel_json(d, uid); end if;
  if d.b is not null then raise exception 'duel_taken'; end if;
  update public.maison_quiz_duels set b = uid where id = d.id returning * into d;
  return public.maison_duel_json(d, uid);
end $$;

create or replace function public.maison_duel_submit(p_id uuid, p_score int, p_ms int)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  d public.maison_quiz_duels;
  w uuid;
begin
  select * into d from public.maison_quiz_duels where id = p_id for update;
  if d.id is null or (d.a <> uid and d.b is distinct from uid) then raise exception 'duel_not_found'; end if;
  if p_score < 0 or p_score > array_length(d.questions, 1) or p_ms < 0 then raise exception 'bad_result'; end if;
  if d.a = uid then
    if d.a_score is not null then raise exception 'already_played'; end if;
    update public.maison_quiz_duels set a_score = p_score, a_ms = p_ms where id = d.id returning * into d;
  else
    if d.b_score is not null then raise exception 'already_played'; end if;
    update public.maison_quiz_duels set b_score = p_score, b_ms = p_ms where id = d.id returning * into d;
  end if;
  if d.a_score is not null and d.b_score is not null and d.winner is null then
    w := case when d.a_score > d.b_score then d.a when d.b_score > d.a_score then d.b
              when d.a_ms <= d.b_ms then d.a else d.b end;
    update public.maison_quiz_duels set winner = w, finished_at = now() where id = d.id returning * into d;
    update public.maison_houses set duels_won = duels_won + 1 where user_id = w;
    perform public.maison_add_xp(w, 20);
    perform public.maison_add_xp(case when w = d.a then d.b else d.a end, 5);
  end if;
  return public.maison_duel_json(d, uid);
end $$;

revoke execute on function public.maison_finish_lesson(text, int, int) from public, anon;
revoke execute on function public.maison_learn_state() from public, anon;
revoke execute on function public.maison_learn_board(int) from public, anon;
revoke execute on function public.maison_duel_quick(text[]) from public, anon;
revoke execute on function public.maison_duel_invite(text[]) from public, anon;
revoke execute on function public.maison_duel_join(uuid) from public, anon;
revoke execute on function public.maison_duel_submit(uuid, int, int) from public, anon;
grant execute on function public.maison_finish_lesson(text, int, int) to authenticated;
grant execute on function public.maison_learn_state() to authenticated;
grant execute on function public.maison_learn_board(int) to authenticated;
grant execute on function public.maison_duel_quick(text[]) to authenticated;
grant execute on function public.maison_duel_invite(text[]) to authenticated;
grant execute on function public.maison_duel_join(uuid) to authenticated;
grant execute on function public.maison_duel_submit(uuid, int, int) to authenticated;
