// yeppo: finds the coin on the trading page and tells the side panel (the toolbar button opens it).
(() => {
  if (window.top !== window || window.__yeppo) return;
  window.__yeppo = true;

  const ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const NOT_COINS = new Set([
    "So11111111111111111111111111111111111111112", // wrapped SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // pump.fun
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // pump.fun AMM
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "11111111111111111111111111111111",
  ]);
  const ALPHA = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  /** true when the text decodes to 32 bytes, like every Solana address */
  function is32(s) {
    if (NOT_COINS.has(s)) return false;
    const bytes = [0];
    for (const ch of s) {
      let carry = ALPHA.indexOf(ch);
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

  const coinish = (a) => /(pump|bonk|moon|boop)$/.test(a);

  /** the coin named by the address bar on sites whose URLs carry the mint itself */
  function fromUrl() {
    const h = location.hostname.replace(/^www\./, "");
    const path = location.pathname;
    const q = new URLSearchParams(location.search);
    const first = (s) => (s || "").match(ADDR)?.find(is32) ?? null;
    if (h.endsWith("pump.fun")) return first(path.match(/^\/(?:coin\/)?([^/?#]+)/)?.[1]);
    if (h === "gmgn.ai") return first(path.match(/\/token\/(?:[^/_]+_)?([^/?#]+)/)?.[1]);
    // Axiom's newer coin pages carry the coin itself: axiom.trade/token/<mint>?chain=sol
    if (h.endsWith("axiom.trade") && /^\/token\//.test(path)) return first(path.match(/^\/token\/([^/?#]+)/)?.[1]);
    if (h.endsWith("bullx.io")) return first(q.get("address"));
    if (h === "birdeye.so" || h === "solscan.io") return first(path.match(/\/token\/([^/?#]+)/)?.[1]);
    if (h === "jup.ag") return (path.match(ADDR) || []).filter(is32).find((a) => a !== "So11111111111111111111111111111111111111112") ?? null;
    return null;
  }

  /** Axiom, Photon and DexScreener put the pool in the URL: read the coin from the page's own links */
  const POOL_PAGE = () => /^\/(?:meme|lp|en\/lp|solana)\/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(location.pathname);

  function fromPage() {
    const pool = (location.pathname.match(ADDR) || [])[0];
    const score = new Map();
    const add = (a, w) => {
      if (a === pool || !is32(a)) return;
      score.set(a, (score.get(a) || 0) + w + (coinish(a) ? 2 : 0));
    };
    const els = document.querySelectorAll("a[href], img[src]");
    for (let i = 0; i < els.length && i < 1500; i++) {
      const v = els[i].getAttribute("href") || els[i].getAttribute("src") || "";
      for (const m of v.matchAll(ADDR)) {
        const before = v.slice(Math.max(0, m.index - 14), m.index);
        add(m[0], /(coin|token|tokens|mint)\/$|[?&](q|address|token|mint|outputMint)=$/.test(before) ? 3 : 1);
      }
    }
    const text = (document.body?.textContent || "").slice(0, 300000);
    for (const m of text.matchAll(ADDR)) if (coinish(m[0])) add(m[0], 2);
    let best = null;
    let top = 0;
    for (const [a, s] of score) if (s > top) [best, top] = [a, s];
    return top >= 3 ? best : null;
  }

  // the address in a pool page's URL: Axiom, Photon and DexScreener put either the pool or the coin itself there.
  // The extension asks DexScreener which coin it is (kept per address); until it answers, the page's links decide.
  const resolved = new Map(); // address in the URL -> coin, or null when DexScreener knows neither
  function fromPoolUrl() {
    const a = (location.pathname.match(ADDR) || []).find(is32);
    if (!a) return null;
    if (resolved.has(a)) return resolved.get(a);
    resolved.set(a, undefined);
    try {
      chrome.runtime.sendMessage({ t: "resolve", addr: a }, (r) => {
        if (chrome.runtime.lastError) return;
        resolved.set(a, typeof r?.mint === "string" && is32(r.mint) ? r.mint : null);
        tries = 0; // look again now that the answer is in
      });
    } catch {
      /* the extension was reloaded */
    }
    return undefined;
  }

  const detect = () => {
    const u = fromUrl();
    if (u) return u;
    if (!POOL_PAGE()) return null;
    const p = fromPoolUrl();
    return p === undefined ? fromPage() : (p ?? fromPage());
  };

  // the coin in this tab, for the side panel (the toolbar button opens it). No badge on the page and no reads from here:
  // the panel reads the coin itself, only while it is open.
  let mint = null;
  function setCoin(next) {
    if (next === mint) return;
    mint = next;
    try {
      chrome.runtime.sendMessage({ t: "coin", mint });
    } catch {
      /* the extension was reloaded */
    }
  }

  // single-page apps change the URL without reloading: look again on every change, a few times while it loads
  let href = "";
  let tries = 0;
  setInterval(() => {
    if (location.href !== href) {
      href = location.href;
      tries = 0;
    }
    if (tries >= 20 || (mint && tries >= 8)) return;
    tries++;
    const found = detect();
    if (found) setCoin(found);
    else if (!POOL_PAGE() || tries >= 8) setCoin(null);
  }, 1200);
})();
