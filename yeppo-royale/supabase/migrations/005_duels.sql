-- yeppo 1v1: practice duels.
-- Best of 3 rounds. Every round is one real pump.fun launch replayed at 4x, joined a little before
-- its decisive move. The opponent is another player, or a ghost: the replayed trades of a real
-- wallet that traded that same coin, scaled to the same 10 SOL bag.
-- Everything is private behind RLS; players only use the RPCs below.

-- ---------- profile columns ----------
alter table yr_users add column if not exists elo int not null default 1000;
alter table yr_users add column if not exists d_played int not null default 0;
alter table yr_users add column if not exists d_won int not null default 0;
alter table yr_users add column if not exists d_lost int not null default 0;
alter table yr_users add column if not exists streak int not null default 0;
alter table yr_users add column if not exists best_streak int not null default 0;
alter table yr_users add column if not exists r_played int not null default 0;
alter table yr_users add column if not exists r_won int not null default 0;
alter table yr_users add column if not exists best_roi real;
alter table yr_users add column if not exists wallet text;            -- verified Solana address, shown on the profile
create unique index if not exists yr_users_wallet on yr_users (wallet) where wallet is not null;
create index if not exists yr_users_elo on yr_users (elo desc) where d_played > 0;

-- ---------- tables ----------
create table if not exists yr_duels (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queue',      -- queue | live | done | cancelled
  p1 uuid not null references yr_users(id) on delete cascade,
  p2 uuid references yr_users(id) on delete cascade,   -- null when the opponent is a ghost
  ghost jsonb,                                 -- {name, avatar, elo} of the ghost
  created_at timestamptz not null default clock_timestamp(),
  start_at timestamptz,                        -- round 1 starts here, after the VS screen
  ended_at timestamptz,
  round_ms int not null default 75000,
  gap_ms int not null default 8000,
  speed real not null default 4,
  rounds int not null default 3,
  score1 int,
  score2 int,
  winner smallint,                             -- 1 or 2, 0 for a draw
  elo1 int,
  elo2 int
);
create index if not exists yr_duels_status on yr_duels (status, created_at);
create index if not exists yr_duels_p1 on yr_duels (p1, created_at desc);
create index if not exists yr_duels_p2 on yr_duels (p2, created_at desc);
alter table yr_duels enable row level security;

create table if not exists yr_duel_rounds (
  duel uuid not null references yr_duels(id) on delete cascade,
  r smallint not null,
  coin_id int not null references yr_coins(id),
  off int not null,              -- coin age (ms) when the round starts; earlier history is shown at once
  ghost_w int,                   -- wallet index (within the coin) of the real trader the ghost replays
  ghost_scale real,
  eq1 real,
  eq2 real,
  n1 int,
  n2 int,
  win smallint,                  -- set when the round is resolved
  primary key (duel, r)
);
alter table yr_duel_rounds enable row level security;

create table if not exists yr_duel_fills (
  duel uuid not null references yr_duels(id) on delete cascade,
  slot smallint not null,
  r smallint not null,
  t int not null,                -- ms since the round started
  k smallint not null,           -- 1 buy, 2 sell
  sol real not null,
  tok real not null,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists yr_duel_fills_d on yr_duel_fills (duel, r, slot);
alter table yr_duel_fills enable row level security;

create table if not exists yr_duel_emotes (
  duel uuid not null references yr_duels(id) on delete cascade,
  slot smallint not null,
  e smallint not null,
  at timestamptz not null default clock_timestamp()
);
create index if not exists yr_duel_emotes_d on yr_duel_emotes (duel, at);
alter table yr_duel_emotes enable row level security;

-- ---------- helpers ----------
create or replace function yr_ms(p_at timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from p_at) * 1000)::bigint $$;

create or replace function yr_now() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- last market state of a coin at a given coin age
create or replace function yr_px(p_coin int, p_t int)
returns table(mc double precision, vsol double precision)
language sql stable security definer set search_path = public as $$
  select e.mc, e.vsol from yr_events e
  where e.coin_id = p_coin and e.t <= p_t
  order by e.t desc, e.seq desc limit 1
$$;

