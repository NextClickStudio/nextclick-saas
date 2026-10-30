// The card the badge opens on the trading page: yeppo's live view of the coin, with your wallet below.
const SITE = "https://yeppo.it";
const p = new URLSearchParams(location.search);
const mint = p.get("mint");
const tab = Number(p.get("tab"));
const view = document.getElementById("view");
chrome.storage.local.get(["who", "limits"], (r) => {
  const q = new URLSearchParams({ mint });
  if (r.who) q.set("who", r.who);
  if (r.limits) {
    q.set("risk", r.limits.risk);
    q.set("daily", r.limits.daily);
  }
  view.src = `${SITE}/panel?${q}`;
});
// the view hands back the wallet and the limits the trader sets
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.data?.yeppo !== "keep") return;
  if (e.data.key === "yo:guard") chrome.storage.local.set({ who: e.data.value });
  if (e.data.key === "yo:limits") chrome.storage.local.set({ limits: e.data.value });
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
