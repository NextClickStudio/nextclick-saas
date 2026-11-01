-- 061: the scanner shows every coin of a wave, and the wallet tracker works every minute and says what it saw.
-- 1. yr_wave_s(theme): every pump.fun coin of the last 2 hours whose name or ticker has the wave's word, with its live
--    numbers (market cap, high, buys / sells / buying wallets in the last 2 minutes, price change) and yeppo's quick
--    flag (rug, bundle, creator bag, dumped, creator with bad coins, coin farm). Live coins first, then by market cap,
--    40 at most. Read only when someone opens a wave, from yr_obirth's time index: about 3,000 rows, no new table.
-- 2. yr_smart_calc(): the smart-money picks, now run by the cron job every minute (before, only when someone had the
--    scanner open, so almost nothing was logged). It also returns the coins proven wallets are in that did not pass,
--    with the reason, and the record of past calls (best price within an hour of the call).

create or replace function yr_wave_s(p_theme text) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '6s' as $$
declare now_ms bigint := yr_now(); th text := lower(coalesce(p_theme, ''));
begin
  perform yr_guard();
  if th !~ '^[a-z0-9]{3,20}$' then return '[]'::jsonb; end if;
  return (
    with b as (
      select o.mint, o.t, o.name, o.symbol from yr_obirth o
      where o.t > now_ms - 7200000
        and regexp_replace(lower(coalesce(o.name, '') || ' ' || coalesce(o.symbol, '')), '[^a-z0-9 ]', ' ', 'g') ~ ('(^| )' || th || '( |$)')),
    c as (
      select b.mint, b.t, coalesce(c.sym, b.symbol) sym, coalesce(c.name, b.name) name, c.n, c.mc, c.ath,
        coalesce(nullif(c.mc0, 0), 27.96) b0, c.bun, c.bun0, c.out_s, c.rug_s, c.grad, c.dev_tok, coalesce(c.dev, '') dev,
        coalesce(c.last_t, b.t) last_t
      from b left join yr_cc c on c.mint = b.mint),
    top as (
      select * from c order by (last_t > now_ms - 300000) desc, coalesce(mc, 0) desc, coalesce(n, 0) desc limit 40),
    live as (
      select t.mint, count(*) filter (where x.k = 1) b2, count(*) filter (where x.k = 2) s2,
        count(distinct x.who) filter (where x.k = 1) w2,
        (array_agg(x.vsol / x.vtok order by x.t desc))[1] / nullif((array_agg(x.vsol / x.vtok order by x.t))[1], 0) - 1 ch2
      from top t join yr_ticks x on x.mint = t.mint and x.t > now_ms - 120000 and x.k in (1, 2) and x.vsol > 0 and x.vtok > 0
      group by t.mint)
    select coalesce(jsonb_agg(jsonb_build_object(
        'mint', t.mint, 'sym', t.sym, 'name', left(t.name, 40), 't0', t.t, 'n', coalesce(t.n, 0), 'last', t.last_t,
        'mc', round(coalesce(t.mc, 0)::numeric, 1), 'ath', round(coalesce(t.ath, 0)::numeric, 1),
        'nowx', round((coalesce(t.mc, 0) / t.b0)::numeric, 2), 'hix', round((coalesce(t.ath, 0) / t.b0)::numeric, 2),
        'b2', coalesce(l.b2, 0), 's2', coalesce(l.s2, 0), 'w2', coalesce(l.w2, 0), 'ch2', round(l.ch2::numeric, 3),
        'bun', round(greatest(coalesce(t.bun, 0), coalesce(t.bun0, 0))::numeric, 2), 'out', t.out_s,
        'grad', coalesce(t.grad, false) or (coalesce(t.mc, 0) / t.b0 >= 10 and coalesce(t.n, 0) >= 300),
        'flag', case
          when t.rug_s is not null then 'rug'
          when coalesce(t.bun, 0) >= 0.15 or coalesce(t.bun0, 0) >= 0.10 then 'bundle'
          when coalesce(t.dev_tok, 0) >= 0.05e9 then 'devbag'
          when t.ath > 0 and coalesce(t.mc, 0) < t.ath * 0.5 then 'dumped'
          when t.dev <> '' and (select count(*) from yr_cc d where d.dev = t.dev) >= 40 then 'farm'
          when t.dev <> '' and not yr_track_ok(t.dev, t.t) then 'creator'
          else null end)
      order by (t.last_t > now_ms - 300000) desc, coalesce(t.mc, 0) desc), '[]'::jsonb)
    from top t left join live l on l.mint = t.mint);
