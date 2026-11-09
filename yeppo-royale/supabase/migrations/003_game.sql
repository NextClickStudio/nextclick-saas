-- yeppo royale: the game.
-- Players start each match with START_SOL of play money and trade replays of real
-- pump.fun launches. Every cut, the worst traders are knocked out; the last ones
-- standing win XP and rank points. All writes go through security-definer RPCs.

-- ---------- players ----------
create table if not exists yr_users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  avatar jsonb not null default '{}',
  xp int not null default 0,
  rp int not null default 0,
  matches int not null default 0,
  wins int not null default 0,
  top5 int not null default 0,
  cuts_survived int not null default 0,
  best_pnl real not null default 0,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table yr_users enable row level security;
create policy yr_users_read on yr_users for select using (true);

create table if not exists yr_keys (
  user_id uuid primary key references yr_users(id) on delete cascade,
  secret text unique not null
);
alter table yr_keys enable row level security;

-- ---------- modes ----------
create table if not exists yr_modes (
  id text primary key,
  name text not null,
  tagline text not null,
  size int not null,
  speed real not null,           -- template (coin) ms per match ms
  dur_ms int not null,
  cuts jsonb not null,           -- [{at: match ms, keep: players left}]
  every_s int not null,          -- a new match starts every N seconds
  sort int not null default 0,
  active boolean not null default true
);
alter table yr_modes enable row level security;
create policy yr_modes_read on yr_modes for select using (true);

insert into yr_modes (id, name, tagline, size, speed, dur_ms, cuts, every_s, sort) values
  ('royale', 'Battle Royale', '100 traders. 5 cuts. One survivor.', 100, 3, 480000,
   '[{"at":90000,"keep":70},{"at":180000,"keep":45},{"at":270000,"keep":25},{"at":360000,"keep":12},{"at":420000,"keep":5}]', 120, 1),
  ('turbo', 'Turbo', '50 traders, double speed, 4 minutes.', 50, 5, 240000,
   '[{"at":45000,"keep":35},{"at":90000,"keep":22},{"at":135000,"keep":12},{"at":180000,"keep":5}]', 60, 2)
on conflict (id) do nothing;

-- ---------- arenas (templates built by yr-build) ----------
create table if not exists yr_templates (
  id serial primary key,
  dur int not null,              -- template ms covered
  bots jsonb not null,           -- [{name, avatar}] AI traders
  stats jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table yr_templates enable row level security;

create table if not exists yr_tpl_coins (
  tpl int not null references yr_templates(id) on delete cascade,
  ci smallint not null,
  coin_id int not null references yr_coins(id),
  off int not null,              -- launch time, template ms
  primary key (tpl, ci)
);
alter table yr_tpl_coins enable row level security;

create table if not exists yr_tpl_fills (
  id bigserial primary key,
  tpl int not null references yr_templates(id) on delete cascade,
  bot smallint not null,
  ci smallint not null,
  t int not null,                -- template ms
  k smallint not null,           -- 1 buy, 2 sell
  sol real not null,
  tok real not null
);
create index if not exists yr_tpl_fills_tpl on yr_tpl_fills (tpl, bot, t);
alter table yr_tpl_fills enable row level security;

-- ---------- matches ----------
create table if not exists yr_matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null references yr_modes(id),
  tpl int not null references yr_templates(id),
  start_at timestamptz not null,
  speed real not null,
  size int not null,
  dur_ms int not null,
  cuts jsonb not null,
  resolved_cut int not null default 0,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  unique (mode, start_at)
);
alter table yr_matches enable row level security;

create table if not exists yr_players (
  match_id uuid not null references yr_matches(id) on delete cascade,
  slot int not null,
  user_id uuid references yr_users(id),
  bot smallint,
  name text not null,
  avatar jsonb not null default '{}',
  elim_cut int,
  place int,
  final_eq real,
  rewarded boolean not null default false,
  xp_gain int,
  rp_gain int,
  primary key (match_id, slot),
  unique (match_id, user_id)
);
alter table yr_players enable row level security;

