-- 069: the hidden bundle only when yeppo saw the whole coin (2 Nov 2026). yr_ticks keeps 20 minutes, so for a coin
-- older than that (or one whose start yeppo missed) every buy before the window looked "hidden": healthy coins that ran
-- (Valerie, +657%) read as bundled. 'hidden' is now null unless the coin is under 20 minutes old and yeppo followed it
-- since launch. New 'out': the share of the supply that has left the curve (what holders can hold at all), so the top
-- 10 is judged against what is in circulation, not against the whole 1B.
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
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)));
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;
