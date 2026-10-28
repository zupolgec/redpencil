// The panel goes only on the sites the user turned on with the icon. On those, each page asks
// for the review server of the site (review.py --site listens on a port derived from the site's
// address) and, if it is running, gets the panel.
const portFor = async host => {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(host)));
  const p = 4400 + Number(BigInt("0x" + [...h].map(b => b.toString(16).padStart(2, "0")).join("")) % 1500n);
  return p === 5060 || p === 5061 ? p + 2 : p;  // browsers refuse them
};
const badge = (tabId, text) => chrome.action.setBadgeText({ tabId, text });
const idFor = origin => "review " + origin;

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg === "review" && sender.tab && sender.frameId === 0) attach(sender.tab.id, new URL(sender.url).host);
  if (msg && msg.shot && sender.tab && sender.tab.active) {  // a screenshot of the page asking, only if it is on screen
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }).then(reply, () => reply(null));
    return true;
  }
});

async function attach(tabId, host) {
  const base = `http://127.0.0.1:${await portFor(host)}`;
  let j;
  try { j = await (await fetch(base + "/__status")).json(); } catch { return badge(tabId, "off"); }
  if (j.site !== host) return badge(tabId, "off");  // no review for this site on that port
  const target = { tabId };
  await chrome.scripting.executeScript({ target, func: (base, lang) => { window.__rv = { base, lang }; }, args: [base, j.lang] });
  await chrome.scripting.executeScript({ target, files: ["review.js"] });
  badge(tabId, "on");
}

// turns a site on: from now on its pages look for their review
async function enable(origin) {
  await chrome.scripting.registerContentScripts([{ id: idFor(origin), matches: [origin + "/*"], js: ["content.js"], runAt: "document_idle" }]);
}

chrome.action.onClicked.addListener(async tab => {
  const origin = new URL(tab.url).origin;
  // asked first, while it is still the user's click (no prompt if already granted). Chrome allows
  // screenshots of a tab only with access to all sites; the panel still goes only where turned on
  if (!(await chrome.permissions.request({ origins: ["<all_urls>"] }))) return;
  const on = (await chrome.scripting.getRegisteredContentScripts({ ids: [idFor(origin)] })).length;
  if (on) await chrome.scripting.unregisterContentScripts({ ids: [idFor(origin)] });
  else await enable(origin);
  chrome.tabs.reload(tab.id);
});
