/* ============================================================
   HMG ACADEMY CLASS DECK — v5 Educational Toolkit
   Canvas-rendered instructional materials (so every tool is
   included in the live broadcast & screen shares):
     ⚛ Periodic table (118 elements, interactive)
     🧪 Laboratory equipment (line diagrams + descriptions)
     🌿 Plant cell  /  🐾 Animal cell (labelled diagrams)
     📏 Units of measurement (reference cards)
     🔁 Unit converter (7 categories)
     ✖ Multiplication table (interactive grid)
   No APIs, no images to download — everything is drawn locally.
   ============================================================ */
"use strict";

/* ---------- periodic table data: [Z, sym, name, mass, col, row, cat] ---------- */
const PT_CATS = ["Alkali metal", "Alkaline earth", "Transition metal", "Post-transition", "Metalloid", "Nonmetal", "Halogen", "Noble gas", "Lanthanide", "Actinide"];
const PT_COLORS = ["#ff8a80", "#ffcc80", "#90caf9", "#b0bec5", "#ce93d8", "#a5d6a7", "#fff59d", "#80deea", "#f48fb1", "#bcaaa4"];
const PT_DATA = [
[1,"H","Hydrogen",1.008,1,1,5],[2,"He","Helium",4.003,18,1,7],
[3,"Li","Lithium",6.94,1,2,0],[4,"Be","Beryllium",9.012,2,2,1],[5,"B","Boron",10.81,13,2,4],[6,"C","Carbon",12.011,14,2,5],[7,"N","Nitrogen",14.007,15,2,5],[8,"O","Oxygen",15.999,16,2,5],[9,"F","Fluorine",18.998,17,2,6],[10,"Ne","Neon",20.18,18,2,7],
[11,"Na","Sodium",22.99,1,3,0],[12,"Mg","Magnesium",24.305,2,3,1],[13,"Al","Aluminium",26.982,13,3,3],[14,"Si","Silicon",28.085,14,3,4],[15,"P","Phosphorus",30.974,15,3,5],[16,"S","Sulfur",32.06,16,3,5],[17,"Cl","Chlorine",35.45,17,3,6],[18,"Ar","Argon",39.948,18,3,7],
[19,"K","Potassium",39.098,1,4,0],[20,"Ca","Calcium",40.078,2,4,1],[21,"Sc","Scandium",44.956,3,4,2],[22,"Ti","Titanium",47.867,4,4,2],[23,"V","Vanadium",50.942,5,4,2],[24,"Cr","Chromium",51.996,6,4,2],[25,"Mn","Manganese",54.938,7,4,2],[26,"Fe","Iron",55.845,8,4,2],[27,"Co","Cobalt",58.933,9,4,2],[28,"Ni","Nickel",58.693,10,4,2],[29,"Cu","Copper",63.546,11,4,2],[30,"Zn","Zinc",65.38,12,4,2],[31,"Ga","Gallium",69.723,13,4,3],[32,"Ge","Germanium",72.63,14,4,4],[33,"As","Arsenic",74.922,15,4,4],[34,"Se","Selenium",78.971,16,4,5],[35,"Br","Bromine",79.904,17,4,6],[36,"Kr","Krypton",83.798,18,4,7],
[37,"Rb","Rubidium",85.468,1,5,0],[38,"Sr","Strontium",87.62,2,5,1],[39,"Y","Yttrium",88.906,3,5,2],[40,"Zr","Zirconium",91.224,4,5,2],[41,"Nb","Niobium",92.906,5,5,2],[42,"Mo","Molybdenum",95.95,6,5,2],[43,"Tc","Technetium",98,7,5,2],[44,"Ru","Ruthenium",101.07,8,5,2],[45,"Rh","Rhodium",102.91,9,5,2],[46,"Pd","Palladium",106.42,10,5,2],[47,"Ag","Silver",107.87,11,5,2],[48,"Cd","Cadmium",112.41,12,5,2],[49,"In","Indium",114.82,13,5,3],[50,"Sn","Tin",118.71,14,5,3],[51,"Sb","Antimony",121.76,15,5,4],[52,"Te","Tellurium",127.6,16,5,4],[53,"I","Iodine",126.9,17,5,6],[54,"Xe","Xenon",131.29,18,5,7],
[55,"Cs","Caesium",132.91,1,6,0],[56,"Ba","Barium",137.33,2,6,1],
[57,"La","Lanthanum",138.91,3,9,8],[58,"Ce","Cerium",140.12,4,9,8],[59,"Pr","Praseodymium",140.91,5,9,8],[60,"Nd","Neodymium",144.24,6,9,8],[61,"Pm","Promethium",145,7,9,8],[62,"Sm","Samarium",150.36,8,9,8],[63,"Eu","Europium",151.96,9,9,8],[64,"Gd","Gadolinium",157.25,10,9,8],[65,"Tb","Terbium",158.93,11,9,8],[66,"Dy","Dysprosium",162.5,12,9,8],[67,"Ho","Holmium",164.93,13,9,8],[68,"Er","Erbium",167.26,14,9,8],[69,"Tm","Thulium",168.93,15,9,8],[70,"Yb","Ytterbium",173.05,16,9,8],[71,"Lu","Lutetium",174.97,17,9,8],
[72,"Hf","Hafnium",178.49,4,6,2],[73,"Ta","Tantalum",180.95,5,6,2],[74,"W","Tungsten",183.84,6,6,2],[75,"Re","Rhenium",186.21,7,6,2],[76,"Os","Osmium",190.23,8,6,2],[77,"Ir","Iridium",192.22,9,6,2],[78,"Pt","Platinum",195.08,10,6,2],[79,"Au","Gold",196.97,11,6,2],[80,"Hg","Mercury",200.59,12,6,2],[81,"Tl","Thallium",204.38,13,6,3],[82,"Pb","Lead",207.2,14,6,3],[83,"Bi","Bismuth",208.98,15,6,3],[84,"Po","Polonium",209,16,6,4],[85,"At","Astatine",210,17,6,6],[86,"Rn","Radon",222,18,6,7],
[87,"Fr","Francium",223,1,7,0],[88,"Ra","Radium",226,2,7,1],
[89,"Ac","Actinium",227,3,10,9],[90,"Th","Thorium",232.04,4,10,9],[91,"Pa","Protactinium",231.04,5,10,9],[92,"U","Uranium",238.03,6,10,9],[93,"Np","Neptunium",237,7,10,9],[94,"Pu","Plutonium",244,8,10,9],[95,"Am","Americium",243,9,10,9],[96,"Cm","Curium",247,10,10,9],[97,"Bk","Berkelium",247,11,10,9],[98,"Cf","Californium",251,12,10,9],[99,"Es","Einsteinium",252,13,10,9],[100,"Fm","Fermium",257,14,10,9],[101,"Md","Mendelevium",258,15,10,9],[102,"No","Nobelium",259,16,10,9],[103,"Lr","Lawrencium",266,17,10,9],
[104,"Rf","Rutherfordium",267,4,7,2],[105,"Db","Dubnium",268,5,7,2],[106,"Sg","Seaborgium",269,6,7,2],[107,"Bh","Bohrium",270,7,7,2],[108,"Hs","Hassium",277,8,7,2],[109,"Mt","Meitnerium",278,9,7,2],[110,"Ds","Darmstadtium",281,10,7,2],[111,"Rg","Roentgenium",282,11,7,2],[112,"Cn","Copernicium",285,12,7,2],[113,"Nh","Nihonium",286,13,7,3],[114,"Fl","Flerovium",289,14,7,3],[115,"Mc","Moscovium",290,15,7,3],[116,"Lv","Livermorium",293,16,7,3],[117,"Ts","Tennessine",294,17,7,6],[118,"Og","Oganesson",294,18,7,7]
];

