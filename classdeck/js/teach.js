/* ============================================================
   ADEWALE CLASSROOM DECK — Teacher Studio controller
   • Dual-pane app loader (whiteboard / pdf / web / notes / image)
   • Resizable split, layout cycling, pane swap
   • Composite broadcaster: draws both panes onto one canvas and
     streams it (canvas.captureStream) to every student — students
     always see the FULL split-screen, like a laptop share.
   • Live classroom: roster, student cams, chat, polls, attendance,
     announcements, lock, kick, recording, timer.
   ============================================================ */

/* ============================================================================
   V38 NULL-SAFE DOM BINDING  (bugfix — see BUG-REPORT-CLASSDECK.md)
   ----------------------------------------------------------------------------
   ROOT CAUSE THIS SOLVES
   teach.js is one long top-level script. It bound ~91 listeners with the
   pattern  on("#id", ...)  and NO null check. teach.html had
   drifted away from the JS: #timerStartCustom (and 35 other selectors) no
   longer existed. So at line ~1824 $("#timerStartCustom") returned null and
   the whole file died with:

       TypeError: Cannot read properties of null (reading 'addEventListener')

   Because a top-level throw aborts the ENTIRE remaining script, every
   `const` declared after that point was left permanently uninitialised in
   the Temporal Dead Zone, and every listener below it was never attached.
   That single line produced ALL of the reported symptoms:

     • "Cannot access 'securityAudit' before initialization"  (const @3494)
       -> thrown by Go Live / End / PiP, which log to the security audit.
     • "Cannot access 'studioEl' before initialization"       (const @2231)
       -> thrown by Focus / Fullscreen.
     • Rec icon does nothing            -> listener @1877 never bound.
     • Calculator shows display but no keypad -> renderCalcKeys @2772 and the
       btnCalc listener @2808 never ran, so #calcKeys stayed empty.
     • Swap / Layout icons dead         -> applyLayout() reads TDZ bindings.
     • ~20 further toolbar icons dead   -> all bound after the abort point.

   THE FIX
   on() binds only when the element exists and never throws. A missing
   element is now a one-line console warning instead of a fatal error that
   takes the other 20 features down with it. This makes future markup drift
   degrade gracefully instead of catastrophically.
   ========================================================================== */
function on(sel, ev, fn, opts) {
  var el = (typeof sel === "string") ? $(sel) : sel;
  if (!el) {
    if (!on._warned) on._warned = {};
    if (!on._warned[sel]) {
      on._warned[sel] = 1;
      console.warn("[deck] skipped binding " + ev + " — no element matches " + sel);
    }
    return null;
  }
  el.addEventListener(ev, fn, opts);
  return el;
}
window.on = on;
"use strict";

/* V37 — hoist mutable live-class state to the top of the file so no handler
   (Focus, Fullscreen, End, PiP, Rec, captions, composite) can hit a TDZ
   "Cannot access before initialization" error. Values are the same defaults
   as the original later declarations. */
var room = null;
var lastEndedRoom = null;
var micStream = null, camStream = null;
var micOn = false, camOn = false;
var stageStream = null;
var classStartTs = 0, classTickInt = null;
var recorder = null, recChunks = [], recStream = null;
var focusOn = false;
var capRec = null, capOn = false, capLines = [];
var pipVideo = null, pipStream = null, pipPump = null, pipActive = false;
var tabletLive = { pc: null, stream: null, resource: "", gateway: "", streamName: "classdeck", format: "landscape", raf: null, canvas: null, ownsComposite: false };
var lastPrivatePeer = null;


/* ------------------------------------------------------------
   0. PDF.js worker
   ------------------------------------------------------------ */
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}

/* ------------------------------------------------------------
   1. Pane / app management
   ------------------------------------------------------------ */
const APPS = ["board", "pdf", "web", "notes", "image", "graph", "video", "toolkit", "flash", "stopwatch"];
function storedApp(key, fallback) {
  const value = Store.get(key, fallback);
  return APPS.includes(value) ? value : fallback;
}
const paneState = {
  L: { app: storedApp("pane_L", "board"), instances: {} },
  R: { app: storedApp("pane_R", "pdf"),   instances: {} }
};
let layoutMode = Store.get("layout", "split"); // split | left | right
if (!["split", "left", "right"].includes(layoutMode)) layoutMode = "split";

const bodyEls = { L: $("#bodyL"), R: $("#bodyR") };

function mountApp(side, app) {
  const st = paneState[side];
  if (!st || !bodyEls[side]) return;
  app = APPS.includes(app) ? app : (side === "L" ? "board" : "pdf");
  st.app = app;
  Store.set("pane_" + side, app);

  // hide all existing app sections in this pane
  $$("#body" + side + " > section").forEach((s) => s.classList.remove("active"));

  let inst = st.instances[app];
  if (!inst) {
    const tpl = $("#tpl-" + app);
    const node = tpl.content.firstElementChild.cloneNode(true);
    bodyEls[side].appendChild(node);
    inst = { el: node };
    st.instances[app] = inst;
    initApp(side, app, inst);
  }
  inst.el.classList.add("active");

  // tab highlight
  $$('.pane-head[data-pane="' + side + '"] .tab').forEach((t) =>
    t.classList.toggle("active", t.dataset.app === app));

  if (app === "board" && inst.wb) setTimeout(() => inst.wb.resize(), 60);
  if (app === "pdf" && inst.renderPage) setTimeout(() => inst.renderPage(), 60);
}

$$(".pane-head .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const side = tab.closest(".pane-head").dataset.pane;
    mountApp(side, tab.dataset.app);
  });
});

/* ------------------------------------------------------------
   2. App initialisers
   ------------------------------------------------------------ */
function initApp(side, app, inst) {
  if (app === "board") initBoard(side, inst);
  else if (app === "pdf") initPdf(side, inst);
  else if (app === "web") initWeb(side, inst);
  else if (app === "notes") initNotes(side, inst);
  else if (app === "image") initImage(side, inst);
  else if (app === "graph") initGraph(side, inst);   // v4
  else if (app === "video") initVideo(side, inst);   // v4
  else if (app === "toolkit") initToolkit(side, inst); // v5
  else if (app === "flash") initFlash(side, inst);       // v6
  else if (app === "stopwatch") initStopwatch(side, inst); // v6
}

/* ---- v6: flashcards pane ---- */
function initFlash(side, inst) {
  const el = inst.el;
  const defaultCards = [["Photosynthesis", "The process by which green plants make their own food using sunlight, water and carbon dioxide."], ["7 × 8", "56"], ["Capital of Nigeria", "Abuja"]];
  const savedCards = Store.get("flashcards", defaultCards);
  let cards = Array.isArray(savedCards) ? savedCards.filter((card) => Array.isArray(card) && card.length >= 2 && card[0] && card[1]).map((card) => [String(card[0]), String(card[1])]) : defaultCards;
  let idx = 0, front = true;
  const textEl = $(".fc-text", el), posEl = $(".fc-pos", el), cardEl = $(".fc-card", el);
  inst.getFlashState = () => ({ text: textEl.textContent, front, pos: posEl.textContent });
  function render() {
    if (!cards.length) { textEl.textContent = "Tap ✏ Edit cards to add your flashcards"; posEl.textContent = "0 / 0"; return; }
    idx = ((idx % cards.length) + cards.length) % cards.length;
    textEl.textContent = front ? cards[idx][0] : cards[idx][1];
    cardEl.style.background = front ? "#fff" : "#fff8e1";
    cardEl.style.borderColor = front ? "#1e2a78" : "#f59e0b";
    posEl.textContent = (idx + 1) + " / " + cards.length + (front ? "" : "  (answer)");
  }
  $(".fc-stage", el).addEventListener("click", () => { front = !front; render(); });
  $(".fc-prev", el).addEventListener("click", () => { idx--; front = true; render(); });
  $(".fc-next", el).addEventListener("click", () => { idx++; front = true; render(); });
  $(".fc-shuffle", el).addEventListener("click", () => {
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    idx = 0; front = true; render(); toast("Cards shuffled");
  });
  const editor = $(".fc-editor", el);
  $(".fc-edit", el).addEventListener("click", () => {
    if (editor.classList.contains("hide")) {
      editor.value = cards.map((c) => c[0] + " | " + c[1]).join("\n");
      editor.classList.remove("hide");
    } else {
      cards = editor.value.split("\n").map((l) => l.split("|").map((s) => s.trim())).filter((c) => c.length >= 2 && c[0] && c[1]);
      Store.set("flashcards", cards);
      editor.classList.add("hide");
      idx = 0; front = true; render();
      toast("💾 " + cards.length + " card(s) saved", "ok");
    }
  });
  render();
}

/* ---- v6: stopwatch / countdown pane (big classroom timer) ---- */
function initStopwatch(side, inst) {
  const el = inst.el;
  const disp = $(".sw-display", el), lapsEl = $(".sw-laps", el);
  let mode = "stopwatch", running = false, t0 = 0, acc = 0, cdTotal = 0, raf = null, laps = [];
  inst.getTimerText = () => disp.textContent;
  function fmt(ms) {
    ms = Math.max(0, ms);
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), d = Math.floor((ms % 1000) / 100);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "." + d;
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    const elapsed = acc + (running ? Date.now() - t0 : 0);
    if (mode === "stopwatch") disp.textContent = fmt(elapsed);
    else {
      const left = cdTotal - elapsed;
      disp.textContent = fmt(left);
      disp.style.color = left < 10000 ? "#ff5d5d" : "#fff";
      if (left <= 0 && running) { running = false; acc = cdTotal; toast("⏳ Time is up!", "ok", 5000); if (room) room.sendAnnouncement("⏳ Time is up!"); }
    }
  }
  $(".sw-mode", el).addEventListener("change", (e) => {
    mode = e.target.value;
    $(".sw-cdbar", el).classList.toggle("hide", mode !== "countdown");
    running = false; acc = 0; laps = []; lapsEl.innerHTML = "";
    disp.style.color = "#fff";
    disp.textContent = mode === "countdown" ? fmt((Number($(".sw-mins", el).value) * 60 + Number($(".sw-secs", el).value)) * 1000) : "00:00.0";
  });
  $(".sw-start", el).addEventListener("click", (e) => {
    if (!running) {
      if (mode === "countdown" && acc === 0) cdTotal = (Number($(".sw-mins", el).value) * 60 + Number($(".sw-secs", el).value)) * 1000;
      running = true; t0 = Date.now();
      e.currentTarget.textContent = "⏸ Pause";
      if (!raf) tick();
    } else {
      running = false; acc += Date.now() - t0;
      e.currentTarget.textContent = "▶ Start";
    }
  });
  $(".sw-lap", el).addEventListener("click", () => {
    if (mode !== "stopwatch") return;
    laps.unshift(disp.textContent);
    lapsEl.innerHTML = laps.slice(0, 8).map((l, i) => "Lap " + (laps.length - i) + ": " + l).join("<br/>");
  });
  $(".sw-reset", el).addEventListener("click", () => {
    running = false; acc = 0; laps = []; lapsEl.innerHTML = "";
    disp.style.color = "#fff";
    $(".sw-start", el).textContent = "▶ Start";
    disp.textContent = mode === "countdown" ? fmt((Number($(".sw-mins", el).value) * 60 + Number($(".sw-secs", el).value)) * 1000) : "00:00.0";
  });
  tick();
}

/* ---- v5/v6: educational toolkit pane (200+ tool modes) ---- */
function initToolkit(side, inst) {
  const el = inst.el;
  const tk = new Toolkit($(".tk-stage", el), { mode: "construct" });
  inst.tk = tk;
  inst.getCanvas = () => tk.canvas;
  tk._extInit();
  tk.bindConstructPointers();

  const bars = {
    convert: ".tk-convbar", mult: ".tk-multbar", construct: ".tk-conbar",
    numline: ".tk-nlbar", fraction: ".tk-frbar", random: ".tk-rndbar",
    tally: ".tk-tallybar", score: ".tk-scbar", balance: ".tk-balbar",
    hundred: ".tk-hsbar", letters: ".tk-ltbar", cards: ".tk-cardbar"
  };

  /* ---- unit converter (v5) ---- */
  const catSel = $(".tk-cat", el), fromSel = $(".tk-from", el), toSel = $(".tk-to", el);
  catSel.innerHTML = Object.keys(CONV).map((c) => `<option>${c}</option>`).join("");
  function fillUnits() {
    const cat = catSel.value;
    const us = CONV[cat].special ? CONV[cat].units : Object.keys(CONV[cat].units);
    fromSel.innerHTML = us.map((u) => `<option>${u}</option>`).join("");
    toSel.innerHTML = us.map((u) => `<option>${u}</option>`).join("");
    toSel.selectedIndex = Math.min(1, us.length - 1);
    syncConv();
  }
  function syncConv() {
    tk.convState = { cat: catSel.value, from: fromSel.value, to: toSel.value, val: $(".tk-val", el).value };
    tk.draw();
  }
  fillUnits();
  catSel.addEventListener("change", fillUnits);
  [fromSel, toSel].forEach((s) => s.addEventListener("change", syncConv));
  $(".tk-val", el).addEventListener("input", syncConv);
  $(".tk-multn", el).addEventListener("change", (e) => { tk.multSize = Number(e.target.value); tk.multSel = null; tk.draw(); });

  /* ---- v6: construction toolbar ---- */
  $$(".tk-con", el).forEach((b) => b.addEventListener("click", () => {
    $$(".tk-con", el).forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    tk.constructSetTool(b.dataset.ct);
  }));
  $(".tk-con-undo", el).addEventListener("click", () => tk.constructUndo());
  $(".tk-con-clear", el).addEventListener("click", () => { if (confirm("Clear the construction?")) tk.constructClear(); });

  /* ---- v6: number line ---- */
  function syncNl() {
    const n = tk._ext.nl;
    n.min = Number($(".tk-nlmin", el).value);
    n.max = Number($(".tk-nlmax", el).value);
    if (n.max <= n.min) n.max = n.min + 1;
    n.step = Number($(".tk-nlstep", el).value);
    n.marks = [];
    tk.draw();
  }
  [".tk-nlmin", ".tk-nlmax", ".tk-nlstep"].forEach((s) => $(s, el).addEventListener("change", syncNl));

  /* ---- v6: fractions ---- */
  function syncFr() {
    const f = tk._ext.fr;
    f.n1 = Math.max(0, Number($(".tk-fn1", el).value));
    f.d1 = Math.max(1, Number($(".tk-fd1", el).value));
    f.n2 = Math.max(0, Number($(".tk-fn2", el).value));
    f.d2 = Math.max(1, Number($(".tk-fd2", el).value));
    f.mode = $(".tk-frmode", el).value;
    tk.draw();
  }
  [".tk-fn1", ".tk-fd1", ".tk-fn2", ".tk-fd2", ".tk-frmode"].forEach((s) => $(s, el).addEventListener("input", syncFr));

  /* ---- v6: randomisers ---- */
  $(".tk-rndmode", el).addEventListener("change", (e) => { tk._ext.rnd.mode = e.target.value; tk.draw(); });
  $(".tk-dicen", el).addEventListener("change", (e) => {
    tk._ext.rnd.dice = Array.from({ length: Number(e.target.value) }, () => 1 + Math.floor(Math.random() * 6));
    tk.draw();
  });
  $(".tk-names", el).addEventListener("change", (e) => {
    tk._ext.rnd.names = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    tk._ext.rnd.picked = "";
    tk.draw();
  });

  /* ---- v6: tally ---- */
  $(".tk-tallyset", el).addEventListener("click", () => {
    const items = $(".tk-tallyitems", el).value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
    if (items.length >= 2) { tk._ext.tally.items = items.map((n) => [n, 0]); tk.draw(); }
  });

  /* ---- v6: scoreboard ---- */
  $(".tk-scn", el).addEventListener("change", (e) => { tk._ext.sc.n = Number(e.target.value); tk.draw(); });
  $(".tk-scnames", el).addEventListener("change", (e) => {
    e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4)
      .forEach((n, i) => { tk._ext.sc.teams[i][0] = n; });
    tk.draw();
  });
  $(".tk-screset", el).addEventListener("click", () => { tk._ext.sc.teams.forEach((t) => (t[1] = 0)); tk.draw(); });

  /* ---- v6: balance ---- */
  $(".tk-balset", el).addEventListener("click", () => {
    tk.setBalance(Number($(".tk-balx", el).value) || 1,
                  Number($(".tk-bala", el).value) || 0,
                  Math.max(1, Number($(".tk-balm", el).value) || 1));
  });

  /* ---- v6: hundred square ---- */
  $(".tk-hskip", el).addEventListener("change", (e) => { tk._ext.hs.skip = Number(e.target.value); tk.draw(); });
  $(".tk-hsclear", el).addEventListener("click", () => { tk._ext.hs.marks.clear(); tk.draw(); });

  /* ---- v6: letters ---- */
  const SEQ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  $(".tk-ltchar", el).addEventListener("input", (e) => {
    if (e.target.value) { tk._ext.lt.char = e.target.value; tk.draw(); }
  });
  $(".tk-ltprev", el).addEventListener("click", () => {
    const i = SEQ.indexOf(tk._ext.lt.char.toUpperCase());
    tk._ext.lt.char = SEQ[(i - 1 + SEQ.length) % SEQ.length];
    $(".tk-ltchar", el).value = tk._ext.lt.char;
    tk.draw();
  });
  $(".tk-ltnext", el).addEventListener("click", () => {
    const i = SEQ.indexOf(tk._ext.lt.char.toUpperCase());
    tk._ext.lt.char = SEQ[(i + 1) % SEQ.length];
    $(".tk-ltchar", el).value = tk._ext.lt.char;
    tk.draw();
  });

  /* ---- v6: reference cards ---- */
  $(".tk-cardcat", el).innerHTML = '<option>All</option>' + TK_CATS.map((c) => `<option>${c}</option>`).join("");
  $(".tk-cardcat", el).addEventListener("change", (e) => { tk._ext.cd.cat = e.target.value; tk._ext.cd.idx = 0; tk.draw(); });
  $(".tk-cardq", el).addEventListener("input", (e) => { tk._ext.cd.query = e.target.value; tk._ext.cd.idx = 0; tk.draw(); });
  $(".tk-cardprev", el).addEventListener("click", () => tk._tapCards(0));
  $(".tk-cardnext", el).addEventListener("click", () => tk._tapCards(1e9));

  /* ---- mode switching ---- */
  $(".tk-mode", el).addEventListener("change", (e) => {
    const m = e.target.value;
    Object.entries(bars).forEach(([mode, sel]) => $(sel, el).classList.toggle("hide", mode !== m));
    if (m !== "noise" && tk.stopNoise) tk.stopNoise();   /* v8 */
    tk.setMode(m);
  });
  /* show construct bar initially */
  Object.entries(bars).forEach(([mode, sel]) => $(sel, el).classList.toggle("hide", mode !== "construct"));
}

/* ---- whiteboard ---- */
function initBoard(side, inst) {
  const el = inst.el;
  const stage = $(".wb-stage", el);
  // Keep the two pane boards independent. The left key preserves the legacy
  // storage name; the right pane gets its own key instead of overwriting it.
  const wb = new Whiteboard(stage, { onChange: updatePageInfo, persistKey: side === "L" ? "wb_pages" : "wb_pages_R" });
  inst.wb = wb;

  function updatePageInfo() {
    $(".wb-pageinfo", el).textContent = (wb.pageIndex + 1) + " / " + wb.pages.length;
  }
  updatePageInfo();

  $$(".tool[data-tool]", el).forEach((b) => b.addEventListener("click", () => {
    $$(".tool[data-tool]", el).forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    wb.setTool(b.dataset.tool);
  }));
  $$(".wb-color", el).forEach((c) => c.addEventListener("click", () => {
    $$(".wb-color", el).forEach((x) => x.classList.remove("active"));
    c.classList.add("active");
    wb.setColor(c.dataset.c);
  }));
  $(".wb-size", el).addEventListener("input", (e) => wb.setSize(Number(e.target.value)));
  $(".wb-undo", el).addEventListener("click", () => wb.undo());
  $(".wb-redo", el).addEventListener("click", () => wb.redo());
  $(".wb-clear", el).addEventListener("click", () => { if (confirm("Clear this page?")) wb.clearPage(); });
  $(".wb-bg", el).value = wb.bgStyle;
  $(".wb-bg", el).addEventListener("change", (e) => wb.setBackground(e.target.value));
  $(".wb-export", el).addEventListener("click", () => wb.exportPNG());
  /* v4: fill toggle, pen-only (palm rejection), zoom reset + live zoom label */
  $(".wb-fill", el).addEventListener("click", (e) => {
    wb.setFill(!wb.fillShapes);
    e.currentTarget.classList.toggle("active", wb.fillShapes);
    toast(wb.fillShapes ? "🪣 Shapes will be filled" : "Shapes outlined");
  });
  const penBtn = $(".wb-penonly", el);
  penBtn.classList.toggle("active", wb.penOnly);
  penBtn.addEventListener("click", () => {
    wb.setPenOnly(!wb.penOnly);
    penBtn.classList.toggle("active", wb.penOnly);
    toast(wb.penOnly
      ? "✍ Pen-only: stylus draws, fingers pan/zoom (palm rejection ON)"
      : "✍ Finger-friendly: write with finger or stylus (palm rejection OFF)", "ok", 4000);
  });
  const zoomLblB = $(".wb-zoomlbl", el);
  wb.onViewChange = (v) => { zoomLblB.textContent = Math.round(v.s * 100) + "%"; };
  $(".wb-zoomreset", el).addEventListener("click", () => { wb.resetView(); toast("Board zoom reset"); });

  $(".wb-prev", el).addEventListener("click", () => { wb.gotoPage(wb.pageIndex - 1); updatePageInfo(); });
  $(".wb-next", el).addEventListener("click", () => { wb.gotoPage(wb.pageIndex + 1); updatePageInfo(); });
  $(".wb-add",  el).addEventListener("click", () => { wb.addPage(); updatePageInfo(); });
  $(".wb-del",  el).addEventListener("click", () => { if (confirm("Delete this page?")) { wb.deletePage(); updatePageInfo(); } });
}