-- a ghost's bag: the real wallet's trades inside the round, scaled to the duel bag.
-- The client runs the same loop on the feed, so both sides always agree.
create or replace function yr_ghost_eq(p_coin int, p_w int, p_from int, p_to int, p_scale double precision)
returns table(eq double precision, n int)
language plpgsql stable security definer set search_path = public as $$
declare e record; held double precision := 0; cash double precision := 0; q double precision; cnt int := 0; p double precision;
begin
  for e in select x.k, x.sol, x.tok from yr_events x
           where x.coin_id = p_coin and x.w = p_w and x.t > p_from and x.t <= p_to order by x.t, x.seq loop
    if e.k = 1 then
      cash := cash - e.sol * p_scale; held := held + e.tok * p_scale; cnt := cnt + 1;
    elsif e.k = 2 and e.tok > 0 then
      q := least(e.tok * p_scale, held);
      cash := cash + e.sol * p_scale * q / (e.tok * p_scale); held := held - q; cnt := cnt + 1;
    end if;
  end loop;
  select x.mc / 1e9 into p from yr_px(p_coin, p_to) x;
  eq := 10 + cash + held * coalesce(p, 0);
  n := cnt;
  return next;
end $$;

-- pick one coin for a round: a launch of the wanted kind, joined a little before its key moment.
-- For ghost duels also picks the real wallet to replay, harder for higher ratings.
create or replace function yr_pick_coin(p_kinds text[], p_exclude int[], p_seen int[], p_window int, p_ghost boolean, p_elo int)
returns table(coin_id int, off int, ghost_w int, ghost_scale double precision)
language plpgsql volatile security definer set search_path = public as $$
declare c record; v_key int; v_off int; nwin int; pct double precision; gw int; gs double precision;
begin
  for c in
    select co.id, co.outcome, co.last_t from yr_coins co
    where co.status = 'ok' and co.n_events >= 30 and co.outcome = any(p_kinds) and co.id <> all(p_exclude)
    order by (co.id = any(p_seen)), random()
    limit 30
  loop
    if c.outcome = 'rug' then
      v_key := coalesce((select min(e.t) from yr_events e where e.coin_id = c.id and e.w = 0 and e.k = 2), 0);
    else
      v_key := coalesce((select e.t from yr_events e where e.coin_id = c.id order by e.mc desc, e.t limit 1), 0);
    end if;
    v_off := greatest(0, least(v_key - (p_window * 0.55)::int, c.last_t - (p_window * 0.85)::int));
    select count(*) into nwin from yr_events e where e.coin_id = c.id and e.t > v_off and e.t <= v_off + p_window;
    continue when nwin < 15;
    gw := null;
    gs := null;
    if p_ghost then
      pct := least(0.9, greatest(0.12, 0.42 + (p_elo - 1000) / 1200.0 + (random() - 0.5) * 0.3));
      with g as (
        select e.w,
          sum(e.sol) filter (where e.k = 1) bs,
          sum(e.tok) filter (where e.k = 1) bt,
          coalesce(sum(e.sol) filter (where e.k = 2), 0) ss,
          coalesce(sum(e.tok) filter (where e.k = 2), 0) st
        from yr_events e
        where e.coin_id = c.id and e.t > v_off and e.t <= v_off + p_window and e.w <> 0
        group by e.w
        having sum(e.sol) filter (where e.k = 1) between 0.15 and 40
      ), px as (
        select x.mc / 1e9 p from yr_px(c.id, v_off + p_window) x
      ), scored as (
        select g.w, g.bs,
          ((case when g.st > 0 then g.ss * least(g.st, g.bt) / g.st else 0 end) + (g.bt - least(g.st, g.bt)) * px.p - g.bs) / g.bs roi
        from g, px
      ), ranked as (
        select s.w, s.bs, (row_number() over (order by s.roi, s.w) - 1) rn, count(*) over () cnt from scored s
      )
      select rk.w, 8.0 / rk.bs into gw, gs from ranked rk where rk.rn = round(pct * (rk.cnt - 1));
      continue when gw is null;
    end if;
    coin_id := c.id;
    off := v_off;
    ghost_w := gw;
    ghost_scale := gs;
    return next;
    return;
  end loop;
end $$;

