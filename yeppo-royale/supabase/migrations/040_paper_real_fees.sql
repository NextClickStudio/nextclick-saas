-- Paper trades with the fees a real trade pays (pump.fun fee schedule, May 2026; typical terminal fees):
--   * the venue: 1.25% on pump.fun's curve (0.95% protocol + 0.30% creator), about 0.30% on PumpSwap once graduated;
--   * the trading terminal (Axiom, GMGN, Photon, BullX): about 1% a trade;
--   * the network: priority fee and tip, about 0.002 SOL a transaction.
-- Price impact is already in the maths: buys and sells walk the curve, or a pool of the coin's real depth.
-- yr_paper_curve now says which venue the price comes from.

drop function if exists yr_paper_curve(text);
create function yr_paper_curve(p_mint text, out vsol double precision, out vtok double precision, out t bigint, out src text)
returns record language sql stable security definer set search_path = public as $$
  select * from (
    (select x.vsol, x.vtok, x.t, 'curve'::text from yr_ticks x
     where x.mint = p_mint and x.t > yr_now() - 1200000 and x.vsol > 0 and x.vtok > 0
     order by x.t desc limit 1)
    union all
    (select p.liq, p.liq / p.mc * 1e9, p.t, 'pool'::text from yr_px p where p.mint = p_mint and p.t > yr_now() - 120000)
  ) z order by z.t desc limit 1
$$;

-- share of each trade lost to fees, by venue
create or replace function yr_paper_fee(p_src text) returns double precision language sql immutable as $$
  select case when p_src = 'pool' then 0.003 else 0.0125 end + 0.01
$$;
-- the network, per transaction, in SOL
create or replace function yr_paper_netfee() returns double precision language sql immutable as $$ select 0.002::double precision $$;