/* ---- PDF reader (v2: + annotation overlay) ---- */
function initPdf(side, inst) {
  const el = inst.el;
  const canvas = $(".pdf-canvas", el);
  const annotStage = $(".pdf-annot-stage", el);
  let annotWb = null, annotOn = false;
  const annotPages = {};   // pdf page number -> saved stroke pages
  const ctx = canvas.getContext("2d");
  const info = $(".pdf-info", el);
  const zoomLbl = $(".pdf-zoom", el);
  let doc = null, pageNum = 1, scale = 1, fitMode = true, rendering = false, pending = null;

  inst.getCanvas = () => (doc ? canvas : null);
  /* v5 (issue 5): expose the VISIBLE viewport so the broadcast mirrors
     exactly what the teacher sees (zoom + scroll position included). */
  inst.getViewportRegion = () => {
    if (!doc || !canvas.width) return null;
    const scroll = $(".pdf-scroll", el);
    const ratio = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
    const margin = 14 * ratio;
    const sx = Math.max(0, scroll.scrollLeft * ratio - margin);
    const sy = Math.max(0, scroll.scrollTop * ratio - margin);
    const sw = Math.min(canvas.width - sx, scroll.clientWidth * ratio);
    const sh = Math.min(canvas.height - sy, scroll.clientHeight * ratio);
    if (sw <= 0 || sh <= 0) return null;
    return { sx, sy, sw, sh };
  };

  async function renderPage() {
    if (!doc) return;
    if (rendering) { pending = pageNum; return; }
    rendering = true;
    try {
      const page = await doc.getPage(pageNum);
      let s = scale;
      if (fitMode) {
        const avail = $(".pdf-scroll", el).clientWidth - 28;
        const v1 = page.getViewport({ scale: 1 });
        s = Math.max(0.3, avail / v1.width);
        scale = s;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: s * dpr });
      canvas.width = vp.width; canvas.height = vp.height;
      canvas.style.width = (vp.width / dpr) + "px";
      canvas.style.height = (vp.height / dpr) + "px";
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      info.textContent = pageNum + " / " + doc.numPages;
      zoomLbl.textContent = Math.round(s * 100) + "%";
      syncAnnotStage();
    } catch (e) { console.warn(e); }
    rendering = false;
    if (pending !== null) { pending = null; renderPage(); }
  }
  inst.renderPage = renderPage;

  async function loadFile(file) {
    try {
      const buf = await file.arrayBuffer();
      doc = await pdfjsLib.getDocument({ data: buf }).promise;
      pageNum = 1; fitMode = true;
      $(".pdf-hint", el).classList.add("hide");
      renderPage();
      toast("Opened: " + file.name, "ok");
    } catch (e) { toast("Could not open PDF: " + e.message, "err"); }
  }

  $(".pdf-open", el).addEventListener("click", () => $(".pdf-file", el).click());
  $(".pdf-file", el).addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") loadFile(f);
  });
  $(".pdf-prev", el).addEventListener("click", () => { if (doc && pageNum > 1) { pageNum--; renderPage(); } });
  $(".pdf-next", el).addEventListener("click", () => { if (doc && pageNum < doc.numPages) { pageNum++; renderPage(); } });
  $(".pdf-zoomin", el).addEventListener("click", () => { fitMode = false; scale = Math.min(4, scale * 1.2); renderPage(); });
  $(".pdf-zoomout", el).addEventListener("click", () => { fitMode = false; scale = Math.max(0.3, scale / 1.2); renderPage(); });
  $(".pdf-fit", el).addEventListener("click", () => { fitMode = true; renderPage(); });
  $(".pdf-goto", el).addEventListener("change", (e) => {
    const n = Number(e.target.value);
    if (doc && n >= 1 && n <= doc.numPages) { pageNum = n; renderPage(); }
  });

  /* ----- v4: two-finger pinch zoom on the PDF — affects THIS pane only ----- */
  (function pdfPinch() {
    const scroll = $(".pdf-scroll", el);
    const touches = new Map();
    let pin = null;
    scroll.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pin = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: scale };
      }
    });
    scroll.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pin && touches.size >= 2) {
        e.preventDefault();
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const ns = Math.min(5, Math.max(0.3, pin.s0 * (d / pin.d0)));
        if (Math.abs(ns - scale) / scale > 0.04) {  // re-render only on meaningful change
          fitMode = false; scale = ns; renderPage();
        }
      }
    }, { passive: false });
    const end = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pin = null; };
    scroll.addEventListener("pointerup", end);
    scroll.addEventListener("pointercancel", end);
    scroll.style.touchAction = "pan-x pan-y";   // one finger scrolls, two fingers pinch
  })();

  /* ----- v2: annotate on top of the PDF page ----- */
  function syncAnnotStage() {
    annotStage.style.width = canvas.style.width;
    annotStage.style.height = canvas.style.height;
    if (annotWb) {
      // swap strokes per PDF page so notes stick to the right page
      const want = annotPages[pageNum] || [{ strokes: [] }];
      if (annotWb._boundPdfPage !== pageNum) {
        annotWb.pages = want;
        annotPages[pageNum] = annotWb.pages;
        annotWb.pageIndex = 0;
        annotWb._boundPdfPage = pageNum;
      }
      annotWb.resize();
    }
  }
  inst.getAnnotCanvas = () => (annotOn && annotWb ? annotWb.canvas : null);

  $(".pdf-annot", el).addEventListener("click", (e) => {
    if (!doc) { toast("Open a PDF first"); return; }
    annotOn = !annotOn;
    e.currentTarget.classList.toggle("active", annotOn);
    $(".pdf-annot-clear", el).classList.toggle("hide", !annotOn);
    annotStage.classList.toggle("armed", annotOn);
    if (annotOn && !annotWb) {
      annotWb = new Whiteboard(annotStage, { transparent: true, persist: false, color: "#e02b2b", size: 3 });
      annotWb._boundPdfPage = pageNum;
      annotPages[pageNum] = annotWb.pages;
    }
    if (annotOn) { syncAnnotStage(); toast("✏ Annotating the PDF — drawings stay on this page. Tap again to scroll/zoom.", "ok", 4500); }
    else toast("Annotation off — you can scroll/zoom again");
  });
  $(".pdf-annot-clear", el).addEventListener("click", () => {
    if (annotWb) { annotWb.clearPage(); toast("Annotations cleared on this page"); }
  });
}

/* ---- embedded browser ---- */
function initWeb(side, inst) {
  const el = inst.el;
  const frame = $(".web-frame", el);
  const urlIn = $(".web-url", el);
  function nav(u) {
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    urlIn.value = u;
    frame.src = u;
  }
  $(".web-go", el).addEventListener("click", () => nav(urlIn.value.trim()));
  urlIn.addEventListener("keydown", (e) => { if (e.key === "Enter") nav(urlIn.value.trim()); });
  $(".web-back", el).addEventListener("click", () => { try { frame.contentWindow.history.back(); } catch { toast("Can't go back on cross-site pages"); } });
  $(".web-reload", el).addEventListener("click", () => { frame.src = frame.src; });
  $(".web-pop", el).addEventListener("click", () => { if (urlIn.value) window.open(/^https?:/i.test(urlIn.value) ? urlIn.value : "https://" + urlIn.value, "_blank"); });
  $$(".web-quick", el).forEach((b) => b.addEventListener("click", () => nav(b.dataset.u)));

  /* ----- v6.2 (issue 3): 📡 CAST that works on EVERY device -----
     Android Chrome/Edge have NO getDisplayMedia, so live tab capture is
     impossible on tablets/phones. Reader Cast solves it universally:
     the page content (headings, text, lists, images) is fetched through
     free reader/CORS proxies and rendered onto a canvas — and canvases
     ARE broadcastable. Students see the page in the live stream and it
     scrolls exactly as the teacher scrolls. On desktops that DO support
     getDisplayMedia, a separate 🎥 Live button offers true tab capture. */
  const readerHost = $(".web-reader", el);
  let reader = null, castOn = false;
  inst.getReaderCanvas = () => (castOn && reader ? reader.canvas : null);

  function enterReader(url) {
    if (!reader) reader = new ReaderView(readerHost);
    castOn = true;
    frame.classList.add("hide");
    readerHost.classList.remove("hide");
    $(".web-readerbar", el).classList.remove("hide");
    $(".web-cast", el).classList.add("active");
    /* show 🎥 Live only where the API actually exists (desktops) */
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
      $(".web-livecast", el).classList.remove("hide");
    reader.load(url);
    toast("📡 Reader Cast ON — students see this page in the broadcast. Drag to scroll.", "ok", 6000);
  }
  function exitReader() {
    castOn = false;
    readerHost.classList.add("hide");
    $(".web-readerbar", el).classList.add("hide");
    frame.classList.remove("hide");
    $(".web-cast", el).classList.remove("active");
    toast("Reader Cast off — back to normal browsing.");
  }

  $(".web-cast", el).addEventListener("click", () => {
    if (castOn) { exitReader(); return; }
    const u = urlIn.value.trim() || frame.src;
    if (!u || u === "about:blank") { toast("Enter a URL first, then tap Cast.", "err"); return; }
    enterReader(u);
  });
  /* navigating while casting reloads the reader */
  const _navHook = (u) => { if (castOn && reader) reader.load(u); };
  $(".web-go", el).addEventListener("click", () => _navHook(urlIn.value.trim()));
  urlIn.addEventListener("keydown", (e) => { if (e.key === "Enter") _navHook(urlIn.value.trim()); });
  $$(".web-quick", el).forEach((b) => b.addEventListener("click", () => _navHook(b.dataset.u)));

  $(".web-fontup", el).addEventListener("click", () => reader && reader.setFontScale(reader.fontScale * 1.15));
  $(".web-fontdn", el).addEventListener("click", () => reader && reader.setFontScale(reader.fontScale / 1.15));
  /* v7: reading themes */
  const themeSel = $(".web-theme", el);
  themeSel.value = Store.get("reader_theme", "light");
  themeSel.addEventListener("change", (e) => reader && reader.setTheme(e.target.value));
  /* v7: curated education library dropdown */
  $(".web-linklib", el).addEventListener("change", (e) => {
    const u = e.target.value;
    if (!u) return;
    nav(u);
    _navHook(u);
    e.target.selectedIndex = 0;
  });

  /* optional TRUE live capture — desktops only */
  $(".web-livecast", el).addEventListener("click", async (e) => {
    if (typeof authEnforce === "function" && !authEnforce()) return;
    const btn = e.currentTarget;
    if (window._castStream) { stopWebCast(); btn.classList.remove("active"); return; }
    try {
      const cast = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: COMP.fps }, audio: false,
        preferCurrentTab: true, selfBrowserSurface: "include"
      });
      window._castStream = cast;
      cast.getVideoTracks()[0].addEventListener("ended", () => { stopWebCast(); btn.classList.remove("active"); });
      const newStage = new MediaStream(cast.getVideoTracks());
      if (micStream) micStream.getAudioTracks().forEach((t) => newStage.addTrack(t));
      stageStream = newStage;
      if (room) room.setStageStream(stageStream);
      btn.classList.add("active");
      toast("🎥 LIVE tab capture — students see the real browser.", "ok", 6000);
    } catch {
      toast("Live capture unavailable here — Reader Cast is already streaming the page.", "", 5000);
    }
  });
}

function stopWebCast() {
  if (window._castStream) {
    window._castStream.getTracks().forEach((t) => t.stop());
    window._castStream = null;
  }
  if (room) startCompositeStage();   // back to the normal split-screen broadcast
  else stageStream = null;
  toast("Back to normal broadcast (split-screen composite).", "ok");
}

/* ---- notes ---- */
function initNotes(side, inst) {
  const el = inst.el;
  const area = $(".notes-area", el);
  area.value = Store.get("notes", "");
  let t = null;
  area.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => Store.set("notes", area.value), 600);
  });
  $(".notes-save", el).addEventListener("click", () =>
    downloadBlob(new Blob([area.value], { type: "text/plain" }), "lesson-notes-" + Date.now() + ".txt"));
  $(".notes-clear", el).addEventListener("click", () => { if (confirm("Clear notes?")) { area.value = ""; Store.set("notes", ""); } });
  inst.getText = () => area.value;
}

/* ---- image viewer ---- */
function initImage(side, inst) {
  const el = inst.el;
  const img = $(".img-view", el);
  inst.imgEl = img;
  let objectUrl = "";
  function load(f) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    img.src = objectUrl;
    img.onload = () => $(".img-hint", el).classList.add("hide");
  }
  $(".img-open", el).addEventListener("click", () => $(".img-file", el).click());
  $(".img-file", el).addEventListener("change", (e) => { if (e.target.files[0]) load(e.target.files[0]); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) load(f); });

  /* v4: pinch zoom the image — this pane only
     v6 (issue 4): zoom level is exported so the BROADCAST shows the same zoom */
  inst.getZoom = () => inst._zoom || 1;
  (function imgPinch() {
    const scroll = $(".img-scroll", el);
    let zoom = 1;
    const touches = new Map();
    let pin = null;
    scroll.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pin = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: zoom };
      }
    });
    scroll.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pin && touches.size >= 2) {
        e.preventDefault();
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoom = Math.min(6, Math.max(0.5, pin.z0 * (d / pin.d0)));
        inst._zoom = zoom;
        img.style.transform = "scale(" + zoom + ")";
        img.style.transformOrigin = "center center";
        img.style.maxWidth = zoom > 1 ? "none" : "96%";
        img.style.maxHeight = zoom > 1 ? "none" : "96%";
      }
    }, { passive: false });
    const end = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pin = null; };
    scroll.addEventListener("pointerup", end);
    scroll.addEventListener("pointercancel", end);
    scroll.style.touchAction = "pan-x pan-y";
  })();
}

/* ---- v4: graph plotter (offline Desmos-style, no AI/APIs) ---- */
function initGraph(side, inst) {
  const el = inst.el;
  const canvas = $(".gr-canvas", el);
  const stage = $(".gr-stage", el);
  const ctx = canvas.getContext("2d");
  let curves = [];                                    // [{expr, fn, color}]
  let view = { cx: 0, cy: 0, w: 20 };                 // world width in units
  /* v6 (issue 3): selectable backgrounds for visibility */
  const GR_THEMES = {
    light: { bg: "#ffffff", grid: "#e3e8f4", axis: "#7a86ad", label: "#5a6488", curves: ["#1565d8", "#e02b2b", "#0a8a3a", "#8b5cf6", "#f59e0b"] },
    cream: { bg: "#fdf6e3", grid: "#e8dcc0", axis: "#8a7c55", label: "#6b5d3f", curves: ["#0b5ed7", "#c92a2a", "#087f5b", "#7048e8", "#e8590c"] },
    dark:  { bg: "#10141f", grid: "#27314a", axis: "#8fa3d0", label: "#9aa9cf", curves: ["#4dabf7", "#ff6b6b", "#51cf66", "#b197fc", "#ffd43b"] },
    board: { bg: "#173f2c", grid: "#225840", axis: "#a9d7bb", label: "#cfe9da", curves: ["#ffe066", "#ffa8a8", "#74c0fc", "#fff", "#ffc078"] }
  };
  let grTheme = Store.get("graph_bg", "light");
  inst.getCanvas = () => canvas;

  function compile(expr) {
    let e = expr.toLowerCase()
      .replace(/\^/g, "**")
      .replace(/(sin|cos|tan|asin|acos|atan|sqrt|log10|abs|exp|floor|ceil|round)\(/g, "Math.$1(")
      .replace(/(?<!Math\.)\blog\(/g, "Math.log10(")
      .replace(/\bln\(/g, "Math.log(")
      .replace(/\bpi\b/g, "Math.PI")
      .replace(/(?<![\w.])e(?![\w(])/g, "Math.E");
    if (!/^[\d\sx+\-*/().,MathPIEsqrtincoaglbexpflorud*]+$/.test(e)) throw new Error("Unsupported characters");
    // eslint-disable-next-line no-new-func
    const fn = new Function("x", '"use strict";return (' + e + ");");
    fn(1); // smoke test
    return fn;
  }

  function draw() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    const W = canvas.width, H = canvas.height;
    const ar = H / W;
    const wH = view.w * ar;
    const x0 = view.cx - view.w / 2, y0 = view.cy + wH / 2;
    const px = (x) => ((x - x0) / view.w) * W;
    const py = (y) => ((y0 - y) / wH) * H;

    const TH = GR_THEMES[grTheme] || GR_THEMES.light;
    ctx.fillStyle = TH.bg; ctx.fillRect(0, 0, W, H);
    // grid
    const step = niceStep(view.w / 10);
    ctx.strokeStyle = TH.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = Math.ceil(x0 / step) * step; gx < x0 + view.w; gx += step) { ctx.moveTo(px(gx), 0); ctx.lineTo(px(gx), H); }
    for (let gy = Math.ceil((y0 - wH) / step) * step; gy < y0; gy += step) { ctx.moveTo(0, py(gy)); ctx.lineTo(W, py(gy)); }
    ctx.stroke();
    // axes
    ctx.strokeStyle = TH.axis; ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, py(0)); ctx.lineTo(W, py(0));
    ctx.moveTo(px(0), 0); ctx.lineTo(px(0), H);
    ctx.stroke();
    // labels
    ctx.fillStyle = TH.label; ctx.font = (11 * dpr) + "px system-ui";
    for (let gx = Math.ceil(x0 / step) * step; gx < x0 + view.w; gx += step) {
      if (Math.abs(gx) > 1e-9) ctx.fillText(trimNum(gx), px(gx) + 3, py(0) + 14 * dpr);
    }
    for (let gy = Math.ceil((y0 - wH) / step) * step; gy < y0; gy += step) {
      if (Math.abs(gy) > 1e-9) ctx.fillText(trimNum(gy), px(0) + 5, py(gy) - 4);
    }
    // curves
    curves.forEach((c, ci) => {
      const ccol = TH.curves[(c.ci !== undefined ? c.ci : ci) % TH.curves.length];
      ctx.strokeStyle = ccol; ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= W; i += 2) {
        const x = x0 + (i / W) * view.w;
        let y;
        try { y = c.fn(x); } catch { y = NaN; }
        if (!Number.isFinite(y)) { pen = false; continue; }
        const sy = py(y);
        if (sy < -H || sy > 2 * H) { pen = false; continue; }
        pen ? ctx.lineTo(i, sy) : ctx.moveTo(i, sy);
        pen = true;
      }
      ctx.stroke();
      ctx.fillStyle = ccol; ctx.font = "bold " + (12 * dpr) + "px system-ui";
      ctx.fillText("y = " + c.expr, 10 * dpr, (20 + ci * 18) * dpr);
    });
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function trimNum(n) { return String(Math.round(n * 1000) / 1000); }

  function plot(add) {
    const expr = $(".gr-fx", el).value.trim();
    if (!expr) return;
    try {
      const fn = compile(expr);
      if (!add) curves = [];
      curves.push({ expr, fn, ci: curves.length });
      draw();
    } catch { toast("Could not understand that function. Try e.g. x^2-3*x+2, sin(x), sqrt(x)", "err", 5000); }
  }
  $(".gr-plot", el).addEventListener("click", () => plot(false));
  $(".gr-add", el).addEventListener("click", () => plot(true));
  $(".gr-fx", el).addEventListener("keydown", (e) => { if (e.key === "Enter") plot(false); });
  $(".gr-clear", el).addEventListener("click", () => { curves = []; draw(); });
  $(".gr-zi", el).addEventListener("click", () => { view.w = Math.max(1, view.w / 1.4); draw(); });
  $(".gr-zo", el).addEventListener("click", () => { view.w = Math.min(200, view.w * 1.4); draw(); });
  /* v6 (issue 3): background selector */
  const preset = $(".gr-preset", el);
  if (preset) preset.addEventListener("change", (e) => { if (e.target.value) { $(".gr-fx", el).value = e.target.value; plot(false); e.target.value = ""; } });

  $(".gr-bg", el).value = grTheme;
  $(".gr-bg", el).addEventListener("change", (e) => {
    grTheme = e.target.value;
    Store.set("graph_bg", grTheme);
    draw();
    toast("Graph background: " + e.target.options[e.target.selectedIndex].text);
  });

  /* drag to pan + pinch to zoom — this pane only */
  const touches = new Map();
  let pin = null, panStart = null;
  stage.addEventListener("pointerdown", (e) => {
    stage.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pin = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, w0: view.w };
      panStart = null;
    } else panStart = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  });
  stage.addEventListener("pointermove", (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stage.getBoundingClientRect();
    if (pin && touches.size >= 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      view.w = Math.min(200, Math.max(1, pin.w0 * (pin.d0 / d)));
      draw();
    } else if (panStart) {
      view.cx = panStart.cx - (e.clientX - panStart.x) / r.width * view.w;
      view.cy = panStart.cy + (e.clientY - panStart.y) / r.height * (view.w * r.height / r.width);
      draw();
    }
  });
  const grEnd = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pin = null; if (!touches.size) panStart = null; };
  stage.addEventListener("pointerup", grEnd);
  stage.addEventListener("pointercancel", grEnd);

  new ResizeObserver(draw).observe(stage);
  draw();
}

/* ---- v4: local video/audio player ---- */
function initVideo(side, inst) {
  const el = inst.el;
  const vid = $(".vid-el", el);
  inst.videoEl = vid;
  let rate = 1, objectUrl = "";
  function load(f) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    vid.src = objectUrl;
    $(".vid-hint", el).classList.add("hide");
    vid.play().catch(() => {});
  }
  $(".vid-open", el).addEventListener("click", () => $(".vid-file", el).click());
  $(".vid-file", el).addEventListener("change", (e) => { if (e.target.files[0]) load(e.target.files[0]); });
  el.addEventListener("dragover", (e) => e.preventDefault());
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith("video/") || f.type.startsWith("audio/"))) load(f);
  });
  $(".vid-slow", el).addEventListener("click", () => { rate = Math.max(0.25, rate - 0.25); vid.playbackRate = rate; $(".vid-rate", el).textContent = rate.toFixed(2) + "×"; });
  $(".vid-fastr", el).addEventListener("click", () => { rate = Math.min(3, rate + 0.25); vid.playbackRate = rate; $(".vid-rate", el).textContent = rate.toFixed(2) + "×"; });
}

/* ------------------------------------------------------------
   3. Split divider + layout controls
   ------------------------------------------------------------ */
const workspace = $("#workspace");
const divider = $("#divider");
let splitRatio = Number(Store.get("split", 0.5));
if (!Number.isFinite(splitRatio)) splitRatio = 0.5;
splitRatio = Math.min(0.8, Math.max(0.2, splitRatio));

function applySplit() {
  $("#paneLeft").style.flex = `1 1 ${splitRatio * 100}%`;
  $("#paneRight").style.flex = `1 1 ${(1 - splitRatio) * 100}%`;
}
applySplit();

let dragging = false;
divider.addEventListener("pointerdown", (e) => { dragging = true; divider.setPointerCapture(e.pointerId); });
divider.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const r = workspace.getBoundingClientRect();
  const vertical = getComputedStyle(workspace).flexDirection === "column";
  const primary = vertical ? e.clientY - r.top : e.clientX - r.left;
  const extent = vertical ? r.height : r.width;
  if (extent > 0) splitRatio = Math.min(0.8, Math.max(0.2, primary / extent));
  applySplit();
});
const finishDividerDrag = () => { dragging = false; Store.set("split", splitRatio); resizeBoards(); };
divider.addEventListener("pointerup", finishDividerDrag);
divider.addEventListener("pointercancel", finishDividerDrag);

function resizeBoards() {
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.wb) inst.wb.resize();
    const pinst = paneState[side].instances.pdf;
    if (pinst && pinst.renderPage) pinst.renderPage();
  }
}

function applyLayout() {
  workspace.classList.toggle("right-hidden", layoutMode === "left");
  workspace.classList.toggle("left-hidden",  layoutMode === "right");
  Store.set("layout", layoutMode);
  setTimeout(resizeBoards, 80);
}
applyLayout();

on("#btnLayout", "click", () => {
  layoutMode = layoutMode === "split" ? "left" : layoutMode === "left" ? "right" : "split";
  toast("Layout: " + (layoutMode === "split" ? "Split view" : layoutMode === "left" ? "Left pane only" : "Right pane only"));
  applyLayout();
});

on("#btnSwap", "click", () => {
  const a = paneState.L.app, b = paneState.R.app;
  // move DOM nodes between bodies
  const swap = (from, to) => { while (from.firstChild) to.appendChild(from.firstChild); };
  const tmp = document.createDocumentFragment();
  swap(bodyEls.L, { appendChild: (n) => tmp.appendChild(n) });
  swap(bodyEls.R, bodyEls.L);
  while (tmp.firstChild) bodyEls.R.appendChild(tmp.firstChild);
  const ti = paneState.L.instances; paneState.L.instances = paneState.R.instances; paneState.R.instances = ti;
  paneState.L.app = b; paneState.R.app = a;
  mountApp("L", b); mountApp("R", a);
  setTimeout(resizeBoards, 80);
});

/* v4 (issue 3): ⛶ now triggers focus-fullscreen — handler attached in the
   v4 focus-mode section below (hides platform menu + browser bars together). */

/* mount initial apps */
mountApp("L", paneState.L.app);
mountApp("R", paneState.R.app);

