-- yeppo radar, the filters a memecoin trader sets before looking at a coin.
--  * each board coin now also carries how many different wallets traded it in the last 2 minutes (index 14)
--    and how many wallets hold it (index 15): the radar throws out coins moved by one bot (pump.fun's Mayhem
--    Mode agent trades its coin by itself) and coins too few people hold;
--  * yr_grad: every graduation from the pump.fun curve to PumpSwap, from PumpPortal's free feed (yr-capture
--    already listened to it), and yr_grads_recent for the radar, which reads their live market from
--    DexScreener. yeppo does not see trades after graduation.
-- Additive.

do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_hot_build';
  if position('u2' in src) = 0 then
    src := replace(src, 'count(*) filter (where x.k = 1)::int b2, sum(x.sol) v2', 'count(*) filter (where x.k = 1)::int b2, sum(x.sol) v2, count(distinct x.who)::int u2');
    src := replace(src, 'select o.mint, o.t0, o.ath, o.dev, a.n2, a.b2, a.v2 from a', 'select o.mint, o.t0, o.ath, o.dev, a.n2, a.b2, a.v2, a.u2 from a');
    src := replace(src, 'from yr_oh d where d.mint = h.mint and d.who = h.dev), false))',
      'from yr_oh d where d.mint = h.mint and d.who = h.dev), false), h.u2, (select count(*) from yr_oh z where z.mint = h.mint and z.tok > 0))');
    execute format('create or replace function yr_oracle_hot_build() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;

create table if not exists yr_grad (
  mint text primary key,
  t bigint not null
);
create index if not exists yr_grad_t on yr_grad (t);
alter table yr_grad enable row level security;

-- the last 3 hours of graduations, newest first, with what yeppo knows of each coin
create or replace function yr_grads_recent() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_array(g.mint, g.t, b.t, coalesce(b.name, co.name), coalesce(b.symbol, co.symbol), coalesce(b.uri, co.uri), d.rugs, d.coins) order by g.t desc), '[]'::jsonb)
  from (select * from yr_grad where t > yr_now() - 3 * 3600000 order by t desc limit 60) g
  left join yr_obirth b on b.mint = g.mint
  left join yr_coins co on co.mint = g.mint
  left join yr_dev d on d.dev = b.dev
$$;
grant execute on function yr_grads_recent() to anon, authenticated;

-- a day of graduations is plenty
do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_roll';
  if position('delete from yr_grad' in src) = 0 then
    src := replace(src, '    delete from yr_obirth where t < now_ms - 86400000;',
                        '    delete from yr_obirth where t < now_ms - 86400000;
    delete from yr_grad where t < now_ms - 86400000;');
    execute format('create or replace function yr_oracle_roll() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;
