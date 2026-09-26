-- MAISON v2 — the fashion trend market.
--   * 8 card families, ~300 trends; new trends are "listed" once real Google history is back-filled.
--   * Weekly seasons: everyone restarts with the same credits, the richest maison wins.
--   * Open market: buy any listed trend, sell any card.
--   * Daily forecast: 5 trends, call rise or fall, a right call pays after 24 hours.
--   * Archive: every trend you ever pulled from a pack, kept forever.
--   * Runway, duels and card expiry are gone.

-- ---------------------------------------------------------------------------
-- Clean up v1 mechanics
-- ---------------------------------------------------------------------------
drop function if exists public.maison_set_runway(uuid);
drop function if exists public.maison_runway_score(uuid[]);
drop function if exists public.maison_leaderboard(int);
drop table if exists public.maison_duels;

-- ---------------------------------------------------------------------------
-- Trends: 8 families + listing
-- ---------------------------------------------------------------------------
alter table public.maison_trends drop constraint if exists maison_trends_family_check;
alter table public.maison_trends add constraint maison_trends_family_check
  check (family in ('piece', 'shoes', 'accessory', 'color', 'material', 'detail', 'aesthetic', 'beauty'));
-- listed: tradable. backfilled: real 30-day history loaded from Google.
alter table public.maison_trends add column if not exists listed boolean not null default false;
alter table public.maison_trends add column if not exists backfilled boolean not null default false;
update public.maison_trends set listed = true;

-- ---------------------------------------------------------------------------
-- Seasons & trophies
-- ---------------------------------------------------------------------------
create table public.maison_seasons (
  id int primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  settled boolean not null default false
);
insert into public.maison_seasons (id, starts_at, ends_at)
values (1, now(), date_trunc('week', now() at time zone 'utc') at time zone 'utc' + interval '14 days');

create table public.maison_trophies (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  season int not null references public.maison_seasons (id),
  rank int not null,
  worth int not null,
  primary key (user_id, season)
);

-- ---------------------------------------------------------------------------
-- Houses & cards
-- ---------------------------------------------------------------------------
alter table public.maison_houses add column if not exists calls_won int not null default 0;
alter table public.maison_houses add column if not exists calls_total int not null default 0;
alter table public.maison_houses drop column if exists duel_streak;

alter table public.maison_cards alter column expires_at drop not null;
alter table public.maison_cards drop column if exists on_runway;
alter table public.maison_cards add column if not exists season int not null default 1;
alter table public.maison_cards add column if not exists origin text not null default 'pack' check (origin in ('pack', 'buy'));
alter table public.maison_cards drop constraint if exists maison_cards_status_check;
alter table public.maison_cards add constraint maison_cards_status_check check (status in ('active', 'sold', 'expired', 'closed'));

-- Fresh start for season 1: v1 cards are closed, every maison gets the season credits and a new pack.
update public.maison_cards set status = 'closed', closed_at = now() where status = 'active';
update public.maison_houses set credits = 10000, last_pack_day = null;
delete from public.maison_notifications;

-- ---------------------------------------------------------------------------
-- Archive, forecast, calls
-- ---------------------------------------------------------------------------
create table public.maison_archive (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  trend_id text not null references public.maison_trends (id) on delete cascade,
  best_rarity text not null check (best_rarity in ('common', 'rare', 'epic', 'legendary')),
  pulls int not null default 1,
  first_at timestamptz not null default now(),
  primary key (user_id, trend_id)
);
insert into public.maison_archive (user_id, trend_id, best_rarity, pulls, first_at)
select user_id, trend_id,
  (array['common', 'rare', 'epic', 'legendary'])[max(array_position(array['common', 'rare', 'epic', 'legendary'], rarity))],
  count(*), min(pulled_at)
from public.maison_cards group by user_id, trend_id
on conflict do nothing;

create table public.maison_forecast (
  day date not null,
  trend_id text not null references public.maison_trends (id) on delete cascade,
  slot int not null,
  open_value numeric not null,
  primary key (day, trend_id)
);

