-- 065: who can rug a coin, together (2 Nov 2026). Tweet coins launched by deploy bots (J7Tracker, uxento, rapidlaunch...)
-- are bundled two times out of three and their creator almost never sells: the bundle and the snipers do, all at once.
-- yr_risk now also returns the 10 biggest wallets' share (creator left out), so yeppo can rule a coin out on who holds
-- it together, not one wallet at a time. Same cost: the same rows, one more sum.
create or replace function yr_risk(p_mint text, p_dev text, p_t0 bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  with x as (
    select who, t, k, tok, sol from yr_ticks
    where mint = p_mint and t > yr_now() - 1200000 and k in (1, 2) and who <> coalesce(p_dev, '')),
  w as (
    select who,
      min(t) filter (where k = 1) fb,
      sum(case when k = 1 then tok else -tok end) net,
      coalesce(sum(tok) filter (where k = 1), 0) bought,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 180000), 0) sold3,
      coalesce(sum(sol) filter (where k = 2 and t > yr_now() - 120000), 0) sell2
    from x group by who),
  sn as (select * from w where p_t0 is not null and fb <= p_t0 + 15000)
  select jsonb_build_object(
    'full', p_t0 is not null and p_t0 > yr_now() - 1190000,
    'snipers', (select count(*) from sn),
    'sniperHeld', round((coalesce((select sum(greatest(net, 0)) from sn), 0) / 1e9)::numeric, 4),
    'sniperTook', round((coalesce((select sum(bought) from sn), 0) / 1e9)::numeric, 4),
    'topHeld', round((coalesce((select max(greatest(net, 0)) from w), 0) / 1e9)::numeric, 4),
    'top10Held', round((coalesce((select sum(v) from (select greatest(net, 0) v from w order by 1 desc limit 10) z), 0) / 1e9)::numeric, 4),
    'dumpers', (select count(*) from w where bought >= 0.03e9 and sold3 >= bought * 0.5),
    'dumped', round((coalesce((select sum(sold3) from w where bought >= 0.03e9 and sold3 >= bought * 0.5), 0) / 1e9)::numeric, 4),
    'sell2', round(coalesce((select sum(sell2) from w), 0)::numeric, 3),
    'topSell2', round(coalesce((select max(sell2) from w), 0)::numeric, 3),
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)));
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;
