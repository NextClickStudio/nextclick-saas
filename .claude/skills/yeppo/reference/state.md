# yeppo: current state (truth as of 6 Nov 2026; edit lines here when facts change)

## What it is
Scanner for **pump.fun** memecoins (Solana): Chrome extension (side panel, v3.3.1) + site **yeppo.it**. You open a coin
(pump.fun, Axiom, GMGN, Photon, BullX, DexScreener…) and in ~1 s yeppo says whether it is safe. Site text in English,
replies to the user in Italian.

## The verdict (since 4 Nov ~18:00; overrides older notes about Momentum/Wait/Exit)
- Only **🟢 Safe / 🟡 Risky / 🔴 Danger** (+ "Too early · Checking…", "Locked" without a key). yeppo says whether a coin
  is safe, **not when to get in**.
- In `/api/read`, after `steady()`: `safe = decide(... pulse: null, ageS: 1e6)` → Don't buy = **Danger**;
  `holderBlock(risk)` = **Risky**; otherwise **Safe** ("Nothing wrong found: insiders X%, creator…, N/N checks safe").
- The panel uses `d = r.decision` (no more `liveCall` / `liveDump`). **No Exit alert** (exit = null).
- **No Safe before holders + launch are read** ("Too early · Checking…").
- **Big wallets** (`risk.big`): RugCheck top holders ≥3% that aren't the creator or the launch bundle, plus RugCheck's
  "linked"/bubble wallets (one hand split across many wallets): their own slice in the holders bar, counted in insiders.
- Holders bar: creator · launch bundle · snipers · big wallets · everyone else, on **real balances** (RugCheck
  topHolders). Insiders < 20% = safe zone.
- Thresholds (`lib/decide.ts`): insiders ≥0.20 Risky-side / ≥0.35 Danger; hidden bundle ≥0.20 / ≥0.40; snipers only
  inside insiders, Danger ≥0.25; launch bundle check fails ≥0.20 → Danger. Top holders selling: ≥1% of supply and ≥40%
  of their position (several together ≥3%). Farm creator = information only.
- Snipers (090, `yr_risk`) = buyers of the first 15 s + the silent early group (first 30 s, single buy, never sold,
  price ×2 since).
- Launch bundle = wallets of the first 2 blocks, read from the chain by our free reader (`yr-launch` on Supabase,
  `lib/launch.ts`), usually pre-read, else 1–3 s. Panel: "⏳ Checking" with a countdown that only goes down, then
  "✓ Verified" that stays fixed per coin; after 3 failures "unverified".
