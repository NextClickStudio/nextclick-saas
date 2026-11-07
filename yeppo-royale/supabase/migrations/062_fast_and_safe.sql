-- 062: a lighter database, faster waves, and no Momentum on coins snipers or one big wallet can dump (2 Nov 2026).
-- The free database ran out of disk budget: the creator index rewrote every active coin 3-4 times every 30 s (each
-- write touching 5 indexes), and every scanner visit worked out the waves and the smart money again. Now:
-- 1. yr_cc_roll writes each active coin once per run, and yr_cc keeps room on its pages (fillfactor 80) so those
--    writes no longer touch its indexes.
-- 2. The waves and the smart money are worked out by cron (every minute) and kept in yr_tcache; the
--    site only reads the cache. A wave now shows as soon as 3 coins with the same word launch within 5 minutes.
-- 3. yr_risk(mint): snipers (first buys within 15 s of launch) and what they still hold, the biggest single wallet,
--    a big early holder dumping now, and proven wallets holding it. Returned by yr_creator as 'risk', in place of
--    the crowd (the "Crowd & volatility" box is gone).
-- 4. yr_wave_s: exact name / ticker matches first, the original marked, sniper share per coin, dead coins counted
--    apart.
-- 5. The paper-trading Lab bots (yr-paper, yr-px) stop; the money trail cron runs every 2 minutes.

-- 1 ------------------------------------------------------------------------------------------------------------
alter table yr_cc set (fillfactor = 80);

create or replace function yr_cc_roll() returns jsonb
language plpgsql security definer set search_path = public as $$
declare wm bigint; hi bigint; now_ms bigint := yr_now(); n_t int; n_new int; n_fin int;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_cc_roll')) then return jsonb_build_object('busy', true); end if;
  select v into wm from yr_okv where k = 'cc_wm';
  wm := greatest(coalesce(wm, now_ms - 60000), now_ms - 600000);
  hi := least(now_ms - 3000, wm + 60000);
  if hi <= wm then return jsonb_build_object('n', 0); end if;

  insert into yr_cc (mint, dev, t0, sym, name)
  select b.mint, b.dev, b.t, left(b.symbol, 16), left(b.name, 40)
  from yr_obirth b where b.t > wm - 120000 and b.t <= hi and b.dev is not null
  on conflict do nothing;
  get diagnostics n_new = row_count;

  create temp table _t on commit drop as
    select x.mint, x.t, x.ix, x.k, x.sol, x.tok, x.who, (x.vsol / x.vtok * 1e9)::real mc, c.t0, c.dev,
      (case when x.k = 1 then (x.vsol - x.sol) / nullif(x.vtok + x.tok, 0) else (x.vsol + x.sol) / nullif(x.vtok - x.tok, 0) end * 1e9)::real pre
    from yr_ticks x join yr_cc c on c.mint = x.mint
    where x.t > wm and x.t <= hi and x.vsol > 0 and x.vtok > 0;
  get diagnostics n_t = row_count;

  -- the launch bundle (first 3 s buyers) first, so the one write per coin below carries its share too
  insert into yr_bw as w (mint, who, tok)
  select x.mint, x.who, sum(x.tok) from _t x
  where x.k = 1 and x.who <> x.dev and x.t <= x.t0 + 3000
  group by x.mint, x.who
  on conflict (mint, who) do update set tok = w.tok + excluded.tok;
  update yr_bw w set tok = greatest(0, w.tok + a.d)
  from (
    select x.mint, x.who, sum(case when x.k = 1 then x.tok else -x.tok end) d
    from _t x join yr_bw b on b.mint = x.mint and b.who = x.who
    where x.t > x.t0 + 3000 group by x.mint, x.who) a
  where w.mint = a.mint and w.who = a.who and a.d <> 0;

  -- one write per active coin: trades and price, the creator's buys and sells, a creator dump, the bundle
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
    from _t x group by x.mint) a
  left join (
    select x.mint,
      coalesce(sum(x.sol) filter (where x.k = 1), 0) buy,
      coalesce(sum(x.sol) filter (where x.k = 2), 0) sell,
      sum(case when x.k = 1 then x.tok else -x.tok end) dtok,
      greatest(0, coalesce(sum(x.tok) filter (where x.k = 1), 0)) peak,
      (min(x.t) filter (where x.k = 2) - min(x.t0)) / 1000 sold_s,
      (array_agg(x.mc order by x.t) filter (where x.k = 2))[1] sold_mc,
      (max(x.t) - min(x.t0)) / 1000 last_s
    from _t x where x.who = x.dev group by x.mint) d on d.mint = a.mint
  left join (
    select a1.mint, min((a1.t - a1.t0) / 1000)::int s, max(1 - b1.mc / nullif(a1.pre, 0))::real drop
    from _t a1
    join _t b1 on b1.mint = a1.mint and b1.who = b1.dev and b1.k = 2 and b1.t <= a1.t + 5000 and (b1.t > a1.t or (b1.t = a1.t and b1.ix >= a1.ix))
    where a1.who = a1.dev and a1.k = 2
    group by a1.mint
    having max(1 - b1.mc / nullif(a1.pre, 0)) >= 0.6) r on r.mint = a.mint
  left join (
    select w.mint, sum(w.tok) s from yr_bw w where w.mint in (select distinct mint from _t) group by w.mint) b on b.mint = a.mint
  where c.mint = a.mint;

  insert into yr_cb as s (mint, b, c)
  select x.mint, ((x.t - x.t0) / 30000)::smallint, (array_agg(x.mc order by x.t desc, x.ix desc))[1]
  from _t x where x.t >= x.t0 and x.t < x.t0 + 1200000
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

  if extract(second from clock_timestamp()) < 15 then
    update yr_cc c set grad = true from yr_grad g where g.mint = c.mint and not c.grad;
    delete from yr_cc where t0 < now_ms - 14 * 86400000::bigint;
    delete from yr_cb cb where not exists (select 1 from yr_cc c where c.mint = cb.mint and c.p is null);
    delete from yr_bw b where not exists (select 1 from yr_cc c where c.mint = b.mint and c.t0 > now_ms - 3600000);
    delete from yr_obirth where t < now_ms - 86400000;
    delete from yr_grad where t < now_ms - 86400000;
  end if;

  return jsonb_build_object('n', n_t, 'new', n_new, 'fin', n_fin);
