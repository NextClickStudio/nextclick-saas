// yeppo: remembers which coin each tab shows, fetches yeppo's read of it (shared by every tab,
// 5 s fresh) and puts the decision's colour on the toolbar button. The toolbar button opens the side panel.
const SITE = "https://yeppo.it";
const TONE = { up: "#1fd47c", mid: "#ffb23e", down: "#ff5b3d", learn: "#9a85ff" };
const MARK = { up: "GO", mid: "WAIT", down: "NO", learn: "" };
let key = null; // the Pro key, when there is one
chrome.storage.local.get("key", (r) => (key = r.key ?? null));
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
    const r = await fetch(`${SITE}/api/read?mint=${mint}${key ? `&key=${encodeURIComponent(key)}` : ""}`);
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
  chrome.action.setBadgeText({ tabId, text: d ? (d.word === "No red flags" ? "OK" : MARK[d.tone] ?? "") : "" }).catch(() => {});
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