/* ---------- lab equipment: name, description, draw function key ---------- */
const LAB_ITEMS = [
  ["Beaker", "Holds and mixes liquids; approximate volumes only.", "beaker"],
  ["Conical flask", "Swirling liquids without spilling; titrations.", "flask"],
  ["Test tube", "Holding/heating small samples.", "tube"],
  ["Measuring cylinder", "Measuring liquid volume accurately.", "cylinder"],
  ["Burette", "Delivering precise variable volumes (titration).", "burette"],
  ["Pipette", "Delivering one fixed, exact volume.", "pipette"],
  ["Bunsen burner", "Heating; air-hole controls flame type.", "bunsen"],
  ["Thermometer", "Measuring temperature (°C).", "thermo"],
  ["Funnel", "Pouring & filtration (with filter paper).", "funnel"],
  ["Tripod & gauze", "Supports apparatus above the burner.", "tripod"],
  ["Retort stand", "Clamps and holds apparatus.", "stand"],
  ["Watch glass", "Evaporating small amounts; covering beakers.", "watch"]
];

/* ---------- unit converter data ---------- */
const CONV = {
  Length:   { base: "m",  units: { km: 1000, m: 1, cm: 0.01, mm: 0.001, inch: 0.0254, foot: 0.3048, yard: 0.9144, mile: 1609.344 } },
  Mass:     { base: "kg", units: { tonne: 1000, kg: 1, g: 0.001, mg: 1e-6, pound: 0.45359237, ounce: 0.028349523 } },
  Time:     { base: "s",  units: { day: 86400, hour: 3600, minute: 60, s: 1, ms: 0.001 } },
  Area:     { base: "m²", units: { "km²": 1e6, hectare: 1e4, "m²": 1, "cm²": 1e-4, acre: 4046.856, "ft²": 0.09290304 } },
  Volume:   { base: "L",  units: { "m³": 1000, L: 1, mL: 0.001, "cm³": 0.001, gallon: 3.785412, pint: 0.4731765 } },
  Speed:    { base: "m/s",units: { "m/s": 1, "km/h": 1 / 3.6, mph: 0.44704, knot: 0.514444 } },
  Temperature: { special: true, units: ["°C", "°F", "K"] }
};

