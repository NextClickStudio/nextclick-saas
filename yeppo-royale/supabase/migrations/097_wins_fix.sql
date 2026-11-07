-- 097: yr_wins_s failed on every call ("w.up must appear in the GROUP BY clause"): the aggregate and the limit
-- were on the same level. The limited rows now sit in their own subquery, then get aggregated.
create or replace function public.yr_wins_s()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '10s'
as $function$
begin
  perform yr_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_array(mint, sym, word, round(up::numeric, 1), t) order by up desc)
    from (
      select * from (
        select distinct on (k.mint) k.mint, c.sym, k.word, k.t, (yr_call_move(k, c))[2] up
        from yr_calls k join yr_cc c on c.mint = k.mint
        where k.word in ('Momentum', 'Opportunity') and k.t > yr_now() - 7 * 86400000::bigint and k.t < yr_now() - 600000
        order by k.mint, (yr_call_move(k, c))[2] desc nulls last) w
      where up >= 2 order by up desc limit 12) z), '[]'::jsonb);
end $function$;
