// The card the badge opens on the trading page: yeppo's live read of the coin, from yeppo.it.
const p = new URLSearchParams(location.search);
const mint = p.get("mint");
const tab = Number(p.get("tab"));
document.getElementById("view").src = `https://yeppo.it/c/${mint}?mini=1&panel=1`;
document.getElementById("full").href = `https://yeppo.it/c/${mint}`;
document.getElementById("close").onclick = () => parent.postMessage({ yeppo: "close" }, "*");
const side = document.getElementById("side");
if (!tab || !chrome.sidePanel?.open) side.hidden = true;
side.onclick = () =>
  chrome.sidePanel.open({ tabId: tab }).then(
    () => parent.postMessage({ yeppo: "close" }, "*"),
    () => (side.hidden = true),
  );
