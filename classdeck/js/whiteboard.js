/* =========================================================
   ADEWALE CLASSROOM DECK — Whiteboard engine
   Multi-page, vector-stroke based (crisp at any size),
   pen / highlighter / eraser / shapes / text, undo-redo,
   autosave to localStorage, PNG export.
   v14 (round-8 item 3): every page is a LONG scrolling board —
   wheel / scrollbar / middle-mouse navigation, pinch + ctrl-wheel
   zoom anchored at the cursor, visible overlay scrollbars, and
   full-page PNG / PDF export (the whole scrollable page, not just
   the visible window). Strokes keep living in board coordinates,
   so old saved boards and live sync remain 100% compatible.
   ========================================================= */
"use strict";

class Whiteboard {
  constructor(stageEl, opts = {}) {
    this.stage = stageEl;
    this.onChange = opts.onChange || (() => {});
    this.transparent = !!opts.transparent;           // v2: transparent overlay mode (PDF annotation)
    this.persist = opts.persist !== false;           // v2: opt-out of autosave
    this.persistKey = opts.persistKey || "wb_pages";
    this.bgStyle = this.transparent ? "none" : Store.get("wb_bg", "plain"); // plain | grid | ruled | dark
    this.canvas = document.createElement("canvas");  // committed strokes
    this.overlay = document.createElement("canvas"); // live stroke preview
    this.stage.appendChild(this.canvas);
    this.stage.appendChild(this.overlay);
    this.ctx = this.canvas.getContext("2d");
    this.octx = this.overlay.getContext("2d");

    this.tool = "pen";
    this.color = opts.color || "#111111";
    this.size = opts.size || 3;
    this.view = { s: 1, x: 0, y: 0 };               // v4: per-board zoom/pan (pinch with 2 fingers)
    this.penOnly = Store.get("wb_penonly", false);  // v4: palm rejection — stylus draws, fingers only pinch/pan
    this.fillShapes = false;                        // v4: filled vs outlined shapes
    this._pointers = new Map();                     // v4: active pointers for pinch detection
    this._pinch = null;
    const savedPages = this.persist ? Store.get(this.persistKey, null) : null;
    this.pages = this._normalisePages(savedPages) || [this._newPage()];
    this.pageIndex = 0;
    this._lasers = [];                               // v2: fading laser strokes
    this._laserRaf = null;
    this.undoStack = [];
    this.redoStack = [];
    this.drawing = false;
    this.cur = null; // current stroke

    this._bindPointer();
    if (!this.transparent) this._makeScrollbars();   /* v14 */
    this._observeResize();
    this.resize();
  }

