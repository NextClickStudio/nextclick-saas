-- MAISON — market signal + scheduled jobs.

alter table public.maison_trends add column if not exists signal numeric;

-- Hourly market update (Edge Function maison-market). The public (legacy JWT) anon key is enough:
-- the function rate-limits itself and writes with its own service key.
select cron.schedule(
  'maison-market-hourly',
  '7 * * * *',
  $$ select net.http_post(
       url := 'https://djzzjybrcknrvvovvlpq.supabase.co/functions/v1/maison-market',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqenpqeWJyY2tucnZ2b3Z2bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzc3NDgsImV4cCI6MjEwNTgxMzc0OH0.zfGX4ut9qgY04L6tnrxtchpjgf28blV9ISrg7c5rueo'
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 120000
     ) $$
);

-- Daily rollover just after midnight UTC: expire cards, settle duels, new duels.
select cron.schedule('maison-daily-rollover', '2 0 * * *', $$ select public.maison_daily_rollover() $$);
