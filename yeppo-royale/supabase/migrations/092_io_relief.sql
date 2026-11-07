-- 092: the free disk ran out of write budget on 6 Nov (~12:00 UTC: statement timeouts, cron jobs unable to start,
-- the database refusing connections). Most writes to logged tables come from yr_cc_roll updating yr_cc. It now runs
-- every minute (was every 30 s), and may take up to two minutes of trades per run so it catches up after a skipped run.
do $$ begin
  execute replace(pg_get_functiondef('yr_cc_roll'::regproc), 'wm + 60000)', 'wm + 120000)');
end $$;
select cron.alter_job((select jobid from cron.job where jobname = 'yr-cc-roll'), schedule := '* * * * *');