end $$;
revoke all on function yr_wave_s(text) from public, authenticated;
grant execute on function yr_wave_s(text) to anon;

create or replace function yr_smart_calc() returns jsonb
language plpgsql security definer set search_path = public set statement_timeout = '8s' as $$
declare now_ms bigint := yr_now(); out jsonb; near jsonb; rec jsonb;
begin
  create temp table _sm on commit drop as
  with smart as (
    select s.who, s.wins, s.tries, s.wins::real / greatest(s.tries, 1) hit
    from yr_sm3 s
    where s.wins >= 3 and s.tries >= 8 and s.wins::real / greatest(s.tries, 1) >= 0.12 and s.flips * 3 <= s.tries
      and (select count(distinct d) from unnest(s.devs) d) >= 3),
  act as (
    select x.mint, sm.who, sm.wins, sm.tries, sm.hit,
      sum(case when x.k = 1 then x.sol else 0 end) bought, sum(case when x.k = 2 then x.sol else 0 end) sold,
      min(x.t) filter (where x.k = 1) first_t
    from yr_ticks x join smart sm on sm.who = x.who
    where x.t > now_ms - 600000 and x.k in (1, 2)
    group by x.mint, sm.who, sm.wins, sm.tries, sm.hit)
  select a.mint, count(*) filter (where a.bought > 0 and a.sold < a.bought * 0.5) n_in,
    count(*) filter (where a.sold >= a.bought * 0.5 and a.sold > 0) n_out,
    max(a.hit) best_hit, min(a.first_t) first_t,
    jsonb_agg(jsonb_build_array(left(a.who, 4) || '…' || right(a.who, 4), a.wins, round(a.hit::numeric, 2), round(a.bought::numeric, 2))
      order by a.wins desc) filter (where a.bought > 0) who
  from act a group by a.mint;

  with pick as (
    select k.*, c.sym, c.t0, c.n, c.mc, c.ath, coalesce(nullif(c.mc0, 0), 27.96) b0, c.bun, c.out_s, c.grad
    from _sm k join yr_cc c on c.mint = k.mint
    where k.n_in >= 2 and k.n_out < k.n_in
      and c.t0 > now_ms - 1800000
      and c.rug_s is null and coalesce(c.bun, 0) < 0.15 and coalesce(c.bun0, 0) < 0.10 and c.ath > 0
      and coalesce(c.dev_tok, 0) < 0.05e9
      and coalesce(c.mc, 0) >= c.ath * 0.5
      and (c.out_s is null or c.out_s > 120)
      and (select count(*) from yr_cc d where d.dev = c.dev) < 40
      and yr_track_ok(c.dev, c.t0)),
  live as (
    select p.*,
      count(x.k) filter (where x.k = 1) buys2, count(x.k) filter (where x.k = 2) sells2,
      count(distinct x.who) filter (where x.k = 1) wal2,
      (array_agg(x.vsol / x.vtok order by x.t desc) filter (where x.k is not null))[1]
        / nullif((array_agg(x.vsol / x.vtok order by x.t) filter (where x.k is not null))[1], 0) - 1 ch2
    from pick p left join yr_ticks x on x.mint = p.mint and x.t > now_ms - 120000 and x.vsol > 0 and x.vtok > 0
    group by p.mint, p.n_in, p.n_out, p.best_hit, p.first_t, p.who, p.sym, p.t0, p.n, p.mc, p.ath, p.b0, p.bun, p.out_s, p.grad)
  select coalesce(jsonb_agg(jsonb_build_object(
      'mint', l.mint, 'sym', l.sym, 't0', l.t0, 'n', l.n, 'mc', round(l.mc::numeric, 1),
      'nowx', round((l.mc / l.b0)::numeric, 2), 'hix', round((l.ath / l.b0)::numeric, 2),
      'smart', l.n_in, 'out', l.n_out, 'hit', round(l.best_hit::numeric, 2), 'first', l.first_t, 'who', l.who,
      'buys2', l.buys2, 'sells2', l.sells2, 'wal2', l.wal2, 'ch2', round(l.ch2::numeric, 3),
      'bun', l.bun, 'grad', l.grad or (l.mc / l.b0 >= 10 and l.n >= 300))
    order by l.n_in desc, l.best_hit desc), '[]'::jsonb)
  into out
  from (select * from live l0 where l0.wal2 >= l0.buys2 * 0.35
          and coalesce((select max(z.s) / nullif(sum(z.s), 0) from (
                select sum(x.sol) s from yr_ticks x where x.mint = l0.mint and x.k = 1 and x.t > now_ms - 120000 group by x.who) z), 0) <= 0.5
        order by n_in desc, best_hit desc limit 6) l;

  -- the coins proven wallets are in that did not make it, with the first reason
  select coalesce(jsonb_agg(jsonb_build_object('mint', q.mint, 'sym', q.sym, 't0', q.t0, 'mc', round(q.mc::numeric, 1),
      'smart', q.n_in, 'hit', round(q.best_hit::numeric, 2), 'why', q.why) order by q.n_in desc, q.best_hit desc), '[]'::jsonb)
  into near
  from (
    select k.mint, k.n_in, k.best_hit, c.sym, c.t0, coalesce(c.mc, 0) mc,
      case
        when c.t0 <= now_ms - 1800000 then 'older than 30 min'
        when c.rug_s is not null then 'rugged'
        when coalesce(c.bun, 0) >= 0.15 or coalesce(c.bun0, 0) >= 0.10 then 'bundle ' || round(greatest(coalesce(c.bun, 0), coalesce(c.bun0, 0)) * 100) || '%'
        when c.out_s is not null and c.out_s <= 120 then 'creator sold after ' || c.out_s || 's'
        when coalesce(c.dev_tok, 0) >= 0.05e9 then 'creator holds ' || round(c.dev_tok / 1e7) || '%'
        when c.ath > 0 and coalesce(c.mc, 0) < c.ath * 0.5 then 'down ' || round((1 - c.mc / c.ath) * 100) || '% from its high'
        when (select count(*) from yr_cc d where d.dev = c.dev) >= 40 then 'creator launches dozens of coins'
        when not yr_track_ok(c.dev, c.t0) then 'creator''s past coins went bad'
        when k.n_out >= greatest(k.n_in, 1) then 'proven wallets already sold'
        when k.n_in < 2 then 'only 1 proven wallet so far'
        else 'buying is thin or one wallet dominates' end why
    from _sm k join yr_cc c on c.mint = k.mint
    where k.n_in >= 1 and not exists (select 1 from jsonb_array_elements(out) e where e->>'mint' = k.mint)
    order by k.n_in desc, k.best_hit desc limit 6) q;

  insert into yr_sm_sig (mint, t, n, mc)
  select e->>'mint', now_ms, (e->>'smart')::int, (e->>'mc')::real from jsonb_array_elements(out) e
  on conflict (mint) do nothing;

  -- the record: calls older than an hour, best market cap within that hour against the call's
  select jsonb_build_object('calls', count(*), 'up2', count(*) filter (where g.ath_after >= g.mc * 2),
      'up50', count(*) filter (where g.ath_after >= g.mc * 1.5),
      'median', round(coalesce(percentile_cont(0.5) within group (order by g.ath_after / nullif(g.mc, 0) - 1), 0)::numeric, 2))
  into rec from yr_sm_sig g where g.t < now_ms - 3600000 and g.ath_after is not null;

  return jsonb_build_object('smart', out, 'near', near, 'record', rec,
    'wallets', (select count(*) from yr_sm3 s where s.wins >= 3 and s.tries >= 8
      and s.wins::real / greatest(s.tries, 1) >= 0.12 and s.flips * 3 <= s.tries and (select count(distinct d) from unnest(s.devs) d) >= 3),
    'learning', (select count(*) from yr_sm3));
end $$;
revoke all on function yr_smart_calc() from public, anon, authenticated;

create or replace function yr_smart_s() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform yr_guard();
  return yr_smart_calc();
end $$;
revoke all on function yr_smart_s() from public, authenticated;
grant execute on function yr_smart_s() to anon;

-- every minute, whether or not anyone has the scanner open
select cron.alter_job((select jobid from cron.job where jobname = 'yr-sm'), command := 'select yr_sm_roll(); select yr_smart_calc();');
