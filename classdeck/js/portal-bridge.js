/* portal-bridge.js — ADEWALE CLASSROOM DECK ↔ portal (V36)
   - No second login / trial
   - Top chip sits BESIDE brand, never covers toolbar buttons
   - Applies client PRACTICE brand (name, colours, logo) into the deck
*/
(function (w, d) {
  'use strict';

  function hasSbSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) {
          var v = localStorage.getItem(k);
          if (!v) continue;
          try {
            var s = JSON.parse(v);
            if (s && s.expires_at && (s.expires_at * 1000) < Date.now()) continue;
          } catch (e) {}
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function readPractice() {
    // 1) live PRACTICE from parent portal config if same origin already loaded
    if (w.PRACTICE && w.PRACTICE.name) return w.PRACTICE;
    // 2) stamped deck brand
    if (w.CLASSDECK && w.CLASSDECK.BRAND && w.CLASSDECK.BRAND.studioName)
      return {
        name: w.CLASSDECK.BRAND.studioName,
        shortName: w.CLASSDECK.BRAND.shortName,
        theme: { primary: w.CLASSDECK.BRAND.primary, accent: w.CLASSDECK.BRAND.accent },
        logoUrl: w.CLASSDECK.BRAND.logoUrl,
        email: w.CLASSDECK.BRAND.email
      };
    // 3) PRACTICE.json next to deck or parent
    return null;
  }

  function applyTheme(p) {
    if (!p) return;
    var th = p.theme || {};
    var primary = th.primary || (w.CLASSDECK && w.CLASSDECK.BRAND && w.CLASSDECK.BRAND.primary) || '#0506ae';
    var accent = th.accent || (w.CLASSDECK && w.CLASSDECK.BRAND && w.CLASSDECK.BRAND.accent) || '#964eec';
    try {
      var r = d.documentElement.style;
      r.setProperty('--brand', primary);
      r.setProperty('--brand-2', accent);
      r.setProperty('--primary', primary);
      r.setProperty('--accent', accent);
      r.setProperty('--sc-primary', primary);
      r.setProperty('--sc-accent', accent);
    } catch (e) {}
    // Update brand text in topbar without touching buttons
    try {
      var brandSpan = d.querySelector('.topbar .brand span');
      var name = p.name || (w.CLASSDECK && w.CLASSDECK.BRAND && w.CLASSDECK.BRAND.productName) || 'ADEWALE CLASSROOM DECK';
      if (brandSpan) brandSpan.textContent = name;
      var brandImg = d.querySelector('.topbar .brand img');
      var logo = p.logoUrl || (w.CLASSDECK && w.CLASSDECK.BRAND && w.CLASSDECK.BRAND.logoUrl);
      if (brandImg && logo) {
        // Prefer portal logo if path resolves
        var tryLogo = logo;
        if (logo.indexOf('assets/') === 0) tryLogo = '../' + logo;
        brandImg.src = tryLogo;
        brandImg.onerror = function () { this.onerror = null; this.src = 'assets/icon-96.png'; };
      }
      d.title = name + ' · Live teach';
    } catch (e) {}
  }

  function isStudentJoinPage() {
    /* v13 FIX (reported): on the STUDENT join page the fixed chip sat at
       top:0 z-index 5000 and covered the student's own top controls — the
       stage status chips, the top-anchored chat drawer and its ✕ close
       button, and the teacher PiP. The chip exists for STAFF navigating
       back to the studio; students never need it. Do not render it here.
       v13.1: the path match now also covers trailing slashes and bare
       /join (pretty-URL hosts), so no student entry variant slips through. */
    try {
      if (/join(\.html?)?\/?$/i.test(w.location.pathname)) return true;
      if (/\/join\/|^\/join$/i.test(w.location.pathname)) return true;
      if (d.getElementById('stuControls') || d.getElementById('joinGate')) return true;
    } catch (e) {}
    return false;
  }

  /* v13.2: the chip is GONE. Three rounds of field reports showed a fixed
     top bar — however carefully positioned — eventually covering something
     on some device. The studio link now lives where it can NEVER cover
     anything: inline inside the page's own topbar (it participates in the
     layout), or as a small pill anchored to the BOTTOM corner on pages
     without a topbar. A bottom-anchored element cannot block the top
     icons, on any device, with or without a notch. Students get nothing
     at all (isStudentJoinPage below). */
  function installBackLink() {
    if (isStudentJoinPage()) return;              /* never on the student page */
    try {
      if (w.sessionStorage && w.sessionStorage.getItem('acd-back-dismissed')) return;
    } catch (e) {}
    var b = (w.CLASSDECK && w.CLASSDECK.BRAND) || {};
    var p = readPractice() || {};
    var studio = p.name || b.studioName || 'ADEWALE CLASSROOM';

    /* 1) teach.html / classroom.html have a real <header class="topbar">:
          append an INLINE link — layout flow, zero coverage risk. */
    var bar = null;
    try { bar = d.querySelector('header.topbar') || d.querySelector('.topbar'); } catch (e) {}
    if (bar) {
      if (d.getElementById('acd-back-link')) return;
      var a = d.createElement('a');
      a.id = 'acd-back-link';
      a.href = '../class-deck.html';
      a.textContent = '\u2190 Studio';
      a.title = studio + ' \u2014 back to the studio';
      a.setAttribute('style', 'margin-left:auto;flex:0 0 auto;color:inherit;opacity:.85;text-decoration:none;font:700 12px/1 system-ui,sans-serif;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.10);white-space:nowrap');
      try { bar.appendChild(a); } catch (e) {}
      return;
    }

    /* 2) every other staff page: a dismissible pill pinned to the BOTTOM
          corner \u2014 physically unable to block the top of the screen. */
    if (d.getElementById('acd-back-pill')) return;
    var pill = d.createElement('div');
    pill.id = 'acd-back-pill';
    pill.setAttribute('role', 'navigation');
    pill.innerHTML =
      '<a href="../class-deck.html" style="color:#fff;text-decoration:none;font-weight:700">\u2190 ' + studio + '</a>' +
      '<button id="acd-back-x" title="Hide (it comes back next visit)" aria-label="Hide bar" ' +
      'style="background:none;border:0;color:#fff;opacity:.75;font:700 14px/1 system-ui,sans-serif;cursor:pointer;padding:0 2px">\u2715</button>';
    pill.style.cssText = [
      'position:fixed', 'right:12px',
      'bottom:calc(12px + env(safe-area-inset-bottom,0px))',
      'z-index:4000',
      'display:flex', 'align-items:center', 'gap:8px',
      'padding:9px 14px', 'border-radius:999px',
      'background:linear-gradient(135deg,#0506ae,#964eec)',
      'color:#fff', 'font:600 12px system-ui,sans-serif',
      'box-shadow:0 4px 14px rgba(5,6,174,.35)',
      'pointer-events:auto', 'box-sizing:border-box', 'max-width:70vw',
      'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis'
    ].join(';');
    d.body.appendChild(pill);
    try {
      d.getElementById('acd-back-x').onclick = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        try { w.sessionStorage.setItem('acd-back-dismissed', '1'); } catch (e) {}
        pill.remove();
      };
    } catch (e) {}
  }

  function killAuthGate() {
    try {
      w.HMG_AUTH_OK = true;
      w.ACD_AUTH_OK = true;
      var gate = d.getElementById('authGate');
      if (gate) { gate.style.display = 'none'; gate.setAttribute('hidden', 'true'); try { gate.remove(); } catch (e) {} }
      d.querySelectorAll('.auth-gate').forEach(function (el) {
        el.style.display = 'none'; el.style.pointerEvents = 'none';
      });
    } catch (e) {}
  }

  function boot() {
    killAuthGate();
    applyTheme(readPractice());
    installBackLink();
    // Re-apply after late scripts
    setTimeout(function () { killAuthGate(); applyTheme(readPractice()); }, 100);
    setTimeout(killAuthGate, 800);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Load parent PRACTICE if available (same origin)
  try {
    if (!w.PRACTICE) {
      var s = d.createElement('script');
      s.src = '../assets/js/config.js';
      s.async = true;
      s.onload = function () { applyTheme(readPractice()); };
      d.head.appendChild(s);
    }
  } catch (e) {}

  w.ACDPortal = {
    hasSbSession: hasSbSession,
    applyTheme: applyTheme,
    brand: function () { return (w.CLASSDECK && w.CLASSDECK.BRAND) || {}; }
  };
})(window, document);
