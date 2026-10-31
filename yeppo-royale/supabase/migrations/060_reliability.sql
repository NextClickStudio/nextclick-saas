-- 060: yeppo measures itself, every day, for free. Cost measured before applying: 0.2 s for two minutes of coins, about
-- 2.5 MB a day; yr_eval keeps 7 days, and each run stops itself after 10 s.
-- 1. yr_eval (shadow test): each pump.fun coin, once, when it is 18 minutes old (its trades still in yr_ticks), is replayed
--    in 10 s steps with the Momentum rule of lib/decide.ts (pulseOf "hot": +8% in a minute, 55%+ buys, more trades than
--    before, 6+ buying wallets; momentumBlock: first 2 minutes, a +50% minute, the creator sold, a 15%+ launch bundle).
--    One row per coin: what the price did 3 minutes after its first Momentum, after its first blocked "hot" moment, and
--    on average after its active but not hot moments (the baseline). No trade data is kept.
--    It also keeps the coin's numbers at minute 3 (price, buyers, buys share, biggest buyer, growth, bundle, creator)
--    and what it did over the next 15 minutes: the data to learn what an early runner looks like.
-- 2. yr_calls: the calls yeppo actually showed (reads) and the scanner's picks, with the price at the call; yr_sm_roll
--    fills in the high, low and price 10 minutes later from yr_ticks.

create table if not exists yr_eval (
  mint text primary key,
  t0 bigint not null,
  steps int,
  mom_s int, mom_r3 real, mom_hi real, mom_lo real,
  blk_s int, blk_r3 real, blk_hi real, blk_lo real,
  act_n int, act_r3 real, act_hi real, act_lo real,
  -- the coin at minute 3: price (× launch), its high so far, trades, distinct buyers, buys share, the biggest buyer's
  -- share of the SOL bought, buyers of minute 2-3 against minute 0-1 (is demand growing), launch bundle, creator out
  f3_x real, f3_hi real, f3_trades int, f3_buyers int, f3_bshare real, f3_top real, f3_grow real, f3_bun real, f3_dev_out boolean,
  -- after minute 3: the best price within the next 15 minutes (× the minute-3 price) and whether it graduated
  out_best real, out_grad boolean
);
alter table yr_eval enable row level security;
create index if not exists yr_eval_t0 on yr_eval (t0);

create table if not exists yr_calls (
  id bigserial primary key,
  mint text not null,
  t bigint not null,
  word text not null,
  mc real not null,
  hi10 real, lo10 real, end10 real,
  done boolean not null default false
);
alter table yr_calls enable row level security;
create index if not exists yr_calls_mint_t on yr_calls (mint, t);
create index if not exists yr_calls_open on yr_calls (t) where not done;

