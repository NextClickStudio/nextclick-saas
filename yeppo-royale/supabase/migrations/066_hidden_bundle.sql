-- 066: the hidden bundle (2 Nov 2026). A rug can spread its supply over hundreds of wallets in the launch block, so no
-- holder, top 10 or sniper share looks big, and dump it all in one block minutes later (SOLCAT: 505 wallets sold in
-- 10 s, -90%). pump.fun's curve gives it away: the price says how much supply has left the curve (1.073B virtual
-- tokens at launch, fewer with every buy), and yeppo sees every trade on the market. What left the curve but nobody was
-- seen buying is held by the launch bundle: 'hidden', a share of the 1B supply (exact for coins yeppo followed since
-- launch; trades yeppo missed only make it look bigger, never smaller).
-- yr_creator also reads coins whose launch yeppo missed (no row in yr_cc yet): their risk from the trades alone.
create or replace function yr_risk(p_mint text, p_dev text, p_t0 bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  with x as (
    select who, t, k, tok, sol, vtok from yr_ticks
    where mint = p_mint and t > yr_now() - 1200000 and k in (1, 2)),
  w as (
    select who,
      min(t) filter (where k = 1) fb,
      sum(case when k = 1 then tok else -tok end) net,
      coalesce(sum(tok) filter (where k = 1), 0) bought,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 180000), 0) sold3,
      coalesce(sum(sol) filter (where k = 2 and t > yr_now() - 120000), 0) sell2
    from x where who <> coalesce(p_dev, '') group by who),
  sn as (select * from w where p_t0 is not null and fb <= p_t0 + 15000),
  curve as (
    select (1.073e9 - (array_agg(vtok order by t desc))[1]) gone,
      sum(case when k = 1 then tok else -tok end) seen
    from x where vtok > 0)
  select jsonb_build_object(
    'full', p_t0 is not null and p_t0 > yr_now() - 1190000,
    'snipers', (select count(*) from sn),
    'sniperHeld', round((coalesce((select sum(greatest(net, 0)) from sn), 0) / 1e9)::numeric, 4),
    'sniperTook', round((coalesce((select sum(bought) from sn), 0) / 1e9)::numeric, 4),
    'topHeld', round((coalesce((select max(greatest(net, 0)) from w), 0) / 1e9)::numeric, 4),
    'top10Held', round((coalesce((select sum(v) from (select greatest(net, 0) v from w order by 1 desc limit 10) z), 0) / 1e9)::numeric, 4),
    'hidden', (select round((greatest(0, gone - coalesce(seen, 0)) / 1e9)::numeric, 4) from curve where gone is not null),
    'dumpers', (select count(*) from w where bought >= 0.03e9 and sold3 >= bought * 0.5),
    'dumped', round((coalesce((select sum(sold3) from w where bought >= 0.03e9 and sold3 >= bought * 0.5), 0) / 1e9)::numeric, 4),
    'sell2', round(coalesce((select sum(sell2) from w), 0)::numeric, 3),
    'topSell2', round(coalesce((select max(sell2) from w), 0)::numeric, 3),
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)));
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;

create or replace function yr_creator(p_mint text, p_dev text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me yr_cc; d text; now_ms bigint := yr_now(); t_from bigint; first_t bigint;
begin
  select * into me from yr_cc where mint = p_mint;
  d := coalesce(me.dev, nullif(p_dev, ''));
  t_from := greatest(coalesce(me.t0, 0), now_ms - 1200000);
  -- a coin whose launch yeppo missed: judged from its trades, with its first trade yeppo saw as its start
  if me.mint is null then select min(t) into first_t from yr_ticks where mint = p_mint and t > now_ms - 1200000; end if;
  return jsonb_build_object(
    'now', now_ms,
    'dev', d,
    'me', case when me.mint is null then null else jsonb_build_object(
      't0', me.t0, 'sym', me.sym, 'name', me.name, 'n', me.n, 'mc', me.mc, 'ath', me.ath, 'ath_s', me.ath_s,
      'dev_buy', me.dev_buy, 'dev_sell', me.dev_sell, 'dev_tok', me.dev_tok, 'dev_max', me.dev_max,
      'sold_s', me.sold_s, 'sold_mc', me.sold_mc, 'out_s', me.out_s, 'grad', me.grad, 'p', me.p, 'mc0', me.mc0, 'rug_s', me.rug_s, 'rug_drop', me.rug_drop, 'bun', me.bun, 'bun0', me.bun0) end,
    'uri', (select b.uri from yr_obirth b where b.mint = p_mint),
    'total', (select count(*) from yr_cc where dev = d),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, c.ath, c.ath_s, c.mc, c.dev_buy, c.dev_sell,
                                         c.sold_s, c.sold_mc, c.out_s, c.grad, c.p, c.mc0, c.rug_s, c.rug_drop) order by c.t0 desc)
      from (select * from yr_cc where dev = d and mint <> p_mint order by t0 desc limit 30) c), '[]'::jsonb),
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
    'w120', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 120000),
    'seen', me.mint is not null,
    'risk', case when me.mint is not null then yr_risk(p_mint, d, me.t0)
                 when first_t is not null then yr_risk(p_mint, d, first_t) end);
end $$;
revoke all on function yr_creator(text, text) from public, anon, authenticated;
