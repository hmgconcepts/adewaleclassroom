/* ============================================================
   HMG ACADEMY CLASS DECK v6 — Toolkit extensions
   Adds 14 extension interactive tools + an 181-card reference library
   (toolkit-data.js) to the v5 Toolkit class = 202 tool modes.

   Interactive tools:
     📐 construct  — geometry construction simulator (ruler,
                     compass arcs, protractor measure/draw,
                     perpendicular & angle bisectors)
     🕐 clock      — teaching clock (drag hands, digital read-out)
     📏 numline    — number line (integers/decimals/fractions hop)
     🧮 abacus     — place-value abacus (millions → units)
     🍕 fraction   — fraction visualizer (circle & bar, compare 2)
     🎲 random     — dice (1–3), coin flip, spinner, name picker
     📊 tally      — tally chart & live bar chart builder
     🏅 score      — team scoreboard (4 teams)
     🌡 thermo     — interactive thermometer (-20…120 °C)
     ⚖ balance    — algebra balance scales (solve x visually)
     🔢 hundred    — interactive hundred square (skip counting)
     🅰 letters    — letter & number formation tracing guides
     📇 cards      — reference library browser (181 cards, search)
   ============================================================ */
"use strict";

/* ---------------- shared helpers ---------------- */
Toolkit.prototype._fitFont = function (px) { return Math.max(10, px) + "px system-ui, sans-serif"; };

/* extension state initialiser */
Toolkit.prototype._extInit = function () {
  if (this._ext) return;
  this._ext = {
    /* construction */
    con: { tool: "ruler", steps: [], temp: null, showProtractor: false, protAngle: null },
    /* clock */
    clock: { h: 10, m: 10, dragging: null },
    /* number line */
    nl: { min: -10, max: 10, step: 1, marks: [] },
    /* abacus: beads per column [M, HTh, TTh, Th, H, T, U] */
    ab: { cols: [0, 0, 0, 0, 0, 0, 0] },
    /* fraction */
    fr: { n1: 1, d1: 2, n2: 2, d2: 3, mode: "circle" },
    /* random */
    rnd: { mode: "dice", dice: [3], coin: "?", spinning: false, spinAngle: 0, names: [], picked: "" },
    /* tally */
    tally: { items: [["Option A", 0], ["Option B", 0], ["Option C", 0]] },
    /* scoreboard */
    sc: { teams: [["Red", 0, "#e02b2b"], ["Blue", 0, "#1565d8"], ["Green", 0, "#0a8a3a"], ["Yellow", 0, "#f59e0b"]], n: 2 },
    /* thermometer */
    th: { val: 25 },
    /* balance */
    bal: { left: "x + 3", right: "7", x: 4, reveal: false },
    /* hundred square */
    hs: { skip: 0, marks: new Set() },
    /* letters */
    lt: { char: "A" },
    /* cards */
    cd: { cat: "All", idx: 0, query: "" }
  };
};

/* ---------------- dispatcher ---------------- */
Toolkit.prototype._drawExt = function () {
  this._extInit();
  const fn = {
    noise: this._drawNoise,
    construct: this._drawConstruct, clock: this._drawClock, numline: this._drawNumline,
    abacus: this._drawAbacus, fraction: this._drawFraction, random: this._drawRandom,
    tally: this._drawTally, score: this._drawScore, thermo: this._drawThermo,
    balance: this._drawBalance, hundred: this._drawHundred, letters: this._drawLetters,
    cards: this._drawCards
  }[this.mode];
  if (fn) fn.call(this);
};

Toolkit.prototype._tapExt = function (x, y) {
  this._extInit();
  const fn = {
    noise: this._tapNoise,
    construct: this._tapConstruct, clock: this._tapClock, numline: this._tapNumline,
    abacus: this._tapAbacus, random: this._tapRandom, tally: this._tapTally,
    score: this._tapScore, thermo: this._tapThermo, hundred: this._tapHundred,
    cards: this._tapCards, balance: this._tapBalance
  }[this.mode];
  if (fn) { fn.call(this, x, y); return true; }
  return false;
};

/* ============================================================
   📐 GEOMETRY CONSTRUCTION SIMULATOR (issue 2)
   Tools (set via toolbar): ruler | compass | protractor |
   perpbis (perpendicular bisector) | angbis (angle bisector) |
   point | erase
   Interaction = drag: press → drag → release.
   ============================================================ */
Toolkit.prototype.constructSetTool = function (t) { this._extInit(); this._ext.con.tool = t; this.draw(); };
Toolkit.prototype.constructUndo = function () { this._extInit(); this._ext.con.steps.pop(); this.draw(); };
Toolkit.prototype.constructClear = function () { this._extInit(); this._ext.con.steps = []; this.draw(); };

Toolkit.prototype.bindConstructPointers = function () {
  /* drag-based construction needs move events; bind once */
  if (this._conBound) return;
  this._conBound = true;
  const cvs = this.canvas;
  const P = (e) => {
    const r = cvs.getBoundingClientRect();
    const k = cvs.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  let drag = null;
  cvs.addEventListener("pointerdown", (e) => {
    if (this.mode !== "construct") return;
    const c = this._ext.con;
    const p = this._snap(P(e));
    if (c.tool === "point") {
      c.steps.push({ t: "point", a: p });
      this.draw(); return;
    }
    if (c.tool === "erase") {
      // remove nearest step within 30px
      let best = -1, bd = 30 * (cvs.width / cvs.getBoundingClientRect().width);
      c.steps.forEach((s, i) => {
        const d = Math.hypot((s.a ? s.a.x : 0) - p.x, (s.a ? s.a.y : 0) - p.y);
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) c.steps.splice(best, 1);
      this.draw(); return;
    }
    drag = { start: p };
    cvs.setPointerCapture(e.pointerId);
  });
  cvs.addEventListener("pointermove", (e) => {
    if (this.mode !== "construct" || !drag) return;
    const c = this._ext.con;
    const p = this._snap(P(e));
    c.temp = { t: c.tool, a: drag.start, b: p };
    this.draw();
  });
  cvs.addEventListener("pointerup", (e) => {
    if (this.mode !== "construct" || !drag) return;
    const c = this._ext.con;
    const p = this._snap(P(e));
    const a = drag.start; drag = null; c.temp = null;
    if (Math.hypot(p.x - a.x, p.y - a.y) < 6) { this.draw(); return; }
    switch (c.tool) {
      case "ruler":   c.steps.push({ t: "seg", a, b: p }); break;
      case "compass": c.steps.push({ t: "arc", a, r: Math.hypot(p.x - a.x, p.y - a.y) }); break;
      case "protractor": c.steps.push({ t: "ray", a, b: p }); break;
      case "perpbis": c.steps.push({ t: "perpbis", a, b: p }); break;
      case "angbis": {
        // angle bisector: drag from vertex; uses last two rays/segments from same vertex if found,
        // else bisects between drag direction and horizontal
        const rays = c.steps.filter((s) => (s.t === "seg" || s.t === "ray") && Math.hypot(s.a.x - a.x, s.a.y - a.y) < 20);
        if (rays.length >= 2) {
          const r1 = rays[rays.length - 2], r2 = rays[rays.length - 1];
          const a1 = Math.atan2(r1.b.y - a.y, r1.b.x - a.x);
          const a2 = Math.atan2(r2.b.y - a.y, r2.b.x - a.x);
          c.steps.push({ t: "bis", a, ang: (a1 + a2) / 2 });
        } else {
          c.steps.push({ t: "bis", a, ang: Math.atan2(p.y - a.y, p.x - a.x) / 2 });
        }
        break;
      }
    }
    this.draw();
  });
};
/* snap to existing points/intersections within 14px for accurate construction */
Toolkit.prototype._snap = function (p) {
  const c = this._ext.con;
  const k = this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
  const SN = 16 * k;
  let best = null, bd = SN;
  const consider = (q) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } };
  for (const s of c.steps) {
    if (s.a) consider(s.a);
    if (s.b) consider(s.b);
  }
  return best ? { x: best.x, y: best.y } : p;
};

