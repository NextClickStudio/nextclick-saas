-- yeppo: keep the database light, again.
-- The hot board was built inside the request that asked for it. Once it took more than the anon role's
-- statement timeout it was cancelled every time, the cache never refreshed, and every caller tried again:
-- the board froze and the extension's reads waited behind it. Now:
--  * yr_oracle_hot_build: builds the board (the 20 most traded young coins) every 20 s from pg_cron, with no
--    request waiting on it. It keeps two copies in yr_tcache: 'ohot' as before (no look-alike paths, for the
--    home page) and 'ohot_full' with the look-alike paths and the features, so the Exit Plan can be worked
--    out from it. Each coin also carries whether its dev sold (index 13).
--  * yr_oracle_hot: only reads 'ohot', never builds.
--  * yr_oracle_board: reads 'ohot_full', for yeppo.it/api/board (cached at the edge), which the paper bots
--    read once a run instead of reading every coin one by one.
--  * yr_paper_buy says how old the last trade yeppo saw is, when it is too old to be a live price.
-- Additive.

create or replace function yr_oracle_hot_build() returns jsonb
language plpgsql security definer set search_path = public as $$
declare now_ms bigint := yr_now(); v_full jsonb; v_lite jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('yr_oracle_hot_build')) then return jsonb_build_object('busy', true); end if;
  with a as (
    select x.mint, count(*)::int n2, count(*) filter (where x.k = 1)::int b2, sum(x.sol) v2
    from yr_ticks x where x.t > now_ms - 120000 and x.vsol > 0 group by x.mint),
  h as (
    select o.mint, o.t0, o.ath, o.dev, a.n2, a.b2, a.v2 from a join yr_oc o on o.mint = a.mint
    where o.t0 > now_ms - 3600000 order by a.n2 desc limit 20)
  select jsonb_build_object('now', now_ms, 'recorded', (select v from yr_okv where k = 'recorded'),
    'coins', coalesce(jsonb_agg(jsonb_build_array(
      h.mint, coalesce(br.name, co.name, tm.name), coalesce(br.symbol, co.symbol, tm.symbol), coalesce(br.uri, co.uri, tm.uri), h.t0,
      (select x.c from yr_ob x where x.mint = h.mint order by x.b desc limit 1), h.ath, h.n2, h.b2, round(h.v2::numeric, 2),
      yr_ofuture_core(h.mint, 30),
      yr_opattern(h.mint, ((now_ms - h.t0) / 10000)::int),
      yr_odev(h.dev, h.mint),
      coalesce((select d.ns > 0 and d.tok < d.bought * 0.1 from yr_oh d where d.mint = h.mint and d.who = h.dev), false))
      order by h.n2 desc), '[]'::jsonb))
  into v_full
  from h
  left join yr_obirth br on br.mint = h.mint
  left join yr_coins co on co.mint = h.mint
  left join yr_tmeta tm on tm.mint = h.mint
  where coalesce(br.name, co.name, tm.name, '') || ' ' || coalesce(br.symbol, co.symbol, tm.symbol, '')
        !~* '(nigg|n1gg|fag|rape|hitler|nazi|kkk|retard|kike|chink|spic|tranny|porn|nsfw|dick|cock|pussy|fuck|cunt|whore|slut|9/11|isis|jihad)';
  v_lite := jsonb_set(v_full, '{coins}', coalesce((
    select jsonb_agg(case when jsonb_typeof(c.v -> 10) = 'object' then jsonb_set(c.v, '{10}', (c.v -> 10) - 'matches' - 'f') else c.v end order by c.i)
    from jsonb_array_elements(v_full -> 'coins') with ordinality c(v, i)), '[]'::jsonb));
  insert into yr_tcache (k, at, data) values ('ohot', clock_timestamp(), v_lite), ('ohot_full', clock_timestamp(), v_full)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
  return jsonb_build_object('coins', jsonb_array_length(v_full -> 'coins'));
end $$;
revoke all on function yr_oracle_hot_build() from public, anon, authenticated;

create or replace function yr_oracle_hot() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from yr_tcache where k = 'ohot'), jsonb_build_object('now', yr_now(), 'coins', '[]'::jsonb))
$$;

create or replace function yr_oracle_board() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from yr_tcache where k = 'ohot_full'), jsonb_build_object('now', yr_now(), 'coins', '[]'::jsonb))
$$;
grant execute on function yr_oracle_board() to anon, authenticated;

-- the paper buy price must be live: say how old the latest trade is when it is not
create or replace function yr_paper_buy(p_acct uuid, p_mint text, p_sol double precision, p_tp real default null, p_stop real default null, p_minutes real default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a yr_paper_acct; c record; x double precision; got double precision; mc double precision; now_ms bigint := yr_now(); sym text;
begin
  select * into a from yr_paper_acct where id = p_acct for update;
  if not found then raise exception 'Unknown paper wallet'; end if;
  if p_sol is null or p_sol < 0.01 or p_sol > 100 then raise exception 'Buy between 0.01 and 100 SOL'; end if;
  if a.sol < p_sol then raise exception 'Not enough paper SOL'; end if;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is null then raise exception 'yeppo has not seen a trade on this coin in the last 20 minutes: no live price'; end if;
  if c.t < now_ms - 30000 then
    raise exception 'The last trade yeppo saw on this coin was % s ago: no live price, try again in a moment', (now_ms - c.t) / 1000;
  end if;
  x := p_sol * (1 - yr_paper_cost());
  got := c.vtok - c.vsol * c.vtok / (c.vsol + x);
  mc := c.vsol / c.vtok * 1e9;
  select coalesce(b.symbol, co.symbol) into sym from (select 1) z left join yr_obirth b on b.mint = p_mint left join yr_coins co on co.mint = p_mint;
  update yr_paper_acct set sol = sol - p_sol where id = p_acct;
  insert into yr_paper_pos as p (acct, mint, symbol, tok, cost, mc0, opened_at, tp, stop, until_t)
  values (p_acct, p_mint, sym, got, p_sol, mc, now_ms, p_tp, p_stop, case when p_minutes > 0 then now_ms + (p_minutes * 60000)::bigint end)
  on conflict (acct, mint) do update set
    tok = p.tok + excluded.tok, cost = p.cost + excluded.cost,
    mc0 = (p.cost + excluded.cost) / (p.cost / p.mc0 + excluded.cost / excluded.mc0),
    tp = coalesce(excluded.tp, p.tp), stop = coalesce(excluded.stop, p.stop), until_t = coalesce(excluded.until_t, p.until_t);
  insert into yr_paper_fill (acct, mint, symbol, side, sol, tok, mc, reason, at) values (p_acct, p_mint, sym, 1, p_sol, got, mc, 'buy', now_ms);
  return jsonb_build_object('tok', got, 'mc', mc);
end $$;

select yr_oracle_hot_build();
select cron.schedule('yr-ohot', '20 seconds', 'select yr_oracle_hot_build()');