end $$;
revoke all on function yr_cc_roll() from public, anon, authenticated;

-- 3 ------------------------------------------------------------------------------------------------------------
-- a wallet with a record of getting into future runners early (the same bar as the smart-money picks)
create or replace function yr_sm_proven(s yr_sm3) returns boolean
language sql immutable as $$
  select s.wins >= 3 and s.tries >= 8 and s.wins::real / greatest(s.tries, 1) >= 0.12 and s.flips * 3 <= s.tries
    and (select count(distinct d) from unnest(s.devs) d) >= 3;
$$;

-- who could dump this coin on a buyer, from its own trades of the last 20 minutes (index yr_ticks_mint_t). Shares
-- are of the 1B supply. 'full': the coin is younger than 20 minutes, so every wallet's whole history is in view and
-- the holdings are exact; older coins only get the dumpers and the sellers.
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
    -- a wallet that bought 3%+ of the supply in view and sold half of it or more in the last 3 minutes
    'dumpers', (select count(*) from w where bought >= 0.03e9 and sold3 >= bought * 0.5),
    'dumped', round((coalesce((select sum(sold3) from w where bought >= 0.03e9 and sold3 >= bought * 0.5), 0) / 1e9)::numeric, 4),
    'sell2', round(coalesce((select sum(sell2) from w), 0)::numeric, 3),
    'topSell2', round(coalesce((select max(sell2) from w), 0)::numeric, 3),
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)));
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;

