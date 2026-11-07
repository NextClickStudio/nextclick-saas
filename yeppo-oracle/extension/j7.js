// On j7tracker.io only: tells yeppo's extension the viewer opened J7, so it reads J7's session cookie (when the viewer
// asked yeppo to connect J7). Nothing on the page is read or changed.
try {
  chrome.runtime.sendMessage({ t: "j7grab" });
} catch {
  /* the extension was reloaded */
}