create table if not exists yr_fills (
  id bigserial primary key,
  match_id uuid not null references yr_matches(id) on delete cascade,
  slot int not null,
  ci smallint not null,
  t int not null,                -- match ms
  k smallint not null,
  sol real not null,
  tok real not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists yr_fills_match on yr_fills (match_id, slot, t);
alter table yr_fills enable row level security;

create table if not exists yr_board_cache (
  match_id uuid primary key references yr_matches(id) on delete cascade,
  bucket int not null,
  payload jsonb not null
);
alter table yr_board_cache enable row level security;

-- ---------- helpers ----------
create or replace function yr_uid(p_secret text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid;
begin
  select user_id into u from yr_keys where secret = p_secret;
  if u is null then raise exception 'Session expired. Log in again.'; end if;
  return u;
end $$;

create or replace function yr_now_ms(p_match uuid) returns int
language sql stable security definer set search_path = public as $$
  select (extract(epoch from (clock_timestamp() - start_at)) * 1000)::int from yr_matches where id = p_match
$$;

-- equity of every participant at match time p_ms
create or replace function yr_equity(p_match uuid, p_ms int)
returns table(slot int, eq double precision, ntr int)
language sql stable security definer set search_path = public as $$
  with m as (select * from yr_matches where id = p_match),
  px as (
    select tc.ci,
      (select e.mc from yr_events e
        where e.coin_id = tc.coin_id and e.t <= (p_ms * m.speed)::int - tc.off
        order by e.t desc, e.seq desc limit 1)::double precision / 1e9 as p
    from yr_tpl_coins tc, m where tc.tpl = m.tpl
  ),
  hf as (
    select f.slot, f.ci,
      sum(case when f.k = 1 then f.tok else -f.tok end)::double precision tok,
      sum(case when f.k = 2 then f.sol else -f.sol end)::double precision cash,
      count(*) n
    from yr_fills f where f.match_id = p_match and f.t <= p_ms
    group by f.slot, f.ci
  ),
  bf as (
    select p.slot, b.ci,
      sum(case when b.k = 1 then b.tok else -b.tok end)::double precision tok,
      sum(case when b.k = 2 then b.sol else -b.sol end)::double precision cash,
      count(*) n
    from m
    join yr_players p on p.match_id = m.id and p.bot is not null
    join yr_tpl_fills b on b.tpl = m.tpl and b.bot = p.bot and b.t <= (p_ms * m.speed)::int
    group by p.slot, b.ci
  ),
  pos as (select * from hf union all select * from bf)
  select p.slot,
         10 + coalesce(sum(pos.cash + pos.tok * coalesce(px.p, 0)), 0) as eq,
         coalesce(sum(pos.n), 0)::int as ntr
  from yr_players p
  left join pos on pos.slot = p.slot
  left join px on px.ci = pos.ci
  where p.match_id = p_match
  group by p.slot
$$;

-- AI traders take the free slots when the match starts
create or replace function yr_fill_bots(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m yr_matches; have int; nb int;
begin
  select * into m from yr_matches where id = p_match;
  if clock_timestamp() < m.start_at then return; end if;
  select count(*) into have from yr_players where match_id = p_match;
  if have >= m.size then return; end if;
  select jsonb_array_length(bots) into nb from yr_templates where id = m.tpl;
  insert into yr_players (match_id, slot, bot, name, avatar)
  select p_match, have + g, g, t.bots -> g ->> 'name', coalesce(t.bots -> g -> 'avatar', '{}')
  from generate_series(0, least(m.size - have, nb) - 1) g, yr_templates t
  where t.id = m.tpl
  on conflict do nothing;
end $$;

-- applies every cut whose time has passed, and the final ranking at the end
create or replace function yr_resolve(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m yr_matches; now_ms int; i int; c jsonb;
begin
  select * into m from yr_matches where id = p_match for update;
  if not found or m.finished then return; end if;
  now_ms := (extract(epoch from (clock_timestamp() - m.start_at)) * 1000)::int;
  if now_ms < 0 then return; end if;
  perform yr_fill_bots(p_match);
  i := m.resolved_cut;
  while i < jsonb_array_length(m.cuts) loop
    c := m.cuts -> i;
    exit when (c->>'at')::int > now_ms;
    with alive as (
      select e.slot, e.eq, e.ntr from yr_equity(p_match, (c->>'at')::int) e
      join yr_players p on p.match_id = p_match and p.slot = e.slot
      where p.elim_cut is null
    ), ranked as (
      -- traders who never traded go first: no camping
      select slot, eq, row_number() over (order by (ntr > 0) desc, eq desc, slot) rk from alive
    )
    update yr_players p set elim_cut = i + 1, place = r.rk, final_eq = r.eq
    from ranked r
    where p.match_id = p_match and p.slot = r.slot and r.rk > (c->>'keep')::int;
    i := i + 1;
  end loop;
  if i <> m.resolved_cut then
    update yr_matches set resolved_cut = i where id = p_match;
  end if;
  if now_ms >= m.dur_ms then
    with alive as (
      select e.slot, e.eq, e.ntr from yr_equity(p_match, m.dur_ms) e
      join yr_players p on p.match_id = p_match and p.slot = e.slot
      where p.elim_cut is null
    ), ranked as (
      select slot, eq, row_number() over (order by (ntr > 0) desc, eq desc, slot) rk from alive
    )
    update yr_players p set place = r.rk, final_eq = r.eq
    from ranked r where p.match_id = p_match and p.slot = r.slot;
    update yr_matches set finished = true where id = p_match;
  end if;
end $$;

-- ---------- account RPCs ----------
create or replace function yr_signup(p_handle text, p_avatar jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u yr_users; s text;
begin
  p_handle := trim(p_handle);
  if p_handle !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Pick 3-16 letters, numbers or _';
  end if;
  if lower(p_handle) ~ '(nigg|fag|rape|hitler|nazi|kys|retard|admin|yeppo)' then
    raise exception 'Pick another name';
  end if;
  if exists (select 1 from yr_users where lower(handle) = lower(p_handle)) then
    raise exception 'That name is taken';
  end if;
  if p_avatar is null or length(p_avatar::text) > 1200 then p_avatar := '{}'; end if;
  insert into yr_users (handle, avatar) values (p_handle, p_avatar) returning * into u;
  s := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into yr_keys (user_id, secret) values (u.id, s);
  return jsonb_build_object('user', to_jsonb(u), 'secret', s);
end $$;

create or replace function yr_me(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u yr_users;
begin
  update yr_users set last_seen = now() where id = yr_uid(p_secret) returning * into u;
  return to_jsonb(u);
end $$;

create or replace function yr_set_avatar(p_secret text, p_avatar jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare u yr_users;
begin
  if p_avatar is null or length(p_avatar::text) > 1200 then raise exception 'Invalid character'; end if;
  update yr_users set avatar = p_avatar where id = yr_uid(p_secret) returning * into u;
  return to_jsonb(u);
end $$;

-- ---------- lobby & matchmaking ----------
create or replace function yr_lobby(p_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; active_match jsonb; ready int;
begin
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  if uid is not null then
    select jsonb_build_object('id', m.id, 'mode', m.mode, 'start_at', m.start_at) into active_match
    from yr_players p join yr_matches m on m.id = p.match_id
    where p.user_id = uid and not m.finished and p.elim_cut is null
      and clock_timestamp() < m.start_at + make_interval(secs => m.dur_ms / 1000.0)
    order by m.start_at desc limit 1;
  end if;
  select count(*) into ready from yr_templates where active;
  return jsonb_build_object(
    'now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'arenas', ready,
    'online', (select count(*) from yr_users where last_seen > now() - interval '5 minutes'),
    'active', active_match,
    'modes', (
      select jsonb_agg(jsonb_build_object(
        'id', md.id, 'name', md.name, 'tagline', md.tagline, 'size', md.size, 'dur_ms', md.dur_ms,
        'cuts', jsonb_array_length(md.cuts),
        'next_start', (ceil(extract(epoch from clock_timestamp() + interval '10 seconds') / md.every_s) * md.every_s * 1000)::bigint,
        'queued', (select count(*) from yr_players p join yr_matches m on m.id = p.match_id
                   where m.mode = md.id and m.start_at > clock_timestamp() and p.user_id is not null),
        'live', (select count(*) from yr_matches m where m.mode = md.id and not m.finished
                 and m.start_at <= clock_timestamp())
      ) order by md.sort)
      from yr_modes md where md.active)
  );
end $$;

create or replace function yr_join(p_secret text, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; u yr_users; md yr_modes; st timestamptz; m yr_matches; tpl int; n int;
begin
  uid := yr_uid(p_secret);
  select * into u from yr_users where id = uid;
  select * into md from yr_modes where id = p_mode and active;
  if not found then raise exception 'Unknown mode'; end if;

  -- already queued or playing: go back there
  select m2.* into m from yr_players p join yr_matches m2 on m2.id = p.match_id
  where p.user_id = uid and not m2.finished and p.elim_cut is null
    and clock_timestamp() < m2.start_at + make_interval(secs => m2.dur_ms / 1000.0)
  order by m2.start_at desc limit 1;
  if found then
    return jsonb_build_object('id', m.id, 'start_at', m.start_at, 'mode', m.mode);
  end if;

  st := to_timestamp(ceil(extract(epoch from clock_timestamp() + interval '10 seconds') / md.every_s) * md.every_s);
  select * into m from yr_matches where mode = md.id and start_at = st for update;
  if not found then
    select id into tpl from yr_templates where active order by random() limit 1;
    if tpl is null then raise exception 'Arenas are warming up. Try again in a few minutes.'; end if;
    insert into yr_matches (mode, tpl, start_at, speed, size, dur_ms, cuts)
    values (md.id, tpl, st, md.speed, md.size, md.dur_ms, md.cuts)
    on conflict (mode, start_at) do nothing;
    select * into m from yr_matches where mode = md.id and start_at = st for update;
  end if;
  select count(*) into n from yr_players where match_id = m.id;
  if n >= m.size then raise exception 'This drop is full. Wait for the next one.'; end if;
  insert into yr_players (match_id, slot, user_id, name, avatar) values (m.id, n, uid, u.handle, u.avatar);
  update yr_users set last_seen = now() where id = uid;
  return jsonb_build_object('id', m.id, 'start_at', m.start_at, 'mode', m.mode);
end $$;

-- ---------- in-match RPCs ----------
create or replace function yr_match(p_match uuid, p_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m yr_matches; md yr_modes; uid uuid; me int; now_ms int;
begin
  select * into m from yr_matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;
  select * into md from yr_modes where id = m.mode;
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
    select slot into me from yr_players where match_id = p_match and user_id = uid;
  end if;
  perform yr_resolve(p_match);
  now_ms := yr_now_ms(p_match);
  return jsonb_build_object(
    'id', m.id, 'mode', m.mode, 'mode_name', md.name, 'start_at', (extract(epoch from m.start_at) * 1000)::bigint,
    'server_now', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'speed', m.speed, 'size', m.size, 'dur_ms', m.dur_ms, 'cuts', m.cuts, 'start_sol', 10,
    'me', me,
    'coins', (select jsonb_agg(jsonb_build_object(
                'ci', tc.ci, 'at', (tc.off / m.speed)::int, 'sol_usd', c.sol_usd,
                'x', c.twitter is not null, 'tg', c.telegram is not null, 'web', c.website is not null)
              order by tc.ci)
              from yr_tpl_coins tc join yr_coins c on c.id = tc.coin_id where tc.tpl = m.tpl),
    'roster', case when now_ms >= 0 then (
                select jsonb_agg(jsonb_build_array(p.slot, p.name, p.avatar, p.bot is not null) order by p.slot)
                from yr_players p where p.match_id = p_match and p.slot >= 0)
              else (
                select jsonb_agg(jsonb_build_array(p.slot, p.name, p.avatar, false) order by p.slot)
                from yr_players p where p.match_id = p_match and p.slot >= 0 and p.user_id is not null)
              end
  );
end $$;

-- market events up to "now" only: nobody can read a coin's future
create or replace function yr_feed(p_match uuid, p_since int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m yr_matches; now_ms int; res jsonb;
begin
  select * into m from yr_matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;
  now_ms := least(yr_now_ms(p_match), m.dur_ms);
  if now_ms < 0 then
    return jsonb_build_object('now', now_ms, 'ev', '[]'::jsonb, 'more', false);
  end if;
  with ev as (
    select tc.ci, ((tc.off + e.t) / m.speed)::int as ms, e.seq, e.w, e.k, e.sol, e.tok, e.bal, e.mc, e.vsol
    from yr_tpl_coins tc
    join yr_events e on e.coin_id = tc.coin_id
    where tc.tpl = m.tpl
      and e.t <= (now_ms * m.speed)::int - tc.off
      and e.t >= (greatest(p_since, 0) * m.speed)::int - tc.off
    order by ms, e.seq
    limit 3000
  )
  select jsonb_build_object(
    'now', now_ms,
    'ev', coalesce(jsonb_agg(jsonb_build_array(ci, ms, seq, w, k, round(sol::numeric, 4), round(tok::numeric), round(bal::numeric), round(mc::numeric, 3), round(vsol::numeric, 3)) order by ms, seq), '[]'::jsonb),
    'more', count(*) = 3000)
  into res from ev;
  return res;
end $$;

create or replace function yr_trade(p_secret text, p_match uuid, p_ci int, p_side text, p_amount double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; m yr_matches; pl yr_players; now_ms int; tc yr_tpl_coins; ev record;
        cash double precision; held double precision; vs double precision; vt double precision;
        x double precision; tok double precision; sol double precision; ct int; recent int;
begin
  uid := yr_uid(p_secret);
  perform yr_resolve(p_match);
  select * into m from yr_matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;
  now_ms := yr_now_ms(p_match);
  if now_ms < 0 then raise exception 'The match has not started'; end if;
  if now_ms >= m.dur_ms then raise exception 'The match is over'; end if;
  select * into pl from yr_players where match_id = p_match and user_id = uid;
  if not found then raise exception 'You are not in this match'; end if;
  if pl.elim_cut is not null then raise exception 'You were eliminated'; end if;
  select count(*) into recent from yr_fills where match_id = p_match and slot = pl.slot and created_at > clock_timestamp() - interval '1 second';
  if recent >= 4 then raise exception 'Slow down'; end if;
  select * into tc from yr_tpl_coins where tpl = m.tpl and ci = p_ci;
  if not found then raise exception 'Unknown coin'; end if;
  ct := (now_ms * m.speed)::int - tc.off;
  if ct < 0 then raise exception 'Not launched yet'; end if;
  select e.mc, e.vsol into ev from yr_events e
  where e.coin_id = tc.coin_id and e.t <= ct order by e.t desc, e.seq desc limit 1;
  vs := coalesce(ev.vsol, greatest(ev.mc * 0.2, 30));
  vt := vs * 1e9 / ev.mc;
  select 10 + coalesce(sum(case when f.k = 2 then f.sol else -f.sol end), 0),
         coalesce(sum(case when f.ci = p_ci then (case when f.k = 1 then f.tok else -f.tok end) else 0 end), 0)
    into cash, held
  from yr_fills f where f.match_id = p_match and f.slot = pl.slot;
  if p_side = 'buy' then
    if p_amount is null or p_amount < 0.01 then raise exception 'Minimum buy is 0.01 SOL'; end if;
    if p_amount > cash + 1e-9 then raise exception 'Not enough SOL'; end if;
    x := p_amount * 0.99;
    tok := vt * x / (vs + x);
    sol := p_amount;
    insert into yr_fills (match_id, slot, ci, t, k, sol, tok) values (p_match, pl.slot, p_ci, now_ms, 1, sol, tok);
    cash := cash - sol; held := held + tok;
  elsif p_side = 'sell' then
    tok := least(coalesce(p_amount, 0), held);
    if tok <= 0 then raise exception 'Nothing to sell'; end if;
    if held - tok < held * 0.0001 then tok := held; end if;
    sol := vs * tok / (vt + tok) * 0.99;
    insert into yr_fills (match_id, slot, ci, t, k, sol, tok) values (p_match, pl.slot, p_ci, now_ms, 2, sol, tok);
    cash := cash + sol; held := held - tok;
  else
    raise exception 'Unknown side';
  end if;
  return jsonb_build_object('t', now_ms, 'ci', p_ci, 'side', p_side, 'sol', sol, 'tok', tok, 'cash', cash, 'held', held, 'mc', ev.mc);
end $$;

-- live standings, shared by everyone in the match (cached for 1.5s)
create or replace function yr_board(p_match uuid, p_secret text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m yr_matches; now_ms int; b int; payload jsonb; uid uuid; me int; mine jsonb;
begin
  perform yr_resolve(p_match);
  select * into m from yr_matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;
  now_ms := least(yr_now_ms(p_match), m.dur_ms);
  b := now_ms / 1500;
  select c.payload into payload from yr_board_cache c where c.match_id = p_match and c.bucket = b;
  if payload is null then
    with eq as (select * from yr_equity(p_match, greatest(now_ms, 0))),
    standings as (
      select p.slot, round(e.eq::numeric, 4) eq, e.ntr, p.elim_cut, p.place
      from yr_players p join eq e on e.slot = p.slot where p.match_id = p_match
    ),
    feed as (
      (select f.slot, f.ci, f.k, f.sol, f.t from yr_fills f
        where f.match_id = p_match and f.t <= now_ms order by f.t desc limit 14)
      union all
      (select p.slot, b2.ci, b2.k, b2.sol, (b2.t / m.speed)::int t
        from yr_players p join yr_tpl_fills b2 on b2.tpl = m.tpl and b2.bot = p.bot
        where p.match_id = p_match and p.bot is not null and b2.t <= (now_ms * m.speed)::int
        order by b2.t desc limit 14)
    )
    select jsonb_build_object(
      'now', now_ms,
      'resolved', m.resolved_cut,
      'finished', m.finished,
      'alive', (select count(*) from standings where elim_cut is null),
      'rows', (select jsonb_agg(jsonb_build_array(slot, eq, ntr, elim_cut, place)
                 order by elim_cut is not null, coalesce(place, 0), eq desc) from standings),
      'feed', (select jsonb_agg(jsonb_build_array(slot, ci, k, round(sol::numeric, 3), t) order by t desc)
                 from (select * from feed order by t desc limit 14) f2)
    ) into payload;
    insert into yr_board_cache (match_id, bucket, payload) values (p_match, b, payload)
    on conflict (match_id) do update set bucket = excluded.bucket, payload = excluded.payload;
  end if;
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
    select slot into me from yr_players where match_id = p_match and user_id = uid;
    if me is not null then
      select jsonb_build_object(
        'slot', me,
        'cash', 10 + coalesce(sum(case when f.k = 2 then f.sol else -f.sol end), 0),
        'pos', coalesce((select jsonb_object_agg(x.ci, x.tok) from (
            select f2.ci, sum(case when f2.k = 1 then f2.tok else -f2.tok end) tok
            from yr_fills f2 where f2.match_id = p_match and f2.slot = me group by f2.ci) x where x.tok > 0), '{}'::jsonb),
        'fills', coalesce((select jsonb_agg(jsonb_build_array(f3.ci, f3.k, f3.sol, f3.tok, f3.t) order by f3.t)
            from yr_fills f3 where f3.match_id = p_match and f3.slot = me), '[]'::jsonb))
      into mine
      from yr_fills f where f.match_id = p_match and f.slot = me;
      payload := payload || jsonb_build_object('me', mine);
    end if;
  end if;
  return payload;
end $$;

-- results, rewards (once) and the reveal of the real coins
create or replace function yr_results(p_secret text, p_match uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid; m yr_matches; pl yr_players; survived int; ncuts int; pct double precision;
        v_xp int; v_rp int; ntr int; pnl double precision;
begin
  uid := yr_uid(p_secret);
  perform yr_resolve(p_match);
  select * into m from yr_matches where id = p_match;
  if not found then raise exception 'Match not found'; end if;
  select * into pl from yr_players where match_id = p_match and user_id = uid;
  if not found then raise exception 'You are not in this match'; end if;
  if pl.elim_cut is null and not m.finished then
    return jsonb_build_object('pending', true);
  end if;
  ncuts := jsonb_array_length(m.cuts);
  survived := coalesce(pl.elim_cut - 1, ncuts);
  select count(*) into ntr from yr_fills where match_id = p_match and slot = pl.slot;
  pnl := coalesce(pl.final_eq, 10) - 10;
  if not pl.rewarded then
    pct := pl.place::double precision / m.size;
    v_xp := 100 + 60 * survived + least(100, 5 * ntr)
          + case when pl.place = 1 then 500 when pl.place <= 5 then 200 else 0 end
          + greatest(0, least(300, (pnl * 20)::int));
    v_rp := case when pl.place = 1 then 100 when pct <= 0.05 then 60 when pct <= 0.12 then 35
               when pct <= 0.25 then 18 when pct <= 0.45 then 6 when pct <= 0.7 then -4 else -8 end;
    update yr_players set rewarded = true, xp_gain = v_xp, rp_gain = v_rp where match_id = p_match and slot = pl.slot;
    update yr_users set
      xp = xp + v_xp,
      rp = greatest(0, rp + v_rp),
      matches = matches + 1,
      wins = wins + (case when pl.place = 1 then 1 else 0 end),
      top5 = top5 + (case when pl.place <= 5 then 1 else 0 end),
      cuts_survived = cuts_survived + survived,
      best_pnl = greatest(best_pnl, pnl)
    where id = uid;
    select * into pl from yr_players where match_id = p_match and slot = pl.slot;
  end if;
  return jsonb_build_object(
    'place', pl.place, 'size', m.size, 'final_eq', pl.final_eq, 'survived', survived, 'cuts', ncuts,
    'xp_gain', pl.xp_gain, 'rp_gain', pl.rp_gain, 'trades', ntr, 'finished', m.finished,
    'user', (select to_jsonb(u) from yr_users u where u.id = uid),
    'coins', (select jsonb_agg(jsonb_build_object(
                'ci', tc.ci,
                'name', case when c.status = 'ok' then c.name else null end,
                'symbol', case when c.status = 'ok' then c.symbol else null end,
                'mint', case when m.finished then c.mint else null end,
                'outcome', c.outcome, 'stats', c.stats) order by tc.ci)
              from yr_tpl_coins tc join yr_coins c on c.id = tc.coin_id where tc.tpl = m.tpl),
    'top', case when m.finished then (
              select jsonb_agg(jsonb_build_array(p.place, p.name, p.avatar, p.bot is not null, round(p.final_eq::numeric, 3)) order by p.place)
              from yr_players p where p.match_id = p_match and p.place <= 5 and p.slot >= 0)
            else null end
  );
end $$;

-- ---------- grants ----------
revoke all on function yr_uid(text) from public, anon, authenticated;
revoke all on function yr_now_ms(uuid) from public, anon, authenticated;
revoke all on function yr_equity(uuid, int) from public, anon, authenticated;
revoke all on function yr_fill_bots(uuid) from public, anon, authenticated;
revoke all on function yr_resolve(uuid) from public, anon, authenticated;
grant execute on function yr_signup(text, jsonb) to anon;
grant execute on function yr_me(text) to anon;
grant execute on function yr_set_avatar(text, jsonb) to anon;
grant execute on function yr_lobby(text) to anon;
grant execute on function yr_join(text, text) to anon;
grant execute on function yr_match(uuid, text) to anon;
grant execute on function yr_feed(uuid, int) to anon;
grant execute on function yr_trade(text, uuid, int, text, double precision) to anon;
grant execute on function yr_board(uuid, text) to anon;
grant execute on function yr_results(text, uuid) to anon;
