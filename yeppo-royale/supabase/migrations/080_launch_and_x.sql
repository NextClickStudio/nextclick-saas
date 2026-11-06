-- 080: the launch bundle read from the chain, and what X tells about a coin (4 Nov 2026). Written only for coins
-- someone opens (and their namesakes), a few short rows each: no work per trade.
-- 1. yr_launch: the wallets that bought in the coin's first 2 blocks (read once, through Helius, from each launch
--    transaction's token balances, which stay whole when its logs are cut) and how much each got. yr_sold_by tells the
--    read how much of it they sold since (yeppo sees the sells).
-- 2. yr_xlink: the X post and account each coin's creator linked. yr_xlink_stats: how many other coins linked the same
--    account (and how they ended: an account recycled from coin to coin) and the same post (and which came first).
create table if not exists yr_launch (
  mint text primary key, t bigint not null, slot bigint, dev text, wallets jsonb not null, took real not null
);
alter table yr_launch enable row level security;

create or replace function yr_launch_get(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  return (select jsonb_build_object('slot', slot, 'dev', dev, 'wallets', wallets, 'took', took) from yr_launch where mint = p_mint);
end $$;

create or replace function yr_launch_put(p_mint text, p_slot bigint, p_dev text, p_wallets jsonb, p_took real) returns void
language plpgsql security definer set search_path = public set synchronous_commit = off as $$
begin
  perform yr_guard();
  if jsonb_typeof(p_wallets) <> 'array' or jsonb_array_length(p_wallets) > 60 then return; end if;
  insert into yr_launch (mint, t, slot, dev, wallets, took) values (left(p_mint, 44), yr_now(), p_slot, left(p_dev, 44), p_wallets, p_took)
  on conflict (mint) do nothing;
end $$;

create or replace function yr_sold_by(p_mint text, p_whos text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  if p_whos is null or cardinality(p_whos) > 60 then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(who, round(s::numeric)) from (
    select who, sum(tok) s from yr_ticks where mint = p_mint and k = 2 and who = any (p_whos) group by who) z), '{}'::jsonb);
end $$;

create table if not exists yr_xlink (mint text primary key, handle text, post text, t bigint not null);
alter table yr_xlink enable row level security;
create index if not exists yr_xlink_handle on yr_xlink (handle) where handle is not null;
create index if not exists yr_xlink_post on yr_xlink (post) where post is not null;

create or replace function yr_xlink_put(p_rows jsonb) returns void
language plpgsql security definer set search_path = public set synchronous_commit = off as $$
begin
  perform yr_guard();
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 30 then return; end if;
  insert into yr_xlink (mint, handle, post, t)
  select left(r->>'mint', 44), lower(left(r->>'handle', 16)), left(r->>'post', 24), coalesce((r->>'t')::bigint, yr_now())
  from jsonb_array_elements(p_rows) r where r->>'mint' is not null
  on conflict (mint) do update set handle = coalesce(excluded.handle, yr_xlink.handle), post = coalesce(excluded.post, yr_xlink.post);
end $$;

-- which of these coins yeppo has no X link for yet, with their metadata address
create or replace function yr_xlink_need(p_mints text[]) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform yr_guard();
  if p_mints is null or cardinality(p_mints) > 30 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_array(b.mint, b.uri, b.t)) from yr_obirth b
    where b.mint = any (p_mints) and b.uri is not null and not exists (select 1 from yr_xlink x where x.mint = b.mint)), '[]'::jsonb);
end $$;

create or replace function yr_xlink_stats(p_mint text, p_handle text, p_post text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare h text := lower(nullif(p_handle, ''));
begin
  perform yr_guard();
  return jsonb_build_object(
    'handle', case when h is null then null else (
      select jsonb_build_object('coins', count(*), 'bad', count(*) filter (where c.rug_s is not null or (c.ath > coalesce(nullif(c.mc0, 0), 27.96) * 1.5 and coalesce(c.mc, 0) < c.ath * 0.3)),
        'last', (select jsonb_agg(jsonb_build_array(z.sym, z.t)) from (select c2.sym, x2.t from yr_xlink x2 left join yr_cc c2 on c2.mint = x2.mint
                 where x2.handle = h and x2.mint <> p_mint order by x2.t desc limit 4) z))
      from yr_xlink x left join yr_cc c on c.mint = x.mint where x.handle = h and x.mint <> p_mint) end,
    'post', case when nullif(p_post, '') is null then null else (
      select jsonb_build_object('coins', count(*), 'rank', count(*) filter (where x.t < coalesce((select t from yr_xlink where mint = p_mint), yr_now())) + 1)
      from yr_xlink x where x.post = p_post) end);
end $$;

revoke all on function yr_launch_get(text), yr_launch_put(text, bigint, text, jsonb, real), yr_sold_by(text, text[]),
  yr_xlink_put(jsonb), yr_xlink_need(text[]), yr_xlink_stats(text, text, text) from public;
grant execute on function yr_launch_get(text), yr_launch_put(text, bigint, text, jsonb, real), yr_sold_by(text, text[]),
  yr_xlink_put(jsonb), yr_xlink_need(text[]), yr_xlink_stats(text, text, text) to anon, authenticated;

-- kept 14 days, like yr_cc: cleaned with the hourly record job
create or replace function yr_x_gc() returns void language sql security definer set search_path = public as $$
  delete from yr_launch where t < yr_now() - 14 * 86400000::bigint;
  delete from yr_xlink where t < yr_now() - 14 * 86400000::bigint;
$$;
revoke all on function yr_x_gc() from public, anon, authenticated;
select cron.alter_job((select jobid from cron.job where jobname = 'yr-record'), command := 'select yr_record_calc(); select yr_x_gc();');
