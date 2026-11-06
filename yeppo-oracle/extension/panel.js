// The side panel: yeppo's read of the coin in the tab in front (or none).
const SITE = "https://yeppo.it";
const view = document.getElementById("view");
const where = document.getElementById("where");
let active = null;
let saved = {};
chrome.storage.local.get(["key", "dev"], (r) => {
  // one device id for the whole extension, so one browser counts as one device
  if (!r.dev) chrome.storage.local.set({ dev: (r.dev = crypto.randomUUID()) });
  saved = r;
  void follow();
});
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== "local") return;
  let again = false;
  for (const k of ["key", "dev"])
    if (ch[k] && ch[k].newValue !== saved[k]) {
      saved[k] = ch[k].newValue;
      again = true;
    }
  if (again) view.src = viewUrl(shown);
});

/** the view's address: the coin, plus the Pro key the extension keeps */
function viewUrl(mint) {
  const q = new URLSearchParams();
  if (mint) q.set("mint", mint);
  if (saved.key) q.set("key", saved.key);
  if (saved.dev) q.set("dev", saved.dev);
  return `${SITE}/panel?${q}`;
}

// the view unlocked Pro: keep the key for every frame
window.addEventListener("message", (e) => {
  if (e.source !== view.contentWindow || e.origin !== SITE) return;
  const d = e.data;
  if (d?.yeppo === "key" && typeof d.key === "string" && /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/.test(d.key)) chrome.storage.local.set({ key: d.key });
  // the radar's "Connect J7": the extension reads J7's session (and opens J7 when the viewer isn't logged in)
  if (d?.yeppo === "j7-auto") chrome.runtime.sendMessage({ t: "j7connect" }).catch(() => {});
  if (d?.yeppo === "j7-off") chrome.runtime.sendMessage({ t: "j7off" }).catch(() => {});
  if (d?.yeppo === "j7?") sendJ7();
  // the live call of the coin in the tab in front: its colour on the toolbar button
  if (d?.yeppo === "call" && d.mint === shown && active != null)
    chrome.runtime.sendMessage({ t: "live", tab: active, mint: d.mint, d: { word: d.word, tone: d.tone, why: d.why } }).catch(() => {});
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

// the viewer's J7Tracker token, for the radar inside the view (never in the view's address: it would reach logs)
function sendJ7() {
  chrome.storage.local.get("j7", (r) => view.contentWindow?.postMessage({ yeppo: "j7", token: r.j7 ?? null }, SITE));
}
view.addEventListener("load", sendJ7);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.j7) sendJ7();
});

// J7Tracker, on or off from here: on reads J7's session from j7tracker.io (opens it when you're logged out), off forgets it
const j7dot = document.getElementById("j7dot");
const j7txt = document.getElementById("j7txt");
const j7btn = document.getElementById("j7btn");
function showJ7() {
  chrome.storage.local.get(["j7", "j7auto"], (r) => {
    const on = !!r.j7;
    j7dot.className = on ? "on" : r.j7auto ? "wait" : "";
    j7txt.textContent = on ? "J7 connected" : r.j7auto ? "J7: log in on j7tracker.io" : "J7 off";
    j7btn.textContent = on || r.j7auto ? "Disconnect" : "Connect J7";
  });
}
j7btn.addEventListener("click", () =>
  chrome.storage.local.get(["j7", "j7auto"], (r) => {
    if (r.j7 || r.j7auto) chrome.runtime.sendMessage({ t: "j7off" }).catch(() => {});
    else chrome.runtime.sendMessage({ t: "j7connect" }).catch(() => {});
  }),
);
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && (ch.j7 || ch.j7auto)) showJ7();
});
showJ7();
