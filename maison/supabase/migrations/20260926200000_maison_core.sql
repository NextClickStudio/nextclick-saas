-- MAISON — core schema.
-- Every table has Row Level Security. Clients can only READ; every write goes
-- through the security-definer functions below, which enforce the game rules.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.maison_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null
);

create table public.maison_trends (
  id text primary key,
  name text not null,
  family text not null check (family in ('piece', 'color', 'material', 'detail', 'aesthetic')),
  query text not null,
  style jsonb not null default '{}',
  value numeric not null default 100,
  -- Value at the start of the current day (UTC): "today" change and duels use it.
  day_open numeric not null default 100,
  source text not null default 'seed',
  updated_at timestamptz not null default now(),
  active boolean not null default true
);

create table public.maison_trend_points (
  trend_id text not null references public.maison_trends (id) on delete cascade,
  ts timestamptz not null,
  value numeric not null,
  source text not null,
  primary key (trend_id, ts)
);

create table public.maison_houses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null unique check (char_length(name) between 2 and 32),
  monogram text not null check (char_length(monogram) between 1 and 3),
  palette text[] not null check (array_length(palette, 1) = 3),
  manifesto text not null default '' check (char_length(manifesto) <= 140),
  credits int not null default 0,
  streak int not null default 0,
  last_pack_day date,
  duel_streak int not null default 0,
  created_at timestamptz not null default now()
);

create table public.maison_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  trend_id text not null references public.maison_trends (id),
  rarity text not null check (rarity in ('common', 'rare', 'epic', 'legendary')),
  serial int not null,
  bought_at numeric not null,
  pulled_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'sold', 'expired')),
  on_runway boolean not null default false,
  closed_at timestamptz,
  closed_for int
);
create index maison_cards_user_idx on public.maison_cards (user_id, status);
create index maison_cards_trend_idx on public.maison_cards (trend_id);

create table public.maison_snapshots (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  day date not null,
  worth int not null,
  primary key (user_id, day)
);

create table public.maison_duels (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  a uuid not null references public.maison_houses (user_id) on delete cascade,
  b uuid references public.maison_houses (user_id) on delete cascade,
  a_cards uuid[] not null default '{}',
  b_cards uuid[] not null default '{}',
  a_score numeric,
  b_score numeric,
  winner uuid,
  settled boolean not null default false
);
create index maison_duels_day_idx on public.maison_duels (day);

create table public.maison_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  kind text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index maison_notifications_user_idx on public.maison_notifications (user_id, read);

create table public.maison_market_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  source text,
  ok int not null default 0,
  failed int not null default 0,
  note text
);

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only for clients
-- ---------------------------------------------------------------------------

alter table public.maison_config enable row level security;
alter table public.maison_trends enable row level security;
alter table public.maison_trend_points enable row level security;
alter table public.maison_houses enable row level security;
alter table public.maison_cards enable row level security;
alter table public.maison_snapshots enable row level security;
alter table public.maison_duels enable row level security;
alter table public.maison_notifications enable row level security;
alter table public.maison_market_runs enable row level security;

create policy "config is public" on public.maison_config for select using (true);
create policy "trends are public" on public.maison_trends for select using (true);
create policy "trend points are public" on public.maison_trend_points for select using (true);
create policy "houses are public" on public.maison_houses for select using (true);
create policy "snapshots are public" on public.maison_snapshots for select using (true);
create policy "duels are public" on public.maison_duels for select using (true);
create policy "own cards" on public.maison_cards for select to authenticated using (user_id = (select auth.uid()));
create policy "own notifications" on public.maison_notifications for select to authenticated using (user_id = (select auth.uid()));
-- maison_market_runs: no policy → only admins through functions.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.maison_cfg(path text[])
returns jsonb language sql stable set search_path = '' as $$
  select data #> path from public.maison_config where id = 1
$$;

create or replace function public.maison_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'utc')::date
$$;

create or replace function public.maison_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((auth.jwt() ->> 'email') in (select jsonb_array_elements_text(public.maison_cfg('{admins}'))), false)
$$;

-- Credits a card is worth at a given index value.
create or replace function public.maison_card_worth(v numeric, rarity text)
returns int language sql stable set search_path = '' as $$
  select round(v * (public.maison_cfg(array['rarityMultiplier', rarity]))::numeric
               * (public.maison_cfg('{market,creditsPerPoint}'))::numeric)::int
$$;

create or replace function public.maison_notify(uid uuid, k text, msg text)
returns void language sql security definer set search_path = '' as $$
  insert into public.maison_notifications (user_id, kind, body) values (uid, k, msg)
$$;

-- ---------------------------------------------------------------------------
-- Maison
-- ---------------------------------------------------------------------------