  /* v14: a page is worldH screens tall (default 3 — a long notebook page you
     scroll through). The PDF annotation overlay is locked to 1 (it must stay
     glued to the PDF page underneath). Existing saved pages without `h`
     normalise to 3 — their content simply sits in the top screen. */
  _newPage() { return { strokes: [], h: this.transparent ? 1 : 3 }; }
  get worldH() { return this.transparent ? 1 : Math.max(1, Math.min(8, Number(this.page && this.page.h) || 3)); }
  _normalisePages(value) {
    if (!Array.isArray(value) || !value.length) return null;
    const tools = new Set(["pen", "highlight", "eraser", "line", "arrow", "rect", "ellipse", "triangle", "diamond", "star", "text", "laser", "image"]);
    const pages = value.slice(0, 200).map((page) => {
      if (!page || typeof page !== "object") return null;
      const strokes = Array.isArray(page.strokes) ? page.strokes.slice(0, 5000).map((stroke) => {
        if (!stroke || typeof stroke !== "object" || !tools.has(stroke.tool) || !Array.isArray(stroke.pts)) return null;
        const pts = stroke.pts.slice(0, 1200).map((point) => {
          if (!point || typeof point !== "object") return null;
          const x = Number(point.x), y = Number(point.y);
          return Number.isFinite(x) && Number.isFinite(y)
            ? { x: Math.max(-2, Math.min(3, x)), y: Math.max(-2, Math.min(3, y)) }
            : null;
        }).filter(Boolean);
        if (!pts.length) return null;
        const color = /^#[0-9a-f]{3,8}$/i.test(String(stroke.color || "")) ? String(stroke.color) : "#111111";
        const size = Number(stroke.size);
        const out = { tool: stroke.tool, color, size: Number.isFinite(size) ? Math.max(1, Math.min(80, size)) : 3, pts };
        if (stroke.fill) out.fill = true;
        if (stroke.tool === "text") out.text = String(stroke.text || "").slice(0, 1000);
        if (stroke.tool === "image") {
          const data = String(stroke.data || "");
          const w = Number(stroke.w), h = Number(stroke.h);
          if (!/^data:image\//i.test(data) || data.length > 2_000_000 || !Number.isFinite(w) || !Number.isFinite(h)) return null;
          out.data = data; out.w = Math.max(0.01, Math.min(3, w)); out.h = Math.max(0.01, Math.min(3, h));
        }
        return out;
      }).filter(Boolean) : [];
      const h = this.transparent ? 1 : Math.max(1, Math.min(8, Number(page.h) || 3));
      return { strokes, h };
    }).filter(Boolean);
    return pages.length ? pages : null;
  }
  get page() { return this.pages[this.pageIndex] || this.pages[0]; }

  /* ---------- sizing ---------- */
  _observeResize() {
    new ResizeObserver(() => this.resize()).observe(this.stage);
  }
  resize() {
    const r = this.stage.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.overlay]) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    this.dpr = dpr;
    this.w = r.width; this.h = r.height;
    this.redraw();
  }

  /* ---------- pointer handling (v4: pinch zoom/pan + palm rejection, v14: wheel + middle-mouse) ---------- */
  _bindPointer() {
    const el = this.overlay;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => this._down(e));
    el.addEventListener("pointermove", (e) => this._move(e));
    el.addEventListener("pointerup",   (e) => this._up(e));
    el.addEventListener("pointercancel", (e) => this._up(e));
    el.addEventListener("pointerleave", (e) => { if (this.drawing) this._up(e); });
    /* v14: mouse wheel / trackpad = scroll the board (the round-8 ask).
       ctrl/⌘ + wheel = zoom anchored at the cursor. shift + wheel = sideways. */
    el.addEventListener("wheel", (e) => this._wheel(e), { passive: false });
  }
  _wheel(e) {
    if (this.transparent) return;        /* PDF annotation overlay: the PDF scroller owns the wheel */
    e.preventDefault();
    const v = this.view;
    const n = this._scr(e);
    if (e.ctrlKey || e.metaKey) {
      const oldS = v.s;
      const ns = Math.min(6, Math.max(1, oldS * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      const wx = (n.x - v.x) / oldS, wy = (n.y - v.y) / oldS;   /* keep the point under the cursor still */
      v.s = ns; v.x = n.x - wx * ns; v.y = n.y - wy * ns;
    } else {
      const r = this.overlay.getBoundingClientRect();
      const unit = (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1) / Math.max(1, r.height);
      /* rolling DOWN reveals content further down the long page (view.y is
         negative-going), exactly like every document scroller. */
      v.x -= (e.shiftKey ? e.deltaY : (e.deltaX || 0)) * unit;
      v.y -= (e.shiftKey ? 0 : e.deltaY) * unit;
    }
    this._clampView();
    this.redraw();
    if (this.onViewChange) this.onViewChange(this.view);
  }
  /* screen-normalised position (0..1 of the visible stage) */
  _scr(e) {
    const r = this.overlay.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }
  /* convert screen-normalised → world (board) coordinates through the view */
  _pos(e) {
    const n = this._scr(e);
    const v = this.view;
    return { x: (n.x - v.x) / v.s, y: (n.y - v.y) / v.s };
  }
  _clampView() {
    const v = this.view;
    v.s = Math.min(6, Math.max(1, v.s));
    v.x = Math.min(0, Math.max(1 - v.s, v.x));
    v.y = Math.min(0, Math.max(1 - v.s * this.worldH, v.y));   /* v14: scroll the whole page */
  }
  resetView() {
    this.view = { s: 1, x: 0, y: 0 };
    this.redraw();
    if (this.onViewChange) this.onViewChange(this.view);
  }
  _down(e) {
    e.preventDefault();
    this.overlay.setPointerCapture(e.pointerId);
    this._pointers.set(e.pointerId, { n: this._scr(e), type: e.pointerType });

    /* v14: middle mouse = grab-and-pan (the desktop equivalent of finger pan) */
    if (e.button === 1) {
      this._pan = { n0: this._scr(e), v0: { ...this.view } };
      return;
    }

    /* two fingers down → pinch zoom/pan THIS board only */
    if (this._pointers.size === 2) {
      if (this.drawing) {            // cancel half-drawn stroke
        this.drawing = false; this.cur = null;
        this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      }
      const [a, b] = [...this._pointers.values()].map((p) => p.n);
      this._pinch = {
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 0.001,
        mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        v0: { ...this.view }
      };
      return;
    }
    if (this._pinch) return;

    /* palm rejection: in pen-only mode a finger pans instead of drawing */
    if (this.penOnly && e.pointerType === "touch") {
      this._pan = { n0: this._scr(e), v0: { ...this.view } };
      return;
    }
    if (this.tool === "text") { this._placeText(e); return; }
    this.drawing = true;
    const p = this._pos(e);
    this.cur = {
      tool: this.tool, color: this.color, size: this.size,
      fill: this.fillShapes && ["rect", "ellipse", "triangle", "diamond", "star"].includes(this.tool),
      pts: [p]
    };
  }
  _move(e) {
    const rec = this._pointers.get(e.pointerId);
    if (rec) rec.n = this._scr(e);

    /* pinch zoom/pan */
    if (this._pinch && this._pointers.size >= 2) {
      e.preventDefault();
      const [a, b] = [...this._pointers.values()].map((p) => p.n);
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 0.001;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const p0 = this._pinch;
      let s = p0.v0.s * (d / p0.d0);
      s = Math.min(6, Math.max(1, s));
      // keep the world point under the original midpoint anchored, then follow the new midpoint
      const wx = (p0.mid0.x - p0.v0.x) / p0.v0.s;
      const wy = (p0.mid0.y - p0.v0.y) / p0.v0.s;
      this.view.s = s;
      this.view.x = mid.x - wx * s;
      this.view.y = mid.y - wy * s;
      this._clampView();
      this.redraw();
      if (this.onViewChange) this.onViewChange(this.view);
      return;
    }
    /* one-finger pan in pen-only mode */
    if (this._pan) {
      e.preventDefault();
      const n = this._scr(e);
      this.view.x = this._pan.v0.x + (n.x - this._pan.n0.x);
      this.view.y = this._pan.v0.y + (n.y - this._pan.n0.y);
      this._clampView();
      this.redraw();
      if (this.onViewChange) this.onViewChange(this.view);
      return;
    }
    if (!this.drawing || !this.cur) return;
    e.preventDefault();
    const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evts) this.cur.pts.push(this._pos(ev));
    this._drawPreview();
  }
  _up(e) {
    this._pointers.delete(e.pointerId);
    if (this._pointers.size < 2) this._pinch = null;
    if (this._pan && this._pointers.size === 0) this._pan = null;
    if (!this.drawing || !this.cur) return;
    this.drawing = false;
    const s = this.cur; this.cur = null;
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (s.tool === "laser") { this._addLaser(s); return; }   // laser never commits
    if (s.pts.length < 2 && !["rect", "ellipse", "line", "arrow"].includes(s.tool)) {
      // a dot tap → keep as tiny stroke
      s.pts.push({ x: s.pts[0].x + 0.0015, y: s.pts[0].y + 0.0015 });
    }
    this._commit(s);
  }

  /* ---------- v2: laser pointer (fades out, never saved) ---------- */
  _addLaser(s) {
    s.born = performance.now();
    this._lasers.push(s);
    if (!this._laserRaf) this._laserTick();
  }
  _laserTick() {
    this._laserRaf = requestAnimationFrame(() => {
      const now = performance.now();
      this._lasers = this._lasers.filter((l) => now - l.born < 1400);
      this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      if (this.cur) this._drawStroke(this.octx, this.cur);
      for (const l of this._lasers) {
        this.octx.save();
        this.octx.globalAlpha = Math.max(0, 1 - (now - l.born) / 1400);
        this._drawStroke(this.octx, Object.assign({}, l, { tool: "pen", color: "#ff2d2d", size: Math.max(4, l.size) }));
        this.octx.restore();
      }
      if (this._lasers.length || this.cur) this._laserTick();
      else { this._laserRaf = null; this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height); }
    });
  }
  _placeText(e) {
    const p = this._pos(e);
    const txt = prompt("Text to place on the board:");
    if (!txt) return;
    this._commit({ tool: "text", color: this.color, size: this.size, pts: [p], text: txt });
  }

  _commit(stroke) {
    this.page.strokes.push(stroke);
    this.undoStack.push({ type: "add", page: this.pageIndex });
    this.redoStack.length = 0;
    this.redraw();
    this._save();
    this.onChange();
  }

  /* ---------- v14: overlay scrollbars (visible, draggable) ----------
     The board canvas is fixed-size, so native scrollbars cannot exist.
     These two slim tracks show WHERE you are on the long page and can be
     dragged directly. They sit above the ink layer only at the very edges. */
  _makeScrollbars() {
    try { if (!getComputedStyle(this.stage).position || getComputedStyle(this.stage).position === "static") this.stage.style.position = "relative"; } catch (e) { try { this.stage.style.position = "relative"; } catch (e2) {} }
    const mk = (vert) => {
      const track = document.createElement("div");
      track.className = "wb-sb " + (vert ? "wb-sbv" : "wb-sbh");
      track.style.cssText = vert
        ? "position:absolute;top:4px;bottom:16px;right:4px;width:10px;z-index:30;border-radius:8px;background:rgba(120,130,170,.20);touch-action:none"
        : "position:absolute;left:4px;right:16px;bottom:4px;height:10px;z-index:30;border-radius:8px;background:rgba(120,130,170,.20);touch-action:none";
      const thumb = document.createElement("div");
      thumb.style.cssText = "position:absolute;border-radius:8px;background:rgba(90,105,180,.60);cursor:pointer;touch-action:none";
      if (vert) thumb.style.width = "100%"; else thumb.style.height = "100%";
      track.appendChild(thumb);
      this.stage.appendChild(track);
      thumb.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        try { thumb.setPointerCapture(e.pointerId); } catch (err) {}
        const start = vert ? e.clientY : e.clientX;
        const v0 = { ...this.view };
        const span = vert ? this.worldH : 1;
        const move = (ev) => {
          const r = this.overlay.getBoundingClientRect();
          const trackPx = Math.max(40, (vert ? r.height : r.width));
          const d = ((vert ? ev.clientY - start : ev.clientX - start) / trackPx) * span * this.view.s;
          if (vert) this.view.y = v0.y - d; else this.view.x = v0.x - d;
          this._clampView(); this.redraw();
          if (this.onViewChange) this.onViewChange(this.view);
        };
        const up = () => { thumb.removeEventListener("pointermove", move); thumb.removeEventListener("pointerup", up); };
        thumb.addEventListener("pointermove", move);
        thumb.addEventListener("pointerup", up);
      });
      return { track, thumb, vert };
    };
    this._sbv = mk(true);
    this._sbh = mk(false);
  }
  _updateScrollbars() {
    if (!this._sbv) return;
    const v = this.view, wh = this.worldH;
    const showV = wh > 1 && v.s * wh > 1.001;
    const showH = v.s > 1.001;
    this._sbv.track.style.display = showV ? "block" : "none";
    this._sbh.track.style.display = showH ? "block" : "none";
    if (showV) {
      const frac = Math.max(0.08, Math.min(1, 1 / (v.s * wh)));
      const top = Math.min(1 - frac, Math.max(0, (-v.y / v.s) / wh));
      this._sbv.thumb.style.height = (frac * 100) + "%";
      this._sbv.thumb.style.top = (top * 100) + "%";
    }
    if (showH) {
      const frac = Math.max(0.08, Math.min(1, 1 / v.s));
      const left = Math.min(1 - frac, Math.max(0, -v.x / v.s));
      this._sbh.thumb.style.width = (frac * 100) + "%";
      this._sbh.thumb.style.left = (left * 100) + "%";
    }
  }

  /* ---------- rendering ---------- */
  _styleFor(ctx, s) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
    ctx.globalAlpha = s.tool === "highlight" ? 0.35 : 1;
    const color = s.tool === "laser" ? "#ff2d2d" : s.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const base = s.tool === "eraser" ? s.size * 6 : s.tool === "highlight" ? s.size * 4
               : s.tool === "laser" ? Math.max(4, s.size) : s.size;
    ctx.lineWidth = base * this.dpr;
  }
  _drawStroke(ctx, s, W, H) {
    W = W || this.canvas.width; H = H || this.canvas.height;
    const v = this.view || { s: 1, x: 0, y: 0 };
    const X = (p) => (p.x * v.s + v.x) * W, Y = (p) => (p.y * v.s + v.y) * H;
    this._styleFor(ctx, s);
    ctx.lineWidth *= v.s;   // ink thickens proportionally when zoomed
    const a = s.pts[0], b = s.pts[s.pts.length - 1];
    ctx.beginPath();
    switch (s.tool) {
      case "line":
        ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); break;
      case "arrow": {
        ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        const ang = Math.atan2(Y(b) - Y(a), X(b) - X(a));
        const hl = Math.max(12 * this.dpr, ctx.lineWidth * 3);
        ctx.beginPath();
        ctx.moveTo(X(b), Y(b));
        ctx.lineTo(X(b) - hl * Math.cos(ang - 0.45), Y(b) - hl * Math.sin(ang - 0.45));
        ctx.moveTo(X(b), Y(b));
        ctx.lineTo(X(b) - hl * Math.cos(ang + 0.45), Y(b) - hl * Math.sin(ang + 0.45));
        ctx.stroke(); break;
      }
      case "rect": {
        const rx = Math.min(X(a), X(b)), ry = Math.min(Y(a), Y(b));
        const rw = Math.abs(X(b) - X(a)), rh = Math.abs(Y(b) - Y(a));
        if (s.fill) ctx.fillRect(rx, ry, rw, rh); else ctx.strokeRect(rx, ry, rw, rh);
        break;
      }
      case "ellipse":
        ctx.ellipse((X(a) + X(b)) / 2, (Y(a) + Y(b)) / 2,
                    Math.abs(X(b) - X(a)) / 2, Math.abs(Y(b) - Y(a)) / 2, 0, 0, Math.PI * 2);
        if (s.fill) ctx.fill(); else ctx.stroke();
        break;
      case "triangle": {  // v4
        ctx.moveTo((X(a) + X(b)) / 2, Y(a));
        ctx.lineTo(X(a), Y(b)); ctx.lineTo(X(b), Y(b)); ctx.closePath();
        if (s.fill) ctx.fill(); else ctx.stroke();
        break;
      }
      case "diamond": {   // v4
        const mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
        ctx.moveTo(mx, Y(a)); ctx.lineTo(X(b), my); ctx.lineTo(mx, Y(b)); ctx.lineTo(X(a), my); ctx.closePath();
        if (s.fill) ctx.fill(); else ctx.stroke();
        break;
      }
      case "star": {      // v4: 5-point star in the drag box
        const mx = (X(a) + X(b)) / 2, my = (Y(a) + Y(b)) / 2;
        const R = Math.max(Math.abs(X(b) - X(a)), Math.abs(Y(b) - Y(a))) / 2;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? R : R * 0.42;
          const ang = -Math.PI / 2 + (i * Math.PI) / 5;
          const px2 = mx + r * Math.cos(ang), py2 = my + r * Math.sin(ang);
          i === 0 ? ctx.moveTo(px2, py2) : ctx.lineTo(px2, py2);
        }
        ctx.closePath();
        if (s.fill) ctx.fill(); else ctx.stroke();
        break;
      }
      case "text": {
        const v2 = this.view || { s: 1 };
        const px = Math.max(16, s.size * 9) * this.dpr * v2.s;
        ctx.font = `${px}px system-ui, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(s.text || "", X(a), Y(a)); break;
      }
      case "image": {   // v3: image stamp {pts:[topleft], w, h (relative), data}
        const img = this._imgCache(s);
        const v2 = this.view || { s: 1 };
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, X(a), Y(a), s.w * W * v2.s, s.h * H * v2.s);
        }
        break;
      }
      default: { // pen / highlight / eraser — smooth quadratic path
        ctx.moveTo(X(s.pts[0]), Y(s.pts[0]));
        for (let i = 1; i < s.pts.length - 1; i++) {
          const mx = (X(s.pts[i]) + X(s.pts[i + 1])) / 2;
          const my = (Y(s.pts[i]) + Y(s.pts[i + 1])) / 2;
          ctx.quadraticCurveTo(X(s.pts[i]), Y(s.pts[i]), mx, my);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  _drawBackground(ctx, W, H) {
    W = W || this.canvas.width; H = H || this.canvas.height;
    if (this.transparent || this.bgStyle === "none") {       // v2: annotation overlay
      ctx.clearRect(0, 0, W, H);
      return;
    }
    ctx.fillStyle = this.bgStyle === "dark" ? "#10141f" : "#ffffff"; // v2: dark board
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = this.bgStyle === "dark" ? "rgba(140,170,255,.16)" : "rgba(70,110,255,.18)";
    ctx.lineWidth = 1;
    const step = 36 * this.dpr;
    if (this.bgStyle === "grid") {
      ctx.beginPath();
      for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (this.bgStyle === "ruled") {
      ctx.beginPath();
      for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (this.bgStyle === "handwriting" || this.bgStyle === "fourline") {
      const group = (this.bgStyle === "fourline" ? 72 : 84) * this.dpr;
      const left = 56 * this.dpr;
      ctx.strokeStyle = "rgba(224,43,43,.30)"; ctx.lineWidth = 1.5 * this.dpr;
      ctx.beginPath(); ctx.moveTo(left, 0); ctx.lineTo(left, H); ctx.stroke();
      for (let y = group * .8; y < H; y += group) {
        ctx.strokeStyle = "rgba(21,101,216,.40)"; ctx.lineWidth = 1.2 * this.dpr;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.strokeStyle = "rgba(21,101,216,.20)"; ctx.lineWidth = 1 * this.dpr;
        ctx.beginPath(); ctx.moveTo(0, y - group/3); ctx.lineTo(W, y - group/3); ctx.moveTo(0, y + group/3); ctx.lineTo(W, y + group/3);
        if (this.bgStyle === "fourline") { ctx.moveTo(0, y - group/6); ctx.lineTo(W, y - group/6); }
        ctx.stroke();
      }
    } else if (this.bgStyle === "graphpaper") {
      const small = 12 * this.dpr, big = small * 5;
      ctx.strokeStyle = "rgba(70,110,255,.10)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = small; x < W; x += small) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = small; y < H; y += small) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = "rgba(70,110,255,.24)"; ctx.beginPath();
      for (let x = big; x < W; x += big) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = big; y < H; y += big) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
  }
  redraw() {
    this._drawBackground(this.ctx, this.canvas.width, this.canvas.height);
    for (const s of this.page.strokes) this._drawStroke(this.ctx, s);
    this._updateScrollbars();   /* v14 */
  }
  /* v14: render the ENTIRE scrollable page (all worldH screens) onto an
     offscreen canvas — used by PNG/PDF export so the whole page is captured,
     not just the visible window. */
  _renderPageFull(pageObj) {
    const W = this.canvas.width, H = Math.round(this.canvas.height * Math.max(1, Math.min(8, Number(pageObj.h) || 3)));
    const tmp = document.createElement("canvas");
    tmp.width = W; tmp.height = H;
    const tctx = tmp.getContext("2d");
    const keepIdx = this.pageIndex, keepView = { ...this.view };
    this.pageIndex = this.pages.indexOf(pageObj);
    this.view = { s: 1, x: 0, y: 0 };
    this._drawBackground(tctx, W, H);
    for (const s of pageObj.strokes) this._drawStroke(tctx, s, W, H);
    this.pageIndex = keepIdx; this.view = keepView;
    return tmp;
  }
  _drawPreview() {
    this.octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (this.cur) this._drawStroke(this.octx, this.cur);
  }

  /* ---------- public API ---------- */
  setTool(t)  { this.tool = t; }
  setColor(c) { this.color = /^#[0-9a-f]{3,8}$/i.test(String(c)) ? String(c) : "#111111"; }
  setSize(s)  { this.size = Math.max(1, Math.min(80, Number(s) || 3)); }
  setBackground(style) { this.bgStyle = style; Store.set("wb_bg", style); this.redraw(); this.onChange(); }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    if (op.type === "add") {
      const s = this.pages[op.page].strokes.pop();
      this.redoStack.push({ type: "add", page: op.page, stroke: s });
    } else if (op.type === "clear") {
      this.pages[op.page].strokes = op.strokes;
      this.redoStack.push({ type: "clear", page: op.page });
    }
    this.redraw(); this._save(); this.onChange();
  }
  redo() {
    const op = this.redoStack.pop();
    if (!op) return;
    if (op.type === "add") {
      this.pages[op.page].strokes.push(op.stroke);
      this.undoStack.push({ type: "add", page: op.page });
    } else if (op.type === "clear") {
      const old = this.pages[op.page].strokes;
      this.pages[op.page].strokes = [];
      this.undoStack.push({ type: "clear", page: op.page, strokes: old });
    }
    this.redraw(); this._save(); this.onChange();
  }
  clearPage() {
    this.undoStack.push({ type: "clear", page: this.pageIndex, strokes: this.page.strokes });
    this.pages[this.pageIndex] = this._newPage();
    this.redoStack.length = 0;
    this.redraw(); this._save(); this.onChange();
  }
  addPage()  { this.undoStack.length = 0; this.redoStack.length = 0; this.pages.push(this._newPage()); this.gotoPage(this.pages.length - 1); this._save(); }
  gotoPage(i) {
    this.pageIndex = Math.max(0, Math.min(this.pages.length - 1, i));
    this.redraw(); this.onChange();
  }
  deletePage() {
    if (this.pages.length <= 1) { this.clearPage(); return; }
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.pages.splice(this.pageIndex, 1);
    this.gotoPage(Math.min(this.pageIndex, this.pages.length - 1));
    this._save();
  }
  exportPNG() {
    /* v14: exports the WHOLE scrollable page */
    const tmp = this._renderPageFull(this.page);
    tmp.toBlob((b) => {
      if (b) downloadBlob(b, `whiteboard-page${this.pageIndex + 1}-${Date.now()}.png`);
      else toast("Could not export this board as an image", "err");
    });
  }
  setPenOnly(v) { this.penOnly = v; Store.set("wb_penonly", v); }
  setFill(v) { this.fillShapes = v; }

  /* ---------- v3: image stamps ---------- */
  _imgCache(s) {
    if (!this._imgs) this._imgs = new Map();
    let img = this._imgs.get(s.data);
    if (!img) {
      img = new Image();
      img.onload = () => this.redraw();
      img.src = s.data;
      this._imgs.set(s.data, img);
    }
    return img;
  }
  async insertImage(file, maxRel = 0.55) {
    // downscale to keep autosave light
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
    });
    const maxPx = 900;
    let dw = img.naturalWidth, dh = img.naturalHeight;
    const k = Math.min(1, maxPx / Math.max(dw, dh));
    dw = Math.round(dw * k); dh = Math.round(dh * k);
    const c = document.createElement("canvas");
    c.width = dw; c.height = dh;
    c.getContext("2d").drawImage(img, 0, 0, dw, dh);
    const data = c.toDataURL("image/jpeg", 0.8);
    // place centred, sized relative to board
    const ar = dw / dh;
    let w = maxRel, h = (maxRel * (this.w / this.h)) / ar;
    if (h > 0.8) { h = 0.8; w = h * ar * (this.h / this.w); }
    this._commit({ tool: "image", color: "#000", size: 1, pts: [{ x: (1 - w) / 2, y: (1 - h) / 2 }], w, h, data });
  }

  /* ---------- v3: export the whole deck as a PDF ---------- */
  async exportDeckPDF(filename) {
    /* v14: every page exported at full scrollable height */
    const jpegs = [];
    for (let i = 0; i < this.pages.length; i++) {
      const tmp = this._renderPageFull(this.pages[i]);
      await new Promise((r) => setTimeout(r, 30)); // allow image stamps to paint
      jpegs.push({ dataUrl: tmp.toDataURL("image/jpeg", 0.85), width: tmp.width, height: tmp.height });
    }
    this.redraw();
    downloadBlob(jpegsToPdf(jpegs), filename || `whiteboard-deck-${Date.now()}.pdf`);
  }
  exportAllJSON() {
    downloadBlob(new Blob([JSON.stringify(this.pages)], { type: "application/json" }),
      `whiteboard-${Date.now()}.json`);
  }
  importJSON(json) {
    try {
      const pages = this._normalisePages(JSON.parse(json));
      if (!pages) throw new Error("empty or malformed board");
      this.pages = pages;
      this.undoStack.length = 0; this.redoStack.length = 0;
      this.gotoPage(0); this._save();
    } catch { toast("Invalid whiteboard file", "err"); }
  }
  _save() {
    if (!this.persist) return;
    // keep autosave light: cap stored data ~2.5MB
    try {
      const data = JSON.stringify(this.pages);
      if (data.length < 2_500_000) Store.set(this.persistKey, this.pages);
    } catch {}
  }
}