/* ------------------------------------------------------------
   4. Composite broadcaster
   Draws BOTH panes (whiteboard canvases, pdf canvas, notes,
   image) onto one 16:9 canvas, then captureStream()s it.
   Students therefore receive the full split-screen — exactly
   what the teacher sees — regardless of tablet quirks.
   ------------------------------------------------------------ */
const COMP = { canvas: document.createElement("canvas"), ctx: null, raf: null, fps: 8, w: 1280, h: 720 };
COMP.ctx = COMP.canvas.getContext("2d");

function setQuality(qstr) {
  const allowed = { "1280x720x8": [1280, 720, 8], "1280x720x15": [1280, 720, 15], "1920x1080x10": [1920, 1080, 10] };
  const [w, h, f] = allowed[qstr] || allowed["1280x720x8"];
  const value = allowed[qstr] ? qstr : "1280x720x8";
  COMP.w = w; COMP.h = h; COMP.fps = f;
  COMP.canvas.width = w; COMP.canvas.height = h;
  if (Store.get("quality", "1280x720x8") !== value) Store.set("quality", value);
}
setQuality(Store.get("quality", "1280x720x8"));

let lastComposite = 0;
let _hbCounter = 0;
/* v7: fix — prevent a null room from crashing the compositeLoop auth check */
function compositeLoop(ts) {
  COMP.raf = requestAnimationFrame(compositeLoop);
  if (ts - lastComposite < 1000 / COMP.fps) return;
  lastComposite = ts;
  /* v7 security: re-verify auth every ~5 s of streaming. If the gate was
     bypassed (overlay deleted / flag flipped), the class ends itself. */
  if (++_hbCounter % (COMP.fps * 5) === 0 && room &&
      typeof authHeartbeat === "function" && !authHeartbeat()) {
    try { room.end(); } catch {}
    cancelAnimationFrame(COMP.raf); COMP.raf = null;
    if (typeof requireTeacherAccess === "function") requireTeacherAccess();
    return;
  }
  drawComposite();
}

function stopCompositeLoopIfUnused() {
  if (!room && !recorder && !tabletLive.pc && !pipActive && !window._castStream && COMP.raf) {
    cancelAnimationFrame(COMP.raf);
    COMP.raf = null;
  }
}

function drawComposite() {
  const ctx = COMP.ctx, W = COMP.w, H = COMP.h;
  ctx.fillStyle = "#10142b";
  ctx.fillRect(0, 0, W, H);

  const showL = layoutMode !== "right";
  const showR = layoutMode !== "left";
  const headH = 34;

  if (showL && showR) {
    const lw = Math.round(W * splitRatio);
    drawPaneInto(ctx, "L", 0, 0, lw - 2, H, headH);
    ctx.fillStyle = "#2e3768"; ctx.fillRect(lw - 2, 0, 4, H);
    drawPaneInto(ctx, "R", lw + 2, 0, W - lw - 2, H, headH);
  } else if (showL) {
    drawPaneInto(ctx, "L", 0, 0, W, H, headH);
  } else {
    drawPaneInto(ctx, "R", 0, 0, W, H, headH);
  }

  /* v6 (issue 6): when the floating calculator is open, draw it into the
     broadcast so students see every keystroke of the working. */
  drawCalcIntoBroadcast(ctx, W, H);

  // LIVE watermark + clock
  ctx.fillStyle = "rgba(16,20,43,.78)";
  ctx.fillRect(W - 300, H - 30, 300, 30);
  ctx.fillStyle = "#9aa3cf";
  ctx.font = "13px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("ADEWALE CLASSROOM DECK • " + new Date().toLocaleTimeString(), W - 292, H - 15);
}

function drawPaneInto(ctx, side, x, y, w, h, headH) {
  const st = paneState[side];
  // header strip with app name
  ctx.fillStyle = "#181d3a";
  ctx.fillRect(x, y, w, headH);
  ctx.fillStyle = "#eef1ff";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const titles = { board: "✏ Whiteboard", pdf: "📄 Learning material", web: "🌐 Web resource", notes: "🗒 Notes", image: "🖼 Image", graph: "📈 Graph", video: "🎬 Video", toolkit: "🧰 Toolkit", flash: "🃏 Flashcards", stopwatch: "⏱ Timer" };
  ctx.fillText(titles[st.app] || st.app, x + 12, y + headH / 2);

  const cx = x, cy = y + headH, cw = w, ch = h - headH;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(cx, cy, cw, ch);

  const inst = st.instances[st.app];
  try {
    if (st.app === "board" && inst && inst.wb) {
      /* v6 (issue 4): preserve the aspect ratio. Previously the board canvas
         was STRETCHED to fill the broadcast pane, so the zoom students saw
         was distorted (different ratio horizontally vs vertically). Now we
         letterbox-fit it — students see the identical view & zoom ratio. */
      const bc = inst.wb.canvas;
      if (bc.width && bc.height) {
        const s = Math.min(cw / bc.width, ch / bc.height);
        const dw = bc.width * s, dh = bc.height * s;
        ctx.fillStyle = "#e9edf5";
        ctx.fillRect(cx, cy, cw, ch);
        ctx.drawImage(bc, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
      }
    } else if (st.app === "pdf" && inst) {
      const c = inst.getCanvas && inst.getCanvas();
      if (c && c.width) {
        /* v5 (issue 5): broadcast the VISIBLE region — students now see the
           same zoom level and scroll position as the teacher. */
        ctx.fillStyle = "#383d52"; ctx.fillRect(cx, cy, cw, ch);
        const region = inst.getViewportRegion && inst.getViewportRegion();
        if (region) {
          const s = Math.min(cw / region.sw, ch / region.sh);
          const dw = region.sw * s, dh = region.sh * s;
          const dx = cx + (cw - dw) / 2, dy = cy + (ch - dh) / 2;
          ctx.drawImage(c, region.sx, region.sy, region.sw, region.sh, dx, dy, dw, dh);
          const ac = inst.getAnnotCanvas && inst.getAnnotCanvas();
          if (ac && ac.width) {
            const kx = ac.width / c.width, ky = ac.height / c.height;
            ctx.drawImage(ac, region.sx * kx, region.sy * ky, region.sw * kx, region.sh * ky, dx, dy, dw, dh);
          }
        } else {
          const s = Math.min(cw / c.width, ch / c.height);
          const dw = c.width * s, dh = c.height * s;
          const dx = cx + (cw - dw) / 2, dy = cy + (ch - dh) / 2;
          ctx.drawImage(c, dx, dy, dw, dh);
          const ac = inst.getAnnotCanvas && inst.getAnnotCanvas();
          if (ac && ac.width) ctx.drawImage(ac, dx, dy, dw, dh);
        }
      } else drawPlaceholder(ctx, cx, cy, cw, ch, "No PDF open yet");
    } else if (st.app === "notes" && inst) {
      ctx.fillStyle = "#fffbe8"; ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = "#222";
      ctx.font = Math.max(15, Math.round(cw / 42)) + "px system-ui, sans-serif";
      ctx.textBaseline = "top";
      wrapText(ctx, (inst.getText && inst.getText()) || "", cx + 18, cy + 16, cw - 36, Math.max(20, Math.round(cw / 30)));
    } else if (st.app === "image" && inst && inst.imgEl && inst.imgEl.naturalWidth) {
      const im = inst.imgEl;
      const z = (inst.getZoom && inst.getZoom()) || 1;       /* v6 (issue 4) */
      const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight) * z;
      const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      ctx.fillStyle = "#383d52"; ctx.fillRect(cx, cy, cw, ch);
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
      ctx.drawImage(im, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
      ctx.restore();
    } else if (st.app === "graph" || st.app === "toolkit") {       // v4/v5
      const c = inst && inst.getCanvas && inst.getCanvas();
      if (c && c.width) ctx.drawImage(c, cx, cy, cw, ch);
      else drawPlaceholder(ctx, cx, cy, cw, ch, st.app === "graph" ? "No graph yet" : "Toolkit loading…");
    } else if (st.app === "video" && inst && inst.videoEl && inst.videoEl.videoWidth) {  // v4
      const vEl = inst.videoEl;
      const s = Math.min(cw / vEl.videoWidth, ch / vEl.videoHeight);
      const dw = vEl.videoWidth * s, dh = vEl.videoHeight * s;
      ctx.fillStyle = "#000"; ctx.fillRect(cx, cy, cw, ch);
      ctx.drawImage(vEl, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
    } else if (st.app === "flash" && inst && inst.getFlashState) {       /* v6 */
      const fs2 = inst.getFlashState();
      ctx.fillStyle = "#f6f8ff"; ctx.fillRect(cx, cy, cw, ch);
      const pad = Math.min(cw, ch) * 0.1;
      ctx.fillStyle = fs2.front ? "#ffffff" : "#fff8e1";
      ctx.strokeStyle = fs2.front ? "#1e2a78" : "#f59e0b"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(cx + pad, cy + pad, cw - pad * 2, ch - pad * 2, 16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1e2a78"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold " + Math.max(16, Math.round(cw / 22)) + "px system-ui";
      wrapTextCentred(ctx, fs2.text, cx + cw / 2, cy + ch / 2, cw - pad * 3, Math.max(20, Math.round(cw / 18)));
      ctx.font = Math.max(11, Math.round(cw / 50)) + "px system-ui"; ctx.fillStyle = "#888";
      ctx.fillText(fs2.pos, cx + cw / 2, cy + ch - pad / 2);
      ctx.textAlign = "left";
    } else if (st.app === "stopwatch" && inst && inst.getTimerText) {     /* v6 */
      ctx.fillStyle = "#10142b"; ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 " + Math.round(Math.min(cw / 6, ch / 3)) + "px system-ui";
      ctx.fillText(inst.getTimerText(), cx + cw / 2, cy + ch / 2);
      ctx.textAlign = "left";
    } else if (st.app === "web") {
      /* v6.2: Reader Cast canvas IS drawable — students see the page */
      const rc = inst && inst.getReaderCanvas && inst.getReaderCanvas();
      if (rc && rc.width) {
        const s = Math.min(cw / rc.width, ch / rc.height);
        const dw = rc.width * s, dh = rc.height * s;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(cx, cy, cw, ch);
        ctx.drawImage(rc, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
      } else {
        drawPlaceholder(ctx, cx, cy, cw, ch,
          "🌐 Web resource on teacher's screen", "Teacher: tap 📡 Cast to stream this page here.", "");
      }
    } else {
      drawPlaceholder(ctx, cx, cy, cw, ch, "Nothing to show yet");
    }
  } catch (e) { /* canvas tainting etc — never crash the loop */ }
  ctx.restore();
}

/* v6 (issue 6): render the calculator state onto the broadcast canvas */
function drawCalcIntoBroadcast(ctx, W, H) {
  const box = $("#calcBox");
  if (!box || box.classList.contains("hide")) return;
  const cw = Math.round(W * 0.26), chH = Math.round(cw * 0.62);
  const x = W - cw - 14, y = Math.round(H * 0.08);
  ctx.save();
  ctx.fillStyle = "rgba(16,20,43,.92)";
  ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, cw, chH, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffb347";
  ctx.font = "bold " + Math.round(cw * 0.055) + "px system-ui";
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText("🧮 Calculator (" + (typeof calcDeg !== "undefined" && !calcDeg ? "RAD" : "DEG") + ")", x + 12, y + chH * 0.13);
  /* history tape (last 3) */
  const hist = $$("#calcHist div").slice(0, 3);
  ctx.font = Math.round(cw * 0.045) + "px ui-monospace, monospace";
  ctx.fillStyle = "#9aa3cf";
  hist.reverse().forEach((d, i) => {
    ctx.fillText(d.textContent.slice(0, 38), x + 12, y + chH * (0.28 + i * 0.14), cw - 24);
  });
  /* current expression big */
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.round(cw * 0.085) + "px ui-monospace, monospace";
  ctx.textAlign = "right";
  const disp = $("#calcDisplay") ? $("#calcDisplay").value : "0";
  ctx.fillText(disp.slice(-26), x + cw - 12, y + chH * 0.82, cw - 24);
  ctx.restore();
  ctx.textAlign = "left";
}

function drawPlaceholder(ctx, x, y, w, h, l1, l2, l3) {
  ctx.fillStyle = "#222952"; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#9aa3cf"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold " + Math.max(14, Math.round(w / 34)) + "px system-ui, sans-serif";
  ctx.fillText(l1, x + w / 2, y + h / 2 - (l2 ? 24 : 0));
  if (l2) { ctx.font = Math.max(12, Math.round(w / 46)) + "px system-ui"; ctx.fillText(l2, x + w / 2, y + h / 2 + 4); }
  if (l3) { ctx.font = Math.max(12, Math.round(w / 46)) + "px system-ui"; ctx.fillText(l3, x + w / 2, y + h / 2 + 28); }
  ctx.textAlign = "left";
}

function wrapTextCentred(ctx, text, cx2, cy2, maxW, lineH) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  lines.push(cur);
  const startY = cy2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx2, startY + i * lineH));
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const lines = text.split("\n");
  let yy = y;
  for (const line of lines) {
    let cur = "";
    for (const word of line.split(" ")) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > maxW && cur) { ctx.fillText(cur, x, yy); yy += lineH; cur = word; }
      else cur = test;
    }
    ctx.fillText(cur, x, yy); yy += lineH;
    if (yy > y + 5000) break;
  }
}

/* ------------------------------------------------------------
   5. Live class
   ------------------------------------------------------------ */
/* room hoisted */
/* lastEndedRoom hoisted */
/* mic/cam streams hoisted */
/* micOn/camOn hoisted */
/* stageStream hoisted */
/* class timer hoisted */

/* Issue #13: shareable deep-link codes — teach.html?room=MYCODE lets a teacher
   paste ANY letters/numbers code into the URL, attach it to the site, and share
   it with students. Applied BEFORE the roomCode IIFE so the label, invite link,
   QR and PIN all use it immediately. */
(function urlRoomCode() {
  try {
    const q = new URLSearchParams(location.search).get("room");
    if (q && /^[A-Za-z0-9]{4,10}$/.test(String(q).trim())) {
      const code = String(q).trim().toUpperCase();
      Store.set("roomcode_custom", code);
      Store.set("roomcode", code);
      Store.set("newroom", false);
      console.log("[ClassDeck] Room code from URL:", code);
    }
  } catch (e) { /* non-fatal */ }
})();

/* `let` (not const) so a custom room code saved from Settings updates the
   label, invite link, QR and PIN live — without requiring a page reload. */
let roomCode = (() => {
  /* Custom room code set by the teacher takes priority (issue #1). */
  const custom = Store.get("roomcode_custom", "");
  if (/^[A-Z0-9]{4,10}$/.test(custom)) { Store.set("roomcode", custom); return custom; }
  let c = Store.get("roomcode", null);
  if (!c || Store.get("newroom", false)) { c = randomCode(); Store.set("roomcode", c); Store.set("newroom", false); }
  return c;
})();
function currentRoomCode() {
  /* Always reflect the latest custom code, even if it changed mid-session. */
  const custom = Store.get("roomcode_custom", "");
  if (/^[A-Z0-9]{4,10}$/.test(custom)) return custom;
  return roomCode;
}
$("#roomCodeLbl").textContent = currentRoomCode();

/* Join-issue hardening:
   - waiting room is now OFF unless the teacher explicitly turned it on
   - the current state is always shown in the UI so teachers do not accidentally leave students in the lobby */
if (!Store.get("waitroom_pref_set", false) && Store.get("waitroom", null) === null) {
  Store.set("waitroom", false);
}
function syncWaitingRoomUI(forceVal) {
  const on = typeof forceVal === "boolean" ? forceVal : (room ? !!room.waitingRoom : !!Store.get("waitroom", false));
  const btn = $("#btnWaiting");
  if (btn) {
    btn.classList.toggle("active", on);
    btn.textContent = on ? "🚪 Waiting room ON" : "🚪 Waiting room OFF";
    btn.title = on
      ? "Students wait in the lobby until you admit them"
      : "Students join directly when they open your link";
  }
  const hint = $("#inviteWaitroom");
  if (hint) {
    hint.textContent = on
      ? "🚪 Waiting room is ON — open 👥 Students and tap Admit / Admit all when learners arrive."
      : "✅ Waiting room is OFF — students join directly when they open the link.";
    hint.style.color = on ? "var(--warn)" : "var(--ok)";
  }
}
function refreshPendingBadge() {
  const el = $("#pendingBadge");
  if (!el) return;
  const n = room ? room.pending.size : 0;
  el.textContent = n ? ("🚪 " + n + " waiting") : "";
  el.classList.toggle("hide", !n);
}
let liveInviteToken = "";
function rotateInviteToken() {
  liveInviteToken = randomCode(18);
  Store.set("invite_token_" + currentRoomCode(), liveInviteToken);
  return liveInviteToken;
}
function inviteToken() {
  if (liveInviteToken) return liveInviteToken;
  let t = Store.get("invite_token_" + currentRoomCode(), "");
  if (!t) t = rotateInviteToken();
  liveInviteToken = t;
  return t;
}
function studentLink() {
  const base = location.href.replace(/teach\.html.*$/, "join.html");
  let url = base + "?room=" + currentRoomCode();
  if (Store.get("secure_invite", false)) url += "&tok=" + encodeURIComponent(inviteToken());
  return url;
}

/* invite modal */
on("#btnQR", "click", () => {
  if (typeof authEnforce === "function" && !authEnforce()) return;
  $("#inviteLink").value = studentLink();
  $("#inviteCode").textContent = currentRoomCode();
  /* v4: clear join diagnostics */
  $("#inviteLiveWarn").style.display = (room && room.peer && !room.peer.destroyed) ? "none" : "block";
  const pin = Store.get("pin", "");
  $("#invitePin").textContent = pin ? "Class PIN: " + pin + " (students must type this)" : "No PIN set (anyone with the link can join)";
  syncWaitingRoomUI();
  if (location.protocol === "file:") {
    toast("⚠ You are running from a local file — deploy to your https:// address first, or students cannot reach you.", "err", 8000);
  }
  const box = $("#qrBox"); box.innerHTML = "";
  try { new QRCode(box, { text: studentLink(), width: 190, height: 190 }); } catch {}
  openModal("#mInvite");
});
on("#copyLink", "click", async () => {
  try { await navigator.clipboard.writeText($("#inviteLink").value); toast("Link copied!", "ok"); }
  catch { $("#inviteLink").select(); document.execCommand("copy"); toast("Link copied!", "ok"); }
});
on("#roomInfo", "click", async () => {
  try { await navigator.clipboard.writeText(studentLink()); toast("Student link copied!", "ok"); } catch {}
});
syncWaitingRoomUI();
refreshPendingBadge();

/* v5 (issue 6): multi-teacher support. Every browser/device generates its OWN
   room code, so any number of teachers can run classes simultaneously on the
   same deployment — rooms are fully isolated (separate peer IDs, separate
   star networks). This button gives the current device a fresh room instantly
   (e.g. two teachers sharing one tablet, or running parallel classes). */
on("#btnNewRoom", "click", (e) => {
  e.stopPropagation();
  if (room && room.students && room.students.size > 0) { toast("End the current class first.", "err"); return; }
  if (!confirm("Generate a NEW room code? Old invite links will stop working.")) return;
  /* If a custom room code is set, keep it; otherwise generate a random one. */
  const custom = Store.get("roomcode_custom", "");
  Store.set("roomcode", /^[A-Z0-9]{4,10}$/.test(custom) ? custom : randomCode());
  location.reload();
});

/* ---- go live / end ---- */
on("#btnGoLive", "click", goLive);
on("#btnEndLive", "click", endLive);

async function goLive() {
  if (typeof authEnforce === "function" && !authEnforce()) return;   /* v6: hard gate */
  $("#btnGoLive").disabled = true;
  toast("Starting class…");
  try {
    lastEndedRoom = null;
    room = new TeacherRoom(currentRoomCode(), { 
      onEvent: onRoomEvent,
      massUrl: Store.get("mass_url") || null
    });
    room.roomName = Store.get("roomname", "") || ("Class " + currentRoomCode());
    room.pin = Store.get("pin", "");
    room.inviteToken = Store.get("secure_invite", false) ? rotateInviteToken() : "";
    /* Join-issue fix: students now join directly by default unless the teacher explicitly enables the waiting room. */
    room.setWaitingRoom(Store.get("waitroom", false));
    room.autoAdmitRejoin = Store.get("wasLive", false); // resume fix: previously admitted students bypass waiting room
    syncWaitingRoomUI(room.waitingRoom);
    refreshPendingBadge();
    /* v5 bug-fix: PIN applied atomically
                                               (was a setTimeout race in v4) */
    await room.start();

    // build the stage stream
    const mode = Store.get("broadcast", "composite");
    if (mode === "screen" && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
      try {
        stageStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: COMP.fps, max: Math.max(COMP.fps, 15) } },
          audio: true   // captures tab/system audio where the browser/OS permits it
        });
        stageStream.getVideoTracks()[0].addEventListener("ended", () => {
          toast("Screen share ended — switching to composite mode", "err");
          startCompositeStage();
        });
      } catch {
        toast("Screen share unavailable — using composite mode", "");
        startCompositeStage();
      }
    } else {
      startCompositeStage();
    }
    if (!stageStream) startCompositeStage();

    // mic: ask once, attach to stage stream so students hear you
    await ensureMic(true);

    room.setStageStream(stageStream);

    $("#liveBadge").classList.remove("hide");
    $("#btnEndLive").classList.remove("hide");
    $("#btnGoLive").classList.add("hide");
    $("#sigDot").className = "dot on";
    classStartTs = Date.now();
    classTickInt = setInterval(() => {
      $("#timerVal").textContent = fmtTime((Date.now() - classStartTs) / 1000);
      $("#timerChip").classList.add("show");
    }, 1000);

    window._wantWake = Store.get("wake", true);
    if (window._wantWake) keepAwake(true);
    Store.set("wasLive", true);   /* v5 (issue 3): remember we were live */
    room.autoAdmitRejoin = true;
    audit("go-live", "Class started");
    toast(room.waitingRoom
      ? "You are LIVE. Waiting room is ON — new students will stay in the lobby until you admit them in 👥 Students."
      : "You are LIVE. Students will join directly when you share the invite link.", "ok", 6000);
  } catch (e) {
    try { room && room.end && room.end(); } catch {}
    room = null;
    if (COMP.raf) { cancelAnimationFrame(COMP.raf); COMP.raf = null; }
    try { stageStream && stageStream.getTracks().forEach((t) => t.stop()); } catch {}
    stageStream = null;
    try { micStream && micStream.getTracks().forEach((t) => t.stop()); } catch {}
    micStream = null; micOn = false; $("#btnMic").classList.remove("active");
    refreshPendingBadge();
    syncWaitingRoomUI();
    toast(e.message || "Could not start class", "err", 6000);
    $("#btnGoLive").disabled = false;
  }
}

function stopStageSourceExceptMic(stream) {
  if (!stream) return;
  const micTracks = micStream ? micStream.getTracks() : [];
  stream.getTracks().forEach((track) => { if (!micTracks.includes(track)) { try { track.stop(); } catch {} } });
}
function startCompositeStage() {
  if (!COMP.canvas.captureStream) throw new Error("This browser cannot capture the ClassDeck workspace.");
  stopStageSourceExceptMic(stageStream);
  if (COMP.raf) cancelAnimationFrame(COMP.raf);
  drawComposite();
  COMP.raf = requestAnimationFrame(compositeLoop);
  const vidStream = COMP.canvas.captureStream(COMP.fps);
  stageStream = new MediaStream(vidStream.getVideoTracks());
  if (micStream) micStream.getAudioTracks().forEach((t) => stageStream.addTrack(t));
  if (room) room.setStageStream(stageStream);
}

