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

## 7 Nov (late) — home as an instrument, extension 3.4.1
- Extension 3.4.1: content.js reads Axiom's new coin URLs (axiom.trade/token/<mint>?chain=sol). Without it the panel said "no coin open" on Axiom. Users on 3.3.1 still see the old purple logo: they must remove it and load the new zip.
- Home rebuilt (components/Home.tsx, Scope.tsx, Explode.tsx, Bits2.tsx, lib/checks.ts; CSS block "home as an instrument" at the end of app/y.css, classes x-*, xh-*, xe-*, xs-*, xr-*, xp-*):
  - hero = faceplate: copy left, canvas radar scope right (example reads: group pulled together, wired, callout, word decoded; pointer reticle reads a wallet), the week's numbers on rolling counters, tape of real calls from yr_wins_s (hidden when empty).
  - "One read, taken apart": sticky 340vh, card → 24 checks exploded in 3D → scan → collapse into "Safe". Next block slides over the stage (-30vh).
  - radar + X as looping examples side by side; price / guides / FAQ packed in one row.
  - CameraStory.tsx and Chrome3D.tsx deleted (three stays in package.json, unused).
  - CHECKS lives in lib/checks.ts: a server component importing an array from a "use client" file gets a client reference, not the array.
- yr_wins_s was failing on every call (GROUP BY error), so /record "wins" were empty: fix in migration 097_wins_fix.sql, applied 7 Nov (returns 6 calls). Next migration: 098. Deployed 4adc92d to yeppo.it, health ok, zip 3.4.1 live.

## 7 Nov (night) — extension 3.5.0 (Axiom), hero = full-screen scope
- User: GMGN works, Axiom doesn't load the read. Cause: Axiom's address (/meme/, /token/, /t/) can hold the pool, not the coin; 3.4.1 read /token/<x> as the coin.
- 3.5.0: every Axiom address goes through background resolveAddr: DexScreener (coin? pool?) → "ends in pump" → the chain (public RPC: getAccountInfo mint? else the last transactions' token balances). The panel also reads the coin from the tab URL itself (host_permissions on the trading sites), so it works without the content script; background injects content.js into open tabs on install/update ("scripting"); content.js copies take over from older ones; panel header shows the version.
- Tested in real Chromium (channel "chromium", PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1 to mock DexScreener/RPC): coin URL, known pool, chain-only pool, SPA navigation, re-injection.
- Every coin click opens Axiom (/go/<mint>, unchanged: axiom.trade/meme/<pool>): radar rows, creator's past coins, home tape, Record wins.
- Hero: Scope full mode fills the hero; it sets --sweep/--mx/--my on the section and the headline's filled copy is masked by a conic gradient = the beam lights the outlined headline as it passes. Verdict word lands by the group (right of the headline).

## 7 Nov (day) — DB CPU fix (098), bug check, the file room redesign
- Outage cause measured: CPU credits, not disk. DB used ~18% of a core (instance sustains ~10%): yr_now() VOLATILE (no index in 29 functions), yr_cc_roll's cleanup ran every minute (2.5 s full scan), a temp table per minute (catalog churn), cron history trimmed daily. 098 applied: yr_now STABLE, yr_cc_gc() hourly, yr_roll_t unlogged scratch, btree yr_cc_t0b, yr-gc hourly (2 h). After: 1.6% of a core, yr_cc_roll 0.2 s, yr_sm_roll 0.2 s.
- Bug check: no JS errors on any page (desktop/mobile). Fixed: RugCheck's group was labelled "Insider group" next to yeppo's "Insiders" (two contradicting numbers) → "Linked wallets"; the Record/tape judged Momentum/Opportunity (words the panel no longer shows) → read route logs Safe/Risky/Danger too, Record page shows the three verdicts; coin page and risk page explained the old words; a pool link pasted in the site's search opened the pool → /c/<pool> redirects to the coin; "Found by yeppo" ranked by wins alone → Wilson lower bound + won in 3 days. Migration 099 written (yr_call_log accepts the verdicts, yr_wins_s counts Safe, yr_radar_book_s ranking): apply only with the user's OK.
- A QA Pro key (plan 'qa', payer 'qa-test-delete-me', 3 h) was created for testing: delete it (delete from yr_licenses where payer = 'qa-test-delete-me').
- Redesign "the file room" (user wants DARK; a light paper version was rejected): every coin gets a case file. app/paper.css (scoped .pp; Paper shell in components/Nav.tsx with masthead + colophon + the #ink-rough SVG filter), CaseFile.tsx (hero: redaction bars lift, fluorescent stamp lands, sheet slides off the pile), Stamps.tsx (three stamps + rules), Explode restyled (index cards, SAFE stamp), live tools inside .screen. Fonts: Archivo (wdth 125) display, IBM Plex Sans/Mono. Logo: bone disc with a y cut out, tilted -8° (Mark in Nav.tsx, app/icon.svg, extension icons). Extension 3.5.1 (new icons + mark).

## 7 Nov (afternoon) — empty reads, DB under load, suggested wallets, Hot on X, finale
- Empty reads (verdict without holders/bundle): RugCheck's first report for a coin can take >3.5 s and the request was cut at 3.5 s on every poll, so a slow coin never got it. lib/rugcheck.ts: the request runs up to 12 s in the background (rugPending + after()), the read waits 3.5 s max; cache evicts oldest instead of clearing. When RugCheck has nothing, chainRug() builds the same report from the chain (top 20 wallets, top 10, creator share, mint/freeze), src "chain": no linked-wallet claim, no lock claim off the curve.
- DB: since 098 no cron failure, yr_cc_roll 0.3 s avg. Scaling risk was yr_creator_s called uncached on every read (every 1.5-3 s per open panel): creatorRpc cached 10 s; whole read cached 6 s once a coin is 3+ min old. yr_odds_calc (04:20 daily) takes >60 s: acceptable once a day.
- Suggested wallets: migration 100 (written, apply with OK) seeds yr_suggested from the owner's 121-wallet radar list (matched by md5 of the key) and adds 'suggested' to yr_radar_book_s; radar tab "Suggested" with "Add all to my radar" (merges, the list is saved whole) and "Copy for Axiom".
- Hot on X: Safe-only hid every coin without a verdict yet (verdicts are read 6 at a time, fresh coins are unread) → only Risky/Danger hidden, others show "reading". No J7 or empty feed: XFeed from yr_xfeed_s (migration 100: posts on X that coins launched from in the last hour, from yr_xlink) via /api/hot?feed=1 (cached 20 s, shared).
- Design: §3 finale no longer a giant stamp: the 24 cards narrow into the coin's fingerprint (24 bars, green clean / amber to watch) with "Safe" rising above. §4 = three rows SAFE / RISKY / DANGER: word filled from the left, the fingerprint bars rise in order, rule text; hovered row lights, others dim. Hero stamp crisp (no grunge filter).
