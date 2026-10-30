// The card the badge opens on the trading page: yeppo's live read of the coin.
const SITE = "https://yeppo.it";
const p = new URLSearchParams(location.search);
const mint = p.get("mint");
const tab = Number(p.get("tab"));
const view = document.getElementById("view");
chrome.storage.local.get(["lab", "paper"], (r) => {
  const q = new URLSearchParams({ mint });
  if (r.lab && r.paper) {
    q.set("lab", r.lab);
    q.set("paper", r.paper);
  }
  view.src = `${SITE}/panel?${q}`;
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