create or replace function public.maison_create_house(p_name text, p_monogram text, p_palette text[], p_manifesto text)
returns public.maison_houses
language plpgsql security definer set search_path = '' as $$
declare h public.maison_houses;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.maison_houses where user_id = auth.uid()) then raise exception 'house_exists'; end if;
  if p_palette is null or array_length(p_palette, 1) <> 3
     or exists (select 1 from unnest(p_palette) c where c !~ '^#[0-9a-fA-F]{6}$') then
    raise exception 'bad_palette';
  end if;
  insert into public.maison_houses (user_id, name, monogram, palette, manifesto, credits)
  values (auth.uid(), trim(p_name), upper(trim(p_monogram)), p_palette, coalesce(trim(p_manifesto), ''),
          (public.maison_cfg('{house,startCredits}'))::int)
  returning * into h;
  return h;
exception when unique_violation then
  raise exception 'name_taken';
end $$;

-- ---------------------------------------------------------------------------
-- Packs
-- ---------------------------------------------------------------------------

-- Internal: draw n cards for a user. `first` guarantees one card per family.
create or replace function public.maison_draw(uid uuid, n int, streak int, first boolean)
returns setof public.maison_cards
language plpgsql security definer set search_path = '' as $$
declare
  odds jsonb := public.maison_cfg('{pack,rarityOdds}');
  bonus numeric := least((public.maison_cfg('{pack,streakBonusCap}'))::numeric,
                         greatest(streak - 1, 0) * (public.maison_cfg('{pack,streakBonusPerDay}'))::numeric);
  p_common numeric := (odds ->> 'common')::numeric - bonus;
  p_rare numeric := (odds ->> 'rare')::numeric + bonus * 0.6;
  p_epic numeric := (odds ->> 'epic')::numeric + bonus * 0.3;
  lifespan int := (public.maison_cfg('{cards,lifespanDays}'))::int;
  families text[] := array['piece', 'color', 'material', 'detail', 'aesthetic'];
  i int;
  r numeric;
  rar text;
  fam text;
  t public.maison_trends;
  c public.maison_cards;
begin
  for i in 1..n loop
    r := random();
    -- The last card of the pack rolls twice and keeps the rarer result.
    if i = n then r := greatest(r, random()); end if;
    rar := case
      when r < p_common then 'common'
      when r < p_common + p_rare then 'rare'
      when r < p_common + p_rare + p_epic then 'epic'
      else 'legendary' end;
    fam := case when first then families[((i - 1) % 5) + 1] else null end;
    select * into t from public.maison_trends
      where active and (fam is null or family = fam)
      order by random() limit 1;
    insert into public.maison_cards (user_id, trend_id, rarity, serial, bought_at, expires_at)
    values (uid, t.id, rar, floor(random() * 9999 + 1)::int, t.value, now() + make_interval(days => lifespan))
    returning * into c;
    -- Fill an empty runway slot of the same family automatically.
    if not exists (select 1 from public.maison_cards x join public.maison_trends y on y.id = x.trend_id
                   where x.user_id = uid and x.status = 'active' and x.on_runway and y.family = t.family) then
      update public.maison_cards set on_runway = true where id = c.id returning * into c;
    end if;
    return next c;
  end loop;
end $$;
revoke execute on function public.maison_draw(uuid, int, int, boolean) from public, anon, authenticated;

-- The free daily pack.
create or replace function public.maison_open_pack()
returns setof public.maison_cards
language plpgsql security definer set search_path = '' as $$
declare
  h public.maison_houses;
  today date := public.maison_today();
  new_streak int;
  is_first boolean;
begin
  select * into h from public.maison_houses where user_id = auth.uid() for update;
  if h.user_id is null then raise exception 'no_house'; end if;
  if h.last_pack_day = today then raise exception 'already_opened'; end if;
  new_streak := case when h.last_pack_day = today - 1 then h.streak + 1 else 1 end;
  is_first := h.last_pack_day is null;
  update public.maison_houses set last_pack_day = today, streak = new_streak where user_id = h.user_id;
  return query select * from public.maison_draw(h.user_id, (public.maison_cfg('{pack,cardsPerPack}'))::int, new_streak, is_first);
end $$;

-- Extra pack bought with credits.
create or replace function public.maison_buy_pack()
returns setof public.maison_cards
language plpgsql security definer set search_path = '' as $$
declare
  h public.maison_houses;
  price int := (public.maison_cfg('{shop,extraPackCredits}'))::int;
begin
  select * into h from public.maison_houses where user_id = auth.uid() for update;
  if h.user_id is null then raise exception 'no_house'; end if;
  if h.credits < price then raise exception 'not_enough_credits'; end if;
  update public.maison_houses set credits = credits - price where user_id = h.user_id;
  return query select * from public.maison_draw(h.user_id, (public.maison_cfg('{pack,cardsPerPack}'))::int, h.streak, false);
