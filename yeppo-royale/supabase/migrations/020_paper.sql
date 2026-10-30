-- yeppo paper trading: a pretend wallet with 10 SOL that buys and sells at the real price of the coin's
-- pump.fun curve (latest trade yeppo saw), with fees and slippage, so the whole tool can be tested with no real
-- money. A position can carry its Exit Plan (take profit, stop, time limit): the cron sells it when one hits.
-- Private: only for the owner's tests, never shown to users. A paper wallet is made with the lab key
-- (yr_config 'lab_key'), then its id is the secret that trades it. Additive.

create table if not exists yr_paper_acct (
  id uuid primary key default gen_random_uuid(),
  name text,
  sol double precision not null default 10,
  start_sol double precision not null default 10,
  created_at timestamptz not null default now()
);
create table if not exists yr_paper_pos (
  acct uuid not null references yr_paper_acct (id) on delete cascade,
  mint text not null,
  symbol text,
  tok double precision not null,
  cost double precision not null,      -- SOL spent, fees in
  mc0 double precision not null,       -- market cap (SOL) at entry
  opened_at bigint not null,
  tp real,                             -- multiples of the entry market cap
  stop real,
  until_t bigint,
  primary key (acct, mint)
);
create index if not exists yr_paper_pos_auto on yr_paper_pos (mint) where tp is not null or stop is not null or until_t is not null;
create table if not exists yr_paper_fill (
  id bigserial primary key,
  acct uuid not null references yr_paper_acct (id) on delete cascade,
  mint text not null,
  symbol text,
  side smallint not null,              -- 1 buy, 2 sell
  sol double precision not null,
  tok double precision not null,
  mc double precision not null,
  pnl double precision,                -- sells: SOL out minus the cost of what was sold
  reason text not null,                -- buy, manual, tp, stop, time
  at bigint not null
);
create index if not exists yr_paper_fill_acct on yr_paper_fill (acct, at desc);
alter table yr_paper_acct enable row level security;
alter table yr_paper_pos enable row level security;
alter table yr_paper_fill enable row level security;

-- pump.fun takes about 1.25% a side; another 0.5% stands for the price moving while you click
create or replace function yr_paper_cost() returns double precision language sql immutable as $$ select 0.0175::double precision $$;

-- the coin's curve right now: the latest trade yeppo saw in the last 20 minutes
create or replace function yr_paper_curve(p_mint text, out vsol double precision, out vtok double precision, out t bigint)
language sql stable security definer set search_path = public as $$
  select x.vsol, x.vtok, x.t from yr_ticks x where x.mint = p_mint and x.t > yr_now() - 1200000 and x.vsol > 0 and x.vtok > 0
  order by x.t desc limit 1
$$;
revoke all on function yr_paper_curve(text) from public, anon, authenticated;

