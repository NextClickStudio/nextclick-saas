-- 068: launch tidy-up (2 Nov 2026). The wallet tracker is gone: its read no longer answers the public key. The helper
-- yr_sm_proven (used inside yr_risk) is not an API: no public access, and a fixed search_path (Supabase advisor).
revoke all on function yr_smart_s() from public, anon, authenticated;
revoke all on function yr_sm_proven(yr_sm3) from public, anon, authenticated;
alter function yr_sm_proven(yr_sm3) set search_path = public;