Toolkit.prototype._drawConstruct = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const c = this._ext.con;
  /* paper-like grid */
  ctx.fillStyle = "#fbfcff"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e8edf8"; ctx.lineWidth = 1;
  const g = Math.max(24, W / 40);
  ctx.beginPath();
  for (let x = g; x < W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = g; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  const drawStep = (s, ghost) => {
    ctx.strokeStyle = ghost ? "rgba(21,101,216,.45)" : "#1565d8";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(2, W / 640);
    ctx.setLineDash(s.t === "perpbis" || s.t === "bis" ? [8, 6] : []);
    ctx.beginPath();
    switch (s.t) {
      case "point":
        ctx.arc(s.a.x, s.a.y, Math.max(4, W / 320), 0, Math.PI * 2); ctx.fill(); break;
      case "seg": case "ray": case "ruler": case "protractor":
        ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
        // endpoints + length label
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(s.a.x, s.a.y, 4, 0, 7); ctx.arc(s.b.x, s.b.y, 4, 0, 7); ctx.fill();
        if (!ghost) {
          const len = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) / g;
          ctx.font = this._fitFont(W / 70);
          ctx.fillStyle = "#456";
          ctx.fillText(len.toFixed(1) + " u", (s.a.x + s.b.x) / 2 + 8, (s.a.y + s.b.y) / 2 - 8);
        }
        break;
      case "arc": case "compass":
        ctx.arc(s.a.x, s.a.y, s.r || Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(s.a.x, s.a.y, 3.5, 0, 7); ctx.fill();
        break;
      case "perpbis": {
        ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
        const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
        const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) + Math.PI / 2;
        const L = Math.max(W, H);
        ctx.strokeStyle = ghost ? "rgba(224,43,43,.45)" : "#e02b2b";
        ctx.beginPath();
        ctx.moveTo(mx - Math.cos(ang) * L, my - Math.sin(ang) * L);
        ctx.lineTo(mx + Math.cos(ang) * L, my + Math.sin(ang) * L);
        ctx.stroke();
        // tick marks for equal halves
        ctx.setLineDash([]);
        for (const t of [0.25, 0.75]) {
          const tx = s.a.x + (s.b.x - s.a.x) * t, ty = s.a.y + (s.b.y - s.a.y) * t;
          ctx.beginPath();
          ctx.moveTo(tx - Math.cos(ang) * 7, ty - Math.sin(ang) * 7);
          ctx.lineTo(tx + Math.cos(ang) * 7, ty + Math.sin(ang) * 7);
          ctx.stroke();
        }
        break;
      }
      case "bis": {
        const L = Math.max(W, H);
        ctx.strokeStyle = ghost ? "rgba(10,138,58,.45)" : "#0a8a3a";
        ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.a.x + Math.cos(s.ang) * L, s.a.y + Math.sin(s.ang) * L);
        ctx.stroke();
        break;
      }
    }
    ctx.setLineDash([]);
  };
  for (const s of c.steps) drawStep(s, false);
  if (c.temp) drawStep({ ...c.temp, t: { ruler: "seg", compass: "arc", protractor: "ray", perpbis: "perpbis", angbis: "bis" }[c.temp.t] || c.temp.t, r: c.temp.b ? Math.hypot(c.temp.b.x - c.temp.a.x, c.temp.b.y - c.temp.a.y) : 0, ang: c.temp.b ? Math.atan2(c.temp.b.y - c.temp.a.y, c.temp.b.x - c.temp.a.x) : 0 }, true);

  /* live protractor overlay for the protractor tool */
  if (c.tool === "protractor" && c.temp && c.temp.b) {
    const a = c.temp.a, b = c.temp.b;
    const ang = Math.atan2(-(b.y - a.y), b.x - a.x);
    let deg = ang * 180 / Math.PI; if (deg < 0) deg += 360;
    const R = Math.min(W, H) * 0.18;
    ctx.strokeStyle = "rgba(245,158,11,.8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(a.x, a.y, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + R * 1.15, a.y); ctx.stroke();
    for (let d = 0; d < 360; d += 10) {
      const rr = d % 30 === 0 ? R * 0.88 : R * 0.94;
      ctx.beginPath();
      ctx.moveTo(a.x + Math.cos(d * Math.PI / 180) * rr, a.y - Math.sin(d * Math.PI / 180) * rr);
      ctx.lineTo(a.x + Math.cos(d * Math.PI / 180) * R, a.y - Math.sin(d * Math.PI / 180) * R);
      ctx.stroke();
    }
    ctx.fillStyle = "#b45309"; ctx.font = "bold " + this._fitFont(W / 50);
    ctx.fillText(deg.toFixed(0) + "°", a.x + R * 0.5, a.y - R * 0.5);
  }

  /* hint bar */
  ctx.fillStyle = "rgba(16,20,43,.82)"; ctx.fillRect(0, H - Math.max(26, H * 0.05), W, Math.max(26, H * 0.05));
  ctx.fillStyle = "#fff"; ctx.font = this._fitFont(W / 75); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const hints = {
    ruler: "RULER: drag to draw a line segment (length shown in grid units). Points snap together.",
    compass: "COMPASS: press at the CENTRE, drag out to the radius, release — draws a full arc/circle.",
    protractor: "PROTRACTOR: drag from a vertex — live angle (°) is measured as you drag; release to keep the ray.",
    perpbis: "PERPENDICULAR BISECTOR: drag a segment — its red bisector appears with equal-half tick marks.",
    angbis: "ANGLE BISECTOR: draw two segments from the SAME vertex first, then drag from that vertex.",
    point: "POINT: tap to place a labelled point.",
    erase: "ERASE: tap near any element to remove it."
  };
  ctx.fillText("📐 " + (hints[c.tool] || ""), 10, H - Math.max(13, H * 0.025));
  ctx.textAlign = "left";
};
Toolkit.prototype._tapConstruct = function () { /* handled by drag pointers */ };