create or replace function yr_creator(p_mint text, p_dev text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me yr_cc; d text; now_ms bigint := yr_now(); t_from bigint;
begin
  select * into me from yr_cc where mint = p_mint;
  d := coalesce(me.dev, nullif(p_dev, ''));
  t_from := greatest(coalesce(me.t0, 0), now_ms - 1200000);
  return jsonb_build_object(
    'now', now_ms,
    'dev', d,
    'me', case when me.mint is null then null else jsonb_build_object(
      't0', me.t0, 'sym', me.sym, 'name', me.name, 'n', me.n, 'mc', me.mc, 'ath', me.ath, 'ath_s', me.ath_s,
      'dev_buy', me.dev_buy, 'dev_sell', me.dev_sell, 'dev_tok', me.dev_tok, 'dev_max', me.dev_max,
      'sold_s', me.sold_s, 'sold_mc', me.sold_mc, 'out_s', me.out_s, 'grad', me.grad, 'p', me.p, 'mc0', me.mc0, 'rug_s', me.rug_s, 'rug_drop', me.rug_drop, 'bun', me.bun, 'bun0', me.bun0) end,
    'uri', (select b.uri from yr_obirth b where b.mint = p_mint),
    'total', (select count(*) from yr_cc where dev = d),
    'coins', coalesce((
      select jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, c.ath, c.ath_s, c.mc, c.dev_buy, c.dev_sell,
                                         c.sold_s, c.sold_mc, c.out_s, c.grad, c.p, c.mc0, c.rug_s, c.rug_drop) order by c.t0 desc)
      from (select * from yr_cc where dev = d and mint <> p_mint order by t0 desc limit 30) c), '[]'::jsonb),
    -- 10 s steps of the last 20 minutes: [step, close, high, low, buys, sells, SOL in, SOL out]
    'steps', coalesce((
      select jsonb_agg(jsonb_build_array(z.b, z.c, z.h, z.l, z.nb, z.ns, z.vb, z.vs) order by z.b)
      from (
        select ((x.t - t_from) / 10000)::int b,
          ((array_agg(x.vsol / x.vtok order by x.t desc))[1] * 1e9)::real c,
          (max(x.vsol / x.vtok) * 1e9)::real h, (min(x.vsol / x.vtok) * 1e9)::real l,
          count(*) filter (where x.k = 1) nb, count(*) filter (where x.k = 2) ns,
          round(coalesce(sum(x.sol) filter (where x.k = 1), 0)::numeric, 3) vb,
          round(coalesce(sum(x.sol) filter (where x.k = 2), 0)::numeric, 3) vs
        from yr_ticks x where x.mint = p_mint and x.t > t_from and x.vsol > 0 and x.vtok > 0
        group by 1) z), '[]'::jsonb),
    'from', t_from,
    'w60', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 60000),
    'w120', (select count(distinct who) from yr_ticks where mint = p_mint and t > now_ms - 120000),
    'risk', yr_risk(p_mint, d, me.t0));
end $$;
revoke all on function yr_creator(text, text) from public, anon, authenticated;

drop function if exists yr_crowd(text);

