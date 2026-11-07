-- 100: Suggested wallets. The 121 wallets the owner tracks on Axiom (7 Nov 2026), offered to every Pro viewer in the
-- radar: one tap adds them to their own list, one tap copies them in Axiom's import format. Seeded from the owner's
-- radar list (matched by the hash of the owner's key, so the key itself is not written here).
create table if not exists public.yr_suggested (
  who text primary key,
  name text,
  emoji text,
  ord int not null default 0
);
alter table public.yr_suggested enable row level security;
revoke all on public.yr_suggested from anon, authenticated;

insert into public.yr_suggested (who, name, emoji, ord)
select who, name, emoji, row_number() over (order by t, who)
from public.yr_radar_list where md5(key) = '9ac5a70d152645970c2b20eb6c9cef93'
on conflict (who) do update set name = excluded.name, emoji = excluded.emoji;

-- the book gains the suggested list, each wallet with what yeppo measured on it (if it has traded since yeppo watches)
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
            order by lb desc limit 200) s),
    'suggested', (select coalesce(jsonb_agg(jsonb_build_object('who', g.who, 'name', g.name, 'emoji', g.emoji,
        'wins', s.wins, 'tries', s.tries, 'last', s.last_t,
        'mine', exists (select 1 from yr_radar_list m where m.key = k and m.who = g.who)) order by g.ord), '[]'::jsonb)
      from yr_suggested g left join yr_sm3 s on s.who = g.who));
end $function$;

-- Hot on X without J7: the posts on X that coins launched from in the last hour (yeppo links a coin to the post in
-- its metadata), each with its coins, most coins first. [handle, post id, first coin at, [[mint, ticker, launched at,
-- trades, market cap SOL, high × launch]]]
create or replace function public.yr_xfeed_s()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '5s'
as $function$
begin
  perform yr_guard();
  return coalesce((
    select jsonb_agg(jsonb_build_array(p.handle, p.post, p.first, p.coins) order by p.n desc, p.first desc)
    from (
      select x.handle, x.post, min(c.t0) first, count(*) n,
        jsonb_agg(jsonb_build_array(c.mint, c.sym, c.t0, c.n, round(c.mc::numeric, 1), round((c.ath / nullif(coalesce(c.mc0, 27.96), 0))::numeric, 1))
                  order by c.n desc) coins
      from yr_xlink x join yr_cc c on c.mint = x.mint
      where x.t > yr_now() - 3600000 and x.handle is not null and c.t0 > yr_now() - 3600000
      group by x.handle, x.post
      order by count(*) desc, min(c.t0) desc
      limit 12) p), '[]'::jsonb);
end $function$;
