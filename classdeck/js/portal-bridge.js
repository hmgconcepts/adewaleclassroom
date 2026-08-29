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

  function installChip() {
    if (d.getElementById('acd-portal-chip')) return;
    var b = (w.CLASSDECK && w.CLASSDECK.BRAND) || {};
    var p = readPractice() || {};
    var studio = p.name || b.studioName || 'ADEWALE CLASSROOM';
    var chip = d.createElement('div');
    chip.id = 'acd-portal-chip';
    // CRITICAL: do not cover the top toolbar. Place as a slim bar ABOVE the
    // studio by growing --toolbar offset, with pointer-events only on links.
    chip.innerHTML =
      '<a href="../class-deck.html" style="color:#fff;text-decoration:none;font-weight:700">← ' + studio + '</a>' +
      '<span style="opacity:.85">· Classroom Deck</span>' +
      (hasSbSession() ? '<span style="color:#bbf7d0;margin-left:6px">· signed in</span>' : '') +
      '<span style="flex:1"></span>' +
      '<a href="../sessions.html" style="color:#e0e7ff;text-decoration:none;font-size:11px">Sessions</a>';
    chip.setAttribute('role', 'navigation');
    chip.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'top:0',
      'height:28px', 'z-index:5000',
      'display:flex', 'align-items:center', 'gap:8px', 'flex-wrap:nowrap',
      'padding:0 10px',
      'background:linear-gradient(135deg,#0506ae,#964eec)',
      'color:#fff', 'font:600 12px/28px system-ui,sans-serif',
      'box-shadow:0 2px 10px rgba(5,6,174,.3)',
      'pointer-events:auto'
    ].join(';');
    d.body.appendChild(chip);
    // Push the whole studio down so topbar buttons stay clickable
    try {
      d.documentElement.style.setProperty('--acd-chip-h', '28px');
      var st = d.getElementById('acd-chip-style');
      if (!st) {
        st = d.createElement('style');
        st.id = 'acd-chip-style';
        st.textContent = [
          'body{padding-top:28px !important; box-sizing:border-box;}',
          '.studio{height:calc(100dvh - 28px) !important;}',
          /* ensure topbar stays above workspace, below chip only */
          '.topbar{position:relative;z-index:20;}',
          '.topbar .btn{pointer-events:auto !important; position:relative; z-index:21;}',
          '#authGate,.auth-gate{display:none !important; pointer-events:none !important;}'
        ].join('\n');
        d.head.appendChild(st);
      }
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
    installChip();
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
