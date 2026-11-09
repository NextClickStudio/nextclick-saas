-- 064: the radar (2 Nov 2026). One list of the coins worth a look right now, with yeppo's quick read of each, worked
-- out by cron every 20 s and kept in yr_tcache 'radar': every visitor reads the same answer, so the database does the
-- work once whatever the number of users. yr_quick_s reads up to 10 coins on demand (coins a tweet points to that the
-- radar has not picked yet). The wallet tracker stops (yr-sm): the radar replaces it.

-- one coin, as the radar shows it: its numbers, the last 2 minutes, who could dump it, and the creator's record
create or replace function yr_quick_row(c yr_cc, now_ms bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mint', c.mint, 'sym', c.sym, 'name', left(c.name, 40), 't0', c.t0, 'n', c.n,
    'mc', round(coalesce(c.mc, 0)::numeric, 1), 'ath', round(c.ath::numeric, 1), 'b0', coalesce(nullif(c.mc0, 0), 27.96),
    'bun', round(greatest(coalesce(c.bun, 0), coalesce(c.bun0, 0))::numeric, 3), 'devTok', round((c.dev_tok / 1e9)::numeric, 3),
    'devOut', c.out_s, 'devSold', c.sold_s, 'rug', c.rug_s is not null, 'grad', c.grad,
    'farm', (select count(*) from yr_cc d where d.dev = c.dev) >= 40,
    'badDev', not yr_track_ok(c.dev, c.t0),
    'uri', (select b.uri from yr_obirth b where b.mint = c.mint),
    'b2', l.b2, 's2', l.s2, 'w2', l.w2, 'ch2', round(l.ch2::numeric, 3),
    'risk', case when c.t0 > now_ms - 1190000 then yr_risk(c.mint, c.dev, c.t0) end)
  from (
    select count(*) filter (where x.k = 1) b2, count(*) filter (where x.k = 2) s2, count(distinct x.who) filter (where x.k = 1) w2,
      (array_agg(x.vsol / x.vtok order by x.t desc))[1] / nullif((array_agg(x.vsol / x.vtok order by x.t))[1], 0) - 1 ch2
    from yr_ticks x where x.mint = c.mint and x.t > now_ms - 120000 and x.vsol > 0 and x.vtok > 0) l;
$$;
revoke all on function yr_quick_row(yr_cc, bigint) from public, anon, authenticated;

-- the radar: launches of the last 20 minutes (to match against tweets and waves in the browser) and the 30 young coins
-- trading most right now, read
create or replace function yr_radar_calc() returns void
language plpgsql security definer set search_path = public set statement_timeout = '15s' as $$
declare now_ms bigint := yr_now();
begin
  insert into yr_tcache (k, at, data) values ('radar', clock_timestamp(), jsonb_build_object(
    'now', now_ms,
    'births', coalesce((
      select jsonb_agg(jsonb_build_array(b.mint, left(b.symbol, 16), left(b.name, 40), b.t) order by b.t desc)
      from (select * from yr_obirth where t > now_ms - 1200000 order by t desc limit 600) b), '[]'::jsonb),
    'active', coalesce((
      select jsonb_agg(yr_quick_row(c, now_ms) order by c.n desc)
      from (select * from yr_cc where t0 > now_ms - 3600000 and last_t > now_ms - 180000 and n >= 15 order by n desc limit 30) c), '[]'::jsonb)))
  on conflict (k) do update set at = excluded.at, data = excluded.data;
end $$;
revoke all on function yr_radar_calc() from public, anon, authenticated;

create or replace function yr_radar_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return (select data from yr_tcache where k = 'radar');
end $$;
revoke all on function yr_radar_s() from public, authenticated;
grant execute on function yr_radar_s() to anon;

create or replace function yr_quick_s(p_mints text[]) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '5s' as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_mints is null or cardinality(p_mints) = 0 or cardinality(p_mints) > 10 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(yr_quick_row(c, now_ms)) from yr_cc c where c.mint = any (p_mints)), '[]'::jsonb);
end $$;
revoke all on function yr_quick_s(text[]) from public, authenticated;
grant execute on function yr_quick_s(text[]) to anon;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'yr-sm') then perform cron.unschedule('yr-sm'); end if;
  if exists (select 1 from cron.job where jobname = 'yr-radar') then perform cron.unschedule('yr-radar'); end if;
end $$;
select cron.schedule('yr-radar', '20 seconds', 'select yr_radar_calc()');
