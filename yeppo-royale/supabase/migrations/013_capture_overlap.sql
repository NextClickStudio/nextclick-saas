-- yeppo oracle: no gaps in the capture.
-- yr-capture runs about 57 s per call. Called every 30 s with two leases, two runs overlap, so a launch
-- or a trade is never missed between runs (duplicates are dropped on (sig, ix) and on the mint). Additive.

insert into yr_config (key, value) values ('capture_lease_b', '0') on conflict (key) do nothing;

-- service only: take the named lease if it is free
create or replace function yr_take_lease_k(p_key text, p_ms int) returns boolean
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if p_key not in ('capture_lease', 'capture_lease_b') then return false; end if;
  update yr_config set value = (now_ms + p_ms)::text where key = p_key and value::bigint < now_ms;
  return found;
end $$;
revoke all on function yr_take_lease_k(text, int) from public, anon, authenticated;

select cron.alter_job(9, schedule := '30 seconds');
