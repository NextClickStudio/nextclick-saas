-- 099: the Record judges the word the panel shows. Since 4 Nov the panel shows Safe / Risky / Danger, but only the
-- timing calls (Momentum, Opportunity, Wait, Don't buy) were logged, so the Record and the home's tape spoke words the
-- viewer never sees. The verdicts are logged too now, and Safe wins count as wins.
create or replace function public.yr_call_log(p_mint text, p_word text, p_age integer, p_x real, p_p2 real)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
 set synchronous_commit to 'off'
as $function$
begin
  perform yr_guard();
  if p_word not in ('Momentum', 'Opportunity', 'Wait', 'Don''t buy', 'Safe', 'Risky', 'Danger') or p_age < 0 or p_age > 7200 or p_x is null or p_x <= 0 then return; end if;
  insert into yr_calls (mint, word, t, age, x, p2) values (left(p_mint, 44), p_word, yr_now(), p_age, p_x, p_p2)
  on conflict do nothing;
end $function$;

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
        where k.word in ('Safe', 'Momentum', 'Opportunity') and k.t > yr_now() - 7 * 86400000::bigint and k.t < yr_now() - 600000
        order by k.mint, (yr_call_move(k, c))[2] desc nulls last) w
      where up >= 2 order by up desc limit 12) z), '[]'::jsonb);
end $function$;

-- "Found by yeppo" ranked wallets by wins alone, so a wallet right 8 times in 61 (13%) came before one right 5 times
-- in 11 (45%), and wallets whose last win was a week ago were offered for copying. Ranked now by the lower bound of
-- their hit rate (Wilson, 90%), which needs both a good rate and enough tries, and only wallets that won in 3 days.
create or replace function public.yr_radar_book_s(p_key text, p_dev text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare k text;
begin
  perform yr_guard();
  k := yr_radar_key(p_key, p_dev);
  return jsonb_build_object(
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('who', m.who, 'name', m.name, 'emoji', m.emoji,
        'wins', s.wins, 'tries', s.tries, 'flips', s.flips, 'creators', (select count(distinct d) from unnest(s.devs) d),
        'proven', coalesce(yr_sm_proven(s), false), 'last', s.last_t) order by s.wins desc nulls last, m.name), '[]'::jsonb)
      from yr_radar_list m left join yr_sm3 s on s.who = m.who where m.key = k),
    'found', (select coalesce(jsonb_agg(jsonb_build_object('who', s.who, 'wins', s.wins, 'tries', s.tries, 'flips', s.flips,
        'hit', round((s.wins::real / greatest(s.tries, 1))::numeric, 2), 'creators', (select count(distinct d) from unnest(s.devs) d),
        'last', s.last_win) order by s.lb desc), '[]'::jsonb)
      from (select s.*, (p + 1.3529 / n - 1.6449 * sqrt(p * (1 - p) / n + 0.6764 / (n * n))) / (1 + 2.7058 / n) lb
            from (select s.*, coalesce(yr_sm_proven(s), false) pr, s.wins::float8 / greatest(s.tries, 1) p, greatest(s.tries, 1)::float8 n
                  from yr_sm3 s) s
            where s.pr and s.last_win > yr_now() - 3 * 86400000::bigint
              and not exists (select 1 from yr_radar_list m where m.key = k and m.who = s.who)
            order by lb desc limit 200) s));
end $function$;
