-- 096: same-amount buys leave out the quick-buy presets of the terminals (0.1 SOL minus fees bought by 17 wallets is
-- not one buyer) and same-share buys need a 0.1%+ bag each, to the thousandth of a percent (checked on JOE, PIPER).
create or replace function yr_deep_s(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now(); c record; v_handle text; out jsonb;
begin
  perform yr_guard();
  select mint, dev, t0, sym, coalesce(nullif(mc0, 0), 27.96) b0 into c from yr_cc where mint = p_mint;
  if c.mint is null then return null; end if;
  select lower(x.handle) into v_handle from yr_xlink x where x.mint = p_mint;
  with early as (
    select x.who, sum(x.sol) sol, sum(x.tok) tok from yr_ticks x
    where x.mint = p_mint and x.k = 1 and x.who <> c.dev and x.t < c.t0 + 180000
    group by x.who),
  -- a terminal's quick-buy button (0.1, 0.2, 0.5, 1 SOL... minus fees) is not one hand: those amounts are left out
  same_sol as (
    select round(sol::numeric, 3) amt, count(*) n, sum(tok) tok from early
    where sol >= 0.05 and not exists (select 1 from unnest(array[0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 10, 20]) r
                                      where early.sol between r * 0.94 and r * 1.001)
    group by 1 having count(*) >= 3 order by count(*) desc limit 3),
  -- the same share of the supply to a thousandth of a percent, from wallets that each took 0.1% or more
  same_tok as (
    select round((tok / 1e9 * 100)::numeric, 3) pct, count(*) n, sum(tok) tok from early where tok >= 1e6 group by 1 having count(*) >= 3 order by count(*) desc limit 3)
  select jsonb_build_object(
    'early', (select count(*) from early),
    'seen', exists (select 1 from yr_ticks x where x.mint = p_mint and x.t < c.t0 + 60000),
    'same_sol', (select coalesce(jsonb_agg(jsonb_build_object('amt', amt, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_sol),
    'same_tok', (select coalesce(jsonb_agg(jsonb_build_object('pct', pct, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_tok),
    'dev_24h', (select count(*) from yr_cc d where d.dev = c.dev and d.t0 > now_ms - 86400000),
    'copy_of', (select jsonb_build_object('mint', o.mint, 'sym', o.sym, 'x', round((o.ath / coalesce(nullif(o.mc0, 0), 27.96))::numeric, 1), 't0', o.t0)
      from yr_cc o where lower(o.sym) = lower(c.sym) and o.mint <> c.mint and o.t0 < c.t0 and o.t0 > now_ms - 7 * 86400000
        and o.ath >= coalesce(nullif(o.mc0, 0), 27.96) * 10
      order by o.ath desc limit 1),
    'x_handle', v_handle,
    'x_other', case when v_handle is null then null else (select jsonb_build_object('n', count(*),
        'died', count(*) filter (where o.rug_s is not null or (o.ath < coalesce(nullif(o.mc0, 0), 27.96) * 2 and o.t0 < now_ms - 3600000)))
      from yr_xlink l join yr_cc o on o.mint = l.mint where lower(l.handle) = v_handle and l.mint <> p_mint and o.t0 > now_ms - 14 * 86400000) end,
    'buyers5', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'buyers5_before', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 600000 and x.t <= now_ms - 300000),
    'buys5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'sells5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 2 and x.t > now_ms - 300000))
  into out;
  return out;
end $$;
