-- 054: the scanner (meme waves and smart money) skips coins whose structure has gone wrong before. Measured on the
-- last 2 days, coins alive and above launch at minute 10 (yr_cc.p), what happened in the next 10 minutes:
--   creator's earlier coins (same wallet, or wallets funded by the same wallet): none of them ran, or under 30% did,
--     or 16+ coins: 0.4% doubled after minute 10, against 2.2% for a creator's first coin (5 times worse);
--   launch bundle 10% and more: dumped 40%+ after minute 10 in 12-24% of cases, against 3% without;
--   creator holding 5% and more: 10.6% dumped, against 3.3%.
-- And in the last 2 minutes: one wallet behind more than half of the buying, or the same few wallets trading back and
-- forth (buyers under 35% of the buys), is not real demand.

-- a creator's record before this coin: their own coins and those of wallets funded by the same wallet (not exchanges)
create or replace function yr_track(p_dev text, p_t0 bigint) returns table (n_past int, n_ran int)
language sql stable security definer set search_path = public as $$
  with fam as (
    select p_dev d
    union
    select f2.dev from yr_fund f1 join yr_fund f2 on f2.funder = f1.funder and f2.kind = 'wallet'
    where f1.dev = p_dev and f1.kind = 'wallet')
  select count(*)::int, count(*) filter (where q.grad or q.ath / coalesce(nullif(q.mc0, 0), 27.96) >= 3)::int
  from yr_cc q where q.dev in (select d from fam) and q.t0 < p_t0 - 1200000;
$$;
revoke all on function yr_track(text, bigint) from public, anon, authenticated;

