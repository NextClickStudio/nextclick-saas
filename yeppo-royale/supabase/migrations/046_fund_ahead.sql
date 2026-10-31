-- The money trail is ready before anyone opens the coin: every minute yr-fund traces the creators of the coins
-- that are trading (20+ trades in their first 30 minutes) and one creator who rugged. Creators traced before with
-- no result ('none') are traced again (yr-fund now reads v1 transactions and launch-service creators).
select cron.alter_job((select jobid from cron.job where jobname = 'yr-fund'), schedule := '* * * * *', command := $job$
  select net.http_post(
    url := 'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-fund',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5b2J0Z3Vidm9wemZtb216ZXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDU2NTMsImV4cCI6MjEwODkyMTY1M30.ive4HTtn_DYstwrSPYQervq7KlpPWIuVIsH4ZWpUhWw'),
    body := jsonb_build_object('devs', z.d),
    timeout_milliseconds := 55000)
  from (select jsonb_agg(dev) d from (
          (select c.dev from yr_cc c
           where c.t0 > yr_now() - 1800000 and c.n >= 20
             and not exists (select 1 from yr_fund f where f.dev = c.dev and f.kind <> 'none')
           order by c.n desc limit 4)
          union
          (select distinct c.dev from yr_cc c
           where c.rug_s is not null and not exists (select 1 from yr_fund f where f.dev = c.dev) limit 1)) q) z
  where z.d is not null
$job$);