/* ============================================================
   🕐 TEACHING CLOCK
   ============================================================ */
Toolkit.prototype._drawClock = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const c = this._ext.clock;
  const cx = W / 2, cy = H * 0.52, R = Math.min(W, H) * 0.36;
  ctx.fillStyle = "#fffef5"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#1e2a78"; ctx.lineWidth = Math.max(5, R * 0.04);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // numbers + ticks
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(R * 0.16); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(i, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    ctx.strokeStyle = i % 5 ? "#b6c2e2" : "#1e2a78"; ctx.lineWidth = i % 5 ? 1.5 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * (i % 5 ? 0.94 : 0.9), cy + Math.sin(a) * R * (i % 5 ? 0.94 : 0.9));
    ctx.lineTo(cx + Math.cos(a) * R * 0.985, cy + Math.sin(a) * R * 0.985);
    ctx.stroke();
  }
  // hands
  const mAng = (c.m / 60) * Math.PI * 2 - Math.PI / 2;
  const hAng = ((c.h % 12) / 12 + c.m / 720) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = "#0a8a3a"; ctx.lineWidth = Math.max(6, R * 0.05); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(hAng) * R * 0.5, cy + Math.sin(hAng) * R * 0.5); ctx.stroke();
  ctx.strokeStyle = "#e02b2b"; ctx.lineWidth = Math.max(4, R * 0.032);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mAng) * R * 0.74, cy + Math.sin(mAng) * R * 0.74); ctx.stroke();
  ctx.fillStyle = "#1e2a78"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.045, 0, 7); ctx.fill();
  // digital + words
  const hh = c.h % 12 === 0 ? 12 : c.h % 12;
  const ampm = c.h < 12 ? "AM" : "PM";
  ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.045); ctx.textAlign = "center";
  ctx.fillText(String(hh).padStart(2, "0") + ":" + String(c.m).padStart(2, "0") + " " + ampm, cx, H * 0.07);
  const mins = c.m;
  let words;
  if (mins === 0) words = hh + " o'clock";
  else if (mins === 15) words = "quarter past " + hh;
  else if (mins === 30) words = "half past " + hh;
  else if (mins === 45) words = "quarter to " + (hh % 12 + 1);
  else if (mins < 30) words = mins + " min past " + hh;
  else words = (60 - mins) + " min to " + (hh % 12 + 1);
  ctx.font = this._fitFont(W * 0.026); ctx.fillStyle = "#555";
  ctx.fillText("“" + words + "”  — tap near the rim to move the MINUTE hand, inside to move the HOUR hand", cx, H * 0.95);
};
Toolkit.prototype._tapClock = function (x, y) {
  const { W, H } = this._dims();
  const c = this._ext.clock;
  const cx = W / 2, cy = H * 0.52, R = Math.min(W, H) * 0.36;
  const d = Math.hypot(x - cx, y - cy);
  if (d > R * 1.15) return;
  let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
  if (a < 0) a += Math.PI * 2;
  if (d > R * 0.55) {
    c.m = Math.round(a / (Math.PI * 2) * 60) % 60;
  } else {
    c.h = (Math.round(a / (Math.PI * 2) * 12) % 12) + (c.h >= 12 ? 12 : 0);
  }
  this.draw();
};

/* ============================================================
   📏 NUMBER LINE
   ============================================================ */
Toolkit.prototype._drawNumline = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const n = this._ext.nl;
  ctx.fillStyle = "#f7fbff"; ctx.fillRect(0, 0, W, H);
  const y = H * 0.55, x0 = W * 0.06, x1 = W * 0.94;
  const range = n.max - n.min;
  const px = (v) => x0 + (v - n.min) / range * (x1 - x0);
  ctx.strokeStyle = "#1e2a78"; ctx.lineWidth = Math.max(3, H / 200);
  ctx.beginPath(); ctx.moveTo(x0 - 14, y); ctx.lineTo(x1 + 14, y); ctx.stroke();
  // arrows
  for (const [ax, dir] of [[x0 - 14, 1], [x1 + 14, -1]]) {
    ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax + dir * 12, y - 8); ctx.moveTo(ax, y); ctx.lineTo(ax + dir * 12, y + 8); ctx.stroke();
  }
  const stepCount = Math.round(range / n.step);
  const labelEvery = Math.ceil(stepCount / 24);
  for (let i = 0; i <= stepCount; i++) {
    const v = n.min + i * n.step;
    const X = px(v);
    const major = i % labelEvery === 0;
    ctx.beginPath(); ctx.moveTo(X, y - (major ? 14 : 8)); ctx.lineTo(X, y + (major ? 14 : 8)); ctx.stroke();
    if (major) {
      ctx.fillStyle = v === 0 ? "#e02b2b" : "#1e2a78";
      ctx.font = (v === 0 ? "bold " : "") + this._fitFont(W / 55);
      ctx.textAlign = "center";
      ctx.fillText(Math.round(v * 100) / 100, X, y + H * 0.07);
    }
  }
  // marks + hops
  ctx.fillStyle = "#e02b2b";
  n.marks.forEach((v, i) => {
    ctx.beginPath(); ctx.arc(px(v), y, Math.max(6, W / 180), 0, 7); ctx.fill();
    if (i > 0) {
      const a = px(n.marks[i - 1]), b = px(v);
      ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a, y - 6); ctx.quadraticCurveTo((a + b) / 2, y - H * 0.16, b, y - 6); ctx.stroke();
      ctx.fillStyle = "#b45309"; ctx.font = "bold " + this._fitFont(W / 60); ctx.textAlign = "center";
      ctx.fillText(((v - n.marks[i - 1]) > 0 ? "+" : "") + Math.round((v - n.marks[i - 1]) * 100) / 100, (a + b) / 2, y - H * 0.17);
      ctx.fillStyle = "#e02b2b"; ctx.strokeStyle = "#1e2a78";
    }
  });
  ctx.fillStyle = "#555"; ctx.font = this._fitFont(W / 70); ctx.textAlign = "center";
  ctx.fillText("Tap the line to place jump points — hops show the difference. Use the bar above to set range/step.", W / 2, H * 0.93);
};
Toolkit.prototype._tapNumline = function (x, y) {
  const { W, H } = this._dims();
  const n = this._ext.nl;
  const ly = H * 0.55;
  if (Math.abs(y - ly) > H * 0.2) { n.marks = []; this.draw(); return; }
  const x0 = W * 0.06, x1 = W * 0.94;
  let v = n.min + (x - x0) / (x1 - x0) * (n.max - n.min);
  v = Math.round(v / n.step) * n.step;
  v = Math.max(n.min, Math.min(n.max, Math.round(v * 100) / 100));
  n.marks.push(v);
  if (n.marks.length > 8) n.marks.shift();
  this.draw();
};

