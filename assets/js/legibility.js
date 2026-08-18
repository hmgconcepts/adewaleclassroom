/* ============================================================================
   legibility.js — the popup contrast guard
   ----------------------------------------------------------------------------
   WHY THIS EXISTS (third attempt at the same bug, done properly this time)

   "Whenever a popup shows up on any page, the text is not legible."

   My first fix added CSS for `.modal`. My second fixed `site-help.js` at
   source. Both were partial, because the real problem is structural, not
   located in any one file:

     * Popups are built in a dozen different scripts.
     * Most set `background:#fff` or `background:white` INLINE and never set a
       text colour, so the text inherits whatever `color` the app shell or the
       active theme happens to be using — which on a dark-capable theme is a
       near-white intended for a dark surface.
     * Inline styles beat stylesheets, so no amount of CSS can reliably win.
     * New popups get written all the time, and each one can reintroduce it.

   Chasing that with string edits is whack-a-mole. This does it structurally.

   HOW IT WORKS

   A MutationObserver watches for popup-like elements entering the DOM (fixed
   or absolute overlays, anything classed modal/popup/dropdown/panel/toast).
   For each one it walks up to find the real painted background colour, works
   out the relative luminance, and if the text colour does not clear the WCAG
   AA contrast ratio of 4.5:1 against it, it pins a colour that does — dark ink
   on a light surface, near-white on a dark one — using setProperty(..., 
   'important') so it beats the inline style that caused the problem.

   It is deliberately CONSERVATIVE: it only ever touches an element whose
   contrast is genuinely failing, so a deliberately styled popup (a dark
   assistant panel, a coloured toast) is left exactly as its author intended.

   No dependencies, no API calls, ~4 KB.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var SEL = [
    '.modal', '.modal-content', '.tc-popup', '.modal-backdrop > div',
    '.notif-dropdown', '#notif-dropdown', '#tc-bot-panel', '.tc-tool',
    '[class*="popup"]', '[class*="dropdown"]', '[role="dialog"]', '[aria-modal="true"]'
  ].join(',');

  /* sRGB relative luminance, per WCAG 2.1 */
  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function parseColor(str) {
    if (!str) return null;
    var m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length >= 4 && p[3] === 0) return null;          // fully transparent
    if (p.length < 3 || p.some(isNaN)) return null;
    return [p[0], p[1], p[2]];
  }

  /* The colour actually painted behind an element: walk up until we meet a
     non-transparent background, falling back to white (the page default). */
  function effectiveBg(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var c = parseColor(w.getComputedStyle(node).backgroundColor);
      if (c) return c;
      node = node.parentElement;
    }
    return [255, 255, 255];
  }

  function fix(el) {
    if (!el || el.nodeType !== 1 || el.dataset.tcLegible === '1') return;
    var cs;
    try { cs = w.getComputedStyle(el); } catch (e) { return; }
    if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return;

    var bg = effectiveBg(el);
    var fg = parseColor(cs.color) || [15, 23, 42];
    var ratio = contrast(fg, bg);
    if (ratio >= 4.5) { el.dataset.tcLegible = '1'; return; }   // already fine

    // Choose the ink that wins against this surface.
    var dark = [15, 23, 42];      // #0f172a — 17.4:1 on white
    var light = [248, 250, 252];  // #f8fafc — 16.1:1 on #0f172a
    var pick = contrast(dark, bg) >= contrast(light, bg) ? '#0f172a' : '#f8fafc';
    var muted = pick === '#0f172a' ? '#475569' : '#cbd5e1';
    var link = pick === '#0f172a' ? '#0506ae' : '#a5b4fc';

    el.style.setProperty('color', pick, 'important');
    el.dataset.tcLegible = '1';
    el.dataset.tcLegibleFixed = String(Math.round(ratio * 10) / 10);

    /* Children that carry their OWN failing inline colour need the same
       treatment; children that simply inherit are already fixed above. */
    var kids = el.querySelectorAll('*');
    for (var i = 0; i < kids.length && i < 400; i++) {
      var k = kids[i];
      if (k.tagName === 'SVG' || k.tagName === 'IMG' || k.tagName === 'CANVAS') continue;
      var kcs;
      try { kcs = w.getComputedStyle(k); } catch (e) { continue; }
      var kbg = parseColor(kcs.backgroundColor) || bg;
      var kfg = parseColor(kcs.color);
      if (!kfg) continue;
      if (contrast(kfg, kbg) < 4.5) {
        var isMuted = /muted|help|hint|small|caption/i.test(k.className || '') || k.tagName === 'SMALL';
        var isLink = k.tagName === 'A';
        k.style.setProperty('color', isLink ? link : (isMuted ? muted : pick), 'important');
      }
      // Form controls inside a popup must be readable even if a theme
      // recoloured them for a dark surface.
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(k.tagName)) {
        var cbg = parseColor(kcs.backgroundColor);
        if (!cbg || contrast(parseColor(kcs.color) || dark, cbg) < 4.5) {
          k.style.setProperty('background-color', pick === '#0f172a' ? '#ffffff' : '#1e293b', 'important');
          k.style.setProperty('color', pick, 'important');
        }
      }
    }
  }

  function scan(root) {
    root = root || d;
    try {
      if (root.nodeType === 1 && root.matches && root.matches(SEL)) fix(root);
      var list = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
      for (var i = 0; i < list.length; i++) fix(list[i]);
    } catch (e) {}
  }

  /* Watch for popups appearing, and for a popup being revealed by a class or
     style change (most are built once and toggled). */
  function start() {
    scan(d);
    if (!w.MutationObserver) return;
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType === 1) scan(n);
          }
        } else if (m.type === 'attributes' && m.target && m.target.nodeType === 1) {
          // Re-evaluate: the surface may have changed under the text.
          delete m.target.dataset.tcLegible;
          scan(m.target);
        }
      }
    });
    mo.observe(d.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden']
    });
    w.TCLegibility = {
      rescan: function () {
        d.querySelectorAll('[data-tc-legible]').forEach(function (e) { delete e.dataset.tcLegible; });
        scan(d);
      },
      /* Exposed so the test suite can assert the maths rather than trust it. */
      contrast: contrast,
      luminance: luminance,
      _fix: fix
    };
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  // Themes repaint asynchronously; re-check shortly after boot.
  setTimeout(function () { if (w.TCLegibility) w.TCLegibility.rescan(); }, 1200);
})(window, document);
