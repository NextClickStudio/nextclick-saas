# yeppo: session diary (append 3–6 lines at the end of every task; read only the last 30 lines)

- 4 Nov ~18:00: verdict now Safe / Risky / Danger only; Exit removed; Big wallets slice. Home, demo, pricing updated.
- 4 Nov ~18:15: no Safe before holders + launch read; linked/bubble wallets → Big wallets. Published. To verify on real
  data that the verdict doesn't flip after the first seconds. Previous chat ran out of credits here.
- 6 Nov: handoff to a new chat. Skill `yeppo` created (state / map / log) to avoid re-reading everything. DB checked:
  last migration 091_birth_sig, 208 MB. The cloud copy of the repo was stale (1 Nov): real code is only on the Mac.
  Waiting for the user's list of final changes.
- 6 Nov ~13:00 Italy: **outage**. Free disk write budget ran out (~12:00 UTC); DB refused connections. User restarted
  the project. 092 applied: yr_cc_roll every 60 s (cap 2 min per run). Dust threshold left at 0.01 SOL on purpose
  (yr_ticks is UNLOGGED: almost no disk cost; small early buys are needed for same-amount cluster detection).
- 6 Nov: 093 applied: Wallet Radar DB (yr_radar_list + yr_radar_set_s / yr_radar_s / yr_radar_book_s), yr-sm cron back
  every 2 min. Checked: 5 of the user's 121 wallets traded in the first 3 min after the restart (capture sees them).
- 6 Nov: reviewed the two open-source "RugRadar" zips: one is an Ethereum Solidity scanner (useless on Solana), the
  other a 6-signal Birdeye score (weaker than yeppo). rugradar.dev (closed source) feature list is in docs/plan-6nov.md.
- 6 Nov: design prototype in the noiz.bio direction published: https://claude.ai/artifact/TNF5XQvCDfJp14ksgjoeCa
  (monochrome, scroll camera, no fades). Waiting for the user's OK before rebuilding the real site.
- Next (on the Mac, real code): build the Radar panel + /api/radar, the new checks, then the redesign. See plan-6nov.md.
- 7 Nov: Mac code (handoff zip, live version) committed to branch `claude/yeppo-mac` (PR #7, draft). Cloud sessions
  can now build on it. Radar built: `/api/radar`, `components/Radar.tsx` (side panel empty state + page `/radar`,
  nav link "Radar"). Early call = `signal` + yeppo's full read Safe (server calls /api/read for the top 3 signals).
  Tested the radar SQL with the user's 121 wallets (19 coins touched in 15 min at night, 0 signals). Not deployed yet.
- 7 Nov night: published (Vercel, commit c12f1be): radar + strategy checklist + radar log call, Deep checks in the
  read (lib/deep.ts: same-amount buys, fresh top holders via edge yr-fresh, serial creator, copied ticker, recycled X,
  buyers 5 min, user's filters), Hot on X (verdicts via /api/verdicts, Safe-only switch, your wallets, narratives with
  Google News headlines via /api/news), new look (warm monochrome tokens, Hanken Grotesk + JetBrains Mono, radar logo,
  CameraStory home, no fades: .rv moves in). Edge yr-fresh v1 deployed. **Migration 094 NOT applied yet** (the
  Supabase approval prompt timed out): until then Deep checks and the radar log are silently off.
- 7 Nov ~01:00: 094 applied (with the user's OK), then 095 (variable `handle` clashed with yr_xlink.handle) and 096
  (same-amount buys skip quick-buy presets 0.1/0.2/0.5/1 SOL minus fees; same-share needs 0.1%+ bags; deep.ts hides
  groups under 1% of supply). Checked on live coins: SUIT 3 wallets x 0.782 SOL = 3.6%. Deployed c8ff2af.
  yr_wfresh still empty until someone opens a coin with a Pro key: check yr_wfresh and edge logs of yr-fresh then.
  Next migration: 097.
- 7 Nov ~01:40: published c099ce5: home rebuilt like noiz.bio (components/Chrome3D.tsx: three.js 0.169 chrome wordmark,
  hero specs, CameraStory as "The panel", 24 checks big number, radar/X sections, guide rows, price, FAQ), radar reads
  every coin with >=1 of your wallets (top 4, every 5 s), Hot on X hides posts without new coins and lists your
  wallets' coins first (hot-hits), extension 3.4.0 (radar icons, warm monochrome ui.css, new description), favicon.
  OPEN: user says "opening a coin is still buggy": no server errors seen; need a screenshot / exact behaviour.
