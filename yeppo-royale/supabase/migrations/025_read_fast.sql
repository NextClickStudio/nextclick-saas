-- yeppo: the read of a coin, instant.
--  * the board built every 20 s (024) now holds the 40 most traded young coins instead of 20, so most coins a
--    trader opens are already worked out; its light copy keeps each coin's features, for the scam checks;
--  * yr_oracle_one: one coin of that board (look-alike paths and features included), or null when the coin is
--    not on it. yeppo.it/api/read answers from it at once and only works a coin out when it is not there.
-- Additive.

do $do$ declare src text; begin
  select prosrc into src from pg_proc where proname = 'yr_oracle_hot_build';
  if position('order by a.n2 desc limit 20)' in src) > 0 then
    src := replace(src, 'order by a.n2 desc limit 20)', 'order by a.n2 desc limit 40)');
    src := replace(src, '(c.v -> 10) - ''matches'' - ''f''', '(c.v -> 10) - ''matches''');
    execute format('create or replace function yr_oracle_hot_build() returns jsonb language plpgsql security definer set search_path = public as %L', src);
  end if;
end $do$;

create or replace function yr_oracle_one(p_mint text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('now', (c.data ->> 'now')::bigint, 'coin', e.v)
  from yr_tcache c
  left join lateral (select v from jsonb_array_elements(c.data -> 'coins') v where v ->> 0 = p_mint limit 1) e on true
  where c.k = 'ohot_full'
$$;
grant execute on function yr_oracle_one(text) to anon, authenticated;

select yr_oracle_hot_build();
