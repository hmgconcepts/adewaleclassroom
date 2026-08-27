/* portal-bridge.js — ADEWALE CLASSROOM DECK ↔ ADEWALE CLASSROOM portal
   Teachers who already signed into the portal do not log in again.
   We read the Supabase session from the parent origin's localStorage
   (same site) and optional PRACTICE brand from ../assets/js/config.js.
*/
(function (w) {
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
  function isTeachPage() {
    var p = (location.pathname || '').toLowerCase();
    return /teach\.html|classroom\.html|stream\.html|admin\.html|generate\.html/.test(p);
  }
  function isJoinPage() {
    return /join\.html/.test((location.pathname || '').toLowerCase());
  }
  function brandPaint() {
    var b = (w.CLASSDECK && w.CLASSDECK.BRAND) || {};
    try {
      document.title = (document.title || '')
        .replace(/HMG ACADEMY CLASS DECK/ig, b.productName || 'ADEWALE CLASSROOM DECK')
        .replace(/ClassDeck|Class Deck/ig, b.shortName || 'Classroom Deck')
        .replace(/HMG ACADEMY/ig, b.studioName || 'ADEWALE CLASSROOM');
    } catch (e) {}
    // Replace visible brand strings once DOM ready
    function rewrite(root) {
      var walk = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null);
      var node, nodes = [];
      while ((node = walk.nextNode())) nodes.push(node);
      nodes.forEach(function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return;
        var v = n.nodeValue;
        var nv = v
          .replace(/HMG ACADEMY CLASS DECK/g, b.productName || 'ADEWALE CLASSROOM DECK')
          .replace(/HMG Academy Class Deck/g, b.productName || 'ADEWALE CLASSROOM DECK')
          .replace(/HMG ACADEMY/g, b.studioName || 'ADEWALE CLASSROOM')
          .replace(/ClassDeck/g, b.shortName || 'Classroom Deck')
          .replace(/CLASS DECK/g, (b.shortName || 'CLASSROOM DECK').toUpperCase());
        if (nv !== v) n.nodeValue = nv;
      });
    }
    if (document.body) rewrite(document.body);
    else document.addEventListener('DOMContentLoaded', function () { rewrite(document.body); });
    // Header chip
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('acd-portal-chip')) return;
      var chip = document.createElement('div');
      chip.id = 'acd-portal-chip';
      chip.innerHTML = '<a href="../class-deck.html" style="color:inherit;text-decoration:none">← ADEWALE CLASSROOM</a>' +
        ' · <strong>' + (b.productName || 'Classroom Deck') + '</strong>' +
        (hasSbSession() ? ' · <span style="color:#bbf7d0">Portal session active</span>' : '');
      chip.style.cssText = 'position:fixed;z-index:99999;left:8px;right:8px;top:0;background:linear-gradient(135deg,#0506ae,#964eec);color:#fff;font:600 12px/1.4 system-ui,sans-serif;padding:6px 10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;box-shadow:0 4px 16px rgba(5,6,174,.35)';
      document.body.style.paddingTop = '32px';
      document.body.appendChild(chip);
    });
  }
  function guardTeacher() {
    var b = (w.CLASSDECK && w.CLASSDECK.BRAND) || {};
    if (!b.requirePortalSession) return;
    if (!isTeachPage()) return;
    if (hasSbSession()) return;
    // Allow demo query for local preview
    if (/[?&]demo=1/.test(location.search)) return;
    document.addEventListener('DOMContentLoaded', function () {
      var gate = document.createElement('div');
      gate.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:20px';
      gate.innerHTML = '<div style="background:#fff;color:#0f172a;max-width:420px;width:100%;border-radius:16px;padding:24px;font-family:system-ui,sans-serif">' +
        '<h2 style="margin:0 0 8px">Sign in to ADEWALE CLASSROOM first</h2>' +
        '<p style="margin:0 0 14px;line-height:1.5;color:#334155">Classroom Deck is part of your studio. Teachers use the same portal session — there is no separate Class Deck login.</p>' +
        '<a href="../login.html?next=class-deck.html" style="display:inline-block;background:#0506ae;color:#fff;padding:10px 16px;border-radius:10px;font-weight:700;text-decoration:none">Sign in to portal</a> ' +
        '<a href="../class-deck.html" style="margin-left:8px;color:#0506ae">Back to hub</a>' +
        '<p style="margin:14px 0 0;font-size:.8rem;color:#64748b">Students join free via join.html — they do not need a portal account.</p></div>';
      document.body.appendChild(gate);
    });
  }
  brandPaint();
  guardTeacher();
  w.ACDPortal = { hasSbSession: hasSbSession, brand: function () { return (w.CLASSDECK && w.CLASSDECK.BRAND) || {}; } };
})(window);
