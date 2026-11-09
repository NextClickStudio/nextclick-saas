-- 077: the old app's tables go (3 Nov 2026): paper trading, the first wallet trackers, the duels and arena games, the
-- coins of the old games. Nothing in yeppo reads or writes them any more. Kept: yr_sm3 and yr_sm_sig (proven wallets,
-- read by yr_risk), yr_licenses, yr_orders, yr_keys, yr_exch, yr_tmeta, yr_config.
alter table if exists yr_keys drop constraint if exists yr_keys_user_id_fkey;
drop table if exists yr_paper_fill, yr_paper_pos, yr_paper_acct, yr_px, yr_sm, yr_sm2, yr_hot_wallets, yr_coins,
  yr_duel_fills, yr_duel_emotes, yr_duel_rounds, yr_duels, yr_lduels, yr_lfills, yr_rduels, yr_rqueue, yr_rtrades,
  yr_rmarks, yr_rcursor, yr_rcursor2, yr_matches, yr_players, yr_events, yr_modes, yr_users, yr_twallets,
  yr_wallet_nonce, yr_fills, yr_templates, yr_tpl_coins, yr_tpl_fills, yr_setup_log;
