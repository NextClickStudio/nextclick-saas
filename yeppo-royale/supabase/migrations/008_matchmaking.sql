-- yeppo 1v1: real duels for everyone.
--  * matchmaking: press Find and get paired with a player who wants the same duel length. If nobody
--    shows up, a live trader takes the other side: a real pump.fun wallet that is trading right now.
--  * trading wallets: the wallets trading apps create for you (Axiom, GMGN, Photon, BullX, Padre...),
--    linked to your profile with a tiny transfer to your verified wallet. Their trades count too.
-- Additive: new tables and columns, functions replaced in place.

-- wallets the capture saw trading pump.fun in the last minute (raw addresses, refreshed every few seconds)
create table if not exists yr_hot_wallets (
  address text primary key,
  n int not null,
  buys int not null,
  vol double precision not null,
  coins int not null,
  last_at timestamptz not null default now()
);
alter table yr_hot_wallets enable row level security;

create table if not exists yr_rqueue (
  user_id uuid primary key references yr_users(id) on delete cascade,
  dur_ms int not null,
  elo int not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
alter table yr_rqueue enable row level security;

create table if not exists yr_twallets (
  user_id uuid not null references yr_users(id) on delete cascade,
  address text not null,
  label text,
  status text not null default 'pending',   -- pending | ok
  lamports bigint not null,                 -- the proof: send exactly this much to your verified wallet
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  primary key (user_id, address)
);
create unique index if not exists yr_twallets_one_owner on yr_twallets (address) where status = 'ok';
alter table yr_twallets enable row level security;

-- one cursor per tracked wallet (a player can bring several)
create table if not exists yr_rcursor2 (
  rduel uuid not null references yr_rduels(id) on delete cascade,
  slot smallint not null,
  wallet text not null,
  last_sig text,
  polled_at timestamptz,
  primary key (rduel, slot, wallet)
);
alter table yr_rcursor2 enable row level security;

alter table yr_rduels add column if not exists x1 text[] not null default '{}';
alter table yr_rduels add column if not exists x2 text[] not null default '{}';
alter table yr_rduels add column if not exists ghost jsonb;   -- {name, wallet, n, vol} when slot 2 is a live trader
alter table yr_rduels add column if not exists kind text not null default 'challenge';  -- challenge | match | ghost

-- ---------- helpers ----------
create or replace function yr_rcode() returns text
language plpgsql volatile security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 6);
    exit when not exists (select 1 from yr_rduels where code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function yr_twallet_list(p_user uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(address order by verified_at), '{}') from yr_twallets where user_id = p_user and status = 'ok'
$$;

-- ---------- scoring ----------
create or replace function yr_rduel_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d yr_rduels; a record; b record; ok1 boolean; ok2 boolean; v_win smallint; e1 int; e2 int; ex double precision; res double precision;
        d1 int; kf int;
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
  res := case v_win when 1 then 1 when 2 then 0 else 0.5 end;
  select elo into e1 from yr_users where id = d.p1;
  if d.p2 is null then
    -- a live trader: half the stakes, picked to be a fair fight
    kf := 16;
    ex := 0.5;
  else
    select elo into e2 from yr_users where id = d.p2;
    kf := 24;
    ex := 1 / (1 + power(10, (e2 - e1) / 400.0));
  end if;
  d1 := round(kf * (res - ex));
  update yr_users set elo = greatest(100, elo + d1), r_played = r_played + 1, r_won = r_won + (v_win = 1)::int,
    best_roi = case when ok1 then greatest(coalesce(best_roi, -1e9), a.roi) else best_roi end, xp = xp + case v_win when 1 then 250 else 80 end
  where id = d.p1;
  if d.p2 is not null then
    update yr_users set elo = greatest(100, elo - d1), r_played = r_played + 1, r_won = r_won + (v_win = 2)::int,
      best_roi = case when ok2 then greatest(coalesce(best_roi, -1e9), b.roi) else best_roi end, xp = xp + case v_win when 2 then 250 else 80 end
    where id = d.p2;
  end if;
  update yr_rduels set status = 'done', winner = v_win, elo1 = d1, elo2 = case when d.p2 is null then null else -d1 end,
    s1 = jsonb_build_object('vol', a.vol, 'pnl', a.pnl, 'roi', a.roi, 'n', a.ntr),
    s2 = jsonb_build_object('vol', b.vol, 'pnl', b.pnl, 'roi', b.roi, 'n', b.ntr)
  where id = p_id;
end $$;

-- service only: wallets to poll, coins to price and trading wallets waiting for their proof, for yr-real
create or replace function yr_rduel_jobs() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object('rduel', d.id, 'slot', s.slot, 'wallet', s.w,
                                          'last_sig', coalesce(c2.last_sig, c.last_sig),
                                          'start', yr_ms(d.start_at), 'end', yr_ms(d.end_at)))
      from yr_rduels d
      cross join lateral (
        select 1::smallint slot, d.w1 w
        union select 1::smallint, x from unnest(d.x1) x
        union select 2::smallint, d.w2 where d.w2 is not null
        union select 2::smallint, x from unnest(d.x2) x) s
      left join yr_rcursor2 c2 on c2.rduel = d.id and c2.slot = s.slot and c2.wallet = s.w
      left join yr_rcursor c on c.rduel = d.id and c.slot = s.slot and s.w = case s.slot when 1 then d.w1 else d.w2 end
      where d.status = 'live' and d.start_at - interval '20 seconds' <= now() and d.end_at + interval '60 seconds' >= now()), '[]'::jsonb),
    'held', coalesce((
      select jsonb_agg(distinct h.mint) from (
        select t.mint from yr_rtrades t join yr_rduels d on d.id = t.rduel
        where d.status = 'live' and d.end_at + interval '60 seconds' >= now()
        group by t.rduel, t.slot, t.mint
        having sum(case when t.k = 1 then t.tok else -t.tok end) > 0) h), '[]'::jsonb),
    'twallets', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', t.user_id, 'address', t.address, 'to', u.wallet, 'lamports', t.lamports, 'since', yr_ms(t.created_at)))
      from yr_twallets t join yr_users u on u.id = t.user_id
      where t.status = 'pending' and t.created_at > now() - interval '30 minutes' and u.wallet is not null), '[]'::jsonb))