async function ensureMic(on) {
  if (on && !micStream) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: { ideal: 48000 } }, video: false });
      const micTrack = micStream.getAudioTracks()[0];
      if (micTrack) micTrack.addEventListener("ended", () => {
        micOn = false;
        $("#btnMic")?.classList.remove("active");
        toast("Microphone stopped by the browser or device.", "err", 5000);
      });
      micOn = true;
      if (stageStream) micStream.getAudioTracks().forEach((t) => stageStream.addTrack(t));
      $("#btnMic").classList.add("active");
    } catch { toast("Microphone blocked — students won't hear you. Allow mic in browser settings.", "err", 6000); }
  }
}

on("#btnMic", "click", async () => {
  if (!micStream) { await ensureMic(true); if (room && stageStream) room.setStageStream(stageStream); return; }
  micOn = !micOn;
  micStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  $("#btnMic").classList.toggle("active", micOn);
  toast(micOn ? "Mic on" : "Mic muted");
});

on("#btnCam", "click", async () => {
  if (!camOn) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, frameRate: { ideal: 15 }, facingMode: "user" }, audio: false
      });
      const camTrack = camStream.getVideoTracks()[0];
      if (camTrack) camTrack.addEventListener("ended", () => {
        camOn = false; camStream = null;
        $("#selfVideo").srcObject = null; $("#selfView").classList.remove("show"); $("#btnCam").classList.remove("active");
        if (room) room.setCamStream(null);
        toast("Camera stopped by the browser or device.", "err", 5000);
      });
      $("#selfVideo").srcObject = camStream;
      $("#selfView").classList.add("show");
      camOn = true;
      $("#btnCam").classList.add("active");
      if (room) room.setCamStream(camStream);
      toast("Camera on — students can now see you", "ok");
    } catch { toast("Camera blocked. Allow camera access in browser settings.", "err"); }
  } else {
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null; camOn = false;
    $("#selfView").classList.remove("show");
    $("#btnCam").classList.remove("active");
    if (room) room.setCamStream(null);
    toast("Camera off");
  }
});

function endLive(force = false) {
  if (!force && !confirm("End the class for everyone?")) return;
  Store.set("wasLive", false);   /* v5: deliberate end — don't auto-resume */
  const endedRoom = room;
  if (endedRoom) { endedRoom.stats.end = Date.now(); endedRoom.end(); lastEndedRoom = endedRoom; }
  if (typeof stopCaptions === "function") stopCaptions(true);
  // Stop an active recording before releasing its shared microphone track so
  // the final MediaRecorder data is flushed cleanly.
  if (recorder && recorder.state !== "inactive") stopRecording();
  if (window._castStream) {
    try { window._castStream.getTracks().forEach((t) => t.stop()); } catch {}
    window._castStream = null;
  }
  if (tabletLive && tabletLive.pc) stopTabletSocialLive(true);
  if (document.pictureInPictureElement && typeof exitClassDeckPiP === "function") exitClassDeckPiP();
  if (COMP.raf) { cancelAnimationFrame(COMP.raf); COMP.raf = null; }
  try { if (stageStream) stageStream.getTracks().forEach((t) => t.stop()); } catch {}
  stageStream = null;
  try { if (micStream) micStream.getTracks().forEach((t) => t.stop()); } catch {}
  micStream = null; micOn = false; $("#btnMic").classList.remove("active");
  try { if (camStream) camStream.getTracks().forEach((t) => t.stop()); } catch {}
  camStream = null; camOn = false; $("#selfVideo").srcObject = null; $("#selfView").classList.remove("show"); $("#btnCam").classList.remove("active");
  clearInterval(classTickInt); classTickInt = null;
  $("#liveBadge").classList.add("hide");
  $("#btnEndLive").classList.add("hide");
  $("#btnGoLive").classList.remove("hide");
  $("#btnGoLive").disabled = false;
  $("#sigDot").className = "dot off";
  $("#stuCount").textContent = "0 👥";
  room = null;
  refreshPendingBadge();
  syncWaitingRoomUI();
  renderRoster(); renderWaiting(); renderLeaderboard();
  window._wantWake = false; keepAwake(false);
  audit("end-live", "Class ended");
  toast("Class ended. Attendance and the class report remain available in the Students drawer until you reload.");
}

/* ---- room events ---- */
const camTiles = new Map();
/* lastPrivatePeer hoisted */
function onRoomEvent(type, p) {
  switch (type) {
    case "student-joined":
      toast("👋 " + p.name + " joined", "ok");
      renderRoster();
      break;
    case "student-left":
      toast(p.name + " left");
      removeCamTile(p.peerId);
      removeCamTile("scr-" + p.peerId);
      removeStudentAudio(p.peerId);
      renderRoster();
      break;
    case "roster": renderRoster(); break;
    case "hand":
      if (p.up) toast("✋ " + p.name + " raised a hand", "", 4500);
      renderRoster();
      break;
    case "chat":
      addChatMsg(p.private ? "🔒 " + p.from + " (private)" : p.from, p.text, false);
      if (p.private && p.peerId) lastPrivatePeer = p.peerId;   /* v5: reply target */
      break;
    case "student-media":
      if (p.kind === "stucam") addCamTile(p.peerId, p.name, p.stream);
      if (p.kind === "stumic") playStudentAudio(p.peerId, p.stream);
      if (p.kind === "stuscreen") {                    /* v5 (issue 1) */
        addCamTile("scr-" + p.peerId, "🖥 " + p.name + " (screen)", p.stream);
        const tile = camTiles.get("scr-" + p.peerId);
        if (tile) tile.classList.add("focus");          // screens open enlarged
        toast("🖥 " + p.name + " is sharing their screen — see 👥 drawer", "ok", 5000);
        if (!$("#drawerStudents").classList.contains("open")) toggleDrawer("#drawerStudents");
      }
      break;
    case "student-media-end":
      if (p.kind === "stucam") removeCamTile(p.peerId);
      if (p.kind === "stuscreen") removeCamTile("scr-" + p.peerId);
      if (p.kind === "stumic") removeStudentAudio(p.peerId);
      break;
    case "poll-update": renderPollBars(p); break;
    case "signal":
      $("#sigDot").className = "dot " + (p.state === "reconnecting" ? "off" : "on");
      if (p.state === "reconnecting") toast("Reconnecting to signalling server…", "err");
      break;
  }
  $("#stuCount").textContent = (room ? room.students.size : 0) + " 👥";
  refreshPendingBadge();
}

function renderRoster() {
  const list = $("#rosterList");
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom || dataRoom.students.size === 0) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No students yet. Share the room link.</p>';
    return;
  }
  list.innerHTML = "";
  for (const [pid, stu] of dataRoom.students) {
    const row = document.createElement("div");
    row.className = "stu-row";
    row.dataset.peerId = pid;
    row.innerHTML = `
      <span class="hand">${stu.hand ? "✋" : ""}</span>
      <span class="name">${escapeHtml(stu.name)}</span>` +
      (room ? `
      <button class="btn small" data-act="cam" title="Ask/stop camera">📷</button>
      <button class="btn small" data-act="scr" title="Ask student to share their screen">🖥</button>
      <button class="btn small" data-act="mic" title="Allow/revoke mic">🎙</button>
      <button class="btn small danger" data-act="kick" title="Remove">✕</button>` : "");
    if (room) {
      row.querySelector('[data-act="cam"]').addEventListener("click", (e) => {
        const b = e.currentTarget;
        const on = !b.classList.contains("active");
        b.classList.toggle("active", on);
        room.requestStudentCam(pid, on);
        toast(on ? "Asked " + stu.name + " to turn camera on" : "Asked " + stu.name + " to turn camera off");
      });
      row.querySelector('[data-act="scr"]').addEventListener("click", (e) => {
        const b = e.currentTarget;
        const on = !b.classList.contains("active");
        b.classList.toggle("active", on);
        room.requestStudentScreen(pid, on);
        toast(on ? "Asked " + stu.name + " to share their screen" : "Asked " + stu.name + " to stop sharing");
      });
      row.querySelector('[data-act="mic"]').addEventListener("click", (e) => {
        const b = e.currentTarget;
        const on = !b.classList.contains("active");
        b.classList.toggle("active", on);
        room.allowMic(pid, on);
        toast(on ? stu.name + " may now speak" : "Mic permission revoked for " + stu.name);
      });
      row.querySelector('[data-act="kick"]').addEventListener("click", () => {
        if (confirm("Remove " + stu.name + " from the class?")) room.kick(pid);
      });
    }
    list.appendChild(row);
  }
}
function addCamTile(pid, name, stream) {
  removeCamTile(pid);
  const tile = document.createElement("div");
  tile.className = "cam-tile";
  tile.innerHTML = `<video autoplay playsinline muted></video><span class="label">${escapeHtml(name)}</span>`;
  tile.querySelector("video").srcObject = stream;
  tile.addEventListener("click", () => tile.classList.toggle("focus"));
  $("#camGrid").appendChild(tile);
  camTiles.set(pid, tile);
}
function removeCamTile(pid) {
  const t = camTiles.get(pid);
  if (t) { t.remove(); camTiles.delete(pid); }
}
const stuAudio = new Map();
function playStudentAudio(pid, stream) {
  let a = stuAudio.get(pid);
  if (!a) { a = document.createElement("audio"); a.autoplay = true; a.playsInline = true; document.body.appendChild(a); stuAudio.set(pid, a); }
  a.srcObject = stream;
  a.play().catch(() => {});
}
function removeStudentAudio(pid) {
  const a = stuAudio.get(pid);
  if (!a) return;
  try { a.pause(); a.srcObject = null; } catch {}
  a.remove();
  stuAudio.delete(pid);
}

/* ---- drawers ---- */
function toggleDrawer(id) {
  const d = $(id);
  const open = d.classList.contains("open");
  $$(".drawer").forEach((x) => x.classList.remove("open"));
  if (!open) d.classList.add("open");
}
on("#btnStudents", "click", () => { renderRoster(); renderWaiting(); toggleDrawer("#drawerStudents"); });
on("#btnChat", "click", () => toggleDrawer("#drawerChat"));
on("#btnPoll", "click", () => toggleDrawer("#drawerPoll"));
$$(".drawer-close").forEach((b) => b.addEventListener("click", () => b.closest(".drawer").classList.remove("open")));

/* ---- chat ---- */
function addChatMsg(who, text, me) {
  const list = $("#chatList");
  const div = document.createElement("div");
  div.className = "chat-msg" + (me ? " me" : "");
  div.innerHTML = `<div class="who">${escapeHtml(who)}</div>${escapeHtml(text)}`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  if (!me && !$("#drawerChat").classList.contains("open")) toast("💬 " + who + ": " + text.slice(0, 60), "", 4000);
}
/* Teacher chat with rate limiting: max 1 message per 400ms */
let _teacherLastChat = 0;
function sendTeacherChat() {
  const now = Date.now();
  if (now - _teacherLastChat < 400) { toast("Please slow down messages.", "", 2000); return; }
  const inp = $("#chatInput");
  const text = inp.value.trim();
  if (!text) return;
  _teacherLastChat = now;
  inp.value = "";
  const priv = $("#chatPrivReply").checked && lastPrivatePeer;   /* v5 */
  if (priv && room) {
    room.sendChatTo(lastPrivatePeer, text);
    addChatMsg("You → student (private)", text, true);
  } else {
    addChatMsg("You (Teacher)", text, true);
    if (room) room.sendChat(text);
  }
}
on("#chatSend", "click", sendTeacherChat);
on("#chatInput", "keydown", (e) => { if (e.key === "Enter") sendTeacherChat(); });
on("#btnAnnounce", "click", () => {
  const text = prompt("Announcement (shows full-screen on every student device):");
  if (text && room) { room.sendAnnouncement(text); toast("Announcement sent", "ok"); }
});

/* ---- students drawer extras ---- */
on("#btnLock", "click", (e) => {
  if (!room) { toast("Go live first"); return; }
  room.setLocked(!room.locked);
  e.currentTarget.classList.toggle("active", room.locked);
  e.currentTarget.textContent = room.locked ? "🔓 Unlock room" : "🔒 Lock room";
  toast(room.locked ? "Room locked — no new students can join" : "Room unlocked");
});
on("#btnAttendance", "click", () => {
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) { toast("No class data yet"); return; }
  downloadBlob(new Blob([dataRoom.attendanceCSV()], { type: "text/csv" }), "attendance-" + currentRoomCode() + "-" + Date.now() + ".csv");
});
on("#btnAskAllCams", "click", () => {
  if (!room) return;
  for (const pid of room.students.keys()) room.requestStudentCam(pid, true);
  toast("Asked all students to turn cameras on");
});

/* ---- polls ---- */
on("#pollStart", "click", () => {
  if (!room) { toast("Go live first", "err"); return; }
  const q = $("#pollQ").value.trim();
  const opts = $("#pollOpts").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  if (!q || opts.length < 2) { toast("Enter a question and at least 2 options", "err"); return; }
  if (!room.startPoll(q, opts)) { toast("Enter a question and at least 2 options", "err"); return; }
  $("#pollSetup").classList.add("hide");
  $("#pollLive").classList.remove("hide");
  $("#pollLiveQ").textContent = q;
});
on("#pollEnd", "click", () => {
  if (!room) return;
  room.endPoll();
  $("#pollSetup").classList.remove("hide");
  $("#pollLive").classList.add("hide");
  toast("Poll ended — results shown to students", "ok");
});
function renderPollBars(res) {
  if (!res) return;
  const total = res.counts.reduce((a, b) => a + b, 0) || 1;
  $("#pollLiveBars").innerHTML = res.options.map((o, i) => `
    <div class="poll-opt">
      <div class="poll-bar"><i style="width:${Math.round((res.counts[i] / total) * 100)}%"></i>
      <b>${escapeHtml(o)} — ${res.counts[i]}</b></div>
    </div>`).join("");
}

/* ---- countdown timer ---- */
let cdInt = null, cdEnd = 0;
on("#btnTimer", "click", () => openModal("#mTimer"));
$$("#mTimer [data-min]").forEach((b) => b.addEventListener("click", () => startCountdown(Number(b.dataset.min))));
on("#timerStartCustom", "click", () => {
  const m = Number($("#timerCustom").value);
  if (m > 0) startCountdown(m);
});
on("#timerStop", "click", () => { stopCountdown(); closeModal("#mTimer"); });
function startCountdown(mins) {
  cdEnd = Date.now() + mins * 60000;
  closeModal("#mTimer");
  clearInterval(cdInt);
  $("#timerChip").classList.add("show");
  if (room) room.sendAnnouncement("⏱ Timer started: " + mins + " minute" + (mins > 1 ? "s" : ""));
  cdInt = setInterval(() => {
    const left = (cdEnd - Date.now()) / 1000;
    if (left <= 0) {
      stopCountdown();
      toast("⏱ Time is up!", "ok", 5000);
      if (room) room.sendAnnouncement("⏱ Time is up!");
      return;
    }
    $("#timerVal").textContent = fmtTime(left);
  }, 400);
}
function stopCountdown() {
  clearInterval(cdInt); cdInt = null;
  // revert chip to class elapsed time
  if (classStartTs) $("#timerVal").textContent = fmtTime((Date.now() - classStartTs) / 1000);
}

/* ---- local recording (MediaRecorder) ----
   v4 (issue 8): private pipeline, never touches screen-capture → no conflict
   with Meet/Zoom.
   v6 (issue 5): YOUTUBE-READY BRANDED RECORDING. A dedicated 1280×720
   recording canvas composes:
     • the two split panes (the workspace),
     • a branded header: ADEWALE CLASSROOM logo + Subject · Topic · Class,
     • the teacher camera (bottom-right PiP, when on),
     • optionally the student camera tiles (toggle in the dialog),
     • a footer strip with the HMG CONCEPTS channel credit + date.
   Saved as .webm — upload directly to the HMG CONCEPTS YouTube channel. */
/* recorder hoisted */
let recCanvas = null, recCtx = null, recRaf = null;
let recMeta = { subject: "", topic: "", klass: "", students: false, brand: "", footer: "" };
/* v7 (issue 4): each teacher records under THEIR OWN brand.
   Logo: teacher-uploaded (stored on device) → else their academy initial badge.
   Brand/footer text: from the recording dialog (remembered). */
let recLogo = new Image();
function loadRecLogo() {
  const data = Store.get("rec_logo", null);
  recLogo = new Image();
  if (data) recLogo.src = data;
}
loadRecLogo();

on("#btnRec", "click", () => {
  if (recorder && recorder.state === "recording") { stopRecording(); return; }
  /* Auth-enforce first (same as recBegin in the classic dialog). */
  if (typeof authEnforce === "function" && !authEnforce()) return;
  /* Prefer the ENHANCED HMG Recording Studio dialog when present. */
  if (document.getElementById("mHmgRecSetup") && window.HMGREC) {
    if (typeof HMGREC.openDialog === "function") { HMGREC.openDialog(); return; }
  }
  $("#recSubject").value = Store.get("rec_subject", "");
  $("#recClass").value = Store.get("rec_class", "");
  /* v7: prefill the teacher's own brand (defaults to their account/brand name) */
  $("#recBrand").value = Store.get("rec_brand", "") || Store.get("brand", "") || "";
  $("#recFooter").value = Store.get("rec_footer", "");
  $("#recLogoStatus").textContent = Store.get("rec_logo", null) ? "✓ custom logo saved" : "";
  openModal("#mRecSetup");
});
on("#recLogoBtn", "click", () => $("#recLogoFile").click());
on("#recLogoFile", "change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  e.target.value = "";
  /* downscale to keep localStorage light */
  const img = await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(f);
  });
  const c = document.createElement("canvas");
  const k = Math.min(1, 360 / Math.max(img.naturalWidth, img.naturalHeight));
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  try {
    Store.set("rec_logo", c.toDataURL("image/png"));
    loadRecLogo();
    $("#recLogoStatus").textContent = "✓ custom logo saved";
    toast("🖼 Your logo will appear on recordings", "ok");
  } catch { toast("Logo too large to store — choose a smaller image.", "err"); }
});
on("#recBegin", "click", () => {
  if (typeof authEnforce === "function" && !authEnforce()) { closeModal("#mRecSetup"); return; }
  recMeta.subject = $("#recSubject").value.trim() || "Lesson";
  recMeta.topic = $("#recTopic").value.trim() || "";
  recMeta.klass = $("#recClass").value.trim() || "";
  recMeta.students = $("#recStudents").checked;
  recMeta.brand = $("#recBrand").value.trim() || "My Classroom";
  recMeta.footer = $("#recFooter").value.trim() || "";
  Store.set("rec_subject", recMeta.subject);
  Store.set("rec_class", recMeta.klass);
  Store.set("rec_brand", recMeta.brand);
  Store.set("rec_footer", recMeta.footer);
  closeModal("#mRecSetup");
  startRecording();
});

function drawRecordingFrame() {
  const ctx = recCtx, W = recCanvas.width, H = recCanvas.height;
  const headH = Math.round(H * 0.09), footH = Math.round(H * 0.045);
  /* header: logo + subject/topic/class */
  ctx.fillStyle = "#10142b";
  ctx.fillRect(0, 0, W, headH);
  /* v7: the TEACHER'S brand — their logo, or a coloured initial badge */
  if (recLogo.complete && recLogo.naturalWidth) {
    const lh = headH * 0.78, lw = Math.min(lh * (recLogo.naturalWidth / recLogo.naturalHeight), W * 0.22);
    ctx.drawImage(recLogo, 10, (headH - lh) / 2, lw, lh);
  } else {
    const bs = headH * 0.7;
    ctx.fillStyle = "#4f6ef7";
    ctx.beginPath(); ctx.roundRect(10, (headH - bs) / 2, bs, bs, bs * 0.22); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + Math.round(bs * 0.62) + "px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText((recMeta.brand || "C").charAt(0).toUpperCase(), 10 + bs / 2, headH / 2 + bs * 0.03);
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.round(headH * 0.34) + "px system-ui, sans-serif";
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  const title = recMeta.subject + (recMeta.topic ? " — " + recMeta.topic : "");
  ctx.fillText(title, W / 2, headH * 0.38, W * 0.5);
  ctx.fillStyle = "#9aa3cf";
  ctx.font = Math.round(headH * 0.24) + "px system-ui, sans-serif";
  ctx.fillText((recMeta.klass ? recMeta.klass + "  ·  " : "") + recMeta.brand, W / 2, headH * 0.74, W * 0.5);
  ctx.fillStyle = "#ffb347";
  ctx.font = "bold " + Math.round(headH * 0.26) + "px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(recMeta.brand, W - 12, headH / 2, W * 0.26);
  ctx.textAlign = "left";
  /* workspace (the live broadcast canvas) */
  drawComposite(); // ensure COMP is fresh even if not live
  ctx.drawImage(COMP.canvas, 0, headH, W, H - headH - footH);
  /* teacher camera PiP bottom-right */
  const selfVid = $("#selfVideo");
  if (camOn && selfVid && selfVid.videoWidth) {
    const pw = Math.round(W * 0.17), ph = Math.round(pw * 0.75);
    const px2 = W - pw - 12, py2 = H - footH - ph - 12;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(px2, py2, pw, ph, 10); ctx.clip();
    /* mirror like the self-view */
    ctx.translate(px2 + pw, py2); ctx.scale(-1, 1);
    ctx.drawImage(selfVid, 0, 0, pw, ph);
    ctx.restore();
    ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(px2, py2, pw, ph, 10); ctx.stroke();
  }
  /* optional student cameras: left edge stack (up to 3 tiles) */
  if (recMeta.students) {
    const vids = $$("#camGrid video").filter((v) => v.videoWidth).slice(0, 3);
    const tw = Math.round(W * 0.13), th2 = Math.round(tw * 0.75);
    vids.forEach((v, i) => {
      const px2 = 12, py2 = headH + 12 + i * (th2 + 10);
      ctx.save();
      ctx.beginPath(); ctx.roundRect(px2, py2, tw, th2, 8); ctx.clip();
      ctx.drawImage(v, px2, py2, tw, th2);
      ctx.restore();
      ctx.strokeStyle = "#4f6ef7"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(px2, py2, tw, th2, 8); ctx.stroke();
    });
  }
  /* footer */
  ctx.fillStyle = "#10142b"; ctx.fillRect(0, H - footH, W, footH);
  ctx.fillStyle = "#9aa3cf";
  ctx.font = Math.round(footH * 0.5) + "px system-ui, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(recMeta.footer || ("Recorded with ADEWALE CLASSROOM DECK"), 12, H - footH / 2, W * 0.6);
  ctx.textAlign = "right";
  const recDateStr = new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) + "  ·  " + new Date().toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12:true});
  ctx.fillText(recDateStr, W - 12, H - footH / 2);
  ctx.textAlign = "left";
  /* REC dot */
  ctx.fillStyle = "#ff5d5d";
  ctx.beginPath(); ctx.arc(W - 24, headH + 18, 7, 0, 7); ctx.fill();
}

let lastRecFrame = 0;
function recLoop(ts) {
  recRaf = requestAnimationFrame(recLoop);
  if (ts - lastRecFrame < 1000 / COMP.fps) return;
  lastRecFrame = ts;
  try { drawRecordingFrame(); } catch {}
}

