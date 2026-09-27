-- Smaller, spread-out batches: run every 10 minutes (2 requests of 5 keywords each).
select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'maison-market'), schedule := '*/10 * * * *');
