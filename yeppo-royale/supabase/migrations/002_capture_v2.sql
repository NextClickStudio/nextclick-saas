-- Capture moves into the yr-capture edge function (pg_cron, every minute).
-- Additive only: yr_events keeps its shape, with seq = hash of the tx signature
-- (so replays of the same trade are ignored) and w = hash of the wallet.

alter table yr_coins add column if not exists creator_h int;
alter table yr_coins add column if not exists init_mc real;

-- one capture run at a time
insert into yr_config (key, value) values ('capture_lease', '0') on conflict do nothing;
create or replace function yr_take_lease(p_ms int)
returns boolean language plpgsql security definer set search_path = public as $$
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  update yr_config set value = (now_ms + p_ms)::text
  where key = 'capture_lease' and value::bigint < now_ms;
  return found;
end $$;
revoke all on function yr_take_lease(int) from public, anon, authenticated;

-- p_coins: [{mint,name,symbol,uri,created_ms,sol_usd,creator_h,init_mc}]
-- p_events: [[mint,seq,t,w,k,sol,tok,bal,mc,vsol], ...]
-- p_meta: [{mint,twitter,telegram,website,description}]
-- p_migr: [{mint,t}]
create or replace function yr_capture_flush(p_coins jsonb, p_events jsonb, p_meta jsonb, p_migr jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n_c int; n_e int;
begin
  insert into yr_coins (mint, name, symbol, uri, created_ms, sol_usd, creator_h, init_mc)
  select x->>'mint', left(x->>'name', 64), left(x->>'symbol', 24), x->>'uri', (x->>'created_ms')::bigint,
         (x->>'sol_usd')::numeric, (x->>'creator_h')::int, (x->>'init_mc')::real
  from jsonb_array_elements(coalesce(p_coins, '[]')) x
  on conflict (mint) do nothing;
  get diagnostics n_c = row_count;

  insert into yr_events (coin_id, seq, t, w, k, sol, tok, bal, mc, vsol)
  select c.id, (e->>1)::int, (e->>2)::int, (e->>3)::int, (e->>4)::smallint, (e->>5)::real, (e->>6)::real,
         nullif(e->>7, '')::real, (e->>8)::real, nullif(e->>9, '')::real
  from jsonb_array_elements(coalesce(p_events, '[]')) e
  join yr_coins c on c.mint = e->>0
  on conflict do nothing;
  get diagnostics n_e = row_count;

  update yr_coins c set twitter = m->>'twitter', telegram = m->>'telegram', website = m->>'website',
         description = left(m->>'description', 400), meta_ok = true
  from jsonb_array_elements(coalesce(p_meta, '[]')) m where c.mint = m->>'mint';

  update yr_coins c set migrated_t = coalesce(c.migrated_t, (m->>'t')::int)
  from jsonb_array_elements(coalesce(p_migr, '[]')) m where c.mint = m->>'mint';

  update yr_coins c set n_events = s.n, last_t = s.mx
  from (
    select ev.coin_id, count(*) n, max(ev.t) mx from yr_events ev
    where ev.coin_id in (select c2.id from yr_coins c2 where c2.mint in (select distinct e->>0 from jsonb_array_elements(coalesce(p_events, '[]')) e))
    group by ev.coin_id
  ) s where c.id = s.coin_id;

  return jsonb_build_object('coins', n_c, 'events', n_e);
end $$;
revoke all on function yr_capture_flush(jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
