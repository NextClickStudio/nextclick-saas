// The side panel: yeppo's view of the coin in the tab in front (or none), with your wallet below.
const SITE = "https://yeppo.it";
const view = document.getElementById("view");
const where = document.getElementById("where");
let active = null;
let saved = {};
chrome.storage.local.get(["who", "limits"], (r) => {
  saved = r;
  void follow();
});
// the view hands back the wallet and the limits the trader sets
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.data?.yeppo !== "keep") return;
  if (e.data.key === "yo:guard") chrome.storage.local.set({ who: e.data.value });
  if (e.data.key === "yo:limits") chrome.storage.local.set({ limits: e.data.value });
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  if (ch.who) saved.who = ch.who.newValue;
  if (ch.limits) saved.limits = ch.limits.newValue;
});

/** the view's address: the coin, plus the wallet and the limits the extension remembers */
function viewUrl(mint) {
  const q = new URLSearchParams();
  if (mint) q.set("mint", mint);
  if (saved.who) q.set("who", saved.who);
  if (saved.limits) {
    q.set("risk", saved.limits.risk);
    q.set("daily", saved.limits.daily);
  }
  return `${SITE}/panel?${q}`;
}

let shown = undefined;
function render(coin) {
  const mint = coin?.mint ?? null;
  where.textContent = coin?.host ? `reading on ${coin.host.replace(/^www\./, "")}` : "no coin open";
  if (mint === shown) return;
  shown = mint;
  view.src = viewUrl(mint);
}
async function follow() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  active = tab?.id ?? null;
  const key = `tab:${active}`;
  const r = active == null ? {} : await chrome.storage.session.get(key);
  render(r[key] ?? null);
}

chrome.tabs.onActivated.addListener(() => void follow());
chrome.windows.onFocusChanged.addListener(() => void follow());
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "session" && ch[`tab:${active}`]) render(ch[`tab:${active}`].newValue ?? null);
});

const box = document.getElementById("badge");
chrome.storage.local.get("badge", (r) => (box.checked = r.badge !== false));
box.addEventListener("change", () => chrome.storage.local.set({ badge: box.checked }));