-- one rocket, one trap and one wildcard, in random order; coins the players saw lately come last
create or replace function yr_pick_rounds(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_duels; v_window int; ord int[]; kinds text[]; chosen int[] := '{}'; seen int[]; v_elo int; pk record; i int;
begin
  select * into d from yr_duels where id = p_duel;
  v_window := (d.round_ms * d.speed)::int;
  seen := array(
    select dr.coin_id from yr_duel_rounds dr join yr_duels x on x.id = dr.duel
    where x.created_at > now() - interval '24 hours'
      and (x.p1 in (d.p1, coalesce(d.p2, d.p1)) or x.p2 in (d.p1, coalesce(d.p2, d.p1))));
  select u.elo into v_elo from yr_users u where u.id = d.p1;
  ord := (select array_agg(g order by random()) from generate_series(1, 3) g);
  for i in 0 .. d.rounds - 1 loop
    kinds := case ord[(i % 3) + 1]
      when 1 then array['runner', 'pump']
      when 2 then array['rug', 'bleed']
      else array['runner', 'pump', 'rug', 'mid', 'bleed'] end;
    select * into pk from yr_pick_coin(kinds, chosen, seen, v_window, d.p2 is null, v_elo);
    if pk.coin_id is null then
      select * into pk from yr_pick_coin(array['runner', 'pump', 'rug', 'mid', 'bleed'], chosen, seen, v_window, d.p2 is null, v_elo);
    end if;
    if pk.coin_id is null then
      raise exception 'Arenas are warming up. Try again in a minute.';
    end if;
    insert into yr_duel_rounds (duel, r, coin_id, off, ghost_w, ghost_scale)
    values (p_duel, i, pk.coin_id, pk.off, pk.ghost_w, pk.ghost_scale);
    chosen := chosen || pk.coin_id;
  end loop;
end $$;

-- nobody else showed up: the opponent becomes a ghost
create or replace function yr_duel_ghostify(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_duels; v_elo int; hex text;
begin
  select * into d from yr_duels where id = p_duel for update;
  if d.status <> 'queue' or d.p2 is not null then return; end if;
  select u.elo into v_elo from yr_users u where u.id = d.p1;
  hex := substr(md5(random()::text || p_duel::text), 1, 4);
  update yr_duels set
    ghost = jsonb_build_object(
      'name', 'ghost_' || hex,
      'elo', v_elo,
      'avatar', jsonb_build_object('b', floor(random() * 10)::int, 's', floor(random() * 12)::int, 'e', floor(random() * 8)::int,
                                   'm', floor(random() * 8)::int, 'h', floor(random() * 10)::int, 'g', floor(random() * 6)::int, 'o', 6)),
    status = 'live',
    start_at = clock_timestamp() + interval '6 seconds'
  where id = p_duel;
  perform yr_pick_rounds(p_duel);
end $$;

-- applies the result once: rating, streaks, XP
create or replace function yr_duel_finish(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_duels; w1 int; w2 int; s1 double precision; s2 double precision; lastr int; v_win smallint;
        e1 int; e2 int; ex double precision; res double precision; d1 int; d2 int; kf int;
begin
  select * into d from yr_duels where id = p_duel;
  if d.status <> 'live' then return; end if;
  select count(*) filter (where win = 1), count(*) filter (where win = 2),
         coalesce(sum(eq1 - 10) filter (where n1 > 0), 0), coalesce(sum(eq2 - 10) filter (where n2 > 0), 0), max(r)
    into w1, w2, s1, s2, lastr
  from yr_duel_rounds where duel = p_duel and win is not null;
  v_win := case when w1 > w2 then 1 when w2 > w1 then 2
                when s1 > s2 + 1e-6 then 1 when s2 > s1 + 1e-6 then 2 else 0 end;
  res := case v_win when 1 then 1 when 2 then 0 else 0.5 end;
  select elo into e1 from yr_users where id = d.p1;
  if d.p2 is null then
    kf := 20;
    ex := 0.5;   -- ghosts are picked to match your level
    d1 := round(kf * (res - ex));
    d2 := null;
  else
    select elo into e2 from yr_users where id = d.p2;
    kf := 32;
    ex := 1 / (1 + power(10, (e2 - e1) / 400.0));
    d1 := round(kf * (res - ex));
    d2 := -d1;
  end if;
  update yr_users set
    elo = greatest(100, elo + d1),
    d_played = d_played + 1,
    d_won = d_won + (v_win = 1)::int,
    d_lost = d_lost + (v_win = 2)::int,
    streak = case v_win when 1 then streak + 1 when 2 then 0 else streak end,
    best_streak = greatest(best_streak, case v_win when 1 then streak + 1 else 0 end),
    xp = xp + (case v_win when 1 then 120 when 2 then 45 else 70 end) + 15 * w1,
    last_seen = now()
  where id = d.p1;
  if d.p2 is not null then
    update yr_users set
      elo = greatest(100, elo + d2),
      d_played = d_played + 1,
      d_won = d_won + (v_win = 2)::int,
      d_lost = d_lost + (v_win = 1)::int,
      streak = case v_win when 2 then streak + 1 when 1 then 0 else streak end,
      best_streak = greatest(best_streak, case v_win when 2 then streak + 1 else 0 end),
      xp = xp + (case v_win when 2 then 120 when 1 then 45 else 70 end) + 15 * w2,
      last_seen = now()
    where id = d.p2;
  end if;
  update yr_duels set status = 'done', score1 = w1, score2 = w2, winner = v_win, elo1 = d1, elo2 = d2,
    ended_at = start_at + make_interval(secs => ((lastr + 1) * (round_ms + gap_ms) - gap_ms) / 1000.0)
  where id = p_duel;
end $$;

-- resolves every round whose time is up; ends the duel when someone has 2 rounds or all are played
create or replace function yr_duel_resolve(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_duels; now_ms bigint; st bigint; per int; rr record; ct_end int; px double precision;
        v_e1 double precision; v_e2 double precision; v_n1 int; v_n2 int; v_w smallint; w1 int; w2 int;
begin
  select * into d from yr_duels where id = p_duel for update;
  if not found or d.status <> 'live' then return; end if;
  now_ms := yr_now();
  st := yr_ms(d.start_at);
  per := d.round_ms + d.gap_ms;
  for rr in select * from yr_duel_rounds where duel = p_duel and win is null order by r loop
    exit when now_ms < st + rr.r * per + d.round_ms;
    ct_end := rr.off + (d.round_ms * d.speed)::int;
    select x.mc / 1e9 into px from yr_px(rr.coin_id, ct_end) x;
    select 10 + coalesce(sum(case when f.k = 2 then f.sol else -f.sol end), 0)
              + coalesce(sum(case when f.k = 1 then f.tok else -f.tok end), 0) * coalesce(px, 0),
           count(*)
      into v_e1, v_n1
    from yr_duel_fills f where f.duel = p_duel and f.r = rr.r and f.slot = 1;
    if d.p2 is null then
      select g.eq, g.n into v_e2, v_n2 from yr_ghost_eq(rr.coin_id, rr.ghost_w, rr.off, ct_end, rr.ghost_scale) g;
    else
      select 10 + coalesce(sum(case when f.k = 2 then f.sol else -f.sol end), 0)
                + coalesce(sum(case when f.k = 1 then f.tok else -f.tok end), 0) * coalesce(px, 0),
             count(*)
        into v_e2, v_n2
      from yr_duel_fills f where f.duel = p_duel and f.r = rr.r and f.slot = 2;
    end if;
    -- no camping: if only one side traded, that side takes the round
    v_w := case
      when v_n1 > 0 and v_n2 > 0 then (case when v_e1 > v_e2 + 1e-6 then 1 when v_e2 > v_e1 + 1e-6 then 2 else 0 end)
      when v_n1 > 0 then 1
      when v_n2 > 0 then 2
      else 0 end;
    update yr_duel_rounds set eq1 = v_e1, eq2 = v_e2, n1 = v_n1, n2 = v_n2, win = v_w
    where duel = p_duel and r = rr.r;
    select count(*) filter (where win = 1), count(*) filter (where win = 2) into w1, w2
    from yr_duel_rounds where duel = p_duel;
    if w1 >= 2 or w2 >= 2 or rr.r >= d.rounds - 1 then
      perform yr_duel_finish(p_duel);
      return;
    end if;
  end loop;
end $$;

-- cron: finish abandoned duels and drop stale queue entries
create or replace function yr_duel_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare x record; n int := 0;
begin
  update yr_duels set status = 'cancelled' where status = 'queue' and created_at < clock_timestamp() - interval '2 minutes';
  for x in select id from yr_duels where status = 'live'
           and start_at + make_interval(secs => (rounds * (round_ms + gap_ms)) / 1000.0) < clock_timestamp() loop
    perform yr_duel_resolve(x.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function yr_px(int, int) from public, anon, authenticated;
revoke all on function yr_ghost_eq(int, int, int, int, double precision) from public, anon, authenticated;
revoke all on function yr_pick_coin(text[], int[], int[], int, boolean, int) from public, anon, authenticated;
revoke all on function yr_pick_rounds(uuid) from public, anon, authenticated;
revoke all on function yr_duel_ghostify(uuid) from public, anon, authenticated;
revoke all on function yr_duel_finish(uuid) from public, anon, authenticated;
revoke all on function yr_duel_resolve(uuid) from public, anon, authenticated;
revoke all on function yr_duel_sweep() from public, anon, authenticated;

-- ---------- player RPCs ----------

-- matchmaking: back to your unfinished duel, else pair with someone waiting, else wait in the queue
create or replace function yr_duel_find(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; d yr_duels;
begin
  uid := yr_uid(p_secret);
  update yr_users set last_seen = now() where id = uid;
  select * into d from yr_duels where (p1 = uid or p2 = uid) and status in ('queue', 'live')
  order by created_at desc limit 1;
  if found then
    if d.status = 'live' then perform yr_duel_resolve(d.id); end if;
    select * into d from yr_duels where id = d.id;
    if d.status in ('queue', 'live') then
      return jsonb_build_object('id', d.id, 'status', d.status);
    end if;
  end if;
  select * into d from yr_duels
  where status = 'queue' and p1 <> uid and created_at > clock_timestamp() - interval '6 seconds'
  order by created_at limit 1
  for update skip locked;
  if found then
    update yr_duels set p2 = uid, status = 'live', start_at = clock_timestamp() + interval '6 seconds' where id = d.id;
    perform yr_pick_rounds(d.id);
    return jsonb_build_object('id', d.id, 'status', 'live');
  end if;
  if (select count(*) from yr_coins where status = 'ok' and n_events >= 30) < 6 then
    raise exception 'Arenas are warming up. Try again in a minute.';
  end if;
  insert into yr_duels (p1) values (uid) returning * into d;
  return jsonb_build_object('id', d.id, 'status', 'queue');
end $$;

create or replace function yr_duel_cancel(p_secret text, p_duel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  update yr_duels set status = 'cancelled' where id = p_duel and p1 = uid and status = 'queue';
  return jsonb_build_object('ok', true);
end $$;

-- everything the duel screen needs, both sides visible
create or replace function yr_duel(p_duel uuid, p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d yr_duels; uid uuid; me int; now_ms bigint; st bigint; per int;
begin
  select * into d from yr_duels where id = p_duel;
  if not found then raise exception 'Duel not found'; end if;
  if d.status = 'queue' and d.created_at < clock_timestamp() - interval '7 seconds' then
    perform yr_duel_ghostify(p_duel);
  end if;
  select * into d from yr_duels where id = p_duel;
  if d.status = 'live' then
    perform yr_duel_resolve(p_duel);
    select * into d from yr_duels where id = p_duel;
  end if;
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  me := case when uid is null then null when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  now_ms := yr_now();
  st := case when d.start_at is null then null else yr_ms(d.start_at) end;
  per := d.round_ms + d.gap_ms;
  return jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'now', now_ms,
    'created', yr_ms(d.created_at),
    'start', st,
    'round_ms', d.round_ms,
    'gap_ms', d.gap_ms,
    'speed', d.speed,
    'rounds', d.rounds,
    'me', me,
    'ghost', d.p2 is null and d.ghost is not null,
    'p1', (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'w', u.d_won, 'l', u.d_lost,
                                     'streak', u.streak, 'verified', u.wallet is not null)
           from yr_users u where u.id = d.p1),
    'p2', case when d.p2 is null then d.ghost else
          (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'w', u.d_won, 'l', u.d_lost,
                                     'streak', u.streak, 'verified', u.wallet is not null)
           from yr_users u where u.id = d.p2) end,
    'score', jsonb_build_array(d.score1, d.score2),
    'winner', d.winner,
    'elo', jsonb_build_array(d.elo1, d.elo2),
    'rs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'r', dr.r,
        'off', dr.off,
        'sol_usd', c.sol_usd,
        'x', c.twitter is not null, 'tg', c.telegram is not null, 'web', c.website is not null,
        'gw', dr.ghost_w,
        'gs', dr.ghost_scale,
        'eq1', dr.eq1, 'eq2', dr.eq2, 'n1', dr.n1, 'n2', dr.n2, 'win', dr.win,
        'reveal', case when dr.win is not null then jsonb_build_object(
          'name', c.name, 'symbol', c.symbol, 'outcome', c.outcome, 'note', c.stats ->> 'note',
          'x_peak', c.stats -> 'x_peak', 'mint', c.mint) end
      ) order by dr.r)
      from yr_duel_rounds dr join yr_coins c on c.id = dr.coin_id
      where dr.duel = d.id and st is not null and st + dr.r * per <= now_ms + 3000), '[]'::jsonb),
    'fills', coalesce((
      select jsonb_agg(jsonb_build_array(f.slot, f.r, f.t, f.k, round(f.sol::numeric, 4), round(f.tok::numeric)) order by f.created_at)
      from yr_duel_fills f where f.duel = d.id), '[]'::jsonb),
    'emotes', coalesce((
      select jsonb_agg(jsonb_build_array(x.slot, x.e, yr_ms(x.at)) order by x.at)
      from yr_duel_emotes x where x.duel = d.id and x.at > clock_timestamp() - interval '10 seconds'), '[]'::jsonb)
  );
end $$;

-- market events of a round up to "now" only, as coin age in ms
create or replace function yr_duel_feed(p_duel uuid, p_r int, p_since int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d yr_duels; rr yr_duel_rounds; el bigint; ct int; res jsonb;
begin
  select * into d from yr_duels where id = p_duel;
  if not found or d.start_at is null then raise exception 'Duel not found'; end if;
  select * into rr from yr_duel_rounds where duel = p_duel and r = p_r;
  if not found then raise exception 'Round not found'; end if;
  el := least(yr_now() - yr_ms(d.start_at) - p_r * (d.round_ms + d.gap_ms), d.round_ms);
  if el < 0 then
    return jsonb_build_object('ct', null, 'ev', '[]'::jsonb, 'more', false);
  end if;
  ct := rr.off + (el * d.speed)::int;
  with ev as (
    select e.t, e.seq, e.w, e.k, e.sol, e.tok, e.bal, e.mc, e.vsol from yr_events e
    where e.coin_id = rr.coin_id and e.t <= ct and e.t >= greatest(p_since, 0)
    order by e.t, e.seq
    limit 3000
  )
  select jsonb_build_object(
    'ct', ct,
    'ev', coalesce(jsonb_agg(jsonb_build_array(t, seq, w, k, round(sol::numeric, 4), round(tok::numeric), round(bal::numeric),
                                                round(mc::numeric, 3), round(vsol::numeric, 3)) order by t, seq), '[]'::jsonb),
    'more', count(*) = 3000)
  into res from ev;
  return res;
end $$;

create or replace function yr_duel_trade(p_secret text, p_duel uuid, p_side text, p_amount double precision) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; d yr_duels; v_slot int; rel bigint; per int; v_r int; within int; rr yr_duel_rounds; ct int; ev record;
        vs double precision; vt double precision; cash double precision; held double precision; x double precision;
        v_tok double precision; v_sol double precision; recent int;
begin
  uid := yr_uid(p_secret);
  select * into d from yr_duels where id = p_duel;
  if not found then raise exception 'Duel not found'; end if;
  if d.status <> 'live' then raise exception 'This duel is over'; end if;
  v_slot := case when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  if v_slot is null then raise exception 'You are not in this duel'; end if;
  per := d.round_ms + d.gap_ms;
  rel := yr_now() - yr_ms(d.start_at);
  if rel < 0 then raise exception 'The duel has not started'; end if;
  v_r := (rel / per)::int;
  within := (rel - v_r::bigint * per)::int;
  if v_r >= d.rounds or within >= d.round_ms then raise exception 'Wait for the next round'; end if;
  select * into rr from yr_duel_rounds where duel = p_duel and r = v_r;
  if not found or rr.win is not null then raise exception 'Wait for the next round'; end if;
  select count(*) into recent from yr_duel_fills
  where duel = p_duel and slot = v_slot and created_at > clock_timestamp() - interval '1 second';
  if recent >= 4 then raise exception 'Slow down'; end if;
  ct := rr.off + (within * d.speed)::int;
  select px.mc, px.vsol into ev from yr_px(rr.coin_id, ct) px;
  if ev.mc is null then raise exception 'Not launched yet'; end if;
  vs := coalesce(ev.vsol, greatest(ev.mc * 0.2, 30));
  vt := vs * 1e9 / ev.mc;
  select 10 + coalesce(sum(case when f.k = 2 then f.sol else -f.sol end), 0),
         coalesce(sum(case when f.k = 1 then f.tok else -f.tok end), 0)
    into cash, held
  from yr_duel_fills f where f.duel = p_duel and f.slot = v_slot and f.r = v_r;
  if p_side = 'buy' then
    if p_amount is null or p_amount < 0.05 then raise exception 'Minimum buy is 0.05 SOL'; end if;
    if p_amount > cash + 1e-9 then raise exception 'Not enough SOL'; end if;
    x := p_amount * 0.99;
    v_tok := vt * x / (vs + x);
    v_sol := p_amount;
    cash := cash - v_sol;
    held := held + v_tok;
  elsif p_side = 'sell' then
    v_tok := least(coalesce(p_amount, 0), held);
    if v_tok <= 0 then raise exception 'Nothing to sell'; end if;
    if held - v_tok < held * 0.0001 then v_tok := held; end if;
    v_sol := vs * v_tok / (vt + v_tok) * 0.99;
    cash := cash + v_sol;
    held := held - v_tok;
  else
    raise exception 'Unknown side';
  end if;
  insert into yr_duel_fills (duel, slot, r, t, k, sol, tok)
  values (p_duel, v_slot, v_r, within, case when p_side = 'buy' then 1 else 2 end, v_sol, v_tok);
  return jsonb_build_object('r', v_r, 't', within, 'side', p_side, 'sol', v_sol, 'tok', v_tok, 'cash', cash, 'held', held, 'mc', ev.mc);
end $$;

create or replace function yr_duel_emote(p_secret text, p_duel uuid, p_e int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; d yr_duels; v_slot int;
begin
  uid := yr_uid(p_secret);
  select * into d from yr_duels where id = p_duel;
  v_slot := case when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  if v_slot is null or p_e < 0 or p_e > 11 then raise exception 'Not allowed'; end if;
  if exists (select 1 from yr_duel_emotes where duel = p_duel and slot = v_slot and at > clock_timestamp() - interval '1.2 seconds') then
    return jsonb_build_object('ok', false);
  end if;
  insert into yr_duel_emotes (duel, slot, e) values (p_duel, v_slot, p_e);
  return jsonb_build_object('ok', true);
end $$;

-- the latest finished duels, for the lobby feed
create or replace function yr_duel_recent(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.ended desc), '[]'::jsonb) from (
    select d.id, yr_ms(coalesce(d.ended_at, d.created_at)) ended, d.score1 s1, d.score2 s2, d.winner, d.elo1, d.elo2,
      u1.handle n1, u1.avatar a1, coalesce(u2.handle, d.ghost ->> 'name') n2, coalesce(u2.avatar, d.ghost -> 'avatar') a2,
      d.p2 is null ghost
    from yr_duels d
    join yr_users u1 on u1.id = d.p1
    left join yr_users u2 on u2.id = d.p2
    where d.status = 'done'
    order by d.ended_at desc nulls last
    limit least(greatest(p_limit, 1), 30)
  ) x
$$;

-- the lobby: who is around, what is happening, and what pump.fun is doing right now
create or replace function yr_arena(p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; active jsonb; now_ms bigint := yr_now();
begin
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  if uid is not null then
    update yr_users set last_seen = now() where id = uid;
    select jsonb_build_object('id', d.id, 'status', d.status) into active
    from yr_duels d where (d.p1 = uid or d.p2 = uid) and d.status = 'live'
      and d.start_at + make_interval(secs => (d.rounds * (d.round_ms + d.gap_ms)) / 1000.0) > clock_timestamp()
    order by d.created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'now', now_ms,
    'online', (select count(*) from yr_users where last_seen > now() - interval '5 minutes'),
    'queue', (select count(*) from yr_duels where status = 'queue' and created_at > clock_timestamp() - interval '7 seconds'),
    'live', (select count(*) from yr_duels where status = 'live'),
    'today', (select count(*) from yr_duels where status = 'done' and ended_at > now() - interval '24 hours'),
    'pool', (select count(*) from yr_coins where status = 'ok' and n_events >= 30),
    'active', active,
    'recent', yr_duel_recent(10),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'w', u.d_won, 'l', u.d_lost)
                                      order by u.elo desc)
                     from (select * from yr_users where d_played > 0 order by elo desc limit 8) u), '[]'::jsonb),
    'pulse', jsonb_build_object(
      'launches', (select count(*) from yr_coins where created_ms > now_ms - 600000),
      'trades', (select count(*) from yr_events e join yr_coins c on c.id = e.coin_id
                 where c.created_ms > now_ms - 1500000 and c.created_ms + e.t > now_ms - 60000),
      'coins', coalesce((
        select jsonb_agg(jsonb_build_array(c.name, c.symbol, now_ms - c.created_ms, round((lx.mc * coalesce(c.sol_usd, 150))::numeric), c.n_events)
                         order by c.created_ms desc)
        from (select * from yr_coins
              where status in ('raw', 'ok') and name is not null
                and (name || ' ' || coalesce(symbol, '')) !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)'
              order by created_ms desc limit 10) c
        cross join lateral (select e.mc from yr_events e where e.coin_id = c.id order by e.t desc, e.seq desc limit 1) lx), '[]'::jsonb))
  );
