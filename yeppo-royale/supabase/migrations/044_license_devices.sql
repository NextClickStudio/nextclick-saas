-- yeppo needs a Pro key. yr_access checks it for every read (yeppo.it/api/read keeps the answer a minute) and ties
-- a key to the devices that use it: each browser or extension has its own random id, and a key works on 3 of them
-- (owner keys on any number). A shared key stops working on the 4th device; info@yeppo.it can free its devices.
-- Writes happen only the first time a device shows up.
create table if not exists yr_key_dev (
  key text not null,
  dev text not null,
  t timestamptz not null default now(),
  primary key (key, dev)
);
alter table yr_key_dev enable row level security;

drop function if exists yr_access(text);
create or replace function yr_access(p_key text, p_dev text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k text := upper(trim(coalesce(p_key, '')));
  lic yr_licenses;
  n int;
begin
  if coalesce((select value from yr_config where key = 'paywall'), 'false') <> 'true' then
    return jsonb_build_object('paywall', false, 'pro', true);
  end if;
  if k = '' then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'nokey'); end if;
  select * into lic from yr_licenses where key = k;
  if lic.key is null then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'unknown'); end if;
  if lic.until <= now() then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'expired'); end if;
  if lic.plan = 'owner' then return jsonb_build_object('paywall', true, 'pro', true); end if;
  if p_dev is null or p_dev !~ '^[0-9a-f-]{36}$' then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'nodevice'); end if;
  if exists (select 1 from yr_key_dev where key = k and dev = p_dev) then
    return jsonb_build_object('paywall', true, 'pro', true);
  end if;
  select count(*) into n from yr_key_dev where key = k;
  if n >= 3 then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'devices'); end if;
  insert into yr_key_dev (key, dev) values (k, p_dev) on conflict do nothing;
  return jsonb_build_object('paywall', true, 'pro', true);
end $$;
revoke all on function yr_access(text, text) from public;
grant execute on function yr_access(text, text) to anon, authenticated;
