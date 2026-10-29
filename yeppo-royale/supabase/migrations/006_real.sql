-- yeppo 1v1: real duels.
-- Both players trade with their own wallets on pump.fun, or any app that routes through it
-- (Axiom, GMGN, Photon, BullX...). The yr-real edge function reads their trades from the chain.
-- Only trades inside the duel window count, and selling a bag bought before the start earns
-- nothing. No money moves through yeppo: the prize is a verified win on your profile.

create table if not exists yr_wallet_nonce (
  user_id uuid primary key references yr_users(id) on delete cascade,
  nonce text not null,
  created_at timestamptz not null default now()
);
alter table yr_wallet_nonce enable row level security;

create table if not exists yr_rduels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                -- short code for the challenge link
  p1 uuid not null references yr_users(id) on delete cascade,
  p2 uuid references yr_users(id) on delete cascade,
  w1 text not null,
  w2 text,
  dur_ms int not null,
  status text not null default 'open',      -- open | live | done | cancelled | expired
  created_at timestamptz not null default now(),
  start_at timestamptz,
  end_at timestamptz,
  winner smallint,                          -- 1, 2, or 0 for a draw
  s1 jsonb,
  s2 jsonb,
  elo1 int,
  elo2 int
);
create index if not exists yr_rduels_status on yr_rduels (status, created_at desc);
alter table yr_rduels enable row level security;

create table if not exists yr_rtrades (
  rduel uuid not null references yr_rduels(id) on delete cascade,
  slot smallint not null,
  sig text not null,
  ix smallint not null,
  mint text not null,
  k smallint not null,                      -- 1 buy, 2 sell
  sol double precision not null,
  tok double precision not null,
  vsol double precision,
  vtok double precision,
  at timestamptz not null,
  primary key (rduel, slot, sig, ix)
);
alter table yr_rtrades enable row level security;

-- latest bonding-curve reserves of every coin someone in a live duel holds
create table if not exists yr_rmarks (
  mint text primary key,
  vsol double precision not null,
  vtok double precision not null,
  at timestamptz not null default now()
);
alter table yr_rmarks enable row level security;

create table if not exists yr_rcursor (
  rduel uuid not null references yr_rduels(id) on delete cascade,
  slot smallint not null,
  last_sig text,
  polled_at timestamptz,
  primary key (rduel, slot)
);
alter table yr_rcursor enable row level security;

-- ---------- wallet verification (the signature itself is checked by yr-real) ----------
create or replace function yr_wallet_message(p_handle text, p_nonce text) returns text
language sql immutable as $$
  select 'yeppo.it: verify this wallet for ' || p_handle || E'\n\n'
      || E'This free signature only proves you own the wallet. It cannot move funds.\n\n'
      || 'Nonce: ' || p_nonce
$$;

