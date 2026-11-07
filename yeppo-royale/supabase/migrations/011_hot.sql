-- yeppo 1v1: Trending from every pump.fun trade, not only the launches yeppo follows.
-- yr_t_hot ranks the coins with the most trades in the last 5 minutes (from yr_ticks), in the same row
-- shape as yr_t_pulse. Names come from yr_coins, or from yr_tmeta, which yr-term fills from the chain for
-- coins yeppo never captured. Additive.

create table if not exists yr_tmeta (
  mint text primary key,
  name text,
  symbol text,
  uri text,
  at timestamptz not null default now()
);
alter table yr_tmeta enable row level security;

-- [mint, name, symbol, uri, createdMs, mcSol, vSol, athMcSol, trades5m, buys5m, sells5m, vol5m, tx1m, x, tg, web, lastMs]
create or replace function yr_t_hot() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c yr_tcache; now_ms bigint := yr_now(); res jsonb;
begin
  select * into c from yr_tcache where k = 'hot';
  if found and c.at > clock_timestamp() - interval '4 seconds' then return c.data; end if;
  if not pg_try_advisory_xact_lock(hashtext('yr_t_hot')) then
    return coalesce(c.data, jsonb_build_object('now', now_ms, 'coins', '[]'::jsonb));
  end if;
  with w as (
    select x.mint, count(*)::int n, count(*) filter (where x.k = 1)::int b, count(*) filter (where x.k = 2)::int s,
           sum(x.sol) vol, count(*) filter (where x.t > now_ms - 60000)::int t1, max(x.t) last,
           max(x.vsol / nullif(x.vtok, 0)) * 1e9 ath,
           (array_agg(x.vsol order by x.t desc))[1] vsol,
           (array_agg(x.vsol / nullif(x.vtok, 0) order by x.t desc))[1] * 1e9 mc
    from yr_ticks x
    where x.t > now_ms - 300000
    group by x.mint
    order by count(*) desc
    limit 60)
  select jsonb_build_object(
    'now', now_ms,
    'coins', coalesce(jsonb_agg(jsonb_build_array(
        w.mint, coalesce(co.name, tm.name), coalesce(co.symbol, tm.symbol), coalesce(co.uri, tm.uri), co.created_ms,
        round(w.mc::numeric, 3), round(w.vsol::numeric, 3), round(w.ath::numeric, 3),
        w.n, w.b, w.s, round(w.vol::numeric, 3), w.t1, co.twitter is not null, co.telegram is not null, co.website is not null, w.last)
      order by w.n desc), '[]'::jsonb))
  into res
  from w
  left join yr_coins co on co.mint = w.mint
  left join yr_tmeta tm on tm.mint = w.mint
  where coalesce(co.status, 'ok') in ('raw', 'ok')
    and coalesce(co.name, tm.name, '') || ' ' || coalesce(co.symbol, tm.symbol, '')
        !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)';
  insert into yr_tcache (k, at, data) values ('hot', clock_timestamp(), res)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return res;
end $$;

grant execute on function yr_t_hot() to anon, authenticated;
