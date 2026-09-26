-- One keyword per request now: run every 20 minutes, each run refreshes the stalest trends.
select cron.unschedule('maison-market-hourly');
select cron.schedule(
  'maison-market',
  '*/20 * * * *',
  $$ select net.http_post(
       url := 'https://djzzjybrcknrvvovvlpq.supabase.co/functions/v1/maison-market',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqenpqeWJyY2tucnZ2b3Z2bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzc3NDgsImV4cCI6MjEwNTgxMzc0OH0.zfGX4ut9qgY04L6tnrxtchpjgf28blV9ISrg7c5rueo'
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 150000
     ) $$
);
