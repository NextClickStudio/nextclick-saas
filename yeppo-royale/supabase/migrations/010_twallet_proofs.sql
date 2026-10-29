-- yeppo 1v1: trading wallets without moving money.
-- Besides the tiny transfer, a trading wallet is linked when
--  * its very first funding came from the player's verified wallet (history nobody can rewrite), or
--  * the player signs our message with it (after importing it into Phantom, Solflare...).
-- Additive.

alter table yr_twallets add column if not exists funding_at timestamptz;   -- when yr-real last read its funding

-- service only: a signature from the trading wallet itself proves it
create or replace function yr_twallet_signed(p_user uuid, p_address text, p_label text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_address = (select wallet from yr_users where id = p_user) then raise exception 'That is already your verified wallet'; end if;
  if exists (select 1 from yr_users where wallet = p_address and id <> p_user)
     or exists (select 1 from yr_twallets where address = p_address and status = 'ok' and user_id <> p_user) then
    raise exception 'This wallet is linked to another profile';
  end if;
  if (select count(*) from yr_twallets where user_id = p_user and status = 'ok' and address <> p_address) >= 4 then
    raise exception 'Four trading wallets at most';
  end if;
  insert into yr_twallets (user_id, address, label, status, lamports, verified_at)
  values (p_user, p_address, nullif(left(trim(coalesce(p_label, '')), 20), ''), 'ok', 0, now())
  on conflict (user_id, address) do update set status = 'ok', verified_at = now(), label = coalesce(excluded.label, yr_twallets.label);
  delete from yr_twallets where address = p_address and status = 'pending' and user_id <> p_user;
  return jsonb_build_object('ok', true);
end $$;

-- service only: the funding check ran (it reads the whole history, so not more than every few minutes)
create or replace function yr_twallet_funding(p_user uuid, p_address text) returns void
language sql security definer set search_path = public as $$
  update yr_twallets set funding_at = now() where user_id = p_user and address = p_address
$$;

create or replace function yr_twallet_pending(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  uid := yr_uid(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object('user_id', t.user_id, 'address', t.address, 'to', u.wallet, 'lamports', t.lamports,
                                        'since', yr_ms(t.created_at), 'funding_at', yr_ms(t.funding_at)))
    from yr_twallets t join yr_users u on u.id = t.user_id
    where t.user_id = uid and t.status = 'pending' and t.created_at > now() - interval '30 minutes' and u.wallet is not null), '[]'::jsonb);
end $$;

revoke all on function yr_twallet_signed(uuid, text, text) from public, anon, authenticated;
revoke all on function yr_twallet_funding(uuid, text) from public, anon, authenticated;
revoke all on function yr_twallet_pending(text) from public, anon, authenticated;