$$;

-- service only: the proof landed on-chain
create or replace function yr_twallet_ok(p_user uuid, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from yr_twallets where address = p_address and status = 'ok' and user_id <> p_user) then
    raise exception 'This wallet is linked to another profile';
  end if;
  update yr_twallets set status = 'ok', verified_at = now() where user_id = p_user and address = p_address and status = 'pending';
  delete from yr_twallets where address = p_address and status = 'pending' and user_id <> p_user;
  return jsonb_build_object('ok', true);
end $$;

-- service only: a player's pending proofs, for the "check now" button
create or replace function yr_twallet_pending(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', t.user_id, 'address', t.address, 'to', u.wallet, 'lamports', t.lamports, 'since', yr_ms(t.created_at)))
    from yr_twallets t join yr_users u on u.id = t.user_id
    where t.user_id = uid and t.status = 'pending' and t.created_at > now() - interval '30 minutes' and u.wallet is not null), '[]'::jsonb);
end $$;

revoke all on function yr_rcode() from public, anon, authenticated;
revoke all on function yr_twallet_list(uuid) from public, anon, authenticated;
revoke all on function yr_rduel_finish(uuid) from public, anon, authenticated;
revoke all on function yr_rduel_jobs() from public, anon, authenticated;
revoke all on function yr_twallet_ok(uuid, text) from public, anon, authenticated;
revoke all on function yr_twallet_pending(text) from public, anon, authenticated;

