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
        .replace(/ADEWALE CLASSROOM DECK/ig, b.productName || 'ADEWALE CLASSROOM DECK')
        .replace(/ClassDeck|Class Deck/ig, b.shortName || 'Classroom Deck')
        .replace(/ADEWALE CLASSROOM/ig, b.studioName || 'ADEWALE CLASSROOM');
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
          .replace(/ADEWALE CLASSROOM DECK/g, b.productName || 'ADEWALE CLASSROOM DECK')
          .replace(/ADEWALE CLASSROOM DECK/g, b.productName || 'ADEWALE CLASSROOM DECK')
          .replace(/ADEWALE CLASSROOM/g, b.studioName || 'ADEWALE CLASSROOM')
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
    /* V35: no gate. Deck is open inside ADEWALE CLASSROOM. Portal chip still shows. */
    return;
  }
  brandPaint();
  guardTeacher();
  w.ACDPortal = { hasSbSession: hasSbSession, brand: function () { return (w.CLASSDECK && w.CLASSDECK.BRAND) || {}; } };
})(window);