const UNIT_CARDS = [
  ["SI base units",
   ["Length — metre (m)", "Mass — kilogram (kg)", "Time — second (s)", "Electric current — ampere (A)",
    "Temperature — kelvin (K)", "Amount of substance — mole (mol)", "Luminous intensity — candela (cd)"]],
  ["Metric prefixes",
   ["giga (G) = ×1 000 000 000", "mega (M) = ×1 000 000", "kilo (k) = ×1000", "hecto (h) = ×100", "deca (da) = ×10",
    "deci (d) = ÷10", "centi (c) = ÷100", "milli (m) = ÷1000", "micro (µ) = ÷1 000 000", "nano (n) = ÷1 000 000 000"]],
  ["Length & distance",
   ["1 km = 1000 m", "1 m = 100 cm = 1000 mm", "1 inch = 2.54 cm", "1 foot = 12 inches = 30.48 cm",
    "1 yard = 3 feet = 0.9144 m", "1 mile = 1.609 km"]],
  ["Mass & volume",
   ["1 tonne = 1000 kg", "1 kg = 1000 g", "1 g = 1000 mg", "1 L = 1000 mL = 1000 cm³",
    "1 m³ = 1000 L", "1 gallon ≈ 3.785 L", "1 pound ≈ 453.6 g"]],
  ["Time & speed",
   ["1 day = 24 h = 1440 min", "1 h = 3600 s", "1 km/h = 0.2778 m/s", "1 m/s = 3.6 km/h",
    "speed = distance ÷ time", "1 mph ≈ 1.609 km/h"]],
  ["Common formulas",
   ["Area of rectangle = l × b", "Area of triangle = ½ × b × h", "Area of circle = πr²",
    "Circumference = 2πr", "Volume of cuboid = l × b × h", "Volume of cylinder = πr²h",
    "Density = mass ÷ volume", "Pressure = force ÷ area"]]
];

class Toolkit {
  constructor(stageEl, opts = {}) {
    this.stage = stageEl;
    this.mode = opts.mode || "periodic";
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:manipulation";
    this.stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.selElement = null;     // periodic table selection
    this.selLab = -1;           // lab equipment selection (-1 = grid)
    this.unitCard = 0;          // units reference card index
    this.multSize = 12;
    this.multSel = null;        // {r,c}
    this.convState = { cat: "Length", from: "m", to: "cm", val: 1 };
    this.canvas.addEventListener("pointerdown", (e) => this._tap(e));
    new ResizeObserver(() => this.draw()).observe(this.stage);
    this.draw();
  }
  setMode(m) { this.mode = m; this.selLab = -1; this.selElement = null; this.draw(); }

