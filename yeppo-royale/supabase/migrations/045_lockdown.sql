-- Launch lockdown.
-- 1. Only what yeppo.it uses today stays open to the public key; the functions of yeppo's earlier versions (arena,
--    duels, terminal, live trade feeds) are closed: they could hand out the live data without a Pro key.
-- 2. The creator history and the money trail are read through yr_creator_s and yr_fund_read_s, which only answer
--    yeppo.it's own server once yr_config 'api_secret' is set: the server sends the same secret (a Vercel
--    environment variable) in the x-yeppo-secret header. While 'api_secret' is empty they answer everyone, so the
--    switch can be turned on after the variable is in place.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'yr%'
      and p.proname not in ('yr_access', 'yr_health', 'yr_license', 'yr_now', 'yr_creator_s', 'yr_fund_read_s',
                            'yr_paper_buy', 'yr_paper_sell', 'yr_paper_state', 'yr_paper_new', 'yr_paper_reset', 'yr_paper_open')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

create or replace function yr_guard() returns void
language plpgsql stable security definer set search_path = public as $$
declare want text := (select value from yr_config where key = 'api_secret');
begin
  if coalesce(want, '') = '' then return; end if;
  if coalesce(current_setting('request.headers', true)::json ->> 'x-yeppo-secret', '') <> want then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;
revoke execute on function yr_guard() from public, anon, authenticated;

create or replace function yr_creator_s(p_mint text, p_dev text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return yr_creator(p_mint, p_dev);
end $$;

create or replace function yr_fund_read_s(p_dev text, p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return yr_fund_read(p_dev, p_mint);
end $$;

revoke execute on function yr_creator_s(text, text) from public;
revoke execute on function yr_fund_read_s(text, text) from public;
grant execute on function yr_creator_s(text, text) to anon, authenticated;
grant execute on function yr_fund_read_s(text, text) to anon, authenticated;

-- the old arena's tables were readable by anyone
drop policy if exists yr_users_read on yr_users;
drop policy if exists yr_modes_read on yr_modes;
