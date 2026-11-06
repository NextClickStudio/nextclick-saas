// On yeppo.it only: the site hands the extension a Pro key (after a payment, or a key checked on the pricing page)
// so nothing has to be pasted, and the extension hands the radar the viewer's J7Tracker token once J7 is connected.
// Only this page's own messages count, and only well-formed values.
const KEY = /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/;
const say = (m) => window.postMessage({ yeppo: m }, location.origin);
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (d?.yeppo === "ping") {
    say("ext");
    chrome.storage.local.get("j7", (r) => r.j7 && j7(r.j7));
  }
  // the radar's "Connect J7": the extension reads J7's session (and opens J7 when the viewer isn't logged in)
  if (d?.yeppo === "j7-auto") chrome.runtime.sendMessage({ t: "j7connect" });
  if (d?.yeppo === "j7-off") chrome.runtime.sendMessage({ t: "j7off" });
  if (d?.yeppo !== "link") return;
  const set = {};
  if (typeof d.key === "string" && KEY.test(d.key)) set.key = d.key;
  if (Object.keys(set).length) chrome.storage.local.set(set, () => say("linked"));
});
say("ext");

const j7 = (t) => window.postMessage({ yeppo: "j7", token: t ?? null }, location.origin);
chrome.storage.local.get("j7", (r) => r.j7 && j7(r.j7));
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.j7) j7(ch.j7.newValue);
});