async function startRecording() {
  if (typeof MediaRecorder === "undefined" || !recCanvasCaptureSupported()) {
    toast("Recording is not supported by this browser.", "err");
    return;
  }
  if (recorder && recorder.state !== "inactive") return;
  if (!COMP.raf) { drawComposite(); COMP.raf = requestAnimationFrame(compositeLoop); }
  /* dedicated branded canvas */
  recCanvas = document.createElement("canvas");
  recCanvas.width = 1280; recCanvas.height = 720;
  recCtx = recCanvas.getContext("2d");
  drawRecordingFrame();
  recRaf = requestAnimationFrame(recLoop);
  recStream = new MediaStream(recCanvas.captureStream(COMP.fps).getVideoTracks());
  await ensureMic(true);
  if (micStream) micStream.getAudioTracks().forEach((t) => recStream.addTrack(t));
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // Safari/new Chromium where available
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  const mime = candidates.find((m) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(m)) || "";
  try {
    const chunks = [];
    const activeRecorder = new MediaRecorder(recStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000
    });
    recorder = activeRecorder;
    recChunks = chunks;
    /* Issue #13: crash-safe — every chunk is ALSO mirrored into IndexedDB so
       that if the app/browser closes unexpectedly mid-class, the recording
       survives and can be recovered on next load. */
    activeRecorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
        if (window.CDCrashSafe && window.CDCrashSafe.saveChunk && window.HMG_REC_SESSION) {
          try { CDCrashSafe.saveChunk(e.data, window.HMG_REC_SESSION.sessionId); } catch {}
        }
      }
    };
    activeRecorder.onstop = () => {
      const safe = (value) => String(value || "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
      const outType = activeRecorder.mimeType || mime || "video/webm";
      const ext = outType.includes("mp4") ? ".mp4" : ".webm";
      const fname = [safe(recMeta.brand || "Lesson"), safe(recMeta.subject || ""), safe(recMeta.topic || ""), safe(recMeta.klass || ""), new Date().toISOString().slice(0, 10)].filter(Boolean).join("_") + ext;
      if (chunks.length) downloadBlob(new Blob(chunks, { type: outType }), fname);
      /* Clear the mirrored IndexedDB chunks now that the recording is committed. */
      if (window.CDCrashSafe && window.CDCrashSafe.clearSession && window.HMG_REC_SESSION) {
        try { CDCrashSafe.clearSession(window.HMG_REC_SESSION.sessionId); } catch {}
      }
      recChunks = [];
    };
    activeRecorder.start(2000);
    $("#btnRec").classList.add("active");
    toast("⏺ Recording started — " + ((activeRecorder.mimeType || mime || "webm").includes("mp4") ? "MP4" : "WebM") + " on this device when you stop", "ok", 5000);
  } catch (e) {
    recorder = null;
    try { recStream.getVideoTracks().forEach((t) => t.stop()); } catch {}
    if (recRaf) { cancelAnimationFrame(recRaf); recRaf = null; }
    recStream = null; recCanvas = null; recCtx = null;
    stopCompositeLoopIfUnused();
    releaseTeacherMicIfUnused();
    toast("Recording not supported on this browser: " + e.message, "err");
  }
}
function recCanvasCaptureSupported() {
  try {
    const c = document.createElement("canvas");
    return typeof c.captureStream === "function" && typeof MediaStream !== "undefined";
  } catch { return false; }
}
function stopRecording() {
  const activeRecorder = recorder;
  if (!activeRecorder) return;
  try {
    if (activeRecorder.state === "recording" || activeRecorder.state === "paused") activeRecorder.stop();
  } catch {}
  try { if (recStream) recStream.getVideoTracks().forEach((t) => t.stop()); } catch {}
  if (recRaf) { cancelAnimationFrame(recRaf); recRaf = null; }
  recorder = null;
  recStream = null;
  stopCompositeLoopIfUnused();
  releaseTeacherMicIfUnused();
  $("#btnRec").classList.remove("active");
  toast("🎬 Recording saved with YOUR brand. If your browser supports MP4 it saved .mp4; otherwise .webm.", "ok", 6000);
}
/* v4: teacher self-view — draggable anywhere + tap to cycle size
   (small → medium → large). In Meet/Zoom companion mode this floating
   camera is part of the shared screen, so students see your face. */
(function selfViewUX() {
  const sv = $("#selfView");
  const sizes = [150, 230, 330];
  let si = 0, moved = false;
  let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
  sv.addEventListener("pointerdown", (e) => {
    drag = true; moved = false; sv.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = sv.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  sv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) moved = true;
    if (!moved) return;
    sv.style.left = Math.max(2, Math.min(window.innerWidth - sv.offsetWidth - 2, ox + e.clientX - sx)) + "px";
    sv.style.top  = Math.max(2, Math.min(window.innerHeight - sv.offsetHeight - 2, oy + e.clientY - sy)) + "px";
    sv.style.right = "auto"; sv.style.bottom = "auto";
  });
  sv.addEventListener("pointerup", () => {
    drag = false;
    if (!moved) { si = (si + 1) % sizes.length; sv.style.width = sizes[si] + "px"; }
  });
})();

/* ---- settings ---- */
on("#btnSettings", "click", () => {
  $("#setName").value = Store.get("teachername", "");
  $("#setRoomName").value = Store.get("roomname", "");
  $("#setBroadcast").value = Store.get("broadcast", "composite");
  $("#setQuality").value = Store.get("quality", "1280x720x8");
  if ($("#setMassBroadcastUrl")) $("#setMassBroadcastUrl").value = Store.get("mass_url", "");
  $("#setWake").checked = Store.get("wake", true);
  if ($("#setPromo")) $("#setPromo").checked = Store.get("promo_broadcast", false);
  if ($("#setSecureInvite")) $("#setSecureInvite").checked = Store.get("secure_invite", false);
  if ($("#setWatermark")) $("#setWatermark").checked = Store.get("security_watermark", true);
  if ($("#setAutoPiP")) $("#setAutoPiP").checked = Store.get("auto_pip_reminder", false);
  /* Custom room code: prefill current custom value */
  const rc = $("#setRoomCode");
  if (rc) rc.value = Store.get("roomcode_custom", "");
  $("#setNewRoom").checked = false;
  openModal("#mSettings");
});
on("#setSave", "click", () => {
  Store.set("teachername", $("#setName").value.trim());
  Store.set("roomname", $("#setRoomName").value.trim());
  Store.set("broadcast", $("#setBroadcast").value);
  Store.set("quality", $("#setQuality").value);
  if ($("#setMassBroadcastUrl")) Store.set("mass_url", $("#setMassBroadcastUrl").value.trim());
  Store.set("wake", $("#setWake").checked);
  if ($("#setPromo")) Store.set("promo_broadcast", $("#setPromo").checked);
  if ($("#setSecureInvite")) Store.set("secure_invite", $("#setSecureInvite").checked);
  if ($("#setWatermark")) Store.set("security_watermark", $("#setWatermark").checked);
  if ($("#setAutoPiP")) Store.set("auto_pip_reminder", $("#setAutoPiP").checked);
  if ($("#setNewRoom").checked) Store.set("newroom", true);
  /* Custom room code: validate then store. Letters A–Z and numbers 0–9, 4–10 chars. */
  const custom = $("#setRoomCode") ? $("#setRoomCode").value.trim().toUpperCase() : "";
  if (custom) {
    if (!/^[A-Z0-9]{4,10}$/.test(custom)) {
      toast("Room code must be 4–10 letters/numbers (no symbols or spaces)", "err", 5000);
      closeModal("#mSettings");
      return;
    }
    Store.set("roomcode_custom", custom);
    Store.set("roomcode", custom); // apply immediately for this session
    Store.set("newroom", false);
    roomCode = custom;                       // live update (no reload needed)
    const lbl = $("#roomCodeLbl");
    if (lbl) lbl.textContent = currentRoomCode();
    toast("🔑 Room code set to " + custom + " — share this with your students", "ok", 5000);
  } else {
    Store.set("roomcode_custom", "");
    roomCode = Store.get("roomcode", null) || roomCode; // keep current auto code
    const lbl = $("#roomCodeLbl");
    if (lbl) lbl.textContent = currentRoomCode();
  }
  setQuality($("#setQuality").value);
  closeModal("#mSettings");
  toast("Settings saved", "ok");
});

/* ---- solo mode shortcut (?solo=1 hides live chrome) ---- */
if (new URLSearchParams(location.search).get("solo") === "1") {
  ["#btnGoLive", "#btnCam", "#btnMic", "#btnStudents", "#btnChat", "#btnPoll", "#roomInfo", "#btnQR"]
    .forEach((s) => { const el = $(s); if (el) el.classList.add("hide"); });
  toast("Solo workspace — no live class features");
}

/* ---- warn before accidental exit while live ---- */
window.addEventListener("beforeunload", (e) => {
  if (room && room.students && room.students.size > 0) { e.preventDefault(); e.returnValue = ""; }
});

/* ------------------------------------------------------------
   v5 (issue 3): CLASS AUTO-RESUME.
   If the studio reloads (accidental refresh, crash, tablet
   restart) while a class was live, offer one-tap resume of the
   SAME room. Students' auto-reconnect (join.js) then snaps
   everyone back together — the class continues seamlessly.
   ------------------------------------------------------------ */
if (Store.get("wasLive", false) && !meetModeCheck()) {
  setTimeout(() => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9000;background:#1d6f42;color:#fff;display:flex;gap:10px;align-items:center;justify-content:center;padding:9px;font-size:14px;flex-wrap:wrap";
    bar.innerHTML = '<b>⚡ Your class was interrupted.</b> Students are waiting and will reconnect automatically. ' +
      '<button id="resumeYes" class="btn small ok">▶ Resume class now</button>' +
      '<button id="resumeNo" class="btn small">Dismiss</button>';
    document.body.appendChild(bar);
    on("#resumeYes", "click", () => { Store.set("resume_autoadmit", true); bar.remove(); goLive(); });
    on("#resumeNo", "click", () => { Store.set("wasLive", false); bar.remove(); });
  }, 800);
}
function meetModeCheck() { return new URLSearchParams(location.search).get("meet") === "1"; }

/* ============================================================
   v2 FEATURES
   ============================================================ */

/* ------------------------------------------------------------
   v2.1 FOCUS MODE — hides every toolbar so the workspace fills
   the entire screen. Built for the Google-Meet workflow:
   share your screen in Meet, tap 🎯, and students see ONLY the
   whiteboard + materials (like your screenshot). A translucent
   ☰ handle and a mini tool capsule stay available.
   ------------------------------------------------------------ */
const studioEl = $(".studio");
const focusHandle = $("#focusHandle");

/* build the mini tool capsule (pen / highlighter / eraser / laser /
   undo / page± / layout) shown only while in focus mode */
const focusTools = document.createElement("div");
focusTools.className = "focus-tools";
focusTools.innerHTML = `
  <button class="tool ft" data-ft="pen"       title="Pen">✏️</button>
  <button class="tool ft" data-ft="highlight" title="Highlighter">🖍️</button>
  <button class="tool ft" data-ft="eraser"    title="Eraser">🧽</button>
  <button class="tool ft" data-ft="laser"     title="Laser pointer">🔴</button>
  <button class="tool" id="ftUndo"  title="Undo">↩</button>
  <button class="tool" id="ftPgPrev" title="Previous board page">‹</button>
  <button class="tool" id="ftPgNext" title="Next board page">›</button>
  <button class="tool" id="ftPgAdd"  title="New board page">＋</button>
  <button class="tool" id="ftLayout" title="Cycle layout">◫</button>`;
document.body.appendChild(focusTools);

function activeBoards() {
  const out = [];
  for (const side of ["L", "R"]) {
    if (paneState[side].app === "board") {
      const inst = paneState[side].instances.board;
      if (inst && inst.wb) out.push(inst);
    }
  }
  return out;
}
$$(".ft", focusTools).forEach((b) => b.addEventListener("click", () => {
  $$(".ft", focusTools).forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  for (const inst of activeBoards()) {
    inst.wb.setTool(b.dataset.ft);
    // mirror selection on the full toolbar
    $$('.tool[data-tool]', inst.el).forEach((t) =>
      t.classList.toggle("active", t.dataset.tool === b.dataset.ft));
  }
}));
$("#ftUndo", focusTools).addEventListener("click", () => activeBoards().forEach((i) => i.wb.undo()));
$("#ftPgPrev", focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.gotoPage(i.wb.pageIndex - 1); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftPgNext", focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.gotoPage(i.wb.pageIndex + 1); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftPgAdd",  focusTools).addEventListener("click", () => activeBoards().forEach((i) => { i.wb.addPage(); $(".wb-pageinfo", i.el).textContent = (i.wb.pageIndex + 1) + " / " + i.wb.pages.length; }));
$("#ftLayout", focusTools).addEventListener("click", () => $("#btnLayout").click());

/* focusOn hoisted */
function setFocus(on) {
  focusOn = on;
  studioEl.classList.toggle("focus", on);
  focusHandle.classList.toggle("hide", !on);
  Store.set("focus", on);
  /* v4 (issue 2): focus mode also enters browser fullscreen, which hides
     Chrome's address bar + title bar — the panes get the WHOLE device screen.
     (If installed as a PWA, there is no address bar at all.) */
  if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (!on && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  setTimeout(resizeBoards, 200);
  if (on) toast("🎯 Focus mode — toolbars AND browser bars hidden. Tap ☰ (top-left) to come back.", "ok", 4500);
}
on("#btnFocus", "click", () => setFocus(true));
focusHandle.addEventListener("click", () => setFocus(false));

/* v4 (issue 3): the ⛶ fullscreen button now also hides the platform top menu
   (fullscreen = focus). Exiting fullscreen restores everything. */
on("#btnFull", "click", () => { if (!focusOn) setFocus(true); });
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && focusOn) {
    // user pressed Back / system gesture to exit fullscreen → restore toolbars
    focusOn = false;
    studioEl.classList.remove("focus");
    focusHandle.classList.add("hide");
    Store.set("focus", false);
    setTimeout(resizeBoards, 200);
  }
});
/* keyboard escape hatch too */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && focusOn) setFocus(false);
  if (e.key === "F9") setFocus(!focusOn);
});

/* ------------------------------------------------------------
   v2.2 MEET COMPANION MODE  (?meet=1 or the landing-page card)
   For teaching over Google Meet's screen share:
     • hides all built-in live-class controls (Meet handles the call)
     • turns on wake-lock immediately (Meet shares can be long)
     • shows a green "MEET COMPANION" badge
     • auto-enters focus mode after a short delay so what Meet
       shares is a clean full-screen workspace
   You can still tap ☰ to adjust, then re-enter focus.
   ------------------------------------------------------------ */
const meetMode = new URLSearchParams(location.search).get("meet") === "1";
if (meetMode) {
  /* v4 (issue 9): keep 📷 Cam available in Meet/Zoom companion mode.
     Toggling it shows your self-view PiP on screen — and because Meet/Zoom is
     sharing your WHOLE screen, students see your face through the share. */
  ["#btnGoLive", "#btnEndLive", "#btnMic", "#btnStudents", "#btnChat",
   "#btnPoll", "#roomInfo", "#btnQR", "#liveBadge"]
    .forEach((s) => { const el = $(s); if (el) el.classList.add("hide"); });
  const badge = document.createElement("span");
  badge.className = "badge meet";
  badge.textContent = "● COMPANION";
  $(".topbar .brand").after(badge);

  /* v4 (issue 9): student cameras while using Meet/Zoom — use the conferencing
     app's own picture-in-picture. A help button explains it. */
  const pipBtn = document.createElement("button");
  pipBtn.className = "btn small";
  pipBtn.textContent = "📺 See students";
  pipBtn.title = "How to see student cameras while teaching here";
  pipBtn.addEventListener("click", () => openModal("#mMeetPip"));
  badge.after(pipBtn);

  window._wantWake = true; keepAwake(true);
  toast("Companion mode: share your screen in Meet/Zoom, then tap 🎯. Tap 📺 to learn how to see student cameras.", "ok", 7000);
}

/* restore focus state across reloads (e.g. accidental refresh mid-class) */
if (Store.get("focus", false) && (meetMode || new URLSearchParams(location.search).get("solo") === "1")) {
  setTimeout(() => setFocus(true), 600);
}

/* ------------------------------------------------------------
   v2.3 LESSON MANAGER — save/load named whiteboard decks
   Prepare boards before class, switch decks mid-lesson,
   export/import as .json to move between devices.
   ------------------------------------------------------------ */
function lessonsAll() {
  const value = Store.get("lessons", {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, lesson]) => lesson && typeof lesson === "object" && Array.isArray(lesson.pages)));
}
function mainBoard() {
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.wb) return inst;
  }
  // ensure a board exists in the left pane
  mountApp("L", "board");
  return paneState.L.instances.board;
}

on("#btnLessons", "click", () => { renderLessons(); openModal("#mLessons"); });

on("#lessonSave", "click", () => {
  const name = $("#lessonName").value.trim();
  if (!name) { toast("Give the lesson a name first", "err"); return; }
  const inst = mainBoard();
  const all = lessonsAll();
  all[name] = { pages: inst.wb.pages, saved: nowStamp(), pageCount: inst.wb.pages.length };
  try {
    Store.set("lessons", all);
    toast("💾 Saved “" + name + "” (" + inst.wb.pages.length + " page(s))", "ok");
    renderLessons();
  } catch { toast("Storage full — export old lessons as .json and delete them.", "err", 6000); }
});

function renderLessons() {
  const all = lessonsAll();
  const list = $("#lessonList");
  const names = Object.keys(all);
  if (!names.length) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No saved lessons yet.</p>'; return; }
  list.innerHTML = "";
  for (const name of names) {
    const row = document.createElement("div");
    row.className = "lesson-row";
    row.innerHTML = `
      <span class="name">${escapeHtml(name)}<br><span class="meta">${escapeHtml(all[name].saved || "")} • ${all[name].pageCount || "?"} page(s)</span></span>
      <button class="btn small primary" data-a="load">Open</button>
      <button class="btn small" data-a="dl" title="Download as .json">⬇</button>
      <button class="btn small danger" data-a="del">✕</button>`;
    row.querySelector('[data-a="load"]').addEventListener("click", () => {
      const inst = mainBoard();
      inst.wb.pages = JSON.parse(JSON.stringify(all[name].pages));
      inst.wb.gotoPage(0);
      inst.wb._save();
      $(".wb-pageinfo", inst.el).textContent = "1 / " + inst.wb.pages.length;
      closeModal("#mLessons");
      toast("📚 Opened “" + name + "”", "ok");
    });
    row.querySelector('[data-a="dl"]').addEventListener("click", () => {
      downloadBlob(new Blob([JSON.stringify(all[name].pages)], { type: "application/json" }),
        name.replace(/[^\w\- ]+/g, "") + ".classdeck.json");
    });
    row.querySelector('[data-a="del"]').addEventListener("click", () => {
      if (!confirm("Delete lesson “" + name + "”?")) return;
      delete all[name]; Store.set("lessons", all); renderLessons();
    });
    list.appendChild(row);
  }
}

on("#lessonExport", "click", () => mainBoard().wb.exportAllJSON());
on("#lessonImportBtn", "click", () => $("#lessonImportFile").click());
on("#lessonImportFile", "change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const inst = mainBoard();
  inst.wb.importJSON(text);
  $(".wb-pageinfo", inst.el).textContent = "1 / " + inst.wb.pages.length;
  toast("Deck imported", "ok");
});

/* ------------------------------------------------------------
   v2.4 Divider double-tap → reset to 50/50
   ------------------------------------------------------------ */
let _lastDivTap = 0;
divider.addEventListener("pointerdown", () => {
  const now = Date.now();
  if (now - _lastDivTap < 350) { splitRatio = 0.5; applySplit(); Store.set("split", 0.5); resizeBoards(); }
  _lastDivTap = now;
});

/* ============================================================
   v3 FEATURES
   ============================================================ */

/* ------------------------------------------------------------
   v3.1 Whiteboard extras: insert image + export deck as PDF
   (buttons exist inside every board toolbar template)
   ------------------------------------------------------------ */
document.addEventListener("click", (e) => {
  const t = e.target.closest ? e.target.closest(".wb-img, .wb-pdf") : null;
  if (!t) return;
  const sec = t.closest("section");
  // find owning instance
  let owner = null;
  for (const side of ["L", "R"]) {
    const inst = paneState[side].instances.board;
    if (inst && inst.el === sec) owner = inst;
  }
  if (!owner || !owner.wb) return;
  if (t.classList.contains("wb-img")) {
    $(".wb-imgfile", sec).onchange = async (ev) => {
      const f = ev.target.files[0];
      if (f) { await owner.wb.insertImage(f); toast("🖼 Image placed on the board", "ok"); }
      ev.target.value = "";
    };
    $(".wb-imgfile", sec).click();
  } else {
    toast("Building PDF of " + owner.wb.pages.length + " page(s)…");
    owner.wb.exportDeckPDF().then(() => toast("🧾 Deck exported as PDF", "ok"));
  }
});

/* ------------------------------------------------------------
   v3.2 Quiz engine with auto-scoring + leaderboard
   ------------------------------------------------------------ */
on("#btnQuiz", "click", () => { refreshQuizBanks(); renderLeaderboard(); toggleDrawer("#drawerQuiz"); });

function parseQuizText(text) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const questions = [];
  for (const b of blocks) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const q = lines[0];
    const options = [];
    let correct = -1, explanation = "";
    lines.slice(1).forEach((l) => {
      if (l.startsWith("#")) { explanation = l.slice(1).trim(); }          /* v6: explanation line */
      else if (l.startsWith("*")) { correct = options.length; options.push(l.slice(1).trim()); }
      else options.push(l);
    });
    if (correct >= 0 && options.length >= 2 && options.length <= 6)
      questions.push({ q, options, correct, explanation });
  }
  return questions;
}

on("#quizStart", "click", () => {
  if (!room) { toast("Go live first (▶ Go Live) — quizzes run over the built-in classroom.", "err", 5000); return; }
  const questions = parseQuizText($("#quizText").value);
  if (!questions.length) { toast("No valid questions. Mark the correct option with * and separate questions with a blank line.", "err", 6000); return; }
  const def = {
    title: $("#quizTitle").value.trim() || "Quick quiz",
    secondsPerQ: Math.max(5, Number($("#quizSecs").value) || 30),
    questions
  };
  if (!room.startQuiz(def)) { toast("No valid quiz questions found", "err"); return; }
  $("#quizSetup").classList.add("hide");
  $("#quizLive").classList.remove("hide");
  toast("🏆 Quiz started — " + questions.length + " question(s)", "ok");
});

on("#quizNext", "click", () => {
  if (!room) return;
  if (!room.nextQuizQuestion()) toast("That was the last question — tap End quiz.", "", 4000);
});
on("#quizEnd", "click", () => {
  if (!room) return;
  const board = room.endQuiz();
  $("#quizSetup").classList.remove("hide");
  $("#quizLive").classList.add("hide");
  renderLeaderboard();
  if (board && board.length) toast("🏆 Quiz over! Top: " + board[0].name + " (" + board[0].score + " pts)", "ok", 6000);
});
on("#scoreReset", "click", () => {
  if (room) { room.resetScores(); renderLeaderboard(); toast("Scores reset"); }
});
/* v6: gradebook export — per-student score CSV for records/parents */
on("#scoreExport", "click", () => {
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) { toast("Go live first"); return; }
  const rows = [["Rank", "Student", "Score", "Room", "Date"]];
  dataRoom.leaderboard().forEach((r, i) => rows.push([i + 1, r.name, r.score, dataRoom.code, new Date().toLocaleDateString()]));
  const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv" }), "HMG-scores-" + currentRoomCode() + "-" + Date.now() + ".csv");
  toast("📥 Scores exported", "ok");
});

function renderQuizProgress(p) {
  if (!p) return;
  $("#quizLiveTitle").textContent = p.title;
  $("#quizLiveQ").textContent = p.question || (room && room.activeQuiz ? room.activeQuiz.def.questions[p.index].q : "");
  $("#quizAnswered").textContent = p.answered + " / " + p.students;
  $("#quizPos").textContent = (p.index + 1) + " / " + p.total;
  const total = Object.values(p.tally).reduce((a, b) => a + b, 0) || 1;
  $("#quizTally").innerHTML = p.options.map((o, i) => `
    <div class="poll-opt ${i === p.correct ? "quiz-correct" : ""}">
      <div class="poll-bar"><i style="width:${Math.round(((p.tally[i] || 0) / total) * 100)}%"></i>
      <b>${i === p.correct ? "✓ " : ""}${escapeHtml(o)} — ${p.tally[i] || 0}</b></div>
    </div>`).join("");
}

