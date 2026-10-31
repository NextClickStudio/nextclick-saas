// The card the badge opens on the trading page: yeppo's live read of the coin.
const SITE = "https://yeppo.it";
const p = new URLSearchParams(location.search);
const mint = p.get("mint");
const tab = Number(p.get("tab"));
const view = document.getElementById("view");
chrome.storage.local.get(["paper", "key", "dev"], (r) => {
  if (!r.dev) chrome.storage.local.set({ dev: (r.dev = crypto.randomUUID()) });
  const q = new URLSearchParams({ mint });
  if (r.paper) q.set("paper", r.paper);
  if (r.key) q.set("key", r.key);
  if (r.dev) q.set("dev", r.dev);
  view.src = `${SITE}/panel?${q}`;
});
// the view opened a paper wallet or unlocked Pro: keep it for every frame
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.origin !== SITE) return;
  const d = e.data;
  if (d?.yeppo === "paper" && typeof d.id === "string" && /^[0-9a-f-]{36}$/.test(d.id)) chrome.storage.local.set({ paper: d.id });
  if (d?.yeppo === "key" && typeof d.key === "string" && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(d.key)) chrome.storage.local.set({ key: d.key });
});
document.getElementById("full").href = `${SITE}/c/${mint}`;
document.getElementById("close").onclick = () => parent.postMessage({ yeppo: "close" }, "*");
const side = document.getElementById("side");
if (!tab || !chrome.sidePanel?.open) side.hidden = true;
side.onclick = () =>
  chrome.sidePanel.open({ tabId: tab }).then(
    () => parent.postMessage({ yeppo: "close" }, "*"),
    () => (side.hidden = true),
  );
