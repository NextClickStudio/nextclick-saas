-- 063: yr-capture (v6) never writes the same trade twice (each run writes only after its first 4 s), so yr_ticks
-- drops its random-order unique index on the signature, most of the disk work on the free database.
alter table yr_ticks drop constraint if exists yr_ticks_pkey;
drop index if exists yr_ticks_pkey;
