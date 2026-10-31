# yeppo: Chrome Web Store listing

Everything the Chrome Web Store asks for, ready to paste. Upload `public/yeppo-extension.zip` (version 2.4.2).
Developer account: https://chrome.google.com/webstore/devconsole (one-time 5 USD fee).

## Store listing

**Name:** yeppo

**Summary (max 132 characters):**
Is this memecoin safe, and is now the moment? Safety checks, creator history and Momentum or Wait, next to your chart.

**Category:** Productivity (or Tools)

**Language:** English

**Description:**

yeppo reads the Solana memecoin you are looking at on pump.fun, GMGN, Axiom, Photon, BullX, DexScreener, Birdeye or Jupiter, and gives you one word:

• Momentum: buyers are in now.
• Wait: no clear push yet.
• Don't buy: a rug, a coin farm, a dump, or a failed safety check.

Click the badge for the full read:
• Safety checks: top holders, the creator's share, insiders, mint and freeze authority, locked liquidity, the launch bundle.
• The creator's other coins, drawn over this one: which ones they dumped in seconds, which ones ran.
• Outlook on 4 timeframes and the money trail behind the creator.
• Live: on pump.fun coins the call updates with every trade, straight from the chain.
• Meme waves: a notification when a meme starts trending on pump.fun, with the coin leading it.

yeppo works with a Pro key, paid in SOL on yeppo.it/pricing (no account, no card). Paste it once in the extension, or it turns on by itself after paying.

yeppo only reads the coin address on the page. It never sees your wallet, your keys or your passwords, and it cannot trade.

Not financial advice. Most memecoins go to zero. Only trade what you can lose.

**Screenshots (1280x800 or 640x400, 1 to 5):**
1. The badge on a pump.fun coin page saying Momentum.
2. The card open: the call, the safety checks, the creator's coins chart.
3. A Don't buy on a rugged coin.
4. The side panel next to GMGN.
5. The live call flipping to Momentum as buyers pile in.

**Small promo tile (440x280):** the yeppo mark on the dark background, with "trade the move. skip the rug."

**Website:** https://yeppo.it
**Support:** info@yeppo.it

## Privacy practices

**Single purpose:**
Show a safety and timing read of the Solana memecoin open on the current trading site.

**Permission justifications:**
- `sidePanel`: shows yeppo's read in Chrome's side panel next to the trading site.
- `notifications` and `alarms`: every 2 minutes, checks yeppo.it for a new meme wave and shows one notification (it can be turned off in the side panel).
- `storage`: remembers the user's settings (badge on or off, badge position), their Pro key and a random device id (a key works on 3 devices), on their own device.
- Host permissions (content scripts on pump.fun, gmgn.ai, axiom.trade, photon-sol.tinyastro.io, bullx.io, dexscreener.com, birdeye.so, solscan.io, jup.ag): read the coin address in the page's URL or links, to show the badge. Nothing else on the page is read.
- Content script on yeppo.it: receives the Pro key the user gets on yeppo.it, so they don't have to paste it.

**Remote code:** No. All code is in the package; the card shows yeppo.it in a frame.

**Data usage (tick only what applies):**
- Website content: the coin address on the current page is sent to yeppo.it to get its read, and the card follows that coin's trades on the public Solana network. Nothing else.
- No personally identifiable information, health, financial or authentication information, personal communications, location or web history is collected.
- Certify: not sold to third parties; not used for purposes unrelated to the single purpose; not used for creditworthiness or lending.

**Privacy policy URL:** https://yeppo.it/privacy
