-- 084: yeppo's own launch reader, and Hot on X's coins born after the post (4 Nov 2026).
--  * yr-launch (edge function, every minute) reads the launch bundle of every coin that reaches 20 trades from the
--    public Solana RPC, in place of Helius: yr_launch_need is its queue (freshest first, 15 s to 30 min old, not read
--    yet, not given up on), yr_launch_tried notes a coin the node didn't fully answer (tried again after a minute, 3
--    times) or one with nothing to read (never again). yr_launch rows say where they came from (src).
--  * yr_launch is only read for coins under 2 hours old: kept 1 day instead of 14 (about 14,000 coins a day now).
--  * yr_hot_s: for each word of a post, the coins launched AFTER that post (from 2 minutes before it: clocks and
--    indexing), the first three born; and the coins a post hands out, when yeppo saw them launch in the last day.
--    Hot on X shows fresh coins to snipe, not old coins that happen to share a word.
alter table yr_launch add column if not exists src text;

create unlogged table if not exists yr_launch_try (mint text primary key, n smallint not null, t bigint not null, final boolean not null default false);
alter table yr_launch_try enable row level security;

create or replace function yr_launch_need(p_n int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(a.mint), '[]'::jsonb) from (
    select c.mint from yr_cc c
    where c.t0 > (select yr_now() - 1800000) and c.t0 < (select yr_now() - 15000) and c.n >= 20
      and not exists (select 1 from yr_launch l where l.mint = c.mint)
      and not exists (select 1 from yr_launch_try x where x.mint = c.mint and (x.final or x.n >= 3 or x.t > (select yr_now() - 60000)))
    order by c.t0 desc limit least(greatest(p_n, 1), 50)) a;
$$;

create or replace function yr_launch_tried(p_mint text, p_final boolean) returns void
language sql security definer set search_path = public as $$
  insert into yr_launch_try (mint, n, t, final) values (p_mint, 1, yr_now(), p_final)
  on conflict (mint) do update set n = yr_launch_try.n + 1, t = excluded.t, final = yr_launch_try.final or excluded.final;
$$;

revoke all on function yr_launch_need(int), yr_launch_tried(text, boolean) from public, anon, authenticated;
grant execute on function yr_launch_need(int), yr_launch_tried(text, boolean) to service_role;

create or replace function yr_x_gc() returns void language sql security definer set search_path = public as $$
  delete from yr_launch where t < yr_now() - 86400000::bigint;
  delete from yr_launch_try where t < yr_now() - 7200000::bigint;
  delete from yr_xlink where t < yr_now() - 14 * 86400000::bigint;
$$;
revoke all on function yr_x_gc() from public, anon, authenticated;

create or replace function yr_hot_s(p_words text[], p_since bigint[], p_mints text[]) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_words is null or cardinality(p_words) > 20 or cardinality(p_since) <> cardinality(p_words) or cardinality(coalesce(p_mints, '{}')) > 20 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(z.w, z.mint, z.sym, z.t, z.mc, z.hix, z.n, z.rug) order by z.w, z.t)
    from (
      select w.w, b.mint, b.symbol sym, b.t, round(coalesce(c.mc, 0)::numeric, 1) mc,
        round((coalesce(c.ath, 0) / coalesce(nullif(c.mc0, 0), 27.96))::numeric, 2) hix, coalesce(c.n, 0) n, c.rug_s is not null rug,
        row_number() over (partition by w.w order by b.t) k
      -- the last hour's launches once (index on t), their ticker and name normalized once, then matched to the words
      from (select mint, symbol, t, regexp_replace(lower(coalesce(symbol, '')), '[^a-z0-9]', '', 'g') s,
              regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]', '', 'g') nm
            from yr_obirth where t > now_ms - 3600000 offset 0) b
      join unnest(p_words, p_since) w(w, since) on (b.s = w.w or b.nm = w.w) and b.t >= w.since - 120000
      left join yr_cc c on c.mint = b.mint
      union all
      -- the coins handed out in the posts, under the empty word
      select '', b.mint, b.symbol, b.t, round(coalesce(c.mc, 0)::numeric, 1),
        round((coalesce(c.ath, 0) / coalesce(nullif(c.mc0, 0), 27.96))::numeric, 2), coalesce(c.n, 0), c.rug_s is not null, 1
      from yr_obirth b left join yr_cc c on c.mint = b.mint
      where b.mint = any(coalesce(p_mints, '{}'))) z
    where z.k <= 3), '[]'::jsonb);
end $$;
revoke all on function yr_hot_s(text[], bigint[], text[]) from public;
grant execute on function yr_hot_s(text[], bigint[], text[]) to anon, authenticated;

select cron.schedule('yr-launch', '* * * * *', $$select net.http_post(url := 'https://qyobtgubvopzfmomzeuj.supabase.co/functions/v1/yr-launch', headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-key', (select value from public.yr_config where key = 'ingest_key')), body := '{}'::jsonb, timeout_milliseconds := 60000)$$);
