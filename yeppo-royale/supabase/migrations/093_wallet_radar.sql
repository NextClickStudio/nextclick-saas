-- 093: Wallet Radar. A Pro user's own list of wallets to follow (imported from Axiom as is), what those wallets are
-- buying right now on pump.fun (from yr_ticks, the last 20 minutes yeppo already keeps: nothing new is captured), and
-- wallets yeppo found on its own that keep getting into coins early before they double (yr_sm3, learned again every
-- 2 minutes). Small tables only: the list (a few hundred rows a user) and the learned wallets (~2,000 rows).

create table if not exists yr_radar_list (
  key text not null,
  who text not null,
  name text,
  emoji text,
  t bigint not null default (extract(epoch from now()) * 1000)::bigint,
  primary key (key, who)
);
alter table yr_radar_list enable row level security;
create index if not exists yr_radar_list_who on yr_radar_list (who);

-- the key must unlock yeppo on this device; the owner key works everywhere
create or replace function yr_radar_key(p_key text, p_dev text) returns text
language plpgsql security definer set search_path = public as $$
declare a jsonb := yr_access(p_key, p_dev);
begin
  if not coalesce((a->>'pro')::boolean, false) then raise exception 'locked' using errcode = '42501'; end if;
  return upper(trim(coalesce(p_key, '')));
end $$;
revoke all on function yr_radar_key(text, text) from public, anon, authenticated;