/* ============================================================
   🧮 PLACE-VALUE ABACUS
   ============================================================ */
const AB_LABELS = ["M", "HTh", "TTh", "Th", "H", "T", "U"];
Toolkit.prototype._drawAbacus = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const a = this._ext.ab;
  ctx.fillStyle = "#fff8ef"; ctx.fillRect(0, 0, W, H);
  const n = 7, gw = W / (n + 1);
  const baseY = H * 0.78, topY = H * 0.2;
  // frame
  ctx.fillStyle = "#8d6e63"; ctx.fillRect(W * 0.06, baseY, W * 0.88, H * 0.04);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const x = gw * (i + 1);
    ctx.strokeStyle = "#6d4c41"; ctx.lineWidth = Math.max(5, W / 220);
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, topY); ctx.stroke();
    // beads
    const beadR = Math.min(gw * 0.3, (baseY - topY) / 22);
    for (let b = 0; b < a.cols[i]; b++) {
      ctx.fillStyle = ["#e02b2b", "#1565d8", "#0a8a3a", "#f59e0b", "#8b5cf6", "#00838f", "#c2185b"][i];
      ctx.beginPath();
      ctx.ellipse(x, baseY - beadR - b * beadR * 2.1, beadR * 1.6, beadR, 0, 0, 7);
      ctx.fill();
    }
    ctx.fillStyle = "#4e342e"; ctx.font = "bold " + this._fitFont(W / 45); ctx.textAlign = "center";
    ctx.fillText(AB_LABELS[i], x, baseY + H * 0.1);
    ctx.font = this._fitFont(W / 60);
    ctx.fillText(a.cols[i], x, topY - H * 0.04);
    total += a.cols[i] * Math.pow(10, n - 1 - i);
  }
  ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.045); ctx.textAlign = "center";
  ctx.fillText("Number: " + total.toLocaleString(), W / 2, H * 0.08);
  ctx.fillStyle = "#777"; ctx.font = this._fitFont(W / 72);
  ctx.fillText("Tap upper half of a rod to ADD a bead, lower half to REMOVE (max 9 per rod)", W / 2, H * 0.965);
};
Toolkit.prototype._tapAbacus = function (x, y) {
  const { W, H } = this._dims();
  const a = this._ext.ab;
  const n = 7, gw = W / (n + 1);
  const i = Math.round(x / gw) - 1;
  if (i < 0 || i >= n) return;
  if (y < H * 0.5) a.cols[i] = Math.min(9, a.cols[i] + 1);
  else a.cols[i] = Math.max(0, a.cols[i] - 1);
  this.draw();
};

/* ============================================================
   🍕 FRACTION VISUALIZER
   ============================================================ */
Toolkit.prototype._drawFraction = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const f = this._ext.fr;
  ctx.fillStyle = "#fffdf6"; ctx.fillRect(0, 0, W, H);
  const draw1 = (n, d, cx, color) => {
    if (f.mode === "circle") {
      const R = Math.min(W, H) * 0.21, cy = H * 0.42;
      for (let i = 0; i < d; i++) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, (i / d) * 7 - Math.PI / 2, ((i + 1) / d) * Math.PI * 2 - Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = i < n ? color : "#f1f3f8";
        ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
      }
      ctx.strokeStyle = "#445"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    } else {
      const bw = W * 0.34, bh = H * 0.14, bx = cx - bw / 2, by = H * 0.36;
      for (let i = 0; i < d; i++) {
        ctx.fillStyle = i < n ? color : "#f1f3f8";
        ctx.fillRect(bx + (i / d) * bw, by, bw / d - 2, bh);
        ctx.strokeStyle = "#445"; ctx.strokeRect(bx + (i / d) * bw, by, bw / d - 2, bh);
      }
    }
    ctx.fillStyle = color; ctx.font = "bold " + this._fitFont(W * 0.05); ctx.textAlign = "center";
    ctx.fillText(n + "/" + d, cx, H * 0.72);
    ctx.font = this._fitFont(W * 0.024); ctx.fillStyle = "#555";
    ctx.fillText("= " + (n / d).toFixed(3) + " = " + (n / d * 100).toFixed(1) + "%", cx, H * 0.78);
  };
  draw1(f.n1, f.d1, W * 0.28, "#1565d8");
  draw1(f.n2, f.d2, W * 0.72, "#e02b2b");
  const v1 = f.n1 / f.d1, v2 = f.n2 / f.d2;
  const sym = Math.abs(v1 - v2) < 1e-9 ? "=" : v1 > v2 ? ">" : "<";
  ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.07); ctx.textAlign = "center";
  ctx.fillText(sym, W / 2, H * 0.45);
  ctx.font = "bold " + this._fitFont(W * 0.03);
  ctx.fillText(f.n1 + "/" + f.d1 + "  " + sym + "  " + f.n2 + "/" + f.d2, W / 2, H * 0.9);
};

/* ============================================================
   🎲 RANDOMISERS: dice, coin, spinner, name picker
   ============================================================ */
