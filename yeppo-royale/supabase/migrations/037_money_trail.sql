-- The money trail. Ruggers often launch from fresh wallets, so the creator's own history says nothing. What gives
-- them away is where the SOL came from: yr_fund keeps, for each creator wallet yeppo looked at, the wallet that first
-- funded it (filled by the yr-fund edge function from the public chain). A funder that funded creators who rugged,
-- or rugged itself, links the new coin to those rugs. The early buyers (the launch bundle) are checked the same way.
-- It is information only: it never changes the call.

create table if not exists yr_fund (
  dev text primary key,
  funder text,                  -- null when none was found
  kind text not null,           -- 'wallet', 'exchange' (busy wallet or known exchange), 'old' (history too long), 'none'
  sol real,                     -- the first funding, SOL
  t bigint not null             -- when yeppo looked
);
create index if not exists yr_fund_funder on yr_fund (funder) where kind = 'wallet';
alter table yr_fund enable row level security;

-- what the panel needs: the creator's funder and the rugs it is linked to, and early buyers linked to rugs
create or replace function yr_fund_read(p_dev text, p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  with f as (select * from yr_fund where dev = p_dev),
  -- rugs by creators the same funder paid, and by the funder itself when it launched coins
  linked as (
    select c.mint, c.sym from yr_cc c
    where c.rug_s is not null and c.mint <> p_mint
      and (c.dev = (select funder from f where kind = 'wallet')
           or c.dev in (select g.dev from yr_fund g where g.kind = 'wallet' and g.funder = (select funder from f where kind = 'wallet') and g.dev <> p_dev))),
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
    'rugs', (select count(*) from linked),
    'rug_syms', coalesce((select jsonb_agg(sym) from (select sym from linked where sym is not null limit 3) z), '[]'::jsonb),
    'siblings', (select count(*) from yr_fund g where g.kind = 'wallet' and g.funder = (select funder from f where kind = 'wallet') and g.dev <> p_dev),
    'dirty', (select count(*) from dirty),
    -- early buyers paid by the creator, or by the creator's own funder: the classic bundle
    'family', (select count(*) from yr_bw b join yr_fund g on g.dev = b.who and g.kind = 'wallet'
               where b.mint = p_mint and b.tok > 0
                 and (g.funder = p_dev or g.funder = (select funder from f where kind = 'wallet'))))
$$;
grant execute on function yr_fund_read(text, text) to anon, authenticated;

-- creators who rugged get their funder looked up in the background, so the families are known before the next coin
select cron.schedule('yr-fund', '* * * * *', $job$
  select net.http_post(
    url := 'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-fund',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5b2J0Z3Vidm9wemZtb216ZXVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNDU2NTMsImV4cCI6MjEwODkyMTY1M30.ive4HTtn_DYstwrSPYQervq7KlpPWIuVIsH4ZWpUhWw'),
    body := jsonb_build_object('devs', z.d),
    timeout_milliseconds := 50000)
  from (select jsonb_agg(dev) d from (
          select distinct c.dev from yr_cc c
          where c.rug_s is not null and not exists (select 1 from yr_fund f where f.dev = c.dev)
          limit 4) q) z
  where z.d is not null
$job$);