- Panel opens only with the complete read (`ready`: holders, creator, launch, x) or after 10 s.
- Stable call (`steady()`): Danger shows at once; other changes only if they hold 4 s of reads.
- Other boxes: Creator (past coins, rugs, farms, money trail), X origin (post/account the coin was born from, author
  scorecard), "Is it THE coin?" (TheCoinCard), Odds (`yr_odds`), Top traders / KOL, Hot on X (user's J7 feed), Record.

## Open requests (4 Nov ~18:15, in this order)
1. ✅ Published: no Safe before holders + launch; linked/bubble wallets count as Big wallets. **Still to verify on real
   data that the verdict no longer flips** after the first seconds (user: "can't say Safe then Risky 5 s later").
2. **"The coin" section** (`TheCoinCard` in CoinPanel): the "main coin" (leader/ORIG) is often wrong, the X link is
   useless (they see it on Axiom). Propose something really useful or remove it (idea: remove, or reduce to "N copies
   of this name, X rugged").
3. **Hot on X with J7 "does nothing"**: highlight the important tweets and **filter just-born SAFE coins** (born after
   the post, Safe verdict).
4. **yeppo lab**: automatic reads of coins with mc ≥ $18K and activity, save verdict + reason, measure how many Safe
   coins do at least ×2 from the verdict and how many Danger coins dump; calibrate thresholds; then redo the Record on
   Safe/Risky/Danger. `yr_call_log` only accepts the old words → **a new migration (094+)**. The Record still logs the old timing
   call (`timing.word`).
- The user said they will give "the real changes to finalise yeppo": wait for them.

## Payments and keys
- Checkout in SOL (edge `yr-pay` v5), plans in `yr_config.pay_plans`: **Pro 30 d = 0.2 SOL, Pro 90 d = 0.5 SOL**,
  `pay_open = true`, `paywall = true`. Matched by Solana Pay reference or exact amount; signature unique.
- Renewal only via the key sent with the order (`yr_orders.renew`), never via the paying wallet.
- Key `YEP-XXXXX-XXXXX-XXXXX-XXXXX`, 3 devices (`yr_key_dev`), 1 Discord account (`yr_discord`). Owner key: plan
  `owner`, never write it down. Known gap: key travels in `?key=` (Vercel logs); a header would be better.

## Record (/record)
- Calls on coins ≤2 h old, once per word (`yr_call_log` → `yr_calls`, 14 d); `yr_record_calc` hourly.
- Buy calls judged only on ×2/×3; "fell 50%" only on Don't buy ("rugs dodged"). Striking but honest numbers.
- 4 Nov (7 d): Momentum 7 (2 ×2), Opportunity 3 (1 ×2), Wait 42, Don't buy 109 (56 fell 50%). Needs redoing on the new
  verdicts (request 4).

## Discord (done 4 Nov)
- Server **Yeppo** (guild 1015622182438699070, ~3,800 members), bot **Yeppo** (app 1505933699911385098), no process of
  its own: Interactions Endpoint `https://yeppo.it/api/discord`. Buttons ✅ Verify (Member role + DM) and 💎 Unlock Pro
  (key modal → Pro role). Daily sweep removes Pro from expired keys. Channel/role ids in `discord/new.json`.
- **Bot token was pasted in chat → remind the user to regenerate it**, then update Vercel env `DISCORD_BOT_TOKEN` (with OK).
- Not yet tried by a real user: Verify / Unlock Pro / DMs.
- Invite `https://discord.gg/B2cvVw4nSD`, Instagram `https://instagram.com/getyeppo`.

## Limits
- Vercel Hobby: ~1M requests/month (~30 users × 1 h/day), **no commercial use → Vercel Pro (~$20) before selling**.
- Supabase Free: 500 MB (≈208 MB used on 6 Nov, plateau ~320 MB, depends on pump.fun not users), **5 GB egress/month**
  (grows with users), 500k edge invocations (~150k used).
- Public Solana node turns Vercel away: chain reads only from Supabase.
- **6 Nov outage**: the free disk ran out of write budget (~12:00 UTC), DB refused connections; fixed by a restart +
  092 (yr_cc_roll every 60 s). Logged tables cost disk IO (yr_cc above all); yr_ticks/yr_cb/yr_bw/yr_obirth are
  UNLOGGED and cheap. Before adding any cron, check what it writes to logged tables. User checks Reports → Disk IO.

## Choices that hold (don't undo)
- Radar, meme waves, trends, learn removed from the nav; site black and minimal, no animated background.
- Insiders on real balances; farm creator is information only.
- 072: UNLOGGED tables, synchronous_commit off (DB crashed at night before). If PostgREST hangs: Dashboard → Settings
  → General → Restart project.
- APU case (−65% in 23 s, insiders 9%) = cascade profit-taking: user decided not to build anything for it.
- "Launch rush" Wait removed; "Live dump" alert: user said no for now.
- Git: local commits on the Mac not pushed (no `gh`); push only if the user sets it up
  (`brew install gh && gh auth login`, then `git push origin yeppo-royale:claude/yeppo-royale`).

## Wallet Radar (6 Nov, DB done in 093, panel/site NOT built yet)
- `yr_radar_list(key, who, name, emoji)`: the user's own wallets, imported from Axiom JSON (`trackedWalletAddress`,
  `name`, `emoji`) or a plain list; 500 max per key. RPCs (guarded + `yr_access` via `yr_radar_key`):
  `yr_radar_set_s(p_key, p_dev, p_list jsonb)`, `yr_radar_s(p_key, p_dev)` (coins the user's wallets and yeppo's proven
  wallets bought in the last 15 min: own/proven counts, who sold, `signal` = 2+ own wallets within 15 min and none
  out, flags rug/bundle/dev_holds/dev_out_s/grad/dev_cex, wallets[]), `yr_radar_book_s(p_key, p_dev)` (the user's
  wallets with their record from yr_sm3, and up to 200 proven wallets not on the list, for the Axiom export).
- `yr_sm_roll` is back on cron `yr-sm` every 2 min (stopped since 2 Nov): learns early winners into `yr_sm3`
  (`yr_sm_proven`: 3+ wins, 8+ tries, 12%+ hit, flips ≤ 1/3, 3+ creators). 41 proven on 6 Nov.
- The user's list (121 wallets) is in their Axiom export; they import it themselves in the panel once built.
- Spec for the panel, the new checks and the design: `docs/plan-6nov.md`. Design prototype (approved direction to
  confirm): https://claude.ai/artifact/TNF5XQvCDfJp14ksgjoeCa


## Home (9 Nov 2026)
- Live: the lighthouse film (commit 895dbda, components/film/Lighthouse.tsx, frames in public/film2). Branch head: the moon WIP (components/moon/Moon.tsx), not deployed. Full brief for continuing: HANDOFF.md in the export zip.
