-- 078: the hidden bundle counted the right way (3 Nov 2026). A launch bundle's buys are hidden (its transaction's logs
-- are cut), but its sells are seen. yr_risk subtracted every wallet's net from the supply out, so each sell by a bundle
-- wallet counted against its own hidden buys and made the "hidden" share grow while the bundle was selling ($GRANDPA:
-- 53% shown, Axiom 38%). Now only what seen wallets still hold (net above zero) is subtracted: hidden = what the rest
-- holds. yr_seen_buyers tells the read which of a coin's real top holders yeppo saw buy, so the read can cap the hidden
-- share with real balances (RugCheck's top holders).
do $$
declare d text := pg_get_functiondef('yr_risk(text,text,bigint)'::regprocedure);
begin
  d := replace(d, $x$      sum(case when k = 1 then tok else -tok end) seen
    from x where vtok > 0),$x$,
    $x$      (select sum(greatest(q.n2, 0)) from (select sum(case when k = 1 then tok else -tok end) n2 from x group by who) q) seen
    from x where vtok > 0),$x$);
  if position('greatest(q.n2, 0)' in d) = 0 then raise exception 'yr_risk: seen line not found'; end if;
  execute d;
end $$;

create or replace function yr_seen_buyers(p_mint text, p_whos text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  if p_whos is null or cardinality(p_whos) > 40 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(distinct x.who) from yr_ticks x
    where x.mint = p_mint and x.k = 1 and x.who = any (p_whos)), '[]'::jsonb);
end $$;
revoke all on function yr_seen_buyers(text, text[]) from public;
grant execute on function yr_seen_buyers(text, text[]) to anon, authenticated;