function renderLeaderboard() {
  const list = $("#leaderList");
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">Go live to see scores.</p>'; return; }
  const rows = dataRoom.leaderboard();
  if (!rows.length) { list.innerHTML = '<p style="color:var(--text-dim);font-size:13px">No students yet.</p>'; return; }
  list.innerHTML = rows.map((r, i) => `
    <div class="lead-row ${i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : ""}">
      <span class="rank">${i + 1}</span><span class="name">${escapeHtml(r.name)}</span>
      <span class="pts">${r.score} pts</span>
    </div>`).join("");
}

/* question banks (saved on device) */
function refreshQuizBanks() {
  const saved = Store.get("quizbanks", {});
  const banks = saved && typeof saved === "object" && !Array.isArray(saved) ? Object.fromEntries(Object.entries(saved).filter(([, bank]) => bank && typeof bank === "object" && typeof bank.text === "string")) : {};
  const sel = $("#quizBankSel");
  sel.innerHTML = '<option value="">Load saved…</option>' +
    Object.keys(banks).map((n) => `<option>${escapeHtml(n)}</option>`).join("");
}
on("#quizSaveBank", "click", () => {
  const name = $("#quizTitle").value.trim() || "Untitled quiz";
  const saved = Store.get("quizbanks", {});
  const banks = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  banks[name] = { secs: $("#quizSecs").value, text: $("#quizText").value };
  Store.set("quizbanks", banks);
  refreshQuizBanks();
  toast("💾 Question bank saved: " + name, "ok");
});
on("#quizBankSel", "change", (e) => {
  const saved = Store.get("quizbanks", {});
  const banks = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  const b = banks[e.target.value];
  if (b) { $("#quizTitle").value = e.target.value; $("#quizSecs").value = b.secs; $("#quizText").value = b.text; }
});

/* ------------------------------------------------------------
   v6 (issue 7): CSV quiz import
   Format: Question, A, B, C, D, Correct option, Explanation
   - header row auto-detected and skipped
   - quoted fields with commas supported (RFC-4180 style)
   - correct option accepts A/B/C/D, a-d, or 1-4
   ------------------------------------------------------------ */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function csvToQuestions(text) {
  const rows = parseCSV(text);
  const out = [], errors = [];
  rows.forEach((r, idx) => {
    if (r.length < 6) { if (r.length > 1) errors.push("Row " + (idx + 1) + ": needs at least 6 columns"); return; }
    const [q, a, b, c, d, corr] = r.map((s) => String(s).trim());
    const expl = (r[6] || "").trim();
    /* skip header row */
    if (idx === 0 && /^question/i.test(q) && /^a$/i.test(a)) return;
    if (!q) { errors.push("Row " + (idx + 1) + ": empty question"); return; }
    const options = [a, b, c, d].filter((o) => o !== "");
    if (options.length < 2) { errors.push("Row " + (idx + 1) + ": needs at least options A and B"); return; }
    let ci = -1;
    const cu = corr.toUpperCase();
    if (["A", "B", "C", "D"].includes(cu)) ci = cu.charCodeAt(0) - 65;
    else if (["1", "2", "3", "4"].includes(cu)) ci = Number(cu) - 1;
    if (ci < 0 || ci >= options.length) { errors.push("Row " + (idx + 1) + ": correct option '" + corr + "' invalid"); return; }
    out.push({ q, options, correct: ci, explanation: expl });
  });
  return { questions: out, errors };
}

on("#quizCsvBtn", "click", () => $("#quizCsvFile").click());
on("#quizCsvFile", "change", async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  e.target.value = "";
  try {
    const { questions, errors } = csvToQuestions(await f.text());
    if (!questions.length) {
      $("#quizCsvStatus").textContent = "❌ No valid questions found. " + (errors[0] || "");
      return;
    }
    /* convert into the editable text format so the teacher can still review/edit */
    $("#quizText").value = questions.map((qq) =>
      qq.q + "\n" + qq.options.map((o, i) => (i === qq.correct ? "*" : "") + o).join("\n") +
      (qq.explanation ? "\n# " + qq.explanation : "")
    ).join("\n\n");
    if (!$("#quizTitle").value) $("#quizTitle").value = f.name.replace(/\.csv$/i, "");
    $("#quizCsvStatus").textContent = "✅ Loaded " + questions.length + " question(s) from " + f.name +
      (errors.length ? " — " + errors.length + " row(s) skipped" : "") + ". Review above, then Start quiz.";
    toast("📤 CSV loaded: " + questions.length + " questions", "ok");
  } catch (err) {
    $("#quizCsvStatus").textContent = "❌ Could not read the file: " + err.message;
  }
});
on("#quizCsvTemplate", "click", () => {
  const sample =
'Question,A,B,C,D,Correct option,Explanation/working\n' +
'"What is 54 ÷ 6?",9,8,7,6,A,"54 ÷ 6 = 9 because 6 × 9 = 54"\n' +
'"Solve x + 2 = 5",2,3,4,5,B,"Subtract 2 from both sides: x = 5 − 2 = 3"\n' +
'"Which is a prime number?",4,6,7,9,C,"7 has exactly two factors: 1 and 7"\n';
  downloadBlob(new Blob([sample], { type: "text/csv" }), "HMG-quiz-template.csv");
});

/* hook quiz events into the room event stream */
const _origOnRoomEvent = onRoomEvent;
onRoomEvent = function (type, p) {
  _origOnRoomEvent(type, p);
  if (type === "quiz-progress") { renderQuizProgress(p); renderLeaderboard(); }
  if (type === "student-joined" || type === "student-left") renderLeaderboard();
};

/* ------------------------------------------------------------
   v4: FULL SCIENTIFIC CALCULATOR (upgraded from v3)
   sin/cos/tan + inverses, ln/log, powers/roots, factorial,
   e/π, Ans, memory M+/M-/MR/MC, DEG/RAD toggle, history tape.
   ------------------------------------------------------------ */
const CALC_KEYS = [
  "2nd", "MC", "MR", "M+", "M−", "C", "⌫",
  "sin", "cos", "tan", "ln", "log", "√", "xʸ",
  "π", "e", "(", ")", "n!", "%", "÷",
  "7", "8", "9", "x²", "1/x", "EXP", "×",
  "4", "5", "6", "abs", "Ans", "mod", "−",
  "1", "2", "3", "±", ",", "=", "+",
  "0", "."
];
const CALC_2ND = { sin: "sin⁻¹", cos: "cos⁻¹", tan: "tan⁻¹", ln: "eˣ", log: "10ˣ", "√": "∛", "x²": "x³", abs: "round" };
let calcExpr = "", calcAns = 0, calcMem = 0, calcDeg = true, calc2nd = false;

(function buildCalc() {
  const grid = $("#calcKeys");
  grid.innerHTML = "";
  CALC_KEYS.forEach((k) => {
    if (k === "DEG") return; // handled by header button
    const b = document.createElement("button");
    b.textContent = k;
    b.dataset.k = k;
    if (["sin","cos","tan","ln","log","√","xʸ","x²","n!","1/x","π","e","EXP","±","%","÷","×","−","+","(",")","Ans","abs","round","mod",","].includes(k)) b.className = "op";
    if (k === "=") b.className = "eq";
    if (["2nd","MC","MR","M+","M−","C","⌫"].includes(k)) b.className = "mem";
    b.addEventListener("click", () => calcPress(k, b));
    grid.appendChild(b);
  });
})();

on("#calcDeg", "click", (e) => {
  calcDeg = !calcDeg;
  e.currentTarget.textContent = calcDeg ? "DEG" : "RAD";
  toast("Angles in " + (calcDeg ? "degrees" : "radians"));
});

