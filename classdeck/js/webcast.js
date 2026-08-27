/* ============================================================
   HMG ACADEMY CLASS DECK — Reader Cast engine v7
   WHY: getDisplayMedia (screen capture) does NOT exist on
   Android Chrome/Edge, and browsers forbid drawing an iframe's
   pixels onto a canvas. Reader Cast fetches page CONTENT via
   free key-less proxies and renders it on a broadcastable canvas.

   v7 — professional "magazine" renderer:
   • Article card layout: centred column, comfortable measure,
     drop shadow, rounded corners — looks like a quality e-reader.
   • Real typography: Georgia serif body, system-ui headings,
     justified-feel ragged-right, proper spacing scale, first
     paragraph lead-in, blockquotes, tables → bullet rows.
   • Reading themes: Light / Sepia / Dark / Green-board.
   • Hero image handling, image captions, rounded image corners,
     graceful skeleton loaders.
   • Reading progress bar + estimated reading time.
   • Smooth momentum scrolling + tap-page-down on lower third.
   ============================================================ */
"use strict";

const READER_THEMES = {
  light: { page: "#ffffff", bg: "#e8ecf4", text: "#1f2430", head: "#1e2a78", accent: "#4f6ef7", dim: "#8a93a8", line: "#e3e7f0", quoteBg: "#f2f5fb" },
  sepia: { page: "#f9f1e0", bg: "#e7dcc4", text: "#433422", head: "#5b3a1e", accent: "#b4690e", dim: "#94815f", line: "#e6d9bd", quoteBg: "#f2e7cf" },
  dark:  { page: "#171c2b", bg: "#0c0f1a", text: "#d7deee", head: "#9db4ff", accent: "#7b9bff", dim: "#6b7591", line: "#262d42", quoteBg: "#1f2638" },
  board: { page: "#16382a", bg: "#0c241a", text: "#dcefe4", head: "#ffe066", accent: "#8be0ae", dim: "#7fa590", line: "#235040", quoteBg: "#1d4534" }
};

function readerFetch(url, options = {}, timeoutMs = 20000, parentSignal) {
  if (typeof AbortController === "undefined") {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs))
    ]);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortParent = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", abortParent, { once: true });
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener("abort", abortParent);
  });
}

class ReaderView {
  constructor(stageEl, opts = {}) {
    this.stage = stageEl;
    this.onState = opts.onState || (() => {});
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none";
    this.stage.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.blocks = [];
    this.scroll = 0;
    this.totalH = 0;
    this.fontScale = Store.get("reader_font", 1);
    this.theme = Store.get("reader_theme", "light");
    this.status = "idle";
    this.statusMsg = "";
    this.title = "";
    this.url = "";
    this.site = "";
    this._loadId = 0;
    this._loadAbort = null;
    this._bind();
    new ResizeObserver(() => this.draw()).observe(this.stage);
    this.draw();
  }

  setTheme(t) {
    this.theme = READER_THEMES[t] ? t : "light";
    Store.set("reader_theme", this.theme);
    this.draw();
  }
  setFontScale(s) {
    this.fontScale = Math.max(0.65, Math.min(2.2, s));
    Store.set("reader_font", this.fontScale);
    this.draw();
  }

