-- yeppo 1v1: every pump.fun trade, live, for the terminal.
-- PumpPortal's free socket no longer streams the trades of a coin (that needs a funded API key), so the
-- capture writes every TradeEvent it reads from the chain here, about once a second, and the terminal
-- polls the coins on screen. Kept 20 minutes. Additive.

create table if not exists yr_ticks (
  sig text not null,
  ix smallint not null default 0,
  mint text not null,
  t bigint not null,                 -- ms, when the capture saw it
  k smallint not null,               -- 1 buy, 2 sell
  sol real not null,
  tok real not null,
  vsol double precision not null,
  vtok double precision not null,
  who text,                          -- the trader's public address
  primary key (sig, ix)
);
create index if not exists yr_ticks_mint_t on yr_ticks (mint, t);
create index if not exists yr_ticks_t on yr_ticks (t);
alter table yr_ticks enable row level security;

-- trades of up to 60 coins, oldest first: the ones newer than p_since (ms, the capture's clock), or with
-- no p_since the latest 1500 (a coin's recent history)
create or replace function yr_ticks(p_mints text[], p_since bigint default 0) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'now', yr_now(),
    'ticks', coalesce((
      select jsonb_agg(jsonb_build_array(x.mint, x.t, x.k, x.sol, x.tok, x.vsol, x.vtok, x.who, x.sig) order by x.t)
      from (
        (select * from yr_ticks
         where coalesce(p_since, 0) > 0 and mint = any(p_mints[1:60]) and t > greatest(p_since, yr_now() - 1200000)
         order by t
         limit 1500)
        union all
        (select * from yr_ticks
         where coalesce(p_since, 0) <= 0 and mint = any(p_mints[1:60]) and t > yr_now() - 1200000
         order by t desc
         limit 1500)) x), '[]'::jsonb))
$$;

grant execute on function yr_ticks(text[], bigint) to anon, authenticated;
