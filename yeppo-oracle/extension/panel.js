// The side panel: yeppo's read of the coin in the tab in front (or none).
const SITE = "https://yeppo.it";
const view = document.getElementById("view");
const where = document.getElementById("where");
let active = null;
let saved = {};
chrome.storage.local.get(["paper", "key", "dev"], (r) => {
  // one device id for the whole extension (badge, card and panel), so one browser counts as one device
  if (!r.dev) chrome.storage.local.set({ dev: (r.dev = crypto.randomUUID()) });
  saved = r;
  void follow();
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  let again = false;
  for (const k of ["paper", "key", "dev"])
    if (ch[k] && ch[k].newValue !== saved[k]) {
      saved[k] = ch[k].newValue;
      again = true;
    }
  if (again) view.src = viewUrl(shown);
});

/** the view's address: the coin, plus the paper wallet and the Pro key the extension keeps */
function viewUrl(mint) {
  const q = new URLSearchParams();
  if (mint) q.set("mint", mint);
  if (saved.paper) q.set("paper", saved.paper);
  if (saved.key) q.set("key", saved.key);
  if (saved.dev) q.set("dev", saved.dev);
  return `${SITE}/panel?${q}`;
}

// the view opened a paper wallet or unlocked Pro: keep it for every frame
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.origin !== SITE) return;
  const d = e.data;
  if (d?.yeppo === "paper" && typeof d.id === "string" && /^[0-9a-f-]{36}$/.test(d.id)) chrome.storage.local.set({ paper: d.id });
  if (d?.yeppo === "key" && typeof d.key === "string" && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(d.key)) chrome.storage.local.set({ key: d.key });
});

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

const waves = document.getElementById("waves");
chrome.storage.local.get("waves", (r) => (waves.checked = r.waves !== false));
waves.addEventListener("change", () => chrome.storage.local.set({ waves: waves.checked }));
