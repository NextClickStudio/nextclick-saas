-- yeppo: inside what the free database can carry. In one minute the database spent about 230 s of work:
-- the board build took 22 s each time and the roll 7.6 s every 10 s, starving every read.
--  * the board is built every 60 s;
--  * the memes of the hour are worked out once a minute by pg_cron into yr_tcache ('metas'), and yr_metas only
--    reads that copy instead of splitting every launch name on every radar request.
-- Additive.

create or replace function yr_metas_build() returns void
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  with w as (
    select distinct b.mint, lower(x.word) word
    from yr_obirth b
    cross join lateral regexp_split_to_table(coalesce(b.name, '') || ' ' || coalesce(b.symbol, ''), '[^A-Za-z0-9]+') x(word)
    where b.t > yr_now() - 3600000 and length(x.word) >= 3
      and lower(x.word) not in ('the', 'and', 'coin', 'token', 'sol', 'solana', 'pump', 'fun', 'meme', 'inu', 'for', 'you', 'who', 'not', 'are', 'this', 'that', 'with', 'new', 'official')),
  s as (
    select w.word, count(*) n, coalesce(sum(o.n), 0) trades, max(o.ath) best
    from w left join yr_oc o on o.mint = w.mint
    group by w.word having count(*) >= 3)
  select coalesce(jsonb_agg(jsonb_build_array(s.word, s.n, s.trades, round(coalesce(s.best, 0)::numeric, 1)) order by s.trades desc), '[]'::jsonb)
  into v from (select * from s order by s.trades desc limit 30) s;
  insert into yr_tcache (k, at, data) values ('metas', clock_timestamp(), v)
  on conflict (k) do update set at = excluded.at, data = excluded.data;
end $$;
revoke all on function yr_metas_build() from public, anon, authenticated;

create or replace function yr_metas() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select data from yr_tcache where k = 'metas'), '[]'::jsonb)
$$;

select yr_metas_build();
select cron.schedule('yr-metas', '* * * * *', 'select yr_metas_build()');
select cron.schedule('yr-ohot', '* * * * *', 'select yr_oracle_hot_build()');
