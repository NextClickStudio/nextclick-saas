-- 098: CPU relief. The free instance's CPU runs on credits; yeppo used ~18% of a core on average, about twice what the
-- instance sustains, so the credits ran out every day and everything timed out. Measured causes and fixes:
-- 1. yr_now() was VOLATILE (clock_timestamp), so no index could be used for `t0 > yr_now() - …` in 29 functions:
--    whole tables were scanned. It is STABLE now (one value per statement is all any caller needs).
-- 2. yr_cc_roll ran its daily-style cleanup every minute (the "second < 15" test is always true for a job started at
--    :00): a 2.5 s scan of yr_cc each minute. The cleanup is its own hourly job now, yr_cc_gc().
-- 3. yr_cc_roll created a temp table every minute (catalog churn: ~270k pg_attribute rows inserted and deleted in 4
--    days). It uses one unlogged scratch table now, emptied at the start of each run.
-- 4. BRIN on yr_cc(t0) went lossy because updated rows move; a plain btree (t0 is never updated, HOT stays intact).
-- 5. cron.job_run_details kept 6 hours and was trimmed once a day (23 MB for 3k rows): trimmed every hour to 2 hours.

alter function public.yr_now() stable;

create index if not exists yr_cc_t0b on public.yr_cc (t0);
drop index if exists public.yr_cc_t0;

create unlogged table if not exists public.yr_roll_t as
  select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.who, (x.vsol / x.vtok * 1e9)::real mc, c.t0, c.dev,
    (case when x.k = 1 then (x.vsol - x.sol) / nullif(x.vtok + x.tok, 0) else (x.vsol + x.sol) / nullif(x.vtok - x.tok, 0) end * 1e9)::real pre
  from public.yr_ticks x join public.yr_cc c on c.mint = x.mint where false;
revoke all on public.yr_roll_t from anon, authenticated;
alter table public.yr_roll_t enable row level security;

