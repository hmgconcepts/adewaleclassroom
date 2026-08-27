/* =========================================================
   HMG ClassDeck — common helpers (toast, modal, storage, misc)
   ========================================================= */
"use strict";

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* ---------- toast notifications ---------- */
function toast(msg, type = "", ms = 3200) {
  let host = $("#toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- tiny modal helper ---------- */
function openModal(id)  { const m = $(id); if (m) m.classList.add("open"); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove("open"); }
document.addEventListener("click", (e) => {
  if (e.target.classList && e.target.classList.contains("modal-back")) {
    e.target.classList.remove("open");
  }
});

/* ---------- persistent settings (localStorage) ---------- */
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("hmgcd_" + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("hmgcd_" + key, JSON.stringify(value)); } catch {}
  }
};

/* ---------- misc utilities ---------- */
function randomCode(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I/L
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function nowStamp() {
  const d = new Date();
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function downloadBlob(blob, filename) {
  if (!blob) { toast("Nothing is available to download yet.", "err"); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- screen wake lock (stops the tablet sleeping mid-class) ---------- */
let _wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator) {
      _wakeLock = await navigator.wakeLock.request("screen");
      _wakeLock.addEventListener("release", () => { _wakeLock = null; });
    } else if (!on && _wakeLock) {
      await _wakeLock.release(); _wakeLock = null;
    }
  } catch { /* not fatal */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && _wakeLock === null && window._wantWake) keepAwake(true);
});

/* ---------- fullscreen toggle ---------- */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (!document.documentElement.requestFullscreen) { toast("Fullscreen is not supported by this browser", "err"); return; }
    document.documentElement.requestFullscreen().catch(() => toast("Fullscreen blocked by browser", "err"));
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/* ---------- service-worker registration (PWA install/offline) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ------------------------------------------------------------
   v3: Minimal PDF writer (zero dependencies, ~free bytes)
   Builds a valid PDF from JPEG images (one per page).
   Used to export whiteboard decks / class reports as PDF.
   ------------------------------------------------------------ */
function jpegsToPdf(jpegs) {
  // jpegs: [{dataUrl, width, height}]
  const enc = (s) => new TextEncoder().encode(s);
  const chunks = [];
  let offset = 0;
  const offsets = [];
  function push(bytes) {
    if (typeof bytes === "string") bytes = enc(bytes);
    chunks.push(bytes); offset += bytes.length;
  }
  function beginObj(n) { offsets[n] = offset; push(n + " 0 obj\n"); }

  push("%PDF-1.4\n%\xB5\xB5\n");

  const nPages = jpegs.length;
  // object numbering: 1 catalog, 2 pages tree, then per page i: page obj, content obj, image obj
  const pageObj = (i) => 3 + i * 3;
  const contObj = (i) => 4 + i * 3;
  const imgObj  = (i) => 5 + i * 3;

  beginObj(1); push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  beginObj(2);
  push("<< /Type /Pages /Count " + nPages + " /Kids [" +
    jpegs.map((_, i) => pageObj(i) + " 0 R").join(" ") + "] >>\nendobj\n");

  jpegs.forEach((j, i) => {
    // A4-ish page scaled to the image aspect (72dpi units)
    const pw = 842, ph = Math.round(842 * j.height / j.width); // landscape width fixed
    const W = j.width >= j.height ? pw : Math.round(595);
    const H = j.width >= j.height ? ph : Math.round(595 * j.height / j.width);
    beginObj(pageObj(i));
    push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] " +
      "/Resources << /XObject << /Im" + i + " " + imgObj(i) + " 0 R >> >> " +
      "/Contents " + contObj(i) + " 0 R >>\nendobj\n");
    const content = "q\n" + W + " 0 0 " + H + " 0 0 cm\n/Im" + i + " Do\nQ\n";
    beginObj(contObj(i));
    push("<< /Length " + content.length + " >>\nstream\n" + content + "endstream\nendobj\n");
    // decode base64 jpeg
    const b64 = j.dataUrl.split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    beginObj(imgObj(i));
    push("<< /Type /XObject /Subtype /Image /Width " + j.width + " /Height " + j.height +
      " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + bytes.length + " >>\nstream\n");
    push(bytes);
    push("\nendstream\nendobj\n");
  });

  const xrefStart = offset;
  const maxObj = 2 + nPages * 3;
  let xref = "xref\n0 " + (maxObj + 1) + "\n0000000000 65535 f \n";
  for (let n = 1; n <= maxObj; n++) xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  push(xref);
  push("trailer\n<< /Size " + (maxObj + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF");

  // join
  let total = 0; chunks.forEach((c) => total += c.length);
  const out = new Uint8Array(total);
  let p = 0; chunks.forEach((c) => { out.set(c, p); p += c.length; });
  return new Blob([out], { type: "application/pdf" });
}

/* ---------- PWA install prompt ---------- */
let _deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _deferredInstall = e;
  $$(".install-btn").forEach((b) => b.classList.remove("hide"));
});
function promptInstall() {
  if (_deferredInstall) { _deferredInstall.prompt(); _deferredInstall = null; }
  else toast("Already installed, or use your browser menu → 'Add to Home screen'.");
}

/* ---------- v6: roundRect polyfill (older Android WebViews) ---------- */
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(Math.abs(r) || 0, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
