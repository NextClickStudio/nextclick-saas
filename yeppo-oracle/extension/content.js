// yeppo: finds the coin on the trading page and shows a small badge with yeppo's read of it.
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
      * { box-sizing: border-box; font-family: Geist, Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
      .pill { --t: #9a85ff; display: flex; align-items: center; gap: 9px; height: 36px; padding: 0 4px 0 12px; border-radius: 12px;
        cursor: pointer; background: rgba(9, 8, 18, .86); color: #f3f3f6; border: 1px solid rgba(255, 255, 255, .1);
        box-shadow: 0 12px 34px -10px rgba(0, 0, 0, .8), inset 0 1px 0 rgba(255, 255, 255, .05);
        backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
        user-select: none; transition: transform .2s cubic-bezier(.2,.8,.2,1), border-color .3s; font-size: 13px; white-space: nowrap; }
      .pill:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--t) 55%, transparent); }
      .mark { width: 14px; height: 14px; border-radius: 4px; flex: none; position: relative;
        background: conic-gradient(from 210deg, #5b6cff, #ff5fd2, #45d6ff, #5b6cff); }
      .mark::after { content: ""; position: absolute; inset: 3.5px; border-radius: 2px; background: #09081a; }
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--t); flex: none; animation: ping 1.8s ease-out infinite; }
      @keyframes ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--t) 60%, transparent); } 80%, 100% { box-shadow: 0 0 0 7px transparent; } }
      .lbl { font-weight: 600; letter-spacing: -.01em; color: var(--t); }
      .x { width: 26px; height: 26px; border-radius: 8px; border: 0; background: transparent; color: #5f5f74; font-size: 14px; cursor: pointer; }
      .x:hover { background: rgba(255,255,255,.07); color: #f3f3f6; }
      .t-up { --t: #1fd47c; } .t-mid { --t: #ffb23e; } .t-down { --t: #ff5b3d; } .t-learn { --t: #9a85ff; }
      .t-down { border-color: rgba(255, 91, 61, .4); }
      .card { position: absolute; right: 0; bottom: 46px; width: 380px; height: min(700px, calc(100vh - 80px)); border-radius: 16px; overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 40px 90px -20px rgba(0, 0, 0, .9); background: #07060e; display: none; }
      .card.on { display: block; animation: rise .28s cubic-bezier(.2,.8,.2,1); }
      @keyframes rise { from { opacity: 0; transform: translateY(10px) scale(.98); } }
      iframe { width: 100%; height: 100%; border: 0; display: block; }
    </style>
    <div class="card"></div>
    <div class="pill t-learn" title="yeppo: click for the full read">
      <i class="mark"></i><i class="dot"></i><span class="lbl">Reading…</span>
      <button class="x" title="Hide on this tab">×</button>
    </div>`;
  const pill = root.querySelector(".pill");
  const card = root.querySelector(".card");
  const lbl = root.querySelector(".lbl");

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
    const d = r && !r.error ? r.decision : null;
    pill.className = `pill t-${d?.tone ?? "learn"}`;
    lbl.textContent = d ? d.word : r?.error ? "Retrying…" : "Reading…";
    pill.title = d ? `${d.word}: ${d.why}` : "yeppo: click for the full read";
  }

  function read() {
    clearTimeout(timer);
    if (!mint) return;
    const m = mint;
    // the next read is booked first: an answer that never comes can't stop the badge's refresh
    timer = setTimeout(read, document.hidden ? 60000 : 15000);
    try {
      chrome.runtime.sendMessage({ t: "read", mint: m }, (r) => {
        if (chrome.runtime.lastError || m !== mint) return;
        paint(r);
      });
    } catch {
      /* the extension was reloaded: this page keeps its last badge */
    }
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