create or replace function yr_wallet_nonce(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; v_nonce text; h text;
begin
  uid := yr_uid(p_secret);
  v_nonce := substr(md5(random()::text || clock_timestamp()::text), 1, 16);
  insert into yr_wallet_nonce (user_id, nonce) values (uid, v_nonce)
  on conflict (user_id) do update set nonce = excluded.nonce, created_at = now();
  select handle into h from yr_users where id = uid;
  return jsonb_build_object('message', yr_wallet_message(h, v_nonce));
end $$;

-- service only: what yr-real needs to check a signature
create or replace function yr_wallet_check(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; n yr_wallet_nonce; h text;
begin
  uid := yr_uid(p_secret);
  select * into n from yr_wallet_nonce where user_id = uid;
  if not found or n.created_at < now() - interval '10 minutes' then
    raise exception 'The signature request expired. Try again.';
  end if;
  select handle into h from yr_users where id = uid;
  return jsonb_build_object('user_id', uid, 'message', yr_wallet_message(h, n.nonce));
end $$;

create or replace function yr_wallet_link(p_user uuid, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u yr_users;
begin
  if exists (select 1 from yr_users where wallet = p_address and id <> p_user) then
    raise exception 'This wallet is linked to another profile';
  end if;
  if exists (select 1 from yr_rduels where status in ('open', 'live') and (p1 = p_user or p2 = p_user)) then
    raise exception 'Finish your real duel before changing wallets';
  end if;
  update yr_users set wallet = p_address where id = p_user returning * into u;
  delete from yr_wallet_nonce where user_id = p_user;
  return to_jsonb(u);
end $$;

-- ---------- scoring ----------
-- per player: SOL bought in the window, PnL (sold + still held at the latest price - bought), ROI
create or replace function yr_rscore(p_id uuid)
returns table(slot smallint, vol double precision, pnl double precision, roi double precision, ntr int)
language sql stable security definer set search_path = public as $$
  with t as (
    select x.slot, x.mint,
      coalesce(sum(x.sol) filter (where x.k = 1), 0) bs,
      coalesce(sum(x.tok) filter (where x.k = 1), 0) bt,
      coalesce(sum(x.sol) filter (where x.k = 2), 0) ss,
      coalesce(sum(x.tok) filter (where x.k = 2), 0) st,
      count(*) n
    from yr_rtrades x where x.rduel = p_id
    group by x.slot, x.mint
  ), v as (
    select t.slot, t.bs, t.n,
      (case when t.st > 0 then t.ss * least(t.st, t.bt) / t.st else 0 end)
        + (t.bt - least(t.st, t.bt)) * coalesce(m.vsol / nullif(m.vtok, 0), 0) - t.bs pnl
    from t left join yr_rmarks m on m.mint = t.mint
  )
  select s.slot::smallint, coalesce(sum(v.bs), 0)::double precision, coalesce(sum(v.pnl), 0)::double precision,
         case when coalesce(sum(v.bs), 0) > 0 then (sum(v.pnl) / sum(v.bs))::double precision end,
         coalesce(sum(v.n), 0)::int
  from (values (1), (2)) s(slot)
  left join v on v.slot = s.slot
  group by s.slot
$$;

-- applies the result once, after the poller had time to catch the last trades
create or replace function yr_rduel_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_rduels; a record; b record; ok1 boolean; ok2 boolean; v_win smallint; e1 int; e2 int; ex double precision; res double precision; d1 int;
begin
  select * into d from yr_rduels where id = p_id for update;
  if d.status <> 'live' or clock_timestamp() < d.end_at + interval '75 seconds' then return; end if;
  select * into a from yr_rscore(p_id) s where s.slot = 1;
  select * into b from yr_rscore(p_id) s where s.slot = 2;
  ok1 := a.vol >= 0.1;
  ok2 := b.vol >= 0.1;
  v_win := case
    when ok1 and ok2 then (case when a.roi > b.roi + 1e-9 then 1 when b.roi > a.roi + 1e-9 then 2 else 0 end)
    when ok1 then 1
    when ok2 then 2
    else 0 end;
  select elo into e1 from yr_users where id = d.p1;
  select elo into e2 from yr_users where id = d.p2;
  res := case v_win when 1 then 1 when 2 then 0 else 0.5 end;
  ex := 1 / (1 + power(10, (e2 - e1) / 400.0));
  d1 := round(24 * (res - ex));
  update yr_users set elo = greatest(100, elo + d1), r_played = r_played + 1, r_won = r_won + (v_win = 1)::int,
    best_roi = case when ok1 then greatest(coalesce(best_roi, -1e9), a.roi) else best_roi end, xp = xp + case v_win when 1 then 250 else 80 end
  where id = d.p1;
  update yr_users set elo = greatest(100, elo - d1), r_played = r_played + 1, r_won = r_won + (v_win = 2)::int,
    best_roi = case when ok2 then greatest(coalesce(best_roi, -1e9), b.roi) else best_roi end, xp = xp + case v_win when 2 then 250 else 80 end
  where id = d.p2;
  update yr_rduels set status = 'done', winner = v_win, elo1 = d1, elo2 = -d1,
    s1 = jsonb_build_object('vol', a.vol, 'pnl', a.pnl, 'roi', a.roi, 'n', a.ntr),
    s2 = jsonb_build_object('vol', b.vol, 'pnl', b.pnl, 'roi', b.roi, 'n', b.ntr)
  where id = p_id;
end $$;

create or replace function yr_rduel_tick(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update yr_rduels set status = 'expired' where id = p_id and status = 'open' and created_at < now() - interval '24 hours';
  perform yr_rduel_finish(p_id);
end $$;

-- service only: wallets to poll and coins to price, for yr-real
create or replace function yr_rduel_jobs() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object('rduel', d.id, 'slot', s.slot, 'wallet', s.w, 'last_sig', c.last_sig,
                                          'start', yr_ms(d.start_at), 'end', yr_ms(d.end_at)))
      from yr_rduels d
      cross join lateral (values (1::smallint, d.w1), (2::smallint, d.w2)) s(slot, w)
      left join yr_rcursor c on c.rduel = d.id and c.slot = s.slot
      where d.status = 'live' and d.start_at - interval '20 seconds' <= now() and d.end_at + interval '60 seconds' >= now()), '[]'::jsonb),
    'held', coalesce((
      select jsonb_agg(distinct h.mint) from (
        select t.mint from yr_rtrades t join yr_rduels d on d.id = t.rduel
        where d.status = 'live' and d.end_at + interval '60 seconds' >= now()
        group by t.rduel, t.slot, t.mint
        having sum(case when t.k = 1 then t.tok else -t.tok end) > 0) h), '[]'::jsonb))