create table public.maison_calls (
  user_id uuid not null references public.maison_houses (user_id) on delete cascade,
  day date not null,
  trend_id text not null references public.maison_trends (id) on delete cascade,
  dir smallint not null check (dir in (-1, 1)),
  at_value numeric not null,
  created_at timestamptz not null default now(),
  result text check (result in ('win', 'loss', 'push')),
  close_value numeric,
  paid int not null default 0,
  settled_at timestamptz,
  primary key (user_id, day, trend_id)
);
create index maison_calls_open_idx on public.maison_calls (created_at) where result is null;
create index maison_calls_day_idx on public.maison_calls (day, trend_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.maison_seasons enable row level security;
alter table public.maison_trophies enable row level security;
alter table public.maison_archive enable row level security;
alter table public.maison_forecast enable row level security;
alter table public.maison_calls enable row level security;
create policy "seasons are public" on public.maison_seasons for select using (true);
create policy "trophies are public" on public.maison_trophies for select using (true);
create policy "archives are public" on public.maison_archive for select using (true);
create policy "forecast is public" on public.maison_forecast for select using (true);
create policy "own calls" on public.maison_calls for select to authenticated using (user_id = (select auth.uid()));

-- Live prices in the app.
alter publication supabase_realtime add table public.maison_trends;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.maison_season()
returns public.maison_seasons language sql stable set search_path = '' as $$
  select * from public.maison_seasons order by id desc limit 1
$$;

create or replace function public.maison_rarity_rank(r text)
returns int language sql immutable set search_path = '' as $$
  select array_position(array['common', 'rare', 'epic', 'legendary'], r)
$$;

-- Today's 5 forecast trends: one per family, among trends with fresh real data.
create or replace function public.maison_pick_forecast(d date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n int := (public.maison_cfg('{forecast,callsPerDay}'))::int;
  have int;
begin
  if exists (select 1 from public.maison_forecast where day = d) then return; end if;
  perform pg_advisory_xact_lock(hashtext('maison_forecast' || d::text));
  if exists (select 1 from public.maison_forecast where day = d) then return; end if;
  insert into public.maison_forecast (day, trend_id, slot, open_value)
  select d, x.id, row_number() over (order by random()), x.value from (
    select distinct on (family) id, value, family from public.maison_trends
    where active and listed and source in ('google', 'serpapi') and updated_at > now() - interval '12 hours'
    order by family, random()
  ) x
  order by random() limit n;
  select count(*) into have from public.maison_forecast where day = d;
  if have < n then
    insert into public.maison_forecast (day, trend_id, slot, open_value)
    select d, t.id, have + row_number() over (order by random()), t.value from public.maison_trends t
    where t.active and t.listed and not exists (select 1 from public.maison_forecast f where f.day = d and f.trend_id = t.id)
    order by random() limit n - have;
  end if;
end $$;
revoke execute on function public.maison_pick_forecast(date) from public, anon, authenticated;

-- Add a pulled card to the player's archive.
create or replace function public.maison_archive_add(uid uuid, trend text, rarity text)
returns void language sql security definer set search_path = '' as $$
  insert into public.maison_archive (user_id, trend_id, best_rarity) values (uid, trend, rarity)
  on conflict (user_id, trend_id) do update set
    pulls = public.maison_archive.pulls + 1,
    best_rarity = case when public.maison_rarity_rank(excluded.best_rarity) > public.maison_rarity_rank(public.maison_archive.best_rarity)
                       then excluded.best_rarity else public.maison_archive.best_rarity end
$$;
revoke execute on function public.maison_archive_add(uuid, text, text) from public, anon, authenticated;

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
          (public.maison_cfg('{season,startCredits}'))::int)
  returning * into h;
  return h;
exception when unique_violation then
  raise exception 'name_taken';
end $$;

-- ---------------------------------------------------------------------------
-- Packs
-- ---------------------------------------------------------------------------
drop function if exists public.maison_draw(uuid, int, int, boolean);
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
  season_id int := (public.maison_season()).id;
  fams text[];
  i int;
  r numeric;
  rar text;
  t public.maison_trends;
  c public.maison_cards;
begin
  -- The first pack shows the range: five different families.
  if first then
    select array_agg(f order by random()) into fams from (select distinct family f from public.maison_trends where active and listed) x;
  end if;
  for i in 1..n loop
    r := random();
    -- The last card of the pack rolls twice and keeps the rarer result.
    if i = n then r := greatest(r, random()); end if;
    rar := case
      when r < p_common then 'common'
      when r < p_common + p_rare then 'rare'
      when r < p_common + p_rare + p_epic then 'epic'
      else 'legendary' end;
    select * into t from public.maison_trends
      where active and listed and (fams is null or family = fams[((i - 1) % array_length(fams, 1)) + 1])
      order by random() limit 1;
    insert into public.maison_cards (user_id, trend_id, rarity, serial, bought_at, season, origin)
    values (uid, t.id, rar, floor(random() * 9999 + 1)::int, t.value, season_id, 'pack')
    returning * into c;
    perform public.maison_archive_add(uid, t.id, rar);
    return next c;
  end loop;
end $$;
revoke execute on function public.maison_draw(uuid, int, int, boolean) from public, anon, authenticated;

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
  is_first := not exists (select 1 from public.maison_archive where user_id = h.user_id);
  update public.maison_houses set last_pack_day = today, streak = new_streak where user_id = h.user_id;
  return query select * from public.maison_draw(h.user_id, (public.maison_cfg('{pack,cardsPerPack}'))::int, new_streak, is_first);
end $$;

create or replace function public.maison_buy_pack()
returns setof public.maison_cards
language plpgsql security definer set search_path = '' as $$
declare
  h public.maison_houses;
  price int := (public.maison_cfg('{pack,extraPackCredits}'))::int;
begin
  select * into h from public.maison_houses where user_id = auth.uid() for update;
  if h.user_id is null then raise exception 'no_house'; end if;
  if h.credits < price then raise exception 'not_enough_credits'; end if;
  update public.maison_houses set credits = credits - price where user_id = h.user_id;
  return query select * from public.maison_draw(h.user_id, (public.maison_cfg('{pack,cardsPerPack}'))::int, h.streak, false);
end $$;

-- ---------------------------------------------------------------------------
-- Market: buy & sell
-- ---------------------------------------------------------------------------
create or replace function public.maison_buy_trend(p_trend text)
returns public.maison_cards
language plpgsql security definer set search_path = '' as $$
declare
  h public.maison_houses;
  t public.maison_trends;
  price int;
  c public.maison_cards;
begin
  select * into h from public.maison_houses where user_id = auth.uid() for update;
  if h.user_id is null then raise exception 'no_house'; end if;
  select * into t from public.maison_trends where id = p_trend and active and listed;
  if t.id is null then raise exception 'not_listed'; end if;
  price := public.maison_card_worth(t.value, 'common');
  if h.credits < price then raise exception 'not_enough_credits'; end if;
  update public.maison_houses set credits = credits - price where user_id = h.user_id;
  insert into public.maison_cards (user_id, trend_id, rarity, serial, bought_at, season, origin)
  values (h.user_id, t.id, 'common', floor(random() * 9999 + 1)::int, t.value, (public.maison_season()).id, 'buy')
  returning * into c;
  return c;
end $$;

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
  pay := floor(public.maison_card_worth(v, c.rarity) * (1 - (public.maison_cfg('{market,sellFee}'))::numeric))::int;
  update public.maison_cards set status = 'sold', closed_at = now(), closed_for = pay where id = c.id;
  update public.maison_houses set credits = credits + pay where user_id = c.user_id;
  return pay;
end $$;

-- ---------------------------------------------------------------------------
-- Forecast
-- ---------------------------------------------------------------------------
create or replace function public.maison_call(p_trend text, p_dir int)
returns public.maison_calls
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.maison_today();
  v numeric;
  c public.maison_calls;
begin
  if not exists (select 1 from public.maison_houses where user_id = auth.uid()) then raise exception 'no_house'; end if;
  if p_dir not in (-1, 1) then raise exception 'bad_dir'; end if;
  perform public.maison_pick_forecast(today);
  if not exists (select 1 from public.maison_forecast where day = today and trend_id = p_trend) then raise exception 'not_in_forecast'; end if;
  select value into v from public.maison_trends where id = p_trend;
  insert into public.maison_calls (user_id, day, trend_id, dir, at_value)
  values (auth.uid(), today, p_trend, p_dir, v)
  on conflict do nothing
  returning * into c;
  if c.user_id is null then raise exception 'already_called'; end if;
  return c;
end $$;

-- Hourly: calls older than resolveHours are settled against the live price.
create or replace function public.maison_settle_calls()
returns void language plpgsql security definer set search_path = '' as $$
declare
  win int := (public.maison_cfg('{forecast,winCredits}'))::int;
  hours int := (public.maison_cfg('{forecast,resolveHours}'))::int;
  u record;
begin
  update public.maison_calls c set
    close_value = t.value,
    settled_at = now(),
    result = case when t.value = c.at_value then 'push' when sign(t.value - c.at_value) = c.dir then 'win' else 'loss' end,
    paid = case when t.value <> c.at_value and sign(t.value - c.at_value) = c.dir then win else 0 end
  from public.maison_trends t
  where t.id = c.trend_id and c.result is null and c.created_at <= now() - make_interval(hours => hours);

  for u in
    select user_id, count(*) filter (where result = 'win') as w, count(*) filter (where result <> 'push') as n,
           count(*) as total, sum(paid)::int as paid
    from public.maison_calls where settled_at = now() group by user_id
  loop
    update public.maison_houses set credits = credits + u.paid, calls_won = calls_won + u.w, calls_total = calls_total + u.n
    where user_id = u.user_id;
    perform public.maison_notify(u.user_id, 'forecast',
      case when u.w > 0 then format('Forecast: %s of %s calls right. +%s cr.', u.w, u.total, u.paid)
           else format('Forecast: 0 of %s calls right this time.', u.total) end);
  end loop;
end $$;
revoke execute on function public.maison_settle_calls() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Worth, ranks
-- ---------------------------------------------------------------------------
create or replace function public.maison_leaderboard(lim int default 50)
returns table (user_id uuid, name text, monogram text, palette text[], worth int, calls_won int, calls_total int, trophies int)
language sql stable security definer set search_path = '' as $$
  select h.user_id, h.name, h.monogram, h.palette, public.maison_worth(h.user_id) as worth, h.calls_won, h.calls_total,
    (select count(*)::int from public.maison_trophies t where t.user_id = h.user_id and t.rank <= (public.maison_cfg('{season,trophies}'))::int)
  from public.maison_houses h
  order by worth desc
  limit lim
$$;
revoke execute on function public.maison_leaderboard(int) from public, anon;
grant execute on function public.maison_leaderboard(int) to authenticated;

-- Everything the app needs for the signed-in player, in one round trip.
create or replace function public.maison_state()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  h public.maison_houses;
  s public.maison_seasons := public.maison_season();
  today date := public.maison_today();
  my_worth int;
begin
  if uid is null then return jsonb_build_object('house', null); end if;
  select * into h from public.maison_houses where user_id = uid;
  if h.user_id is null then return jsonb_build_object('house', null); end if;
  perform public.maison_pick_forecast(today);
  my_worth := public.maison_worth(uid);
  return jsonb_build_object(
    'house', to_jsonb(h),
    'season', to_jsonb(s),
    'today', today,
    'worth', my_worth,
    'rank', (select count(*) + 1 from public.maison_houses x where x.user_id <> uid and public.maison_worth(x.user_id) > my_worth),
    'players', (select count(*) from public.maison_houses),
    'admin', public.maison_is_admin(),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'trend_id', c.trend_id, 'rarity', c.rarity, 'serial', c.serial,
                                          'bought_at', c.bought_at, 'pulled_at', c.pulled_at, 'origin', c.origin) order by c.pulled_at desc)
      from public.maison_cards c where c.user_id = uid and c.status = 'active'), '[]'),
    'archive', coalesce((
      select jsonb_object_agg(a.trend_id, jsonb_build_object('r', a.best_rarity, 'n', a.pulls))
      from public.maison_archive a where a.user_id = uid), '{}'),
    'forecast', coalesce((
      select jsonb_agg(jsonb_build_object('trend_id', f.trend_id, 'open', f.open_value, 'dir', c.dir, 'at', c.at_value,
               'up', (select count(*) from public.maison_calls x where x.day = f.day and x.trend_id = f.trend_id and x.dir = 1),
               'down', (select count(*) from public.maison_calls x where x.day = f.day and x.trend_id = f.trend_id and x.dir = -1))
             order by f.slot)
      from public.maison_forecast f
      left join public.maison_calls c on c.day = f.day and c.trend_id = f.trend_id and c.user_id = uid
      where f.day = today), '[]'),
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object('trend_id', c.trend_id, 'day', c.day, 'dir', c.dir, 'at', c.at_value,
                                          'created_at', c.created_at, 'result', c.result, 'close', c.close_value, 'paid', c.paid)
             order by c.created_at desc)
      from (select * from public.maison_calls where user_id = uid and (result is null or created_at > now() - interval '3 days')
            order by created_at desc limit 20) c), '[]'),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'body', n.body, 'created_at', n.created_at) order by n.id desc)
      from (select * from public.maison_notifications where user_id = uid and not read order by id desc limit 8) n), '[]'),
    'series', coalesce((
      select jsonb_agg(sn.worth order by sn.day) from public.maison_snapshots sn
      where sn.user_id = uid and sn.day >= (s.starts_at at time zone 'utc')::date), '[]'),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object('season', t.season, 'rank', t.rank, 'worth', t.worth) order by t.season desc)
      from public.maison_trophies t where t.user_id = uid), '[]')
  );