end $$;

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

create or replace function public.maison_sell_card(p_card uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  c public.maison_cards;
  v numeric;
  pay int;
begin
  select * into c from public.maison_cards where id = p_card and user_id = auth.uid() for update;
  if c.id is null or c.status <> 'active' then raise exception 'not_sellable'; end if;
  select value into v from public.maison_trends where id = c.trend_id;
  pay := floor(public.maison_card_worth(v, c.rarity) * (1 - (public.maison_cfg('{cards,sellFee}'))::numeric))::int;
  update public.maison_cards set status = 'sold', on_runway = false, closed_at = now(), closed_for = pay where id = c.id;
  update public.maison_houses set credits = credits + pay where user_id = c.user_id;
  return pay;
end $$;

create or replace function public.maison_set_runway(p_card uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.maison_cards;
  fam text;
begin
  select * into c from public.maison_cards where id = p_card and user_id = auth.uid();
  if c.id is null or c.status <> 'active' then raise exception 'not_active'; end if;
  select family into fam from public.maison_trends where id = c.trend_id;
  update public.maison_cards x set on_runway = false
    from public.maison_trends t
    where t.id = x.trend_id and x.user_id = c.user_id and x.status = 'active' and t.family = fam;
  update public.maison_cards set on_runway = true where id = c.id;
end $$;

create or replace function public.maison_mark_read()
returns void language sql security definer set search_path = '' as $$
  update public.maison_notifications set read = true where user_id = auth.uid() and not read
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard & worth
-- ---------------------------------------------------------------------------

create or replace function public.maison_worth(uid uuid)
returns int language sql stable security definer set search_path = '' as $$
  select h.credits + coalesce((
    select sum(public.maison_card_worth(t.value, c.rarity))
    from public.maison_cards c join public.maison_trends t on t.id = c.trend_id
    where c.user_id = uid and c.status = 'active'), 0)::int
  from public.maison_houses h where h.user_id = uid
$$;

create or replace function public.maison_leaderboard(lim int default 50)
returns table (user_id uuid, name text, monogram text, palette text[], worth int, duel_streak int)
language sql stable security definer set search_path = '' as $$
  select h.user_id, h.name, h.monogram, h.palette, public.maison_worth(h.user_id) as worth, h.duel_streak
  from public.maison_houses h
  order by worth desc
  limit lim
$$;

-- Duel score: average "today" move of the runway cards locked at the start of the day, boosted by rarity.
create or replace function public.maison_runway_score(cards uuid[])
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(avg((t.value / nullif(t.day_open, 0) - 1) * (public.maison_cfg(array['rarityMultiplier', c.rarity]))::numeric), 0)
  from public.maison_cards c join public.maison_trends t on t.id = c.trend_id
  where c.id = any (cards)
$$;

-- ---------------------------------------------------------------------------
-- Daily rollover (cron, 00:02 UTC): expire cards, settle duels, snapshot, new duels, new day.
-- ---------------------------------------------------------------------------

create or replace function public.maison_daily_rollover()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.maison_today();
  rate numeric := (public.maison_cfg('{cards,expirySellRate}'))::numeric;
  win int := (public.maison_cfg('{duel,winCredits}'))::int;
  bonus int := (public.maison_cfg('{duel,streakBonus}'))::int;
  d record;
  c record;
  sa numeric;
  sb numeric;
  w uuid;
  prev uuid := null;
  prev_cards uuid[];
  h record;
begin
  -- 1. Expired cards are auto-sold at the expiry rate.
  for c in
    select x.id, x.user_id, x.rarity, t.value, t.name from public.maison_cards x join public.maison_trends t on t.id = x.trend_id
    where x.status = 'active' and x.expires_at <= now()
  loop
    update public.maison_cards set status = 'expired', on_runway = false, closed_at = now(),
      closed_for = floor(public.maison_card_worth(c.value, c.rarity) * rate)::int where id = c.id;
    update public.maison_houses set credits = credits + floor(public.maison_card_worth(c.value, c.rarity) * rate)::int where user_id = c.user_id;
    perform public.maison_notify(c.user_id, 'expired', format('%s expired and was sold for %s cr.', c.name, floor(public.maison_card_worth(c.value, c.rarity) * rate)::int));
  end loop;

  -- 2. Settle the duels still open (scores use the day that is ending).
  for d in select * from public.maison_duels where not settled and day < today loop
    sa := public.maison_runway_score(d.a_cards);
    sb := case when d.b is null then 0 else public.maison_runway_score(d.b_cards) end;
    w := case when d.b is null or sa >= sb then d.a else d.b end;
    update public.maison_duels set a_score = sa, b_score = sb, winner = w, settled = true where id = d.id;
    update public.maison_houses set duel_streak = duel_streak + 1,
      credits = credits + win + bonus * duel_streak where user_id = w;
    update public.maison_houses set duel_streak = 0 where user_id in (d.a, d.b) and user_id <> w;
    perform public.maison_notify(d.a, 'duel', case when w = d.a then format('You won the duel: %s%% vs %s%%. +%s cr.', round(sa * 100, 1), round(sb * 100, 1), win)
                                                    else format('You lost the duel: %s%% vs %s%%.', round(sa * 100, 1), round(sb * 100, 1)) end);
    if d.b is not null then
      perform public.maison_notify(d.b, 'duel', case when w = d.b then format('You won the duel: %s%% vs %s%%. +%s cr.', round(sb * 100, 1), round(sa * 100, 1), win)
                                                      else format('You lost the duel: %s%% vs %s%%.', round(sb * 100, 1), round(sa * 100, 1)) end);
    end if;
  end loop;

  -- 3. Snapshot every maison's worth.
  insert into public.maison_snapshots (user_id, day, worth)
  select user_id, today, public.maison_worth(user_id) from public.maison_houses
  on conflict (user_id, day) do update set worth = excluded.worth;

  -- 4. New day on the market.
  update public.maison_trends set day_open = value;

  -- 5. Pair maisons of similar worth for today's duel (runways locked now).
  if not exists (select 1 from public.maison_duels where day = today) then
    for h in
      select x.user_id, array(select id from public.maison_cards where user_id = x.user_id and status = 'active' and on_runway) as cards
      from public.maison_houses x
      where exists (select 1 from public.maison_cards where user_id = x.user_id and status = 'active' and on_runway)
      order by public.maison_worth(x.user_id) desc
    loop
      if prev is null then
        prev := h.user_id; prev_cards := h.cards;
      else
        insert into public.maison_duels (day, a, b, a_cards, b_cards) values (today, prev, h.user_id, prev_cards, h.cards);
        prev := null;
      end if;
    end loop;
    if prev is not null then
      -- Odd one out: duel against the market (a zero move).
      insert into public.maison_duels (day, a, b, a_cards) values (today, prev, null, prev_cards);
    end if;
  end if;
end $$;
revoke execute on function public.maison_daily_rollover() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create or replace function public.maison_admin_set_value(p_trend text, p_value numeric)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.maison_is_admin() then raise exception 'not_admin'; end if;
  if p_value is null or p_value <= 0 then raise exception 'bad_value'; end if;
  update public.maison_trends set value = p_value, source = 'admin', updated_at = now() where id = p_trend;
  insert into public.maison_trend_points (trend_id, ts, value, source) values (p_trend, date_trunc('hour', now()), p_value, 'admin')
  on conflict (trend_id, ts) do update set value = excluded.value, source = excluded.source;
end $$;

create or replace function public.maison_admin_set_active(p_trend text, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.maison_is_admin() then raise exception 'not_admin'; end if;
  update public.maison_trends set active = p_active where id = p_trend;
end $$;

create or replace function public.maison_admin_runs(lim int default 20)
returns setof public.maison_market_runs
language plpgsql security definer set search_path = '' as $$
begin
  if not public.maison_is_admin() then raise exception 'not_admin'; end if;
  return query select * from public.maison_market_runs order by id desc limit lim;
end $$;

-- Only signed-in players may call game functions.
revoke execute on function public.maison_create_house(text, text, text[], text) from public, anon;
revoke execute on function public.maison_open_pack() from public, anon;
revoke execute on function public.maison_buy_pack() from public, anon;
revoke execute on function public.maison_sell_card(uuid) from public, anon;
revoke execute on function public.maison_set_runway(uuid) from public, anon;
revoke execute on function public.maison_mark_read() from public, anon;
revoke execute on function public.maison_notify(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.maison_admin_set_value(text, numeric) from public, anon;
revoke execute on function public.maison_admin_set_active(text, boolean) from public, anon;
revoke execute on function public.maison_admin_runs(int) from public, anon;
grant execute on function public.maison_create_house(text, text, text[], text) to authenticated;
grant execute on function public.maison_open_pack() to authenticated;
grant execute on function public.maison_buy_pack() to authenticated;
grant execute on function public.maison_sell_card(uuid) to authenticated;
grant execute on function public.maison_set_runway(uuid) to authenticated;
grant execute on function public.maison_mark_read() to authenticated;
grant execute on function public.maison_admin_set_value(text, numeric) to authenticated;
grant execute on function public.maison_admin_set_active(text, boolean) to authenticated;
grant execute on function public.maison_admin_runs(int) to authenticated;
