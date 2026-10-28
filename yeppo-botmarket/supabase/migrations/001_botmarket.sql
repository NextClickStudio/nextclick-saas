-- Botmarket: the stock market for trading bots.
-- Bots paper-trade the real market; users buy bot shares on a bonding curve
-- (price = 1 + 0.001 * supply pts) and earn dividends when a bot closes a winning trade.
-- All writes go through security-definer RPCs (users) or the bm-engine edge function (service role).

create table public.bm_users (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  balance numeric not null default 10000 check (balance >= 0),
  last_claim_at timestamptz,
  is_house boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index bm_users_handle_lower_idx on public.bm_users (lower(handle));

create table public.bm_keys (
  user_id uuid primary key references public.bm_users(id) on delete cascade,
  secret text not null unique
);

create table public.bm_bots (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique check (ticker ~ '^[A-Z0-9]{2,6}$'),
  name text not null,
  emoji text not null default '🤖',
  creator_id uuid not null references public.bm_users(id) on delete cascade,
  asset text not null,
  tf text not null check (tf in ('1m', '5m', '15m', '1h')),
  strategy text not null check (strategy in ('rsi', 'ema', 'breakout', 'dip', 'momentum')),
  params jsonb not null default '{}'::jsonb,
  side text not null check (side in ('long', 'short')),
  leverage int not null check (leverage between 1 and 10),
  tp numeric not null,
  sl numeric not null,
  max_bars int not null default 48,
  status text not null default 'active' check (status in ('active', 'rekt')),
  capital numeric not null default 10000,
  equity numeric not null default 10000,
  position jsonb,
  last_signal bigint not null default 0,
  trades int not null default 0,
  wins int not null default 0,
  pnl_usd numeric not null default 0,
  best_trade numeric not null default 0,
  dividends_paid numeric not null default 0,
  supply numeric not null default 0 check (supply >= 0),
  holders int not null default 0,
  volume numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bm_bots_creator_idx on public.bm_bots (creator_id);

create table public.bm_holdings (
  user_id uuid not null references public.bm_users(id) on delete cascade,
  bot_id uuid not null references public.bm_bots(id) on delete cascade,
  shares numeric not null default 0,
  cost numeric not null default 0,
  dividends numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bot_id)
);
create index bm_holdings_bot_idx on public.bm_holdings (bot_id);

create table public.bm_share_trades (
  id bigint generated always as identity primary key,
  bot_id uuid not null references public.bm_bots(id) on delete cascade,
  user_id uuid not null references public.bm_users(id) on delete cascade,
  handle text not null,
  side text not null check (side in ('buy', 'sell')),
  shares numeric not null,
  pts numeric not null,
  price numeric not null,
  supply_after numeric not null,
  created_at timestamptz not null default now()
);
create index bm_share_trades_bot_idx on public.bm_share_trades (bot_id, id desc);
create index bm_share_trades_user_idx on public.bm_share_trades (user_id, id desc);

create table public.bm_bot_trades (
  id bigint generated always as identity primary key,
  bot_id uuid not null references public.bm_bots(id) on delete cascade,
  side text not null,
  leverage int not null,
  entry numeric not null,
  exit numeric not null,
  pnl_usd numeric not null,
  pnl_pct numeric not null,
  equity_after numeric not null,
  reason text not null,
  dividend numeric not null default 0,
  opened_at timestamptz not null,
  closed_at timestamptz not null default now()
);
create index bm_bot_trades_bot_idx on public.bm_bot_trades (bot_id, id desc);

create table public.bm_activity (
  id bigint generated always as identity primary key,
  kind text not null,
  bot_id uuid references public.bm_bots(id) on delete cascade,
  ticker text,
  emoji text,
  handle text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index bm_activity_bot_idx on public.bm_activity (bot_id, id desc);

create table public.bm_config (
  key text primary key,
  value text not null
);

-- ---------- views ----------

create view public.bm_bots_v with (security_invoker = true) as
select
  b.*,
  u.handle as creator,
  1 + 0.001 * b.supply as price,
  (1 + 0.001 * b.supply) * b.supply as mcap,
  coalesce((
    select t.supply_after from public.bm_share_trades t
    where t.bot_id = b.id and t.created_at <= now() - interval '24 hours'
    order by t.id desc limit 1
  ), 0) as supply_24h,
  coalesce((
    select sum(t.pts) from public.bm_share_trades t
    where t.bot_id = b.id and t.created_at > now() - interval '24 hours'
  ), 0) as volume_24h
from public.bm_bots b
join public.bm_users u on u.id = b.creator_id;

create view public.bm_users_v with (security_invoker = true) as
select
  u.id,
  u.handle,
  u.balance,
  u.is_house,
  u.created_at,
  coalesce(h.value, 0) as holdings_value,
  coalesce(h.dividends, 0) as dividends,
  u.balance + coalesce(h.value, 0) as net_worth,
  (select count(*) from public.bm_bots b where b.creator_id = u.id)::int as bots
from public.bm_users u
left join lateral (
  select sum(x.shares * (1 + 0.001 * b.supply)) as value, sum(x.dividends) as dividends
  from public.bm_holdings x
  join public.bm_bots b on b.id = x.bot_id
  where x.user_id = u.id
) h on true;

-- ---------- access ----------

alter table public.bm_users enable row level security;
alter table public.bm_keys enable row level security;
alter table public.bm_bots enable row level security;
alter table public.bm_holdings enable row level security;
alter table public.bm_share_trades enable row level security;
alter table public.bm_bot_trades enable row level security;
alter table public.bm_activity enable row level security;
alter table public.bm_config enable row level security;

create policy "bm users are public" on public.bm_users for select to anon, authenticated using (true);
create policy "bm bots are public" on public.bm_bots for select to anon, authenticated using (true);
create policy "bm holdings are public" on public.bm_holdings for select to anon, authenticated using (true);
create policy "bm share trades are public" on public.bm_share_trades for select to anon, authenticated using (true);
create policy "bm bot trades are public" on public.bm_bot_trades for select to anon, authenticated using (true);
create policy "bm activity is public" on public.bm_activity for select to anon, authenticated using (true);

revoke all on public.bm_keys, public.bm_config from anon, authenticated;
revoke insert, update, delete, truncate on
  public.bm_users, public.bm_bots, public.bm_holdings, public.bm_share_trades, public.bm_bot_trades, public.bm_activity
  from anon, authenticated;

alter publication supabase_realtime add table public.bm_bots, public.bm_activity, public.bm_share_trades;

-- ---------- helpers ----------

create function public.bm_uid(p_secret text) returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  select user_id into v from bm_keys where secret = p_secret;
  if v is null then
    raise exception 'Session expired. Sign in again.';
  end if;
  return v;
end $$;

create function public.bm_clamp(v jsonb, k text, lo numeric, hi numeric, def numeric) returns numeric
language sql immutable set search_path = public, pg_temp as $$
  select greatest(lo, least(hi, coalesce((v ->> k)::numeric, def)))
$$;

-- ---------- user RPCs ----------

create function public.bm_signup(p_handle text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user bm_users;
  v_secret text;
begin
  p_handle := trim(p_handle);
  if p_handle is null or p_handle !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'Handle must be 3-16 letters, numbers or _';
  end if;
  if exists (select 1 from bm_users where lower(handle) = lower(p_handle)) then
    raise exception 'Handle already taken';
  end if;
  insert into bm_users (handle) values (p_handle) returning * into v_user;
  v_secret := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into bm_keys (user_id, secret) values (v_user.id, v_secret);
  insert into bm_activity (kind, handle) values ('join', v_user.handle);
  return jsonb_build_object('user', to_jsonb(v_user), 'secret', v_secret);
end $$;

create function public.bm_whoami(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_user bm_users;
begin
  select * into v_user from bm_users where id = bm_uid(p_secret);
  return to_jsonb(v_user);
end $$;

create function public.bm_claim(p_secret text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := bm_uid(p_secret);
  v_user bm_users;
begin
  select * into v_user from bm_users where id = v_uid for update;
  if v_user.last_claim_at is not null and v_user.last_claim_at > now() - interval '20 hours' then
    raise exception 'Next claim in %', to_char(v_user.last_claim_at + interval '20 hours' - now(), 'HH24"h "MI"m"');
  end if;
  update bm_users set balance = balance + 1000, last_claim_at = now() where id = v_uid returning * into v_user;
  insert into bm_activity (kind, handle, data) values ('claim', v_user.handle, jsonb_build_object('pts', 1000));
  return to_jsonb(v_user);
end $$;

create function public.bm_launch(p_secret text, p_cfg jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := bm_uid(p_secret);
  v_user bm_users;
  v_bot bm_bots;
  v_ticker text := upper(trim(coalesce(p_cfg ->> 'ticker', '')));
  v_name text := trim(coalesce(p_cfg ->> 'name', ''));
  v_emoji text := coalesce(nullif(trim(p_cfg ->> 'emoji'), ''), '🤖');
  v_asset text := upper(coalesce(p_cfg ->> 'asset', ''));
  v_tf text := coalesce(p_cfg ->> 'tf', '');
  v_strategy text := coalesce(p_cfg ->> 'strategy', '');
  v_side text := coalesce(p_cfg ->> 'side', 'long');
  v_lev int := coalesce((p_cfg ->> 'leverage')::int, 1);
  v_tp numeric := (p_cfg ->> 'tp')::numeric;
  v_sl numeric := (p_cfg ->> 'sl')::numeric;
  v_max int := round(bm_clamp(p_cfg, 'max_bars', 3, 500, 48));
  v_p jsonb := coalesce(p_cfg -> 'params', '{}'::jsonb);
  v_params jsonb;
begin
  if length(v_name) < 3 or length(v_name) > 24 then raise exception 'Name must be 3-24 characters'; end if;
  if v_ticker !~ '^[A-Z0-9]{2,6}$' then raise exception 'Ticker must be 2-6 letters or numbers'; end if;
  if exists (select 1 from bm_bots where ticker = v_ticker) then raise exception 'Ticker $% is already taken', v_ticker; end if;
  if v_asset not in ('BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'PEPE', 'WIF', 'SUI', 'AVAX') then raise exception 'Unsupported asset'; end if;
  if v_tf not in ('1m', '5m', '15m', '1h') then raise exception 'Unsupported timeframe'; end if;
  if v_side not in ('long', 'short') then raise exception 'Side must be long or short'; end if;
  if v_lev < 1 or v_lev > 10 then raise exception 'Leverage must be 1x-10x'; end if;
  if v_tp is null or v_tp < 0.2 or v_tp > 50 then raise exception 'Take profit must be between 0.2 and 50'; end if;
  if v_sl is null or v_sl < 0.2 or v_sl > least(25, 90.0 / v_lev) then raise exception 'Stop loss too wide for this leverage'; end if;
  if char_length(v_emoji) > 4 then v_emoji := '🤖'; end if;

  v_params := case v_strategy
    when 'rsi' then jsonb_build_object('period', round(bm_clamp(v_p, 'period', 5, 30, 14)), 'low', bm_clamp(v_p, 'low', 10, 45, 30), 'high', bm_clamp(v_p, 'high', 55, 90, 70))
    when 'ema' then jsonb_build_object('fast', round(bm_clamp(v_p, 'fast', 3, 50, 9)), 'slow', round(bm_clamp(v_p, 'slow', 5, 200, 21)))
    when 'breakout' then jsonb_build_object('lookback', round(bm_clamp(v_p, 'lookback', 5, 100, 20)))
    when 'dip' then jsonb_build_object('drop', bm_clamp(v_p, 'drop', 0.5, 20, 3), 'bars', round(bm_clamp(v_p, 'bars', 2, 48, 6)))
    when 'momentum' then jsonb_build_object('move', bm_clamp(v_p, 'move', 0.2, 10, 1), 'vol', bm_clamp(v_p, 'vol', 1, 10, 2))
  end;
  if v_params is null then raise exception 'Unknown strategy'; end if;
  if v_strategy = 'ema' and (v_params ->> 'fast')::numeric >= (v_params ->> 'slow')::numeric then
    raise exception 'Fast EMA must be shorter than slow EMA';
  end if;

  select * into v_user from bm_users where id = v_uid for update;
  if (select count(*) from bm_bots where creator_id = v_uid) >= 5 then raise exception 'Max 5 bots per account'; end if;
  if v_user.balance < 1000 then raise exception 'Launching a bot costs 1,000 pts'; end if;
  update bm_users set balance = balance - 1000 where id = v_uid;

  insert into bm_bots (ticker, name, emoji, creator_id, asset, tf, strategy, params, side, leverage, tp, sl, max_bars)
  values (v_ticker, v_name, v_emoji, v_uid, v_asset, v_tf, v_strategy, v_params, v_side, v_lev, v_tp, v_sl, v_max)
  returning * into v_bot;
  insert into bm_activity (kind, bot_id, ticker, emoji, handle, data)
  values ('ipo', v_bot.id, v_bot.ticker, v_bot.emoji, v_user.handle,
          jsonb_build_object('name', v_name, 'asset', v_asset, 'strategy', v_strategy, 'tf', v_tf, 'side', v_side, 'leverage', v_lev));
  return to_jsonb(v_bot);
end $$;

-- Bonding curve: price(s) = 1 + 0.001 s. 2% fee per trade: half to the bot creator, half burned.
create function public.bm_trade(p_secret text, p_bot uuid, p_side text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c_p0 constant numeric := 1;
  c_k constant numeric := 0.001;
  c_fee constant numeric := 0.02;
  v_uid uuid := bm_uid(p_secret);
  v_user bm_users;
  v_bot bm_bots;
  v_h bm_holdings;
  v_s numeric;
  v_b numeric;
  v_n numeric;
  v_fee numeric;
  v_net numeric;
  v_gross numeric;
  v_pts numeric;
  v_price numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount'; end if;
  select * into v_bot from bm_bots where id = p_bot for update;
  if not found then raise exception 'Bot not found'; end if;
  select * into v_user from bm_users where id = v_uid for update;
  select * into v_h from bm_holdings where user_id = v_uid and bot_id = p_bot for update;
  v_s := v_bot.supply;

  if p_side = 'buy' then
    if v_bot.status = 'rekt' then raise exception 'This bot is rekt. Buying is closed.'; end if;
    if p_amount < 1 then raise exception 'Minimum buy is 1 pt'; end if;
    if p_amount > v_user.balance + 0.000001 then raise exception 'Not enough pts'; end if;
    v_pts := least(p_amount, v_user.balance);
    v_fee := v_pts * c_fee;
    v_net := v_pts - v_fee;
    v_b := c_p0 + c_k * v_s;
    v_n := (-v_b + sqrt(v_b * v_b + 2 * c_k * v_net)) / c_k;
    update bm_users set balance = balance - v_pts where id = v_uid;
    update bm_users set balance = balance + v_fee / 2 where id = v_bot.creator_id;
    insert into bm_holdings (user_id, bot_id, shares, cost) values (v_uid, p_bot, v_n, v_pts)
    on conflict (user_id, bot_id) do update
      set shares = bm_holdings.shares + excluded.shares, cost = bm_holdings.cost + excluded.cost, updated_at = now();
    update bm_bots
      set supply = supply + v_n,
          holders = holders + (case when coalesce(v_h.shares, 0) <= 0 then 1 else 0 end),
          volume = volume + v_pts,
          updated_at = now()
      where id = p_bot returning * into v_bot;
  elsif p_side = 'sell' then
    if v_h.shares is null or v_h.shares <= 0 then raise exception 'You have no $% shares', v_bot.ticker; end if;
    v_n := least(p_amount, v_h.shares);
    if v_h.shares - v_n < 0.000001 then v_n := v_h.shares; end if;
    v_gross := v_n * (c_p0 + c_k * (v_s - v_n / 2));
    v_fee := v_gross * c_fee;
    v_pts := v_gross - v_fee;
    update bm_users set balance = balance + v_pts where id = v_uid;
    update bm_users set balance = balance + v_fee / 2 where id = v_bot.creator_id;
    if v_n >= v_h.shares then
      delete from bm_holdings where user_id = v_uid and bot_id = p_bot;
    else
      update bm_holdings set shares = shares - v_n, cost = cost * (1 - v_n / v_h.shares), updated_at = now()
        where user_id = v_uid and bot_id = p_bot;
    end if;
    update bm_bots
      set supply = greatest(0, supply - v_n),
          holders = greatest(0, holders - (case when v_n >= v_h.shares then 1 else 0 end)),
          volume = volume + v_gross,
          updated_at = now()
      where id = p_bot returning * into v_bot;
  else
    raise exception 'Invalid side';
  end if;

  v_price := c_p0 + c_k * v_bot.supply;
  insert into bm_share_trades (bot_id, user_id, handle, side, shares, pts, price, supply_after)
  values (p_bot, v_uid, v_user.handle, p_side, v_n, v_pts, v_price, v_bot.supply);
  insert into bm_activity (kind, bot_id, ticker, emoji, handle, data)
  values (p_side, p_bot, v_bot.ticker, v_bot.emoji, v_user.handle,
          jsonb_build_object('shares', round(v_n, 2), 'pts', round(v_pts, 2), 'price', round(v_price, 4)));
  select * into v_user from bm_users where id = v_uid;
  return jsonb_build_object('user', to_jsonb(v_user), 'bot', to_jsonb(v_bot), 'shares', v_n, 'pts', v_pts, 'price', v_price);
end $$;

-- ---------- engine RPCs (service role only) ----------

create function public.bm_pay_dividend(p_bot uuid, p_total numeric) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_supply numeric;
begin
  select supply into v_supply from bm_bots where id = p_bot for update;
  if v_supply is null or v_supply <= 0 or p_total <= 0 then return 0; end if;
  update bm_users u set balance = u.balance + p_total * h.shares / v_supply
    from bm_holdings h where h.bot_id = p_bot and h.user_id = u.id;
  update bm_holdings set dividends = dividends + p_total * shares / v_supply where bot_id = p_bot;
  update bm_bots set dividends_paid = dividends_paid + p_total where id = p_bot;
  return p_total;
end $$;

create function public.bm_take_lease() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  insert into bm_config (key, value) values ('engine_lease', '1970-01-01T00:00:00Z') on conflict (key) do nothing;
  update bm_config set value = now()::text
    where key = 'engine_lease' and value::timestamptz < now() - interval '45 seconds'
    returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

revoke execute on function public.bm_uid(text) from public, anon, authenticated;
revoke execute on function public.bm_pay_dividend(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.bm_take_lease() from public, anon, authenticated;
revoke execute on function public.bm_clamp(jsonb, text, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.bm_signup(text) to anon, authenticated;
grant execute on function public.bm_whoami(text) to anon, authenticated;
grant execute on function public.bm_claim(text) to anon, authenticated;
grant execute on function public.bm_launch(text, jsonb) to anon, authenticated;
grant execute on function public.bm_trade(text, uuid, text, numeric) to anon, authenticated;