  /* ---------------- fetching ---------------- */
  async load(url) {
    const requestId = ++this._loadId;
    if (this._loadAbort) this._loadAbort.abort();
    let parsed;
    try {
      parsed = new URL(/^https?:\/\//i.test(String(url)) ? String(url) : "https://" + String(url));
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only web pages can be cast.");
    } catch {
      this.status = "error";
      this.statusMsg = "Enter a valid http:// or https:// web address.";
      this.draw();
      this.onState(this.status);
      return;
    }
    url = parsed.href;
    this._loadAbort = typeof AbortController !== "undefined" ? new AbortController() : null;
    const parentSignal = this._loadAbort ? this._loadAbort.signal : undefined;
    const current = () => requestId === this._loadId;

    this.url = url;
    this.site = parsed.hostname.replace(/^www\./, "");
    this.status = "loading";
    this.statusMsg = "Fetching “" + this.site + "”…";
    this.scroll = 0;
    this.blocks = [];
    this.title = "";
    this.draw();
    this.onState(this.status);
    try {
      let blocks = null;
      try {
        const r = await readerFetch("https://r.jina.ai/" + url, { headers: { "Accept": "text/plain" } }, 20000, parentSignal);
        if (!current()) return;
        if (r.ok) {
          const txt = await r.text();
          if (txt && txt.length > 60) blocks = this._parseMarkdown(txt);
        }
      } catch {}
      if (!current()) return;
      if (!blocks || blocks.length < 3) {
        try {
          await new Promise((res) => setTimeout(res, 1200));
          if (!current()) return;
          const rr = await readerFetch("https://r.jina.ai/" + url, { headers: { "Accept": "text/plain" } }, 25000, parentSignal);
          if (!current()) return;
          if (rr.ok) {
            const t2 = await rr.text();
            if (t2 && t2.length > 60) blocks = this._parseMarkdown(t2);
          }
        } catch {}
      }
      if (!current()) return;
      if (!blocks || blocks.length < 3) {
        const r2 = await readerFetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(url), {}, 25000, parentSignal);
        if (!current()) return;
        if (!r2.ok) throw new Error("proxy " + r2.status);
        blocks = this._parseHTML(await r2.text(), url);
      }
      if (!current()) return;
      if (!blocks || !blocks.length) throw new Error("No readable content found");
      this.blocks = this._polish(blocks).slice(0, 460);
      this.status = "ready";
      this.statusMsg = "";
      this._loadImages();
      this.draw();
    } catch (e) {
      if (!current()) return;
      if (e && e.name === "AbortError") return;
      this.status = "error";
      this.statusMsg = "Could not fetch this page (" + (e.message || "network") + "). Some sites block readers — try another page, or save it as PDF for the PDF pane.";
      this.draw();
    } finally {
      if (current()) {
        this._loadAbort = null;
        this.onState(this.status);
      }
    }
  }

  /* tidy up: drop nav junk, merge tiny fragments, mark lead paragraph */
  _polish(blocks) {
    const JUNK = /^(skip to|jump to|menu|search|sign in|log in|subscribe|cookie|privacy|terms|share|advertisement|sponsored|related articles|see also:?$|navigation|toggle)/i;
    const out = [];
    for (const b of blocks) {
      if (b.text) {
        const t = b.text.trim();
        if (!t || JUNK.test(t)) continue;
        if (t.length < 3 && b.type === "p") continue;
        b.text = t;
      }
      out.push(b);
    }
    let leadDone = false;
    for (const b of out) {
      if (b.type === "p" && b.text && b.text.length > 80 && !leadDone) { b.lead = true; leadDone = true; }
    }
    return out;
  }

