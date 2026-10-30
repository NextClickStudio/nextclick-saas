// On yeppo.it/lab only: the owner's lab page hands its lab key and paper wallet to the extension with one click,
// so paper trading turns on in the side panel and the card without pasting anything.
const say = (m) => window.postMessage({ yeppo: m }, location.origin);
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (d?.yeppo === "ping") say("ext");
  if (d?.yeppo === "link" && typeof d.lab === "string" && typeof d.paper === "string" && d.lab && d.paper)
    chrome.storage.local.set({ lab: d.lab, paper: d.paper }, () => say("linked"));
});
say("ext");
