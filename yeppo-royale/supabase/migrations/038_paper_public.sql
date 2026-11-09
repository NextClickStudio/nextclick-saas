-- Paper trading for everyone. Until now a paper wallet needed the owner's lab key; anyone can now open one with
-- 10 paper SOL from the coin panel. Its id is the only key to it (an unguessable uuid kept in the browser or the
-- extension), like the owner's. At most 60 new wallets a minute, so nobody can flood the table.
create or replace function yr_paper_open() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if (select count(*) from yr_paper_acct where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'Too many new paper wallets right now, try again in a minute';
  end if;
  insert into yr_paper_acct (name) values ('public') returning id into v;
  return v;
end $$;
revoke all on function yr_paper_open() from public;
grant execute on function yr_paper_open() to anon, authenticated;
