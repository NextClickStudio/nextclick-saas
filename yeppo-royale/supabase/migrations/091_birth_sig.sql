-- 091: a launch's signature and block in yr_obirth (4 Nov 2026). yr-launch found a coin's launch by paging back
-- through its signatures, 1,000 a call, 5 calls at most: busy coins pass 5,000 within a minute (bots), so a third of
-- the coins opened ended "nothing to read". The capture now keeps the launch's signature (PumpPortal and the program
-- logs both carry it) and its block (the logs' context), and yr-launch reads the 2 launch blocks straight from them.
alter table yr_obirth add column if not exists sig text;
alter table yr_obirth add column if not exists slot bigint;
-- the coins given up on as "nothing to read" in the last hours get another chance with the new read
update yr_launch_try set final = false, n = 0, t = 0 where final and not exists (select 1 from yr_launch l where l.mint = yr_launch_try.mint);
