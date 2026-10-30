-- the results of yeppo's own paper bots (yr-bot), for the owner only (lab key). Per bot: closed trades, wins,
-- total and average result, best and worst, and the latest closed trades. Additive.
create or replace function yr_paper_board(p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p_key is null or p_key <> (select value from yr_config where key = 'lab_key') then null else (select coalesce(jsonb_agg(jsonb_build_object(
      'bot', a.name, 'since', extract(epoch from a.created_at) * 1000,
      'open', (select count(*) from yr_paper_pos p where p.acct = a.id),
      'trades', s.n, 'wins', s.wins, 'pnl', round(s.pnl::numeric, 4), 'avg', round(s.avg::numeric, 4),
      'med', round(s.med::numeric, 4), 'best', round(s.best::numeric, 4), 'worst', round(s.worst::numeric, 4),
      'tp', s.tp, 'stop', s.stop, 'time', s.tm,
      'last', (select coalesce(jsonb_agg(jsonb_build_array(f.mint, f.symbol, round((f.pnl / nullif(f.sol - f.pnl, 0))::numeric, 4), f.reason, f.at) order by f.at desc), '[]'::jsonb)
               from (select * from yr_paper_fill where acct = a.id and side = 2 order by at desc limit 12) f)
    ) order by a.name), '[]'::jsonb)
  from yr_paper_acct a
  cross join lateral (
    select count(*) n, count(*) filter (where pnl > 0) wins, coalesce(sum(pnl), 0) pnl,
      avg(pnl / nullif(sol - pnl, 0)) avg, percentile_cont(0.5) within group (order by pnl / nullif(sol - pnl, 0)) med,
      max(pnl / nullif(sol - pnl, 0)) best, min(pnl / nullif(sol - pnl, 0)) worst,
      count(*) filter (where reason = 'tp') tp, count(*) filter (where reason = 'stop') stop, count(*) filter (where reason = 'time') tm
    from yr_paper_fill where acct = a.id and side = 2) s
  where a.name like 'bot:%') end
$$;
grant execute on function yr_paper_board(text) to anon, authenticated;

insert into yr_config (key, value) values ('lab_key', encode(extensions.gen_random_bytes(12), 'hex')) on conflict (key) do nothing;
