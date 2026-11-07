-- 081: the author scorecard (4 Nov 2026). Whose X post a coin was born from is on every trading site; whether coins
-- born from that author's posts tend to run is not. yr_author_card: of the coins yeppo saw born from posts by this
-- author (20+ minutes old), how many went ×2 and ×5 from launch, how many died in their first minutes, and the best.
-- yr_xlink_need_active lists the coins trading most right now whose X link yeppo hasn't recorded, so the capture
-- records them too (a few hundred short rows a day) and the scorecards fill up without anyone opening those coins.
create or replace function yr_author_card(p_handle text, p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h text := lower(nullif(p_handle, ''));
begin
  perform yr_guard();
  if h is null then return null; end if;
  return (
    select jsonb_build_object(
      'coins', count(*),
      'x2', count(*) filter (where c.ath >= b * 2),
      'x5', count(*) filter (where c.ath >= b * 5 or c.grad),
      'dead', count(*) filter (where c.ath < b * 1.3),
      'best', (array_agg(jsonb_build_array(c.sym, round((c.ath / b)::numeric, 1)) order by c.ath / b desc))[1])
    from yr_xlink x
    join lateral (select c.*, coalesce(nullif(c.mc0, 0), 27.96) b from yr_cc c where c.mint = x.mint) c on true
    where x.handle = h and x.post is not null and x.mint <> p_mint and c.t0 < yr_now() - 1200000);
end $$;
revoke all on function yr_author_card(text, text) from public;
grant execute on function yr_author_card(text, text) to anon, authenticated;

create or replace function yr_xlink_need_active() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(b.mint, b.uri, b.t)), '[]'::jsonb)
  from (
    select x.mint from yr_ticks x where x.t > yr_now() - 600000
    group by x.mint having count(*) >= 30 order by count(*) desc limit 60) a
  join yr_obirth b on b.mint = a.mint
  where b.uri is not null and not exists (select 1 from yr_xlink l where l.mint = a.mint)
  limit 20;
$$;
revoke all on function yr_xlink_need_active() from public, anon, authenticated;
grant execute on function yr_xlink_need_active() to service_role;
