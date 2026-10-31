-- yeppo lab, the scout: the checks expert memecoin traders run before a buy (top 10 holders, dev share,
-- snipers, the dev's record, bot ladders, activity floors, no vertical spike), measured on yeppo's own data.
--  * yr_scout_feed: the young coins traded in the last 2 minutes (up to p_n, most traded first), each with
--    its features right now (yr_ofeat) and the ladder flag. Wider than the 20 coins of the board. yr-bot
--    applies the checks to it.
--  * three more paper bots (1000 SOL each), added to yr_config 'paper_bots':
--      bot:scout   expert checks pass AND yeppo calls it Runner potential: buys, follows the Exit Plan
--      bot:expert  expert checks pass, yeppo not asked: what the checklist alone does
--      bot:safe    safety checks pass AND yeppo does not flag it (no Likely dump, no Rug risk)
-- Additive.

create or replace function yr_scout_feed(p_n int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare now_ms bigint := yr_now();
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_array(z.mint, yr_ofeat(z.mint, z.b), coalesce((yr_opattern(z.mint, z.b)->>'ladder')::boolean, false))
                              order by z.n2 desc), '[]'::jsonb)
    from (
      select o.mint, ((now_ms - o.t0) / 10000)::int b, a.n2
      from (select x.mint, count(*) n2 from yr_ticks x where x.t > now_ms - 120000 and x.vsol > 0 group by x.mint) a
      join yr_oc o on o.mint = a.mint
      where o.t0 > now_ms - 3600000
      order by a.n2 desc
      limit least(greatest(p_n, 1), 100)) z);
end $$;
revoke all on function yr_scout_feed(int) from public, anon, authenticated;

do $do$ declare bots jsonb; nm text; v uuid; begin
  select coalesce(value::jsonb, '{}'::jsonb) into bots from yr_config where key = 'paper_bots';
  foreach nm in array array['bot:scout', 'bot:expert', 'bot:safe'] loop
    if not bots ? nm then
      insert into yr_paper_acct (name, sol, start_sol) values (nm, 1000, 1000) returning id into v;
      bots := bots || jsonb_build_object(nm, v::text);
    end if;
  end loop;
  update yr_config set value = bots::text where key = 'paper_bots';
end $do$;