create or replace function yr_paper_new(p_key text, p_name text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_key is null or p_key <> (select value from yr_config where key = 'lab_key') then raise exception 'Wrong lab key'; end if;
  insert into yr_paper_acct (name) values (left(p_name, 40)) returning id into v;
  return v;
end $$;
grant execute on function yr_paper_new(text, text) to anon, authenticated;

create or replace function yr_paper_buy(p_acct uuid, p_mint text, p_sol double precision, p_tp real default null, p_stop real default null, p_minutes real default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a yr_paper_acct; c record; x double precision; got double precision; mc double precision; now_ms bigint := yr_now(); sym text;
begin
  select * into a from yr_paper_acct where id = p_acct for update;
  if not found then raise exception 'Unknown paper wallet'; end if;
  if p_sol is null or p_sol < 0.01 or p_sol > 100 then raise exception 'Buy between 0.01 and 100 SOL'; end if;
  if a.sol < p_sol then raise exception 'Not enough paper SOL'; end if;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is null or c.t < now_ms - 120000 then raise exception 'No trade on this coin in the last 2 minutes: no live price'; end if;
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
grant execute on function yr_paper_buy(uuid, text, double precision, real, real, real) to anon, authenticated;

-- sells a share of a position at the curve's price (or, for a coin nobody traded for 20 minutes, at nothing)
create or replace function yr_paper_sell(p_acct uuid, p_mint text, p_frac double precision default 1, p_reason text default 'manual')
returns jsonb language plpgsql security definer set search_path = public as $$
declare p yr_paper_pos; c record; q double precision; out_sol double precision := 0; mc double precision := 0; f double precision; part double precision;
begin
  select * into p from yr_paper_pos where acct = p_acct and mint = p_mint for update;
  if not found then raise exception 'No paper position in this coin'; end if;
  f := least(greatest(coalesce(p_frac, 1), 0.01), 1);
  q := p.tok * f;
  select * into c from yr_paper_curve(p_mint);
  if c.vsol is not null then
    out_sol := (c.vsol - c.vsol * c.vtok / (c.vtok + q)) * (1 - yr_paper_cost());
    mc := c.vsol / c.vtok * 1e9;
  end if;
  part := p.cost * f;
  update yr_paper_acct set sol = sol + out_sol where id = p_acct;
  if f >= 0.999 then delete from yr_paper_pos where acct = p_acct and mint = p_mint;
  else update yr_paper_pos set tok = tok - q, cost = cost - part where acct = p_acct and mint = p_mint;
  end if;
  insert into yr_paper_fill (acct, mint, symbol, side, sol, tok, mc, pnl, reason, at)
  values (p_acct, p_mint, p.symbol, 2, out_sol, q, mc, out_sol - part, coalesce(p_reason, 'manual'), yr_now());
  return jsonb_build_object('sol', out_sol, 'pnl', out_sol - part);
end $$;
grant execute on function yr_paper_sell(uuid, text, double precision, text) to anon, authenticated;

create or replace function yr_paper_reset(p_acct uuid) returns void
language sql security definer set search_path = public as $$
  delete from yr_paper_pos where acct = p_acct;
  delete from yr_paper_fill where acct = p_acct;
  update yr_paper_acct set sol = start_sol where id = p_acct;
$$;
grant execute on function yr_paper_reset(uuid) to anon, authenticated;

create or replace function yr_paper_state(p_acct uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a yr_paper_acct; res jsonb;
begin
  select * into a from yr_paper_acct where id = p_acct;
  if not found then raise exception 'Unknown paper wallet'; end if;
  with pos as (
    select p.*, c.vsol, c.vtok,
      case when c.vsol is null then 0 else (c.vsol - c.vsol * c.vtok / (c.vtok + p.tok)) * (1 - yr_paper_cost()) end val,
      case when c.vsol is null then null else c.vsol / c.vtok * 1e9 end mc
    from yr_paper_pos p left join lateral yr_paper_curve(p.mint) c on true
    where p.acct = p_acct),
  st as (
    select count(*) n, count(*) filter (where pnl > 0) wins, coalesce(sum(pnl), 0) pnl, max(pnl / nullif(sol - pnl, 0)) best, min(pnl / nullif(sol - pnl, 0)) worst
    from yr_paper_fill where acct = p_acct and side = 2)
  select jsonb_build_object(
    'now', yr_now(), 'sol', a.sol, 'start', a.start_sol, 'name', a.name,
    'equity', a.sol + coalesce((select sum(val) from pos), 0),
    'positions', coalesce((select jsonb_agg(jsonb_build_array(mint, symbol, tok, cost, mc0, mc, val, val - cost, tp, stop, until_t, opened_at) order by opened_at desc) from pos), '[]'::jsonb),
    'fills', coalesce((select jsonb_agg(jsonb_build_array(f.mint, f.symbol, f.side, f.sol, f.mc, f.pnl, f.reason, f.at) order by f.at desc)
                       from (select * from yr_paper_fill where acct = p_acct order by at desc limit 40) f), '[]'::jsonb),
    'stats', (select jsonb_build_object('trades', n, 'wins', wins, 'pnl', pnl, 'best', best, 'worst', worst) from st))
  into res;
  return res;
end $$;
grant execute on function yr_paper_state(uuid) to anon, authenticated;

-- service, every 5 s: sell positions whose take profit, stop or time limit was hit
create or replace function yr_paper_auto() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; now_ms bigint := yr_now();
begin
  for r in
    select p.acct, p.mint, p.mc0, p.tp, p.stop, p.until_t, c.vsol / c.vtok * 1e9 mc, c.t
    from yr_paper_pos p left join lateral yr_paper_curve(p.mint) c on true
    where p.tp is not null or p.stop is not null or p.until_t is not null
  loop
    if r.mc is not null and r.tp is not null and r.mc >= r.mc0 * r.tp then
      perform yr_paper_sell(r.acct, r.mint, 1, 'tp'); n := n + 1;
    elsif r.mc is not null and r.stop is not null and r.mc <= r.mc0 * r.stop then
      perform yr_paper_sell(r.acct, r.mint, 1, 'stop'); n := n + 1;
    elsif r.until_t is not null and now_ms >= r.until_t then
      perform yr_paper_sell(r.acct, r.mint, 1, 'time'); n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function yr_paper_auto() from public, anon, authenticated;

select cron.schedule('yr-paper', '5 seconds', 'select yr_paper_auto()');