  _dims() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.width !== Math.round(r.width * dpr)) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    return { W: this.canvas.width, H: this.canvas.height, dpr };
  }

  draw() {
    const { W, H, dpr } = this._dims();
    if (W < 10) return;
    const ctx = this.ctx;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ({ periodic: () => this._drawPeriodic(),
       lab:      () => this._drawLab(),
       plant:    () => this._drawCell(true),
       animal:   () => this._drawCell(false),
       units:    () => this._drawUnits(),
       convert:  () => this._drawConvert(),
       mult:     () => this._drawMult() }[this.mode] ||
       (() => { if (this._drawExt) this._drawExt(); }))();
  }

  _tap(e) {
    const r = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / r.width;
    const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
    if (this._tapExt && this._tapExt(x, y)) return;     // v6 extension hook
    if (this.mode === "periodic") {
      if (this.selElement) { this.selElement = null; this.draw(); return; }
      const g = this._ptGeom();
      for (const el of PT_DATA) {
        const ex = g.ox + (el[4] - 1) * g.cw, ey = g.oy + (el[5] - 1) * g.ch;
        if (x >= ex && x <= ex + g.cw && y >= ey && y <= ey + g.ch) { this.selElement = el; this.draw(); return; }
      }
    } else if (this.mode === "lab") {
      if (this.selLab >= 0) { this.selLab = -1; this.draw(); return; }
      const { W, H } = this._dims();
      const cols = W > H ? 4 : 3, rows = Math.ceil(LAB_ITEMS.length / cols);
      const cw = W / cols, ch = H / rows;
      const idx = Math.floor(y / ch) * cols + Math.floor(x / cw);
      if (idx < LAB_ITEMS.length) { this.selLab = idx; this.draw(); }
    } else if (this.mode === "units") {
      const { W } = this._dims();
      this.unitCard = (this.unitCard + (x > W / 2 ? 1 : UNIT_CARDS.length - 1)) % UNIT_CARDS.length;
      this.draw();
    } else if (this.mode === "mult") {
      const g = this._multGeom();
      const c = Math.floor((x - g.ox) / g.cs), r2 = Math.floor((y - g.oy) / g.cs);
      if (c >= 1 && c <= this.multSize && r2 >= 1 && r2 <= this.multSize) { this.multSel = { r: r2, c }; this.draw(); }
      else { this.multSel = null; this.draw(); }
    }
  }

  /* ============ periodic table ============ */
  _ptGeom() {
    const { W, H } = this._dims();
    const cw = W / 18.6, ch = Math.min(H / 10.8, cw * 1.18);
    return { ox: (W - cw * 18) / 2, oy: (H - ch * 10.4) / 2, cw, ch };
  }
  _drawPeriodic() {
    const ctx = this.ctx, g = this._ptGeom();
    const { W, H } = this._dims();
    for (const el of PT_DATA) {
      const x = g.ox + (el[4] - 1) * g.cw, y = g.oy + (el[5] - 1) * g.ch;
      ctx.fillStyle = PT_COLORS[el[6]];
      ctx.fillRect(x + 1, y + 1, g.cw - 2, g.ch - 2);
      ctx.fillStyle = "#222";
      ctx.font = "bold " + g.cw * 0.42 + "px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(el[1], x + g.cw / 2, y + g.ch * 0.56);
      ctx.font = g.cw * 0.21 + "px system-ui";
      ctx.fillText(el[0], x + g.cw / 2, y + g.ch * 0.18);
    }
    // legend
    ctx.textAlign = "left";
    ctx.font = g.cw * 0.26 + "px system-ui";
    let lx = g.ox + g.cw * 2.6, ly = g.oy + g.ch * 0.4;
    PT_CATS.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const xx = lx + col * g.cw * 5.2, yy = ly + row * g.ch * 0.46;
      ctx.fillStyle = PT_COLORS[i]; ctx.fillRect(xx, yy - g.ch * 0.14, g.cw * 0.4, g.ch * 0.28);
      ctx.fillStyle = "#333"; ctx.fillText(c, xx + g.cw * 0.55, yy);
    });
    // detail card
    if (this.selElement) {
      const el = this.selElement;
      const cw2 = Math.min(W * 0.5, 560), ch2 = cw2 * 0.52;
      const x = (W - cw2) / 2, y = (H - ch2) / 2;
      ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = PT_COLORS[el[6]]; ctx.lineWidth = 8;
      ctx.fillRect(x, y, cw2, ch2); ctx.strokeRect(x, y, cw2, ch2);
      ctx.fillStyle = PT_COLORS[el[6]]; ctx.fillRect(x, y, cw2, ch2 * 0.16);
      ctx.fillStyle = "#222"; ctx.textAlign = "center";
      ctx.font = "bold " + ch2 * 0.11 + "px system-ui";
      ctx.fillText(PT_CATS[el[6]], x + cw2 / 2, y + ch2 * 0.085);
      ctx.font = "bold " + ch2 * 0.34 + "px system-ui";
      ctx.fillText(el[1], x + cw2 * 0.25, y + ch2 * 0.5);
      ctx.textAlign = "left";
      ctx.font = "bold " + ch2 * 0.12 + "px system-ui";
      ctx.fillText(el[2], x + cw2 * 0.45, y + ch2 * 0.42);
      ctx.font = ch2 * 0.095 + "px system-ui";
      ctx.fillText("Atomic number: " + el[0], x + cw2 * 0.45, y + ch2 * 0.58);
      ctx.fillText("Atomic mass: " + el[3], x + cw2 * 0.45, y + ch2 * 0.72);
      ctx.font = ch2 * 0.07 + "px system-ui"; ctx.fillStyle = "#777";
      ctx.fillText("(tap anywhere to close)", x + cw2 * 0.45, y + ch2 * 0.88);
    }
  }

  /* ============ lab equipment ============ */
  _drawLab() {
    const ctx = this.ctx; const { W, H } = this._dims();
    if (this.selLab >= 0) {
      const it = LAB_ITEMS[this.selLab];
      ctx.strokeStyle = "#1565d8"; ctx.lineWidth = Math.max(3, W / 280);
      this._labGlyph(it[2], W / 2, H * 0.42, Math.min(W, H) * 0.3);
      ctx.fillStyle = "#222"; ctx.textAlign = "center";
      ctx.font = "bold " + W * 0.035 + "px system-ui";
      ctx.fillText(it[0], W / 2, H * 0.78);
      ctx.font = W * 0.022 + "px system-ui"; ctx.fillStyle = "#555";
      ctx.fillText(it[1], W / 2, H * 0.85);
      ctx.font = W * 0.016 + "px system-ui"; ctx.fillStyle = "#999";
      ctx.fillText("(tap to go back to all equipment)", W / 2, H * 0.93);
      return;
    }
    const cols = W > H ? 4 : 3, rows = Math.ceil(LAB_ITEMS.length / cols);
    const cw = W / cols, ch = H / rows;
    LAB_ITEMS.forEach((it, i) => {
      const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch * 0.42;
      ctx.strokeStyle = "#1565d8"; ctx.lineWidth = Math.max(2, W / 500);
      this._labGlyph(it[2], cx, cy, Math.min(cw, ch) * 0.3);
      ctx.fillStyle = "#222"; ctx.textAlign = "center";
      ctx.font = "bold " + Math.min(cw, ch) * 0.11 + "px system-ui";
      ctx.fillText(it[0], cx, cy + ch * 0.42);
    });
  }
  _labGlyph(key, cx, cy, s) {
    const ctx = this.ctx;
    ctx.beginPath();
    switch (key) {
      case "beaker":
        ctx.moveTo(cx - s * .6, cy - s * .7); ctx.lineTo(cx - s * .6, cy + s * .6);
        ctx.lineTo(cx + s * .6, cy + s * .6); ctx.lineTo(cx + s * .6, cy - s * .7);
        ctx.moveTo(cx - s * .6, cy + s * .1); ctx.lineTo(cx + s * .6, cy + s * .1); break;
      case "flask":
        ctx.moveTo(cx - s * .15, cy - s * .8); ctx.lineTo(cx - s * .15, cy - s * .2);
        ctx.lineTo(cx - s * .65, cy + s * .65); ctx.lineTo(cx + s * .65, cy + s * .65);
        ctx.lineTo(cx + s * .15, cy - s * .2); ctx.lineTo(cx + s * .15, cy - s * .8); break;
      case "tube":
        ctx.moveTo(cx - s * .2, cy - s * .8); ctx.lineTo(cx - s * .2, cy + s * .5);
        ctx.arc(cx, cy + s * .5, s * .2, Math.PI, 0, true);
        ctx.lineTo(cx + s * .2, cy - s * .8); break;
      case "cylinder":
        ctx.rect(cx - s * .25, cy - s * .8, s * .5, s * 1.5);
        for (let i = 1; i <= 4; i++) { ctx.moveTo(cx - s * .25, cy - s * .8 + i * s * .3); ctx.lineTo(cx, cy - s * .8 + i * s * .3); } break;
      case "burette":
        ctx.moveTo(cx, cy - s * .9); ctx.lineTo(cx, cy + s * .4);
        ctx.moveTo(cx - s * .12, cy - s * .9); ctx.rect(cx - s * .12, cy - s * .9, s * .24, s * 1.1);
        ctx.moveTo(cx - s * .25, cy + s * .35); ctx.lineTo(cx + s * .25, cy + s * .35);
        ctx.moveTo(cx, cy + s * .45); ctx.lineTo(cx, cy + s * .75); break;
      case "pipette":
        ctx.moveTo(cx, cy - s * .9); ctx.lineTo(cx, cy - s * .3);
        ctx.ellipse(cx, cy, s * .18, s * .35, 0, 0, Math.PI * 2);
        ctx.moveTo(cx, cy + s * .35); ctx.lineTo(cx, cy + s * .9); break;
      case "bunsen":
        ctx.rect(cx - s * .5, cy + s * .5, s, s * .15);
        ctx.moveTo(cx, cy + s * .5); ctx.lineTo(cx, cy - s * .1);
        ctx.moveTo(cx - s * .12, cy - s * .1); ctx.rect(cx - s * .12, cy - s * .5, s * .24, s * .4);
        ctx.moveTo(cx, cy - s * .55); ctx.quadraticCurveTo(cx - s * .25, cy - s * .85, cx, cy - s * 1.05);
        ctx.quadraticCurveTo(cx + s * .25, cy - s * .85, cx, cy - s * .55); break;
      case "thermo":
        ctx.moveTo(cx - s * .1, cy - s * .85); ctx.lineTo(cx - s * .1, cy + s * .4);
        ctx.moveTo(cx + s * .1, cy - s * .85); ctx.lineTo(cx + s * .1, cy + s * .4);
        ctx.arc(cx, cy + s * .55, s * .22, 0, Math.PI * 2);
        for (let i = 0; i < 5; i++) { ctx.moveTo(cx + s * .1, cy - s * .7 + i * s * .22); ctx.lineTo(cx + s * .22, cy - s * .7 + i * s * .22); } break;
      case "funnel":
        ctx.moveTo(cx - s * .7, cy - s * .6); ctx.lineTo(cx + s * .7, cy - s * .6);
        ctx.lineTo(cx + s * .08, cy + s * .1); ctx.lineTo(cx + s * .08, cy + s * .7);
        ctx.moveTo(cx - s * .08, cy + s * .7); ctx.lineTo(cx - s * .08, cy + s * .1);
        ctx.lineTo(cx - s * .7, cy - s * .6); break;
      case "tripod":
        ctx.moveTo(cx - s * .6, cy - s * .3); ctx.lineTo(cx + s * .6, cy - s * .3);
        ctx.moveTo(cx - s * .5, cy - s * .3); ctx.lineTo(cx - s * .65, cy + s * .7);
        ctx.moveTo(cx + s * .5, cy - s * .3); ctx.lineTo(cx + s * .65, cy + s * .7);
        ctx.moveTo(cx, cy - s * .3); ctx.lineTo(cx, cy + s * .7);
        for (let i = -2; i <= 2; i++) { ctx.moveTo(cx + i * s * .2, cy - s * .42); ctx.lineTo(cx + i * s * .2, cy - s * .3); } break;
      case "stand":
        ctx.moveTo(cx - s * .5, cy + s * .8); ctx.lineTo(cx + s * .5, cy + s * .8);
        ctx.moveTo(cx - s * .3, cy + s * .8); ctx.lineTo(cx - s * .3, cy - s * .9);
        ctx.moveTo(cx - s * .3, cy - s * .4); ctx.lineTo(cx + s * .4, cy - s * .4);
        ctx.arc(cx + s * .5, cy - s * .4, s * .12, 0, Math.PI * 2); break;
      case "watch":
        ctx.ellipse(cx, cy, s * .75, s * .25, 0, 0, Math.PI, false);
        ctx.moveTo(cx - s * .75, cy); ctx.ellipse(cx, cy - s * .05, s * .75, s * .22, 0, Math.PI, 0, false); break;
    }
    ctx.stroke();
  }

  /* ============ plant / animal cell ============ */
  _drawCell(plant) {
    const ctx = this.ctx; const { W, H } = this._dims();
    const cx = W * 0.42, cy = H * 0.5, rx = Math.min(W, H) * 0.31, ry = Math.min(W, H) * 0.27;
    const F = Math.max(11, Math.min(W, H) * 0.026);
    ctx.lineWidth = Math.max(2, W / 600);
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const label = (txt, lx, ly, tx, ty) => {
      ctx.strokeStyle = "#888"; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = "#222"; ctx.font = "bold " + F + "px system-ui";
      ctx.fillText(txt, tx + 6, ty);
    };
    // outer
    if (plant) {
      ctx.fillStyle = "#dcedc8"; ctx.strokeStyle = "#558b2f"; ctx.lineWidth = Math.max(5, W / 240);
      ctx.fillRect(cx - rx * 1.18, cy - ry * 1.18, rx * 2.36, ry * 2.36);
      ctx.strokeRect(cx - rx * 1.18, cy - ry * 1.18, rx * 2.36, ry * 2.36);
      ctx.strokeStyle = "#7cb342"; ctx.lineWidth = Math.max(2, W / 600);
      ctx.strokeRect(cx - rx * 1.08, cy - ry * 1.08, rx * 2.16, ry * 2.16);
    } else {
      ctx.fillStyle = "#ffe0e6"; ctx.strokeStyle = "#c2185b"; ctx.lineWidth = Math.max(4, W / 300);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.2, ry * 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.lineWidth = Math.max(2, W / 600);
    // nucleus
    ctx.fillStyle = "#b39ddb"; ctx.strokeStyle = "#5e35b1";
    ctx.beginPath(); ctx.ellipse(cx - rx * .35, cy - ry * .25, rx * .3, ry * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#4527a0";
    ctx.beginPath(); ctx.ellipse(cx - rx * .35, cy - ry * .25, rx * .1, ry * .1, 0, 0, Math.PI * 2); ctx.fill();
    // mitochondria ×2
    ctx.fillStyle = "#ffab91"; ctx.strokeStyle = "#d84315";
    for (const [mx, my, rot] of [[cx + rx * .4, cy - ry * .45, 0.5], [cx - rx * .1, cy + ry * .55, -0.4]]) {
      ctx.beginPath(); ctx.ellipse(mx, my, rx * .18, ry * .1, rot, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // vacuole
    if (plant) {
      ctx.fillStyle = "#b3e5fc"; ctx.strokeStyle = "#0277bd";
      ctx.beginPath(); ctx.ellipse(cx + rx * .35, cy + ry * .15, rx * .42, ry * .45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = "#b3e5fc"; ctx.strokeStyle = "#0277bd";
      ctx.beginPath(); ctx.ellipse(cx + rx * .5, cy + ry * .4, rx * .14, ry * .12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // chloroplasts (plant only)
    if (plant) {
      ctx.fillStyle = "#81c784"; ctx.strokeStyle = "#2e7d32";
      for (const [px, py] of [[cx - rx * .75, cy + ry * .35], [cx - rx * .55, cy + ry * .75], [cx + rx * .05, cy - ry * .75]]) {
        ctx.beginPath(); ctx.ellipse(px, py, rx * .15, ry * .09, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    // ribosomes (dots)
    ctx.fillStyle = "#6d4c41";
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * (0.85 + (i % 3) * 0.05), cy + Math.sin(a) * ry * 0.88, Math.max(2, W / 500), 0, Math.PI * 2); ctx.fill();
    }
    // golgi
    ctx.strokeStyle = "#f9a825";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(cx - rx * .7, cy - ry * .65, rx * (0.1 + i * 0.045), -0.5, 1.4); ctx.stroke();
    }
    // labels (right column)
    const LX = cx + rx * 1.45;
    let ly = cy - ry * 1.1;
    const gap = (ry * 2.3) / (plant ? 8 : 6);
    label("Nucleus", cx - rx * .35, cy - ry * .25, LX, ly); ly += gap;
    label("Nucleolus", cx - rx * .3, cy - ry * .22, LX, ly); ly += gap;
    label("Mitochondrion", cx + rx * .4, cy - ry * .45, LX, ly); ly += gap;
    label(plant ? "Large vacuole" : "Small vacuole", cx + rx * .4, cy + ry * .2, LX, ly); ly += gap;
    label("Ribosomes", cx + rx * .85, cy, LX, ly); ly += gap;
    label("Golgi body", cx - rx * .7, cy - ry * .65, LX, ly); ly += gap;
    if (plant) {
      label("Chloroplast", cx - rx * .55, cy + ry * .75, LX, ly); ly += gap;
      label("Cell wall + membrane", cx - rx * 1.18, cy, LX, ly);
    } else {
      label("Cell membrane", cx, cy - ry * 1.2, LX, ly);
    }
    ctx.fillStyle = "#222"; ctx.font = "bold " + F * 1.4 + "px system-ui"; ctx.textAlign = "center";
    ctx.fillText(plant ? "PLANT CELL" : "ANIMAL CELL", W / 2, H * 0.06);
  }

  /* ============ units reference cards ============ */
  _drawUnits() {
    const ctx = this.ctx; const { W, H } = this._dims();
    const card = UNIT_CARDS[this.unitCard];
    ctx.fillStyle = "#eef3ff"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1e2a78";
    ctx.font = "bold " + W * 0.035 + "px system-ui"; ctx.textAlign = "center";
    ctx.fillText(card[0], W / 2, H * 0.1);
    ctx.font = W * 0.024 + "px system-ui"; ctx.fillStyle = "#222"; ctx.textAlign = "left";
    const x = W * 0.12;
    card[1].forEach((line, i) => {
      ctx.fillStyle = "#4f6ef7"; ctx.fillRect(x - W * 0.025, H * (0.18 + i * 0.085) - W * 0.008, W * 0.012, W * 0.012);
      ctx.fillStyle = "#222";
      ctx.fillText(line, x, H * (0.18 + i * 0.085));
    });
    ctx.fillStyle = "#888"; ctx.font = W * 0.016 + "px system-ui"; ctx.textAlign = "center";
    ctx.fillText("Card " + (this.unitCard + 1) + " / " + UNIT_CARDS.length + " — tap right side for next, left side for previous", W / 2, H * 0.95);
  }

  /* ============ unit converter ============ */
  convert() {
    const s = this.convState;
    const v = Number(s.val) || 0;
    if (s.cat === "Temperature") {
      let c;
      if (s.from === "°C") c = v;
      else if (s.from === "°F") c = (v - 32) * 5 / 9;
      else c = v - 273.15;
      let out;
      if (s.to === "°C") out = c;
      else if (s.to === "°F") out = c * 9 / 5 + 32;
      else out = c + 273.15;
      return Math.round(out * 1e6) / 1e6;
    }
    const u = CONV[s.cat].units;
    return Math.round((v * u[s.from] / u[s.to]) * 1e9) / 1e9;
  }
  _drawConvert() {
    const ctx = this.ctx; const { W, H } = this._dims();
    const s = this.convState;
    ctx.fillStyle = "#f3f7ff"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + W * 0.03 + "px system-ui";
    ctx.fillText("UNIT CONVERTER — " + s.cat, W / 2, H * 0.14);
    ctx.fillStyle = "#222"; ctx.font = "bold " + W * 0.05 + "px system-ui";
    ctx.fillText(s.val + " " + s.from, W / 2, H * 0.38);
    ctx.fillStyle = "#4f6ef7"; ctx.font = W * 0.05 + "px system-ui";
    ctx.fillText("=", W / 2, H * 0.52);
    ctx.fillStyle = "#0a8a3a"; ctx.font = "bold " + W * 0.06 + "px system-ui";
    ctx.fillText(this.convert() + " " + s.to, W / 2, H * 0.68);
    ctx.fillStyle = "#888"; ctx.font = W * 0.018 + "px system-ui";
    ctx.fillText("Set the value and units in the bar above — students see this result live.", W / 2, H * 0.9);
  }

  /* ============ multiplication table ============ */
  _multGeom() {
    const { W, H } = this._dims();
    const n = this.multSize + 1;
    const cs = Math.min(W / (n + 0.4), H / (n + 1.2));
    return { ox: (W - cs * n) / 2, oy: (H - cs * n) / 2 + cs * 0.3, cs };
  }
  _drawMult() {
    const ctx = this.ctx; const g = this._multGeom();
    const { W } = this._dims();
    const n = this.multSize;
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const x = g.ox + c * g.cs, y = g.oy + r * g.cs;
        const isHead = r === 0 || c === 0;
        const hot = this.multSel && ((r === this.multSel.r && c <= this.multSel.c) || (c === this.multSel.c && r <= this.multSel.r));
        const isAns = this.multSel && r === this.multSel.r && c === this.multSel.c;
        ctx.fillStyle = isAns ? "#ffb347" : hot ? "#dbe7ff" : isHead ? "#1e2a78" : (r + c) % 2 ? "#f5f8ff" : "#fff";
        ctx.fillRect(x, y, g.cs - 1, g.cs - 1);
        if (r === 0 && c === 0) continue;
        ctx.fillStyle = isHead ? "#fff" : "#223";
        ctx.font = (isHead ? "bold " : "") + g.cs * 0.4 + "px system-ui";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const val = r === 0 ? c : c === 0 ? r : r * c;
        ctx.fillText(val, x + g.cs / 2, y + g.cs / 2);
      }
    }
    if (this.multSel) {
      ctx.fillStyle = "#1e2a78"; ctx.font = "bold " + g.cs * 0.7 + "px system-ui"; ctx.textAlign = "center";
      ctx.fillText(this.multSel.r + " × " + this.multSel.c + " = " + this.multSel.r * this.multSel.c, W / 2, g.oy - g.cs * 0.35);
    }
  }
}
