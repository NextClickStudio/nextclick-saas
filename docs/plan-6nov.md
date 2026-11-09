# yeppo: build plan from 6 Nov 2026 (the user asked for all of it; build in this order, one step at a time, each
# published only after the user's OK)

Rules that hold: free data only (no Helius, no Birdeye, no paid X API, no paid AI calls), never change what the
current verdict does unless a step says so, every new number must be checkable, honest copy (no promised profits).

## Step 1. Wallet Radar in the panel and on the site (DB already live: migration 093)
- `app/api/radar/route.ts` (edge, dub1, like /api/hot): key + dev → `yr_radar_s` (poll every 10 s while open),
  `yr_radar_book_s` (on open), `yr_radar_set_s` (POST, the import). Cache per key 5 s.
- Panel: a **Radar** tab.
  - Import box: paste Axiom's export JSON as is (array of `{trackedWalletAddress, name, emoji, ...}`) or one address per
    line. Show "121 wallets saved".
  - Live list from `yr_radar_s.coins`: one row per coin, best first: ticker, age, mc now vs mc when the first wallet
    bought ("+38% since your first wallet"), chips of the wallets in (emoji + name), who already sold (struck through),
    yeppo's quick flags. Clicking a row opens the normal yeppo read of that coin.
  - **Early call** (row highlighted) when `signal` is true AND the full read of that coin (call /api/read for the top 3
    signal coins, server side, cached) is 🟢 Safe. Never call Safe from the radar's quick flags alone.
  - Extension: toolbar badge + optional sound when a new early call appears (background.js polls /api/radar every 15 s
    only while the user has a list).
  - "Exit alert" for the radar only: when a wallet that triggered the call sells ≥ 50% of its buy, the row turns amber
    "a lead wallet is out". (This is the user's "exit when the whale exits".)
- **Wallet book** (`yr_radar_book_s`): the user's wallets with yeppo's record (wins / early entries, flips = sold within a
  minute, creators). Flag wallets with many flips as "bot-like, hard to copy". Below: wallets yeppo found on its own
  (`found`), with a one-click **Export for Axiom** that builds the same JSON shape Axiom imports
  (`trackedWalletAddress, name, emoji: "👻", alertsOnToast: true, alertsOnBubble: true, alertsOnFeed: true,
  groups: ["Main"], sound: "default", highlightColor: null`). Downloads are blocked in some frames: offer copy-to-clipboard.

## Step 2. The user's strategy as a checklist (shown on an early call, never auto-trading)
The user's rule: "BUY only if ALL pass". Show each line with ✓ / ✗ / "not read" and the reason:
1. 2+ of your wallets entered within 15 min (radar).
2. Funded by an exchange or by a whale: creator funded from an exchange (`yr_fund.kind = 'exchange'`, `yr_exch` has
   242 addresses); for the entering wallets, read their first funding transfer on demand (same method as yr-fund, from
   Supabase, cached per wallet 24 h). "Fresh wallet funded by a whale" = wallet < 7 days old funded with ≥ 10 SOL by one
   wallet holding ≥ 500 SOL.
3. Mint revoked, freeze revoked, LP burned: pump.fun coins always pass by design (say so: "pump.fun: revoked and burned
   by the launchpad"); for other launchpads read the mint account (getAccountInfo, jsonParsed) from Supabase.
4. Top 10 holders < 30% (RugCheck topHolders, real balances, excluding the curve/pool account).
- Plan card: "Size at most 8% of your wallet · stop at −6% · exit when the lead wallet exits". Text only.
- "Buy on Axiom" deep link (existing `/go/[mint]`). **No Phantom auto-execution**: yeppo never touches a wallet.
- Log every early call (coin, wallets, checklist results, reason) in a small logged table, kept 14 days, for the lab.

## Step 3. New checks in the read (more precise, not a different verdict)
- **Same-amount buys** (multi-wallet): in the first 3 minutes, buys whose SOL amount matches to 3 decimals across 3+
  different wallets, or token amounts within 1% of each other → one cluster; show "4 wallets bought exactly 1.250 SOL
  in 9 s". yr_ticks keeps buys ≥ 0.01 SOL: enough. Count the cluster's share in Big wallets (linked).
- **Spam / fresh holders**: for the top 20 holders, number of signatures in their history (getSignaturesForAddress,
  limit 50, from Supabase, cached 24 h per wallet): < 10 transactions or first transaction < 24 h ago = fresh.
  "6 of the top 20 are fresh wallets holding 14%".
- **Serial launcher**: creator's coins in the last 24 h ≥ 5 → warning (data already in yr_cc).
- **Copied ticker that already ran**: same ticker in the last 7 days with ath ≥ 10× launch → "copies $FIX, which ran".
- **Recycled X account**: the X handle linked by a coin that died in the last 14 days (yr_xlink + yr_cc) → warning.
- Wire them as information + into Risky only where a threshold is agreed with the user. Test each on 50 real coins
  (SQL on yr_cc / yr_ticks) before showing it.

## Step 4. Narratives (what is pumping on X and why), free
- From the user's J7 feed (already in the browser): group tweets of the last hour by words/themes, count coins born
  after each, show the top themes with "coins born after it: 23 · Safe: 4".
- Google News RSS (free, no key) for the top 3 themes to show the headline behind them.
- J7 + Radar: when an important tweet arrives, list coins born after it that your wallets are buying, Safe only.

## Step 5. Redesign (after the user approves the prototype)
- Prototype: https://claude.ai/artifact/TNF5XQvCDfJp14ksgjoeCa. Direction from noiz.bio: near-black, warm off-white
  (hsl 60 7% 95%), no accent colour except the three verdict colours (#9be3b4, #e7b56a, #f08a7e), medium-weight
  grotesk (Hanken Grotesk) + JetBrains Mono for numbers, big counters, short headlines that end with a full stop.
- Motion rule from the user: **no transitions or fades**. One scroll-driven camera over one world: elements leave the
  frame or turn into the next element (the coin card becomes the first radar row, etc.).
- New logo: the radar mark in the prototype (ring + quarter sweep + dot), monochrome.
- Rebuild Home, Pricing, Record, Extension pages and the panel's look with the same tokens. Keep every function.

## Benchmark: rugradar.dev (closed source) lists
17 rug checks; bubble maps with funding networks; rug networks (funder funded crashed coins); dev history across
launchpads with blacklist; X tracker (account age, recycled accounts); narratives from Google Trends / Google News /
news accounts; "popping again" for older coins; insider follow-up 30 min after the check; live rug watch alarms;
Meme Coach (Yes/No/Wait); Telegram/Discord /check bot; caller leaderboard; P&L tracker. yeppo already has the launch
bundle from the chain, real-balance holders, creator history, money trail and X origin; steps 1–4 cover the rest that
matters to the user, all on free data.
