// On review pages served by review.py (127.0.0.1) the panel is not part of the extension:
// it asks for screenshots through here.
document.documentElement.dataset.rvBridge = "1";
addEventListener("message", e => {
  if (e.source !== window || !e.data || e.data.rv !== "shot") return;
  chrome.runtime.sendMessage({ shot: true }, url => postMessage({ rv: "shot-done", id: e.data.id, url }, "*"));
});
