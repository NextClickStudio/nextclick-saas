-- yeppo 1v1: live duels on the yeppo terminal.
-- Both players get 10 play SOL and 3 minutes to trade any pump.fun coin that is live right now.
-- Every fill is priced by the yr-term edge function on the coin's bonding curve, read from the chain
-- at that very moment, so the play money behaves exactly like the real thing.
-- Nobody online? The opponent is the ghost of a real wallet, replayed from a captured launch.

-- latest bonding-curve reserves per coin (shared with real duels)
create table if not exists yr_rmarks (
  mint text primary key,
  vsol double precision not null,
  vtok double precision not null,
  at timestamptz not null default now()
);
alter table yr_rmarks enable row level security;

create table if not exists yr_lduels (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queue',      -- queue | live | done | cancelled
  p1 uuid not null references yr_users(id) on delete cascade,
  p2 uuid references yr_users(id) on delete cascade,   -- null when the opponent is a ghost
  ghost jsonb,                                -- {name, avatar, elo, sym}
  g_coin int references yr_coins(id) on delete set null,
  g_w int,
  g_off int,
  g_scale double precision,
  dur_ms int not null default 180000,
  created_at timestamptz not null default clock_timestamp(),
  start_at timestamptz,
  ended_at timestamptz,
  eq1 double precision,
  eq2 double precision,
  n1 int,
  n2 int,
  winner smallint,                            -- 1 or 2, 0 for a draw
  elo1 int,
  elo2 int
);
create index if not exists yr_lduels_status on yr_lduels (status, created_at);
create index if not exists yr_lduels_p1 on yr_lduels (p1, created_at desc);
create index if not exists yr_lduels_p2 on yr_lduels (p2, created_at desc);
alter table yr_lduels enable row level security;

create table if not exists yr_lfills (
  id bigserial primary key,
  duel uuid not null references yr_lduels(id) on delete cascade,
  slot smallint not null,
  at timestamptz not null default clock_timestamp(),
  mint text not null,
  sym text,
  k smallint not null,                        -- 1 buy, 2 sell
  sol double precision not null,
  tok double precision not null,
  vsol double precision not null,             -- the curve the fill was priced on
  vtok double precision not null
);
create index if not exists yr_lfills_duel on yr_lfills (duel, slot, id);
alter table yr_lfills enable row level security;

-- short-lived cache for the terminal's coin lists and chain lookups
create table if not exists yr_tcache (
  k text primary key,
  at timestamptz not null default clock_timestamp(),
  data jsonb not null
);
alter table yr_tcache enable row level security;

-- ---------- books ----------

-- one player's open bags: tokens held per coin, what they cost, and the price they are marked at
create or replace function yr_lbook(p_duel uuid, p_slot int)
returns table(mint text, sym text, held double precision, spent double precision, got double precision, px double precision, n int)
language sql stable security definer set search_path = public as $$
  with f as (
    select x.mint, max(x.sym) sym,
      coalesce(sum(x.tok) filter (where x.k = 1), 0) - coalesce(sum(x.tok) filter (where x.k = 2), 0) held,
      coalesce(sum(x.sol) filter (where x.k = 1), 0) spent,
      coalesce(sum(x.sol) filter (where x.k = 2), 0) got,
      (array_agg(x.vsol / nullif(x.vtok, 0) order by x.id desc))[1] last_px,
      max(x.at) last_at,
      count(*)::int n
    from yr_lfills x where x.duel = p_duel and x.slot = p_slot
    group by x.mint
  )
  select f.mint, f.sym, greatest(f.held, 0), f.spent, f.got,
    case when m.at >= f.last_at and m.vtok > 0 then m.vsol / m.vtok else f.last_px end,
    f.n
  from f left join yr_rmarks m on m.mint = f.mint
$$;

create or replace function yr_leq(p_duel uuid, p_slot int)
returns table(eq double precision, cash double precision, n int)
language sql stable security definer set search_path = public as $$
  select 10 - coalesce(sum(b.spent), 0) + coalesce(sum(b.got), 0) + coalesce(sum(b.held * coalesce(b.px, 0)), 0),
         10 - coalesce(sum(b.spent), 0) + coalesce(sum(b.got), 0),
         coalesce(sum(b.n), 0)::int
  from yr_lbook(p_duel, p_slot) b
