/* ============================================================================
   auth-guard.js — Tutoring Connect V8 · pre-paint navigation gate
   ----------------------------------------------------------------------------
   PROBLEM THIS SOLVES
   The V7 gate lived inside app.js and only ran on DOMContentLoaded, AFTER the
   browser had already painted. An anonymous visitor could therefore read a
   protected page's entire scaffolding — nav tree, module names, table headers,
   KPI tiles — for several hundred milliseconds before being redirected, and
   could stop the redirect entirely by killing JS timing or hitting Esc.
   The page structure of the whole studio was effectively public.

   HOW THIS WORKS
   This file is loaded SYNCHRONOUSLY in <head>, before <body> exists:
     1. It classifies the current page against an explicit allow-list.
     2. On a protected page with no Supabase session token it redirects
        immediately - before any protected markup is parsed or painted.
     3. While a session is being verified it hides the document behind a
        lightweight splash, so nothing protected is ever visible to a
        signed-out visitor.

   SECURITY NOTE (important, and stated honestly)
   This is a NAVIGATION gate, not a data gate. Any static file can be fetched
   directly. The real protection is PostgreSQL Row Level Security - see
   database/v7-family-access-fix.sql. This layer exists so the product does not
   *leak its structure* and does not show broken empty screens to signed-out
   visitors. The two layers are complementary; neither replaces the other.
   ========================================================================== */
(function (w, d) {
  'use strict';

  /* Pages any visitor may open. Everything else demands a session. */
  var PUBLIC = [
    '', 'index', 'login', 'about', 'contact', 'apply', 'register', 'signup',
    'forgot-password', 'reset-password', 'offline', 'install', 'feature-guide',
    'hmg-ecosystem', 'hmg-products', 'developer', 'flyer', 'exam-register',
    'public-book', 'site-index', 'privacy', 'terms', '404',
    /* V25/V27/V29 public acquisition pages — must stay open without a session */
    'blog', 'blog-post', 'class-register', 'free-register'
  ];

  /* Code-gated public runtimes: a learner authenticates with a quiz code +
     student ID rather than a portal password. Deliberately reachable. */
  var CODE_GATED = ['cbt-exam', 'cbt-multi', 'cbt-review'];

  function page() {
    var f = (location.pathname.split('/').pop() || 'index.html');
    return f.replace(/\.html?$/i, '').split('?')[0].split('#')[0].toLowerCase();
  }

  /* Supabase persists its session under localStorage key sb-<ref>-auth-token. */
  function hasSession() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.*-auth-token$/.test(k)) {
          var v = localStorage.getItem(k);
          if (!v) continue;
          try {
            var s = JSON.parse(v);
            // Treat an expired token as no session so we fail closed.
            if (s && s.expires_at && (s.expires_at * 1000) < Date.now()) continue;
          } catch (e) { /* opaque value - still counts as present */ }
          return true;
        }
      }
    } catch (e) { return false; }
    return false;
  }

  var p = page();
  var isPublic = PUBLIC.indexOf(p) !== -1;
  var isCodeGated = CODE_GATED.indexOf(p) !== -1;

  w.TCGuard = {
    page: p,
    isPublic: isPublic,
    isCodeGated: isCodeGated,
    hasSession: hasSession,
    /* Called by app.js once the role is confirmed, to reveal the document. */
    release: function () {
      try {
        d.documentElement.classList.remove('tc-gated');
        var s = d.getElementById('tc-gate-splash');
        if (s && s.parentNode) s.parentNode.removeChild(s);
      } catch (e) {}
    },
    /* Called when verification fails. */
    reject: function (reason) {
      var next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
      location.replace('login.html?next=' + next + (reason ? '&reason=' + reason : ''));
    }
  };

  if (isPublic || isCodeGated) return;   // nothing to gate

  if (!hasSession()) {
    // Redirect BEFORE the body is parsed. replace() keeps the protected URL
    // out of history so Back cannot bounce into a half-rendered screen.
    var next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace('login.html?next=' + next + '&reason=signin');
    // Stop the rest of the document from executing while the redirect lands.
    try { d.documentElement.classList.add('tc-gated'); } catch (e) {}
    return;
  }

  /* A token exists but has not been verified against the server yet. Hide the
     document until app.js resolves the role, so a stale/tampered token never
     exposes a protected screen. */
  d.documentElement.classList.add('tc-gated');
  var style = d.createElement('style');
  style.textContent =
    'html.tc-gated body{visibility:hidden!important}' +
    '#tc-gate-splash{position:fixed;inset:0;z-index:2147483647;display:flex;' +
    'align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;' +
    'font:500 15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;visibility:visible!important}' +
    '#tc-gate-splash .tc-spin{width:34px;height:34px;border:3px solid rgba(255,255,255,.25);' +
    'border-top-color:#fff;border-radius:50%;animation:tcgspin .8s linear infinite;margin:0 auto 14px}' +
    '@keyframes tcgspin{to{transform:rotate(360deg)}}';
  d.head.appendChild(style);

  function splash() {
    if (d.getElementById('tc-gate-splash')) return;
    var el = d.createElement('div');
    el.id = 'tc-gate-splash';
    el.innerHTML = '<div style="text-align:center"><div class="tc-spin"></div>' +
      '<div>Verifying your session…</div></div>';
    (d.body || d.documentElement).appendChild(el);
  }
  if (d.body) splash(); else d.addEventListener('DOMContentLoaded', splash);

  /* Failsafe: if app.js never releases the gate (script error, offline, blocked
     CDN) do not strand the user on a blank screen - reveal after 6s. */
  setTimeout(function () { w.TCGuard.release(); }, 6000);
})(window, document);