create or replace function public.yr_cc_roll()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set synchronous_commit to 'off'
as $function$
declare wm bigint; hi bigint; now_ms bigint := yr_now(); n_t int; n_new int; n_fin int;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_cc_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'cc_wm';
  wm := greatest(coalesce(wm, now_ms - 60000), now_ms - 600000);
  hi := least(now_ms - 3000, wm + 120000);
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  insert into yr_cc (mint, dev, t0, sym, name)
  select b.mint, b.dev, b.t, left(b.symbol, 16), left(b.name, 40)
  from yr_obirth b where b.t > wm - 120000 and b.t <= hi and b.dev is not null
  on conflict do nothing;
  get diagnostics n_new = row_count;

  truncate yr_roll_t;
  insert into yr_roll_t
    select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.who, (x.vsol / x.vtok * 1e9)::real mc, c.t0, c.dev,
      (case when x.k = 1 then (x.vsol - x.sol) / nullif(x.vtok + x.tok, 0) else (x.vsol + x.sol) / nullif(x.vtok - x.tok, 0) end * 1e9)::real pre
    from yr_ticks x join yr_cc c on c.mint = x.mint
    where x.t > wm and x.t <= hi and x.vsol > 0 and x.vtok > 0;
  get diagnostics n_t = row_count;

  insert into yr_bw as w (mint, who, tok)
  select x.mint, x.who, sum(x.tok) from yr_roll_t x
  where x.k = 1 and x.who <> x.dev and x.t <= x.t0 + 3000
  group by x.mint, x.who
  on conflict (mint, who) do update set tok = w.tok + excluded.tok;
  update yr_bw w set tok = greatest(0, w.tok + a.d)
  from (
    select x.mint, x.who, sum(case when x.k = 1 then x.tok else -x.tok end) d
    from yr_roll_t x join yr_bw b on b.mint = x.mint and b.who = x.who
    where x.t > x.t0 + 3000 group by x.mint, x.who) a
  where w.mint = a.mint and w.who = a.who and a.d <> 0;

  update yr_cc c set
    n = c.n + a.n,
    last_t = greatest(coalesce(c.last_t, 0), a.lt),
    mc = a.last_mc,
    ath = greatest(c.ath, a.mx),
    ath_s = case when a.mx > c.ath then a.mx_s else c.ath_s end,
    mc0 = coalesce(c.mc0, case when c.n = 0 and a.ft < c.t0 + 60000 then a.first_pre end),
    dev_buy = c.dev_buy + coalesce(d.buy, 0),
    dev_sell = c.dev_sell + coalesce(d.sell, 0),
    dev_tok = case when d.mint is null then c.dev_tok else greatest(0, c.dev_tok + d.dtok) end,
    dev_max = case when d.mint is null then c.dev_max else greatest(c.dev_max, c.dev_tok + d.peak) end,
    sold_s = coalesce(c.sold_s, d.sold_s),
    sold_mc = coalesce(c.sold_mc, d.sold_mc),
    out_s = coalesce(c.out_s, case when d.mint is not null and greatest(c.dev_max, c.dev_tok + d.peak) > 0
                                     and c.dev_tok + d.dtok <= greatest(c.dev_max, c.dev_tok + d.peak) * 0.1
                                   then d.last_s end),
    rug_s = coalesce(c.rug_s, r.s),
    rug_drop = case when r.mint is null then c.rug_drop else greatest(coalesce(c.rug_drop, 0), r.drop) end,
    bun = coalesce(b.s / 1e9, c.bun),
    bun0 = case when b.mint is null then c.bun0 else greatest(coalesce(c.bun0, 0), b.s / 1e9) end
  from (
    select x.mint, count(*)::int n, max(x.t) lt, max(x.mc) mx, min(x.t) ft,
      (array_agg(x.pre order by x.t, x.ix))[1] first_pre,
      (array_agg(x.mc order by x.t desc, x.ix desc))[1] last_mc,
      ((array_agg(x.t order by x.mc desc, x.t))[1] - min(x.t0)) / 1000 mx_s
    from yr_roll_t x group by x.mint) a
  left join (
    select x.mint,
      coalesce(sum(x.sol) filter (where x.k = 1), 0) buy,
      coalesce(sum(x.sol) filter (where x.k = 2), 0) sell,
      sum(case when x.k = 1 then x.tok else -x.tok end) dtok,
      greatest(0, coalesce(sum(x.tok) filter (where x.k = 1), 0)) peak,
      (min(x.t) filter (where x.k = 2) - min(x.t0)) / 1000 sold_s,
      (array_agg(x.mc order by x.t) filter (where x.k = 2))[1] sold_mc,
      (max(x.t) - min(x.t0)) / 1000 last_s
    from yr_roll_t x where x.who = x.dev group by x.mint) d on d.mint = a.mint
  left join (
    select a1.mint, min((a1.t - a1.t0) / 1000)::int s, max(1 - b1.mc / nullif(a1.pre, 0))::real drop
    from yr_roll_t a1
    join yr_roll_t b1 on b1.mint = a1.mint and b1.who = b1.dev and b1.k = 2 and b1.t <= a1.t + 5000 and (b1.t > a1.t or (b1.t = a1.t and b1.ix >= a1.ix))
    where a1.who = a1.dev and a1.k = 2
    group by a1.mint
    having max(1 - b1.mc / nullif(a1.pre, 0)) >= 0.6) r on r.mint = a.mint
  left join (
    select w.mint, sum(w.tok) s from yr_bw w where w.mint in (select distinct mint from yr_roll_t) group by w.mint) b on b.mint = a.mint
  where c.mint = a.mint;

  insert into yr_cb as s (mint, b, c)
  select x.mint, ((x.t - x.t0) / 30000)::smallint, (array_agg(x.mc order by x.t desc, x.ix desc))[1]
  from yr_roll_t x where x.t >= x.t0 and x.t < x.t0 + 1200000
  group by x.mint, ((x.t - x.t0) / 30000)::smallint
  on conflict (mint, b) do update set c = excluded.c;

  with f as (
    select c.mint, c.n, c.mc0 from yr_cc c where c.p is null and c.t0 + 1230000 <= hi order by c.t0 limit 400),
  s as (
    select f.mint, f.mc0, g, cb.c, count(cb.c) over (partition by f.mint order by g) grp
    from f cross join generate_series(0, 39) g left join yr_cb cb on cb.mint = f.mint and cb.b = g
    where f.n >= 20),
  v as (
    select s.mint, g, coalesce(first_value(s.c) over (partition by s.mint, s.grp order by g), s.mc0, 28) val from s),
  arr as (select v.mint, array_agg(v.val::real order by g) p from v group by v.mint),
  upd as (
    update yr_cc c set p = coalesce(arr.p, '{}')
    from f left join arr on arr.mint = f.mint where c.mint = f.mint
    returning c.mint)
  delete from yr_cb cb using upd where cb.mint = upd.mint;
  get diagnostics n_fin = row_count;

  insert into yr_okv (k, v) values ('cc_wm', hi) on conflict (k) do update set v = excluded.v;
  return jsonb_build_object('n', n_t, 'new', n_new, 'fin', n_fin);
end $function$;

-- the cleanup that used to run every minute, once an hour
create or replace function public.yr_cc_gc()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare now_ms bigint := yr_now();
begin
  update yr_cc c set grad = true from yr_grad g where g.mint = c.mint and not c.grad;
  delete from yr_cc where t0 < now_ms - 14 * 86400000::bigint;
  delete from yr_cb cb where not exists (select 1 from yr_cc c where c.mint = cb.mint and c.p is null);
  delete from yr_bw b where not exists (select 1 from yr_cc c where c.mint = b.mint and c.t0 > now_ms - 3600000);
  delete from yr_obirth where t < now_ms - 86400000;
  delete from yr_grad where t < now_ms - 86400000;
end $function$;
revoke all on function public.yr_cc_gc() from public, anon, authenticated;

select cron.schedule('yr-cc-gc', '7 * * * *', 'select yr_cc_gc();');
select cron.schedule('yr-gc', '23 * * * *', $$delete from cron.job_run_details where end_time < now() - interval '2 hours'$$);