  _parseMarkdown(txt) {
    const mIdx = txt.indexOf("Markdown Content:");
    const tMatch = txt.match(/^Title:\s*(.+)$/m);
    if (tMatch) this.title = tMatch[1].trim();
    const body = mIdx >= 0 ? txt.slice(mIdx + 17) : txt;
    const out = [];
    if (this.title) out.push({ type: "h1", text: this.title });
    let prevType = "";
    for (let raw of body.split("\n")) {
      let line = raw.trim();
      if (!line) { prevType = ""; continue; }
      const im = line.match(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/);
      if (im) {
        out.push({ type: "img", url: im[2], caption: (im[1] || "").replace(/^Image \d+:?\s*/i, "").trim() });
        line = line.replace(im[0], "").trim();
        if (!line) continue;
      }
      line = line.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
                 .replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
                 .replace(/`{1,3}([^`]*)`{1,3}/g, "$1");
      if (!line || /^[-=_*]{3,}$/.test(line)) { prevType = ""; continue; }
      if (/^>/.test(line)) { out.push({ type: "quote", text: line.replace(/^>+\s*/, "") }); prevType = "quote"; }
      else if (/^#{1,2}\s/.test(line)) { out.push({ type: "h1", text: line.replace(/^#+\s*/, "") }); prevType = "h1"; }
      else if (/^#{3,6}\s/.test(line)) { out.push({ type: "h2", text: line.replace(/^#+\s*/, "") }); prevType = "h2"; }
      else if (/^[-*+•]\s/.test(line)) { out.push({ type: "li", text: line.replace(/^[-*+•]\s*/, "") }); prevType = "li"; }
      else if (/^\d+\.\s/.test(line)) { out.push({ type: "li", text: line, num: true }); prevType = "li"; }
      else if (/^\|/.test(line)) {
        const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length && !/^[-: ]+$/.test(cells.join(""))) out.push({ type: "li", text: cells.join("  ·  ") });
        prevType = "li";
      } else {
        /* merge soft-wrapped continuation lines into the previous paragraph */
        if (prevType === "p" && out.length && out[out.length - 1].type === "p" && !/[.!?:]$/.test(out[out.length - 1].text) && /^[a-z(]/.test(line)) {
          out[out.length - 1].text += " " + line;
        } else out.push({ type: "p", text: line });
        prevType = "p";
      }
    }
    return out;
  }

  _parseHTML(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav,footer,header,aside,noscript,iframe,form,svg,button").forEach((n) => n.remove());
    this.title = ((doc.querySelector("title") || {}).textContent || "").trim();
    const out = [];
    if (this.title) out.push({ type: "h1", text: this.title });
    const root = doc.querySelector("main, article, #content, .content, body") || doc.body;
    const walk = (node) => {
      for (const el of node.children) {
        const tag = el.tagName;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (tag === "H1" || tag === "H2") { if (txt) out.push({ type: "h1", text: txt }); }
        else if (/^H[3-6]$/.test(tag)) { if (txt) out.push({ type: "h2", text: txt }); }
        else if (tag === "P") { if (txt.length > 2) out.push({ type: "p", text: txt }); }
        else if (tag === "BLOCKQUOTE") { if (txt.length > 2) out.push({ type: "quote", text: txt }); }
        else if (tag === "LI") { if (txt.length > 1) out.push({ type: "li", text: txt }); }
        else if (tag === "IMG") {
          let src = el.getAttribute("src") || "";
          if (src && !/^data:/.test(src)) {
            try { src = new URL(src, baseUrl).href; out.push({ type: "img", url: src, caption: el.getAttribute("alt") || "" }); } catch {}
          }
        } else if (["DIV", "SECTION", "ARTICLE", "MAIN", "UL", "OL", "TABLE", "TBODY", "TR", "TD", "FIGURE", "FIGCAPTION", "SPAN", "A", "BODY"].includes(tag)) {
          walk(el);
        }
        if (out.length > 600) return;
      }
    };
    walk(root);
    return out.filter((b, i) => !(i && b.text && out[i - 1].text === b.text));
  }

  _loadImages() {
    let n = 0;
    for (const b of this.blocks) {
      if (b.type !== "img" || b.img) continue;
      if (++n > 14) break;
      const direct = new Image();
      direct.crossOrigin = "anonymous";
      direct.src = b.url;
      direct.onload = () => { b.img = direct; this.draw(); };
      direct.onerror = () => {
        const prox = new Image();
        prox.crossOrigin = "anonymous";
        prox.src = "https://images.weserv.nl/?url=" + encodeURIComponent(b.url.replace(/^https?:\/\//, "")) + "&w=900";
        prox.onload = () => { b.img = prox; this.draw(); };
        prox.onerror = () => { b.failed = true; this.draw(); };
      };
    }
  }

  /* ---------------- layout + drawing ---------------- */
  _dims() {
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(50, Math.round(r.width * dpr));
    const h = Math.max(50, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    return { W: w, H: h, dpr };
  }

  /* typography scale for current width */
  _type(W) {
    /* comfortable reading column: max ~46em equivalent */
    const colW = Math.min(W * 0.86, Math.round(W * 0.06 * 13));
    const colX = Math.round((W - colW) / 2);
    const base = Math.round(Math.max(15, Math.min(W / 34, 42)) * this.fontScale);
    return {
      colW, colX, base,
      h1: Math.round(base * 1.7),
      h2: Math.round(base * 1.25),
      lead: Math.round(base * 1.12),
      lhP: 1.62, lhH: 1.25,
      serif: 'Georgia, "Times New Roman", serif',
      sans: 'system-ui, "Segoe UI", Roboto, sans-serif',
      sp: Math.round(base * 0.9)              /* vertical rhythm unit */
    };
  }

  draw() {
    const { W, H, dpr } = this._dims();
    const ctx = this.ctx;
    const T = READER_THEMES[this.theme] || READER_THEMES.light;

    /* page background (outside the article card) */
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    if (this.status !== "ready") {
      this._drawStatusCard(ctx, W, H, T);
      return;
    }

    const Y = this._type(W);
    const cardX = Math.max(6 * dpr, Y.colX - Y.sp * 1.6);
    const cardW = W - cardX * 2;

    /* measure pass → total height */
    let y = Y.sp * 2.2 - this.scroll;
    const top = y;
    ctx.save();
    for (const b of this.blocks) {
      const bh = this._blockH(ctx, b, Y);
      if (y + bh > -100 && y < H + 400) this._drawBlock(ctx, b, Y, y, T, dpr);
      y += bh;
    }
    ctx.restore();
    this.totalH = (y + this.scroll) + Y.sp * 3;

    /* article card frame: drawn under content via shadow trick — draw borders on top edges */
    ctx.save();
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 1.2 * dpr;
    ctx.strokeRect(cardX, -8, cardW, H + 16);
    ctx.restore();

    /* reading progress bar (top) */
    const prog = this.totalH > H ? this.scroll / (this.totalH - H) : 1;
    ctx.fillStyle = T.line;
    ctx.fillRect(0, 0, W, 4 * dpr);
    ctx.fillStyle = T.accent;
    ctx.fillRect(0, 0, W * Math.min(1, prog), 4 * dpr);

    /* scrollbar */
    if (this.totalH > H) {
      const sbH = Math.max(40, H * (H / this.totalH));
      const sbY = prog * (H - sbH);
      ctx.fillStyle = T.dim + "66";
      ctx.beginPath(); ctx.roundRect(W - 8 * dpr, sbY, 5 * dpr, sbH, 3 * dpr); ctx.fill();
    }

    /* footer chip: site + reading time */
    const words = this.blocks.reduce((a, b) => a + (b.text ? b.text.split(" ").length : 0), 0);
    const mins = Math.max(1, Math.round(words / 190));
    const chip = "📖 " + this.site + "  ·  ~" + mins + " min read";
    ctx.font = Math.round(Y.base * 0.72) + "px " + Y.sans;
    const chipW = ctx.measureText(chip).width + Y.sp * 1.6;
    ctx.fillStyle = T.page + "F2";
    ctx.beginPath(); ctx.roundRect((W - chipW) / 2, H - Y.sp * 2.1, chipW, Y.sp * 1.55, Y.sp); ctx.fill();
    ctx.strokeStyle = T.line; ctx.lineWidth = dpr; ctx.stroke();
    ctx.fillStyle = T.dim;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(chip, W / 2, H - Y.sp * 1.32);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  _drawStatusCard(ctx, W, H, T) {
    const base = Math.max(15, Math.min(W / 32, 40));
    const cw = Math.min(W * 0.8, 560 * (this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width || 1)));
    ctx.fillStyle = T.page;
    ctx.beginPath(); ctx.roundRect((W - cw) / 2, H * 0.3, cw, H * 0.4, 18); ctx.fill();
    ctx.strokeStyle = T.line; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = Math.round(base * 1.7) + "px system-ui";
    ctx.fillText(this.status === "loading" ? "⏳" : this.status === "error" ? "⚠" : "📖", W / 2, H * 0.41);
    ctx.fillStyle = this.status === "error" ? "#c0392b" : T.text;
    ctx.font = Math.round(base * 0.85) + "px system-ui";
    const msg = this.status === "loading" ? this.statusMsg
      : this.status === "error" ? this.statusMsg
      : "Enter a URL above and tap 📡 Cast to show the page to your students.";
    this._wrapCentred(ctx, msg, W / 2, H * 0.55, cw * 0.84, Math.round(base * 1.25));
    /* skeleton shimmer rows while loading */
    if (this.status === "loading") {
      ctx.fillStyle = T.line;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.roundRect((W - cw * 0.7) / 2, H * 0.62 + i * base * 1.1, cw * (0.7 - i * 0.12), base * 0.5, base * 0.25);
        ctx.fill();
      }
      /* keep animating */
      if (!this._shimmerRaf) {
        this._shimmerRaf = requestAnimationFrame(() => { this._shimmerRaf = null; if (this.status === "loading") this.draw(); });
      }
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }

  _blockH(ctx, b, Y) {
    if (b.type === "img") {
      if (b.failed) return 0;
      const iw = Y.colW;
      const ih = b.img ? Math.min(Math.round(iw * b.img.naturalHeight / b.img.naturalWidth), Y.base * 22) : Y.base * 7;
      const cap = b.caption ? Math.round(Y.base * 1.3) : 0;
      return ih + cap + Y.sp * 1.6;
    }
    let size, lh, font;
    if (b.type === "h1") { size = Y.h1; lh = Y.lhH; font = "700 " + size + "px " + Y.sans; }
    else if (b.type === "h2") { size = Y.h2; lh = Y.lhH; font = "700 " + size + "px " + Y.sans; }
    else if (b.lead) { size = Y.lead; lh = Y.lhP; font = size + "px " + Y.serif; }
    else { size = Y.base; lh = Y.lhP; font = size + "px " + Y.serif; }
    ctx.font = font;
    const maxW = Y.colW - (b.type === "li" ? Y.base * 1.5 : 0) - (b.type === "quote" ? Y.base * 1.8 : 0);
    const lines = this._wrapCount(ctx, b.text, maxW);
    const after = b.type === "h1" ? Y.sp * 1.1 : b.type === "h2" ? Y.sp * 0.7 : Y.sp * 0.85;
    const before = b.type === "h1" ? Y.sp * 0.9 : b.type === "h2" ? Y.sp * 0.8 : 0;
    return lines * Math.round(size * lh) + after + before;
  }

  _drawBlock(ctx, b, Y, y, T, dpr) {
    /* white page behind every block (article card) */
    const padX = Y.sp * 1.6;
    ctx.fillStyle = T.page;
    ctx.fillRect(Y.colX - padX, y - 2, Y.colW + padX * 2, this._blockH(ctx, b, Y) + 4);

    if (b.type === "img") {
      if (b.failed) return;
      const iw = Y.colW;
      const x = Y.colX;
      if (b.img) {
        let ih = Math.round(iw * b.img.naturalHeight / b.img.naturalWidth);
        ih = Math.min(ih, Y.base * 22);
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x, y + Y.sp * 0.4, iw, ih, Y.sp * 0.5); ctx.clip();
        ctx.drawImage(b.img, x, y + Y.sp * 0.4, iw, ih);
        ctx.restore();
        if (b.caption) {
          ctx.fillStyle = T.dim;
          ctx.font = "italic " + Math.round(Y.base * 0.78) + "px " + Y.serif;
          ctx.textAlign = "center";
          ctx.fillText(this._ellipsis(ctx, b.caption, iw), x + iw / 2, y + Y.sp * 0.4 + ih + Y.base);
          ctx.textAlign = "left";
        }
      } else {
        /* skeleton */
        ctx.fillStyle = T.quoteBg;
        ctx.beginPath(); ctx.roundRect(Y.colX, y + Y.sp * 0.4, iw, Y.base * 6, Y.sp * 0.5); ctx.fill();
        ctx.fillStyle = T.dim;
        ctx.font = Math.round(Y.base * 0.8) + "px " + Y.sans;
        ctx.textAlign = "center";
        ctx.fillText("🖼 loading image…", Y.colX + iw / 2, y + Y.sp * 0.4 + Y.base * 3);
        ctx.textAlign = "left";
      }
      return;
    }

    let size, lh, font, color, x = Y.colX, before = 0;
    if (b.type === "h1") { size = Y.h1; lh = Y.lhH; font = "700 " + size + "px " + Y.sans; color = T.head; before = Y.sp * 0.9; }
    else if (b.type === "h2") { size = Y.h2; lh = Y.lhH; font = "700 " + size + "px " + Y.sans; color = T.head; before = Y.sp * 0.8; }
    else if (b.lead) { size = Y.lead; lh = Y.lhP; font = size + "px " + Y.serif; color = T.text; }
    else { size = Y.base; lh = Y.lhP; font = size + "px " + Y.serif; color = T.text; }

    let maxW = Y.colW;
    let yy = y + before + size;

    if (b.type === "quote") {
      ctx.fillStyle = T.quoteBg;
      const qh = this._blockH(ctx, b, Y);
      ctx.beginPath(); ctx.roundRect(Y.colX, y + 2, Y.colW, qh - Y.sp * 0.7, Y.sp * 0.4); ctx.fill();
      ctx.fillStyle = T.accent;
      ctx.fillRect(Y.colX, y + 2, 4 * dpr, qh - Y.sp * 0.7);
      x = Y.colX + Y.base * 1.4;
      maxW = Y.colW - Y.base * 1.8;
      font = "italic " + size + "px " + Y.serif;
      yy = y + size + Y.sp * 0.3;
    }
    if (b.type === "li") {
      ctx.fillStyle = T.accent;
      if (b.num) { /* numbered: keep the number in the text */ }
      else { ctx.beginPath(); ctx.arc(Y.colX + Y.base * 0.4, yy - size * 0.32, Y.base * 0.16, 0, 7); ctx.fill(); }
      x = Y.colX + Y.base * 1.5;
      maxW = Y.colW - Y.base * 1.5;
    }

    /* heading underline accent for h1 */
    if (b.type === "h1") {
      ctx.fillStyle = T.accent;
      ctx.fillRect(Y.colX, y + before - Y.sp * 0.35, Y.base * 2.2, 4 * dpr);
    }

    ctx.font = font;
    ctx.fillStyle = color;
    let cur = "";
    for (const w of String(b.text).split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        ctx.fillText(cur, x, yy);
        yy += Math.round(size * lh);
        cur = w;
      } else cur = t;
    }
    ctx.fillText(cur, x, yy);
  }

  _ellipsis(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 4 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
    return text + "…";
  }
  _wrapCount(ctx, text, maxW) {
    let lines = 1, cur = "";
    for (const w of String(text).split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines++; cur = w; }
      else cur = t;
    }
    return lines;
  }
  _wrapCentred(ctx, text, cx, cy, maxW, lhPx) {
    const words = String(text).split(" ");
    const lines = []; let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    lines.push(cur);
    const y0 = cy - ((lines.length - 1) * lhPx) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lhPx));
  }

  /* ---------------- scrolling ---------------- */
  _bind() {
    let dragging = false, lastY = 0, vel = 0, raf = null, moved = 0, downY = 0;
    const dpr = () => this.canvas.width / Math.max(1, this.canvas.getBoundingClientRect().width);
    this.canvas.addEventListener("pointerdown", (e) => {
      dragging = true; lastY = e.clientY; downY = e.clientY; vel = 0; moved = 0;
      this.canvas.setPointerCapture(e.pointerId);
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = (lastY - e.clientY) * dpr();
      lastY = e.clientY;
      moved += Math.abs(dy);
      vel = dy;
      this._scrollBy(dy);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      /* tap (not drag) on the lower third = page down; upper third = page up */
      if (moved < 8 && e && e.clientY !== undefined) {
        const r = this.canvas.getBoundingClientRect();
        const frac = (e.clientY - r.top) / r.height;
        if (frac > 0.66) this._smoothBy(this.canvas.height * 0.82);
        else if (frac < 0.2) this._smoothBy(-this.canvas.height * 0.82);
        return;
      }
      const tick = () => {
        vel *= 0.94;
        if (Math.abs(vel) < 0.6) { raf = null; return; }
        this._scrollBy(vel);
        raf = requestAnimationFrame(tick);
      };
      if (Math.abs(vel) > 2) raf = requestAnimationFrame(tick);
    };
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this._scrollBy(e.deltaY * dpr());
    }, { passive: false });
  }
  _scrollBy(dy) {
    const H = this.canvas.height;
    this.scroll = Math.max(0, Math.min(Math.max(0, this.totalH - H), this.scroll + dy));
    this.draw();
  }
  _smoothBy(total) {
    const steps = 16; let i = 0;
    const tick = () => {
      i++;
      this._scrollBy(total / steps);
      if (i < steps) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
