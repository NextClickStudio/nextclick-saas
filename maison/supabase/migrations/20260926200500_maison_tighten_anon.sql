-- These read helpers are only needed by signed-in players.
revoke execute on function public.maison_is_admin() from public, anon;
revoke execute on function public.maison_worth(uuid) from public, anon;
revoke execute on function public.maison_runway_score(uuid[]) from public, anon;
revoke execute on function public.maison_leaderboard(int) from public, anon;
grant execute on function public.maison_is_admin() to authenticated;
grant execute on function public.maison_worth(uuid) to authenticated;
grant execute on function public.maison_runway_score(uuid[]) to authenticated;
grant execute on function public.maison_leaderboard(int) to authenticated;
