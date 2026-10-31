// yeppo: remembers which coin each tab shows, fetches yeppo's read of it (shared by every tab,
// 5 s fresh) and puts the decision's colour on the toolbar button. The toolbar button opens the side panel.
const SITE = "https://yeppo.it";
const TONE = { up: "#1fd47c", mid: "#ffb23e", down: "#ff5b3d", learn: "#9a85ff" };
const MARK = { up: "GO", mid: "WAIT", down: "NO", learn: "" };
let key = null; // the Pro key, when there is one
let dev = null; // this browser's random device id: a key works on 3 devices
chrome.storage.local.get(["key", "dev"], (r) => {
  key = r.key ?? null;
  dev = r.dev ?? null;
  if (!dev) {
    dev = crypto.randomUUID();
    chrome.storage.local.set({ dev });
  }
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.key) {
    key = ch.key.newValue ?? null;
    cache.clear();
  }
});
const cache = new Map(); // mint -> { at, data }

chrome.runtime.onInstalled.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));

async function read(mint) {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < 5_000) return hit.data;
  try {
    const q = new URLSearchParams({ mint });
    if (key) q.set("key", key);
    if (dev) q.set("dev", dev);
    const r = await fetch(`${SITE}/api/read?${q}`, { signal: AbortSignal.timeout(12_000) });
    const data = await r.json();
    cache.set(mint, { at: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return data;
  } catch {
    return { error: "offline" };
  }
}

function badge(tabId, data) {
  const d = data?.decision;
  chrome.action.setBadgeText({ tabId, text: d ? (d.word === "Locked" ? "KEY" : MARK[d.tone] ?? "") : "" }).catch(() => {});
  if (d) chrome.action.setBadgeBackgroundColor({ tabId, color: TONE[d.tone] ?? "#9a85ff" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender.tab?.id;
  if (msg.t === "hello") {
    chrome.storage.local.get("badge", (r) => reply({ tab: tabId ?? null, badge: r.badge }));
    return true;
  }
  if (msg.t === "coin" && tabId != null) {
    chrome.storage.session.set({ [`tab:${tabId}`]: msg.mint ? { mint: msg.mint, host: new URL(sender.url).hostname } : null });
    if (!msg.mint) badge(tabId, null);
    return false;
  }
  if (msg.t === "read") {
    read(msg.mint).then((data) => {
      if (tabId != null) badge(tabId, data);
      reply(data);
    });
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`));


// ---- meme waves -------------------------------------------------------------------------------------------------
// Every 2 minutes (with a Pro key): a new wave whose leading coin already trades well becomes a Chrome
// notification. Clicking it opens the coin on pump.fun, where yeppo reads it. "Wave alerts" in the side panel
// turns it off.
const SEEN_MS = 3 * 3600_000; // a wave alerts once every 3 hours at most

chrome.alarms.create("waves", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "waves") void checkWaves();
});

async function checkWaves() {
  const st = await chrome.storage.local.get(["key", "dev", "waves", "waveSeen"]);
  if (!st.key || st.waves === false) return;
  const q = new URLSearchParams({ key: st.key });
  if (st.dev) q.set("dev", st.dev);
  let j;
  try {
    j = await (await fetch(`${SITE}/api/trends?${q}`)).json();
  } catch {
    return;
  }
  if (!j || !Array.isArray(j.trends)) return;
  const seen = st.waveSeen ?? {};
  const now = Date.now();
  for (const k of Object.keys(seen)) if (now - seen[k] > SEEN_MS) delete seen[k];
  for (const t of j.trends) {
    if (t.n30 < 8 || t.burst < 10) continue;
    // the wave's best coin: under 10 minutes old, already ×1.5, at least 10 buyers in the last 2 minutes, climbing
    const lead = (t.coins ?? []).find((c) => now - c[2] < 600_000 && (c[4] ?? 0) >= 1.5 && c[7] >= 10 && (c[8] ?? 0) >= 0);
    if (!lead || seen[lead[0]]) continue;
    seen[lead[0]] = now;
    const [mint, sym, t0, , nowX, , , wallets2, ch2] = lead;
    const x = (v) => (v == null ? "" : `×${v >= 10 ? v.toFixed(0) : v.toFixed(1)}`);
    const mins = Math.max(1, Math.round((now - t0) / 60000));
    chrome.notifications.create(`wave:${mint}`, {
      type: "basic",
      iconUrl: "icons/128.png",
      title: `Meme wave ${String(t.theme).toUpperCase()}: $${sym ?? "?"} ${x(nowX)}`,
      message: `${t.n30} launches in 30 min (×${Math.round(t.burst)} usual). $${sym ?? "?"} is ${mins} min old, ${wallets2} buyers in 2 min, ${(ch2 ?? 0) >= 0 ? "+" : ""}${Math.round((ch2 ?? 0) * 100)}% now. Passed yeppo's checks.`,
      contextMessage: "Click to open it. yeppo reads it there.",
      priority: 1,
    });
    break; // one alert at a time
  }
  await chrome.storage.local.set({ waveSeen: seen });
}

chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith("wave:")) chrome.tabs.create({ url: `https://pump.fun/coin/${id.slice(5)}` });
  chrome.notifications.clear(id);
});
