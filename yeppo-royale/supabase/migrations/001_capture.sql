-- yeppo royale: library of real pump.fun launches, captured live from PumpPortal.
-- Raw events are private (RLS on, no policies): players only ever see them through
-- the time-gated match feed, so nobody can peek at a coin's future.

create table if not exists yr_config (
  key text primary key,
  value text not null
);
alter table yr_config enable row level security;

create table if not exists yr_coins (
  id serial primary key,
  mint text unique not null,
  name text,
  symbol text,
  uri text,
  created_ms bigint not null,      -- unix ms when the create tx was seen
  sol_usd numeric,                 -- SOL price at capture, for USD market caps
  twitter text,
  telegram text,
  website text,
  description text,
  meta_ok boolean not null default false,
  migrated_t int,                  -- ms after creation when it graduated, if it did
  n_events int not null default 0,
  last_t int not null default 0,   -- ms after creation of the last captured event
  status text not null default 'raw',   -- raw | ok | rejected
  outcome text,                    -- runner | rug | bleed | mid
  stats jsonb
);
alter table yr_coins enable row level security;

create table if not exists yr_events (
  coin_id int not null references yr_coins(id) on delete cascade,
  seq int not null,
  t int not null,                  -- ms after creation
  w int not null,                  -- wallet index within the coin, 0 = creator
  k smallint not null,             -- 0 create, 1 buy, 2 sell
  sol real not null,
  tok real not null,
  bal real,                        -- wallet token balance after the trade
  mc real not null,                -- market cap in SOL after the trade
  vsol real,                       -- virtual SOL in the bonding curve
  primary key (coin_id, seq)
);
create index if not exists yr_events_coin_t on yr_events (coin_id, t);
alter table yr_events enable row level security;

-- ingest: called by the recorder with the key stored in yr_config('ingest_key')
create or replace function yr_ingest(p_key text, p_coins jsonb, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_c int := 0;
  n_e int := 0;
begin
  if p_key is null or p_key <> (select value from yr_config where key = 'ingest_key') then
    raise exception 'bad key';
  end if;

  insert into yr_coins as c (mint, name, symbol, uri, created_ms, sol_usd, twitter, telegram, website, description, meta_ok, migrated_t)
  select x->>'mint', x->>'name', x->>'symbol', x->>'uri', (x->>'created_ms')::bigint, (x->>'sol_usd')::numeric,
         x->>'twitter', x->>'telegram', x->>'website', left(x->>'description', 400),
         coalesce((x->>'meta_ok')::boolean, false), (x->>'migrated_t')::int
  from jsonb_array_elements(coalesce(p_coins, '[]'::jsonb)) x
  on conflict (mint) do update set
    twitter = coalesce(excluded.twitter, c.twitter),
    telegram = coalesce(excluded.telegram, c.telegram),
    website = coalesce(excluded.website, c.website),
    description = coalesce(excluded.description, c.description),
    meta_ok = c.meta_ok or excluded.meta_ok,
    migrated_t = coalesce(c.migrated_t, excluded.migrated_t);
  get diagnostics n_c = row_count;

  insert into yr_events (coin_id, seq, t, w, k, sol, tok, bal, mc, vsol)
  select c.id, (e->>1)::int, (e->>2)::int, (e->>3)::int, (e->>4)::smallint, (e->>5)::real, (e->>6)::real,
         nullif(e->>7, '')::real, (e->>8)::real, nullif(e->>9, '')::real
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
  join yr_coins c on c.mint = e->>0
  on conflict do nothing;
  get diagnostics n_e = row_count;

  update yr_coins c set n_events = s.n, last_t = s.mx
  from (
    select ev.coin_id, count(*) n, max(ev.t) mx from yr_events ev
    where ev.coin_id in (select c2.id from yr_coins c2 where c2.mint in (select distinct e->>0 from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e))
    group by ev.coin_id
  ) s
  where c.id = s.coin_id;

  return jsonb_build_object('coins', n_c, 'events', n_e);
end;
$$;
revoke all on function yr_ingest(text, jsonb, jsonb) from public;
grant execute on function yr_ingest(text, jsonb, jsonb) to anon;