create or replace function yr_paper_buy(p_acct uuid, p_mint text, p_sol double precision, p_tp real default null, p_stop real default null, p_minutes real default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a yr_paper_acct; c record; x double precision; got double precision; mc double precision; now_ms bigint := yr_now(); sym text;
begin
  select * into a from yr_paper_acct where id = p_acct for update;
  if not found then raise exception 'Unknown paper wallet'; end if;
  if p_sol is null or p_sol < 0.01 or p_sol > 100 then raise exception 'Buy between 0.01 and 100 SOL'; end if;
  if a.sol < p_sol then raise exception 'Not enough paper SOL'; end if;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is null then raise exception 'No live price for this coin right now. Try again in a moment'; end if;
  if c.t < now_ms - 30000 and c.src = 'curve' then
    raise exception 'The last trade yeppo saw on this coin was % s ago: no live price, try again in a moment', (now_ms - c.t) / 1000;
  end if;
  x := p_sol * (1 - yr_paper_fee(c.src)) - yr_paper_netfee();
  if x <= 0 then raise exception 'Too small: the fees would eat it all'; end if;
  got := c.vtok - c.vsol * c.vtok / (c.vsol + x);
  mc := c.vsol / c.vtok * 1e9;
  select coalesce(b.symbol, cc.sym) into sym from (select 1) z left join yr_obirth b on b.mint = p_mint left join yr_cc cc on cc.mint = p_mint;
  update yr_paper_acct set sol = sol - p_sol where id = p_acct;
  insert into yr_paper_pos as p (acct, mint, symbol, tok, cost, mc0, opened_at, tp, stop, until_t)
  values (p_acct, p_mint, sym, got, p_sol, mc, now_ms, p_tp, p_stop, case when p_minutes > 0 then now_ms + (p_minutes * 60000)::bigint end)
  on conflict (acct, mint) do update set
    tok = p.tok + excluded.tok, cost = p.cost + excluded.cost,
    mc0 = (p.cost + excluded.cost) / (p.cost / p.mc0 + excluded.cost / excluded.mc0),
    tp = coalesce(excluded.tp, p.tp), stop = coalesce(excluded.stop, p.stop), until_t = coalesce(excluded.until_t, p.until_t);
  insert into yr_paper_fill (acct, mint, symbol, side, sol, tok, mc, reason, at) values (p_acct, p_mint, sym, 1, p_sol, got, mc, 'buy', now_ms);
  return jsonb_build_object('tok', got, 'mc', mc, 'fees', p_sol - x);
end $$;

create or replace function yr_paper_sell(p_acct uuid, p_mint text, p_frac double precision default 1, p_reason text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare p yr_paper_pos; c record; q double precision; out_sol double precision := 0; mc double precision := 0; f double precision; part double precision;
begin
  select * into p from yr_paper_pos where acct = p_acct and mint = p_mint for update;
  if not found then raise exception 'No paper position in this coin'; end if;
  f := least(greatest(coalesce(p_frac, 1), 0.01), 1);
  q := p.tok * f;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is not null then
    out_sol := greatest(0, (c.vsol - c.vsol * c.vtok / (c.vtok + q)) * (1 - yr_paper_fee(c.src)) - yr_paper_netfee());
    mc := c.vsol / c.vtok * 1e9;
  end if;
  part := p.cost * f;
  update yr_paper_acct set sol = sol + out_sol where id = p_acct;
  if f >= 0.999 then delete from yr_paper_pos where acct = p_acct and mint = p_mint;
  else update yr_paper_pos set tok = tok - q, cost = cost - part where acct = p_acct and mint = p_mint;
  end if;
  insert into yr_paper_fill (acct, mint, symbol, side, sol, tok, mc, pnl, reason, at)
  values (p_acct, p_mint, p.symbol, 2, out_sol, q, mc, out_sol - part, coalesce(p_reason, 'manual'), yr_now());
  return jsonb_build_object('sol', out_sol, 'pnl', out_sol - part);
end $$;

-- a position is worth what selling it all now would pay, fees included
create or replace function yr_paper_state(p_acct uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a yr_paper_acct; res jsonb;
begin
  select * into a from yr_paper_acct where id = p_acct;
  if not found then raise exception 'Unknown paper wallet'; end if;
  with pos as (
    select p.*, c.vsol, c.vtok,
      case when c.vsol is null then 0
           else greatest(0, (c.vsol - c.vsol * c.vtok / (c.vtok + p.tok)) * (1 - yr_paper_fee(c.src)) - yr_paper_netfee()) end val,
      case when c.vsol is null then null else c.vsol / c.vtok * 1e9 end mc
    from yr_paper_pos p left join lateral yr_paper_curve(p.mint) c on true
    where p.acct = p_acct),
  st as (
    select count(*) n, count(*) filter (where pnl > 0) wins, coalesce(sum(pnl), 0) pnl, max(pnl / nullif(sol - pnl, 0)) best, min(pnl / nullif(sol - pnl, 0)) worst
    from yr_paper_fill where acct = p_acct and side = 2)
  select jsonb_build_object(
    'now', yr_now(), 'sol', a.sol, 'start', a.start_sol, 'name', a.name,
    'equity', a.sol + coalesce((select sum(val) from pos), 0),
    'positions', coalesce((select jsonb_agg(jsonb_build_array(mint, symbol, tok, cost, mc0, mc, val, val - cost, tp, stop, until_t, opened_at) order by opened_at desc) from pos), '[]'::jsonb),
    'fills', coalesce((select jsonb_agg(jsonb_build_array(f.mint, f.symbol, f.side, f.sol, f.mc, f.pnl, f.reason, f.at) order by f.at desc)
                       from (select * from yr_paper_fill where acct = p_acct order by at desc limit 40) f), '[]'::jsonb),
    'stats', (select jsonb_build_object('trades', n, 'wins', wins, 'pnl', pnl, 'best', best, 'worst', worst) from st))
  into res;
  return res;
end $$;
