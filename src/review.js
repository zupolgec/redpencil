// Review panel, loaded by review.py's pages, by the snippet on a site or by the Chrome extension.
// Select text (or, with "Comment on a block", click an image or a box) and write the comment;
// a number marks the spot, the panel on the right lists them.
(() => {
  if (document.getElementById("rv-side")) return;
  // where the review server is: set by the extension, otherwise the address this script came from
  const me = document.currentScript, cfg = window.__rv || {};
  const B = cfg.base || (me && me.src ? new URL(me.src).origin : location.origin);
  const SITE = B !== location.origin;  // a site served by something else
  // the page a comment belongs to: the path on a site, the file in the folder otherwise
  const pageOf = () => SITE ? location.pathname : decodeURIComponent(location.pathname).replace(/\/$/, "/index.html").replace(/^\//, "");
  let here = pageOf();
  let items = [], others = [], all = [], mode = false, hover = null, job = {};
  // interface text: English, Italian with review.py --lang it
  const L = {
    en: { comments: "Comments", runAll: "Work on all open comments", block: "Comment on a block (or right-click a spot)", blockShort: "Comment on a block",
      pick: "Click a spot on the page", close: "Close the panel", comment: "Comment", empty: "Select text on the page and press Comment. For an image or a box: right-click, or use the icon above.",
      reopen: "Reopen", resolve: "Mark resolved", runOne: "Work on this comment", resolved: "Resolved", edit: "Edit", del: "Delete", reply: "Reply", isResolved: "Resolved",
      more: "Show more", less: "Show less", working: "working", queued: "queued", placeholder: "What's wrong, what to change (Enter to save)",
      cancel: "Cancel", save: "Save", doneIn: "Done in", error: "Error", seeLog: "see agent.log", none: "No open comments", runSession: "Send the open comments to your agent session",
      otherPages: "On other pages", saveFailed: "Not saved: check that the review is still running, then try again",
      offline: "The review has stopped. Ask your agent to open it again: this page reconnects by itself.", stop: "Stop", noSession: "Send the open comments to your agent session (it isn't listening now)",
      deleted: "Comment deleted", undo: "Undo", area: "Mark an area of the page" },
    it: { comments: "Commenti", runAll: "Lavora tutti i commenti aperti", block: "Commenta un blocco (o clic destro su un punto)", blockShort: "Commenta un blocco",
      pick: "Tocca un punto della pagina", close: "Chiudi la barra", comment: "Commenta", empty: "Seleziona del testo nella pagina e premi Commenta. Per un'immagine o un riquadro: clic destro, o l'icona qui sopra.",
      reopen: "Riapri", resolve: "Segna risolto", runOne: "Lavora questo commento", resolved: "Risolti", edit: "Modifica", del: "Elimina", reply: "Risposta", isResolved: "Risolto",
      more: "Mostra tutto", less: "Mostra meno", working: "in lavorazione", queued: "in coda", placeholder: "Cosa non va, cosa cambiare (invio per salvare)",
      cancel: "Annulla", save: "Salva", doneIn: "Finito in", error: "Errore", seeLog: "vedi agent.log", none: "Nessun commento aperto", runSession: "Manda i commenti aperti alla tua sessione",
      otherPages: "In altre pagine", saveFailed: "Non salvato: controlla che la revisione sia ancora attiva e riprova",
      offline: "La revisione si è fermata. Chiedi al tuo agente di riaprirla: la pagina si ricollega da sola.", stop: "Ferma", noSession: "Manda i commenti aperti alla tua sessione (ora non è in ascolto)",
      deleted: "Commento eliminato", undo: "Annulla", area: "Segna una zona della pagina" },
  };
  const T = L[cfg.lang || (me && me.dataset.lang) || "en"] || L.en;
  const W = 320;
  // icone di Lucide (lucide.dev, licenza ISC)
  const ICONS = {
    add: '<path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 8v6"/><path d="M9 11h6"/>',
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    del: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    done: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    reopen: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    run: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
    spin: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>',
    area: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    close: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/>',
  };
  const ic = (n, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
  const css = `
  #rv-side{position:fixed;top:0;right:0;bottom:0;width:${W}px;z-index:99998;background:#fff;color:#111;border-left:1px solid #e5e7eb;box-shadow:-6px 0 24px rgba(0,0,0,.08);font:14px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .2s}
  html.rv-open #rv-side{transform:none}
  @media (min-width:900px){html.rv-open body{margin-right:${W}px!important}}
  #rv-side header{all:unset;display:flex;align-items:center;gap:6px;padding:12px 10px 12px 14px;border-bottom:1px solid #eee}
  #rv-side header button{padding:7px 8px}
  #rv-side header strong{flex:1;font-size:15px;white-space:nowrap}
  #rv-side button{font:inherit;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;background:#f3f4f6;color:#111;display:inline-grid;place-items:center}
  #rv-side button.on{background:#d97706;color:#fff}
  #rv-items{overflow:auto;flex:1;padding:6px 10px}
  #rv-items .it{display:grid;grid-template-columns:24px minmax(0,1fr);overflow-wrap:anywhere;gap:4px 8px;padding:10px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:8px}
  #rv-items .it:hover,#rv-items .it.act{background:#fff7ed}
  #rv-items .it.done{background:#f6faf7}
  #rv-items .it.done .t{color:#6b7280;text-decoration:line-through;text-decoration-color:#9ca3af}
  #rv-items .it .ok{color:#16a34a;display:grid;place-items:center;width:22px;height:22px}
  #rv-job{display:none;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #eee;font-size:13px;color:#374151;background:#fffbeb}
  #rv-job.on{display:flex}
  #rv-job.ok{background:#f0fdf4}
  #rv-job.err{background:#fef2f2}
  #rv-job span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #rv-undo{display:flex;align-items:center;justify-content:space-between;padding:6px 10px 6px 14px;border-bottom:1px solid #eee;font-size:13px;background:#f9fafb}
  #rv-undo[hidden]{display:none}
  #rv-undo button{background:none;color:#2563eb;padding:4px 6px}
  .rv-spin svg{animation:rv-spin 1s linear infinite}
  @keyframes rv-spin{to{transform:rotate(360deg)}}
  #rv-run{background:#d97706!important;color:#fff!important;gap:6px;grid-auto-flow:column;white-space:nowrap}
  #rv-run[disabled]{opacity:.6;cursor:default}
  #rv-items .it .ans{margin-top:6px;padding:2px 0 2px 9px;border-left:2px solid #93c5fd;color:#1e3a8a;font-size:13px}
  #rv-items .it .ans b{display:block;font:600 11px/1.6 system-ui,sans-serif;color:#64748b}
  #rv-items .it .ans p{margin:0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
  #rv-items .it .ans.full p{display:block}
  #rv-items .it .ans button.more{background:none;padding:2px 0 0;color:#2563eb;font-size:12px;display:none}
  #rv-items .it .ans.long button.more{display:inline}
  #rv-items .it [hidden]{display:none!important}
  #rv-items .it .st{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#b45309;margin-top:4px}
  #rv-items h5{margin:16px 4px 4px;font:700 11px/1 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#16a34a}
  #rv-items .acts button.res:hover{color:#16a34a}
  #rv-items .it small{color:#6b7280;display:block}
  #rv-items .it .q{font-style:italic}
  #rv-items .it img.shot{display:block;max-width:100%;max-height:120px;margin-top:6px;border:1px solid #e5e7eb;border-radius:6px}
  #rv-items .it .acts{grid-column:2;display:flex;gap:2px;margin-top:2px}
  #rv-items .it .acts button{background:none;padding:4px;border-radius:6px;color:#6b7280}
  #rv-items .it .acts button:hover{background:#f3f4f6;color:#111}
  #rv-items .it .acts button.run:hover{color:#d97706}
  #rv-items .it .acts button[disabled]{opacity:.35;cursor:default;background:none}
  #rv-items .it .acts button.del:hover{color:#b91c1c}
  #rv-items .empty{color:#6b7280;padding:12px 4px}
  #rv-items h5.op{color:#6b7280}
  #rv-items a.other{display:block;padding:8px 4px;border-bottom:1px solid #f0f0f0;color:#111;text-decoration:none;border-radius:8px;overflow-wrap:anywhere}
  #rv-items a.other:hover{background:#fff7ed}
  #rv-items a.other small{color:#6b7280;display:block}
  .rv-n{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#d97706;color:#fff;font:700 11px/1 system-ui,sans-serif;box-sizing:border-box}
  #rv-tab{position:fixed;right:0;top:50%;z-index:99997;transform:translateY(-50%);writing-mode:vertical-rl;font:600 13px/1 system-ui,sans-serif;border:0;border-radius:8px 0 0 8px;padding:14px 8px;background:#1f2937;color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  html.rv-open #rv-tab{display:none}
  #rv-pins{position:absolute;top:0;left:0;width:0;height:0;z-index:99996}
  #rv-pins .rv-n{position:absolute;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  #rv-pins .rv-area,#rv-draw .rv-rect{position:absolute;border:2px dashed #d97706;background:rgba(217,119,6,.08);box-sizing:border-box;pointer-events:none}
  #rv-draw{position:fixed;inset:0;z-index:99999;cursor:crosshair}
  #rv-dlg img{max-width:100%;max-height:160px;justify-self:start;border:1px solid #e5e7eb;border-radius:6px}
  ::highlight(rv){background:rgba(217,119,6,.25)}
  .rv-hover{outline:2px dashed #d97706!important;outline-offset:2px;cursor:crosshair!important}
  .rv-mark{outline:2px solid #d97706!important;outline-offset:3px;transition:outline-color .3s}
  #rv-dlg{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;font:15px/1.4 system-ui,sans-serif}
  #rv-dlg form{background:#fff;color:#111;width:min(520px,100%);border-radius:14px 14px 0 0;padding:16px;display:grid;gap:10px}
  #rv-dlg small{color:#6b7280}
  #rv-dlg .err{margin:0;color:#b91c1c;font-size:13px}
  #rv-dlg textarea{font:inherit;min-height:110px;padding:10px;border:1px solid #ccc;border-radius:8px}
  #rv-dlg .row{display:flex;gap:8px;justify-content:flex-end}
  #rv-dlg button{font:inherit;border:0;border-radius:8px;padding:9px 14px;cursor:pointer}
  #rv-dlg button[type=submit]{background:#d97706;color:#fff}
  #rv-dlg blockquote{margin:0;padding:6px 10px;border-left:3px solid #d97706;background:#fff7ed;color:#444;max-height:6em;overflow:auto}
  #rv-sel{position:absolute;z-index:99999;font:13px/1 system-ui,sans-serif;border:0;border-radius:999px;padding:8px 12px;background:#d97706;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;display:none}`;
  document.head.insertAdjacentHTML("beforeend", `<style id="rv-style">${css}</style>`);
  document.body.insertAdjacentHTML("beforeend", `
    <aside id="rv-side"><header><strong>${T.comments}</strong><button id="rv-run" type="button" title="${T.runAll}" aria-label="${T.runAll}">${ic("run")}</button><button id="rv-mode" type="button" title="${T.block}" aria-label="${T.blockShort}">${ic("add")}</button><button id="rv-area" type="button" title="${T.area}" aria-label="${T.area}">${ic("area")}</button><button id="rv-close" type="button" title="${T.close}" aria-label="${T.close}">${ic("close")}</button></header><div id="rv-job"></div><div id="rv-undo" hidden><span>${T.deleted}</span><button type="button">${T.undo}</button></div><div id="rv-items"></div></aside>
    <button id="rv-tab" type="button">${T.comments}</button>
    <div id="rv-pins"></div>
    <button id="rv-sel" type="button">${T.comment}</button>`);
  const $ = id => document.getElementById(id);
  const side = $("rv-side"), list = $("rv-items"), pins = $("rv-pins"), btnMode = $("rv-mode"), tab = $("rv-tab"), selBtn = $("rv-sel");
  const ours = el => !!el && [side, tab, pins, selBtn, $("rv-dlg")].some(x => x && x.contains(el));
  const isOurs = n => n.nodeType === 1 && /^rv-/.test(n.id);
  const setOpen = on => { document.documentElement.classList.toggle("rv-open", on); setTimeout(() => place(), 250); };
  $("rv-close").onclick = () => setOpen(false);
  tab.onclick = () => setOpen(true);
  if (window.innerWidth >= 900) setOpen(true);

  const path = el => {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      if (el.id) { parts.unshift("#" + CSS.escape(el.id)); break; }
      const i = [...el.parentNode.children].filter(c => c.tagName === el.tagName).indexOf(el) + 1;
      parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${i})`);
      el = el.parentElement;
    }
    return parts.join(" > ");
  };
  const section = el => {
    const s = el.closest("section, header, footer");
    const h = s && s.querySelector("h1, h2");
    return (h ? h.textContent : s ? (s.id || s.tagName.toLowerCase()) : "").trim().slice(0, 80);
  };
  const label = el => {
    const t = (el.getAttribute("alt") || el.textContent || "").replace(/\s+/g, " ").trim();
    return `${el.tagName.toLowerCase()}: "${t.slice(0, 90)}${t.length > 90 ? "…" : ""}"`;
  };
  const find = c => { try { return document.querySelector(c.selector); } catch { return null; } };

  // the quoted text inside the element, as a Range (whitespace normalized), without touching the DOM
  const rangeOf = (el, quote) => {
    if (!el || !quote) return null;
    const map = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let text = "", n;
    while ((n = tw.nextNode())) {
      for (let i = 0; i < n.data.length; i++) {
        const ch = /\s/.test(n.data[i]) ? " " : n.data[i];
        if (ch === " " && text.endsWith(" ")) continue;
        text += ch; map.push([n, i]);
      }
    }
    const at = text.indexOf(quote);
    if (at < 0) return null;
    const a = map[at], b = map[at + quote.length - 1];
    const r = document.createRange();
    r.setStart(a[0], a[1]); r.setEnd(b[0], b[1] + 1);
    return r;
  };

  const flash = el => { el.classList.add("rv-mark"); setTimeout(() => el.classList.remove("rv-mark"), 1800); };
  const go = i => {
    const c = items[i], el = find(c);
    list.querySelectorAll(".it").forEach(d => d.classList.toggle("act", +d.dataset.i === i));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    flash(el);
  };

  // numbers next to the commented spots
  const nums = () => { let n = 0; return items.map(c => (c.done ? 0 : ++n)); };
  const place = () => {
    pins.innerHTML = "";
    const num = nums();
    const ranges = [];
    items.forEach((c, i) => {
      if (c.done) return;
      const el = find(c);
      if (!el) return;
      const r = !c.area && rangeOf(el, c.quote);
      if (r) ranges.push(r);
      let box = (r || el).getBoundingClientRect();
      if (c.area) {  // the box the user drew, which follows its element
        const a = c.area, d = document.createElement("div");
        box = { left: box.left + a.x, top: box.top + a.y, right: box.left + a.x + a.w, width: a.w, height: a.h };
        d.className = "rv-area";
        Object.assign(d.style, { left: `${scrollX + box.left}px`, top: `${scrollY + box.top}px`, width: `${a.w}px`, height: `${a.h}px` });
        pins.appendChild(d);
      }
      if (!box.width && !box.height) return;
      const p = document.createElement("span");
      p.className = "rv-n"; p.textContent = num[i]; p.title = c.text;
      const maxX = document.documentElement.clientWidth - 30;
      p.style.left = `${window.scrollX + Math.min(box.right - 6, maxX)}px`;
      p.style.top = `${window.scrollY + box.top - 14}px`;
      p.onclick = () => { setOpen(true); go(i); };
      pins.appendChild(p);
    });
    if (window.CSS && CSS.highlights) CSS.highlights.set("rv", new Highlight(...ranges));
  };
  let wide = window.innerWidth >= 900;
  addEventListener("resize", () => {
    const now = window.innerWidth >= 900;
    if (now !== wide) { wide = now; setOpen(now); }  // on a phone the panel starts closed
    clearTimeout(place.t); place.t = setTimeout(place, 150);
  });
  addEventListener("load", place);

  const mine = c => !c.page || c.page === here;
  const refresh = () => fetch(B + "/__comments").then(r => r.json()).then(d => {
    all = d; items = d.filter(mine); others = d.filter(c => !mine(c) && !c.done); render();
  });
  // only the action is sent, so nothing the agent just recorded gets overwritten
  const persist = op => fetch(B + "/__comment", { method: "POST", body: JSON.stringify(op) })
    .then(r => { if (!r.ok) throw new Error(r.status); return refresh(); });
  const render = () => {
    const open = items.filter(c => !c.done).length + others.length;
    side.querySelector("strong").textContent = `${T.comments} (${open})`;
    tab.textContent = `${T.comments} (${open})`;
    list.innerHTML = items.length || others.length ? "" : `<div class="empty">${T.empty}</div>`;
    const num = nums();
    const row = (c, i) => {
      const d = document.createElement("div");
      d.className = "it" + (c.done ? " done" : "");
      d.dataset.i = i;
      if (c.id) d.dataset.id = c.id;
      const res = c.done
        ? `<button class="res" type="button" title="${T.reopen}" aria-label="${T.reopen}">${ic("reopen", 16)}</button>`
        : `<button class="res" type="button" title="${T.resolve}" aria-label="${T.resolve}">${ic("check", 16)}</button>`;
      const run = !c.done && c.id
        ? `<button class="run" type="button" title="${T.runOne}" aria-label="${T.runOne}"${job.state === "working" ? " disabled" : ""}>${ic("run", 16)}</button>` : "";
      d.innerHTML = `${c.done ? `<span class="ok" title="${T.isResolved}">${ic("done", 20)}</span>` : `<span class="rv-n"></span>`}<div><small></small><small class="q"></small><div class="t"></div>${c.shot && c.id ? `<img class="shot" alt="" crossorigin="anonymous" src="${B}/__shot/${encodeURIComponent(c.id)}">` : ""}<div class="ans" hidden></div><div class="st" hidden></div></div><div class="acts">${run}${res}<button class="edit" type="button" title="${T.edit}" aria-label="${T.edit}">${ic("edit", 16)}</button><button class="del" type="button" title="${T.del}" aria-label="${T.del}">${ic("del", 16)}</button></div>`;
      if (!c.done) d.querySelector(".rv-n").textContent = num[i];
      d.querySelector("small").textContent = c.section || "";
      d.querySelector(".q").textContent = c.quote ? `"${c.quote.slice(0, 90)}${c.quote.length > 90 ? "…" : ""}"` : "";
      d.querySelector(".t").textContent = c.text;
      if (c.reply) {
        const a = d.querySelector(".ans"); a.hidden = false;
        a.innerHTML = `<b>${T.reply}</b><p></p><button class="more" type="button">${T.more}</button>`;
        a.querySelector("p").textContent = c.reply;
      }
      if (c.status === "working") { const st = d.querySelector(".st"); st.hidden = false; st.className = "st rv-spin"; st.innerHTML = `${ic("spin", 12)} ${T.working}`; }
      if (c.status === "queued" && !c.done) { const st = d.querySelector(".st"); st.hidden = false; st.innerHTML = `${ic("clock", 12)} ${T.queued}`; }
      d.onclick = e => {
        const b = e.target.closest("button");
        if (b && b.classList.contains("del")) { deleted(c); items.splice(i, 1); persist({ action: "delete", id: c.id }).catch(refresh); return; }
        if (b && b.classList.contains("res")) { c.done = !c.done; persist({ action: "resolve", id: c.id, done: c.done }).catch(refresh); return; }
        if (b && b.classList.contains("edit")) { go(i); ask(find(c) || document.body, c.quote, c.id); return; }
        if (b && b.classList.contains("run")) { start([c.id]); return; }
        if (b && b.classList.contains("more")) { const a = b.parentElement; a.classList.toggle("full"); b.textContent = a.classList.contains("full") ? T.less : T.more; return; }
        go(i);
      };
      list.appendChild(d);
      const p = d.querySelector(".ans p");
      if (p && p.scrollHeight > p.clientHeight + 2) d.querySelector(".ans").classList.add("long");
    };
    items.forEach((c, i) => { if (!c.done) row(c, i); });
    if (others.length) {  // open comments on the other pages of the site: a click takes you there
      list.insertAdjacentHTML("beforeend", `<h5 class="op">${T.otherPages} (${others.length})</h5>`);
      others.forEach(c => {
        const a = document.createElement("a");
        a.className = "other"; a.href = SITE ? c.page : "/" + c.page;
        a.innerHTML = "<small></small><span></span>";
        a.querySelector("small").textContent = c.page;
        a.querySelector("span").textContent = c.text;
        list.appendChild(a);
      });
    }
    const done = items.filter(c => c.done).length;
    if (done) {
      list.insertAdjacentHTML("beforeend", `<h5>${T.resolved} (${done})</h5>`);
      items.forEach((c, i) => { if (c.done) row(c, i); });
    }
    place();
  };

  // a deleted comment can come back for a few seconds
  const undoEl = $("rv-undo");
  const deleted = c => {
    const at = all.findIndex(x => x.id === c.id);
    undoEl.hidden = false;
    clearTimeout(deleted.t); deleted.t = setTimeout(() => { undoEl.hidden = true; }, 8000);
    undoEl.querySelector("button").onclick = () => { undoEl.hidden = true; persist({ action: "restore", comment: c, at }); };
  };

  let dlgSel = "";  // the commented spot, to find it again when the page updates
  const ask = (el, quote = "", id = null, area = null, shot = null) => {
    const meta = { section: section(el), element: label(el), selector: path(el), quote, ...(area ? { area } : {}) };
    const cur = () => items.find(c => c.id === id);
    const idx = id ? 0 : -1;
    dlgSel = meta.selector;
    el.classList.add("rv-mark");
    document.body.insertAdjacentHTML("beforeend",
      `<div id="rv-dlg"><form><small></small><textarea placeholder="${T.placeholder}"></textarea><div class="row"><button type="button">${T.cancel}</button><button type="submit">${T.save}</button></div></form></div>`);
    const dlg = $("rv-dlg"), ta = dlg.querySelector("textarea");
    if (idx >= 0) ta.value = cur().text;
    dlg.querySelector("small").textContent = idx >= 0 ? cur().section : quote ? meta.section : meta.element;
    if (quote) {
      const q = document.createElement("blockquote");
      q.textContent = quote;
      dlg.querySelector("small").after(q);
    }
    if (shot) { const im = document.createElement("img"); im.src = shot; im.alt = ""; dlg.querySelector("small").after(im); }
    // what is being written survives a reload or a crash of the page
    const keep = () => sessionStorage.setItem("rv-draft", JSON.stringify({ page: here, selector: meta.selector, quote, id, area, text: ta.value }));
    ta.addEventListener("input", keep);
    const close = () => {
      sessionStorage.removeItem("rv-draft");
      dlg.remove(); dlgSel = "";
      document.querySelectorAll(".rv-mark").forEach(m => m.classList.remove("rv-mark"));
      if (pending) pending();
    };
    // Enter saves, Shift+Enter adds a line, Esc closes
    ta.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); dlg.querySelector("form").requestSubmit(); }
      if (e.key === "Escape") close();
    });
    dlg.querySelector("button[type=button]").onclick = close;
    // the dialog stays open until the comment is saved: nothing gets lost if the server is down
    dlg.querySelector("form").onsubmit = e => {
      e.preventDefault();
      const t = ta.value.trim();
      let op = null;
      if (idx >= 0) { if (t && cur()) op = { action: "edit", id, text: t }; }
      else if (t) op = { action: "add", ...meta, text: t, page: here, ...(shot ? { shot } : {}) };
      if (!op) return close();
      persist(op).then(close, () => {
        let err = dlg.querySelector(".err");
        if (!err) { err = document.createElement("p"); err.className = "err"; ta.after(err); }
        err.textContent = T.saveFailed;
      });
    };
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  };

  // comment on a whole block (images, boxes)
  document.addEventListener("mouseover", e => {
    if (!mode || ours(e.target)) return;
    hover && hover.classList.remove("rv-hover");
    hover = e.target; hover.classList.add("rv-hover");
  });
  document.addEventListener("click", e => {
    if (!mode || ours(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    hover && hover.classList.remove("rv-hover");
    setMode(false);
    ask(e.target);
  }, true);
  const setMode = on => {
    mode = on;
    btnMode.classList.toggle("on", on);
    btnMode.title = on ? T.pick : T.block;
  };
  btnMode.onclick = () => setMode(!mode);

  // a box dragged over the page; with the extension, a screenshot of it goes with the comment
  const shoot = () => new Promise(done => {
    if (window.chrome && chrome.runtime && chrome.runtime.id) return chrome.runtime.sendMessage({ shot: true }, u => done(u || null));
    if (!document.documentElement.dataset.rvBridge) return done(null);  // no extension on this page
    const id = Math.random().toString(36).slice(2);
    const on = e => {
      if (e.source !== window || !e.data || e.data.rv !== "shot-done" || e.data.id !== id) return;
      removeEventListener("message", on); done(e.data.url || null);
    };
    addEventListener("message", on);
    postMessage({ rv: "shot", id }, "*");
    setTimeout(() => { removeEventListener("message", on); done(null); }, 3000);
  });
  const crop = (url, box) => new Promise(done => {
    const im = new Image();
    im.onload = () => {
      const k = im.width / innerWidth, cv = document.createElement("canvas");
      cv.width = Math.round(box.width * k); cv.height = Math.round(box.height * k);
      cv.getContext("2d").drawImage(im, box.left * k, box.top * k, cv.width, cv.height, 0, 0, cv.width, cv.height);
      done(cv.toDataURL("image/png"));
    };
    im.onerror = () => done(null);
    im.src = url;
  });
  const frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  $("rv-area").onclick = () => {
    setMode(false);
    document.body.insertAdjacentHTML("beforeend", '<div id="rv-draw"></div>');
    const ov = $("rv-draw");
    let r = null, x0 = 0, y0 = 0;
    const quit = e => { if (e.key === "Escape") { ov.remove(); removeEventListener("keydown", quit); } };
    addEventListener("keydown", quit);
    ov.onmousedown = e => { x0 = e.clientX; y0 = e.clientY; r = document.createElement("div"); r.className = "rv-rect"; ov.appendChild(r); };
    ov.onmousemove = e => {
      if (!r) return;
      Object.assign(r.style, { left: `${Math.min(x0, e.clientX)}px`, top: `${Math.min(y0, e.clientY)}px`,
        width: `${Math.abs(e.clientX - x0)}px`, height: `${Math.abs(e.clientY - y0)}px` });
    };
    ov.onmouseup = async () => {
      removeEventListener("keydown", quit);
      const box = r && r.getBoundingClientRect();
      ov.remove();
      if (!box || box.width < 4 || box.height < 4) return;
      let el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!el || ours(el)) el = document.body;
      const eb = el.getBoundingClientRect();
      const area = { x: Math.round(box.left - eb.left), y: Math.round(box.top - eb.top), w: Math.round(box.width), h: Math.round(box.height) };
      await frames();  // the box is gone from the screen before the screenshot
      const url = await shoot();
      ask(el, "", null, area, url && await crop(url, box));
    };
  };

  // right click: comment on the selected text, otherwise on the spot clicked
  document.addEventListener("contextmenu", e => {
    if (ours(e.target) || $("rv-dlg")) return;
    e.preventDefault();
    setMode(false);
    hover && hover.classList.remove("rv-hover");
    selBtn.style.display = "none";
    const sel = window.getSelection();
    const t = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, " ").trim() : "";
    if (t) {
      const node = sel.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      sel.removeAllRanges();
      if (el && !ours(el)) return ask(el, t);
    }
    ask(e.target);
  });

  // selecting text shows "Comment" next to the selection
  let selQuote = "", selEl = null;
  const onSelection = () => {
    const sel = window.getSelection();
    const t = sel && !sel.isCollapsed ? sel.toString().replace(/\s+/g, " ").trim() : "";
    const node = t && sel.getRangeAt(0).commonAncestorContainer;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!t || !el || ours(el)) { selBtn.style.display = "none"; return; }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    selQuote = t; selEl = el;
    selBtn.style.display = "block";
    selBtn.style.top = `${window.scrollY + rect.bottom + 8}px`;
    selBtn.style.left = `${Math.max(8, Math.min(window.scrollX + rect.left, window.scrollX + document.documentElement.clientWidth - selBtn.offsetWidth - 8))}px`;
  };
  document.addEventListener("selectionchange", () => { clearTimeout(onSelection.t); onSelection.t = setTimeout(onSelection, 250); });
  selBtn.addEventListener("mousedown", e => e.preventDefault());
  selBtn.onclick = () => {
    selBtn.style.display = "none";
    const quote = selQuote, el = selEl;
    window.getSelection().removeAllRanges();
    if (el) ask(el, quote);
  };

  const draft = () => {
    const d = JSON.parse(sessionStorage.getItem("rv-draft") || "null");
    if (!d || d.page !== here || $("rv-dlg")) return;
    let el = null;
    try { el = document.querySelector(d.selector); } catch {}
    ask(el || document.body, d.quote, d.id, d.area);
    $("rv-dlg").querySelector("textarea").value = d.text;
  };

  const jobEl = $("rv-job"), runBtn = $("rv-run");
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const showJob = j => {
    const running = j.state === "working";
    if (running !== (job.state === "working")) { job = j; render(); }
    job = j;
    runBtn.innerHTML = running ? ic("stop") : ic("run");
    runBtn.disabled = false;
    jobEl.className = j.state === "idle" && !j.last ? "" : "on" + (j.state === "done" ? " ok" : j.state === "error" ? " err" : "");
    const t = j.seconds != null ? mmss(j.seconds) : "";
    jobEl.innerHTML = running ? `<b class="rv-spin">${ic("spin", 14)}</b><span></span>` : "<span></span>";
    jobEl.querySelector("span").textContent =
      running ? `${t || "0:00"} · ${j.last || ""}` :
      j.state === "done" ? `${T.doneIn} ${t}` :
      j.state === "error" ? `${T.error} (${j.last || T.seeLog})` : j.last || "";
    runBtn.title = runBtn.ariaLabel = running ? T.stop : j.session ? T.runSession : j.agent ? T.runAll : T.noSession;
  };

  // live update: when a file of the page changes the content is replaced, keeping
  // the panel, an open dialog and the scroll position; changed images reload
  let pending = null, seen = null, base = null, vers = {};
  const reloadSoon = () => {
    if ($("rv-dlg")) { pending = reloadSoon; return; }
    sessionStorage.setItem("rv-scroll", JSON.stringify([scrollX, scrollY]));
    location.reload();
  };
  const back = sessionStorage.getItem("rv-scroll");
  if (back) { sessionStorage.removeItem("rv-scroll"); addEventListener("load", () => scrollTo(...JSON.parse(back))); }
  const page = decodeURIComponent(location.pathname).replace(/\/$/, "/index.html").replace(/^\//, "");
  const fresh = () => {  // images and stylesheets changed since opening, with ?v= to skip the cache
    const rel = u => { try { const x = new URL(u, location.href); return x.origin === location.origin ? decodeURIComponent(x.pathname.slice(1)) : null; } catch { return null; } };
    const bump = (el, attr) => {
      const v = el.getAttribute(attr);
      if (!v || /^data:/.test(v)) return;
      const out = v.split(",").map(part => {
        const [u, ...rest] = part.trim().split(/\s+/);
        const f = rel(u);
        if (!f || !(f in vers) || vers[f] === base[f]) return part;
        const x = new URL(u, location.href);
        x.searchParams.set("v", vers[f]);
        return [x.pathname + x.search + x.hash, ...rest].join(" ");
      }).join(", ");
      if (out !== v) el.setAttribute(attr, out);
    };
    document.querySelectorAll("img[src], source[src], video[src], video[poster], link[rel=stylesheet][href]").forEach(el =>
      ["src", "poster", "href"].forEach(a => el.hasAttribute(a) && bump(el, a)));
    document.querySelectorAll("img[srcset], source[srcset]").forEach(el => bump(el, "srcset"));
  };
  const swap = html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll('script[src$="/__review.js"]').forEach(n => n.remove());
    // pages that build themselves: reload them instead (scripts that are only data don't count)
    if ([...doc.scripts].some(s => !s.type || /^(module|(text|application)\/(java|ecma)script)$/i.test(s.type))) return reloadSoon();
    const x = scrollX, y = scrollY;
    const oldHead = [...document.head.childNodes].filter(n => !isOurs(n));
    if (oldHead.map(n => n.outerHTML || n.textContent).join("") !== [...doc.head.childNodes].map(n => n.outerHTML || n.textContent).join("")) {
      const mine = $("rv-style");
      [...doc.head.childNodes].forEach(n => document.head.insertBefore(document.importNode(n, true), mine));
      oldHead.forEach(n => n.remove());
    }
    [...document.body.attributes].forEach(a => a.name !== "style" && document.body.removeAttribute(a.name));
    [...doc.body.attributes].forEach(a => document.body.setAttribute(a.name, a.value));
    const anchor = side;
    [...document.body.childNodes].filter(n => !isOurs(n)).forEach(n => n.remove());
    [...doc.body.childNodes].forEach(n => document.body.insertBefore(document.importNode(n, true), anchor));
    fresh();
    if (dlgSel) { try { const m = document.querySelector(dlgSel); m && m.classList.add("rv-mark"); } catch {} }
    scrollTo(x, y);
    place();
    document.querySelectorAll("img").forEach(im => !im.complete && im.addEventListener("load", () => { scrollTo(x, scrollY); place(); }, { once: true }));
  };
  // on a site files and addresses don't match: when the source changes the page is fetched
  // again and replaced if it differs, and the stylesheets reload
  let last = null;
  const again = () => fetch(location.href, { cache: "no-store", credentials: "include" }).then(r => r.text());
  // tokens that change at every request (Laravel's csrf, nonces) are not changes
  const norm = h => h.replace(/(<meta[^>]+name=["']csrf-token["'][^>]*content=)("[^"]*"|'[^']*')/gi, "$1")
    .replace(/\s(nonce|value)=("[^"]*"|'[^']*')/gi, "");
  const siteUpdate = first => again().then(html => {
    if (first) { last = html; return; }
    if (norm(html) !== norm(last)) { last = html; return swap(html); }
    document.querySelectorAll("link[rel=stylesheet][href]").forEach(l => {
      const u = new URL(l.href);
      if (u.origin === location.origin) { u.searchParams.set("v", seen); l.href = u.href; }
    });
  });
  // a dev server with live reload (Vite, Next...) updates the page by itself: leave it alone
  const hmr = () => !!document.querySelector('script[src*="/@vite/client"], script[src*="/_next/"], script#__NEXT_DATA__, script[src*="webpack-dev-server"]');
  const update = () => fetch(B + "/__versions").then(r => r.json()).then(v => {
    const changed = Object.keys(v).filter(f => v[f] !== vers[f]);
    vers = v;
    if (base && hmr()) { setTimeout(place, 800); return; }
    if (SITE) return siteUpdate(!base).then(() => { base = base || v; });
    if (!base) { base = v; return; }
    if (changed.some(f => f === page || /\.css$/.test(f))) return fetch(location.pathname, { cache: "no-store" }).then(r => r.text()).then(swap);
    fresh();
  });
  const poll = () => fetch(B + "/__status").then(r => r.json()).then(j => {
    const wasRunning = job.state === "working";
    if (pageOf() !== here) { here = pageOf(); last = null; base = null; seen = null; poll.seen = null; }  // moved without loading a page
    showJob(j);
    if (j.state === "working" || wasRunning || j.comments !== poll.seen) { poll.seen = j.comments; refresh(); }
    const next = () => setTimeout(poll, j.state === "working" ? 1500 : 3000);
    if (j.version !== seen) { seen = j.version; return update().then(next, next); }
    next();
  }).catch(() => {  // the server is gone: say so, and keep trying
    job = {}; runBtn.innerHTML = ic("run"); runBtn.disabled = true; jobEl.className = "on err"; jobEl.innerHTML = "<span></span>"; jobEl.querySelector("span").textContent = T.offline;
    setTimeout(poll, 3000);
  });
  const start = ids => {
    if (!items.some(c => !c.done) && !others.length) return showJob({ state: "idle", last: T.none });
    const body = ids ? JSON.stringify({ ids }) : undefined;
    fetch(B + "/__work", { method: "POST", body }).then(r => r.json()).then(j => { showJob(j); refresh(); });
  };
  runBtn.onclick = () => job.state === "working"
    ? fetch(B + "/__stop", { method: "POST" }).then(r => r.json()).then(j => { showJob(j); refresh(); })
    : start();
  refresh().then(draft); poll();
})();
