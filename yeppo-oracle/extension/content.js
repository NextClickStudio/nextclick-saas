// yeppo oracle: finds the coin on the trading page and shows a small badge with yeppo's read of it.
// Click the badge for the full read in a card on the page; the toolbar button opens it in the side panel.
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

  const detect = () => fromUrl() ?? (POOL_PAGE() ? fromPage() : null);

  // ---- the badge -------------------------------------------------------------------------------------
  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483646;right:16px;bottom:16px;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .pill { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 6px 0 10px; border-radius: 999px; cursor: pointer;
        background: rgba(10, 11, 18, .92); color: #eef1f8; border: 1px solid rgba(139, 92, 255, .45);
        box-shadow: 0 10px 30px -8px rgba(0, 0, 0, .7), 0 0 0 1px rgba(255, 255, 255, .04) inset; backdrop-filter: blur(12px);
        user-select: none; transition: transform .15s ease, border-color .2s ease; font-size: 13px; white-space: nowrap; }
      .pill:hover { transform: translateY(-1px); }
      .pill b { font-weight: 800; letter-spacing: -.01em; }
      .lbl { font-weight: 700; }
      .sc { font: 700 12px ui-monospace, "JetBrains Mono", monospace; padding: 3px 7px; border-radius: 999px; background: rgba(255,255,255,.07); }
      .x { width: 24px; height: 24px; border-radius: 50%; border: 0; background: transparent; color: #8d95a9; font-size: 15px; cursor: pointer; }
      .x:hover { background: rgba(255,255,255,.08); color: #eef1f8; }
      .t-up { border-color: rgba(34, 227, 154, .6); } .t-up .lbl { color: #22e39a; }
      .t-mid .lbl { color: #ffb547; }
      .t-flat .lbl { color: #8d95a9; }
      .t-down, .t-rug { border-color: rgba(255, 77, 109, .65); } .t-down .lbl, .t-rug .lbl { color: #ff4d6d; }
      .t-rug { animation: pulse 1.6s ease-in-out infinite; }
      @keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(255, 77, 109, .18), 0 10px 30px -8px rgba(0,0,0,.7); } }
      .t-learn .lbl { color: #b9a4ff; }
      .card { position: absolute; right: 0; bottom: 50px; width: 380px; height: min(600px, calc(100vh - 90px)); border-radius: 18px; overflow: hidden;
        border: 1px solid rgba(139, 92, 255, .35); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, .85); background: #06070b; display: none; }
      .card.on { display: block; animation: rise .18s ease-out; }
      @keyframes rise { from { opacity: 0; transform: translateY(8px); } }
      iframe { width: 100%; height: 100%; border: 0; display: block; }
      svg { flex: none; }
    </style>
    <div class="card"></div>
    <div class="pill t-learn" title="yeppo oracle: click for the full read">
      <svg width="22" height="22" viewBox="0 0 64 64"><path d="M6 32c6.5-11 15-16.5 26-16.5S51.5 21 58 32c-6.5 11-15 16.5-26 16.5S12.5 43 6 32z" fill="none" stroke="#8b5cff" stroke-width="5"/><circle cx="32" cy="32" r="11" fill="#7c4dff"/><circle cx="35.5" cy="28.5" r="3.4" fill="#fff"/></svg>
      <b>yeppo</b><span class="lbl">reading…</span><span class="sc" hidden></span>
      <button class="x" title="Hide on this tab">×</button>
    </div>`;
  const pill = root.querySelector(".pill");
  const card = root.querySelector(".card");
  const lbl = root.querySelector(".lbl");
  const sc = root.querySelector(".sc");

  let mint = null;
  let tabId = null;
  let hidden = false;
  let badgeOn = true;
  let timer = 0;

  chrome.runtime.sendMessage({ t: "hello" }, (r) => {
    tabId = r?.tab ?? null;
    badgeOn = r?.badge !== false;
    show();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "local" && ch.badge) {
      badgeOn = ch.badge.newValue !== false;
      show();
    }
  });

  function show() {
    const on = !!mint && !hidden && badgeOn;
    if (on && !host.isConnected) document.documentElement.appendChild(host);
    if (!on && host.isConnected) host.remove();
  }

  function paint(r) {
    const v = r?.verdict;
    let tone = "learn";
    let text = "reading…";
    if (r && !r.error) {
      if (v) [tone, text] = [v.tone, v.label];
      else if (r.old) text = "too old to read";
      else if (!r.tracked) text = "not followed";
      else text = "still learning";
      const red = (r.flags || []).find((f) => f.tone === "down");
      if (red && !v) [tone, text] = ["rug", red.text.split(":")[0]];
    }
    pill.className = `pill t-${tone}`;
    lbl.textContent = text;
    sc.hidden = !v;
    if (v) sc.textContent = String(v.score);
    pill.title = v ? `${v.label}: ${v.line}` : "yeppo oracle: click for the full read";
  }

  function read() {
    clearTimeout(timer);
    if (!mint) return;
    const m = mint;
    chrome.runtime.sendMessage({ t: "read", mint: m }, (r) => {
      if (m !== mint) return;
      paint(r);
      timer = setTimeout(read, document.hidden ? 60000 : 15000);
    });
  }

  function setCoin(next) {
    if (next === mint) return;
    mint = next;
    chrome.runtime.sendMessage({ t: "coin", mint });
    paint(null);
    if (card.classList.contains("on")) openCard();
    show();
    read();
  }

  function openCard() {
    const src = chrome.runtime.getURL(`frame.html?mint=${mint}&tab=${tabId ?? ""}`);
    const f = card.querySelector("iframe");
    if (f) {
      if (f.src !== src) f.src = src;
    } else card.innerHTML = `<iframe src="${src}" allow="clipboard-write"></iframe>`;
    card.classList.add("on");
  }

  // click opens the card; drag moves the badge (remembered per site)
  let drag = null;
  pill.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".x")) return;
    drag = { x: e.clientX, y: e.clientY, r: parseFloat(host.style.right), b: parseFloat(host.style.bottom), moved: false };
    pill.setPointerCapture(e.pointerId);
  });
  pill.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    host.style.right = `${Math.max(4, Math.min(innerWidth - 120, drag.r - dx))}px`;
    host.style.bottom = `${Math.max(4, Math.min(innerHeight - 50, drag.b - dy))}px`;
  });
  pill.addEventListener("pointerup", () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) chrome.storage.local.set({ [`pos:${location.hostname}`]: { r: host.style.right, b: host.style.bottom } });
    else if (card.classList.contains("on")) card.classList.remove("on");
    else openCard();
  });
  root.querySelector(".x").addEventListener("click", (e) => {
    e.stopPropagation();
    hidden = true;
    show();
  });
  chrome.storage.local.get(`pos:${location.hostname}`, (r) => {
    const p = r[`pos:${location.hostname}`];
    if (p) [host.style.right, host.style.bottom] = [p.r, p.b];
  });
  window.addEventListener("message", (e) => {
    if (e.data?.yeppo === "close" && e.source === card.querySelector("iframe")?.contentWindow) card.classList.remove("on");
  });

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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && mint) read();
  });
})();
