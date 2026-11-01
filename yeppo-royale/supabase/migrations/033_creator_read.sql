-- the panel also shows the coin's picture (its metadata uri, kept a day in yr_obirth) and, for a coin past its
-- first 20 minutes, its own price over them, to lay it over its creator's other coins
create or replace function yr_creator(p_mint text, p_dev text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me yr_cc; d text; now_ms bigint := yr_now(); t_from bigint;
begin
  select * into me from yr_cc where mint = p_mint;
  d := coalesce(me.dev, nullif(p_dev, ''));
  t_from := greatest(coalesce(me.t0, 0), now_ms - 1200000);
  return jsonb_build_object(
    'now', now_ms,
    'dev', d,
    'me', case when me.mint is null then null else jsonb_build_object(
      't0', me.t0, 'sym', me.sym, 'name', me.name, 'n', me.n, 'mc', me.mc, 'ath', me.ath, 'ath_s', me.ath_s,
      'dev_buy', me.dev_buy, 'dev_sell', me.dev_sell, 'dev_tok', me.dev_tok, 'dev_max', me.dev_max,
      'sold_s', me.sold_s, 'sold_mc', me.sold_mc, 'out_s', me.out_s, 'grad', me.grad, 'p', me.p) end,
    'uri', (select b.uri from yr_obirth b where b.mint = p_mint),
    'total', (select count(*) from yr_cc where dev = d),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, c.ath, c.ath_s, c.mc, c.dev_buy, c.dev_sell,
                                         c.sold_s, c.sold_mc, c.out_s, c.grad, c.p) order by c.t0 desc)
      from (select * from yr_cc where dev = d and mint <> p_mint order by t0 desc limit 30) c), '[]'::jsonb),
    -- 10 s steps of the last 20 minutes: [step, close, high, low, buys, sells, SOL in, SOL out]
    'steps', coalesce((
      select jsonb_agg(jsonb_build_array(z.b, z.c, z.h, z.l, z.nb, z.ns, z.vb, z.vs) order by z.b)
      from (
        select ((x.t - t_from) / 10000)::int b,
          ((array_agg(x.vsol / x.vtok order by x.t desc))[1] * 1e9)::real c,
          (max(x.vsol / x.vtok) * 1e9)::real h, (min(x.vsol / x.vtok) * 1e9)::real l,
          count(*) filter (where x.k = 1) nb, count(*) filter (where x.k = 2) ns,
          round(coalesce(sum(x.sol) filter (where x.k = 1), 0)::numeric, 3) vb,
          round(coalesce(sum(x.sol) filter (where x.k = 2), 0)::numeric, 3) vs
        from yr_ticks x where x.mint = p_mint and x.t > t_from and x.vsol > 0 and x.vtok > 0
        group by 1) z), '[]'::jsonb),
    'from', t_from,
    'w60', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 60000),
    'w120', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 120000));
end $$;

