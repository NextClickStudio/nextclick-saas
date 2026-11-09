-- 095: yr_deep_s's variable 'handle' clashed with yr_xlink.handle (column reference is ambiguous): renamed v_handle.
create or replace function yr_deep_s(p_mint text) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now(); c record; v_handle text; out jsonb;
begin
  perform yr_guard();
  select mint, dev, t0, sym, coalesce(nullif(mc0, 0), 27.96) b0 into c from yr_cc where mint = p_mint;
  if c.mint is null then return null; end if;
  select lower(x.handle) into v_handle from yr_xlink x where x.mint = p_mint;
  with early as (
    select x.who, sum(x.sol) sol, sum(x.tok) tok from yr_ticks x
    where x.mint = p_mint and x.k = 1 and x.who <> c.dev and x.t < c.t0 + 180000
    group by x.who),
  same_sol as (
    select round(sol::numeric, 3) amt, count(*) n, sum(tok) tok from early where sol >= 0.05 group by 1 having count(*) >= 3 order by count(*) desc limit 3),
  same_tok as (
    select round((tok / 1e9 * 100)::numeric, 2) pct, count(*) n, sum(tok) tok from early where tok > 0 group by 1 having count(*) >= 3 order by count(*) desc limit 3)
  select jsonb_build_object(
    'early', (select count(*) from early),
    'seen', exists (select 1 from yr_ticks x where x.mint = p_mint and x.t < c.t0 + 60000),
    'same_sol', (select coalesce(jsonb_agg(jsonb_build_object('amt', amt, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_sol),
    'same_tok', (select coalesce(jsonb_agg(jsonb_build_object('pct', pct, 'n', n, 'share', round((tok / 1e9)::numeric, 4))), '[]') from same_tok),
    'dev_24h', (select count(*) from yr_cc d where d.dev = c.dev and d.t0 > now_ms - 86400000),
    'copy_of', (select jsonb_build_object('mint', o.mint, 'sym', o.sym, 'x', round((o.ath / coalesce(nullif(o.mc0, 0), 27.96))::numeric, 1), 't0', o.t0)
      from yr_cc o where lower(o.sym) = lower(c.sym) and o.mint <> c.mint and o.t0 < c.t0 and o.t0 > now_ms - 7 * 86400000
        and o.ath >= coalesce(nullif(o.mc0, 0), 27.96) * 10
      order by o.ath desc limit 1),
    'x_handle', v_handle,
    'x_other', case when v_handle is null then null else (select jsonb_build_object('n', count(*),
        'died', count(*) filter (where o.rug_s is not null or (o.ath < coalesce(nullif(o.mc0, 0), 27.96) * 2 and o.t0 < now_ms - 3600000)))
      from yr_xlink l join yr_cc o on o.mint = l.mint where lower(l.handle) = v_handle and l.mint <> p_mint and o.t0 > now_ms - 14 * 86400000) end,
    'buyers5', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'buyers5_before', (select count(distinct x.who) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 600000 and x.t <= now_ms - 300000),
    'buys5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 1 and x.t > now_ms - 300000),
    'sells5', (select count(*) from yr_ticks x where x.mint = p_mint and x.k = 2 and x.t > now_ms - 300000))
  into out;
  return out;
end $$;
