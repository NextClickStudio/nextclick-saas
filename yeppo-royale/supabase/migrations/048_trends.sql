-- Meme waves: every pump.fun launch name of the last 24 hours split into words; a word launched far more often in the
-- last 30 minutes than its usual rate is a wave, and for each wave the coins already trading best. Read-only, guarded
-- like the other reads (only yeppo.it's server), asked at most once a minute by yeppo.it/api/trends.
create or replace function yr_trends_s() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare now_ms bigint := yr_now();
begin
  perform yr_guard();
  return (
    with b as (
      select mint, t, lower(coalesce(name, '') || ' ' || coalesce(symbol, '')) s from yr_obirth where t > now_ms - 86400000),
    w as (
      select distinct b.mint, b.t, w from b, regexp_split_to_table(regexp_replace(b.s, '[^a-z0-9 ]', ' ', 'g'), '\s+') w
      where length(w) between 3 and 20 and w !~ '^[0-9]+$'
        and w <> all (array['the','and','coin','token','inu','pump','pumpe','pumpfun','your','just','new','buy','for','sol','solana',
          'official','meme','fun','with','this','that','you','not','are','who','get','its','his','her','one','all','out','was','has',
          'our','too','can','day','now','first','real','based','super','big','little','mini','baby','king','lord','ceo','world','life',
          'time','era','moon','money','dog','cat','use','let','what','when','why','how','from','will','have','like','dont','im','go',
          'man','guy','boy','girl','best','last','only','very','more','most','make','made','got','see','say','said','way','back'])),
    agg as (select w, count(*) filter (where t > now_ms - 1800000) n30, count(*) n24 from w group by w),
    hot as (
      select w, n30, n24, n30 / greatest(n24 * 1800000.0 / 86400000, 0.5) burst from agg
      where n30 >= 5 order by burst desc, n30 desc limit 8),
    coins as (
      select h.w, c.mint, c.sym, c.t0, c.n, c.mc, c.ath, coalesce(nullif(c.mc0, 0), 27.96) b0, c.rug_s, c.bun0, c.sold_s, c.grad
      from hot h join w on w.w = h.w and w.t > now_ms - 3600000 join yr_cc c on c.mint = w.mint)
    select coalesce(jsonb_agg(jsonb_build_object(
      'theme', h.w, 'n30', h.n30, 'n24', h.n24, 'burst', round(h.burst::numeric, 1),
      'coins', (
        select coalesce(jsonb_agg(jsonb_build_array(x.mint, x.sym, x.t0, x.n, round((x.mc / x.b0)::numeric, 2), round((x.ath / x.b0)::numeric, 2),
                                                    x.rug_s is not null, x.bun0, x.sold_s, x.grad) order by x.score desc), '[]'::jsonb)
        from (
          select *, n * (case when rug_s is not null then 0 else 1 end) * (case when coalesce(bun0, 0) >= 0.15 then 0.3 else 1 end)
                       * (case when ath > 0 and coalesce(mc, 0) / ath < 0.4 then 0.3 else 1 end) score
          from coins where coins.w = h.w order by score desc limit 4) x)
    ) order by h.burst desc), '[]'::jsonb)
    from hot h);
end $$;
revoke execute on function yr_trends_s() from public;
grant execute on function yr_trends_s() to anon, authenticated;