Toolkit.prototype._drawRandom = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const r = this._ext.rnd;
  ctx.fillStyle = "#f4f8ff"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  if (r.mode === "dice") {
    const n = r.dice.length, s = Math.min(W / (n + 1.2), H * 0.4);
    r.dice.forEach((v, i) => {
      const cx = W / 2 + (i - (n - 1) / 2) * s * 1.25, cy = H * 0.45;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1e2a78"; ctx.lineWidth = Math.max(3, s * 0.04);
      const x = cx - s / 2, y = cy - s / 2, rad = s * 0.16;
      ctx.beginPath(); ctx.roundRect(x, y, s, s, rad); ctx.fill(); ctx.stroke();
      const pip = (px, py) => { ctx.beginPath(); ctx.arc(cx + px * s * 0.27, cy + py * s * 0.27, s * 0.075, 0, 7); ctx.fill(); };
      ctx.fillStyle = "#e02b2b";
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      P.forEach(([a, b]) => pip(a, b));
    });
    const total = r.dice.reduce((a, b) => a + b, 0);
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.04);
    ctx.fillText(n > 1 ? "Total: " + total : "You rolled " + total + "!", W / 2, H * 0.82);
  } else if (r.mode === "coin") {
    const Rr = Math.min(W, H) * 0.22;
    ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.arc(W / 2, H * 0.45, Rr, 0, 7); ctx.fill();
    ctx.strokeStyle = "#b45309"; ctx.lineWidth = Rr * 0.07; ctx.stroke();
    ctx.fillStyle = "#7c2d12"; ctx.font = "bold " + this._fitFont(Rr * 0.5);
    ctx.fillText(r.coin, W / 2, H * 0.45 + Rr * 0.16);
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.035);
    ctx.fillText(r.coin === "?" ? "Tap to flip!" : r.coin === "H" ? "HEADS!" : "TAILS!", W / 2, H * 0.82);
  } else if (r.mode === "spinner") {
    const Rr = Math.min(W, H) * 0.3, cx = W / 2, cy = H * 0.48;
    const segs = 8, cols = ["#e02b2b", "#f59e0b", "#0a8a3a", "#1565d8", "#8b5cf6", "#c2185b", "#00838f", "#6d4c41"];
    for (let i = 0; i < segs; i++) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, Rr, r.spinAngle + (i / segs) * 7, r.spinAngle + ((i + 1) / segs) * Math.PI * 2);
      ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold " + this._fitFont(Rr * 0.16);
      const mid = r.spinAngle + ((i + 0.5) / segs) * Math.PI * 2;
      ctx.fillText(i + 1, cx + Math.cos(mid) * Rr * 0.65, cy + Math.sin(mid) * Rr * 0.65 + Rr * 0.05);
    }
    ctx.fillStyle = "#1e2a78";
    ctx.beginPath(); ctx.moveTo(cx, cy - Rr - 18); ctx.lineTo(cx - 14, cy - Rr + 8); ctx.lineTo(cx + 14, cy - Rr + 8); ctx.closePath(); ctx.fill();
    ctx.font = this._fitFont(W * 0.024);
    ctx.fillText(r.spinning ? "Spinning…" : "Tap the wheel to spin (1–8)", W / 2, H * 0.92);
  } else if (r.mode === "names") {
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.06);
    ctx.fillText(r.picked || "Tap to pick a name!", W / 2, H * 0.45);
    ctx.fillStyle = "#777"; ctx.font = this._fitFont(W * 0.02);
    ctx.fillText(r.names.length + " name(s) loaded — set them in the bar above (comma-separated)", W / 2, H * 0.9);
  }
};
Toolkit.prototype._tapRandom = function () {
  const r = this._ext.rnd;
  if (r.mode === "dice") {
    r.dice = r.dice.map(() => 1 + Math.floor(Math.random() * 6));
  } else if (r.mode === "coin") {
    r.coin = Math.random() < 0.5 ? "H" : "T";
  } else if (r.mode === "spinner" && !r.spinning) {
    r.spinning = true;
    const target = r.spinAngle + Math.PI * 4 + Math.random() * Math.PI * 2;
    const t0 = performance.now(), dur = 2200;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const ease = 1 - Math.pow(1 - k, 3);
      r.spinAngle = r.spinAngle + (target - r.spinAngle) * ease * 0.2 + 0.0001;
      this.draw();
      if (k < 1) requestAnimationFrame(tick);
      else { r.spinning = false; this.draw(); }
    };
    requestAnimationFrame(tick);
  } else if (r.mode === "names" && r.names.length) {
    r.picked = r.names[Math.floor(Math.random() * r.names.length)];
  }
  this.draw();
};

/* ============================================================
   📊 TALLY CHART
   ============================================================ */
Toolkit.prototype._drawTally = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const t = this._ext.tally;
  ctx.fillStyle = "#fbfdff"; ctx.fillRect(0, 0, W, H);
  const rows = t.items.length;
  const rh = Math.min(H * 0.7 / rows, H * 0.18);
  const y0 = H * 0.12;
  const maxV = Math.max(5, ...t.items.map((i) => i[1]));
  t.items.forEach(([name, v], i) => {
    const y = y0 + i * rh;
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(rh * 0.3); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(name, W * 0.04, y + rh / 2);
    // tally strokes
    ctx.strokeStyle = "#333"; ctx.lineWidth = Math.max(2, rh * 0.045);
    const tx0 = W * 0.3;
    for (let k = 0; k < v; k++) {
      const group = Math.floor(k / 5), pos = k % 5;
      const gx = tx0 + group * rh * 0.85;
      if (pos < 4) {
        ctx.beginPath();
        ctx.moveTo(gx + pos * rh * 0.14, y + rh * 0.22);
        ctx.lineTo(gx + pos * rh * 0.14, y + rh * 0.78);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(gx - rh * 0.05, y + rh * 0.7);
        ctx.lineTo(gx + 3 * rh * 0.14 + rh * 0.05, y + rh * 0.3);
        ctx.stroke();
      }
    }
    // bar
    const bx = W * 0.66, bw = W * 0.26;
    ctx.fillStyle = "#e8edf8"; ctx.fillRect(bx, y + rh * 0.25, bw, rh * 0.5);
    ctx.fillStyle = ["#1565d8", "#e02b2b", "#0a8a3a", "#f59e0b", "#8b5cf6"][i % 5];
    ctx.fillRect(bx, y + rh * 0.25, bw * (v / maxV), rh * 0.5);
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(rh * 0.3); ctx.textAlign = "left";
    ctx.fillText(v, bx + bw + 8, y + rh / 2);
  });
  ctx.fillStyle = "#777"; ctx.font = this._fitFont(W / 70); ctx.textAlign = "center";
  ctx.fillText("Tap a row's LEFT half to +1, RIGHT half to −1. Rename/add rows in the bar above.", W / 2, H * 0.95);
};
Toolkit.prototype._tapTally = function (x, y) {
  const { W, H } = this._dims();
  const t = this._ext.tally;
  const rows = t.items.length;
  const rh = Math.min(H * 0.7 / rows, H * 0.18);
  const i = Math.floor((y - H * 0.12) / rh);
  if (i < 0 || i >= rows) return;
  if (x < W / 2) t.items[i][1]++;
  else t.items[i][1] = Math.max(0, t.items[i][1] - 1);
  this.draw();
};

