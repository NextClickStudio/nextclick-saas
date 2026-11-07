-- 087: tidy-up from the launch check (4 Nov 2026): yr_call_move (the record's helper) gets a fixed search path and is
-- callable only from inside the database; yr_named_s, replaced by yr_hot_s (084), is dropped.
alter function yr_call_move(yr_calls, yr_cc) set search_path = public;
revoke all on function yr_call_move(yr_calls, yr_cc) from public, anon, authenticated;
drop function if exists yr_named_s(text[]);
