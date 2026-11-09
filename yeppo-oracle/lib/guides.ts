// yeppo.it/learn: plain guides to the questions memecoin traders search for, each answered with what yeppo checks and,
// where yeppo has measured it, the numbers from its own capture of every pump.fun launch. Facts, no promises.

export type Block = { h?: string; p?: string[]; list?: string[] };
export type Guide = {
  slug: string;
  title: string;
  /** the search the page answers, for the title tag */
  seo: string;
  description: string;
  keywords: string[];
  updated: string;
  intro: string;
  body: Block[];
  faq: [string, string][];
};

export const GUIDES: Guide[] = [
  {
    slug: "pump-fun-rug-checker",
    title: "How to check if a pump.fun coin is a rug",
    seo: "Pump.fun rug checker: check any Solana memecoin in seconds",
    description:
      "The checks that catch most pump.fun rugs: top holders, the creator's share and past coins, the launch bundle, mint and freeze authority. How to run them in one second.",
    keywords: ["pump.fun rug checker", "rug check solana", "is this memecoin a rug", "solana rug checker", "pump.fun scam check", "rugcheck"],
    updated: "31 October 2026",
    intro:
      "Most pump.fun coins go to zero, and a large share of them were never meant to do anything else. A rug leaves marks before it happens: who holds the supply, who launched it, and what that wallet did with its last coins. Here is what to look at, in the order that matters.",
    body: [
      {
        h: "1. Who holds the supply",
        p: [
          "Open the holders list and ignore the bonding curve and the pool: those are not people. If the top 10 wallets hold more than about 30% between them, a handful of people can crash the price whenever they want.",
          "Look for the creator in that list too. A creator still holding a big bag can sell it into your buy.",
        ],
      },
      {
        h: "2. The launch bundle",
        p: [
          "A bundle is a group of wallets that buy in the first seconds, often in the same block as the launch, usually controlled by the creator. They look like early buyers; they are one seller waiting.",
          "In yeppo's data from the last two days, coins whose launch bundle held 10% or more fell another 40% in the next ten minutes 12 to 24% of the time, against 3% for coins without one.",
        ],
      },
      {
        h: "3. The creator's past coins",
        p: [
          "The best single predictor is what the same wallet did before. A creator who launched coins that all faded, or who launches dozens a day, is running a farm.",
          "yeppo measured it: coins from creators whose earlier coins never ran doubled after minute ten 0.4% of the time; a creator's first coin did it 2.2% of the time, five times more often. Creators who change wallet for every coin are linked through the wallet that funded them.",
        ],
      },
      {
        h: "4. Contract switches",
        list: [
          "Mint authority: if it is still on, more coins can be printed and your share diluted.",
          "Freeze authority: if it is on, your coins can be frozen so you cannot sell.",
          "Liquidity: after graduation, liquidity that is not burned or locked can be pulled.",
        ],
      },
      {
        h: "Do it in one second",
        p: [
          "yeppo runs all of these the moment you open a coin on pump.fun, GMGN, Axiom, Photon, BullX or DexScreener, and sums them up in one word: Momentum, Wait or Don't buy. A clean check does not make a coin go up; it removes the coins that were built to go down.",
        ],
      },
    ],
    faq: [
      ["Can a coin that passes every check still rug?", "Yes. Checks catch the common setups (big holders, bundles, farming creators, open authorities), not every possible trick. Treat a clean result as 'no known red flag', not as safe."],
      ["Is RugCheck enough?", "RugCheck covers holders and contract switches well. It does not tell you what the creator did with their last coins or whether the launch was bundled; yeppo adds both from its own record of every pump.fun launch."],
      ["Does checking a coin need my wallet?", "No. yeppo only reads the coin address on the page. It never sees your wallet or keys and cannot trade."],
    ],
  },
  {
    slug: "solana-memecoin-scanner",
    title: "A Solana memecoin scanner that skips the traps",
    seo: "Solana memecoin scanner: new pump.fun coins worth a look",
    description:
      "How yeppo's scanner finds new Solana memecoins: memes launching far more than usual, the original coin of each wave, and new coins proven wallets are buying, after its safety filters.",
    keywords: ["solana memecoin scanner", "pump.fun scanner", "new memecoins solana", "memecoin finder", "trending memecoins", "pump.fun new coins"],
    updated: "31 October 2026",
    intro:
      "Thousands of coins launch on pump.fun every day. A scanner is only useful if it throws most of them away. yeppo's scanner looks for two things, and filters both through the same checks as a full read.",
    body: [
      {
        h: "Meme waves",
        p: [
          "When a meme catches, dozens of coins with the same name launch within minutes. yeppo splits every launch name into words and flags a word launched far more often in the last 30 minutes than in the last day.",
          "Inside a wave it shows the original, the coin with the most trading, and marks later copies with the same ticker. Copies rarely hold.",
        ],
      },
      {
        h: "Smart money",
        p: [
          "yeppo learns from its own data which wallets keep getting into coins early and then sell at a profit. A wallet counts only after 3 or more real wins across 3 or more different creators, with a hit rate of 12% or better.",
          "Sniper bots that sell within seconds, and bots that buy tiny amounts and never sell, are excluded: in yeppo's tests, following them by hand lost money.",
        ],
      },
      {
        h: "What gets thrown away",
        list: [
          "Coins from creators whose earlier coins all faded, including wallets funded by the same money.",
          "A launch bundle of 10% or more, or a creator still holding 5% or more.",
          "Buying from one wallet, or a few wallets trading back and forth (fake volume).",
          "Coins already more than half down from their high.",
        ],
      },
    ],
    faq: [
      ["Does the scanner pick winners?", "No tool does. It narrows thousands of launches to a few that passed the checks and show real buying right now. Most of those still fail."],
      ["How often does it update?", "Every minute on yeppo.it/trends, with an optional Chrome notification from the extension."],
    ],
  },
  {
    slug: "memecoin-bundle-checker",
    title: "What is a bundle on pump.fun, and how to spot one",
    seo: "Pump.fun bundle checker: spot bundled memecoin launches",
    description:
      "A bundle is a set of wallets that buy a new coin in its first seconds, usually for the creator. How to recognise one, why it matters, and what yeppo's data says about bundled launches.",
    keywords: ["pump.fun bundle checker", "bundled launch", "memecoin bundle", "solana bundle checker", "bundle snipers pump.fun"],
    updated: "31 October 2026",
    intro:
      "On pump.fun a creator can launch a coin and buy it from many wallets in the same instant. To everyone else those wallets look like eager early buyers. They are usually one person holding a large share of the supply, waiting for you.",
    body: [
      {
        h: "How a bundle looks on-chain",
        list: [
          "Several wallets buy in the first 3 seconds, often in the same block as the creation.",
          "Similar amounts, fresh wallets, sometimes funded from the same source minutes earlier.",
          "They keep holding together, then sell together.",
        ],
      },
      {
        h: "Why it matters",
        p: [
          "In yeppo's data, coins with a launch bundle of 10% or more dumped 40% within ten minutes far more often (12 to 24% of the time) than coins without one (3%). Big bundles also push the price up fast at first, which is why they look attractive.",
        ],
      },
      {
        h: "How yeppo shows it",
        p: [
          "Every read shows what the launch bundle still holds, what the snipers of the first 15 seconds still hold, and the biggest single wallet. When they hold enough to crash a push, yeppo never says Momentum.",
        ],
      },
    ],
    faq: [
      ["Is every early buyer a bundle?", "No. Snipers and fast traders buy in the first seconds too. A bundle is a group that acts as one: same moment, similar size, holding and selling together."],
      ["The bundle sold already. Is the coin safe now?", "Safer on that one point: the bag that could dump at once is gone. The other checks still apply."],
    ],
  },
  {
    slug: "dev-wallet-checker",
    title: "Check a memecoin creator before you buy",
    seo: "Dev wallet checker: a memecoin creator's past coins and money",
    description:
      "What a creator did with their last coins is the best warning you get. How to read a dev wallet: past launches, how fast they sold, who funded them.",
    keywords: ["dev wallet checker", "memecoin dev check", "pump.fun dev history", "creator wallet solana", "serial rugger"],
    updated: "31 October 2026",
    intro:
      "Most rugs are reruns. The same people launch coin after coin, sell into the first buyers, and start again, sometimes with a new wallet each time. Their history is public; it just takes too long to dig up by hand.",
    body: [
      {
        h: "What to look for",
        list: [
          "How many coins the wallet launched recently. Dozens a day means a farm.",
          "What happened to them: ran, faded, dumped within seconds, or graduated.",
          "When the creator usually sells: at launch, after a first pump, or never.",
          "Where the wallet's first SOL came from, and what other creators that same funder paid.",
        ],
      },
      {
        h: "What the data says",
        p: [
          "Across two days of pump.fun launches, a creator's first coin was about twice as likely to reach five times its launch price as a coin from a repeat creator. Repeat creators whose earlier coins never ran were the worst of all.",
        ],
      },
      {
        h: "In yeppo",
        p: [
          "Every read draws the creator's earlier coins over this one, lists how each ended and how fast the creator sold, and traces the money behind the wallet: the funder, the other creators it paid, and early buyers tied to past rugs.",
        ],
      },
    ],
    faq: [
      ["The creator is new. Is that good?", "It is the best starting point in the data, but a fresh wallet can also be an old rugger. yeppo checks who funded it to link them."],
      ["The creator sold everything. Should I sell?", "Not by itself. Many coins run after the creator leaves; some dump. It removes one seller and one source of information."],
    ],
  },
  {
    slug: "bubble-map-memecoin",
    title: "Bubble maps for memecoins: wallets that move together",
    seo: "Memecoin bubble map: find wallets that bought together",
    description:
      "A bubble map shows clusters of linked wallets. What clusters mean for a memecoin, how yeppo finds wallets that bought together for free, and when to worry.",
    keywords: ["bubble map memecoin", "bubblemaps solana", "linked wallets memecoin", "insider wallets", "cluster wallets pump.fun"],
    updated: "31 October 2026",
    intro:
      "Top holders lists lie by omission: twenty wallets with 1% each look healthy, unless they are one person. A bubble map draws wallets as bubbles and links the ones that are connected, so clusters stand out.",
    body: [
      {
        h: "Two ways wallets are linked",
        list: [
          "Money: they were funded by the same wallet, or send to each other.",
          "Behaviour: they bought in the same moment, for the same amount, and sell together.",
        ],
      },
      {
        h: "What yeppo shows",
        p: [
          "The Safety box shows the launch bundle, the snipers of the first 15 seconds and what they still hold, the biggest single wallet, and RugCheck's insider networks, linked through funding.",
          "When snipers hold 10% of the supply or more, or one wallet holds 8% or more, yeppo holds Momentum back. At 20% for snipers, or 15% for one wallet, it says Don't buy.",
        ],
      },
    ],
    faq: [
      ["Do clusters always mean a scam?", "No. Trading bots and groups that follow the same caller also buy together. It means the supply is less spread out than the holders list suggests."],
      ["Is it a full bubble map?", "No. It is the part that matters most for a fresh coin, computed from yeppo's own trade data at no cost. A full funding graph needs paid tools."],
    ],
  },
  {
    slug: "when-to-buy-memecoin",
    title: "When to buy a memecoin: momentum, and when it lies",
    seo: "When to buy a memecoin: momentum vs. the launch rush",
    description:
      "Momentum works until it doesn't. What yeppo's data shows about buying in the first two minutes, after a +50% candle, when the creator sells, or into a bundled launch.",
    keywords: ["when to buy memecoin", "memecoin momentum", "pump.fun trading strategy", "memecoin entry", "buy memecoin timing"],
    updated: "31 October 2026",
    intro:
      "The urge is to buy the coin that is moving. Sometimes that is right. yeppo tested its own Momentum call against what coins did next, and found four situations where buying the move loses far more often than it wins.",
    body: [
      {
        h: "The four traps",
        list: [
          "The launch rush: the first two minutes, when snipers and bundles set the price.",
          "A single candle of +50% or more in one minute: it usually gives most of it back.",
          "The creator has sold within the last hour.",
          "A launch bundle of 15% or more still in play.",
        ],
      },
      {
        h: "What yeppo does",
        p: [
          "In these cases yeppo says Wait instead of Momentum, with the reason, even while the price is climbing. Outside them, Momentum means buyers are coming in now: more trades than a minute ago, mostly buys, from many different wallets.",
          "Among coins rising at minute ten, those whose creator had already left dumped 40% in the next ten minutes 44% of the time, against 29% when the creator was still in.",
        ],
      },
      {
        h: "Volatility",
        p: [
          "The same move means different things on different coins. The Outlook box shows the coin's moves over several timeframes, so you can size a trade to the coin.",
        ],
      },
    ],
    faq: [
      ["Does Momentum mean it will go up?", "No. It means buyers are coming in now and none of the known traps apply. The next minute can still go either way."],
      ["Why did yeppo say Wait while the coin pumped?", "One of the four traps applied. Some of those coins keep going; on average they did not."],
    ],
  },
  {
    slug: "gmgn-axiom-pump-fun-extension",
    title: "A safety check right on GMGN, Axiom and pump.fun",
    seo: "Memecoin safety extension for GMGN, Axiom and pump.fun",
    description:
      "yeppo's Chrome extension puts a one-word read on every coin you open on pump.fun, GMGN, Axiom, Photon, BullX and DexScreener, with the full checks one click away.",
    keywords: ["gmgn extension", "axiom extension", "pump.fun extension", "memecoin chrome extension", "solana trading extension"],
    updated: "31 October 2026",
    intro:
      "Switching tabs to run checks costs the seconds that matter. yeppo's extension reads the coin you are looking at and puts the answer on the page.",
    body: [
      {
        h: "What you get",
        list: [
          "A badge on the page: Momentum, Wait or Don't buy, updated live while the coin trades.",
          "One click for the full read: safety checks, snipers and big holders, the creator's past coins, the money trail and the outlook.",
          "A side panel that follows the coin in your active tab.",
          "Scanner alerts: a Chrome notification when proven wallets pile into a new coin.",
        ],
      },
      {
        h: "Safe by design",
        p: [
          "The extension only reads the coin address on the page. It never sees your wallet, your keys or your passwords, and it cannot trade. It works in Chrome, Brave, Edge and Arc.",
        ],
      },
    ],
    faq: [
      ["Which sites does it work on?", "pump.fun, GMGN, Axiom, Photon, BullX, DexScreener, Birdeye, Solscan and Jupiter."],
      ["Do I need an account?", "No. A Pro key, paid in SOL, turns it on. No email, no card."],
    ],
  },
];

export const guide = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
