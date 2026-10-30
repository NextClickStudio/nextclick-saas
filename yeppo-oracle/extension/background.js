// yeppo oracle: remembers which coin each tab shows, fetches yeppo's read of it (shared by every tab,
// 10 s fresh) and puts the score on the toolbar button. The toolbar button opens the side panel.
const SITE = "https://yeppo.it";
const TONE = { up: "#22e39a", mid: "#ffb547", flat: "#5d6478", down: "#ff4d6d", rug: "#ff4d6d" };
const cache = new Map(); // mint -> { at, data }

chrome.runtime.onInstalled.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));

async function read(mint) {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < 10_000) return hit.data;
  try {
    const r = await fetch(`${SITE}/api/read?mint=${mint}`);
    const data = await r.json();
    cache.set(mint, { at: Date.now(), data });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return data;
  } catch {
    return { error: "offline" };
  }
}

function badge(tabId, data) {
  const v = data?.verdict;
  chrome.action.setBadgeText({ tabId, text: v ? String(v.score) : "" }).catch(() => {});
  if (v) chrome.action.setBadgeBackgroundColor({ tabId, color: TONE[v.tone] ?? "#8b5cff" }).catch(() => {});
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
