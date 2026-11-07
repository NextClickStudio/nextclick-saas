-- yeppo radar: the social side of a coin and the memes of the hour, so yeppo can rank the coins worth a look.
--  * yr_social: what a coin says about itself (its metadata: X link, website, Telegram, the tool that launched
--    it) and, when it links a post on X, that post's author and text (X's public oEmbed, no key); plus whether
--    it paid DexScreener for a boost or a profile. Filled by the yr-social edge function for the board's coins.
--    Everything in it is what the coin's creator wrote or bought: a signal of attention, not of quality.
--  * yr_social_recent: the last 3 hours of it, for yeppo.it/api/radar.
--  * yr_metas: the words in the names and tickers of the last hour's launches, by how many coins carry them
--    and how much those coins traded: the memes people are launching right now.
--  * bot:radar, one more paper bot (1000 SOL): it buys the radar's top 3 when they score 55 or more, with
--    their Exit Plan, so the radar gets the same live test as yeppo's other calls.
-- Additive.

create table if not exists yr_social (
  mint text primary key,
  at bigint not null,                 -- when yeppo read it (ms)
  twitter text,                       -- the X link in the metadata, as written
  tweet_id text,                      -- when the link is a post
  x_handle text,                      -- the account of the post or of the profile link
  x_author text,                      -- the post author's display name (oEmbed)
  tweet text,                         -- the post's text (oEmbed), cut to 280
  website text,
  telegram text,
  launcher text,                      -- host of the metadata file: pump.fun's IPFS or a tweet-to-coin tool
  descr text,                         -- the coin's description, cut to 200
  boost int not null default 0,       -- DexScreener boost amount seen
  dex_paid boolean not null default false
);
create index if not exists yr_social_at on yr_social (at);
create index if not exists yr_social_tweet on yr_social (tweet_id) where tweet_id is not null;
create index if not exists yr_social_handle on yr_social (x_handle) where x_handle is not null;
alter table yr_social enable row level security;

create or replace function yr_social_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(s.mint, s.tweet_id, s.x_handle, s.x_author, s.tweet, s.website is not null,
           s.telegram is not null, s.launcher, s.boost, s.dex_paid, s.twitter) order by s.at desc), '[]'::jsonb)
  from yr_social s where s.at > yr_now() - 3 * 3600000
$$;
grant execute on function yr_social_recent() to anon, authenticated;

create or replace function yr_metas() returns jsonb
language sql stable security definer set search_path = public as $$
  with w as (
    select distinct b.mint, lower(x.word) word
    from yr_obirth b
    cross join lateral regexp_split_to_table(coalesce(b.name, '') || ' ' || coalesce(b.symbol, ''), '[^A-Za-z0-9]+') x(word)
    where b.t > yr_now() - 3600000 and length(x.word) >= 3
      and lower(x.word) not in ('the', 'and', 'coin', 'token', 'sol', 'solana', 'pump', 'fun', 'meme', 'inu', 'for', 'you', 'who', 'not', 'are', 'this', 'that', 'with', 'new', 'official')),
  s as (
    select w.word, count(*) n, coalesce(sum(o.n), 0) trades, max(o.ath) best
    from w left join yr_oc o on o.mint = w.mint
    group by w.word having count(*) >= 3)
  select coalesce(jsonb_agg(jsonb_build_array(s.word, s.n, s.trades, round(coalesce(s.best, 0)::numeric, 1)) order by s.trades desc), '[]'::jsonb)
  from (select * from s order by s.trades desc limit 30) s
$$;
grant execute on function yr_metas() to anon, authenticated;

-- a week of social rows is plenty; the roll's housekeeping keeps it small
do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_roll';
  if position('delete from yr_social' in src) = 0 then
    src := replace(src, '    delete from yr_obirth where t < now_ms - 86400000;',
                        '    delete from yr_obirth where t < now_ms - 86400000;
    delete from yr_social where at < now_ms - 7 * 86400000;');
    execute format('create or replace function yr_oracle_roll() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;

-- the social reader, every minute, with the ingest key read at run time
select cron.schedule('yr-social', '* * * * *', format($c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-key', (select value from public.yr_config where key = 'ingest_key')), body := '{}'::jsonb, timeout_milliseconds := 50000)$c$,
  'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-social'));

do $do$ declare bots jsonb; v uuid; begin
  select coalesce(value::jsonb, '{}'::jsonb) into bots from yr_config where key = 'paper_bots';
  if not bots ? 'bot:radar' then
    insert into yr_paper_acct (name, sol, start_sol) values ('bot:radar', 1000, 1000) returning id into v;
    update yr_config set value = (bots || jsonb_build_object('bot:radar', v::text))::text where key = 'paper_bots';
  end if;
end $do$;
