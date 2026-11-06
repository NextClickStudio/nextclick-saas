-- 085: yr-launch's lease (4 Nov 2026): yr_take_lease_k only knew the capture's two keys, so every yr-launch run
-- skipped itself
insert into yr_config (key, value) values ('launch_lease', '0') on conflict (key) do nothing;
create or replace function yr_take_lease_k(p_key text, p_ms integer) returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_key not in ('capture_lease', 'capture_lease_b', 'launch_lease') then return false; end if;
  update yr_config set value = (now_ms + p_ms)::text where key = p_key and value::bigint < now_ms;
  return found;
end $function$;
