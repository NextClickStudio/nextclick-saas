// The side panel: yeppo's read of the coin in the tab in front (or none).
const SITE = "https://yeppo.it";
const view = document.getElementById("view");
const where = document.getElementById("where");
document.getElementById("ver").textContent = `v${chrome.runtime.getManifest().version}`;
let active = null;
let saved = {};
chrome.storage.local.get(["key", "dev"], (r) => {
  // one device id for the whole extension, so one browser counts as one device
  if (!r.dev) chrome.storage.local.set({ dev: (r.dev = crypto.randomUUID()) });
  saved = r;
  void follow();
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  let again = false;
  for (const k of ["key", "dev"])
    if (ch[k] && ch[k].newValue !== saved[k]) {
      saved[k] = ch[k].newValue;
      again = true;
    }
  if (again) view.src = viewUrl(shown);
});

/** the view's address: the coin, plus the Pro key the extension keeps */
function viewUrl(mint) {
  const q = new URLSearchParams();
  if (mint) q.set("mint", mint);
  if (saved.key) q.set("key", saved.key);
  if (saved.dev) q.set("dev", saved.dev);
  return `${SITE}/panel?${q}`;
}

// the view unlocked Pro: keep the key for every frame
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.origin !== SITE) return;
  const d = e.data;
  if (d?.yeppo === "key" && typeof d.key === "string" && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(d.key)) chrome.storage.local.set({ key: d.key });
  // the radar's "Connect J7": the extension reads J7's session (and opens J7 when the viewer isn't logged in)
  if (d?.yeppo === "j7-auto") chrome.runtime.sendMessage({ t: "j7connect" }).catch(() => {});
  if (d?.yeppo === "j7-off") chrome.runtime.sendMessage({ t: "j7off" }).catch(() => {});
  if (d?.yeppo === "j7?") sendJ7();
  // the live call of the coin in the tab in front: its colour on the toolbar button
  if (d?.yeppo === "call" && d.mint === shown && active != null)
    chrome.runtime.sendMessage({ t: "live", tab: active, mint: d.mint, d: { word: d.word, tone: d.tone, why: d.why } }).catch(() => {});
});

let shown = undefined;
function render(coin) {
  const mint = coin?.mint ?? null;
  where.textContent = mint ? (coin?.host ?? "").replace(/^www\./, "") : coin?.host ? `${coin.host.replace(/^www\./, "")} · open a coin` : "no coin open";
  if (mint === shown) return;
  shown = mint;
  view.src = viewUrl(mint);
}
// The coin straight from the tab's address, so the panel works even where the page's script never ran (a tab opened
// before the extension was installed or updated). Sites that put the coin in the URL answer at once; pool pages
// (Axiom /meme/, Photon, DexScreener) are resolved through DexScreener by the background worker.
const ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const QUOTES = new Set(["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);
function is32(s) {
  if (QUOTES.has(s)) return false;
  const bytes = [0];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) return false;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.push(0);
  }
  return bytes.length === 32;
}
const first = (s) => (s || "").match(ADDR)?.find(is32) ?? null;
/** { mint } when the address names the coin, { pool } when it names a pool, null otherwise */
function fromTabUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const h = u.hostname.replace(/^www\./, ""), p = u.pathname, q = u.searchParams;
  const mint = (m) => (m ? { mint: m } : null);
  if (h.endsWith("pump.fun")) return mint(first(p.match(/^\/(?:coin\/)?([^/?#]+)/)?.[1]));
  if (h.endsWith("gmgn.ai")) return mint(first(p.match(/\/token\/(?:[^/_]+_)?([^/?#]+)/)?.[1]));
  if (h.endsWith("axiom.trade")) {
    // /meme/, /token/ and /t/ can all carry either the coin or its pool: the background worker checks which
    const a = first(p.match(/^\/(?:meme|token|t)\/([^/?#]+)/)?.[1]);
    return a ? { pool: a } : null;
  }
  if (h.endsWith("bullx.io")) return mint(first(q.get("address")));
  if (h === "birdeye.so" || h === "solscan.io") return mint(first(p.match(/\/token\/([^/?#]+)/)?.[1]));
  if (h === "jup.ag") return mint(first(p));
  if (h === "dexscreener.com" || h === "photon-sol.tinyastro.io") {
    const a = first(p);
    return a ? { pool: a } : null;
  }
  return null;
}
const pools = new Map();
function resolvePool(addr) {
  if (pools.has(addr)) return Promise.resolve(pools.get(addr));
  return new Promise((ok) =>
    chrome.runtime.sendMessage({ t: "resolve", addr }, (r) => {
      const m = !chrome.runtime.lastError && typeof r?.mint === "string" && is32(r.mint) ? r.mint : null;
      if (m) pools.set(addr, m);
      ok(m);
    }),
  );
}

let seq = 0;
async function follow() {
  const n = ++seq;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  active = tab?.id ?? null;
  const key = `tab:${active}`;
  const fromScript = active == null ? null : ((await chrome.storage.session.get(key))[key] ?? null);
  const host = tab?.url ? (() => { try { return new URL(tab.url).hostname; } catch { return ""; } })() : "";
  const fromUrl = tab?.url ? fromTabUrl(tab.url) : null;
  if (fromUrl?.mint) return n === seq && render({ mint: fromUrl.mint, host });
  if (fromUrl?.pool) {
    // until DexScreener answers, what the page's script found (if anything)
    if (fromScript?.mint) render(fromScript);
    const m = await resolvePool(fromUrl.pool);
    if (n !== seq) return;
    // a brand-new pump.fun coin DexScreener doesn't list yet: its own address ends in "pump"
    return render(m ? { mint: m, host } : fromScript ?? (/pump$/.test(fromUrl.pool) ? { mint: fromUrl.pool, host } : { host }));
  }
  if (n === seq) render(fromScript ?? (host ? { host } : null));
}

chrome.tabs.onActivated.addListener(() => void follow());
chrome.windows.onFocusChanged.addListener(() => void follow());
// single-page sites change the address without reloading: follow the tab in front
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId === active && (info.url || info.status === "complete")) void follow();
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "session" && ch[`tab:${active}`]) void follow();
});

// the viewer's J7Tracker token, for the radar inside the view (never in the view's address: it would reach logs)
function sendJ7() {
  chrome.storage.local.get("j7", (r) => view.contentWindow?.postMessage({ yeppo: "j7", token: r.j7 ?? null }, SITE));
}
view.addEventListener("load", sendJ7);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.j7) sendJ7();
});

// J7Tracker, on or off from here: on reads J7's session from j7tracker.io (opens it when you're logged out), off forgets it
const j7dot = document.getElementById("j7dot");
const j7txt = document.getElementById("j7txt");
const j7btn = document.getElementById("j7btn");
function showJ7() {
  chrome.storage.local.get(["j7", "j7auto"], (r) => {
    const on = !!r.j7;
    j7dot.className = on ? "on" : r.j7auto ? "wait" : "";
    j7txt.textContent = on ? "J7 connected" : r.j7auto ? "J7: log in on j7tracker.io" : "J7 off";
    j7btn.textContent = on || r.j7auto ? "Disconnect" : "Connect J7";
  });
}
j7btn.addEventListener("click", () =>
  chrome.storage.local.get(["j7", "j7auto"], (r) => {
    if (r.j7 || r.j7auto) chrome.runtime.sendMessage({ t: "j7off" }).catch(() => {});
    else chrome.runtime.sendMessage({ t: "j7connect" }).catch(() => {});
  }),
);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.j7 || ch.j7auto)) showJ7();
});
showJ7();
