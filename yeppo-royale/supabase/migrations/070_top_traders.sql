-- 070: top traders on the coin (3 Nov 2026). yr_kol: the ~80 most profitable pump.fun wallets of the last 30 days
-- (kolscan leaderboard), a few KB. yr_risk gains 'kols': every top trader or yeppo-proven wallet that bought this coin in
-- yeppo's 20-minute window (proven wallets from 0.1 SOL: smaller buys are noise), with the SOL they put in, the share of it they still hold and how many seconds after launch
-- they came in. Read-only on the trades yeppo already keeps: no new writes per trade.
create table if not exists yr_kol (who text primary key, name text not null);
alter table yr_kol enable row level security;
revoke all on yr_kol from public, anon, authenticated;
insert into yr_kol (who, name) values
  ('5YRgrP3mjGzrzirYYN5HAQH19cTYREYwGxW6XRJQUzij', 'slingoor'),
  ('CxgPWvH2GoEDENELne2XKAR2z2Fr4shG2uaeyqZceGve', 'narc'),
  ('4xY9T1Q7foJzJsJ6YZDSsfp9zkzeZsXnxd45SixduMmr', 'zeropnl'),
  ('9yYya3F5EJoLnBNKW6z4bZvyQytMXzDcpU5D6yYr4jqL', 'Loopierr'),
  ('B32QbbdDAyhvUQzjcaM5j6ZVKwjCxAwGH5Xgvb9SJqnC', 'Kadenox'),
  ('4vw54BmAogeRV3vPKWyFet5yf8DTLcREzdSzx4rw9Ud9', 'decu'),
  ('xyzfhxfy8NhfeNG3Um3WaUvFXzNuHkrhrZMD8dsStB6', 'Gasp'),
  ('DYAn4XpAkN5mhiXkRB7dGq4Jadnx6XYgu8L5b3WGhbrt', 'The Doc'),
  ('CkPFGv2Wv1vwdWjtXioEgb8jhZQfs3eVZez3QCetu7xD', 'Lynk'),
  ('EHg5YkU2SZBTvuT87rUsvxArGp3HLeye1fXaSDfuMyaf', 'TIL'),
  ('4fZFcK8ms3bFMpo1ACzEUz8bH741fQW4zhAMGd5yZMHu', 'Rilsio'),
  ('5ZuV8eqkvzYFVEKbLvGBdexL2tFv7E5BCd2HZpjqbdg', 'Doji'),
  ('ardinRsN1mNYVeoJWTBsWeYeXvuR9UUDGMsCDKpb6AT', 'trunoest'),
  ('862TYSvRYoiHAK3F3WwTRYAfuGiQaGdxedN9AGvRGWo2', 'Wugi'),
  ('DjM7Tu7whh6P3pGVBfDzwXAx2zaw51GJWrJE3PwtuN7s', 'LUKEY'),
  ('CvNiezB8hofusHCKqu8irJ6t2FKY7VjzpSckofMzk5mB', 'Dali'),
  ('CAPn1yH4oSywsxGU456jfgTrSSUidf9jgeAnHceNUJdw', 'cap'),
  ('BQVz7fQ1WsQmSTMY3umdPEPPTm1sdcBcX9sP7o6kPRmB', 'Limfork.eth'),
  ('DEdEW3SMPU2dCfXEcgj2YppmX9H3bnMDJaU4ctn2BQDQ', 'King Solomon'),
  ('Hw5UKBU5k3YudnGwaykj5E8cYUidNMPuEewRRar5Xoc7', 'Trenchman'),
  ('2X4H5Y9C4Fy6Pf3wpq8Q4gMvLcWvfrrwDv2bdR8AAwQv', 'Orange'),
  ('EDXHdSFdadFbYFFjxPXBqMe1kCEDFqpPu552uvp48HR8', 'Clown'),
  ('831yhv67QpKqLBJjbmw2xoDUeeFHGUx8RnuRj9imeoEs', 'Trey'),
  ('9cdZg6xR4c9kZiqKSzqjn4QHCXNQuC9HEWBzzMJ3mzqw', 'Pikalosi'),
  ('GJA1HEbxGnqBhBifH9uQauzXSB53to5rhDrzmKxhSU65', 'Latuche'),
  ('363sqMFaxZgvCoGzxKjXe1BqMGYkSVoCwmghZUndXuaT', 'nad'),
  ('36A6mEN5rYJdVTb6fMqVvG6ez8g2mTYdr1omWcQ1kDKG', 'Mel'),
  ('CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o', 'Cented'),
  ('5hAgYC8TJCcEZV7LTXAzkTrm7YL29YXyQQJPCNrG84zM', 'Schoen'),
  ('2k7Mnf2K3GhpB7hEVN1CFFeV4oNzzuCS5Q6SmcfAoLHd', 'Setsu'),
  ('2hN82SXLUffhG3vxpezRmae1sGrCBMqHHBDxjmjpagqk', 'lyftical'),
  ('ALauG4FwEYDgSXd5Hen6kvuWSCdUi2fYNSNqM1Ci31wE', 'Thurston zapped arc'),
  ('BtMBMPkoNbnLF9Xn552guQq528KKXcsNBNNBre3oaQtr', 'Letterbomb'),
  ('J9TYAsWWidbrcZybmLSfrLzryANf4CgJBLdvwdGuC8MB', 'Johnson'),
  ('JAunzNqs3bVBcWDjDxfq9rgLzJMCadNXoaCgfzLGMtYs', 'Pengu'),
  ('8MaVa9kdt3NW4Q5HyNAm1X5LbR8PQRVDc1W8NMVK88D5', 'Daumen'),
  ('E7gozEiAPNhpJsdS52amhhN2XCAqLZa7WPrhyR6C8o4S', 'evening'),
  ('GGznouFGrtSETCzvt14gysyjZ2uYKBDVjMBaq8h1aCHG', 'Boeroe'),
  ('4s2WzRLa35FB58bZY1i4CN3WoywJeuYrGYHnTKFsT23z', 'jester'),
  ('Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt', 'theo'),
  ('89HbgWduLwoxcofWpmn1EiF9wEdpgkNDEyPjzZ72mkDi', 'AlxCooks'),
  ('78N177fzNJpp8pG49xDv1efYcTMSzo9tPTKEA9mAVkh2', 'Sheep'),
  ('62N1K57D37AUDGp68tnDYKPjGDsaAAtmo357nBtEtuR', 'set'),
  ('53BnNc49Ajgstciq3CRoyxuBpkkW1r8pgPyvr7JGYnsh', 'Monki'),
  ('FsG3BaPmRTdSrPaivbgJsFNCCa8cPfkUtk8VLWXkHpHP', 'Reljoo'),
  ('4sAUSQFdvWRBxR8UoLBYbw8CcXuwXWxnN8pXa4mtm5nU', 'Scharo'),
  ('DsqRyTUh1R37asYcVf1KdX4CNnz5DKEFmnXvgT4NfTPE', 'Classic'),
  ('J6TDXvarvpBdPXTaTU8eJbtso1PUCYKGkVtMKUUY8iEa', 'Pain'),
  ('EqiFgyNw6kgrmYstWyrP8VjKhka7XEmKTZzHSmwpr1Zb', 'ban'),
  ('95TWoKkvv2z85EXBzd2z6NwbxH2f54AvwuCA9x3NoKep', 'Killua'),
  ('6S8GezkxYUfZy9JPtYnanbcZTMB87Wjt1qx3c6ELajKC', 'Nyhrox'),
  ('GM7Hrz2bDq33ezMtL6KGidSWZXMWgZ6qBuugkb5H8NvN', 'Beaver'),
  ('86AEJExyjeNNgcp7GrAvCXTDicf5aGWgoERbXFiG1EdD', 'Publix'),
  ('ADC1QV9raLnGGDbnWdnsxazeZ4Tsiho4vrWadYswA2ph', 'Ducky'),
  ('6TAHDM5Tod7dBTZdYQxzgJZKxxPfiNV9udPHMiUNumyK', 'Bluey'),
  ('4yo9CUuTBbds9NFhZd4MzPiZZkUvveXdTnAH8qMsE8ku', 'Gfree'),
  ('DNfuF1L62WWyW3pNakVkyGGFzVVhj4Yr52jSmdTyeBHm', 'Gake'),
  ('4BdKaxN8G6ka4GYtQQWk4G4dZRUTX2vQH9GcXdBREFUk', 'Jijo'),
  ('67Nwfi9hgwqhxGoovT2JGLU67uxfomLwQAWncjXXzU6U', 'Silver'),
  ('G6fUXjMKPJzCY1rveAE6Qm7wy5U3vZgKDJmN1VPAdiZC', 'clukz'),
  ('719sfKUjiMThumTt2u39VMGn612BZyCcwbM5Pe8SqFYz', 'Fashr'),
  ('8oQoMhfBQnRspn7QtNAq2aPThRE4q94kLSTwaaFQvRgs', 'big bags bobby'),
  ('951wq3qDowjKHaycrNaiRB5WpovYVKXnqhnrcKPh46zt', 'jrus'),
  ('2e1w3Xo441Ytvwn54wCn8itAXwCKbiizc9ynGEv14Vis', 'prettyover'),
  ('7zTnUTHMd5qFUpZrrbXazpvGwC1Hvb3g5rFjnFAygLSo', 'Apollo'),
  ('3uz65G8e463MA5FxcSu1rTUyWRtrRLRZYskKtEHHj7qn', 'Felix'),
  ('8nqtxpFpuXwfXG4pBLsDkkuMMPK9FjSkBMCn542HiM3v', 'dov 7'),
  ('A3W8psibkTUvjxs4LRscbnjux6TFDXdvD4m4GsGpQ2KJ', 'Numer0 trencharc'),
  ('4nwfXw7n98jEQn93VWY7Cuf1jnn1scHXuXCPGVYS9k6T', 'Frost'),
  ('5B79fMkcFeRTiwm7ehsZsFiKsC7m7n1Bgv9yLxPp9q2X', 'bandit'),
  ('5vg7he5HibvsAW86wfiuP6jw7VwKmUAnP6P93mVCdpJu', 'blixze'),
  ('7NnaXghjuU92gM9kmwXysqa5HboyZuR2LTaBnvazFxSH', 'Pavlo'),
  ('EeXvxkcGqMDZeTaVeawzxm9mbzZwqDUMmfG3bF7uzumH', 'milito'),
  ('3bzaJd5yZG73EVDz8xosQb7gfZm2LN5auFGh6wnP1n1f', 'Matt'),
  ('CgaA9a1JwAXJyfHuvZ7VW8YfTVRkdiT5mjBBSKcg7Rz5', 'Art'),
  ('4DdrfiDHpmx55i4SPssxVzS9ZaKLb8qr45NKY9Er9nNh', 'Mr. Frog'),
  ('FAicXNV5FVqtfbpn4Zccs71XcfGeyxBSGbqLDyDJZjke', 'radiance'),
  ('B9oKseVKRntTvfADyaUoH7oVmoyVbBfUf4NKyQc4KK2D', 'Fozzy'),
  ('99xnE2zEFi8YhmKDaikc1EvH6ELTQJppnqUwMzmpLXrs', 'Coler'),
  ('4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t', 'Mitch'),
  ('AuPp4YTMTyqxYXQnHc5KUc6pUuCSsHQpBJhgnD45yqrf', 'Dani'),
  ('Dvbv5TdAyPpJk16X9mUxWFVicYtCUxTLhuof8TGuUaRv', 'CookDoc'),
  ('8rvAsDKeAcEjEkiZMug9k8v1y8mW6gQQiMobd89Uy7qR', 'Casino')
