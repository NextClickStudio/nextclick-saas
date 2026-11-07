-- 094: deeper checks for the read, and the radar's log. Information next to the verdict; the verdict itself does not
-- change. All read from tables yeppo already keeps, plus one small cache of wallet ages.
--   yr_deep_s(mint): same-amount buys in the first 3 minutes (one hand split across wallets), how many coins the
--     creator launched in 24 h (serial launcher), an earlier coin with the same ticker that already ran (a copy), how
--     the X account linked by the coin did on its other coins (recycled account), and buyers now against 5 minutes ago.
--   yr_wfresh: per wallet, how many transactions it has and since when (filled by the edge function yr-fresh from the
--     public node, kept 24 h): "fresh" holders that bought a handful of coins in their whole life look like spam wallets.
--   yr_radar_log: every early call the radar showed, with the wallets, the checklist and the reason (kept 14 days),
--     to measure them later.

create index if not exists yr_cc_sym on yr_cc (lower(sym), t0);

create unlogged table if not exists yr_wfresh (
  who text primary key,
  n int not null,           -- transactions seen, at most 25 (enough to tell fresh from not)
  first_t bigint,           -- the oldest of them (ms)
  t bigint not null         -- when yeppo looked
);

create table if not exists yr_radar_log (
  key text not null,
  mint text not null,
  t bigint not null,
  mc_usd real,
  wallets jsonb,
  checks jsonb,
  pass boolean,
  reason text,
  primary key (key, mint)
);
alter table yr_radar_log enable row level security;

create or replace function yr_deep_s(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now(); c record; handle text; out jsonb;
begin
  perform yr_guard();
  select mint, dev, t0, sym, coalesce(nullif(mc0, 0), 27.96) b0 into c from yr_cc where mint = p_mint;
  if c.mint is null then return null; end if;
  select lower(x.handle) into handle from yr_xlink x where x.mint = p_mint;
  with early as (
    select x.who, sum(x.sol) sol, sum(x.tok) tok from yr_ticks x
    where x.mint = p_mint and x.k = 1 and x.who <> c.dev and x.t < c.t0 + 180000
    group by x.who),
  same_sol as (
    select round(sol::numeric, 3) amt, count(*) n, sum(tok) tok from early where sol >= 0.05 group by 1 having count(*) >= 3 order by count(*) desc limit 3),
  same_tok as (
    select round((tok / 1e9 * 100)::numeric, 2) pct, count(*) n, sum(tok) tok from early where tok > 0 group by 1 having count(*) >= 3 order by count(*) desc limit 3)
  select jsonb_build_object(
    'early', (select count(*) from early),
    'seen', exists (select 1 from yr_ticks x where x.mint = p_mint and x.t < c.t0 + 60000),
    'same_sol', (select coalesce(jsonb_agg(jsonb_build_object('amt', amt, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_sol),
    'same_tok', (select coalesce(jsonb_agg(jsonb_build_object('pct', pct, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_tok),
    'dev_24h', (select count(*) from yr_cc d where d.dev = c.dev and d.t0 > now_ms - 86400000),
    'copy_of', (select jsonb_build_object('mint', o.mint, 'sym', o.sym, 'x', round((o.ath / coalesce(nullif(o.mc0, 0), 27.96))::numeric, 1), 't0', o.t0)
      from yr_cc o where lower(o.sym) = lower(c.sym) and o.mint <> c.mint and o.t0 < c.t0 and o.t0 > now_ms - 7 * 86400000
        and o.ath >= coalesce(nullif(o.mc0, 0), 27.96) * 10
      order by o.ath desc limit 1),
    'x_handle', handle,
    'x_other', case when handle is null then null else (select jsonb_build_object('n', count(*),
        'died', count(*) filter (where o.rug_s is not null or (o.ath < coalesce(nullif(o.mc0, 0), 27.96) * 2 and o.t0 < now_ms - 3600000)))
      from yr_xlink l join yr_cc o on o.mint = l.mint where lower(l.handle) = handle and l.mint <> p_mint and o.t0 > now_ms - 14 * 86400000) end,
    'buyers5', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'buyers5_before', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 600000 and x.t <= now_ms - 300000),
    'buys5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'sells5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 2 and x.t > now_ms - 300000))
  into out;
  return out;
end $$;
revoke all on function yr_deep_s(text) from public, authenticated;
grant execute on function yr_deep_s(text) to anon;

-- the wallet ages yeppo already knows (24 h); the edge function yr-fresh looks up the rest
create or replace function yr_wfresh_s(p_who text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return (select coalesce(jsonb_object_agg(f.who, jsonb_build_array(f.n, f.first_t)), '{}') from yr_wfresh f
          where f.who = any (p_who[1:30]) and f.t > yr_now() - 86400000);
end $$;
revoke all on function yr_wfresh_s(text[]) from public, authenticated;
grant execute on function yr_wfresh_s(text[]) to anon;

-- the radar logs an early call once per user and coin
create or replace function yr_radar_log_s(p_key text, p_dev text, p_mint text, p_mc real, p_wallets jsonb, p_checks jsonb, p_pass boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  perform yr_guard();
  k := yr_radar_key(p_key, p_dev);
  if p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then return; end if;
  insert into yr_radar_log (key, mint, t, mc_usd, wallets, checks, pass, reason)
  values (k, p_mint, yr_now(), p_mc, p_wallets, p_checks, p_pass, left(p_reason, 300))
  on conflict (key, mint) do nothing;
  delete from yr_radar_log where t < yr_now() - 14 * 86400000;
end $$;
revoke all on function yr_radar_log_s(text, text, text, real, jsonb, jsonb, boolean, text) from public, authenticated;
grant execute on function yr_radar_log_s(text, text, text, real, jsonb, jsonb, boolean, text) to anon;
