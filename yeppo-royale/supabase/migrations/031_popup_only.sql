-- yeppo: the extension's read only. The radar is gone, and with it the background jobs that fed it and the paper
-- bots: the board build (yr-ohot), the memes of the hour (yr-metas), the X reader (yr-social) and yr-bot.
-- The extension works each open coin out on demand, so the free database only carries the roll, the capture,
-- the paper exits and the hourly track record. Tables and functions stay; only the jobs stop.

do $do$ declare j text; begin
  foreach j in array array['yr-ohot', 'yr-metas', 'yr-social', 'yr-bot'] loop
    begin
      perform cron.unschedule(j);
    exception when others then
      null; -- already gone
    end;
  end loop;
end $do$;