-- a main wallet cannot be someone else's trading wallet either
create or replace function yr_wallet_link(p_user uuid, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u yr_users;
begin
  if exists (select 1 from yr_users where wallet = p_address and id <> p_user)
     or exists (select 1 from yr_twallets where address = p_address and status = 'ok' and user_id <> p_user) then
    raise exception 'This wallet is linked to another profile';
  end if;
  if exists (select 1 from yr_rduels where status in ('open', 'live') and (p1 = p_user or p2 = p_user)) then
    raise exception 'Finish your real duel before changing wallets';
  end if;
  update yr_users set wallet = p_address where id = p_user returning * into u;
  delete from yr_wallet_nonce where user_id = p_user;
  delete from yr_twallets where user_id = p_user and address = p_address;
  return to_jsonb(u);
end $$;
revoke all on function yr_wallet_link(uuid, text) from public, anon, authenticated;

-- ---------- trading wallets ----------
create or replace function yr_twallets(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  delete from yr_twallets where user_id = uid and status = 'pending' and created_at < now() - interval '30 minutes';
  return coalesce((select jsonb_agg(jsonb_build_object('address', address, 'label', label, 'status', status,
                                                       'sol', lamports / 1e9, 'created', yr_ms(created_at),
                                                       'expires', yr_ms(created_at + interval '30 minutes'))
                                    order by created_at)
                   from yr_twallets where user_id = uid), '[]'::jsonb);
end $$;

create or replace function yr_twallet_add(p_secret text, p_address text, p_label text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; u yr_users; v_addr text := trim(p_address); v_lam bigint;
begin
  uid := yr_uid(p_secret);
  select * into u from yr_users where id = uid;
  if u.wallet is null then raise exception 'Verify your main wallet first'; end if;
  if v_addr !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'That is not a Solana address'; end if;
  if v_addr = u.wallet then raise exception 'That is already your verified wallet'; end if;
  if exists (select 1 from yr_twallets where address = v_addr and status = 'ok') or exists (select 1 from yr_users where wallet = v_addr) then
    raise exception 'This wallet is already linked to a profile';
  end if;
  if (select count(*) from yr_twallets where user_id = uid and status = 'ok') >= 4 then raise exception 'Four trading wallets at most'; end if;
  -- 0.00100 to 0.00199 SOL, in steps of 0.00001
  v_lam := (100 + floor(random() * 100)::int) * 10000;
  insert into yr_twallets (user_id, address, label, lamports)
  values (uid, v_addr, nullif(left(trim(coalesce(p_label, '')), 20), ''), v_lam)
  on conflict (user_id, address) do update set lamports = case when yr_twallets.status = 'ok' then yr_twallets.lamports else excluded.lamports end,
    label = coalesce(excluded.label, yr_twallets.label),
    created_at = case when yr_twallets.status = 'ok' then yr_twallets.created_at else now() end;
  return yr_twallets(p_secret);
end $$;

create or replace function yr_twallet_remove(p_secret text, p_address text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  delete from yr_twallets where user_id = uid and address = trim(p_address);
  return yr_twallets(p_secret);
end $$;

-- ---------- matchmaking ----------
-- press Find: back to your live duel, else paired with someone waiting for the same length,
-- else in the queue; after 25 seconds alone (or right away with p_ghost) a live trader takes the other side
create or replace function yr_rduel_find(p_secret text, p_minutes int, p_ghost boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; u yr_users; o yr_users; d yr_rduels; q yr_rqueue; v_dur int; g yr_hot_wallets; xs text[];
begin
  uid := yr_uid(p_secret);
  select * into u from yr_users where id = uid;
  if u.wallet is null then raise exception 'Verify a wallet first'; end if;
  if p_minutes not in (5, 10, 15) then raise exception 'Pick 5, 10 or 15 minutes'; end if;
  v_dur := p_minutes * 60000;
  update yr_users set last_seen = now() where id = uid;
  -- one matchmaker at a time, so two players never pair with each other twice
  perform pg_advisory_xact_lock(hashtext('yr_rduel_find'));
  select * into d from yr_rduels where (p1 = uid or p2 = uid) and status = 'live' order by created_at desc limit 1;
  if found then
    delete from yr_rqueue where user_id = uid;
    return jsonb_build_object('status', 'live', 'code', d.code);
  end if;
  if exists (select 1 from yr_rduels where p1 = uid and status = 'open') then
    raise exception 'Cancel your open challenge first';
  end if;
  xs := yr_twallet_list(uid);

  select * into q from yr_rqueue r
  where r.user_id <> uid and r.dur_ms = v_dur and r.seen_at > now() - interval '8 seconds'
  order by abs(r.elo - u.elo), r.created_at
  limit 1 for update skip locked;
  if found then
    select * into o from yr_users where id = q.user_id;
    if o.wallet is not null and o.wallet <> u.wallet then
      insert into yr_rduels (code, kind, p1, w1, x1, p2, w2, x2, dur_ms, status, start_at, end_at)
      values (yr_rcode(), 'match', o.id, o.wallet, yr_twallet_list(o.id), uid, u.wallet, xs, v_dur, 'live',
        date_trunc('second', now()) + interval '30 seconds',
        date_trunc('second', now()) + interval '30 seconds' + make_interval(secs => v_dur / 1000.0))
      returning * into d;
      delete from yr_rqueue where user_id in (uid, o.id);
      return jsonb_build_object('status', 'live', 'code', d.code);
    end if;
  end if;

  insert into yr_rqueue (user_id, dur_ms, elo) values (uid, v_dur, u.elo)
  on conflict (user_id) do update set seen_at = now(), elo = excluded.elo, dur_ms = excluded.dur_ms,
    created_at = case when yr_rqueue.dur_ms = excluded.dur_ms then yr_rqueue.created_at else now() end
  returning * into q;

  if p_ghost or q.created_at < now() - interval '25 seconds' then
    select * into g from yr_hot_wallets h
    where h.last_at > now() - interval '75 seconds' and h.n between 3 and 45 and h.coins >= 2
      and h.vol / h.n between 0.05 and 8
      and h.address <> u.wallet and not (h.address = any(xs))
      and not exists (select 1 from yr_users x where x.wallet = h.address)
      and not exists (select 1 from yr_twallets t where t.address = h.address)
    order by random() limit 1;
    if found then
      insert into yr_rduels (code, kind, p1, w1, x1, p2, w2, dur_ms, status, start_at, end_at, ghost)
      values (yr_rcode(), 'ghost', uid, u.wallet, xs, null, g.address, v_dur, 'live',
        date_trunc('second', now()) + interval '20 seconds',
        date_trunc('second', now()) + interval '20 seconds' + make_interval(secs => v_dur / 1000.0),
        jsonb_build_object('name', 'trader_' || left(g.address, 4), 'wallet', g.address, 'n', g.n, 'vol', round(g.vol::numeric, 2)))
      returning * into d;
      delete from yr_rqueue where user_id = uid;
      return jsonb_build_object('status', 'live', 'code', d.code, 'ghost', true);
    end if;
  end if;

  return jsonb_build_object('status', 'queue', 'waited', round(extract(epoch from now() - q.created_at) * 1000),
    'waiting', (select count(*) from yr_rqueue r where r.seen_at > now() - interval '8 seconds' and r.dur_ms = v_dur and r.user_id <> uid));
end $$;

create or replace function yr_rduel_leave(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  delete from yr_rqueue where user_id = yr_uid(p_secret);
  return jsonb_build_object('ok', true);
end $$;

-- a challenge accepted from a link also brings both players' trading wallets
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
  delete from yr_rqueue where user_id in (uid, d.p1);
  update yr_rduels set p2 = uid, w2 = u.wallet, x1 = yr_twallet_list(d.p1), x2 = yr_twallet_list(uid), status = 'live',
    start_at = date_trunc('second', now()) + interval '45 seconds',
    end_at = date_trunc('second', now()) + interval '45 seconds' + make_interval(secs => dur_ms / 1000.0)
  where id = d.id;
  return jsonb_build_object('id', d.id, 'code', d.code);
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
    'id', d.id, 'code', d.code, 'kind', d.kind, 'status', d.status, 'now', yr_now(), 'created', yr_ms(d.created_at),
    'start', case when d.start_at is not null then yr_ms(d.start_at) end,
    'end', case when d.end_at is not null then yr_ms(d.end_at) end,
    'dur_ms', d.dur_ms, 'me', me, 'winner', d.winner, 'elo', jsonb_build_array(d.elo1, d.elo2),
    'p1', (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'wallet', d.w1, 'extra', d.x1, 'rw', u.r_won, 'rp', u.r_played)
           from yr_users u where u.id = d.p1),
    'p2', case when d.p2 is null and d.ghost is not null then
            jsonb_build_object('name', d.ghost ->> 'name', 'wallet', d.w2, 'extra', '[]'::jsonb, 'ghost', true,
                               'n', d.ghost -> 'n', 'vol', d.ghost -> 'vol', 'elo', (select u.elo from yr_users u where u.id = d.p1))
          else (select jsonb_build_object('name', u.handle, 'avatar', u.avatar, 'elo', u.elo, 'wallet', d.w2, 'extra', d.x2, 'rw', u.r_won, 'rp', u.r_played)
                from yr_users u where u.id = d.p2) end,
    'score', sc,
    'polled', (select jsonb_object_agg(p.slot, p.at) from (
                 select c.slot, max(yr_ms(c.polled_at)) at from (
                   select slot, polled_at from yr_rcursor2 where rduel = d.id
                   union all select slot, polled_at from yr_rcursor where rduel = d.id) c
                 group by c.slot) p),
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

-- open challenges, players looking for a match, live real duels and the latest results
create or replace function yr_rduel_board(p_secret text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid; mine jsonb; inq jsonb;
begin
  if p_secret is not null then
    begin uid := yr_uid(p_secret); exception when others then uid := null; end;
  end if;
  if uid is not null then
    select jsonb_build_object('code', d.code, 'status', d.status) into mine
    from yr_rduels d where (d.p1 = uid or d.p2 = uid) and d.status in ('open', 'live')
    order by d.created_at desc limit 1;
    select jsonb_build_object('dur_ms', q.dur_ms, 'since', yr_ms(q.created_at)) into inq
    from yr_rqueue q where q.user_id = uid and q.seen_at > now() - interval '8 seconds';
  end if;
  return jsonb_build_object(
    'now', yr_now(),
    'mine', mine,
    'queue', inq,
    'searching', coalesce((select jsonb_object_agg(x.m, x.n) from (
                   select (dur_ms / 60000)::text m, count(*) n from yr_rqueue where seen_at > now() - interval '8 seconds' group by dur_ms) x), '{}'::jsonb),
    'traders', (select count(*) from yr_hot_wallets where last_at > now() - interval '75 seconds'),
    'open', coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'name', u.handle, 'avatar', u.avatar, 'elo', u.elo,
                                                          'rw', u.r_won, 'rp', u.r_played, 'dur_ms', d.dur_ms, 'created', yr_ms(d.created_at))
                                       order by d.created_at desc)
                      from (select * from yr_rduels where status = 'open' and created_at > now() - interval '24 hours'
                            order by created_at desc limit 20) d
                      join yr_users u on u.id = d.p1), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'n1', u1.handle, 'a1', u1.avatar,
                                                          'n2', coalesce(u2.handle, d.ghost ->> 'name'), 'a2', u2.avatar, 'ghost', d.p2 is null,
                                                          'start', yr_ms(d.start_at), 'end', yr_ms(d.end_at)) order by d.start_at desc)
                      from yr_rduels d join yr_users u1 on u1.id = d.p1 left join yr_users u2 on u2.id = d.p2
                      where d.status = 'live'), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(x order by x.end_ms desc) from (
                        select d.code, u1.handle n1, u1.avatar a1, coalesce(u2.handle, d.ghost ->> 'name') n2, u2.avatar a2, d.p2 is null ghost,
                               d.winner, d.s1 -> 'roi' r1, d.s2 -> 'roi' r2, yr_ms(d.end_at) end_ms
                        from yr_rduels d join yr_users u1 on u1.id = d.p1 left join yr_users u2 on u2.id = d.p2
                        where d.status = 'done' order by d.end_at desc limit 10) x), '[]'::jsonb)
  );
end $$;

grant execute on function yr_twallets(text), yr_twallet_add(text, text, text), yr_twallet_remove(text, text),
  yr_rduel_find(text, int, boolean), yr_rduel_leave(text), yr_rduel_accept(text, text), yr_rduel_get(text, text), yr_rduel_board(text)
  to anon, authenticated;
