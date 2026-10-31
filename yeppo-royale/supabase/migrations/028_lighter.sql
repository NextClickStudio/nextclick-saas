-- yeppo: lighter again. With 40 coins the board build took 11 s on average (up to 41 s) and slowed the roll.
--  * the board holds the 30 most traded young coins and is built every 30 s;
--  * a coin's look-alikes are searched among the latest 2,000 finished snapshots of its checkpoint instead
--    of 5,000 (the search runs once per coin per build, so this is most of the cost).
-- Additive.

do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_hot_build';
  if position('order by a.n2 desc limit 40)' in src) > 0 then
    src := replace(src, 'order by a.n2 desc limit 40)', 'order by a.n2 desc limit 30)');
    execute format('create or replace function yr_oracle_hot_build() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
  select prosrc into src from pg_proc where proname = 'yr_ofuture_core';
  if position('order by x.at desc limit 5000' in src) > 0 then
    src := replace(src, 'order by x.at desc limit 5000', 'order by x.at desc limit 2000');
    execute format('create or replace function yr_ofuture_core(p_mint text, p_k int default 30) returns jsonb language plpgsql stable security definer set search_path = public as %L', src);
  end if;
end $do$;

select cron.schedule('yr-ohot', '30 seconds', 'select yr_oracle_hot_build()');
