-- 090: snipers include the silent early group (4 Nov 2026). $JAMIE: 21 wallets bought in its first 20 seconds, one buy
-- each, held through its ×7 without selling a token, then sold 22% of the supply together in 2 seconds. Snipers were
-- only the first 15 seconds' buyers, so half of that group counted as "everyone else" and the coin showed "safe zone".
-- Now a wallet that bought in the first 30 seconds also counts as a sniper when it bought once, never sold, and the
-- price has doubled since its buy: a trader takes some profit on a ×2, one hand split into many wallets doesn't.
-- Measured on the 83 coins trading at the time: one coin moved by 5 points or more (0% → 23%), the average +0.5.
-- No new number in the panel: they're part of Snipers, inside the insiders total.
create or replace function yr_risk(p_mint text, p_dev text, p_t0 bigint) returns jsonb
language sql stable security definer set search_path to 'public' as $function$
  with x as (
    select who, t, k, tok, sol, vtok, vsol from yr_ticks
    where mint = p_mint and t > yr_now() - 1200000 and k in (1, 2)),
  w as (
    select who,
      min(t) filter (where k = 1) fb,
      count(*) filter (where k = 1) nb,
      count(*) filter (where k = 2) ns,
      (array_agg(vsol / vtok order by t) filter (where k = 1 and vtok > 0))[1] p0,
      sum(case when k = 1 then tok else -tok end) net,
      coalesce(sum(tok) filter (where k = 1), 0) bought,
      coalesce(sum(sol) filter (where k = 1), 0) solin,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 180000), 0) sold3,
      coalesce(sum(sol) filter (where k = 2 and t > yr_now() - 120000), 0) sell2,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 90000), 0) sold90
    from x where who <> coalesce(p_dev, '') group by who),
  pm as (select max(vsol / vtok) pmax from x where vtok > 0),
  sn as (
    select w.* from w, pm where p_t0 is not null and (w.fb <= p_t0 + 15000
      or (w.fb <= p_t0 + 30000 and w.nb = 1 and w.ns = 0 and pm.pmax >= w.p0 * 2))),
  kl as (
    select coalesce(k.name, '') n, w.fb, w.solin, w.bought, w.net from w
    left join yr_kol k on k.who = w.who
    left join yr_sm3 s on s.who = w.who
    where w.fb is not null and (k.who is not null or (w.solin >= 0.1 and s.who is not null and yr_sm_proven(s)))),
  tp as (select who, bought, net, sold90, greatest(net, 0) + sold90 had from w where greatest(net, 0) + sold90 >= 0.01e9 order by 5 desc limit 10),
  curve as (
    select (1.073e9 - (array_agg(vtok order by t desc))[1]) gone,
      (select sum(greatest(q.n2, 0)) from (select sum(case when k = 1 then tok else -tok end) n2 from x group by who) q) seen
    from x where vtok > 0),
  f as (select p_t0 is not null and p_t0 > yr_now() - 1190000 as fl)
  select jsonb_build_object(
    'full', (select fl from f),
    'snipers', (select count(*) from sn),
    'sniperHeld', round((coalesce((select sum(greatest(net, 0)) from sn), 0) / 1e9)::numeric, 4),
    'sniperTook', round((coalesce((select sum(bought) from sn), 0) / 1e9)::numeric, 4),
    'topHeld', round((coalesce((select max(greatest(net, 0)) from w), 0) / 1e9)::numeric, 4),
    'top10Held', round((coalesce((select sum(v) from (select greatest(net, 0) v from w order by 1 desc limit 10) z), 0) / 1e9)::numeric, 4),
    'out', (select round((greatest(0, gone) / 1e9)::numeric, 4) from curve where gone is not null),
    'hidden', case when (select fl from f) then
      (select round((greatest(0, gone - coalesce(seen, 0)) / 1e9)::numeric, 4) from curve where gone is not null) end,
    'dumpers', (select count(*) from w where bought >= 0.03e9 and sold3 >= bought * 0.5),
    'dumped', round((coalesce((select sum(sold3) from w where bought >= 0.03e9 and sold3 >= bought * 0.5), 0) / 1e9)::numeric, 4),
    'sell2', round(coalesce((select sum(sell2) from w), 0)::numeric, 3),
    'topSell2', round(coalesce((select max(sell2) from w), 0)::numeric, 3),
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)),
    'kols', coalesce((select jsonb_agg(jsonb_build_object(
        'n', n,
        'sol', round(solin::numeric, 2),
        'left', case when bought > 0 then round((greatest(net, 0) / bought)::numeric, 2) else 0 end,
        's', case when p_t0 is not null then greatest(0, (fb - p_t0) / 1000) end) order by fb) from kl), '[]'::jsonb),
    'tops', coalesce((select jsonb_agg(jsonb_build_object(
        'w', who,
        'b', round((bought / 1e9)::numeric, 4),
        'h', round((greatest(net, 0) / 1e9)::numeric, 4),
        's90', round((sold90 / 1e9)::numeric, 4)) order by had desc) from tp), '[]'::jsonb));
$function$;
