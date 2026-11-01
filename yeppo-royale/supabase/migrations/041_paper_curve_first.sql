-- A coin still trading on pump.fun's curve is priced (and charged the curve's fees) from its own last trade when
-- that trade is under 30 s old, even when a DexScreener price is a little newer.
create or replace function yr_paper_curve(p_mint text, out vsol double precision, out vtok double precision, out t bigint, out src text)
returns record language sql stable security definer set search_path = public as $$
  select * from (
    (select x.vsol, x.vtok, x.t, 'curve'::text src from yr_ticks x
     where x.mint = p_mint and x.t > yr_now() - 1200000 and x.vsol > 0 and x.vtok > 0
     order by x.t desc limit 1)
    union all
    (select p.liq, p.liq / p.mc * 1e9, p.t, 'pool'::text from yr_px p where p.mint = p_mint and p.t > yr_now() - 120000)
  ) z order by (z.src = 'curve' and z.t > yr_now() - 30000) desc, z.t desc limit 1
$$;
