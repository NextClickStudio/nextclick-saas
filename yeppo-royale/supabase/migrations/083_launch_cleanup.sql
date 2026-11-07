-- 083: launch cleanup (4 Nov 2026).
--  * the nightly yr-gc job failed every night since 077 (yr_paper_gc read yr_paper_acct, dropped there), so the cron
--    history was not trimmed either: the job now only trims it
--  * yr_unknown_active (capture, every 30 s) merged every coin ever seen against the last 10 minutes' trades, up to
--    8 s and close to the statement timeout: the last 10 minutes are counted first (index on t), then checked one by one
--  * the same for yr_xlink_need_active
--  * the 85 functions of the retired game, paper wallets, radar, trends, early and quick reads are dropped: their
--    tables are gone (077) or nothing calls them, and they were still callable from outside
select cron.alter_job((select jobid from cron.job where jobname = 'yr-gc'),
  command := $$delete from cron.job_run_details where end_time < now() - interval '6 hours'$$);
delete from cron.job_run_details where end_time < now() - interval '6 hours';

create or replace function yr_unknown_active() returns jsonb
language sql stable security definer set search_path = public as $$
  with z as materialized (
    select x.mint, min(x.t) first_t, count(*) n from yr_ticks x
    where x.t > (select yr_now() - 600000)
    group by x.mint having count(*) >= 10)
  select coalesce(jsonb_agg(jsonb_build_array(a.mint, a.first_t) order by a.n desc), '[]'::jsonb)
  from (select z.* from z where not exists (select 1 from yr_cc c where c.mint = z.mint) order by z.n desc limit 30) a;
$$;

create or replace function yr_xlink_need_active() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(b.mint, b.uri, b.t)), '[]'::jsonb)
  from (
    select x.mint from yr_ticks x where x.t > (select yr_now() - 600000)
    group by x.mint having count(*) >= 30 order by count(*) desc limit 60) a
  join yr_obirth b on b.mint = a.mint
  where b.uri is not null and not exists (select 1 from yr_xlink l where l.mint = a.mint)
  limit 20;
$$;

do $$
declare s text;
begin
  foreach s in array array[
    'yr_arena(text)', 'yr_auto_curate(integer)', 'yr_capture_flush(jsonb,jsonb,jsonb,jsonb)', 'yr_coin_stats(bigint,integer,integer)',
    'yr_curate(integer,text,text,jsonb)', 'yr_devs_s(text[])', 'yr_duel_cancel(text,uuid)', 'yr_duel_emote(text,uuid,integer)',
    'yr_duel_feed(uuid,integer,integer)', 'yr_duel_find(text)', 'yr_duel_finish(uuid)', 'yr_duel_ghostify(uuid)', 'yr_duel_recent(integer)',
    'yr_duel_resolve(uuid)', 'yr_duel_sweep()', 'yr_duel_trade(text,uuid,text,double precision)', 'yr_duel(uuid,text)', 'yr_early_s(text[])',
    'yr_equity(uuid,integer)', 'yr_feed(uuid,integer)', 'yr_fill_bots(uuid)', 'yr_ghost_eq(integer,integer,integer,integer,double precision)',
    'yr_ingest(text,jsonb,jsonb)', 'yr_join(text,text)', 'yr_lbook(uuid,integer)', 'yr_lduel_cancel(text,uuid)',
    'yr_lduel_fill(text,uuid,text,text,text,double precision,double precision,double precision,double precision,double precision)',
    'yr_lduel_find(text)', 'yr_lduel_ghostify(uuid)', 'yr_lduel_jobs(uuid)', 'yr_lduel_settle(uuid,boolean)', 'yr_lduel_sweep()',
    'yr_lduel(uuid,text)', 'yr_leq(uuid,integer)', 'yr_lobby(text)', 'yr_match(uuid,text)', 'yr_me(text)', 'yr_my_duels(text)',
    'yr_now_ms(uuid)', 'yr_paper_auto()', 'yr_paper_board(text)', 'yr_paper_buy(uuid,text,double precision,real,real,real)',
    'yr_paper_curve(text)', 'yr_paper_gc()', 'yr_paper_new(text,text)', 'yr_paper_open()', 'yr_paper_reset(uuid)',
    'yr_paper_sell(uuid,text,double precision,text)', 'yr_paper_state(uuid)', 'yr_pick_coin(text[],integer[],integer[],integer,boolean,integer)',
    'yr_pick_rounds(uuid)', 'yr_put_template(integer,jsonb,jsonb,jsonb,jsonb)', 'yr_px(integer,integer)', 'yr_quick_row(yr_cc,bigint)',
    'yr_quick_s(text[])', 'yr_radar_calc()', 'yr_radar_s()', 'yr_rcode()', 'yr_rduel_accept(text,text)', 'yr_rduel_board(text)',
    'yr_rduel_cancel(text,text)', 'yr_rduel_create(text,integer)', 'yr_rduel_find(text,integer,boolean)', 'yr_rduel_finish(uuid)',
    'yr_rduel_get(text,text)', 'yr_rduel_jobs()', 'yr_rduel_leave(text)', 'yr_rduel_tick(uuid)', 'yr_resolve(uuid)', 'yr_results(text,uuid)',
    'yr_rscore(uuid)', 'yr_set_avatar(text,jsonb)', 'yr_signup(text,jsonb)', 'yr_t_coin(text)', 'yr_t_hot()', 'yr_t_pulse()',
    'yr_trade(text,uuid,integer,text,double precision)', 'yr_trends_calc()', 'yr_trends_s()', 'yr_twallet_add(text,text,text)',
    'yr_twallet_pending(text)', 'yr_twallet_signed(uuid,text,text)', 'yr_wallet_check(text)', 'yr_wallet_link(uuid,text)', 'yr_wallet_nonce(text)']
  loop
    execute format('drop function if exists public.%s', s);
  end loop;
end $$;

-- renewals follow the key the order was made with (yr-pay), never the paying wallet: exchanges pay many buyers
-- from one wallet, and the second buyer would have been handed the first one's key
alter table yr_orders add column if not exists renew text;
