-- 058: like 057, in a fresh table yr_sm3. 057 also counted "still holding when the coin reached ×4" as a win: the wallets
-- it ranked best then never sold at all and bought 0.02-0.06 SOL at a time (bots that pad holders), 126 wins out of 126.
-- Now a win is a real sale: 0.1 SOL or more in, held 60 s or more, sold at ×2 or more of the price paid.
--
-- (057 notes follow.) Smart money follows traders a person can follow, not sniper bots. The first hour of 053 showed the wallets it
-- ranked best held a coin a median 5 seconds: right 54% of the time within 3 minutes of their buy, but 3 minutes
-- later the median coin was at 0.29× and 65% had lost 30%+. Following them by hand loses.
-- yr_sm3 counts a win only for a wallet that held 60 s or more after its first buy, and either sold at ×2 or more of
-- its price, or still held when the coin reached ×4. Entries flipped in under 60 s count as flips; a wallet flipping
-- more than a third of its entries is not followed. yr_sm (053) stays as it was until it is dropped.

create table if not exists yr_sm3 (
  who text primary key,
  wins int not null default 0,
  tries int not null default 0,
  flips int not null default 0,
  devs text[] not null default '{}',
  last_win bigint,
  last_t bigint
);
alter table yr_sm3 enable row level security;

create or replace function yr_sm_roll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := yr_now(); wm bigint; hi bigint; n_c int := 0; n_w int := 0; n_e int := 0;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_sm_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'sm_wm';
  hi := now_ms - 900000;
  wm := greatest(coalesce(wm, hi - 60000), hi - 180000);
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  create temp table _e on commit drop as
    with e as (
      select c.mint, c.dev, x.who, c.ath, min(x.t) tb, min(x.vsol / x.vtok * 1e9) mc_in, sum(x.sol) sol_in
      from yr_cc c
      join yr_ticks x on x.mint = c.mint and x.k = 1 and x.who <> c.dev
        and x.t > c.t0 + 3000 and x.t <= c.t0 + 480000 and x.vsol > 0 and x.vtok > 0
      where c.t0 > wm and c.t0 <= hi and c.ath > 0
        and not exists (select 1 from yr_bw b where b.mint = c.mint and b.who = x.who)
      group by c.mint, c.dev, x.who, c.ath, c.mc0
      having min(x.vsol / x.vtok * 1e9) <= coalesce(nullif(c.mc0, 0), 27.96) * 3 and sum(x.sol) >= 0.1)
    select e.*, s.ts, s.best_out,
      (s.ts is not null and s.ts < e.tb + 60000) flip,
      (not (s.ts is not null and s.ts < e.tb + 60000))
        and coalesce(s.best_out, 0) >= e.mc_in * 2 win
    from e
    left join lateral (
      select min(y.t) ts, max(y.vsol / y.vtok * 1e9) best_out from yr_ticks y
      where y.mint = e.mint and y.who = e.who and y.k = 2 and y.t >= e.tb and y.vtok > 0) s on true;
  get diagnostics n_e = row_count;
  select count(distinct mint) into n_c from _e;

  insert into yr_sm3 as s (who, wins, tries, flips, devs, last_win, last_t)
  select e.who, count(*), count(*), 0, (array_agg(e.dev))[1:12], hi, hi from _e e where e.win group by e.who
  on conflict (who) do update set
    wins = s.wins + excluded.wins, tries = s.tries + excluded.tries,
    devs = (excluded.devs || s.devs)[1:12], last_win = excluded.last_win, last_t = excluded.last_t;
  get diagnostics n_w = row_count;
  update yr_sm3 s set tries = s.tries + a.n, flips = s.flips + a.f, last_t = hi
  from (select e.who, count(*) n, count(*) filter (where e.flip) f from _e e where not e.win group by e.who) a
  where a.who = s.who;

  update yr_sm_sig g set ath_after = c.ath from yr_cc c
  where c.mint = g.mint and g.t > now_ms - 3600000 and (g.ath_after is null or c.ath > g.ath_after);

  insert into yr_okv (k, v) values ('sm_wm', hi) on conflict (k) do update set v = excluded.v;

  if extract(minute from clock_timestamp()) = 7 and extract(second from clock_timestamp()) < 30 then
    delete from yr_sm3 where (wins < 2 and last_win < now_ms - 3 * 86400000) or last_t < now_ms - 7 * 86400000;
    delete from yr_sm_sig where t < now_ms - 14 * 86400000;
  end if;
  return jsonb_build_object('coins', n_c, 'entries', n_e, 'winners', n_w);
end $$;
revoke all on function yr_sm_roll() from public, anon, authenticated;

-- smart money reads yr_sm3: 3+ sold wins from 3+ creators, 8+ entries, 12%+ hit rate, a third or less flipped
create or replace function yr_smart_s() returns jsonb
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := yr_now(); out jsonb;
begin
  perform yr_guard();
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
  return jsonb_build_object('smart', out, 'wallets', (select count(*) from yr_sm3 s where s.wins >= 3 and s.tries >= 8
    and s.wins::real / greatest(s.tries, 1) >= 0.12 and s.flips * 3 <= s.tries and (select count(distinct d) from unnest(s.devs) d) >= 3),
    'learning', (select count(*) from yr_sm3));
end $$;
revoke all on function yr_smart_s() from public, authenticated;
grant execute on function yr_smart_s() to anon;
