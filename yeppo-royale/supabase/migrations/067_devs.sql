-- 067: creators at a glance (2 Nov 2026), for the radar's first-seconds read: a coin is judged in the viewer's browser
-- from its own trades, and only its creator's record comes from here. One index lookup per creator (yr_cc_dev).
create or replace function yr_devs_s(p_devs text[]) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_devs is null or cardinality(p_devs) = 0 or cardinality(p_devs) > 20 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'dev', d.dev,
      'coins', (select count(*) from yr_cc c where c.dev = d.dev),
      'rugs', (select count(*) from yr_cc c where c.dev = d.dev and c.rug_s is not null),
      'ran', (select count(*) from yr_cc c where c.dev = d.dev and (c.grad or c.ath >= coalesce(nullif(c.mc0, 0), 27.96) * 3) and c.t0 < now_ms - 1200000),
      'ok', yr_track_ok(d.dev, now_ms)))
    from unnest(p_devs) d(dev)), '[]'::jsonb);
end $$;
revoke all on function yr_devs_s(text[]) from public, authenticated;
grant execute on function yr_devs_s(text[]) to anon;

-- the first seconds of up to 10 coins, from their trades alone (yr_ticks, written every 4 s): no need to wait for the
-- creator index. 'hidden': supply that left the curve without a trade being seen (the launch bundle); 'ring': the 3
-- biggest buyers' share of the SOL in; 'dev' from the launch record when yeppo has it.
create or replace function yr_early_s(p_mints text[]) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_mints is null or cardinality(p_mints) = 0 or cardinality(p_mints) > 10 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(z.j) from (
      select jsonb_build_object(
        'mint', x.mint,
        'first', min(x.t),
        'buys', count(*) filter (where x.k = 1),
        'sells', count(*) filter (where x.k = 2),
        'wallets', count(distinct x.who) filter (where x.k = 1),
        'solIn', round(coalesce(sum(x.sol) filter (where x.k = 1), 0)::numeric, 3),
        'solOut', round(coalesce(sum(x.sol) filter (where x.k = 2), 0)::numeric, 3),
        'hidden', round((greatest(0, (1.073e9 - (array_agg(x.vtok order by x.t desc))[1]) - sum(case when x.k = 1 then x.tok else -x.tok end)) / 1e9)::numeric, 4),
        'devTok', round((coalesce(sum(case when x.k = 1 then x.tok else -x.tok end) filter (where x.who = b.dev), 0) / 1e9)::numeric, 4),
        'devSold', coalesce(bool_or(x.k = 2 and x.who = b.dev), false),
        'ring', (select round((coalesce(sum(s), 0) / nullif((select sum(sol) from yr_ticks y where y.mint = x.mint and y.k = 1 and y.t > now_ms - 1200000), 0))::numeric, 3)
                 from (select sum(y.sol) s from yr_ticks y where y.mint = x.mint and y.k = 1 and y.t > now_ms - 1200000 group by y.who order by 1 desc limit 3) r),
        'priceX', round(((array_agg(x.vsol / x.vtok order by x.t desc))[1] / (30 / 1.073e9))::numeric, 3),
        'highX', round((max(x.vsol / x.vtok) / (30 / 1.073e9))::numeric, 3)) j
      from yr_ticks x left join yr_obirth b on b.mint = x.mint
      where x.mint = any (p_mints) and x.t > now_ms - 1200000 and x.vtok > 0 and x.vsol > 0
      group by x.mint, b.dev) z), '[]'::jsonb);
end $$;
revoke all on function yr_early_s(text[]) from public, authenticated;
grant execute on function yr_early_s(text[]) to anon;
