-- yeppo paper trading, fixes: a buy needs a trade in the last 30 s (a 2 minute old price is not a real price),
-- the bot wallets made twice by two first runs racing are dropped, and the bots start again from clean.

create or replace function yr_paper_buy(p_acct uuid, p_mint text, p_sol double precision, p_tp real default null, p_stop real default null, p_minutes real default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a yr_paper_acct; c record; x double precision; got double precision; mc double precision; now_ms bigint := yr_now(); sym text;
begin
  select * into a from yr_paper_acct where id = p_acct for update;
  if not found then raise exception 'Unknown paper wallet'; end if;
  if p_sol is null or p_sol < 0.01 or p_sol > 100 then raise exception 'Buy between 0.01 and 100 SOL'; end if;
  if a.sol < p_sol then raise exception 'Not enough paper SOL'; end if;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is null or c.t < now_ms - 30000 then raise exception 'No trade on this coin in the last 30 seconds: no live price'; end if;
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

delete from yr_paper_acct a
where a.name like 'bot:%'
  and a.id::text not in (select value from jsonb_each_text((select value::jsonb from yr_config where key = 'paper_bots')));

select yr_paper_reset(value::uuid) from jsonb_each_text((select value::jsonb from yr_config where key = 'paper_bots'));
