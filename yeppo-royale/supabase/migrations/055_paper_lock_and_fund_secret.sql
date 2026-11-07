-- 055: launch hardening.
-- Paper wallets are an owner tool now: a handful a minute and 50 a day at most, so nobody can fill the database.
create or replace function yr_paper_open() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if (select count(*) from yr_paper_acct where created_at > now() - interval '1 minute') >= 3
     or (select count(*) from yr_paper_acct where created_at > now() - interval '1 day') >= 50 then
    raise exception 'Too many new paper wallets right now, try again later';
  end if;
  insert into yr_paper_acct (name) values ('public') returning id into v;
  return v;
end $$;

-- yr-fund answers only yeppo.it's server and the cron, with yr_config 'api_secret' in the x-yeppo-secret header
-- (cron job yr-fund: the header was added with cron.alter_job; the browser no longer calls yr-fund).

-- 056: fixed search_path on the remaining helper functions (Supabase linter)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('yr_now','yr_ms','yr_wallet_message','yr_otrade','yr_paper_cost','yr_paper_fee','yr_paper_netfee')
  loop
    execute format('alter function %s set search_path = public', r.f);
  end loop;
end $$;