end $$;
revoke execute on function public.maison_state() from public, anon;
grant execute on function public.maison_state() to authenticated;

-- ---------------------------------------------------------------------------
-- Daily rollover (00:02 UTC): snapshots, new market day, season end.
-- ---------------------------------------------------------------------------
drop function if exists public.maison_daily_rollover();
create or replace function public.maison_daily_rollover()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.maison_today();
  s public.maison_seasons := public.maison_season();
  start int := (public.maison_cfg('{season,startCredits}'))::int;
  r record;
begin
  -- 1. Snapshot every maison's worth.
  insert into public.maison_snapshots (user_id, day, worth)
  select user_id, today, public.maison_worth(user_id) from public.maison_houses
  on conflict (user_id, day) do update set worth = excluded.worth;

  -- 2. New day on the market.
  update public.maison_trends set day_open = value;
  perform public.maison_pick_forecast(today);

  -- 3. Season end: rank, trophies, fresh start.
  if now() >= s.ends_at and not s.settled then
    for r in
      select x.user_id, x.worth, rank() over (order by x.worth desc) as rk
      from (select h.user_id, public.maison_worth(h.user_id) as worth from public.maison_houses h
            where exists (select 1 from public.maison_cards c where c.user_id = h.user_id and c.season = s.id)) x
    loop
      insert into public.maison_trophies (user_id, season, rank, worth) values (r.user_id, s.id, r.rk, r.worth)
      on conflict do nothing;
      perform public.maison_notify(r.user_id, 'season',
        format('Season %s is over. You finished #%s with %s cr. Season %s starts now.', s.id, r.rk, r.worth, s.id + 1));
    end loop;
    update public.maison_cards c set status = 'closed', closed_at = now(),
      closed_for = public.maison_card_worth(t.value, c.rarity)
      from public.maison_trends t where t.id = c.trend_id and c.status = 'active';
    update public.maison_houses set credits = start;
    update public.maison_seasons set settled = true where id = s.id;
    insert into public.maison_seasons (id, starts_at, ends_at)
    values (s.id + 1, s.ends_at, s.ends_at + make_interval(days => (public.maison_cfg('{season,days}'))::int));
    delete from public.maison_snapshots where day < today;
  end if;
end $$;
revoke execute on function public.maison_daily_rollover() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants & jobs
-- ---------------------------------------------------------------------------
revoke execute on function public.maison_buy_trend(text) from public, anon;
revoke execute on function public.maison_call(text, int) from public, anon;
revoke execute on function public.maison_open_pack() from public, anon;
revoke execute on function public.maison_buy_pack() from public, anon;
revoke execute on function public.maison_sell_card(uuid) from public, anon;
revoke execute on function public.maison_create_house(text, text, text[], text) from public, anon;
grant execute on function public.maison_buy_trend(text) to authenticated;
grant execute on function public.maison_call(text, int) to authenticated;
grant execute on function public.maison_open_pack() to authenticated;
grant execute on function public.maison_buy_pack() to authenticated;
grant execute on function public.maison_sell_card(uuid) to authenticated;
grant execute on function public.maison_create_house(text, text, text[], text) to authenticated;

select cron.schedule('maison-calls-hourly', '5 * * * *', $$ select public.maison_settle_calls() $$);