-- 2 ------------------------------------------------------------------------------------------------------------
-- the waves, worked out by cron and kept in yr_tcache 'trends'. A word is a wave when it launched far more often in
-- the last 30 minutes than over the last 6 hours, or 3+ times in the last 5 minutes.
create or replace function yr_trends_calc() returns jsonb
language plpgsql security definer set search_path = public set statement_timeout = '15s' as $$
declare now_ms bigint := yr_now(); res jsonb;
begin
  res := (
    with b as (
      select mint, t, lower(coalesce(name, '') || ' ' || coalesce(symbol, '')) s from yr_obirth where t > now_ms - 21600000),
    w as (
      select distinct b.mint, b.t, w from b, regexp_split_to_table(regexp_replace(b.s, '[^a-z0-9 ]', ' ', 'g'), '\s+') w
      where length(w) between 3 and 20 and w !~ '^[0-9]+$'
        and w <> all (array['the','and','coin','token','inu','pump','pumpe','pumpfun','your','just','new','buy','for','sol','solana',
          'official','meme','fun','with','this','that','you','not','are','who','get','its','his','her','one','all','out','was','has',
          'our','too','can','day','now','first','real','based','super','big','little','mini','baby','king','lord','ceo','world','life',
          'time','era','moon','money','dog','cat','use','let','what','when','why','how','from','will','have','like','dont','im','go',
          'man','guy','boy','girl','best','last','only','very','more','most','make','made','got','see','say','said','way','back'])),
    agg as (
      select w, count(*) filter (where t > now_ms - 1800000) n30, count(*) filter (where t > now_ms - 300000) n5, count(*) n6h,
        max(t) last_t, array_agg(mint) filter (where t > now_ms - 1800000) m30
      from w group by w),
    cand as (
      select w, n30, n5, n6h * 4 n24, m30, last_t,
        greatest(n30 / greatest(n6h * 1800000.0 / 21600000, 0.5), n5 / greatest(n6h * 300000.0 / 21600000, 0.25)) burst
      from agg
      where n30 >= 5 or n5 >= 3 order by burst desc, n30 desc limit 20),
    hot as (
      select a.w, a.n30, a.n5, a.n24, a.burst, a.last_t from cand a
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
        and a.wal2 >= a.buys2 * 0.35
        and coalesce((select max(z.s) / nullif(sum(z.s), 0) from (
              select sum(x.sol) s from yr_ticks x where x.mint = a.mint and x.k = 1 and x.t > now_ms - 120000 group by x.who) z), 0) <= 0.5))
    select coalesce(jsonb_agg(jsonb_build_object(
      'theme', h.w, 'n30', h.n30, 'n5', h.n5, 'n24', h.n24, 'burst', round(h.burst::numeric, 1), 'last', h.last_t,
      'coins', (
        select coalesce(jsonb_agg(jsonb_build_array(r.mint, r.sym, r.t0, r.n, round(r.nowx::numeric, 2), round(r.hix::numeric, 2),
                                                    r.buys2, r.wal2, round(r.ch2::numeric, 3), r.bun, r.out_s, r.copy, r.moved)
                                  order by r.copy, r.score desc), '[]'::jsonb)
        from (select * from ranked where ranked.w = h.w order by copy, score desc limit 4) r)
    ) order by h.burst desc), '[]'::jsonb)
    from hot h);
  insert into yr_tcache (k, at, data) values ('trends', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;
revoke all on function yr_trends_calc() from public, anon, authenticated;

create or replace function yr_trends_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return coalesce((select data from yr_tcache where k = 'trends'), '[]'::jsonb);
end $$;
revoke all on function yr_trends_s() from public, authenticated;
grant execute on function yr_trends_s() to anon;

-- the smart money: yr_smart_calc (unchanged) runs every minute in cron; the site reads its last answer
create or replace function yr_smart_keep() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into yr_tcache (k, at, data) values ('smart', clock_timestamp(), yr_smart_calc())
  on conflict (k) do update set at = excluded.at, data = excluded.data;
end $$;
revoke all on function yr_smart_keep() from public, anon, authenticated;

create or replace function yr_smart_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return (select data || jsonb_build_object('at', (extract(epoch from at) * 1000)::bigint) from yr_tcache where k = 'smart');
end $$;
revoke all on function yr_smart_s() from public, authenticated;
grant execute on function yr_smart_s() to anon;

-- 4 ------------------------------------------------------------------------------------------------------------
-- every coin of the last 2 hours with the wave's word in its name or ticker. 'match': 2 = the ticker is the word,
-- 1 = the name is the word, 0 = the word is somewhere in the name. 'orig': the first coin with that exact ticker.
-- 'sn': share snipers still hold (coins under 20 minutes). Dead coins (no trade for 10 minutes, never past ×1.3)
-- come last and are counted in 'dead' by the site.
create or replace function yr_wave_s(p_theme text) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '6s' as $$
declare now_ms bigint := yr_now(); th text := lower(coalesce(p_theme, ''));
begin
  perform yr_guard();
  if th !~ '^[a-z0-9]{3,20}$' then return '[]'::jsonb; end if;
  return (
    with b as (
      select o.mint, o.t, o.name, o.symbol, o.dev,
        regexp_replace(lower(coalesce(o.symbol, '')), '[^a-z0-9]', '', 'g') s_norm,
        regexp_replace(lower(coalesce(o.name, '')), '[^a-z0-9]', '', 'g') n_norm
      from yr_obirth o
      where o.t > now_ms - 7200000
        and regexp_replace(lower(coalesce(o.name, '') || ' ' || coalesce(o.symbol, '')), '[^a-z0-9 ]', ' ', 'g') ~ ('(^| )' || th || '( |$)')),
    c as (
      select b.mint, b.t, coalesce(c.sym, b.symbol) sym, coalesce(c.name, b.name) name, c.n, c.mc, c.ath,
        coalesce(nullif(c.mc0, 0), 27.96) b0, c.bun, c.bun0, c.out_s, c.rug_s, c.grad, c.dev_tok, coalesce(c.dev, b.dev, '') dev,
        coalesce(c.last_t, b.t) last_t,
        case when b.s_norm = th then 2 when b.n_norm = th then 1 else 0 end m
      from b left join yr_cc c on c.mint = b.mint),
    o as (select min(t) t from c where m = 2),
    tagged as (
      select c.*, (c.last_t < now_ms - 600000 and coalesce(c.ath, 0) < c.b0 * 1.3) dead from c),
    top as (
      select * from tagged
      order by dead, (last_t > now_ms - 300000) desc, m desc, coalesce(mc, 0) desc, t desc limit 60),
    live as (
      select t.mint, count(*) filter (where x.k = 1 and x.t > now_ms - 120000) b2, count(*) filter (where x.k = 2 and x.t > now_ms - 120000) s2,
        count(distinct x.who) filter (where x.k = 1 and x.t > now_ms - 120000) w2,
        (array_agg(x.vsol / x.vtok order by x.t desc) filter (where x.t > now_ms - 120000))[1]
          / nullif((array_agg(x.vsol / x.vtok order by x.t) filter (where x.t > now_ms - 120000))[1], 0) - 1 ch2
      from top t join yr_ticks x on x.mint = t.mint and x.t > now_ms - 120000 and x.k in (1, 2) and x.vsol > 0 and x.vtok > 0
      where not t.dead
      group by t.mint),
    sn as (
      select f.mint, sum(greatest(f.net, 0)) / 1e9 held from (
        select x.mint, x.who, min(x.t) filter (where x.k = 1) fb, sum(case when x.k = 1 then x.tok else -x.tok end) net, min(t.t) t0
        from top t join yr_ticks x on x.mint = t.mint and x.k in (1, 2) and x.who <> t.dev
        where not t.dead and t.t > now_ms - 1190000
        group by x.mint, x.who) f
      where f.fb <= f.t0 + 15000 group by f.mint)
    select coalesce(jsonb_agg(jsonb_build_object(
        'mint', t.mint, 'sym', t.sym, 'name', left(t.name, 40), 't0', t.t, 'n', coalesce(t.n, 0), 'last', t.last_t,
        'mc', round(coalesce(t.mc, 0)::numeric, 1), 'ath', round(coalesce(t.ath, 0)::numeric, 1),
        'nowx', round((coalesce(t.mc, 0) / t.b0)::numeric, 2), 'hix', round((coalesce(t.ath, 0) / t.b0)::numeric, 2),
        'b2', coalesce(l.b2, 0), 's2', coalesce(l.s2, 0), 'w2', coalesce(l.w2, 0), 'ch2', round(l.ch2::numeric, 3),
        'bun', round(greatest(coalesce(t.bun, 0), coalesce(t.bun0, 0))::numeric, 2), 'out', t.out_s,
        'grad', coalesce(t.grad, false) or (coalesce(t.mc, 0) / t.b0 >= 10 and coalesce(t.n, 0) >= 300),
        'match', t.m, 'orig', t.m = 2 and t.t = (select o.t from o), 'dead', t.dead,
        'sn', round(s.held::numeric, 3),
        'flag', case
          when t.rug_s is not null then 'rug'
          when coalesce(t.bun, 0) >= 0.15 or coalesce(t.bun0, 0) >= 0.10 then 'bundle'
          when coalesce(s.held, 0) >= 0.20 then 'snipers'
          when coalesce(t.dev_tok, 0) >= 0.05e9 then 'devbag'
          when t.ath > 0 and coalesce(t.mc, 0) < t.ath * 0.5 then 'dumped'
          when t.dev <> '' and (select count(*) from yr_cc d where d.dev = t.dev) >= 40 then 'farm'
          when t.dev <> '' and not yr_track_ok(t.dev, t.t) then 'creator'
          else null end)
      order by t.dead, (t.last_t > now_ms - 300000) desc, t.m desc, coalesce(t.mc, 0) desc, t.t desc), '[]'::jsonb)
    from top t left join live l on l.mint = t.mint left join sn s on s.mint = t.mint);
end $$;
revoke all on function yr_wave_s(text) from public, authenticated;
grant execute on function yr_wave_s(text) to anon;

-- 5 ------------------------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'yr-paper') then perform cron.unschedule('yr-paper'); end if;
  if exists (select 1 from cron.job where jobname = 'yr-px') then perform cron.unschedule('yr-px'); end if;
  if exists (select 1 from cron.job where jobname = 'yr-trends') then perform cron.unschedule('yr-trends'); end if;
end $$;
-- every minute: on the free database's slow disk one run can take half a minute
select cron.schedule('yr-trends', '* * * * *', 'select yr_trends_calc()');
select cron.alter_job((select jobid from cron.job where jobname = 'yr-sm'), command := 'select yr_sm_roll(); select yr_smart_keep();');
select cron.alter_job((select jobid from cron.job where jobname = 'yr-fund'), schedule := '*/2 * * * *');
-- the run log of jobs that run every few seconds fills fast: keep 6 hours
select cron.alter_job((select jobid from cron.job where jobname = 'yr-gc'),
  command := replace((select command from cron.job where jobname = 'yr-gc'), 'interval ''2 day', 'interval ''6 hour'));

-- 6 ------------------------------------------------------------------------------------------------------------
-- paper trading is gone from yeppo: its functions no longer answer the public key (the tables stay, untouched)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'yr_paper%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- the first answers, so the site has waves and smart money right away
select yr_trends_calc();
select yr_smart_keep();
