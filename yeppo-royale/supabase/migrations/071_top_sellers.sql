-- 071: the biggest holders, by address (3 Nov 2026). yr_risk gains 'tops': the 10 wallets that held the most 90 seconds
-- ago (1%+ of the supply each, the creator left out), with what they bought, what they hold now and what they sold in
-- the last 90 seconds. The read says Exit the moment one of them sells a real part of their bag, and the panel watches their
-- addresses in the live trades to say it within the second. Same trades yeppo already keeps: no new writes.
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
      coalesce(sum(sol) filter (where k = 1), 0) solin,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 180000), 0) sold3,
      coalesce(sum(sol) filter (where k = 2 and t > yr_now() - 120000), 0) sell2,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 90000), 0) sold90
    from x where who <> coalesce(p_dev, '') group by who),
  sn as (select * from w where p_t0 is not null and fb <= p_t0 + 15000),
  kl as (
    select coalesce(k.name, '') n, w.fb, w.solin, w.bought, w.net from w
    left join yr_kol k on k.who = w.who
    left join yr_sm3 s on s.who = w.who
    where w.fb is not null and (k.who is not null or (w.solin >= 0.1 and s.who is not null and yr_sm_proven(s)))),
  tp as (select who, bought, net, sold90, greatest(net, 0) + sold90 had from w where greatest(net, 0) + sold90 >= 0.01e9 order by 5 desc limit 10),
  curve as (
    select (1.073e9 - (array_agg(vtok order by t desc))[1]) gone,
      sum(case when k = 1 then tok else -tok end) seen
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
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;
