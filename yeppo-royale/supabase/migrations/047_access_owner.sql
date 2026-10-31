-- yr_access also says when a key is the owner's: the paper trading lab shows only for it.
create or replace function yr_access(p_key text, p_dev text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  k text := upper(trim(coalesce(p_key, '')));
  lic yr_licenses;
  n int;
begin
  if k <> '' then select * into lic from yr_licenses where key = k; end if;
  if coalesce((select value from yr_config where key = 'paywall'), 'false') <> 'true' then
    return jsonb_build_object('paywall', false, 'pro', true, 'owner', coalesce(lic.plan = 'owner' and lic.until > now(), false));
  end if;
  if k = '' then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'nokey'); end if;
  if lic.key is null then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'unknown'); end if;
  if lic.until <= now() then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'expired'); end if;
  if lic.plan = 'owner' then return jsonb_build_object('paywall', true, 'pro', true, 'owner', true); end if;
  if p_dev is null or p_dev !~ '^[0-9a-f-]{36}$' then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'nodevice'); end if;
  if exists (select 1 from yr_key_dev where key = k and dev = p_dev) then
    return jsonb_build_object('paywall', true, 'pro', true);
  end if;
  select count(*) into n from yr_key_dev where key = k;
  if n >= 3 then return jsonb_build_object('paywall', true, 'pro', false, 'reason', 'devices'); end if;
  insert into yr_key_dev (key, dev) values (k, p_dev) on conflict do nothing;
  return jsonb_build_object('paywall', true, 'pro', true);
end $$;
