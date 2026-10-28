-- Arena builder support (called only by the yr-build edge function with the service role).

-- per-coin aggregates used to classify launches as runners, rugs, pumps, bleeds
create or replace function yr_coin_stats(p_before bigint, p_min_events int, p_limit int)
returns table(id int, mint text, name text, symbol text, created_ms bigint, n int, status text,
              init_mc real, peak_mc real, peak_t int, final_mc real, last_t int,
              dev_bought real, dev_sold real, dev_sell_t int, wallets int, migrated_t int, used int, has_social boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.mint, c.name, c.symbol, c.created_ms, c.n_events, c.status,
    (select e.mc from yr_events e where e.coin_id = c.id order by e.t, e.seq limit 1),
    s.peak_mc,
    (select e.t from yr_events e where e.coin_id = c.id order by e.mc desc, e.t limit 1),
    (select e.mc from yr_events e where e.coin_id = c.id order by e.t desc, e.seq desc limit 1),
    s.last_t, s.dev_bought, s.dev_sold, s.dev_sell_t, s.wallets, c.migrated_t,
    (select count(*) from yr_tpl_coins tc where tc.coin_id = c.id)::int,
    (c.twitter is not null or c.telegram is not null or c.website is not null)
  from yr_coins c
  cross join lateral (
    select max(e.mc) peak_mc, max(e.t) last_t,
      coalesce(sum(e.tok) filter (where (e.w = c.creator_h or (c.status <> 'raw' and e.w = 0)) and e.k in (0, 1)), 0)::real dev_bought,
      coalesce(sum(e.tok) filter (where (e.w = c.creator_h or (c.status <> 'raw' and e.w = 0)) and e.k = 2), 0)::real dev_sold,
      min(e.t) filter (where (e.w = c.creator_h or (c.status <> 'raw' and e.w = 0)) and e.k = 2) dev_sell_t,
      count(distinct e.w)::int wallets
    from yr_events e where e.coin_id = c.id
  ) s
  where c.created_ms < p_before and c.n_events >= p_min_events and c.status in ('raw', 'ok', 'nsfw')
  order by c.created_ms desc
  limit p_limit
$$;
revoke all on function yr_coin_stats(bigint, int, int) from public, anon, authenticated;

-- freeze a coin for play: wallets become small per-coin indexes (creator = 0)
create or replace function yr_curate(p_coin int, p_status text, p_outcome text, p_stats jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare c yr_coins;
begin
  select * into c from yr_coins where id = p_coin for update;
  if not found then return; end if;
  if c.status = 'raw' then
    with firsts as (
      select e.w, min(e.t) ft, min(e.seq) fs from yr_events e where e.coin_id = p_coin group by e.w
    ), m as (
      select f.w, (row_number() over (order by (f.w = c.creator_h) desc, f.ft, f.fs) - 1)::int idx from firsts f
    )
    update yr_events e set w = m.idx from m where e.coin_id = p_coin and e.w = m.w;
  end if;
  update yr_coins set status = p_status, outcome = p_outcome, stats = p_stats where id = p_coin;
end $$;
revoke all on function yr_curate(int, text, text, jsonb) from public, anon, authenticated;

-- p_coins: [{ci, coin_id, off}], p_fills: [[bot, ci, t, k, sol, tok], ...]
create or replace function yr_put_template(p_dur int, p_bots jsonb, p_stats jsonb, p_coins jsonb, p_fills jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare tid int;
begin
  insert into yr_templates (dur, bots, stats) values (p_dur, p_bots, p_stats) returning id into tid;
  insert into yr_tpl_coins (tpl, ci, coin_id, off)
  select tid, (x->>'ci')::smallint, (x->>'coin_id')::int, (x->>'off')::int from jsonb_array_elements(p_coins) x;
  insert into yr_tpl_fills (tpl, bot, ci, t, k, sol, tok)
  select tid, (f->>0)::smallint, (f->>1)::smallint, (f->>2)::int, (f->>3)::smallint, (f->>4)::real, (f->>5)::real
  from jsonb_array_elements(p_fills) f;
  return tid;
end $$;
revoke all on function yr_put_template(int, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