/* ============================================================
   🏅 SCOREBOARD
   ============================================================ */
Toolkit.prototype._drawScore = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const s = this._ext.sc;
  ctx.fillStyle = "#10142b"; ctx.fillRect(0, 0, W, H);
  const n = s.n, cw = W / n;
  for (let i = 0; i < n; i++) {
    const [name, pts, color] = s.teams[i];
    const x = i * cw;
    ctx.fillStyle = color; ctx.globalAlpha = 0.16;
    ctx.fillRect(x + 6, H * 0.08, cw - 12, H * 0.84);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, H * 0.08, cw - 12, H * 0.84);
    ctx.fillStyle = color; ctx.font = "bold " + this._fitFont(Math.min(cw * 0.16, H * 0.09)); ctx.textAlign = "center";
    ctx.fillText(name, x + cw / 2, H * 0.2);
    ctx.fillStyle = "#fff"; ctx.font = "bold " + this._fitFont(Math.min(cw * 0.4, H * 0.34));
    ctx.fillText(pts, x + cw / 2, H * 0.56);
    ctx.font = this._fitFont(Math.min(cw * 0.09, H * 0.05)); ctx.fillStyle = "#9aa3cf";
    ctx.fillText("tap top +1 · bottom −1", x + cw / 2, H * 0.85);
  }
};
Toolkit.prototype._tapScore = function (x, y) {
  const { W, H } = this._dims();
  const s = this._ext.sc;
  const i = Math.floor(x / (W / s.n));
  if (i < 0 || i >= s.n) return;
  if (y < H * 0.6) s.teams[i][1]++;
  else s.teams[i][1] = Math.max(0, s.teams[i][1] - 1);
  this.draw();
};

/* ============================================================
   🌡 THERMOMETER
   ============================================================ */
Toolkit.prototype._drawThermo = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const t = this._ext.th;
  ctx.fillStyle = "#f3f9ff"; ctx.fillRect(0, 0, W, H);
  const x = W * 0.38, top = H * 0.08, bot = H * 0.78, bw = Math.max(18, W * 0.035);
  const MIN = -20, MAX = 120;
  const py = (v) => bot - (v - MIN) / (MAX - MIN) * (bot - top);
  // tube
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x - bw / 2, top - 10, bw, bot - top + 20, bw / 2); ctx.fill(); ctx.stroke();
  // mercury
  ctx.fillStyle = "#e02b2b";
  ctx.fillRect(x - bw * 0.25, py(t.val), bw * 0.5, bot - py(t.val) + 10);
  ctx.beginPath(); ctx.arc(x, bot + bw * 0.7, bw * 0.9, 0, 7); ctx.fill();
  // scale
  for (let v = MIN; v <= MAX; v += 10) {
    const Y = py(v);
    ctx.strokeStyle = "#445"; ctx.lineWidth = v % 20 ? 1 : 2.5;
    ctx.beginPath(); ctx.moveTo(x + bw * 0.7, Y); ctx.lineTo(x + bw * (v % 20 ? 1.1 : 1.5), Y); ctx.stroke();
    if (v % 20 === 0) {
      ctx.fillStyle = "#1e2a78"; ctx.font = this._fitFont(W / 60); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(v + "°C", x + bw * 1.7, Y);
    }
  }
  // key temps
  const KEY = [[0, "Water freezes ❄"], [37, "Body temperature 🧍"], [100, "Water boils ♨"], [25, "Room temp 🏠"]];
  KEY.forEach(([v, label]) => {
    ctx.strokeStyle = "#1565d8"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + bw * 2.6, py(v)); ctx.lineTo(W * 0.62, py(v)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#1565d8"; ctx.font = this._fitFont(W / 65); ctx.textAlign = "left";
    ctx.fillText(label + " (" + v + "°C)", W * 0.63, py(v));
  });
  // current
  const F = t.val * 9 / 5 + 32, K = t.val + 273.15;
  ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.045); ctx.textAlign = "center";
  ctx.fillText(t.val + " °C", W * 0.2, H * 0.16);
  ctx.font = this._fitFont(W * 0.022); ctx.fillStyle = "#555";
  ctx.fillText("= " + F.toFixed(1) + " °F = " + K.toFixed(1) + " K", W * 0.2, H * 0.22);
  ctx.font = this._fitFont(W / 70);
  ctx.fillText("Tap anywhere on the tube to set the temperature", W / 2, H * 0.95);
};
Toolkit.prototype._tapThermo = function (x, y) {
  const { H } = this._dims();
  const top = H * 0.08, bot = H * 0.78;
  if (y < top - 20 || y > bot + 30) return;
  const MIN = -20, MAX = 120;
  this._ext.th.val = Math.round(MIN + (bot - y) / (bot - top) * (MAX - MIN));
  this._ext.th.val = Math.max(MIN, Math.min(MAX, this._ext.th.val));
  this.draw();
};

/* ============================================================
   ⚖ ALGEBRA BALANCE
   ============================================================ */