$$;

-- ---------- lifecycle ----------

-- nobody else showed up: the opponent becomes the ghost of a real wallet on a captured launch
create or replace function yr_lduel_ghostify(p_duel uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_lduels; v_elo int; hex text; pk record; v_sym text; seen int[];
begin
  select * into d from yr_lduels where id = p_duel for update;
  if d.status <> 'queue' or d.p2 is not null then return; end if;
  select u.elo into v_elo from yr_users u where u.id = d.p1;
  seen := array(select x.g_coin from yr_lduels x where x.p1 = d.p1 and x.g_coin is not null
                and x.created_at > now() - interval '24 hours');
  select * into pk from yr_pick_coin(array['runner', 'pump', 'rug', 'mid', 'bleed'], '{}', seen, d.dur_ms, true, v_elo);
  if pk.coin_id is null then
    raise exception 'Arenas are warming up. Try again in a minute.';
  end if;
  select c.symbol into v_sym from yr_coins c where c.id = pk.coin_id;
  hex := substr(md5(random()::text || p_duel::text), 1, 4);
  update yr_lduels set
    ghost = jsonb_build_object(
      'name', 'ghost_' || hex,
      'elo', v_elo,
      'sym', upper(left(coalesce(v_sym, '???'), 10)),
      'avatar', jsonb_build_object('b', floor(random() * 10)::int, 's', floor(random() * 12)::int, 'e', floor(random() * 8)::int,
                                   'm', floor(random() * 8)::int, 'h', floor(random() * 10)::int, 'g', floor(random() * 6)::int, 'o', 6)),
    g_coin = pk.coin_id, g_w = pk.ghost_w, g_off = pk.off, g_scale = pk.ghost_scale,
    status = 'live',
    start_at = clock_timestamp() + interval '7 seconds'
  where id = p_duel;
end $$;

-- applies the result once, after the clock ran out: rating, streaks, XP
create or replace function yr_lduel_settle(p_duel uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_lduels; a record; b record; v_win smallint; e1 int; e2 int; ex double precision; res double precision;
        d1 int; d2 int; kf int; v_end timestamptz;
begin
  select * into d from yr_lduels where id = p_duel for update;
  if not found or d.status <> 'live' then return; end if;
  v_end := d.start_at + make_interval(secs => d.dur_ms / 1000.0);
  if not p_force and clock_timestamp() < v_end + interval '1.5 seconds' then return; end if;
  if clock_timestamp() < v_end then return; end if;
  select * into a from yr_leq(p_duel, 1);
  if d.p2 is null then
    select g.eq, 0::double precision cash, g.n into b from yr_ghost_eq(d.g_coin, d.g_w, d.g_off, d.g_off + d.dur_ms, d.g_scale) g;
  else
    select * into b from yr_leq(p_duel, 2);
  end if;
  -- no camping: if only one side traded, that side wins
  v_win := case
    when a.n > 0 and b.n > 0 then (case when a.eq > b.eq + 1e-6 then 1 when b.eq > a.eq + 1e-6 then 2 else 0 end)
    when a.n > 0 then 1
    when b.n > 0 then 2
    else 0 end;
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
    xp = xp + case v_win when 1 then 150 when 2 then 50 else 80 end,
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
      xp = xp + case v_win when 2 then 150 when 1 then 50 else 80 end,
      last_seen = now()
    where id = d.p2;
  end if;
  update yr_lduels set status = 'done', eq1 = a.eq, eq2 = b.eq, n1 = a.n, n2 = b.n, winner = v_win,
    elo1 = d1, elo2 = d2, ended_at = v_end
  where id = p_duel;
end $$;

-- cron: drop stale queue entries and settle duels whose players left
create or replace function yr_lduel_sweep() returns int
language plpgsql security definer set search_path = public as $$
declare x record; n int := 0;
begin
  update yr_lduels set status = 'cancelled' where status = 'queue' and created_at < clock_timestamp() - interval '2 minutes';
  for x in select id from yr_lduels where status = 'live'
           and start_at + make_interval(secs => dur_ms / 1000.0) < clock_timestamp() - interval '25 seconds' loop
    perform yr_lduel_settle(x.id, true);
    n := n + 1;
  end loop;
  return n;
end $$;

-- the existing sweep cron now also looks after live duels
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
  return n + yr_lduel_sweep();
end $$;

-- ---------- service functions for yr-term ----------

-- a fill at the given curve reserves, which yr-term just read from the chain
create or replace function yr_lduel_fill(p_secret text, p_duel uuid, p_mint text, p_sym text, p_side text, p_amount double precision,
                                         p_vsol double precision, p_vtok double precision, p_expect double precision, p_slip double precision)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; d yr_lduels; v_slot int; v_end timestamptz; recent int; total int; c record; held double precision;
        spot double precision; x double precision; v_tok double precision; v_sol double precision; v_sym text;
begin
  uid := yr_uid(p_secret);
  select * into d from yr_lduels where id = p_duel;
  if not found then raise exception 'Duel not found'; end if;
  if d.status <> 'live' then raise exception 'This duel is over'; end if;
  v_slot := case when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  if v_slot is null then raise exception 'You are not in this duel'; end if;
  v_end := d.start_at + make_interval(secs => d.dur_ms / 1000.0);
  if clock_timestamp() < d.start_at then raise exception 'The duel has not started'; end if;
  if clock_timestamp() > v_end then raise exception 'Time is up'; end if;
  if p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Unknown coin'; end if;
  if not (p_vsol > 0 and p_vtok > 0) then raise exception 'This coin is not trading on its bonding curve'; end if;
  select count(*) filter (where f.at > clock_timestamp() - interval '1 second'), count(*) into recent, total
  from yr_lfills f where f.duel = p_duel and f.slot = v_slot;
  if recent >= 4 then raise exception 'Slow down'; end if;
  if total >= 400 then raise exception 'Trade limit reached for this duel'; end if;
  select * into c from yr_leq(p_duel, v_slot);
  select coalesce(sum(case when f.k = 1 then f.tok else -f.tok end), 0) into held
  from yr_lfills f where f.duel = p_duel and f.slot = v_slot and f.mint = p_mint;
  spot := p_vsol / p_vtok;
  -- the price moved further than the player's slippage since they clicked: reject, like a real swap would
  if p_expect > 0 and p_slip >= 0 then
    if p_side = 'buy' and spot > p_expect * (1 + p_slip) then
      raise exception 'Price moved % percent since your click. Raise slippage or try again.', round(((spot / p_expect - 1) * 100)::numeric, 1);
    end if;
    if p_side = 'sell' and spot < p_expect * (1 - p_slip) then
      raise exception 'Price dropped % percent since your click. Raise slippage or try again.', round(((1 - spot / p_expect) * 100)::numeric, 1);
    end if;
  end if;
  if p_side = 'buy' then
    if p_amount is null or p_amount < 0.01 then raise exception 'Minimum buy is 0.01 SOL'; end if;
    if p_amount > c.cash + 1e-9 then raise exception 'Not enough SOL'; end if;
    x := p_amount * 0.99;
    v_tok := p_vtok * x / (p_vsol + x);
    v_sol := p_amount;
    held := held + v_tok;
  elsif p_side = 'sell' then
    v_tok := least(coalesce(p_amount, 0), held);
    if v_tok <= 0 then raise exception 'Nothing to sell'; end if;
    if held - v_tok < held * 0.0001 then v_tok := held; end if;
    v_sol := p_vsol * v_tok / (p_vtok + v_tok) * 0.99;
    held := held - v_tok;
  else
    raise exception 'Unknown side';
  end if;
  v_sym := nullif(upper(left(regexp_replace(coalesce(p_sym, ''), '[^A-Za-z0-9$_.-]', '', 'g'), 12)), '');
  insert into yr_lfills (duel, slot, mint, sym, k, sol, tok, vsol, vtok)
  values (p_duel, v_slot, p_mint, v_sym, case when p_side = 'buy' then 1 else 2 end, v_sol, v_tok, p_vsol, p_vtok);
  insert into yr_rmarks (mint, vsol, vtok, at) values (p_mint, p_vsol, p_vtok, clock_timestamp())
  on conflict (mint) do update set vsol = excluded.vsol, vtok = excluded.vtok, at = excluded.at;
  return jsonb_build_object('side', p_side, 'sol', v_sol, 'tok', v_tok, 'px', spot, 'held', held,
    'cash', c.cash + case when p_side = 'buy' then -v_sol else v_sol end, 'at', yr_now());
end $$;

-- coins held in live duels (to keep their marks fresh) and duels whose clock ran out
create or replace function yr_lduel_jobs(p_duel uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'live', (select count(*) from yr_lduels where status = 'live'),
    'held', coalesce((
      select jsonb_agg(distinct h.mint) from (
        select f.mint from yr_lfills f join yr_lduels d on d.id = f.duel
        where d.status = 'live' and (p_duel is null or d.id = p_duel)
        group by f.duel, f.slot, f.mint
        having sum(case when f.k = 1 then f.tok else -f.tok end) > 0) h), '[]'::jsonb),
    'due', coalesce((
      select jsonb_agg(d.id) from yr_lduels d
      where d.status = 'live' and (p_duel is null or d.id = p_duel)
        and d.start_at + make_interval(secs => d.dur_ms / 1000.0) < clock_timestamp() - interval '1.5 seconds'), '[]'::jsonb))
$$;

revoke all on function yr_lbook(uuid, int) from public, anon, authenticated;
revoke all on function yr_leq(uuid, int) from public, anon, authenticated;
revoke all on function yr_lduel_ghostify(uuid) from public, anon, authenticated;
revoke all on function yr_lduel_settle(uuid, boolean) from public, anon, authenticated;
revoke all on function yr_lduel_sweep() from public, anon, authenticated;
revoke all on function yr_duel_sweep() from public, anon, authenticated;
revoke all on function yr_lduel_fill(text, uuid, text, text, text, double precision, double precision, double precision, double precision, double precision)
  from public, anon, authenticated;
revoke all on function yr_lduel_jobs(uuid) from public, anon, authenticated;

-- ---------- player RPCs ----------

-- matchmaking: back to your unfinished duel, else pair with someone waiting, else wait in the queue
create or replace function yr_lduel_find(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; d yr_lduels;
begin
  uid := yr_uid(p_secret);
  update yr_users set last_seen = now() where id = uid;
  select * into d from yr_lduels where (p1 = uid or p2 = uid) and status in ('queue', 'live')
    and (status = 'queue' or start_at + make_interval(secs => dur_ms / 1000.0) > clock_timestamp())
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('id', d.id, 'status', d.status);
  end if;
  select * into d from yr_lduels
  where status = 'queue' and p1 <> uid and created_at > clock_timestamp() - interval '6 seconds'
  order by created_at limit 1
  for update skip locked;
  if found then
    update yr_lduels set p2 = uid, status = 'live', start_at = clock_timestamp() + interval '7 seconds' where id = d.id;
    return jsonb_build_object('id', d.id, 'status', 'live');
  end if;
  if (select count(*) from yr_coins where status = 'ok' and n_events >= 30) < 6 then
    raise exception 'Arenas are warming up. Try again in a minute.';
  end if;
  insert into yr_lduels (p1) values (uid) returning * into d;
  return jsonb_build_object('id', d.id, 'status', 'queue');
end $$;

create or replace function yr_lduel_cancel(p_secret text, p_duel uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  update yr_lduels set status = 'cancelled' where id = p_duel and p1 = uid and status = 'queue';
  return jsonb_build_object('ok', true);
end $$;

-- everything the duel screen needs; both books are public, the ghost is revealed as its clock runs
create or replace function yr_lduel(p_duel uuid, p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d yr_lduels; uid uuid; me int; now_ms bigint; st bigint; el int; g record; gpx double precision; v_sol_usd double precision;
begin
  select null::double precision eq, 0 n into g;
  select * into d from yr_lduels where id = p_duel;
  if not found then raise exception 'Duel not found'; end if;
  if d.status = 'queue' and d.created_at < clock_timestamp() - interval '7 seconds' then
    perform yr_lduel_ghostify(p_duel);
    select * into d from yr_lduels where id = p_duel;
  end if;
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  me := case when uid is null then null when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  now_ms := yr_now();
  st := case when d.start_at is null then null else yr_ms(d.start_at) end;
  el := case when st is null then 0 else greatest(0, least(now_ms - st, d.dur_ms))::int end;
  if d.p2 is null and d.g_coin is not null then
    select * into g from yr_ghost_eq(d.g_coin, d.g_w, d.g_off, d.g_off + el, d.g_scale);
    select x.mc / 1e9 into gpx from yr_px(d.g_coin, d.g_off + el) x;
    select c.sol_usd into v_sol_usd from yr_coins c where c.id = d.g_coin;
  end if;
  return jsonb_build_object(
    'id', d.id,
    'status', d.status,
    'now', now_ms,
    'created', yr_ms(d.created_at),
    'start', st,
    'dur_ms', d.dur_ms,
    'me', me,
    'ghost', d.p2 is null and d.ghost is not null,
    'p1', (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'w', u.d_won, 'l', u.d_lost,
                                     'streak', u.streak, 'verified', u.wallet is not null)
           from yr_users u where u.id = d.p1),
    'p2', case when d.p2 is null then d.ghost else
          (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'w', u.d_won, 'l', u.d_lost,
                                     'streak', u.streak, 'verified', u.wallet is not null)
           from yr_users u where u.id = d.p2) end,
    'winner', d.winner,
    'eq', jsonb_build_array(d.eq1, d.eq2),
    'n', jsonb_build_array(d.n1, d.n2),
    'elo', jsonb_build_array(d.elo1, d.elo2),
    -- [slot, atMs, mint, symbol, kind, sol, tokens, priceSol]
    'fills', coalesce((
      select jsonb_agg(jsonb_build_array(f.slot, yr_ms(f.at), f.mint, f.sym, f.k, round(f.sol::numeric, 5), f.tok,
                                         f.vsol / nullif(f.vtok, 0)) order by f.id)
      from yr_lfills f where f.duel = d.id), '[]'::jsonb),
    'marks', coalesce((
      select jsonb_object_agg(m.mint, m.vsol / nullif(m.vtok, 0))
      from yr_rmarks m where m.mint in (select distinct f.mint from yr_lfills f where f.duel = d.id)), '{}'::jsonb),
    'g', case when d.p2 is null and d.g_coin is not null then jsonb_build_object(
      'eq', g.eq,
      'n', g.n,
      'px', gpx,
      'sol_usd', v_sol_usd,
      -- the ghost's real trades so far: [msIntoDuel, kind, sol, tokens, mcSol]
      'tr', coalesce((
        select jsonb_agg(jsonb_build_array(e.t - d.g_off, e.k, round((e.sol * d.g_scale)::numeric, 4), e.tok * d.g_scale, round(e.mc::numeric, 3))
                         order by e.t, e.seq)
        from yr_events e where e.coin_id = d.g_coin and e.w = d.g_w and e.t > d.g_off and e.t <= d.g_off + el and e.k in (1, 2)), '[]'::jsonb),
      'reveal', case when d.status = 'done' then (
        select jsonb_build_object('name', c.name, 'symbol', c.symbol, 'mint', c.mint, 'outcome', c.outcome)
        from yr_coins c where c.id = d.g_coin) end) end
  );
end $$;

-- the terminal's live coin list: launches of the last 30 minutes with their latest numbers
create or replace function yr_t_pulse() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c yr_tcache; now_ms bigint := yr_now(); res jsonb;
begin
  select * into c from yr_tcache where k = 'pulse';
  if found and c.at > clock_timestamp() - interval '4 seconds' then return c.data; end if;
  if not pg_try_advisory_xact_lock(hashtext('yr_t_pulse')) then
    return coalesce(c.data, jsonb_build_object('now', now_ms, 'coins', '[]'::jsonb));
  end if;
  select jsonb_build_object(
    'now', now_ms,
    'sol_usd', (select x.sol_usd from yr_coins x where x.sol_usd is not null order by x.created_ms desc limit 1),
    -- [mint, name, symbol, uri, createdMs, mcSol, vSol, athMcSol, trades, buys5m, sells5m, vol5m, tx1m, x, tg, web, lastMs]
    'coins', coalesce(jsonb_agg(jsonb_build_array(
        co.mint, co.name, co.symbol, co.uri, co.created_ms, round(lx.mc::numeric, 3), round(lx.vsol::numeric, 3), round(st.ath::numeric, 3),
        co.n_events, st.b5, st.s5, round(st.v5::numeric, 3), st.t1, co.twitter is not null, co.telegram is not null,
        co.website is not null, co.created_ms + lx.t)
      order by co.created_ms desc), '[]'::jsonb))
  into res
  from (select * from yr_coins
        where created_ms > now_ms - 1800000 and status in ('raw', 'ok') and name is not null
          and (name || ' ' || coalesce(symbol, '')) !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)'
        order by created_ms desc limit 150) co
  cross join lateral (select e.mc, e.vsol, e.t from yr_events e where e.coin_id = co.id order by e.t desc, e.seq desc limit 1) lx
  cross join lateral (
    select count(*) filter (where e.k = 1)::int b5, count(*) filter (where e.k = 2)::int s5, coalesce(sum(e.sol), 0) v5,
           count(*) filter (where co.created_ms + e.t > now_ms - 60000)::int t1,
           (select max(a.mc) from yr_events a where a.coin_id = co.id) ath
    from yr_events e where e.coin_id = co.id and e.t > now_ms - 300000 - co.created_ms) st;
  insert into yr_tcache (k, at, data) values ('pulse', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;

-- a coin's captured history for the chart (null when yeppo never captured it)
create or replace function yr_t_coin(p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mint', c.mint, 'name', c.name, 'symbol', c.symbol, 'uri', c.uri, 'created', c.created_ms, 'sol_usd', c.sol_usd,
    'twitter', c.twitter, 'telegram', c.telegram, 'website', c.website, 'migrated_t', c.migrated_t,
    -- [msAfterLaunch, wallet, kind, sol, tokens, mcSol, vSol]
    'ev', coalesce((
      select jsonb_agg(jsonb_build_array(e.t, e.w, e.k, round(e.sol::numeric, 4), round(e.tok::numeric), round(e.mc::numeric, 3), round(e.vsol::numeric, 3))
                       order by e.t, e.seq)
      from (select * from yr_events x where x.coin_id = c.id order by x.t, x.seq limit 8000) e), '[]'::jsonb))
  from yr_coins c
  where c.mint = p_mint and c.status <> 'rejected'
    and (c.name || ' ' || coalesce(c.symbol, '')) !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn)'
$$;

grant execute on function yr_lduel_find(text), yr_lduel_cancel(text, uuid), yr_lduel(uuid, text), yr_t_pulse(), yr_t_coin(text)
  to anon, authenticated;

-- the lobby feed and the profile now show live duels too
create or replace function yr_duel_recent(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.ended desc), '[]'::jsonb) from (
    (select d.id, 'replay' kind, yr_ms(coalesce(d.ended_at, d.created_at)) ended, d.score1::double precision s1, d.score2::double precision s2,
       d.winner, d.elo1, d.elo2, u1.handle n1, u1.avatar a1, coalesce(u2.handle, d.ghost ->> 'name') n2,
       coalesce(u2.avatar, d.ghost -> 'avatar') a2, d.p2 is null ghost
     from yr_duels d
     join yr_users u1 on u1.id = d.p1
     left join yr_users u2 on u2.id = d.p2
     where d.status = 'done'
     order by d.ended_at desc nulls last
     limit least(greatest(p_limit, 1), 30))
    union all
    (select d.id, 'live', yr_ms(coalesce(d.ended_at, d.created_at)), round(((d.eq1 - 10) * 10)::numeric, 1)::double precision,
       round(((d.eq2 - 10) * 10)::numeric, 1)::double precision, d.winner, d.elo1, d.elo2, u1.handle, u1.avatar,
       coalesce(u2.handle, d.ghost ->> 'name'), coalesce(u2.avatar, d.ghost -> 'avatar'), d.p2 is null
     from yr_lduels d
     join yr_users u1 on u1.id = d.p1
     left join yr_users u2 on u2.id = d.p2
     where d.status = 'done'
     order by d.ended_at desc nulls last
     limit least(greatest(p_limit, 1), 30))
    order by 3 desc
    limit least(greatest(p_limit, 1), 30)
  ) x
$$;

create or replace function yr_my_duels(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  return coalesce((select jsonb_agg(x order by x.ended desc) from (
    (select d.id, 'replay' kind, yr_ms(coalesce(d.ended_at, d.created_at)) ended,
      case when d.p1 = uid then 1 else 2 end me, d.score1::double precision s1, d.score2::double precision s2, d.winner,
      case when d.p1 = uid then d.elo1 else d.elo2 end delta,
      case when d.p1 = uid then coalesce(u2.handle, d.ghost ->> 'name') else u1.handle end opp,
      case when d.p1 = uid then coalesce(u2.avatar, d.ghost -> 'avatar') else u1.avatar end opp_avatar,
      d.p2 is null ghost
    from yr_duels d
    join yr_users u1 on u1.id = d.p1
    left join yr_users u2 on u2.id = d.p2
    where (d.p1 = uid or d.p2 = uid) and d.status = 'done'
    order by d.ended_at desc nulls last
    limit 15)
    union all
    (select d.id, 'live', yr_ms(coalesce(d.ended_at, d.created_at)),
      case when d.p1 = uid then 1 else 2 end, round(((d.eq1 - 10) * 10)::numeric, 1)::double precision,
      round(((d.eq2 - 10) * 10)::numeric, 1)::double precision, d.winner,
      case when d.p1 = uid then d.elo1 else d.elo2 end,
      case when d.p1 = uid then coalesce(u2.handle, d.ghost ->> 'name') else u1.handle end,
      case when d.p1 = uid then coalesce(u2.avatar, d.ghost -> 'avatar') else u1.avatar end,
      d.p2 is null
    from yr_lduels d
    join yr_users u1 on u1.id = d.p1
    left join yr_users u2 on u2.id = d.p2
    where (d.p1 = uid or d.p2 = uid) and d.status = 'done'
    order by d.ended_at desc nulls last
    limit 15)
    order by 3 desc
    limit 20) x), '[]'::jsonb);
end $$;
grant execute on function yr_my_duels(text) to anon, authenticated;

create or replace function yr_arena(p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; active jsonb; now_ms bigint := yr_now();
begin
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  if uid is not null then
    update yr_users set last_seen = now() where id = uid;
    select jsonb_build_object('id', d.id, 'status', d.status, 'kind', 'live') into active
    from yr_lduels d where (d.p1 = uid or d.p2 = uid) and d.status = 'live'
      and d.start_at + make_interval(secs => d.dur_ms / 1000.0) > clock_timestamp()
    order by d.created_at desc limit 1;
    if active is null then
      select jsonb_build_object('id', d.id, 'status', d.status, 'kind', 'replay') into active
      from yr_duels d where (d.p1 = uid or d.p2 = uid) and d.status = 'live'
        and d.start_at + make_interval(secs => (d.rounds * (d.round_ms + d.gap_ms)) / 1000.0) > clock_timestamp()
      order by d.created_at desc limit 1;
    end if;
  end if;
  return jsonb_build_object(
    'now', now_ms,
    'online', (select count(*) from yr_users where last_seen > now() - interval '5 minutes'),
    'queue', (select count(*) from yr_duels where status = 'queue' and created_at > clock_timestamp() - interval '7 seconds')
           + (select count(*) from yr_lduels where status = 'queue' and created_at > clock_timestamp() - interval '7 seconds'),
    'live', (select count(*) from yr_duels where status = 'live') + (select count(*) from yr_lduels where status = 'live'),
    'today', (select count(*) from yr_duels where status = 'done' and ended_at > now() - interval '24 hours')
           + (select count(*) from yr_lduels where status = 'done' and ended_at > now() - interval '24 hours'),
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
grant execute on function yr_arena(text) to anon, authenticated;
