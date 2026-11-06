-- 072: the free database stops choking every night (3 Nov 2026). From 02:50 its disk was throttled to a crawl (a
-- 1,018-block checkpoint took 102 s), connections timed out and yeppo stopped answering until a restart. Measured over
-- the 3 days before (pg_stat_statements), the disk went on:
--  * temp files: yr_trends_calc (every minute) and yr_trends_s sorted in 2 MB of memory and spilled ~6 GB to disk;
--  * one flush per commit: every trade batch, every cron run waited for the disk to confirm;
--  * the write-ahead log of tables that only hold what rebuilds itself: launches and graduations of the last day, the
--    radar and waves cache (yr_ticks, yr_cb and yr_bw were already unlogged).
-- Now the heavy jobs sort in memory, don't wait for the flush (a crash can lose their last second, which the next run
-- writes again), and those tables skip the log (after a crash Postgres empties them and the capture fills them again).
-- yr_cc (14 days of coins), keys and licences keep everything as before.
alter table yr_obirth set unlogged;
alter table yr_grad set unlogged;
alter table yr_tcache set unlogged;

alter function yr_cc_roll() set synchronous_commit = off;
alter function yr_sm_roll() set synchronous_commit = off;
alter function yr_radar_calc() set synchronous_commit = off;
alter function yr_radar_calc() set work_mem = '32MB';
alter function yr_trends_calc() set synchronous_commit = off;
alter function yr_trends_calc() set work_mem = '32MB';
alter function yr_trends_s() set work_mem = '32MB';
alter function yr_wave_s(text) set work_mem = '16MB';

-- the capture writes trades through the API as service_role: no flush wait for those either
alter role service_role set synchronous_commit = off;
