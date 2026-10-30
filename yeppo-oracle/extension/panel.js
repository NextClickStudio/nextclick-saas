// The side panel: yeppo's read of the coin in the tab in front (or none).
const SITE = "https://yeppo.it";
const view = document.getElementById("view");
const where = document.getElementById("where");
let active = null;
let saved = {};
chrome.storage.local.get(["lab", "paper"], (r) => {
  saved = r;
  void follow();
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  if (ch.lab || ch.paper) {
    if (ch.lab) saved.lab = ch.lab.newValue;
    if (ch.paper) saved.paper = ch.paper.newValue;
    view.src = viewUrl(shown);
  }
});

/** the view's address: the coin, plus the owner's paper wallet when linked */
function viewUrl(mint) {
  const q = new URLSearchParams();
  if (mint) q.set("mint", mint);
  if (saved.lab && saved.paper) {
    q.set("lab", saved.lab);
    q.set("paper", saved.paper);
  }
  return `${SITE}/panel?${q}`;
}

let shown = undefined;
function render(coin) {
  const mint = coin?.mint ?? null;
  where.textContent = coin?.host ? coin.host.replace(/^www\./, "") : "no coin open";
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


// the owner's lab: the lab key and the paper wallet id (both on yeppo.it/lab) turn on paper trading here;
// an empty key turns it off
const form = document.getElementById("labform");
document.getElementById("lab").addEventListener("click", (e) => {
  e.preventDefault();
  form.hidden = !form.hidden;
  document.getElementById("labkey").value = saved.lab ?? "";
  document.getElementById("labpaper").value = saved.paper ?? "";
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const lab = document.getElementById("labkey").value.trim();
  const paper = document.getElementById("labpaper").value.trim();
  if (lab && paper) chrome.storage.local.set({ lab, paper });
  else chrome.storage.local.remove(["lab", "paper"]);
  form.hidden = true;
});
