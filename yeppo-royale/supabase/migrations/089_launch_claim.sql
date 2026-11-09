-- 089: the launch read of a coin someone opens, booked in the database (4 Nov 2026). The coin read (edge, Vercel)
-- answered in 2 s and Vercel froze the chain read it had started, so it never finished and the panel's countdown
-- looped. Now the coin read books it here (yr_launch_claim) and hands it to /api/launch, a function that may run 30 s
-- and writes the result (yr_launch_put) or says it failed (yr_launch_fail). Every poll asks yr_launch_claim again: the
-- launch when it's in, else how long ago the read started, which attempt it is (3 at most), or that there is nothing
-- to read. The background reader (yr-launch) keeps going for busy coins, and keeps trying a coin up to 5 times.
create or replace function yr_launch_claim(p_mint text) returns jsonb
language plpgsql security definer set search_path = public set synchronous_commit = off as $$
declare now_ms bigint := yr_now(); l jsonb; x yr_launch_try;
begin
  perform yr_guard();
  select jsonb_build_object('slot', slot, 'dev', dev, 'wallets', wallets, 'took', took) into l from yr_launch where mint = p_mint;
  if l is not null then return jsonb_build_object('launch', l); end if;
  insert into yr_launch_try (mint, n, t, final) values (left(p_mint, 44), 1, now_ms, false) on conflict (mint) do nothing;
  if found then return jsonb_build_object('claimed', true, 'n', 1, 'age_ms', 0); end if;
  select * into x from yr_launch_try where mint = p_mint;
  if x.final then return jsonb_build_object('final', true, 'n', x.n); end if;
  -- a read that ended without an answer (or got stuck past 30 s): the next attempt, 3 at most from here
  if x.n < 3 and x.t < now_ms - 30000 then
    update yr_launch_try set n = n + 1, t = now_ms where mint = p_mint and t = x.t;
    if found then return jsonb_build_object('claimed', true, 'n', x.n + 1, 'age_ms', 0); end if;
  end if;
  return jsonb_build_object('claimed', false, 'n', x.n, 'age_ms', now_ms - x.t);
end $$;

-- a read that failed: final (nothing to read: no pump.fun launch, or too busy to reach it) or to try again in 5 s
create or replace function yr_launch_fail(p_mint text, p_final boolean) returns void
language plpgsql security definer set search_path = public set synchronous_commit = off as $$
begin
  perform yr_guard();
  update yr_launch_try set final = final or p_final, t = case when p_final then t else yr_now() - 25000 end where mint = p_mint;
end $$;

revoke all on function yr_launch_claim(text), yr_launch_fail(text, boolean) from public;
grant execute on function yr_launch_claim(text), yr_launch_fail(text, boolean) to anon, authenticated;

-- the background reader skips a coin being read on demand (tried in the last minute) and gives up after 5 tries
create or replace function yr_launch_need(p_n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(a.mint), '[]'::jsonb) from (
    select c.mint from yr_cc c
    where c.t0 > (select yr_now() - 1800000) and c.t0 < (select yr_now() - 15000) and c.n >= 50
      and not exists (select 1 from yr_launch l where l.mint = c.mint)
      and not exists (select 1 from yr_launch_try x where x.mint = c.mint and (x.final or x.n >= 5 or x.t > (select yr_now() - 60000)))
    order by c.t0 desc limit least(greatest(p_n, 1), 50)) a;
$$;