-- true when the record is fine: a first coin, or up to 15 earlier coins with at least 30% of them running
create or replace function yr_track_ok(p_dev text, p_t0 bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select t.n_past = 0 or (t.n_past <= 15 and t.n_ran >= 0.3 * t.n_past) from yr_track(p_dev, p_t0) t;
$$;
revoke all on function yr_track_ok(text, bigint) from public, anon, authenticated;

create or replace function yr_trends_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  return (
    with b as (
      select mint, t, lower(coalesce(name, '') || ' ' || coalesce(symbol, '')) s from yr_obirth where t > now_ms - 86400000),
    w as (
      select distinct b.mint, b.t, w from b, regexp_split_to_table(regexp_replace(b.s, '[^a-z0-9 ]', ' ', 'g'), '\s+') w
      where length(w) between 3 and 20 and w !~ '^[0-9]+$'
        and w <> all (array['the','and','coin','token','inu','pump','pumpe','pumpfun','your','just','new','buy','for','sol','solana',
          'official','meme','fun','with','this','that','you','not','are','who','get','its','his','her','one','all','out','was','has',
          'our','too','can','day','now','first','real','based','super','big','little','mini','baby','king','lord','ceo','world','life',
          'time','era','moon','money','dog','cat','use','let','what','when','why','how','from','will','have','like','dont','im','go',
          'man','guy','boy','girl','best','last','only','very','more','most','make','made','got','see','say','said','way','back'])),
    agg as (
      select w, count(*) filter (where t > now_ms - 1800000) n30, count(*) n24,
        array_agg(mint) filter (where t > now_ms - 1800000) m30
      from w group by w),
    cand as (
      select w, n30, n24, m30, n30 / greatest(n24 * 1800000.0 / 86400000, 0.5) burst from agg
      where n30 >= 5 order by burst desc, n30 desc limit 20),
    hot as (
      select a.w, a.n30, a.n24, a.burst from cand a
      where not exists (
        select 1 from cand b
        where (b.burst > a.burst or (b.burst = a.burst and b.w < a.w))
          and (select count(*) from unnest(a.m30) m where m = any (b.m30)) >= 0.6 * a.n30)
      order by a.burst desc limit 8),
    coins as (
      select h.w, c.mint, c.sym, c.t0, c.n, c.mc, c.ath, coalesce(nullif(c.mc0, 0), 27.96) b0, c.bun, c.out_s, c.grad
      from hot h join w on w.w = h.w and w.t > now_ms - 3600000 join yr_cc c on c.mint = w.mint
      where c.rug_s is null and coalesce(c.bun, 0) < 0.15 and coalesce(c.bun0, 0) < 0.10 and c.ath > 0
        and coalesce(c.dev_tok, 0) < 0.05e9
        and coalesce(c.mc, 0) >= c.ath * 0.5
        and coalesce(c.mc, 0) >= coalesce(nullif(c.mc0, 0), 27.96) * 1.3
        and (select count(*) from yr_cc d where d.dev = c.dev) < 40
        and yr_track_ok(c.dev, c.t0)),
    alive as (
      select co.w, co.mint, co.sym, co.t0, co.n, co.mc / co.b0 nowx, co.ath / co.b0 hix, co.bun, co.out_s,
        (co.grad or (co.mc / co.b0 >= 10 and co.n >= 300)) moved,
        count(x.k) filter (where x.k = 1) buys2, count(x.k) filter (where x.k = 2) sells2,
        count(distinct x.who) filter (where x.k = 1) wal2,
        (array_agg(x.vsol / x.vtok order by x.t desc) filter (where x.k is not null))[1]
          / nullif((array_agg(x.vsol / x.vtok order by x.t) filter (where x.k is not null))[1], 0) - 1 ch2
      from coins co left join yr_ticks x on x.mint = co.mint and x.t > now_ms - 120000 and x.vsol > 0 and x.vtok > 0
      group by co.w, co.mint, co.sym, co.t0, co.n, co.mc, co.b0, co.ath, co.bun, co.out_s, co.grad),
    ranked as (
      select a.*,
        a.n * (1 + a.wal2 / 20.0) * (case when a.out_s is not null and a.out_s < 60 then 0.5 else 1 end) score,
        exists (select 1 from coins o where o.w = a.w and o.mint <> a.mint and lower(o.sym) = lower(a.sym)
                and o.t0 < a.t0 and o.n > a.n * 3) copy
      from alive a
      where a.moved or (a.buys2 >= 8 and coalesce(a.ch2, 0) > -0.15 and a.buys2 >= a.sells2
        -- real demand: many different buyers, not one wallet or a few trading back and forth
        and a.wal2 >= a.buys2 * 0.35
        and coalesce((select max(z.s) / nullif(sum(z.s), 0) from (
              select sum(x.sol) s from yr_ticks x where x.mint = a.mint and x.k = 1 and x.t > now_ms - 120000 group by x.who) z), 0) <= 0.5))
    select coalesce(jsonb_agg(jsonb_build_object(
      'theme', h.w, 'n30', h.n30, 'n24', h.n24, 'burst', round(h.burst::numeric, 1),
      'coins', (
        select coalesce(jsonb_agg(jsonb_build_array(r.mint, r.sym, r.t0, r.n, round(r.nowx::numeric, 2), round(r.hix::numeric, 2),
                                                    r.buys2, r.wal2, round(r.ch2::numeric, 3), r.bun, r.out_s, r.copy, r.moved)
                                  order by r.copy, r.score desc), '[]'::jsonb)
        from (select * from ranked where ranked.w = h.w order by copy, score desc limit 4) r)
    ) order by h.burst desc), '[]'::jsonb)
    from hot h);
end $$;
revoke all on function yr_trends_s() from public, authenticated;
grant execute on function yr_trends_s() to anon;

create or replace function yr_smart_s() returns jsonb
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := yr_now(); out jsonb;
begin
  perform yr_guard();
  with smart as (
    select s.who, s.wins, s.tries, s.wins::real / greatest(s.tries, 1) hit
    from yr_sm s
    where s.wins >= 3 and s.tries >= 8 and s.wins::real / greatest(s.tries, 1) >= 0.12
      and (select count(distinct d) from unnest(s.devs) d) >= 3),
  act as (
    select x.mint, sm.who, sm.wins, sm.tries, sm.hit,
      sum(case when x.k = 1 then x.sol else 0 end) bought, sum(case when x.k = 2 then x.sol else 0 end) sold,
      min(x.t) filter (where x.k = 1) first_t
    from yr_ticks x join smart sm on sm.who = x.who
    where x.t > now_ms - 600000 and x.k in (1, 2)
    group by x.mint, sm.who, sm.wins, sm.tries, sm.hit),
  coin as (
    select a.mint, count(*) filter (where a.bought > 0 and a.sold < a.bought * 0.5) n_in,
      count(*) filter (where a.sold >= a.bought * 0.5 and a.sold > 0) n_out,
      max(a.hit) best_hit, min(a.first_t) first_t,
      jsonb_agg(jsonb_build_array(left(a.who, 4) || '…' || right(a.who, 4), a.wins, round(a.hit::numeric, 2), round(a.bought::numeric, 2))
        order by a.wins desc) filter (where a.bought > 0) who
    from act a group by a.mint),
  pick as (
    select k.*, c.sym, c.t0, c.n, c.mc, c.ath, coalesce(nullif(c.mc0, 0), 27.96) b0, c.bun, c.out_s, c.grad
    from coin k join yr_cc c on c.mint = k.mint
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
  -- every call is kept once per coin, to measure later what it did next
  insert into yr_sm_sig (mint, t, n, mc)
  select e->>'mint', now_ms, (e->>'smart')::int, (e->>'mc')::real from jsonb_array_elements(out) e
  on conflict (mint) do nothing;
  return jsonb_build_object('smart', out, 'wallets', (select count(*) from yr_sm s where s.wins >= 3 and s.tries >= 8
    and s.wins::real / greatest(s.tries, 1) >= 0.12 and (select count(distinct d) from unnest(s.devs) d) >= 3),
    'learning', (select count(*) from yr_sm));
end $$;
revoke all on function yr_smart_s() from public, authenticated;
grant execute on function yr_smart_s() to anon;