Toolkit.prototype.setBalance = function (xVal, addend, multiplier) {
  this._extInit();
  const b = this._ext.bal;
  b.x = xVal;
  b.left = (multiplier > 1 ? multiplier + "x" : "x") + (addend ? " + " + addend : "");
  b.right = String(multiplier * xVal + addend);
  b.mult = multiplier; b.add = addend; b.reveal = false;
  this.draw();
};
Toolkit.prototype._drawBalance = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const b = this._ext.bal;
  if (b.mult === undefined) { b.mult = 1; b.add = 3; b.x = 4; b.left = "x + 3"; b.right = "7"; }
  ctx.fillStyle = "#fffbf2"; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, beamY = H * 0.35, beamW = W * 0.6;
  // stand
  ctx.strokeStyle = "#6d4c41"; ctx.lineWidth = Math.max(6, W / 160); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, beamY); ctx.lineTo(cx, H * 0.72); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - W * 0.12, H * 0.72); ctx.lineTo(cx + W * 0.12, H * 0.72); ctx.stroke();
  // beam (balanced)
  ctx.strokeStyle = "#4e342e";
  ctx.beginPath(); ctx.moveTo(cx - beamW / 2, beamY); ctx.lineTo(cx + beamW / 2, beamY); ctx.stroke();
  ctx.fillStyle = "#4e342e"; ctx.beginPath(); ctx.arc(cx, beamY, W / 90, 0, 7); ctx.fill();
  // pans
  const pan = (px, label, color) => {
    ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px - W * 0.08, beamY); ctx.lineTo(px - W * 0.1, beamY + H * 0.14);
    ctx.moveTo(px + W * 0.08, beamY); ctx.lineTo(px + W * 0.1, beamY + H * 0.14); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = "#445"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(px, beamY + H * 0.16, W * 0.13, H * 0.035, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.045); ctx.textAlign = "center";
    ctx.fillText(label, px, beamY + H * 0.3);
  };
  pan(cx - beamW / 2, b.left, "#bbdefb");
  pan(cx + beamW / 2, b.right, "#ffcdd2");
  ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + this._fitFont(W * 0.035); ctx.textAlign = "center";
  ctx.fillText("The scales BALANCE  ⇒  " + b.left + " = " + b.right, cx, H * 0.1);
  if (b.reveal) {
    ctx.fillStyle = "#0a8a3a"; ctx.font = "bold " + this._fitFont(W * 0.04);
    const steps = b.add ? b.left + " = " + b.right + "  →  " + (b.mult > 1 ? b.mult + "x" : "x") + " = " + (b.mult * b.x) + "  →  x = " + b.x : "x = " + b.x;
    ctx.fillText(steps, cx, H * 0.88);
  } else {
    ctx.fillStyle = "#b45309"; ctx.font = this._fitFont(W * 0.025);
    ctx.fillText("What is x? — tap anywhere to reveal the solution. Set a new puzzle in the bar above.", cx, H * 0.88);
  }
};
Toolkit.prototype._tapBalance = function () { this._ext.bal.reveal = !this._ext.bal.reveal; this.draw(); };

/* ============================================================
   🔢 HUNDRED SQUARE
   ============================================================ */
Toolkit.prototype._drawHundred = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const h = this._ext.hs;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const cs = Math.min(W / 10.6, H / 10.9);
  const ox = (W - cs * 10) / 2, oy = (H - cs * 10) / 2 + cs * 0.2;
  for (let i = 1; i <= 100; i++) {
    const r = Math.floor((i - 1) / 10), c = (i - 1) % 10;
    const x = ox + c * cs, y = oy + r * cs;
    const skipHit = h.skip > 1 && i % h.skip === 0;
    const marked = h.marks.has(i);
    ctx.fillStyle = marked ? "#ffb347" : skipHit ? "#c5e1a5" : (r + c) % 2 ? "#f4f7fd" : "#fff";
    ctx.fillRect(x, y, cs - 1.5, cs - 1.5);
    ctx.fillStyle = "#223"; ctx.font = (skipHit || marked ? "bold " : "") + this._fitFont(cs * 0.36);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(i, x + cs / 2, y + cs / 2);
  }
  ctx.fillStyle = "#555"; ctx.font = this._fitFont(W / 70); ctx.textAlign = "center";
  ctx.fillText((h.skip > 1 ? "Counting in " + h.skip + "s (green). " : "") + "Tap any number to mark/unmark it (orange). Set skip-counting in the bar above.", W / 2, H * 0.97);
};
Toolkit.prototype._tapHundred = function (x, y) {
  const { W, H } = this._dims();
  const h = this._ext.hs;
  const cs = Math.min(W / 10.6, H / 10.9);
  const ox = (W - cs * 10) / 2, oy = (H - cs * 10) / 2 + cs * 0.2;
  const c = Math.floor((x - ox) / cs), r = Math.floor((y - oy) / cs);
  if (c < 0 || c > 9 || r < 0 || r > 9) return;
  const n = r * 10 + c + 1;
  h.marks.has(n) ? h.marks.delete(n) : h.marks.add(n);
  this.draw();
};

/* ============================================================
   🅰 LETTER / NUMBER FORMATION
   ============================================================ */
Toolkit.prototype._drawLetters = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const l = this._ext.lt;
  ctx.fillStyle = "#fffef8"; ctx.fillRect(0, 0, W, H);
  // handwriting guides
  const top = H * 0.22, mid = H * 0.47, base = H * 0.72, desc = H * 0.85;
  for (const [y, style] of [[top, "#90caf9"], [mid, "#ef9a9a"], [base, "#1e2a78"], [desc, "#b0bec5"]]) {
    ctx.strokeStyle = style; ctx.lineWidth = y === base ? 3 : 1.6;
    ctx.setLineDash(y === mid ? [10, 8] : []);
    ctx.beginPath(); ctx.moveTo(W * 0.05, y); ctx.lineTo(W * 0.95, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // big letter pair
  const px = (base - top) * 1.35;
  ctx.fillStyle = "rgba(30,42,120,.18)";
  ctx.font = "bold " + px + "px 'Comic Sans MS', 'Segoe Print', cursive, system-ui";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const isLetter = /[A-Za-z]/.test(l.char);
  const show = isLetter ? l.char.toUpperCase() + " " + l.char.toLowerCase() : l.char;
  ctx.fillText(show, W / 2, base);
  ctx.strokeStyle = "#1e2a78"; ctx.lineWidth = 2;
  ctx.strokeText(show, W / 2, base);
  ctx.fillStyle = "#555"; ctx.font = this._fitFont(W / 55); ctx.textAlign = "center";
  ctx.fillText("Trace over the outline with the whiteboard pen in the other pane — or annotate right here via screen share.", W / 2, H * 0.95);
};

/* ============================================================
   📇 REFERENCE LIBRARY (181 cards from toolkit-data.js)
   ============================================================ */
Toolkit.prototype._cardsFiltered = function () {
  const cd = this._ext.cd;
  return TK_CARDS.filter((c) =>
    (cd.cat === "All" || c[0] === cd.cat) &&
    (!cd.query || (c[2] + " " + c[3].join(" ")).toLowerCase().includes(cd.query.toLowerCase())));
};
Toolkit.prototype._drawCards = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const cd = this._ext.cd;
  const list = this._cardsFiltered();
  ctx.fillStyle = "#f6f8ff"; ctx.fillRect(0, 0, W, H);
  if (!list.length) {
    ctx.fillStyle = "#555"; ctx.font = this._fitFont(W / 40); ctx.textAlign = "center";
    ctx.fillText("No card matches the search.", W / 2, H / 2);
    return;
  }
  cd.idx = Math.max(0, Math.min(cd.idx, list.length - 1));
  const card = list[cd.idx];
  // header
  ctx.fillStyle = "#1e2a78"; ctx.fillRect(0, 0, W, H * 0.12);
  ctx.fillStyle = "#fff"; ctx.font = "bold " + this._fitFont(Math.min(W / 32, H / 14)); ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText(card[2], W * 0.03, H * 0.06);
  ctx.textAlign = "right"; ctx.font = this._fitFont(W / 60);
  ctx.fillText(card[0] + "  ·  " + (cd.idx + 1) + "/" + list.length, W * 0.97, H * 0.06);
  // body lines
  const lines = card[3];
  const lh = Math.min((H * 0.78) / Math.max(lines.length, 8), H * 0.085);
  const fs = Math.min(lh * 0.62, W / 34);
  ctx.textBaseline = "middle";
  lines.forEach((ln, i) => {
    const y = H * 0.16 + i * lh + lh / 2;
    if (ln.includes("|")) {
      const [a, b2] = ln.split("|");
      ctx.fillStyle = "#1565d8"; ctx.font = "bold " + this._fitFont(fs); ctx.textAlign = "left";
      ctx.fillText(a.trim(), W * 0.04, y);
      ctx.fillStyle = "#333"; ctx.font = this._fitFont(fs);
      ctx.fillText(b2.trim(), W * 0.34, y);
    } else {
      ctx.fillStyle = ln === "" ? "#fff" : "#333";
      ctx.font = this._fitFont(fs); ctx.textAlign = "left";
      ctx.fillText(ln, W * 0.04, y);
    }
  });
  // footer nav
  ctx.fillStyle = "#888"; ctx.font = this._fitFont(W / 75); ctx.textAlign = "center";
  ctx.fillText("◀ tap left side — tap right side ▶    (" + TK_CARDS.length + " reference cards in the library)", W / 2, H * 0.975);
};
Toolkit.prototype._tapCards = function (x) {
  const { W } = this._dims();
  const list = this._cardsFiltered();
  const cd = this._ext.cd;
  if (!list.length) return;
  if (x > W / 2) cd.idx = (cd.idx + 1) % list.length;
  else cd.idx = (cd.idx - 1 + list.length) % list.length;
  this.draw();
};

