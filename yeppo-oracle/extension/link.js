// On yeppo.it only: the site hands the extension a Pro key (after a payment, or a key checked on the pricing page)
// or a paper wallet, so nothing has to be pasted. Only this page's own messages count, and only well-formed values.
const KEY = /^YEP-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/;
const ID = /^[0-9a-f-]{36}$/;
const say = (m) => window.postMessage({ yeppo: m }, location.origin);
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (d?.yeppo === "ping") say("ext");
  if (d?.yeppo !== "link") return;
  const set = {};
  if (typeof d.key === "string" && KEY.test(d.key)) set.key = d.key;
  if (typeof d.paper === "string" && ID.test(d.paper)) set.paper = d.paper;
  if (Object.keys(set).length) chrome.storage.local.set(set, () => say("linked"));
});
say("ext");