create or replace function yr_eval_roll() returns jsonb
language plpgsql security definer set search_path = public set statement_timeout = '10s' as $$
declare now_ms bigint := yr_now(); wm bigint; hi bigint; n int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_eval_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'eval_wm';
  hi := now_ms - 1080000;
  -- yr_ticks keeps about 20 minutes: never reach further back than 2 minutes past the 18
  wm := greatest(coalesce(wm, hi - 60000), hi - 120000);
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  insert into yr_eval (mint, t0, steps, mom_s, mom_r3, mom_hi, mom_lo, blk_s, blk_r3, blk_hi, blk_lo, act_n, act_r3, act_hi, act_lo,
    f3_x, f3_hi, f3_trades, f3_buyers, f3_bshare, f3_top, f3_grow, f3_bun, f3_dev_out, out_best, out_grad)
  with c as (select mint, t0, coalesce(bun0, 0) bun0, sold_s, out_s, grad, coalesce(nullif(mc0, 0), 27.96) b0 from yr_cc where t0 > wm and t0 <= hi and n >= 20),
  st as (
    select x.mint, ((x.t - c.t0) / 10000)::int s, (array_agg(x.vsol / x.vtok order by x.t desc))[1] cl,
      count(*) filter (where x.k = 1) nb, count(*) filter (where x.k = 2) ns, count(distinct x.who) filter (where x.k = 1) wb
    from yr_ticks x join c using (mint)
    where x.vtok > 0 and x.k in (1, 2) and x.t >= c.t0 and x.t < c.t0 + 1080000
    group by 1, 2),
  -- every 10 s step of the coin's first 18 minutes, the last price carried over steps without trades
  grid as (
    select g.mint, g.s, st.cl, coalesce(st.nb, 0) nb, coalesce(st.ns, 0) ns, coalesce(st.wb, 0) wb,
      count(st.cl) over (partition by g.mint order by g.s) grp
    from (select c.mint, s from c, generate_series(0, 107) s) g left join st using (mint, s)),
  filled as (
    select mint, s, first_value(cl) over (partition by mint, grp order by s) cl, nb, ns, wb from grid),
  w as (
    select st.*,
      lag(cl, 6) over p cl60,
      sum(nb) over (p rows between 5 preceding and current row) nb60,
      sum(ns) over (p rows between 5 preceding and current row) ns60,
      sum(wb) over (p rows between 5 preceding and current row) wb60,
      sum(nb + ns) over (p rows between 29 preceding and 6 preceding) / 4.0 prev,
      lead(cl, 18) over p cl3m,
      max(cl) over (p rows between 1 following and 18 following) hi3m,
      min(cl) over (p rows between 1 following and 18 following) lo3m
    from filled st where st.cl is not null window p as (partition by mint order by s)),
  lab as (
    select w.mint, w.s, w.cl, w.cl3m, w.hi3m, w.lo3m, w.nb60 + w.ns60 tr60,
      (w.cl / w.cl60 - 1 >= 0.08 and w.nb60::real / greatest(w.nb60 + w.ns60, 1) >= 0.55
        and w.nb60 + w.ns60 >= greatest(8, w.prev * 1.3) and w.wb60 >= 6) hot,
      (w.s * 10 < 120 or w.cl / w.cl60 - 1 >= 0.5 or (c.sold_s is not null and c.sold_s <= w.s * 10) or c.bun0 >= 0.15) blocked
    from w join c using (mint) where w.cl60 is not null and w.cl3m is not null and w.cl > 0)
  select c.mint, c.t0, (select count(*) from st where st.mint = c.mint),
    m.s, m.cl3m / m.cl - 1, m.hi3m / m.cl - 1, m.lo3m / m.cl - 1,
    b.s, b.cl3m / b.cl - 1, b.hi3m / b.cl - 1, b.lo3m / b.cl - 1,
    a.n, a.r3, a.hi, a.lo,
    e.p3 * 1e9 / c.b0, e.hi3 * 1e9 / c.b0, e.trades, e.buyers, e.bshare, e.top, e.grow, c.bun0,
    coalesce(c.out_s <= 180, false),
    case when e.p3 > 0 then greatest(o.best / e.p3, case when c.grad then 410.9 / (e.p3 * 1e9) else 0 end) end, c.grad
  from c
  left join lateral (select * from lab where lab.mint = c.mint and hot and not blocked order by s limit 1) m on true
  left join lateral (select * from lab where lab.mint = c.mint and hot and blocked order by s limit 1) b on true
  left join lateral (
    select count(*)::int n, avg(cl3m / cl - 1)::real r3, avg(hi3m / cl - 1)::real hi, avg(lo3m / cl - 1)::real lo
    from lab where lab.mint = c.mint and not hot and tr60 >= 8) a on true
  left join lateral (
    select (array_agg(x.vsol / x.vtok order by x.t desc))[1] p3, max(x.vsol / x.vtok) hi3, count(*)::int trades,
      count(distinct x.who) filter (where x.k = 1)::int buyers,
      (count(*) filter (where x.k = 1))::real / greatest(count(*), 1) bshare,
      (select max(z.s) / nullif(sum(z.s), 0) from (select sum(y.sol) s from yr_ticks y
         where y.mint = c.mint and y.k = 1 and y.t >= c.t0 and y.t < c.t0 + 180000 group by y.who) z)::real top,
      (count(distinct x.who) filter (where x.k = 1 and x.t >= c.t0 + 120000))::real
        / greatest(count(distinct x.who) filter (where x.k = 1 and x.t < c.t0 + 60000), 1) grow
    from yr_ticks x where x.mint = c.mint and x.k in (1, 2) and x.vtok > 0 and x.t >= c.t0 and x.t < c.t0 + 180000) e on true
  left join lateral (
    select max(x.vsol / x.vtok) best from yr_ticks x
    where x.mint = c.mint and x.vtok > 0 and x.t >= c.t0 + 180000 and x.t < c.t0 + 1080000) o on true
  where exists (select 1 from st where st.mint = c.mint)
  on conflict (mint) do nothing;
  get diagnostics n = row_count;

  insert into yr_okv (k, v) values ('eval_wm', hi) on conflict (k) do update set v = excluded.v;
  if extract(hour from clock_timestamp()) = 4 and extract(minute from clock_timestamp()) = 3 then
    delete from yr_eval where t0 < now_ms - 7 * 86400000::bigint;
    delete from yr_calls where t < now_ms - 30 * 86400000::bigint;
  end if;
  return jsonb_build_object('coins', n);
end $$;
revoke all on function yr_eval_roll() from public, anon, authenticated;

-- the outcome of real calls: 10 minutes after each call, from yr_ticks (coins on pump.fun's curve)
create or replace function yr_calls_roll() returns jsonb
language plpgsql security definer set search_path = public set statement_timeout = '10s' as $$
declare now_ms bigint := yr_now(); n int := 0;
begin
  update yr_calls k set hi10 = o.hi, lo10 = o.lo, end10 = o.en, done = true
  from (
    select k2.id,
      max(x.vsol / x.vtok * 1e9) hi, min(x.vsol / x.vtok * 1e9) lo,
      (array_agg(x.vsol / x.vtok * 1e9 order by x.t desc))[1] en
    from yr_calls k2 join yr_ticks x on x.mint = k2.mint and x.t > k2.t and x.t <= k2.t + 600000 and x.vtok > 0
    where not k2.done and k2.t <= now_ms - 600000 and k2.t > now_ms - 1100000
    group by k2.id) o
  where o.id = k.id;
  get diagnostics n = row_count;
  -- too old to measure (graduated coins, or no trades): closed without an outcome
  update yr_calls set done = true where not done and t <= now_ms - 1100000;
  return jsonb_build_object('measured', n);
end $$;
revoke all on function yr_calls_roll() from public, anon, authenticated;

-- yeppo.it's server logs a call (with the secret). Once per coin and word every 10 minutes, 5000 a day at most.
create or replace function yr_call_log_s(p_mint text, p_word text, p_mc real) returns void
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_word not in ('Momentum', 'Wait', 'Don''t buy', 'Wave', 'Smart') or p_mc is null or p_mc <= 0 or p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then return; end if;
  if exists (select 1 from yr_calls where mint = p_mint and word = p_word and t > now_ms - 600000) then return; end if;
  if (select count(*) from yr_calls where t > now_ms - 86400000) >= 5000 then return; end if;
  insert into yr_calls (mint, t, word, mc) values (p_mint, now_ms, p_word, p_mc);
end $$;
revoke all on function yr_call_log_s(text, text, real) from public, authenticated;
grant execute on function yr_call_log_s(text, text, real) to anon;

select cron.schedule('yr-eval', '* * * * *', 'select yr_eval_roll(); select yr_calls_roll();');
