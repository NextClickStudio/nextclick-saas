-- The free plan's disk IO budget ran out (31 Oct): pg_stat_statements showed the live trade feed alone wrote
-- ~1.5 GB of WAL (yr_ticks inserts 1.1 GB + its 20-minute cleanup 0.36 GB). yr_ticks and the other short-lived
-- tables (the 30 s chart steps, the launch bundle, the DexScreener price cache) only hold minutes of data that
-- refill by themselves, so they don't need crash safety: UNLOGGED tables write no WAL. Same data, same reads;
-- after a crash these few minutes start over empty.
truncate yr_ticks; -- every row is older than its own 20-minute life (the capture stopped at 06:10)
alter table yr_ticks set unlogged;
alter table yr_cb set unlogged;
alter table yr_bw set unlogged;
alter table yr_px set unlogged;