function calcFact(n) {
  if (n < 0 || n !== Math.floor(n) || n > 170) return NaN;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function calcEval(expr) {
  const D = calcDeg ? "(Math.PI/180)*" : "";
  const Dinv = calcDeg ? "(180/Math.PI)*" : "";
  let e = expr
    .replace(/π/g, "(Math.PI)").replace(/(?<![\w.])e(?![\w(])/g, "(Math.E)")
    .replace(/Ans/g, "(" + calcAns + ")")
    .replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-")
    .replace(/sin⁻¹\(/g, "@ASIN(").replace(/cos⁻¹\(/g, "@ACOS(").replace(/tan⁻¹\(/g, "@ATAN(")
    .replace(/sin\(/g, "Math.sin(" + D).replace(/cos\(/g, "Math.cos(" + D).replace(/tan\(/g, "Math.tan(" + D)
    .replace(/@ASIN\(/g, Dinv + "Math.asin(").replace(/@ACOS\(/g, Dinv + "Math.acos(").replace(/@ATAN\(/g, Dinv + "Math.atan(")
    .replace(/eˣ\(/g, "Math.exp(").replace(/10ˣ\(/g, "Math.pow(10,")
    .replace(/ln\(/g, "Math.log(").replace(/log\(/g, "Math.log10(")
    .replace(/abs\(/g, "Math.abs(").replace(/round\(/g, "Math.round(")
    .replace(/∛\(/g, "Math.cbrt(").replace(/∛(\d+(\.\d+)?)/g, "Math.cbrt($1)")
    .replace(/√\(/g, "Math.sqrt(").replace(/√(\d+(\.\d+)?)/g, "Math.sqrt($1)")
    .replace(/(\d+(\.\d+)?|\))³/g, "Math.pow($1,3)")
    .replace(/(\d+(\.\d+)?|\))²/g, "Math.pow($1,2)")
    .replace(/(\d+(\.\d+)?|\))!/g, "FACT($1)")
    .replace(/\^/g, "**")
    .replace(/(\d+(\.\d+)?)E(\+?-?\d+)/g, "($1*Math.pow(10,$3))")
    .replace(/mod/g, "@MOD@")
    .replace(/%/g, "/100")
    .replace(/@MOD@/g, "%");
  if (!/^[\d+\-*/().,\s a-zA-Z*@!]*$/.test(e)) throw new Error("bad");
  // eslint-disable-next-line no-new-func
  const val = Function("FACT", '"use strict";return (' + e + ")")(calcFact);
  if (!Number.isFinite(val)) throw new Error("math");
  return Math.round(val * 1e12) / 1e12;
}
function calcPress(k, btn) {
  const disp = $("#calcDisplay");
  const hist = $("#calcHist");
  switch (k) {
    case "C": calcExpr = ""; break;
    case "⌫": calcExpr = calcExpr.slice(0, -1); break;
    case "2nd":
      calc2nd = !calc2nd;
      btn.classList.toggle("active", calc2nd);
      $$("#calcKeys button").forEach((b) => {
        const base = b.dataset.k;
        if (CALC_2ND[base]) b.textContent = calc2nd ? CALC_2ND[base] : base;
      });
      return;
    case "MC": calcMem = 0; toast("Memory cleared"); return;
    case "MR": calcExpr += String(calcMem); break;
    case "M+": try { calcMem += calcEval(calcExpr || String(calcAns)); toast("M = " + calcMem); } catch {} return;
    case "M−": try { calcMem -= calcEval(calcExpr || String(calcAns)); toast("M = " + calcMem); } catch {} return;
    case "=":
      try {
        const val = calcEval(calcExpr);
        const line = document.createElement("div");
        line.textContent = calcExpr + " = " + val;
        hist.prepend(line);
        while (hist.children.length > 6) hist.lastChild.remove();
        calcAns = val; calcExpr = String(val);
      } catch { calcExpr = ""; disp.value = "Error"; return; }
      break;
    case "±":
      calcExpr = calcExpr.startsWith("-") ? calcExpr.slice(1) : "-" + calcExpr; break;
    case "xʸ": calcExpr += "^"; break;
    case "x²": calcExpr += calc2nd ? "³" : "²"; break;
    case "n!": calcExpr += "!"; break;
    case "1/x": calcExpr = "1/(" + (calcExpr || calcAns) + ")"; break;
    case "EXP": calcExpr += "E"; break;
    case "sin": case "cos": case "tan": case "ln": case "log": case "abs":
      calcExpr += (calc2nd ? CALC_2ND[k] : k) + "("; break;
    case "sin⁻¹": case "cos⁻¹": case "tan⁻¹": case "eˣ": case "10ˣ": case "round":
      calcExpr += k + "("; break;
    case "√": calcExpr += (calc2nd ? "∛" : "√") + "("; break;
    case "∛": calcExpr += "∛("; break;
    default: calcExpr += k;
  }
  disp.value = calcExpr || "0";
}
on("#btnCalc", "click", () => $("#calcBox").classList.toggle("hide"));
on("#calcClose", "click", () => $("#calcBox").classList.add("hide"));
(function dragCalc() {
  const box = $("#calcBox"), head = $("#calcDrag");
  let drag = false, sx = 0, sy = 0, ox = 0, oy = 0;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    drag = true; head.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = box.getBoundingClientRect(); ox = r.left; oy = r.top;
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    box.style.left = Math.max(2, Math.min(window.innerWidth - box.offsetWidth - 2, ox + e.clientX - sx)) + "px";
    box.style.top = Math.max(2, Math.min(window.innerHeight - 60, oy + e.clientY - sy)) + "px";
    box.style.right = "auto";
  });
  head.addEventListener("pointerup", () => { drag = false; });
})();

/* ------------------------------------------------------------
   v3.4 Class analytics report
   ------------------------------------------------------------ */
function buildReport() {
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) return "No class data — go live first.";
  const s = dataRoom.stats;
  const endAt = room ? Date.now() : (s.end || Date.now());
  const dur = s.start ? fmtTime((endAt - s.start) / 1000) : "—";
  const lb = dataRoom.leaderboard();
  const lines = [
    "ADEWALE CLASSROOM DECK — Class report",
    "Generated: " + nowStamp(),
    "Room: " + dataRoom.code + (dataRoom.roomName ? "  (" + dataRoom.roomName + ")" : ""),
    "",
    "Duration so far:      " + dur,
    "Total joins:          " + s.joins,
    "Peak attendance:      " + s.peak,
    "Currently connected:  " + dataRoom.students.size,
    "Chat messages (stu):  " + s.chats,
    "Polls run:             " + s.polls.length,
    "Quizzes run:           " + s.quizzes.length +
      (s.quizzes.length ? "  [" + s.quizzes.map((q) => q.title + " → top: " + q.top).join("; ") + "]" : ""),
    "Hands raised:          " + s.hands,
    "Reactions:             " + s.reactions,
    "Caption lines:         " + s.captions,
    "",
    "Leaderboard:",
    ...(lb.length ? lb.map((r, i) => "  " + (i + 1) + ". " + r.name + " — " + r.score + " pts") : ["  (no students)"]),
    "",
    "Attendance log:",
    ...dataRoom.attendance.map((a) => "  " + a.time + "  " + a.event.toUpperCase().padEnd(6) + " " + a.name)
  ];
  return lines.join("\n");
}
on("#btnReport", "click", () => {
  $("#reportBody").innerHTML = "<pre style='white-space:pre-wrap;font-size:12.5px'>" + escapeHtml(buildReport()) + "</pre>";
  openModal("#mReport");
});
on("#reportDownload", "click", () => {
  downloadBlob(new Blob([buildReport()], { type: "text/plain" }), "class-report-" + currentRoomCode() + "-" + Date.now() + ".txt");
});
function buildWhatsAppSummary() {
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) return "No live class data yet.";
  const s = dataRoom.stats;
  const lb = dataRoom.leaderboard().slice(0, 5);
  const endAt = room ? Date.now() : (s.end || Date.now());
  return [
    "ADEWALE CLASSROOM DECK class summary",
    "Room: " + dataRoom.code,
    dataRoom.roomName ? ("Class: " + dataRoom.roomName) : "",
    "Duration: " + (s.start ? fmtTime((endAt - s.start) / 1000) : "—"),
    "Total joins: " + s.joins,
    "Peak attendance: " + s.peak,
    "Polls: " + s.polls.length + " · Hands raised: " + s.hands + " · Reactions: " + s.reactions,
    lb.length ? ("Top scores: " + lb.map((r, i) => (i + 1) + ". " + r.name + " (" + r.score + " pts)").join("; ")) : "Top scores: none yet",
    "Generated: " + nowStamp()
  ].filter(Boolean).join("\n");
}
on("#reportWhatsApp", "click", () => {
  const msg = encodeURIComponent(buildWhatsAppSummary());
  window.open("https://wa.me/?text=" + msg, "_blank", "noopener");
});

/* ------------------------------------------------------------
   v3.5 Room PIN + branding + backup/restore (Settings)
   ------------------------------------------------------------ */
(function extendSettings() {
  const openBtn = $("#btnSettings");
  openBtn.addEventListener("click", () => {
    $("#setPin").value = Store.get("pin", "");
    $("#setBrand").value = Store.get("brand", "ADEWALE CLASSROOM DECK");
    $("#setAccent").value = Store.get("accent", "#ffb347");
    if ($("#setSecureInvite")) $("#setSecureInvite").checked = Store.get("secure_invite", false);
    if ($("#setWatermark")) $("#setWatermark").checked = Store.get("security_watermark", true);
    if ($("#setAutoPiP")) $("#setAutoPiP").checked = Store.get("auto_pip_reminder", false);
  });
  on("#setSave", "click", () => {
    const pin = $("#setPin").value.trim();
    Store.set("pin", pin);
    if (room) room.pin = pin;
    const brand = $("#setBrand").value.trim() || "ADEWALE CLASSROOM DECK";
    Store.set("brand", brand);
    const accent = $("#setAccent").value;
    Store.set("accent", accent);
    const secureInvite = !!($("#setSecureInvite") && $("#setSecureInvite").checked);
    if ($("#setSecureInvite")) Store.set("secure_invite", secureInvite);
    if ($("#setWatermark")) Store.set("security_watermark", $("#setWatermark").checked);
    if ($("#setAutoPiP")) Store.set("auto_pip_reminder", $("#setAutoPiP").checked);
    // Apply changes immediately to a live room. Otherwise toggling the option
    // could make the displayed link and the server-side gate disagree.
    if (room) {
      if (secureInvite && !room.inviteToken) room.inviteToken = rotateInviteToken();
      if (!secureInvite) { room.inviteToken = ""; liveInviteToken = ""; }
    }
    applyBranding();
  });
  on("#setAccentReset", "click", () => { $("#setAccent").value = "#ffb347"; });

  on("#setBackup", "click", () => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("hmgcd_")) dump[k] = localStorage.getItem(k);
    }
    downloadBlob(new Blob([JSON.stringify({ v: 3, when: nowStamp(), data: dump }, null, 1)],
      { type: "application/json" }), "classdeck-backup-" + Date.now() + ".json");
    toast("⬇ Backup downloaded — keep it somewhere safe", "ok");
  });
  on("#setRestoreBtn", "click", () => $("#setRestoreFile").click());
  on("#setRestoreFile", "change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj.data || typeof obj.data !== "object" || Array.isArray(obj.data)) throw new Error("not a ClassDeck backup");
      const entries = Object.entries(obj.data).filter(([k, v]) => k.startsWith("hmgcd_") && typeof v === "string" && v.length <= 3_000_000);
      if (!entries.length) throw new Error("backup contains no ClassDeck data");
      if (!confirm("Restore backup from " + (obj.when || "unknown date") + "? This overwrites current lessons/settings.")) return;
      for (const [k, v] of entries) localStorage.setItem(k, v);
      toast("✅ Backup restored — reloading…", "ok");
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast("Restore failed: " + err.message, "err"); }
  });
})();

function applyBranding() {
  const candidate = String(Store.get("accent", "#ffb347"));
  const accent = /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "#ffb347";
  document.documentElement.style.setProperty("--accent", accent);
}
applyBranding();

/* v5: PIN is now applied inside goLive() itself (race-free). Changing the PIN
   in Settings while live applies immediately too: */
on("#setSave", "click", () => { if (room) room.pin = Store.get("pin", ""); });

/* branding in the composite watermark */
const _origDrawComposite = drawComposite;
drawComposite = function () {
  _origDrawComposite();
  const brand = Store.get("brand", "");
  if (brand && brand !== "ADEWALE CLASSROOM DECK") {
    const ctx = COMP.ctx;
    ctx.font = "bold 13px system-ui, sans-serif";
    const w = ctx.measureText(brand).width + 26;
    ctx.fillStyle = "rgba(16,20,43,.78)";
    ctx.fillRect(0, COMP.h - 30, w + 14, 30);
    ctx.fillStyle = "#ffb347";
    ctx.textBaseline = "middle";
    ctx.fillText(brand, 10, COMP.h - 15);
  }
};

/* ------------------------------------------------------------
   v4: Zoom/Meet-style classroom controls
   (waiting room, mute-all, spotlight, emoji reactions)
   ------------------------------------------------------------ */
on("#btnWaiting", "click", () => {
  if (!room) { toast("Go live first"); return; }
  room.setWaitingRoom(!room.waitingRoom);
  Store.set("waitroom", room.waitingRoom);
  Store.set("waitroom_pref_set", true);
  syncWaitingRoomUI(room.waitingRoom);
  toast(room.waitingRoom
    ? "🚪 Waiting room ON — new students will stay in the lobby until you admit them."
    : "✅ Waiting room OFF — students will join directly.");
});
on("#btnMuteAll", "click", () => {
  if (!room) return;
  room.muteAllStudents();
  $$('#rosterList [data-act="mic"]').forEach((b) => b.classList.remove("active"));
  toast("🔇 All student mics revoked");
});

function renderWaiting() {
  const list = $("#waitingList");
  if (!room || room.pending.size === 0) {
    list.innerHTML = room && room.waitingRoom
      ? '<p style="color:var(--text-dim);font-size:12.5px">Waiting room is on. New students will appear here for admission.</p>'
      : "";
    refreshPendingBadge();
    return;
  }
  list.innerHTML = '<b style="font-size:13px">🚪 Waiting to be admitted</b>';
  for (const [pid, p] of room.pending) {
    const row = document.createElement("div");
    row.className = "stu-row";
    row.style.borderColor = "var(--warn)";
    row.innerHTML = `<span class="name">${escapeHtml(p.name)}</span>
      <button class="btn small ok" data-a="adm">✔ Admit</button>
      <button class="btn small danger" data-a="deny">✕</button>`;
    row.querySelector('[data-a="adm"]').addEventListener("click", () => { room.admit(pid); renderWaiting(); renderRoster(); });
    row.querySelector('[data-a="deny"]').addEventListener("click", () => { room.deny(pid); renderWaiting(); });
    list.appendChild(row);
  }
  const all = document.createElement("button");
  all.className = "btn small primary";
  all.textContent = "✔ Admit all";
  all.addEventListener("click", () => { room.admitAll(); renderWaiting(); renderRoster(); });
  list.appendChild(all);
  refreshPendingBadge();
}

/* floating emoji reactions (teacher sees student reactions fly up) */
function flyEmoji(emoji, name) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;z-index:9998;font-size:34px;pointer-events:none;left:" +
    (12 + Math.random() * 70) + "%;bottom:70px;transition:all 2.6s ease-out;opacity:1";
  const symbol = document.createElement("span");
  symbol.textContent = String(emoji || "").slice(0, 8);
  el.appendChild(symbol);
  if (name) {
    const label = document.createElement("div");
    label.style.cssText = "font-size:11px;text-align:center;color:#fff;text-shadow:0 1px 3px #000";
    label.textContent = String(name).slice(0, 40);
    el.appendChild(label);
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.bottom = "75%"; el.style.opacity = "0"; });
  setTimeout(() => el.remove(), 2700);
}

/* hook v4 events into the room event stream */
const _v3OnRoomEvent = onRoomEvent;
onRoomEvent = function (type, p) {
  _v3OnRoomEvent(type, p);
  if (type === "waiting") {
    renderWaiting();
    refreshPendingBadge();
    if (!$("#drawerStudents").classList.contains("open")) toggleDrawer("#drawerStudents");
    toast("🚪 " + ((p && p.name) || "A student") + " is waiting — admit them in the Students panel.", "", 7000);
  }
  if (type === "reaction") flyEmoji(p.emoji, p.name);
  if (type === "student-joined" || type === "student-left") renderWaiting();
};

/* spotlight a student from the roster (long-press name = spotlight) */
document.addEventListener("dblclick", (e) => {
  const row = e.target.closest && e.target.closest("#rosterList .stu-row");
  if (!row || !room) return;
  const name = row.querySelector(".name").textContent;
  room.spotlight(null, name);
  toast("🌟 Spotlighted " + name + " — students see a banner");
});


/* ------------------------------------------------------------
   Enterprise v9: Social Live / OBS centre + free live captions
   ------------------------------------------------------------ */
function deployedBaseUrl() {
  return location.href.replace(/teach\.html.*$/, "");
}
function cleanOutputUrl() {
  return deployedBaseUrl() + "teach.html?solo=1&obs=1";
}
function obsSetupText() {
  return [
    "ADEWALE CLASSROOM DECK — FREE SOCIAL LIVE / OBS SETUP",
    "Generated: " + new Date().toLocaleString(),
    "",
    "1) In ClassDeck Teacher Studio:",
    "   • Open Settings → Broadcast mode.",
    "   • Use Composite for tablet teaching, or Share screen to broadcast your full screen to students.",
    "   • Tap ▶ Go Live for your normal ClassDeck students.",
    "",
    "2) In OBS Studio (free):",
    "   • Add Source → Window Capture (recommended) and choose the ClassDeck browser window.",
    "   • Alternative: Add Source → Browser and paste this clean-output URL:",
    "     " + cleanOutputUrl(),
    "   • Canvas: 1280×720 or 1920×1080; FPS: 30; Audio: your microphone / system audio as needed.",
    "",
    "3) Stream to one platform:",
    "   • OBS Settings → Stream → Service: Custom (or choose YouTube/Facebook if listed).",
    "   • Paste your RTMP server URL and stream key from the platform dashboard.",
    "",
    "4) Multistream for free:",
    "   • Option A: OBS Multiple RTMP Outputs plugin; add each destination separately.",
    "   • Option B: free relay account (for example Restream free tier if it fits your destinations).",
    "   • Your upload bandwidth must handle every direct RTMP output unless you use a relay.",
    "",
    "Common RTMP entry points (stream key comes from your own account):",
    "   • YouTube: rtmp://a.rtmp.youtube.com/live2",
    "   • Facebook Live: rtmps://live-api-s.facebook.com:443/rtmp/",
    "   • TikTok Live: use the RTMP URL/key shown in TikTok Live Center/Studio (eligibility required).",
    "   • Instagram Live Producer: use the RTMP URL/key shown in Instagram Live Producer (account access required).",
    "",
    "Security:",
    "   • Never paste stream keys into ClassDeck. Keep them in OBS/platform dashboards only.",
    "   • For minors, confirm parental/school consent before public social streaming.",
  ].join("\n");
}
function openStreamCentre() {
  const u = deployedBaseUrl() + "stream.html?deck=" + encodeURIComponent(location.href.replace(location.search, "")) + "&clean=" + encodeURIComponent(cleanOutputUrl());
  window.open(u, "_blank", "noopener");
}
function downloadObsNotes() {
  downloadBlob(new Blob([obsSetupText()], { type: "text/plain" }), "classdeck-obs-social-live-setup.txt");
}
if ($("#btnOpenStreamCentre")) on("#btnOpenStreamCentre", "click", openStreamCentre);
if ($("#btnOpenCleanOutput")) on("#btnOpenCleanOutput", "click", () => window.open(cleanOutputUrl(), "_blank", "noopener"));
if ($("#btnObsSetup")) on("#btnObsSetup", "click", downloadObsNotes);


/* Noise meter: free local mic analyser, painted into broadcast when active. */
let noiseOn = false, noiseLevel = 0, noisePeak = 0, noiseThreshold = Number(Store.get("noise_threshold", 70));
let noiseCtx = null, noiseAnalyser = null, noiseData = null, noiseRaf = null, noiseOwnStream = null;
function updateNoiseUI() {
  const pct = Math.round(noiseLevel);
  const bar = $("#noiseGauge i"); if (bar) bar.style.width = Math.min(100, pct) + "%";
  const lbl = $("#noiseLevel"); if (lbl) lbl.textContent = pct + "%";
}
async function startNoiseMeter() {
  try {
    let src = micStream;
    if (!src) {
      noiseOwnStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      src = noiseOwnStream;
    }
    noiseCtx = noiseCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (noiseCtx.state === "suspended") await noiseCtx.resume();
    noiseAnalyser = noiseCtx.createAnalyser();
    noiseAnalyser.fftSize = 1024;
    noiseData = new Uint8Array(noiseAnalyser.fftSize);
    const source = noiseCtx.createMediaStreamSource(src);
    source.connect(noiseAnalyser);
    noiseOn = true;
    const tick = () => {
      if (!noiseOn || !noiseAnalyser) return;
      noiseAnalyser.getByteTimeDomainData(noiseData);
      let sum = 0;
      for (const v of noiseData) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / noiseData.length);
      noiseLevel = Math.min(100, Math.max(0, rms * 220));
      noisePeak = Math.max(noisePeak * 0.985, noiseLevel);
      updateNoiseUI();
      if (noiseLevel >= noiseThreshold) $("#noiseGauge")?.classList.add("active"); else $("#noiseGauge")?.classList.remove("active");
      noiseRaf = requestAnimationFrame(tick);
    };
    tick();
    toast("🔊 Noise meter ON", "ok");
  } catch (e) { toast("Noise meter needs microphone permission: " + e.message, "err", 6000); }
}
function stopNoiseMeter() {
  noiseOn = false; noiseLevel = 0; updateNoiseUI();
  if (noiseRaf) cancelAnimationFrame(noiseRaf); noiseRaf = null;
  if (noiseOwnStream) { noiseOwnStream.getTracks().forEach((t) => t.stop()); noiseOwnStream = null; }
  toast("Noise meter stopped");
}
function drawNoiseOverlay(ctx, W, H) {
  const bw = Math.round(W * 0.22), bh = 34, x = Math.round((W - bw) / 2), y = H - 72;
  ctx.save();
  ctx.fillStyle = noiseLevel >= noiseThreshold ? "rgba(224,43,43,.88)" : "rgba(16,20,43,.82)";
  ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 12); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.roundRect(x + 82, y + 10, bw - 96, 12, 6); ctx.fill();
  const ww = Math.round((bw - 96) * Math.min(1, noiseLevel / 100));
  ctx.fillStyle = noiseLevel >= noiseThreshold ? "#fff" : "#4ade80"; ctx.beginPath(); ctx.roundRect(x + 82, y + 10, ww, 12, 6); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textBaseline = "middle";
  ctx.fillText(noiseLevel >= noiseThreshold ? "TOO LOUD" : "Noise", x + 12, y + bh / 2);
  ctx.textAlign = "right"; ctx.fillText(Math.round(noiseLevel) + "%", x + bw - 10, y + bh / 2); ctx.textAlign = "left";
  ctx.restore();
}
if ($("#btnNoiseMeter")) on("#btnNoiseMeter", "click", () => { $("#noiseThreshold").value = noiseThreshold; openModal("#mNoise"); });
if ($("#noiseStart")) on("#noiseStart", "click", startNoiseMeter);
if ($("#noiseStop")) on("#noiseStop", "click", stopNoiseMeter);
if ($("#noiseThreshold")) on("#noiseThreshold", "input", (e) => { noiseThreshold = Number(e.target.value); Store.set("noise_threshold", noiseThreshold); });
const _drawCompositeBeforeNoise = drawComposite;
drawComposite = function () { _drawCompositeBeforeNoise(); if (noiseOn) drawNoiseOverlay(COMP.ctx, COMP.w, COMP.h); };


/* ------------------------------------------------------------
   v10 / ClassDesk v2: Direct tablet social live (NO OBS)
   Browser reality: RTMP/RTMPS cannot be opened directly from a static web page.
   This module publishes the ClassDeck composite MediaStream to a WebRTC WHIP
   relay (included in relay/no-obs-social-relay). The relay converts to RTMP.
   ------------------------------------------------------------ */
tabletLive = { pc: null, stream: null, resource: "", gateway: "", streamName: "classdeck", format: "landscape", raf: null, canvas: null, ownsComposite: false };
function tlSetStatus(msg, ok) {
  const el = $("#tlStatus"); if (el) { el.textContent = msg; el.style.color = ok ? "var(--ok)" : "var(--text-dim)"; }
}
function normaliseGateway(u) {
  try {
    const parsed = new URL(String(u || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.href.replace(/\/+$/, "");
  } catch { return ""; }
}
function tlLoadSettings() {
  const saved = Store.get("tablet_live", {});
  $("#tlGateway").value = saved.gateway || "";
  $("#tlSecret").value = saved.secret || "";
  $("#tlStream").value = saved.stream || ("classdeck-" + currentRoomCode().toLowerCase());
  $("#tlFormat").value = saved.format || "landscape";
  $$(".tlDest").forEach((inp) => { inp.value = (saved.destinations && saved.destinations[inp.dataset.name]) || ""; });
}
function tlReadSettings() {
  const destinations = {};
  $$(".tlDest").forEach((inp) => { if (inp.value.trim()) destinations[inp.dataset.name] = inp.value.trim(); });
  const out = {
    gateway: normaliseGateway($("#tlGateway").value),
    secret: $("#tlSecret").value.trim(),
    stream: ($("#tlStream").value.trim() || ("classdeck-" + currentRoomCode().toLowerCase())).replace(/[^a-zA-Z0-9_-]/g, "-"),
    format: $("#tlFormat").value,
    destinations
  };
  if ($("#tlRemember") && $("#tlRemember").checked) Store.set("tablet_live", out);
  else Store.set("tablet_live", { gateway: out.gateway, stream: out.stream, format: out.format });
  return out;
}
function ensureCompositeForSocial() {
  if (!COMP.raf) {
    drawComposite();
    COMP.raf = requestAnimationFrame(compositeLoop);
    tabletLive.ownsComposite = true;
  }
}
function createVerticalSocialStream(fps) {
  tabletLive.canvas = document.createElement("canvas");
  tabletLive.canvas.width = 720; tabletLive.canvas.height = 1280;
  const ctx = tabletLive.canvas.getContext("2d");
  const brand = Store.get("brand", "ADEWALE CLASSROOM DECK");
  const draw = () => {
    tabletLive.raf = requestAnimationFrame(draw);
    try { drawComposite(); } catch {}
    ctx.fillStyle = "#10142b"; ctx.fillRect(0, 0, 720, 1280);
    ctx.fillStyle = "#ffb347"; ctx.font = "bold 28px system-ui"; ctx.textAlign = "center";
    ctx.fillText(brand, 360, 54, 660);
    const s = Math.min(680 / COMP.canvas.width, 860 / COMP.canvas.height);
    const dw = COMP.canvas.width * s, dh = COMP.canvas.height * s;
    const dx = (720 - dw) / 2, dy = 92;
    ctx.fillStyle = "#000"; ctx.fillRect(dx - 4, dy - 4, dw + 8, dh + 8);
    ctx.drawImage(COMP.canvas, dx, dy, dw, dh);
    const selfVid = $("#selfVideo");
    if (camOn && selfVid && selfVid.videoWidth) {
      const pw = 230, ph = 170, px = 720 - pw - 30, py = dy + dh + 22;
      ctx.save(); ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.clip();
      ctx.translate(px + pw, py); ctx.scale(-1, 1); ctx.drawImage(selfVid, 0, 0, pw, ph); ctx.restore();
      ctx.strokeStyle = "#ffb347"; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 18); ctx.stroke();
    }
    ctx.fillStyle = "#eef1ff"; ctx.font = "22px system-ui"; ctx.textAlign = "left";
    ctx.fillText("Live class with Adewale Samson Adeagbo", 32, 1070, 656);
    ctx.fillStyle = "#9aa3cf"; ctx.font = "17px system-ui";
    ctx.fillText("ADEWALE CLASSROOM · HMG Concepts · Lagos, Nigeria", 32, 1102, 656);
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(32, 1140, 656, 1);
    ctx.fillStyle = "#ffb347"; ctx.font = "bold 18px system-ui"; ctx.textAlign = "center";
    ctx.fillText("Learning Deliberately. Teaching Authentically.", 360, 1194, 650);
  };
  draw();
  return tabletLive.canvas.captureStream(fps);
}
async function buildTabletLiveStream(format) {
  ensureCompositeForSocial();
  const fps = Math.max(10, COMP.fps || 10);
  let videoStream;
  if (format === "vertical") videoStream = createVerticalSocialStream(fps);
  else {
    drawComposite();
    videoStream = COMP.canvas.captureStream(fps);
  }
  const out = new MediaStream(videoStream.getVideoTracks());
  await ensureMic(true);
  if (micStream) micStream.getAudioTracks().forEach((t) => out.addTrack(t));
  return out;
}
function waitForIceComplete(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
    pc.addEventListener("icegatheringstatechange", done);
    setTimeout(resolve, 2500); // Trickle-less WHIP fallback: don't hang forever.
  });
}
async function publishWhip(stream, gateway, streamName) {
  if (typeof RTCPeerConnection === "undefined") throw new Error("This browser does not support WebRTC relay publishing.");
  const endpoint = gateway + "/rtc/v1/whip/?app=live&stream=" + encodeURIComponent(streamName);
  let pc = null;
  try {
    // Reuse the classroom ICE set, including TURN fallbacks, for restrictive
    // mobile networks instead of relying on a single STUN server.
    pc = new RTCPeerConnection(PEER_CONFIG.config);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIceComplete(pc);
    if (!pc.localDescription || !pc.localDescription.sdp) throw new Error("Could not create a relay offer.");
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: pc.localDescription.sdp });
    if (!res.ok) throw new Error("WHIP publish failed (" + res.status + "). Check relay HTTPS/CORS and SRS status.");
    const answer = await res.text();
    if (!answer.trim()) throw new Error("The relay returned an empty WebRTC answer.");
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    const location = res.headers.get("Location");
    tabletLive.resource = location ? new URL(location, gateway).href : "";
    return pc;
  } catch (e) {
    try { pc && pc.close(); } catch {}
    throw e;
  }
}
async function relayStart(settings) {
  const dest = Object.entries(settings.destinations || {}).map(([name, url]) => ({ name, publishUrl: url }));
  if (!dest.length) throw new Error("Add at least one social RTMP/RTMPS destination.");
  const res = await fetch(settings.gateway + "/api/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-relay-secret": settings.secret || "" },
    body: JSON.stringify({ stream: settings.stream, format: settings.format, destinations: dest })
  });
  if (!res.ok) throw new Error("Relay destination start failed (" + res.status + ")");
}
async function relayStop() {
  if (!tabletLive.gateway) return;
  try {
    const secret = ($("#tlSecret") && $("#tlSecret").value.trim()) || (Store.get("tablet_live", {}).secret || "");
    await fetch(tabletLive.gateway + "/api/stop", { method: "POST", headers: { "Content-Type": "application/json", "x-relay-secret": secret }, body: JSON.stringify({ stream: tabletLive.streamName }) });
  } catch {}
}
async function startTabletSocialLive() {
  if (typeof authEnforce === "function" && !authEnforce()) return;
  const settings = tlReadSettings();
  if (!settings.gateway) { toast("Enter a valid http(s) relay gateway URL first", "err"); return; }
  if (!Object.keys(settings.destinations).length) { toast("Add at least one social RTMP/RTMPS destination first", "err"); return; }
  if (tabletLive.pc) { toast("Tablet social live is already running"); return; }
  try {
    tlSetStatus("Preparing ClassDeck stream from this tablet…");
    tabletLive.gateway = settings.gateway; tabletLive.streamName = settings.stream; tabletLive.format = settings.format;
    tabletLive.stream = await buildTabletLiveStream(settings.format);
    tlSetStatus("Connecting to WebRTC relay…");
    tabletLive.pc = await publishWhip(tabletLive.stream, settings.gateway, settings.stream);
    tlSetStatus("Starting social destinations…");
    await relayStart(settings);
    $("#tlStart").classList.add("active");
    tlSetStatus("LIVE through relay: " + settings.stream + " → " + Object.keys(settings.destinations).join(", "), true);
    toast("📡 Tablet Social Live started — no OBS", "ok", 7000);
  } catch (e) {
    await stopTabletSocialLive(true);
    tlSetStatus("Could not start: " + e.message);
    toast("Tablet Social Live failed: " + e.message, "err", 8000);
  }
}
async function stopTabletSocialLive(silent) {
  await relayStop();
  try {
    if (tabletLive.resource) await fetch(tabletLive.resource, { method: "DELETE" });
  } catch {}
  try { tabletLive.pc && tabletLive.pc.close(); } catch {}
  if (tabletLive.raf) cancelAnimationFrame(tabletLive.raf);
  try { tabletLive.stream && tabletLive.stream.getVideoTracks().forEach((t) => t.stop()); } catch {}
  const ownedComposite = tabletLive.ownsComposite;
  if (ownedComposite && !room && !recorder && !pipActive && !window._castStream && COMP.raf) {
    cancelAnimationFrame(COMP.raf); COMP.raf = null;
  }
  tabletLive = { pc: null, stream: null, resource: "", gateway: tabletLive.gateway, streamName: tabletLive.streamName, format: tabletLive.format, raf: null, canvas: null, ownsComposite: false };
  releaseTeacherMicIfUnused();
  $("#tlStart")?.classList.remove("active");
  tlSetStatus("Tablet Social Live stopped.");
  if (!silent) toast("📡 Tablet Social Live stopped");
}
async function checkRelayHealth() {
  const settings = tlReadSettings();
  if (!settings.gateway) { toast("Enter gateway URL first", "err"); return; }
  try {
    const res = await fetch(settings.gateway + "/health", { headers: { "x-relay-secret": settings.secret || "" } });
    const text = await res.text();
    tlSetStatus(res.ok ? ("Relay OK: " + text.slice(0, 120)) : ("Relay replied " + res.status));
    toast(res.ok ? "Relay is reachable" : "Relay health check failed", res.ok ? "ok" : "err");
  } catch (e) { tlSetStatus("Relay not reachable: " + e.message); toast("Relay not reachable", "err"); }
}
async function tryFullTabletScreenShare() {
  if (typeof authEnforce === "function" && !authEnforce()) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    toast("This tablet/browser does not expose full Android screen capture to web apps. ClassDeck will still share the full ClassDeck teaching workspace directly.", "err", 9000);
    Store.set("broadcast", "composite");
    return;
  }
  try {
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: COMP.fps || 10 } }, audio: true });
    if (!room) { s.getTracks().forEach((t) => t.stop()); Store.set("broadcast", "screen"); toast("Full screen sharing is supported. Tap ▶ Go Live to choose your screen.", "ok", 7000); return; }
    stopStageSourceExceptMic(stageStream);
    stageStream = s;
    if (micStream) micStream.getAudioTracks().forEach((t) => stageStream.addTrack(t));
    room.setStageStream(stageStream);
    toast("🖥 Full screen is now being shared to ClassDeck students", "ok", 7000);
    s.getVideoTracks()[0].addEventListener("ended", () => { toast("Full screen share ended — switching back to ClassDeck workspace", "err"); startCompositeStage(); });
  } catch (e) { toast("Screen share cancelled/unavailable. Using ClassDeck workspace broadcast.", "err", 6000); }
}
if ($("#btnTabletLive")) on("#btnTabletLive", "click", () => {
  if (typeof authEnforce === "function" && !authEnforce()) return;
  tlLoadSettings(); openModal("#mTabletLive");
});
if ($("#tlStart")) on("#tlStart", "click", startTabletSocialLive);
if ($("#tlStop")) on("#tlStop", "click", () => stopTabletSocialLive(false));
if ($("#tlHealth")) on("#tlHealth", "click", checkRelayHealth);
if ($("#tlOpenCentre")) on("#tlOpenCentre", "click", openStreamCentre);
if ($("#btnTryScreenShare")) on("#btnTryScreenShare", "click", tryFullTabletScreenShare);

/* Free speech-to-text captions: browser Web Speech API only (no paid AI/API). */
/* captions hoisted */
function releaseTeacherMicIfUnused() {
  if (room || recorder || capOn || (tabletLive && tabletLive.pc)) return;
  try { if (micStream) micStream.getTracks().forEach((t) => t.stop()); } catch {}
  micStream = null;
  micOn = false;
  $("#btnMic")?.classList.remove("active");
}
function captionEngine() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function captionLog(text, final) {
  const line = { time: nowStamp(), text: String(text || "").trim(), final: !!final };
  if (line.text) capLines.push(line);
}
function setCaptionStatus(msg) { const el = $("#captionStatus"); if (el) el.textContent = msg; }
function stopCaptions(silent) {
  capOn = false;
  try { capRec && capRec.stop(); } catch {}
  capRec = null;
  const b = $("#btnCaptions"); if (b) { b.classList.remove("active"); b.textContent = "CC Live captions"; }
  if (!silent) toast("CC captions stopped");
  setCaptionStatus("Captions use your browser only; no AI/API key is used.");
  releaseTeacherMicIfUnused();
}
function startCaptions() {
  const SR = captionEngine();
  if (!SR) { toast("Live captions are not supported in this browser. Try Chrome or Edge.", "err", 7000); return; }
  if (!room) { toast("Go live first so captions can be sent to students.", "err"); return; }
  try {
    capRec = new SR();
    capRec.continuous = true;
    capRec.interimResults = true;
    capRec.lang = Store.get("caption_lang", "en-NG");
    capRec.onstart = () => {
      capOn = true;
      const b = $("#btnCaptions"); if (b) { b.classList.add("active"); b.textContent = "CC Stop captions"; }
      setCaptionStatus("Captioning ON — speak clearly. Students see a bottom caption banner.");
      toast("CC live captions ON", "ok");
    };
    capRec.onresult = (e) => {
      let text = "", final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      text = text.trim();
      if (!text) return;
      if (room) room.sendCaption(text, final);
      if (final) { captionLog(text, true); addChatMsg("CC transcript", text, true); }
    };
    capRec.onerror = (ev) => {
      const msg = ev && ev.error ? ev.error : "caption error";
      setCaptionStatus("Captioning issue: " + msg + ". You can start again.");
      if (msg !== "no-speech") toast("Captioning issue: " + msg, "err", 5000);
    };
    capRec.onend = () => {
      if (capOn) { try { capRec.start(); } catch { stopCaptions(true); } }
    };
    capRec.start();
  } catch (e) { toast("Could not start captions: " + e.message, "err", 6000); }
}
if ($("#btnCaptions")) on("#btnCaptions", "click", () => capOn ? stopCaptions() : startCaptions());
if ($("#btnTranscript")) on("#btnTranscript", "click", () => {
  const body = capLines.length ? capLines.map((l) => "[" + l.time + "] " + l.text).join("\n") : "No caption transcript yet.";
  downloadBlob(new Blob([body], { type: "text/plain" }), "classdeck-caption-transcript-" + currentRoomCode() + "-" + Date.now() + ".txt");
});


/* ------------------------------------------------------------
   ClassDesk v3: Enterprise security controls + Picture-in-Picture continuity
   ------------------------------------------------------------ */
