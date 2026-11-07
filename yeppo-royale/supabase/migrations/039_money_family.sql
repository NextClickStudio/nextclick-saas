-- Most creators launch from a wallet yeppo has never seen, so "first coin from this creator" says little. The money
-- trail fixes that: every coin launched by a wallet paid by the same funder (or by the funder itself) belongs to the
-- same family. yr_fund_read now sums up that family's coins and how they ended, and the background job also traces
-- the creators of the most traded new coins, so families fill up over time. Information only, never the call.

create or replace function yr_fund_read(p_dev text, p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  with f as (select * from yr_fund where dev = p_dev),
  fam_devs as (
    select g.dev from yr_fund g
    where g.kind = 'wallet' and g.funder = (select funder from f where kind = 'wallet') and g.dev <> p_dev
    union select funder from f where kind = 'wallet'),
  fam as (select c.* from yr_cc c where c.dev in (select dev from fam_devs) and c.mint <> p_mint),
  ruggers as (select distinct c.dev from yr_cc c where c.rug_s is not null),
  dirty as (
    select b.who from yr_bw b
    where b.mint = p_mint and b.tok > 0
      and (b.who in (select dev from ruggers)
           or b.who in (select g.dev from yr_fund g join yr_fund h on h.funder = g.funder and h.dev in (select dev from ruggers) where g.kind = 'wallet')))
  select jsonb_build_object(
    'checked', exists (select 1 from f),
    'funder', (select funder from f),
    'kind', (select kind from f),
    'sol', (select sol from f),
    'siblings', (select count(*) from yr_fund g where g.kind = 'wallet' and g.funder = (select funder from f where kind = 'wallet') and g.dev <> p_dev),
    'coins', (select count(*) from fam),
    'rugs', (select count(*) from fam where rug_s is not null),
    'ran', (select count(*) from fam where grad or ath / coalesce(nullif(mc0, 0), 27.96) >= 3),
    'best', (select max(ath / coalesce(nullif(mc0, 0), 27.96)) from fam),
    'rug_syms', coalesce((select jsonb_agg(sym) from (select sym from fam where rug_s is not null and sym is not null order by t0 desc limit 3) z), '[]'::jsonb),
    'dirty', (select count(*) from dirty),
    'family', (select count(*) from yr_bw b join yr_fund g on g.dev = b.who and g.kind = 'wallet'
               where b.mint = p_mint and b.tok > 0
                 and (g.funder = p_dev or g.funder = (select funder from f where kind = 'wallet'))))
$$;

-- the background job: creators who rugged, then creators of the most traded coins of the last hour
select cron.unschedule('yr-fund');
select cron.schedule('yr-fund', '* * * * *', $job$
  select net.http_post(
    url := 'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-fund',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5b2J0Z3Vidm9wemZtb216ZXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDU2NTMsImV4cCI6MjEwODkyMTY1M30.ive4HTtn_DYstwrSPYQervq7KlpPWIuVIsH4ZWpUhWw'),
    body := jsonb_build_object('devs', z.d),
    timeout_milliseconds := 55000)
  from (select jsonb_agg(dev) d from (
          (select distinct c.dev from yr_cc c
           where c.rug_s is not null and not exists (select 1 from yr_fund f where f.dev = c.dev) limit 2)
          union
          (select c.dev from yr_cc c
           where c.t0 > yr_now() - 3600000 and c.n >= 100 and not exists (select 1 from yr_fund f where f.dev = c.dev)
           order by c.n desc limit 3)) q) z
  where z.d is not null
$job$);
