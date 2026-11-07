-- 082: the coins born from the words of the posts that matter right now (4 Nov 2026). The panel's "Hot on X" reads the
-- viewer's J7 feed in the browser, keeps the posts worth it (big accounts, posts handing out a coin), and asks here which
-- coins launched in the last hour carry their words as ticker or name: the biggest three per word, with market cap,
-- high, trades and red flags. Read only, one call per refresh for up to 20 words.
create or replace function yr_named_s(p_words text[]) returns jsonb
language plpgsql stable security definer set search_path = public set statement_timeout = '4s' as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  if p_words is null or cardinality(p_words) = 0 or cardinality(p_words) > 20 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(z.w, z.mint, z.sym, z.t, z.mc, z.hix, z.n, z.rug) order by z.w, z.mc desc)
    from (
      select w, b.mint, b.symbol sym, b.t, round(coalesce(c.mc, 0)::numeric, 1) mc,
        round((coalesce(c.ath, 0) / coalesce(nullif(c.mc0, 0), 27.96))::numeric, 2) hix, coalesce(c.n, 0) n, c.rug_s is not null rug,
        row_number() over (partition by w order by coalesce(c.mc, 0) desc) k
      -- the last hour's launches once (index on t), their ticker and name normalized once, then matched to the words
      from (select mint, symbol, t, regexp_replace(lower(coalesce(symbol, '')), '[^a-z0-9]', '', 'g') s,
              regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]', '', 'g') nm
            from yr_obirth where t > now_ms - 3600000 offset 0) b
      join unnest(p_words) w on b.s = w or b.nm = w
      left join yr_cc c on c.mint = b.mint) z
    where z.k <= 3), '[]'::jsonb);
end $$;
revoke all on function yr_named_s(text[]) from public;
grant execute on function yr_named_s(text[]) to anon, authenticated;