-- replace the whole list: [{trackedWalletAddress|who, name, emoji}], Axiom's export format or a plain one; 500 at most
create or replace function yr_radar_set_s(p_key text, p_dev text, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text; n int;
begin
  perform yr_guard();
  k := yr_radar_key(p_key, p_dev);
  if k = '' then return jsonb_build_object('error', 'nokey'); end if;
  if jsonb_typeof(p_list) <> 'array' then return jsonb_build_object('error', 'not a list'); end if;
  delete from yr_radar_list where key = k;
  insert into yr_radar_list (key, who, name, emoji)
  select distinct on (w) k, w, left(nullif(trim(e->>'name'), ''), 40), left(nullif(e->>'emoji', ''), 8)
  from (select e, coalesce(e->>'trackedWalletAddress', e->>'who', e->>'address', e #>> '{}') w
        from jsonb_array_elements(p_list) e limit 500) x
  where w ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('saved', n);
end $$;
revoke all on function yr_radar_set_s(text, text, jsonb) from public, authenticated;
grant execute on function yr_radar_set_s(text, text, jsonb) to anon;

-- what the user's wallets (and the wallets yeppo proved on its own) are doing in the last 15 minutes, coin by coin:
-- who bought, who already sold (the "whale exits" signal), first entry, SOL in, and the coin's quick flags.
-- A coin is a signal when 2+ of the user's wallets bought it within 15 minutes and none of them has sold yet.
create or replace function yr_radar_s(p_key text, p_dev text) returns jsonb
language plpgsql security definer set search_path = public set statement_timeout = '6s' as $$
declare k text; now_ms bigint := yr_now(); since bigint := now_ms - 900000; out jsonb;
begin
  perform yr_guard();
  k := yr_radar_key(p_key, p_dev);
  with mine as (select who, name, emoji from yr_radar_list where key = k),
  proven as (select s.who, s.wins, s.tries from yr_sm3 s where yr_sm_proven(s) and not exists (select 1 from mine m where m.who = s.who)),
  act as (
    select x.mint, x.who, (m.who is not null) own, coalesce(m.name, left(x.who, 4) || '…' || right(x.who, 4)) label, m.emoji,
      p.wins, p.tries,
      sum(x.sol) filter (where x.k = 1) sol_in, sum(x.sol) filter (where x.k = 2) sol_out,
      min(x.t) filter (where x.k = 1) first_buy, max(x.t) filter (where x.k = 2) last_sell,
      (array_agg(x.vsol / x.vtok * 1e9 order by x.t) filter (where x.k = 1))[1] mc_in
    from yr_ticks x
    left join mine m on m.who = x.who
    left join proven p on p.who = x.who
    where x.t > since and x.k in (1, 2) and x.vtok > 0 and (m.who is not null or p.who is not null)
    group by x.mint, x.who, m.who, m.name, m.emoji, p.wins, p.tries),
  coin as (
    select a.mint,
      count(*) filter (where a.own and a.first_buy is not null) own_in,
      count(*) filter (where not a.own and a.first_buy is not null) proven_in,
      count(*) filter (where a.sol_out > 0 and coalesce(a.sol_out, 0) >= coalesce(a.sol_in, 0) * 0.5) out_n,
      min(a.first_buy) first_t, max(a.first_buy) last_t, sum(coalesce(a.sol_in, 0)) sol_in,
      min(a.mc_in) mc_in,
      jsonb_agg(jsonb_build_object('who', a.who, 'label', a.label, 'emoji', a.emoji, 'own', a.own, 'wins', a.wins, 'tries', a.tries,
        'in', round(coalesce(a.sol_in, 0)::numeric, 2), 'out', round(coalesce(a.sol_out, 0)::numeric, 2),
        'at', a.first_buy, 'sold', a.last_sell) order by a.first_buy nulls last) wallets
    from act a group by a.mint)
  select coalesce(jsonb_agg(jsonb_build_object(
      'mint', c.mint, 'sym', cc.sym, 'name', cc.name, 't0', cc.t0, 'n', cc.n,
      'mc', round(coalesce(cc.mc, 0)::numeric, 1), 'ath', round(coalesce(cc.ath, 0)::numeric, 1), 'mc_in', round(c.mc_in::numeric, 1),
      'own', c.own_in, 'proven', c.proven_in, 'out', c.out_n, 'first', c.first_t, 'last', c.last_t, 'sol', round(c.sol_in::numeric, 2),
      'signal', c.own_in >= 2 and c.last_t - c.first_t <= 900000 and c.out_n = 0,
      'flags', jsonb_build_object('rug', cc.rug_s is not null, 'bundle', round(greatest(coalesce(cc.bun, 0), coalesce(cc.bun0, 0))::numeric, 2),
        'dev_holds', round((coalesce(cc.dev_tok, 0) / 1e9)::numeric, 3), 'dev_out_s', cc.out_s, 'grad', coalesce(cc.grad, false),
        'dev_cex', exists (select 1 from yr_fund f where f.dev = cc.dev and f.kind = 'exchange')),
      'wallets', c.wallets)
    order by (c.own_in >= 2) desc, c.own_in desc, c.proven_in desc, c.last_t desc), '[]'::jsonb)
  into out
  from (select * from coin where own_in > 0 or proven_in >= 2 order by own_in desc, proven_in desc, last_t desc limit 40) c
  left join yr_cc cc on cc.mint = c.mint;
  return jsonb_build_object('at', now_ms, 'tracked', (select count(*) from yr_radar_list where key = k),
    'proven', (select count(*) from yr_sm3 s where yr_sm_proven(s)), 'coins', out);
end $$;
revoke all on function yr_radar_s(text, text) from public, authenticated;
grant execute on function yr_radar_s(text, text) to anon;

-- the user's list with each wallet's record as yeppo measured it (early entries, how many doubled after it bought,
-- flips = sold within a minute), plus the wallets yeppo proved on its own that aren't on the list yet: to export to Axiom
create or replace function yr_radar_book_s(p_key text, p_dev text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  perform yr_guard();
  k := yr_radar_key(p_key, p_dev);
  return jsonb_build_object(
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('who', m.who, 'name', m.name, 'emoji', m.emoji,
        'wins', s.wins, 'tries', s.tries, 'flips', s.flips, 'creators', (select count(distinct d) from unnest(s.devs) d),
        'proven', coalesce(yr_sm_proven(s), false), 'last', s.last_t) order by s.wins desc nulls last, m.name), '[]'::jsonb)
      from yr_radar_list m left join yr_sm3 s on s.who = m.who where m.key = k),
    'found', (select coalesce(jsonb_agg(jsonb_build_object('who', s.who, 'wins', s.wins, 'tries', s.tries, 'flips', s.flips,
        'hit', round((s.wins::real / greatest(s.tries, 1))::numeric, 2), 'creators', (select count(distinct d) from unnest(s.devs) d),
        'last', s.last_win) order by s.wins desc, s.wins::real / greatest(s.tries, 1) desc), '[]'::jsonb)
      from (select * from yr_sm3 s where yr_sm_proven(s) and not exists (select 1 from yr_radar_list m where m.key = k and m.who = s.who)
            order by s.wins desc limit 200) s));
end $$;
revoke all on function yr_radar_book_s(text, text) from public, authenticated;
grant execute on function yr_radar_book_s(text, text) to anon;

-- learn the early winners again (it stopped on 2 Nov), every 2 minutes to stay light on the free disk
select cron.schedule('yr-sm', '*/2 * * * *', 'select yr_sm_roll();');