$$;

revoke all on function yr_wallet_check(text) from public, anon, authenticated;
revoke all on function yr_wallet_link(uuid, text) from public, anon, authenticated;
revoke all on function yr_rscore(uuid) from public, anon, authenticated;
revoke all on function yr_rduel_finish(uuid) from public, anon, authenticated;
revoke all on function yr_rduel_tick(uuid) from public, anon, authenticated;
revoke all on function yr_rduel_jobs() from public, anon, authenticated;

-- ---------- player RPCs ----------
create or replace function yr_rduel_create(p_secret text, p_minutes int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; u yr_users; v_code text; d yr_rduels;
begin
  uid := yr_uid(p_secret);
  select * into u from yr_users where id = uid;
  if u.wallet is null then raise exception 'Verify a wallet first'; end if;
  if p_minutes not in (5, 15, 30, 60) then raise exception 'Pick 5, 15, 30 or 60 minutes'; end if;
  update yr_rduels set status = 'expired' where p1 = uid and status = 'open' and created_at < now() - interval '24 hours';
  if exists (select 1 from yr_rduels where status in ('open', 'live') and (p1 = uid or p2 = uid)) then
    raise exception 'You already have a real duel open';
  end if;
  loop
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from yr_rduels where code = v_code);
  end loop;
  insert into yr_rduels (code, p1, w1, dur_ms) values (v_code, uid, u.wallet, p_minutes * 60000) returning * into d;
  return jsonb_build_object('id', d.id, 'code', d.code);
end $$;

