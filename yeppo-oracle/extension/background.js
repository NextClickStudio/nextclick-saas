// yeppo: remembers which coin each tab shows for the side panel (the toolbar button opens it), and puts the open
// panel's call colour on the toolbar button. It reads nothing itself: only the open panel asks yeppo.it.
const SITE = "https://yeppo.it";
const TONE = { up: "#9be3b4", mid: "#e7b56a", down: "#f08a7e", learn: "#a9b4c2" };
const MARK = { up: "GO", mid: "WAIT", down: "NO", learn: "" };
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  void injectOpenTabs();
});
// tabs opened before the extension was installed or updated have no content script until they reload: give them one
async function injectOpenTabs() {
  const matches = chrome.runtime.getManifest().content_scripts?.[0]?.matches ?? [];
  for (const tab of await chrome.tabs.query({ url: matches }).catch(() => []))
    if (tab.id != null) chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
}
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));

const coinOf = new Map(); // pool or coin address -> coin
const QUOTE = ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"];
const RPC = "https://api.mainnet-beta.solana.com"; // Solana's free public endpoint
async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(6000) });
  return (await r.json())?.result ?? null;
}
/** the chain itself: is the address a coin, or which coin do its latest transactions trade? (for pools DexScreener
 *  doesn't list yet, like a pump.fun coin minutes old) */
async function coinFromChain(addr) {
  const acc = await rpc("getAccountInfo", [addr, { encoding: "jsonParsed" }]);
  if (acc?.value?.data?.parsed?.type === "mint") return addr;
  const sigs = (await rpc("getSignaturesForAddress", [addr, { limit: 3 }])) ?? [];
  for (const s of sigs) {
    const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    const seen = new Map();
    for (const b of tx?.meta?.postTokenBalances ?? []) if (b?.mint && !QUOTE.includes(b.mint)) seen.set(b.mint, (seen.get(b.mint) ?? 0) + 1);
    const best = [...seen].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (best) return best;
  }
  return null;
}
async function fromDex(addr) {
  // the coin itself?
  const t = await (await fetch(`https://api.dexscreener.com/tokens/v1/solana/${addr}`, { signal: AbortSignal.timeout(5000) })).json();
  if (Array.isArray(t) && t.some((p) => p?.baseToken?.address === addr)) return addr;
  // a pool: its coin is the side that isn't SOL or a stablecoin
  const j = await (await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${addr}`, { signal: AbortSignal.timeout(5000) })).json();
  const p = j?.pairs?.[0] ?? j?.pair;
  if (p?.baseToken?.address) return QUOTE.includes(p.baseToken.address) ? (p.quoteToken?.address ?? null) : p.baseToken.address;
  return null;
}
async function resolveAddr(addr) {
  if (coinOf.has(addr)) return coinOf.get(addr);
  let mint = await fromDex(addr).catch(() => null);
  // a brand-new pump.fun coin DexScreener doesn't list yet: its address ends in "pump"
  if (!mint && /pump$/.test(addr)) mint = addr;
  if (!mint) mint = await coinFromChain(addr).catch(() => null);
  if (!mint) return null; // not kept: tried again on the next look
  if (coinOf.size > 500) coinOf.clear();
  coinOf.set(addr, mint);
  return mint;
}

function badge(tabId, data) {
  const d = data?.decision;
  chrome.action.setBadgeText({ tabId, text: d ? (d.word === "Locked" ? "KEY" : MARK[d.tone] ?? "") : "" }).catch(() => {});
  if (d) chrome.action.setBadgeBackgroundColor({ tabId, color: TONE[d.tone] ?? TONE.learn }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id;
  if (msg.t === "coin" && tabId != null) {
    chrome.storage.session.set({ [`tab:${tabId}`]: msg.mint ? { mint: msg.mint, host: new URL(sender.url).hostname } : null });
    if (!msg.mint) badge(tabId, null);
    return false;
  }
  // the open side panel's call, live: its colour on the toolbar button (no read of its own)
  if (msg.t === "live" && typeof msg.tab === "number" && typeof msg.mint === "string" && msg.d && typeof msg.d.word === "string") {
    const d = { word: String(msg.d.word).slice(0, 20), tone: ["up", "mid", "down", "learn"].includes(msg.d.tone) ? msg.d.tone : "learn" };
    badge(msg.tab, { decision: d });
    return false;
  }
  // a pool page's address (Axiom, Photon, DexScreener): which coin it is, from DexScreener (free, public)
  if (msg.t === "resolve" && typeof msg.addr === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(msg.addr)) {
    resolveAddr(msg.addr).then((mint) => reply({ mint }));
    return true;
  }
  // the radar's "Connect J7": read J7's session cookie now; when the viewer isn't logged in to J7, open it
  if (msg.t === "j7connect") {
    chrome.storage.local.set({ j7auto: true }, () =>
      grabJ7().then((ok) => {
        if (!ok) chrome.tabs.create({ url: "https://j7tracker.io/" });
        reply({ ok });
      }),
    );
    return true;
  }
  if (msg.t === "j7off") {
    chrome.storage.local.set({ j7auto: false, j7: null });
    return false;
  }
  if (msg.t === "j7grab") {
    void grabJ7();
    return false;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`));


// ---- J7Tracker -------------------------------------------------------------------------------------------------------
// Once the viewer pressed "Connect J7" in yeppo's radar: J7's session token, read from J7's own cookie on j7tracker.io
// (the one J7's app logs in to its feed with), kept in this browser's extension storage and handed to the radar.
// Read again whenever J7 renews it. Never sent to yeppo's servers.
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
function expOf(t) {
  try {
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p.exp === "number" ? p.exp * 1000 : Infinity;
  } catch {
    return 0;
  }
}
async function grabJ7() {
  const st = await chrome.storage.local.get(["j7auto", "j7"]);
  if (!st.j7auto) return false;
  let best = null;
  let bestExp = Date.now();
  for (const c of await chrome.cookies.getAll({ domain: "j7tracker.io" }).catch(() => [])) {
    let v = c.value;
    try {
      v = decodeURIComponent(v);
    } catch {
      /* not encoded */
    }
    const m = v.match(JWT);
    if (!m) continue;
    const exp = expOf(m[0]);
    if (exp > bestExp) [best, bestExp] = [m[0], exp];
  }
  if (best && best !== st.j7) await chrome.storage.local.set({ j7: best, j7at: Date.now() });
  return !!best;
}
chrome.cookies.onChanged.addListener((ch) => {
  if (!ch.removed && /(^|\.)j7tracker\.io$/.test(ch.cookie.domain.replace(/^\./, ""))) void grabJ7();
});
chrome.runtime.onStartup.addListener(() => void grabJ7());
