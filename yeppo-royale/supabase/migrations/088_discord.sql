-- 088: Pro keys on the Discord server (4 Nov 2026). A Pro key pasted in #get-pro gives its Discord account the Pro
-- role; one key, one account (a key linked to someone else is refused, so a shared key opens one room, not ten).
-- yr_discord_expired_s hands the daily sweep the accounts whose key has ended, and forgets them.
create table if not exists yr_discord (user_id text primary key, key text not null unique, t timestamptz not null default now());
alter table yr_discord enable row level security;

create or replace function yr_discord_link(p_user text, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text := upper(trim(coalesce(p_key, ''))); lic yr_licenses;
begin
  perform yr_guard();
  if p_user !~ '^[0-9]{5,25}$' then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  select * into lic from yr_licenses where key = k;
  if lic.key is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  if lic.until <= now() then return jsonb_build_object('ok', false, 'why', 'expired'); end if;
  if exists (select 1 from yr_discord where key = k and user_id <> p_user) then return jsonb_build_object('ok', false, 'why', 'taken'); end if;
  delete from yr_discord where user_id = p_user and key <> k;
  insert into yr_discord (user_id, key) values (p_user, k) on conflict (user_id) do update set key = excluded.key, t = now();
  return jsonb_build_object('ok', true, 'until', (extract(epoch from lic.until) * 1000)::bigint);
end $$;

create or replace function yr_discord_expired_s() returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  perform yr_guard();
  with gone as (
    delete from yr_discord d where not exists (select 1 from yr_licenses l where l.key = d.key and l.until > now())
    returning d.user_id)
  select coalesce(jsonb_agg(user_id), '[]'::jsonb) into out from gone;
  return out;
end $$;

revoke all on function yr_discord_link(text, text), yr_discord_expired_s() from public;
grant execute on function yr_discord_link(text, text), yr_discord_expired_s() to anon, authenticated;
