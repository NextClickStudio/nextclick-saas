// The card the badge opens on the trading page: yeppo's live read of the coin.
const SITE = "https://yeppo.it";
const p = new URLSearchParams(location.search);
const mint = p.get("mint");
const tab = Number(p.get("tab"));
const view = document.getElementById("view");
chrome.storage.local.get(["paper"], (r) => {
  const q = new URLSearchParams({ mint });
  if (r.paper) q.set("paper", r.paper);
  view.src = `${SITE}/panel?${q}`;
});
// the view opened a paper wallet: keep it for every frame
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.origin !== SITE || e.data?.yeppo !== "paper") return;
  if (typeof e.data.id === "string" && /^[0-9a-f-]{36}$/.test(e.data.id)) chrome.storage.local.set({ paper: e.data.id });
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