create or replace function yr_rduel_accept(p_secret text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; u yr_users; d yr_rduels;
begin
  uid := yr_uid(p_secret);
  select * into u from yr_users where id = uid;
  if u.wallet is null then raise exception 'Verify a wallet first'; end if;
  select * into d from yr_rduels where code = lower(trim(p_code)) for update;
  if not found then raise exception 'Challenge not found'; end if;
  if d.status <> 'open' or d.created_at < now() - interval '24 hours' then raise exception 'This challenge is no longer open'; end if;
  if d.p1 = uid then raise exception 'You cannot accept your own challenge'; end if;
  if d.w1 = u.wallet then raise exception 'Same wallet on both sides'; end if;
  if exists (select 1 from yr_rduels where status in ('open', 'live') and (p1 = uid or p2 = uid)) then
    raise exception 'Finish your other real duel first';
  end if;
  update yr_rduels set p2 = uid, w2 = u.wallet, status = 'live',
    start_at = date_trunc('second', now()) + interval '45 seconds',
    end_at = date_trunc('second', now()) + interval '45 seconds' + make_interval(secs => dur_ms / 1000.0)
  where id = d.id;
  return jsonb_build_object('id', d.id, 'code', d.code);
end $$;

create or replace function yr_rduel_cancel(p_secret text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  update yr_rduels set status = 'cancelled' where code = lower(trim(p_code)) and p1 = uid and status = 'open';
  return jsonb_build_object('ok', true);
end $$;

create or replace function yr_rduel_get(p_code text, p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d yr_rduels; uid uuid; me int; sc jsonb;
begin
  select * into d from yr_rduels where code = lower(trim(p_code));
  if not found then raise exception 'Challenge not found'; end if;
  perform yr_rduel_tick(d.id);
  select * into d from yr_rduels where id = d.id;
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  me := case when uid is null then null when uid = d.p1 then 1 when uid = d.p2 then 2 end;
  if d.status = 'done' then
    sc := jsonb_build_array(d.s1, d.s2);
  else
    select jsonb_agg(jsonb_build_object('vol', s.vol, 'pnl', s.pnl, 'roi', s.roi, 'n', s.ntr) order by s.slot) into sc from yr_rscore(d.id) s;
  end if;
  return jsonb_build_object(
    'id', d.id, 'code', d.code, 'status', d.status, 'now', yr_now(), 'created', yr_ms(d.created_at),
    'start', case when d.start_at is not null then yr_ms(d.start_at) end,
    'end', case when d.end_at is not null then yr_ms(d.end_at) end,
    'dur_ms', d.dur_ms, 'me', me, 'winner', d.winner, 'elo', jsonb_build_array(d.elo1, d.elo2),
    'p1', (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'wallet', d.w1, 'rw', u.r_won, 'rp', u.r_played)
           from yr_users u where u.id = d.p1),
    'p2', (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'wallet', d.w2, 'rw', u.r_won, 'rp', u.r_played)
           from yr_users u where u.id = d.p2),
    'score', sc,
    'polled', (select jsonb_object_agg(c.slot, yr_ms(c.polled_at)) from yr_rcursor c where c.rduel = d.id),
    'trades', coalesce((select jsonb_agg(jsonb_build_array(t.slot, t.mint, t.k, round(t.sol::numeric, 4), t.tok, yr_ms(t.at), t.sig) order by t.at, t.ix)
                        from yr_rtrades t where t.rduel = d.id), '[]'::jsonb),
    'mints', coalesce((select jsonb_object_agg(m.mint, jsonb_build_object(
                         'px', mk.vsol / nullif(mk.vtok, 0),
                         'name', c.name, 'symbol', c.symbol))
                       from (select distinct t.mint from yr_rtrades t where t.rduel = d.id) m
                       left join yr_rmarks mk on mk.mint = m.mint
                       left join yr_coins c on c.mint = m.mint and c.status <> 'nsfw'), '{}'::jsonb)
  );
end $$;

-- open challenges, live real duels and the latest results
create or replace function yr_rduel_board(p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; mine jsonb;
begin
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  if uid is not null then
    select jsonb_build_object('code', d.code, 'status', d.status) into mine
    from yr_rduels d where (d.p1 = uid or d.p2 = uid) and d.status in ('open', 'live')
    order by d.created_at desc limit 1;
  end if;
  return jsonb_build_object(
    'now', yr_now(),
    'mine', mine,
    'open', coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'name', u.handle, 'avatar', u.avatar, 'elo', u.elo,
                                                          'rw', u.r_won, 'rp', u.r_played, 'dur_ms', d.dur_ms, 'created', yr_ms(d.created_at))
                                       order by d.created_at desc)
                      from (select * from yr_rduels where status = 'open' and created_at > now() - interval '24 hours'
                            order by created_at desc limit 20) d
                      join yr_users u on u.id = d.p1), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'n1', u1.handle, 'a1', u1.avatar, 'n2', u2.handle, 'a2', u2.avatar,
                                                          'start', yr_ms(d.start_at), 'end', yr_ms(d.end_at)) order by d.start_at desc)
                      from yr_rduels d join yr_users u1 on u1.id = d.p1 join yr_users u2 on u2.id = d.p2
                      where d.status = 'live'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by x.end_ms desc) from (
                        select d.code, u1.handle n1, u1.avatar a1, u2.handle n2, u2.avatar a2, d.winner,
                               d.s1 -> 'roi' r1, d.s2 -> 'roi' r2, yr_ms(d.end_at) end_ms
                        from yr_rduels d join yr_users u1 on u1.id = d.p1 join yr_users u2 on u2.id = d.p2
                        where d.status = 'done' order by d.end_at desc limit 10) x), '[]'::jsonb)
  );
end $$;

grant execute on function yr_wallet_nonce(text), yr_rduel_create(text, int), yr_rduel_accept(text, text), yr_rduel_cancel(text, text),
  yr_rduel_get(text, text), yr_rduel_board(text) to anon, authenticated;

-- a player's latest practice duels, for the profile page
create or replace function yr_my_duels(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  return coalesce((select jsonb_agg(x order by x.ended desc) from (
    select d.id, yr_ms(coalesce(d.ended_at, d.created_at)) ended,
      case when d.p1 = uid then 1 else 2 end me, d.score1 s1, d.score2 s2, d.winner,
      case when d.p1 = uid then d.elo1 else d.elo2 end delta,
      case when d.p1 = uid then coalesce(u2.handle, d.ghost ->> 'name') else u1.handle end opp,
      case when d.p1 = uid then coalesce(u2.avatar, d.ghost -> 'avatar') else u1.avatar end opp_avatar,
      d.p2 is null ghost
    from yr_duels d
    join yr_users u1 on u1.id = d.p1
    left join yr_users u2 on u2.id = d.p2
    where (d.p1 = uid or d.p2 = uid) and d.status = 'done'
    order by d.ended_at desc nulls last
    limit 15) x), '[]'::jsonb);
end $$;
grant execute on function yr_my_duels(text) to anon, authenticated;