/* ============================================================
   v8: 🔊 NOISE METER (ClassDojo-style) — toolkit mode "noise"
   Uses the device microphone to display a live class-volume
   gauge with a teacher-set threshold; flashes red when the
   class is too loud. No audio is recorded or sent anywhere.
   ============================================================ */
Toolkit.prototype.startNoise = async function () {
  this._extInit();
  if (this._noise) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const srcN = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 512;
    srcN.connect(an);
    this._noise = { stream, ac, an, buf: new Uint8Array(an.frequencyBinCount), level: 0, peak: 0, limit: 0.55, overSince: 0 };
    const tick = () => {
      if (!this._noise || this.mode !== "noise") return;
      this._noise.an.getByteFrequencyData(this._noise.buf);
      let sum = 0;
      for (const v of this._noise.buf) sum += v;
      const lvl = Math.min(1, (sum / this._noise.buf.length) / 110);
      this._noise.level = this._noise.level * 0.75 + lvl * 0.25;
      this._noise.peak = Math.max(this._noise.peak * 0.995, this._noise.level);
      this.draw();
      requestAnimationFrame(tick);
    };
    tick();
  } catch {
    this._noiseError = "Microphone blocked — allow mic access to use the noise meter.";
    this.draw();
  }
};
Toolkit.prototype.stopNoise = function () {
  if (this._noise) {
    try { this._noise.stream.getTracks().forEach((t) => t.stop()); this._noise.ac.close(); } catch {}
    this._noise = null;
  }
  this._noiseError = "";
};
Toolkit.prototype._drawNoise = function () {
  const ctx = this.ctx, { W, H } = this._dims();
  const n = this._noise;
  ctx.fillStyle = "#f4f8ff"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  if (this._noiseError) {
    ctx.fillStyle = "#b3261e"; ctx.font = this._fitFont(W / 36) ;
    ctx.fillText(this._noiseError, W / 2, H / 2);
    return;
  }
  if (!n) {
    ctx.fillStyle = "#445"; ctx.font = this._fitFont(W / 30);
    ctx.fillText("🔊 Tap anywhere to start the noise meter", W / 2, H / 2);
    return;
  }
  const over = n.level > n.limit;
  /* gauge arc */
  const cx = W / 2, cy = H * 0.62, R = Math.min(W, H) * 0.34;
  ctx.lineWidth = Math.max(14, R * 0.13);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#e3e8f4";
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke();
  const segs = [[0, .45, "#2ecc71"], [.45, .75, "#f59e0b"], [.75, 1, "#e02b2b"]];
  for (const [a, b, col] of segs) {
    const upTo = Math.min(n.level, b);
    if (upTo <= a) continue;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI + a * Math.PI, Math.PI + upTo * Math.PI);
    ctx.stroke();
  }
  /* threshold tick */
  const ta = Math.PI + n.limit * Math.PI;
  ctx.strokeStyle = "#1e2a78"; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ta) * (R - R * 0.16), cy + Math.sin(ta) * (R - R * 0.16));
  ctx.lineTo(cx + Math.cos(ta) * (R + R * 0.16), cy + Math.sin(ta) * (R + R * 0.16));
  ctx.stroke();
  /* status */
  ctx.fillStyle = over ? "#e02b2b" : "#0a8a3a";
  ctx.font = "bold " + this._fitFont(W * 0.05);
  ctx.fillText(over ? "TOO LOUD!" : "Nice and calm", W / 2, H * 0.18);
  ctx.fillStyle = "#445"; ctx.font = this._fitFont(W / 50);
  ctx.fillText("Level " + Math.round(n.level * 100) + "%  ·  limit " + Math.round(n.limit * 100) + "% — tap LEFT to lower / RIGHT to raise the limit", W / 2, H * 0.9);
  if (over) {
    ctx.fillStyle = "rgba(224,43,43,.12)";
    ctx.fillRect(0, 0, W, H);
  }
};
Toolkit.prototype._tapNoise = function (x) {
  if (!this._noise) { this.startNoise(); return; }
  const { W } = this._dims();
  this._noise.limit = Math.max(0.2, Math.min(0.95, this._noise.limit + (x > W / 2 ? 0.05 : -0.05)));
  this.draw();
};
