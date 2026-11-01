-- 059: the crowd around a coin, for the read's "Crowd & volatility" box: one cheap look at the coin's own last 20 minutes
-- of trades (index yr_ticks_mint_t), no table, no writes. Returned by yr_creator as 'crowd'.
create or replace function yr_crowd(p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  -- traders and first-time buyers of the last 5 minutes, and groups of 3+ wallets whose first buy landed in the same 2
  -- seconds for the same amount (±10%): wallets bought together, the "bubbles" a bubble map draws, with what they hold
  with x as (select who, t, k, tok, sol from yr_ticks where mint = p_mint and t > yr_now() - 1200000 and k in (1, 2)),
  f as (select who, min(t) filter (where k = 1) fb, (array_agg(sol order by t) filter (where k = 1))[1] s1,
          sum(case when k = 1 then tok else -tok end) net from x group by who),
  g as (select fb / 2000 sec, round(ln(greatest(s1, 0.001)) * 10) sz, count(*) n, sum(greatest(net, 0)) held
        from f where fb is not null and s1 > 0 group by 1, 2 having count(*) >= 3)
  select jsonb_build_object(
    'w5', (select count(distinct who) from x where t > yr_now() - 300000),
    'new5', (select count(*) from f where fb > yr_now() - 300000),
    'newPrev', (select count(*) from f where fb > yr_now() - 600000 and fb <= yr_now() - 300000),
    'clusters', (select count(*) from g),
    'clWallets', (select coalesce(sum(n), 0) from g),
    'clHeld', (select round((coalesce(sum(held), 0) / 1e9)::numeric, 4) from g),
    'bigCluster', (select round((coalesce(max(held), 0) / 1e9)::numeric, 4) from g));
$$;
revoke all on function yr_crowd(text) from public, anon, authenticated;
-- yr_creator: unchanged, plus 'crowd' => yr_crowd(p_mint) (applied with the live definition)