end $$;

-- ---------- curation without arenas ----------
-- classifies every finished capture (same rules as yr-build) so the duel pool keeps growing
create or replace function yr_auto_curate(p_limit int default 40) returns int
language plpgsql security definer set search_path = public as $$
declare s record; n int := 0; xp double precision; xf double precision; dr double precision; ds double precision;
        grad boolean; v_out text; note text; init double precision;
begin
  for s in select * from yr_coin_stats(yr_now() - 20 * 60000 - 90000, 30, 400) cs where cs.status = 'raw' limit p_limit loop
    init := coalesce(nullif(s.init_mc, 0), 1);
    xp := s.peak_mc / init;
    xf := s.final_mc / init;
    dr := case when s.peak_mc > 0 then s.final_mc / s.peak_mc else 0 end;
    ds := case when s.dev_bought > 0 then least(1, s.dev_sold / s.dev_bought) else 0 end;
    grad := s.migrated_t is not null;
    if ds >= 0.5 and xf < 1 then
      v_out := 'rug';
      note := 'Dev sold ' || round(ds * 100) || '%'
        || coalesce(' at ' || (s.dev_sell_t / 60000) || 'm ' || lpad(((s.dev_sell_t % 60000) / 1000)::text, 2, '0') || 's', '')
        || ' · ended at ' || to_char(xf, 'FM990.00') || 'x';
    elsif (xp >= 3 and dr >= 0.5) or grad then
      v_out := 'runner';
      note := 'Ran ' || to_char(xp, 'FM990.0') || 'x' || case when grad then ' and graduated' else '' end;
    elsif xp >= 2.2 and dr < 0.5 then
      v_out := 'pump';
      note := 'Pumped ' || to_char(xp, 'FM990.0') || 'x, then dumped ' || round((1 - dr) * 100) || '%';
    elsif xf < 0.85 and xp < 1.8 then
      v_out := 'bleed';
      note := 'Never took off · ended at ' || to_char(xf, 'FM990.00') || 'x';
    else
      v_out := 'mid';
      note := 'Chopped around · peaked at ' || to_char(xp, 'FM990.0') || 'x';
    end if;
    perform yr_curate(s.id,
      case when (coalesce(s.name, '') || ' ' || coalesce(s.symbol, '')) ~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)'
           then 'nsfw' else 'ok' end,
      v_out,
      jsonb_build_object('x_peak', round(xp::numeric, 2), 'x_final', round(xf::numeric, 2), 'dev_sold', round(ds * 100),
                         'graduated', grad, 'note', note));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function yr_auto_curate(int) from public, anon, authenticated;

grant execute on function yr_duel_find(text), yr_duel_cancel(text, uuid), yr_duel(uuid, text), yr_duel_feed(uuid, int, int),
  yr_duel_trade(text, uuid, text, double precision), yr_duel_emote(text, uuid, int), yr_duel_recent(int), yr_arena(text)
  to anon, authenticated;
