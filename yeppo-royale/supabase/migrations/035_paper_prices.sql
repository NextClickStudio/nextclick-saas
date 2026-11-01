-- Paper trades on coins past pump.fun's curve. yeppo only sees curve trades, so a graduated coin had "no live
-- price". The yr-px edge function now reads the coin's pool from DexScreener (free, public) and keeps it here; the
-- paper wallet prices those coins on a constant-product pool of the same depth. Only the function (service role)
-- writes: anyone can ask for a refresh, nobody can set a price.

create table if not exists yr_px (
  mint text primary key,
  mc double precision not null,   -- market cap, SOL
  liq double precision not null,  -- SOL side of the pool
  t bigint not null
);
alter table yr_px enable row level security;

-- the live curve when yeppo saw a trade in the last 20 minutes, else the pool DexScreener reported in the last 2
create or replace function yr_paper_curve(p_mint text, out vsol double precision, out vtok double precision, out t bigint)
returns record language sql stable security definer set search_path = public as $$
  select * from (
    (select x.vsol, x.vtok, x.t from yr_ticks x
     where x.mint = p_mint and x.t > yr_now() - 1200000 and x.vsol > 0 and x.vtok > 0
     order by x.t desc limit 1)
    union all
    (select p.liq, p.liq / p.mc * 1e9, p.t from yr_px p where p.mint = p_mint and p.t > yr_now() - 120000)
  ) z order by z.t desc limit 1
$$;