on conflict (who) do update set name = excluded.name;

create or replace function yr_risk(p_mint text, p_dev text, p_t0 bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  with x as (
    select who, t, k, tok, sol, vtok from yr_ticks
    where mint = p_mint and t > yr_now() - 1200000 and k in (1, 2)),
  w as (
    select who,
      min(t) filter (where k = 1) fb,
      sum(case when k = 1 then tok else -tok end) net,
      coalesce(sum(tok) filter (where k = 1), 0) bought,
      coalesce(sum(sol) filter (where k = 1), 0) solin,
      coalesce(sum(tok) filter (where k = 2 and t > yr_now() - 180000), 0) sold3,
      coalesce(sum(sol) filter (where k = 2 and t > yr_now() - 120000), 0) sell2
    from x where who <> coalesce(p_dev, '') group by who),
  sn as (select * from w where p_t0 is not null and fb <= p_t0 + 15000),
  kl as (
    select coalesce(k.name, '') n, w.fb, w.solin, w.bought, w.net from w
    left join yr_kol k on k.who = w.who
    left join yr_sm3 s on s.who = w.who
    where w.fb is not null and (k.who is not null or (w.solin >= 0.1 and s.who is not null and yr_sm_proven(s)))),
  curve as (
    select (1.073e9 - (array_agg(vtok order by t desc))[1]) gone,
      sum(case when k = 1 then tok else -tok end) seen
    from x where vtok > 0),
  f as (select p_t0 is not null and p_t0 > yr_now() - 1190000 as fl)
  select jsonb_build_object(
    'full', (select fl from f),
    'snipers', (select count(*) from sn),
    'sniperHeld', round((coalesce((select sum(greatest(net, 0)) from sn), 0) / 1e9)::numeric, 4),
    'sniperTook', round((coalesce((select sum(bought) from sn), 0) / 1e9)::numeric, 4),
    'topHeld', round((coalesce((select max(greatest(net, 0)) from w), 0) / 1e9)::numeric, 4),
    'top10Held', round((coalesce((select sum(v) from (select greatest(net, 0) v from w order by 1 desc limit 10) z), 0) / 1e9)::numeric, 4),
    'out', (select round((greatest(0, gone) / 1e9)::numeric, 4) from curve where gone is not null),
    'hidden', case when (select fl from f) then
      (select round((greatest(0, gone - coalesce(seen, 0)) / 1e9)::numeric, 4) from curve where gone is not null) end,
    'dumpers', (select count(*) from w where bought >= 0.03e9 and sold3 >= bought * 0.5),
    'dumped', round((coalesce((select sum(sold3) from w where bought >= 0.03e9 and sold3 >= bought * 0.5), 0) / 1e9)::numeric, 4),
    'sell2', round(coalesce((select sum(sell2) from w), 0)::numeric, 3),
    'topSell2', round(coalesce((select max(sell2) from w), 0)::numeric, 3),
    'smart', (select count(*) from w join yr_sm3 s on s.who = w.who where w.net > 0 and yr_sm_proven(s)),
    'kols', coalesce((select jsonb_agg(jsonb_build_object(
        'n', n,
        'sol', round(solin::numeric, 2),
        'left', case when bought > 0 then round((greatest(net, 0) / bought)::numeric, 2) else 0 end,
        's', case when p_t0 is not null then greatest(0, (fb - p_t0) / 1000) end) order by fb) from kl), '[]'::jsonb));
$$;
revoke all on function yr_risk(text, text, bigint) from public, anon, authenticated;
