-- 076: no coin left out, and a lighter database (3 Nov 2026).
-- 1. A third of the most traded coins were missing from yeppo (110 active in 20 minutes, 33 unknown, up to 290 buyers
--    each): their launch was never seen (a launch with many bundled buys has its logs cut before the CreateEvent, and
--    PumpPortal's feed skipped them too), so the read knew neither their name nor their creator and the namesakes list
--    left out the very coin that led it. yr_unknown_active lists the coins trading now that yr_cc doesn't know;
--    yr-capture fills them in once per run (DexScreener for the name, the chain for the creator).
-- 2. The radar and the meme-wave scanner go: yeppo reads a coin only when someone opens it. Their crons (every 20 s
--    and every minute) stop; the namesakes of an opened coin still come from yr_wave_s, on demand.
create or replace function yr_unknown_active() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(mint, first_t) order by n desc), '[]'::jsonb)
  from (
    select x.mint, min(x.t) first_t, count(*) n from yr_ticks x
    where x.t > yr_now() - 600000 and not exists (select 1 from yr_cc c where c.mint = x.mint)
    group by x.mint having count(*) >= 10 order by count(*) desc limit 30) z;
$$;
revoke all on function yr_unknown_active() from public, anon, authenticated;
grant execute on function yr_unknown_active() to service_role;

select cron.unschedule('yr-radar') where exists (select 1 from cron.job where jobname = 'yr-radar');
select cron.unschedule('yr-trends') where exists (select 1 from cron.job where jobname = 'yr-trends');

-- 3. The record's real wins: coins yeppo called Momentum or Opportunity that then went ×2 or more, with how far.
create or replace function yr_wins_s() returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '10s' as $$
begin
  perform yr_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_array(mint, sym, word, round(up::numeric, 1), t) order by up desc)
    from (select * from (
      select k.mint, c.sym, k.word, k.t,
        greatest((select max(v) from unnest(c.p[(k.age / 30) + 2:40]) v), case when c.ath_s > k.age then c.ath end) / c.p[(k.age / 30) + 1] up
      from yr_calls k join yr_cc c on c.mint = k.mint
      where k.word in ('Momentum', 'Opportunity') and c.p is not null and c.p[(k.age / 30) + 1] > 0) z
    where up >= 2 order by up desc limit 12) w), '[]'::jsonb);
end $$;
revoke all on function yr_wins_s() from public;
grant execute on function yr_wins_s() to anon, authenticated;
