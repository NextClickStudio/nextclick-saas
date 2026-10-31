-- yeppo bag guard: a wallet's open bags on the coins yeppo follows, each with the oracle's read, the red
-- flags and the supply that could be sold in the next minute; plus the wallet's habits and its last closed
-- trades. Read-only, any public address. Additive.

-- supply (%) held by wallets whose usual exit is within 60 s or already past
create or replace function yr_oexitsoon(p_mint text) returns real
language sql stable security definer set search_path = public as $$
  select (coalesce(sum(greatest(h.tok, 0)), 0) / 1e7)::real
  from yr_oh h join yr_ow w on w.who = h.who
  where h.mint = p_mint and h.tok > 1 and w.n >= 3 and (h.t1 - yr_now()) / 1000.0 + w.hold / w.n < 60
$$;
revoke all on function yr_oexitsoon(text) from public, anon, authenticated;

-- bags: [mint, name, symbol, uri, born, supply %, SOL in, SOL out, first trade, last trade, mc, ath,
--        oracle (no matches), pattern, dev record, dev sold, supply % that could sell within 60 s]
-- closed: [mint, symbol, SOL in, SOL out, first trade, last trade]
create or replace function yr_guard(p_who text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare now_ms bigint := yr_now();
begin
  if p_who is null or p_who !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'That is not a wallet address'; end if;
  return jsonb_build_object(
    'now', now_ms,
    'who', p_who,
    'habits', (select jsonb_build_object('n', w.n, 'hold', round((w.hold / nullif(w.n, 0))::numeric), 'win', round(w.win::numeric / nullif(w.n, 0), 2),
                 'quick', round(w.quick::numeric / nullif(w.n, 0), 2), 'pnl', round(w.pnl::numeric, 2), 'last', w.last_t)
               from yr_ow w where w.who = p_who),
    'bags', (select coalesce(jsonb_agg(jsonb_build_array(
        b.mint, coalesce(br.name, co.name, tm.name), coalesce(br.symbol, co.symbol, tm.symbol), coalesce(br.uri, co.uri, tm.uri), b.t0,
        round((b.tok / 1e7)::numeric, 4), round(b.sin::numeric, 4), round(b.sout::numeric, 4), b.t1, b.tl,
        (select x.c from yr_ob x where x.mint = b.mint order by x.b desc limit 1), b.ath,
        yr_ofuture_core(b.mint, 30) - 'matches' - 'f',
        yr_opattern(b.mint, ((now_ms - b.t0) / 10000)::int),
        yr_odev(b.dev, b.mint),
        (select d.ns > 0 and d.tok < d.bought * 0.2 from yr_oh d where d.mint = b.mint and d.who = b.dev),
        round(yr_oexitsoon(b.mint)::numeric, 2)) order by b.tl desc), '[]'::jsonb)
      from (select h.mint, h.tok, h.sin, h.sout, h.t1, h.tl, o.t0, o.ath, o.dev
            from yr_oh h join yr_oc o on o.mint = h.mint
            where h.who = p_who and h.tok > 1
            order by h.tl desc limit 20) b
      left join yr_obirth br on br.mint = b.mint
      left join yr_coins co on co.mint = b.mint
      left join yr_tmeta tm on tm.mint = b.mint),
    'closed', (select coalesce(jsonb_agg(jsonb_build_array(c.mint, coalesce(br.symbol, co.symbol), round(c.sin::numeric, 4), round(c.sout::numeric, 4), c.t1, c.tl)
                 order by c.tl desc), '[]'::jsonb)
               from (select h.mint, h.sin, h.sout, h.t1, h.tl from yr_oh h where h.who = p_who and h.closed order by h.tl desc limit 12) c
               left join yr_obirth br on br.mint = c.mint
               left join yr_coins co on co.mint = c.mint));
end $$;
grant execute on function yr_guard(text) to anon, authenticated;
