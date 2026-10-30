// The side panel: follows the coin of the tab in front, or a pasted address.
const view = document.getElementById("view");
const empty = document.getElementById("empty");
const where = document.getElementById("where");
let pasted = null;
let active = null;

function render(coin) {
  const mint = coin?.mint ?? pasted;
  if (!mint) {
    view.hidden = true;
    view.removeAttribute("src");
    empty.hidden = false;
    where.textContent = "";
    return;
  }
  const src = `https://yeppo.it/c/${mint}?mini=1&panel=1`;
  if (view.getAttribute("src") !== src) view.src = src;
  view.hidden = false;
  empty.hidden = true;
  where.textContent = coin?.host ? `on ${coin.host.replace(/^www\./, "")}` : "pasted";
}

async function follow() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  active = tab?.id ?? null;
  const key = `tab:${active}`;
  const r = active == null ? {} : await chrome.storage.session.get(key);
  render(r[key] ?? null);
}

chrome.tabs.onActivated.addListener(() => {
  pasted = null;
  void follow();
});
chrome.windows.onFocusChanged.addListener(() => void follow());
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "session" && ch[`tab:${active}`]) {
    if (ch[`tab:${active}`].newValue) pasted = null;
    render(ch[`tab:${active}`].newValue ?? null);
  }
});

document.getElementById("paste").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = document.getElementById("ca").value.trim().match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0];
  document.getElementById("err").hidden = !!v;
  if (!v) return;
  pasted = v;
  render(null);
});

const box = document.getElementById("badge");
chrome.storage.local.get("badge", (r) => (box.checked = r.badge !== false));
box.addEventListener("change", () => chrome.storage.local.set({ badge: box.checked }));

void follow();