const savedSecurityAudit = Store.get("security_audit", []);
const securityAudit = Array.isArray(savedSecurityAudit) ? savedSecurityAudit.slice(-500) : [];
function audit(event, detail) {
  const row = { time: nowStamp(), event, detail: String(detail || "").slice(0, 240), room: currentRoomCode(), device: Store.get("device_id", "") };
  securityAudit.push(row);
  while (securityAudit.length > 500) securityAudit.shift();
  Store.set("security_audit", securityAudit);
}
function auditCSV() {
  const rows = [["Time", "Event", "Detail", "Room", "Device"], ...securityAudit.map((r) => [r.time, r.event, r.detail, r.room, r.device])];
  return rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
}
if ($("#btnAuditCSV")) on("#btnAuditCSV", "click", () => {
  downloadBlob(new Blob([auditCSV()], { type: "text/csv" }), "classdeck-security-audit-" + currentRoomCode() + "-" + Date.now() + ".csv");
});

/* Forensic watermark: deters screen-recording/reselling by stamping teacher, room and device. */
function drawForensicWatermark(ctx, W, H) {
  if (!Store.get("security_watermark", true)) return;
  const acc = Store.get("account", null) || {};
  const text = ((acc.email || acc.name || "licensed teacher") + " · room " + currentRoomCode() + " · " + new Date().toLocaleString()).slice(0, 120);
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold " + Math.max(16, Math.round(W / 42)) + "px system-ui, sans-serif";
  ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7); ctx.textAlign = "center";
  for (let y = -H; y <= H; y += 120) ctx.fillText(text, 0, y, W * 1.3);
  ctx.restore();
}
const _drawCompositeBeforeSecurityWatermark = drawComposite;
drawComposite = function () { _drawCompositeBeforeSecurityWatermark(); drawForensicWatermark(COMP.ctx, COMP.w, COMP.h); };

/* PiP continuity: the browser requires a user gesture; once started, the app
   keeps a small live preview when the teacher switches/minimises. */
/* pip hoisted */
function ensurePipVideo() {
  if (pipVideo) return pipVideo;
  pipVideo = document.createElement("video");
  pipVideo.playsInline = true; pipVideo.muted = true; pipVideo.autoplay = true;
  pipVideo.style.cssText = "position:fixed;width:1px;height:1px;opacity:.01;pointer-events:none;left:-5px;bottom:-5px";
  document.body.appendChild(pipVideo);
  return pipVideo;
}
function startPipPump() {
  if (pipPump) return;
  pipPump = setInterval(() => { try { drawComposite(); } catch {} }, Math.max(250, 1000 / Math.max(1, COMP.fps || 4)));
}
function stopPipPumpIfSafe() { if (pipPump && !pipActive && !document.hidden) { clearInterval(pipPump); pipPump = null; } }
async function enterClassDeckPiP() {
  if (typeof authEnforce === "function" && !authEnforce()) return;
  if (!document.pictureInPictureEnabled) { toast("Picture-in-picture is not supported in this browser.", "err", 7000); return; }
  ensureCompositeForSocial && ensureCompositeForSocial();
  drawComposite();
  const v = ensurePipVideo();
  if (!pipStream) {
    pipStream = new MediaStream(COMP.canvas.captureStream(Math.max(4, COMP.fps || 8)).getVideoTracks());
  }
  v.srcObject = pipStream;
  await v.play().catch(() => {});
  try {
    await v.requestPictureInPicture();
    pipActive = true; startPipPump();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "ADEWALE CLASSROOM DECK live lesson", artist: "Adewale Samson Adeagbo · ADEWALE CLASSROOM" });
    }
    $("#btnPiP")?.classList.add("active");
    audit("pip-start", "Teacher started Picture-in-Picture continuity preview");
    toast("▣ PiP active — keep this small window open while switching/minimising.", "ok", 7000);
  } catch (e) { toast("PiP could not start: " + e.message, "err", 6000); }
}
function disposePipPreview() {
  try { pipStream && pipStream.getTracks().forEach((t) => t.stop()); } catch {}
  pipStream = null;
  if (pipVideo) {
    try { pipVideo.pause(); pipVideo.srcObject = null; } catch {}
    pipVideo.remove();
    pipVideo = null;
  }
  stopCompositeLoopIfUnused();
}
async function exitClassDeckPiP() {
  try { if (document.pictureInPictureElement && document.exitPictureInPicture) await document.exitPictureInPicture(); } catch {}
  if (!document.pictureInPictureElement) disposePipPreview();
}
if ($("#btnPiP")) on("#btnPiP", "click", () => document.pictureInPictureElement ? exitClassDeckPiP() : enterClassDeckPiP());
document.addEventListener("leavepictureinpicture", () => {
  pipActive = false;
  $("#btnPiP")?.classList.remove("active");
  stopPipPumpIfSafe();
  disposePipPreview();
  audit("pip-stop", "PiP closed");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (room || Store.get("wasLive", false))) {
    startPipPump();
    if (Store.get("auto_pip_reminder", false) && !pipActive) toast("Tip: tap ▣ PiP before minimising to keep the lesson visible.", "", 6000);
  } else stopPipPumpIfSafe();
});

/* Security event hooks */
audit("studio-open", location.href);
const _securityOnRoomEvent = onRoomEvent;
onRoomEvent = function (type, p) {
  _securityOnRoomEvent(type, p);
  if (["student-joined", "student-left", "waiting", "student-media", "student-media-end"].includes(type)) audit(type, p && (p.name || p.peerId || p.kind));
};

/* ------------------------------------------------------------
   v3.6 Keyboard shortcuts (USB/Bluetooth keyboard friendly)
   ------------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select")) return;
  const board = activeBoards()[0];
  const map = {
    "p": "pen", "h": "highlight", "e": "eraser", "l": "laser",
    "r": "rect", "o": "ellipse", "a": "arrow", "t": "text"
  };
  if (e.ctrlKey && e.key.toLowerCase() === "z") { board && board.wb.undo(); e.preventDefault(); return; }
  if (e.ctrlKey && e.key.toLowerCase() === "y") { board && board.wb.redo(); e.preventDefault(); return; }
  if (!e.ctrlKey && !e.altKey && map[e.key.toLowerCase()] && board) {
    board.wb.setTool(map[e.key.toLowerCase()]);
    $$('.tool[data-tool]', board.el).forEach((t) => t.classList.toggle("active", t.dataset.tool === map[e.key.toLowerCase()]));
    toast("Tool: " + map[e.key.toLowerCase()]);
  }
  if (e.key === "PageDown" && board) { board.wb.gotoPage(board.wb.pageIndex + 1); }
  if (e.key === "PageUp" && board) { board.wb.gotoPage(board.wb.pageIndex - 1); }
});

/* ------------------------------------------------------------
   v6 (issue 8): teacher licensing gate (SaaS)
   Students (join.html) are never gated. The Teacher Studio
   checks: valid license → OK ; else 3-day trial → OK ;
   else locked until a key is activated. Keys are generated
   on admin.html by ADEWALE CLASSROOM after payment.
   ------------------------------------------------------------ */
if (typeof requireTeacherAccess === "function") {
  requireTeacherAccess();
}

/* Issue: ?rec=1 deep link — opens the recording studio automatically after
   the auth gate has had a chance to pass. Falls back to toast guidance. */
if (new URLSearchParams(location.search).get("rec") === "1") {
  setTimeout(() => {
    const recBtn = document.getElementById("btnRec");
    if (recBtn) { try { recBtn.click(); } catch {} }
    else if (typeof toast === "function") toast("Tap ⏺ Rec to start recording", "", 4000);
  }, 1800);
  setTimeout(() => {
    if (!document.getElementById("mHmgRecSetup") || !document.getElementById("mHmgRecSetup").classList.contains("open")) {
      /* Nothing to do — the button click handles it; avoid double toasts. */
    }
  }, 4000);
}

/* ============================================================
   v8 FEATURES — competitive parity pack
   (researched against ClassIn, Nearpod, Pear Deck, Whiteboard.fi,
    ClassDojo, Mentimeter/Socrative, Kahoot/Blooket)
   ============================================================ */

/* ------------------------------------------------------------
   v8.1 STUDENT WHITEBOARDS (Whiteboard.fi's signature feature)
   Teacher starts boards → every student gets a personal canvas;
   strokes stream to the teacher's grid live; teacher can push
   their own current board page as the background for all.
   ------------------------------------------------------------ */
const stuBoards = new Map();   // peerId -> {canvas, ctx, name}

on("#btnBoards", "click", () => toggleDrawer("#drawerBoards"));

on("#boardsStart", "click", () => {
  if (!room) { toast("Go live first (▶ Go Live)", "err"); return; }
  room.startBoards(currentBoardPNG());
  $("#boardsStart").classList.add("hide");
  $("#boardsStop").classList.remove("hide");
  toast("🎨 Student boards ON — answers appear below as they draw", "ok", 5000);
});
on("#boardsStop", "click", () => {
  if (room) room.stopBoards();
  $("#boardsStop").classList.add("hide");
  $("#boardsStart").classList.remove("hide");
  stuBoards.clear();
  $("#boardsGrid").innerHTML = "";
});
on("#boardsPush", "click", () => {
  if (!room || !room.boardsOn) { toast("Start boards first"); return; }
  const png = currentBoardPNG();
  if (png) { room.pushBoardBg(png); toast("📤 Your board pushed to all students", "ok"); }
});

function currentBoardPNG() {
  const inst = (paneState.L.app === "board" && paneState.L.instances.board) ||
               (paneState.R.app === "board" && paneState.R.instances.board);
  if (!inst || !inst.wb) return null;
  try {
    const c = document.createElement("canvas");
    c.width = 640; c.height = Math.round(640 * inst.wb.canvas.height / Math.max(1, inst.wb.canvas.width));
    c.getContext("2d").drawImage(inst.wb.canvas, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } catch { return null; }
}

function renderStudentBoard(p) {
  let sb = stuBoards.get(p.peerId);
  if (!sb) {
    const tile = document.createElement("div");
    tile.className = "cam-tile";
    tile.style.background = "#fff";
    tile.innerHTML = '<canvas style="width:100%;height:100%"></canvas><span class="label">' + escapeHtml(p.name) + "</span>";
    tile.addEventListener("click", () => tile.classList.toggle("focus"));
    $("#boardsGrid").appendChild(tile);
    const canvas = tile.querySelector("canvas");
    canvas.width = 480; canvas.height = 360;
    sb = { canvas, ctx: canvas.getContext("2d"), name: p.name, strokes: [] };
    sb.ctx.fillStyle = "#fff";
    sb.ctx.fillRect(0, 0, 480, 360);
    stuBoards.set(p.peerId, sb);
  }
  if (p.full) { sb.strokes = p.strokes || []; }
  else sb.strokes.push(...(p.strokes || []));
  /* redraw */
  const ctx = sb.ctx;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 480, 360);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of sb.strokes) {
    ctx.strokeStyle = s.c || "#111";
    ctx.lineWidth = (s.w || 3);
    ctx.beginPath();
    (s.p || []).forEach(([x, y], i) => {
      i ? ctx.lineTo(x * 480, y * 360) : ctx.moveTo(x * 480, y * 360);
    });
    ctx.stroke();
  }
}

/* ------------------------------------------------------------
   v8.2 ACTIVITIES (Mentimeter/Pear Deck style)
   open question | live word cloud | exit ticket
   ------------------------------------------------------------ */
on("#btnActivity", "click", () => toggleDrawer("#drawerActivity"));

on("#actStart", "click", () => {
  if (!room) { toast("Go live first", "err"); return; }
  const kind = $("#actKind").value;
  let prompt = $("#actPrompt").value.trim();
  if (kind === "exit" && !prompt) prompt = "Before you go…";
  if (!prompt) { toast("Type a prompt", "err"); return; }
  if (!room.startActivity({ kind, prompt })) { toast("Enter a valid activity prompt", "err"); return; }
  $("#actSetup").classList.add("hide");
  $("#actLive").classList.remove("hide");
  $("#actLiveTitle").textContent = ({ open: "💬 ", cloud: "☁ ", board: "🧱 ", exit: "🎟 " })[kind] + prompt;
  $("#actResponses").innerHTML = "";
  $("#actCount").textContent = "0";
  toast("🧩 Activity sent to all students", "ok");
});

function endActivity(share) {
  if (!room) return;
  room.endActivity(share);
  $("#actSetup").classList.remove("hide");
  $("#actLive").classList.add("hide");
  toast(share ? "Results shown to the class" : "Activity ended");
}
on("#actEndShare", "click", () => endActivity(true));
on("#actEndQuiet", "click", () => endActivity(false));

function renderActivityResp(p) {
  $("#actCount").textContent = p.count;
  const div = document.createElement("div");
  const liveKind = room && room.activity && room.activity.def ? room.activity.def.kind : "open";
  if (typeof p.resp === "object" && p.resp && p.resp.rating !== undefined) {
    div.className = "chat-msg";
    div.innerHTML = '<div class="who">' + escapeHtml(p.name) + "</div>" +
      "⭐".repeat(Math.max(1, Math.min(5, p.resp.rating))) +
      "<br/><b>Learned:</b> " + escapeHtml(p.resp.learned || "—") +
      "<br/><b>Confusing:</b> " + escapeHtml(p.resp.confusing || "—");
  } else if (liveKind === "board") {
    div.className = "chat-msg";
    div.style.background = ["#fff9c4", "#dbeafe", "#dcfce7", "#fde2e7", "#ede9fe"][p.count % 5];
    div.style.color = "#152238";
    div.style.borderLeft = "4px solid var(--accent)";
    div.style.transform = "rotate(" + (((p.count % 5) - 2) * 1.2) + "deg)";
    div.innerHTML = '<div class="who" style="color:#152238">' + escapeHtml(p.name) + "</div>" + escapeHtml(String(p.resp));
  } else {
    div.className = "chat-msg";
    div.innerHTML = '<div class="who">' + escapeHtml(p.name) + "</div>" + escapeHtml(String(p.resp));
  }
  $("#actResponses").prepend(div);
}

/* ------------------------------------------------------------
   v8.3 BEHAVIOUR POINTS (ClassDojo style) — buttons per student
   added into the roster rows + class toast on award
   ------------------------------------------------------------ */
const AWARDS = [
  ["⭐", "Participation", 1], ["🤝", "Teamwork", 1], ["💡", "Great answer", 2], ["⚠", "Off-task", -1]
];

function attachAwardButtons() {
  if (!room) return;
  $$("#rosterList .stu-row").forEach((row) => {
    if (row.querySelector(".award-btn")) return;
    const name = row.querySelector(".name");
    const wrap = document.createElement("span");
    wrap.style.cssText = "display:flex;gap:2px";
    AWARDS.forEach(([emo, cat, delta]) => {
      const b = document.createElement("button");
      b.className = "btn small ghost award-btn";
      b.textContent = emo;
      b.title = cat + " (" + (delta > 0 ? "+" : "") + delta + ")";
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (!room) return;
        room.awardPoint(row.dataset.peerId, cat, delta, emo);
      });
      wrap.appendChild(b);
    });
    name.after(wrap);
  });
}
on("#btnBehaviorCSV", "click", () => {
  const dataRoom = room || lastEndedRoom;
  if (!dataRoom) { toast("Go live first"); return; }
  downloadBlob(new Blob([dataRoom.behaviorCSV()], { type: "text/csv" }),
    "behaviour-points-" + currentRoomCode() + "-" + Date.now() + ".csv");
});

/* ------------------------------------------------------------
   v8.4 GROUP MAKER (ClassDojo/ClassIn style)
   ------------------------------------------------------------ */
on("#btnGroups", "click", () => {
  if (!room) { toast("Go live first (▶ Go Live)", "err"); return; }
  if (room.students.size < 2) { toast("Need at least 2 students online to create groups", "err"); return; }
  const n = Math.min(room.students.size, Math.max(2, Number(prompt("How many groups?", "2")) || 2));
  const groups = room.makeGroups(n);
  const txt = groups.map((g, i) => "Group " + (i + 1) + ": " + g.join(", ")).join("\n");
  alert("Groups created — every student has been told their group:\n\n" + txt);
  if (room) room.sendAnnouncement("👥 Check your group number at the top of your screen!");
});

/* ------------------------------------------------------------
   v8 event hookup
   ------------------------------------------------------------ */
const _v7OnRoomEvent = onRoomEvent;
onRoomEvent = function (type, p) {
  _v7OnRoomEvent(type, p);
  if (type === "board-strokes") renderStudentBoard(p);
  if (type === "activity-resp") renderActivityResp(p);
  if (type === "award") toast(p.delta > 0 ? "⭐ +" + p.delta + " " + p.name : "⚠ " + p.delta + " " + p.name, "", 2500);
  if (type === "roster" || type === "student-joined") setTimeout(attachAwardButtons, 120);
};

/* ============================================================
   HMG BRANDED-RECORDING + PROMO HOOKS (appended AFTER all other
   declarations so the later function declarations WIN — this is
   the reliable way to extend strict-mode lexical functions).
   ------------------------------------------------------------
   • drawRecordingFrame()  → paints the 6s branded intro, then the
     normal lesson frame + lower-thirds/staff-pulse/text-ad overlays,
     then the 4s outro (driven by HMG_REC_SESSION state).
   • stopRecording()       → renders the outro for outroMs before
     finalising, so every saved video ends with the branded card.
   ============================================================ */
(function installHmgRecordHooks() {
  const s = window.HMG_REC_SESSION;
  if (s) s.sessionId = s.sessionId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  /* -------- drawRecordingFrame: branded intro → lesson → outro -------- */
  const _origRecordFrame = drawRecordingFrame;
  drawRecordingFrame = function () {
    const S = window.HMG_REC_SESSION;
    const hasHmg = !!window.HMGREC && typeof HMGREC.paintFrame === "function";
    /* Intro & outro phases fully replace the frame */
    if (hasHmg && S && S.startTs && HMGREC.paintFrame(window.recCanvas, window.recCtx)) {
      /* Also draw CBT link overlay during intro */
      try {
        var cbtUrl = localStorage.getItem("hmg_cbt_link") || "";
        if (cbtUrl && typeof window.drawCBTOverlay === "function" && window.recCtx && window.recCanvas) {
          window.drawCBTOverlay(window.recCtx, window.recCanvas.width, window.recCanvas.height, cbtUrl);
        }
      } catch(e) {}
      return;
    }
    /* Normal lesson frame (original branded recorder) */
    _origRecordFrame();
    /* Overlays: lower thirds + staff credentials popup + text ads */
    try {
      if (hasHmg && window.recCtx && window.recCanvas &&
          typeof HMGREC.overlayFrame === "function") {
        HMGREC.overlayFrame(window.recCtx, window.recCanvas.width, window.recCanvas.height);
      }
      /* CBT link */
      try {
        var cbtUrl = localStorage.getItem("hmg_cbt_link") || "";
        if (cbtUrl && typeof window.drawCBTOverlay === "function" && window.recCtx && window.recCanvas) {
          window.drawCBTOverlay(window.recCtx, window.recCanvas.width, window.recCanvas.height, cbtUrl);
        }
      } catch(e) {}
    } catch (e) { /* overlays must never break the recorder */ }
  };

  /* -------- stopRecording: render the outro before final save -------- */
  const _origStopRec = stopRecording;
  stopRecording = function () {
    const r = recorder;
    if (!r) return _origStopRec();
    const S = window.HMG_REC_SESSION;
    const hasHmg = !!window.HMGREC && typeof HMGREC.drawOutroFrame === "function";
    if (hasHmg && S && S.startTs && !S.ending && !S.ending) {
      S.ending = true;
      const flyerMs = S.showFlyerMs || 3000;
      const outroMs = S.outroMs || 4000;
      const totalEndMs = flyerMs + outroMs;
      const endDeadline = Date.now() + totalEndMs;
      (function endLoop() {
        var remaining = endDeadline - Date.now();
        if (remaining > 0 && window.recCanvas && window.recCtx) {
          try {
            var W = window.recCanvas.width, H = window.recCanvas.height;
            /* Show flyer for first flyerMs seconds, then outro */
            if (remaining > outroMs && window.HMGFlyer && typeof HMGFlyer.draw === "function") {
              HMGFlyer.draw(window.recCtx, W, H);
            } else {
              HMGREC.drawOutroFrame(window.recCanvas, window.recCtx, W, H);
            }
            /* CBT link if available */
            var cbtUrl = localStorage.getItem("hmg_cbt_link") || "";
            if (cbtUrl && typeof window.drawCBTOverlay === "function") {
              window.drawCBTOverlay(window.recCtx, W, H, cbtUrl);
            }
          } catch (e) {}
          requestAnimationFrame(endLoop);
          return;
        }
        _origStopRec();
      })();
      return;
    }
    _origStopRec();
  };

  /* -------- promo overlays on the LIVE broadcast (optional toggle) -------- */
  const _origPromoComposite = drawComposite;
  drawComposite = function () {
    _origPromoComposite();
    try {
      if (window.HMGREC && typeof HMGREC.broadcastOverlays === "function" &&
          Store.get("promo_broadcast", false)) {
        HMGREC.broadcastOverlays(COMP.ctx, COMP.w, COMP.h);
      }
    } catch (e) { /* never break the broadcast */ }
  };
})();

/* V37 — export studio APIs for toolbar-fix / portal bridge */
try {
  window.setFocus = typeof setFocus === 'function' ? setFocus : window.setFocus;
  window.goLive = typeof goLive === 'function' ? goLive : window.goLive;
  window.endLive = typeof endLive === 'function' ? endLive : window.endLive;
  window.toggleDrawer = typeof toggleDrawer === 'function' ? toggleDrawer : window.toggleDrawer;
  window.openModal = typeof openModal === 'function' ? openModal : window.openModal;
  window.closeModal = typeof closeModal === 'function' ? closeModal : window.closeModal;
  window.swapPanes = typeof swapPanes === 'function' ? swapPanes : window.swapPanes;
  window.applyLayout = typeof applyLayout === 'function' ? applyLayout : window.applyLayout;
  window.enterClassDeckPiP = typeof enterClassDeckPiP === 'function' ? enterClassDeckPiP : window.enterClassDeckPiP;
  window.exitClassDeckPiP = typeof exitClassDeckPiP === 'function' ? exitClassDeckPiP : window.exitClassDeckPiP;
  window.startRecording = typeof startRecording === 'function' ? startRecording : window.startRecording;
  window.stopRecording = typeof stopRecording === 'function' ? stopRecording : window.stopRecording;
  window.renderRoster = typeof renderRoster === 'function' ? renderRoster : window.renderRoster;
  window.renderWaiting = typeof renderWaiting === 'function' ? renderWaiting : window.renderWaiting;
  window.renderLessons = typeof renderLessons === 'function' ? renderLessons : window.renderLessons;
  window.refreshQuizBanks = typeof refreshQuizBanks === 'function' ? refreshQuizBanks : window.refreshQuizBanks;
  window.renderLeaderboard = typeof renderLeaderboard === 'function' ? renderLeaderboard : window.renderLeaderboard;
  window.focusOn = typeof focusOn !== 'undefined' ? focusOn : false;
} catch (e) { console.warn('[deck exports]', e); }


/* ============================================================================
   V38 — READY FLAG
   teach.js reached the end of the file without aborting, which means every
   toolbar listener above is bound and every top-level const is initialised.
   js/teach-toolbar-fix.js is a FALLBACK toolbar written while this file was
   dying at line ~1824; it binds the same buttons in the CAPTURE phase. With
   teach.js healthy, both handlers fire for one click — swapPanes() ran twice
   (net zero, "Swap does nothing") and layout skipped a mode. This flag lets
   the fallback stand down. If teach.js ever aborts again, the flag is never
   set and the fallback takes over exactly as before.
   ========================================================================== */
window.__DECK_TEACH_READY__ = true;
console.info('[deck] teach.js initialised cleanly — fallback toolbar standing down.');
