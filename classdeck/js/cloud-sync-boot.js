/* =====================================================================
   cloud-sync-boot.js — ADEWALE CLASSROOM DECK · V55 round 20
   =====================================================================
   THE BUG THIS FILE FIXES (round 20): the cloud credential sync booted
   ONLY on the Teacher Studio page. The PWA's start page (index.html —
   what "open the classroom deck" actually opens), the Tablet Live
   page, the Admin console, the Classroom Command Centre, Community and
   the Generator never loaded cloud-creds.js at all — so opening the
   deck on the device that holds the TURN key did NOTHING unless the
   Teacher Studio specifically was the page that came up. The
   self-heal (a device holding credentials the account lacks uploads
   them automatically) now runs on EVERY teacher-facing deck page.

   It also closes the two update blind spots that kept OLD code
   running on exactly that device:
   - The first open after a redeploy still ran the PREVIOUS build:
     the old service worker served the old page from its cache, and
     the new worker only takes over from the NEXT load. This boot
     watches for an installing/replacing worker and shows a persistent
     "Reload now" banner, and re-checks for updates whenever the app
     becomes visible — a long-lived PWA no longer has to wait for a
     fresh navigation to learn that an update exists.
   - A device that holds credentials but has NO portal session linked
     did nothing and said nothing (the old boot was silently gated on
     signedIn()). It now says, once a day, exactly what to do.

   On teach.html this file loads AFTER teach.js (which registers the
   onApply refresh hook before the pull runs). Everywhere else it runs
   standalone — including on pages that do not load common.js, via the
   Store shim below. It is a complete no-op on devices with no session
   and no saved credentials (students, first-time visitors).
   ===================================================================== */
"use strict";
(function () {
  if (!window.CloudCreds) return;

  /* Store shim — identical semantics to common.js (hmgcd_ prefix), so
     this boot reads/writes the SAME credential storage on pages that
     do not load common.js (classroom.html, community.html). */
  if (!window.Store) {
    window.Store = {
      get: function (key, fallback) {
        try {
          var v = localStorage.getItem("hmgcd_" + key);
          return v === null ? fallback : JSON.parse(v);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try { localStorage.setItem("hmgcd_" + key, JSON.stringify(value)); } catch (e) {}
      }
    };
  }

  /* Toast: use the page's toast() when common.js is present; otherwise
     a self-contained mini-toast so the message is never console-only. */
  function say(msg, kind, ms) {
    try { if (typeof window.toast === "function") { window.toast(msg, kind, ms); return; } } catch (e) {}
    try {
      var t = document.createElement("div");
      t.textContent = msg;
      var bg = kind === "err" ? "#7f1d1d" : "#065f46";
      t.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99998;" +
        "background:" + bg + ";color:#fff;padding:10px 16px;border-radius:12px;" +
        "font:13px/1.45 system-ui,sans-serif;max-width:92vw;box-shadow:0 8px 30px rgba(0,0,0,.35);";
      (document.body || document.documentElement).appendChild(t);
      setTimeout(function () { t.remove(); }, ms || 10000);
    } catch (e) {}
  }

  /* ── 1 · service-worker update messenger ──────────────────────────
     A teacher who keeps the deck open (or uses the installed PWA)
     must be TOLD a new version arrived — the old flow needed a fresh
     navigation before the browser even checked, and one more load
     before the new worker served the new page. */
  var LATER_KEY = "cd-sw-update-later";
  function laterRecentlyDismissed() {
    try {
      var t = Number(localStorage.getItem(LATER_KEY) || 0);
      return !!t && (Date.now() - t) < 6 * 3600 * 1000;
    } catch (e) { return false; }
  }
  function updateBanner() {
    if (laterRecentlyDismissed()) return;
    if ((typeof document !== "undefined") && document.getElementById("cdUpdateBanner")) return;
    var b = document.createElement("div");
    b.id = "cdUpdateBanner";
    b.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99999;" +
      "background:#1f2937;color:#fff;padding:10px 16px;border-radius:12px;font:13px/1.4 system-ui,sans-serif;" +
      "display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:92vw;flex-wrap:wrap;";
    var label = document.createElement("span");
    label.textContent = "🔄 A new version of the deck is ready.";
    var btn = document.createElement("button");
    btn.textContent = "Reload now";
    btn.style.cssText = "border:0;border-radius:8px;padding:6px 12px;background:#31c48d;color:#06281a;font-weight:700;cursor:pointer;";
    btn.addEventListener("click", function () { try { location.reload(); } catch (e) {} });
    var later = document.createElement("button");
    later.textContent = "Later";
    later.style.cssText = "border:0;border-radius:8px;padding:6px 12px;background:rgba(255,255,255,.18);color:#fff;cursor:pointer;";
    later.addEventListener("click", function () {
      try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch (e) {}
      b.remove();
    });
    b.appendChild(label); b.appendChild(btn); b.appendChild(later);
    try { (document.body || document.documentElement).appendChild(b); } catch (e) {}
  }
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistration) {
      var wasControlled = !!(navigator.serviceWorker.controller);
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        try {
          reg.addEventListener("updatefound", function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", function () {
              if (nw.state === "installed" && navigator.serviceWorker.controller) updateBanner();
            });
          });
        } catch (e) {}
        var poke = function () { try { reg.update(); } catch (e) {} };
        document.addEventListener("visibilitychange", function () { if (!document.hidden) poke(); });
        setInterval(poke, 6 * 3600 * 1000);
      }).catch(function () {});
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        /* Only meaningful when an OLDER worker controlled this page —
           on the very first install there is no old version to replace. */
        if (wasControlled) updateBanner();
      });
    }
  } catch (e) {}

  /* ── 2 · the boot sync: pull + VISIBLE self-heal ──────────────────
     Identical behaviour on every page: signed in → pull (a device that
     holds credentials the account lacks uploads them, and SAYS so,
     naming the account so a wrong-account upload is instantly visible);
     not signed in but holds credentials → the once-a-day link hint. */
  if (CloudCreds.signedIn()) {
    CloudCreds.pull().then(function (ok) {
      var h = (CloudCreds.selfHeal && CloudCreds.selfHeal()) || { pushed: [], failed: [] };
      var email = (CloudCreds.sessionEmail && CloudCreds.sessionEmail()) || "";
      if (h.pushed && h.pushed.length) {
        say("☁️ Uploaded this device's " + h.pushed.join(", ") + " to " + (email || "your account") +
          " — the account did not have them yet (an older version's save had silently failed). Every device you sign in on now restores them.", "ok", 12000);
      } else if (h.failed && h.failed.length) {
        say("⚠️ This device holds " + h.failed.join(", ") + " that your account doesn't have, but the upload failed: " +
          ((CloudCreds.status && CloudCreds.status().reason) || "unknown") +
          ". Open the Teacher Studio → ⚙ Settings → ☁️ Cloud sync → 🔄 Sync now to retry.", "err", 14000);
      } else if (!ok) {
        /* portal unreachable: local credentials keep working; the sync
           card on the Teacher Studio shows the exact reason */
      }
    }).catch(function () {});
  } else {
    var held = (CloudCreds.holdsLocal && CloudCreds.holdsLocal()) || [];
    if (held.length) {
      /* once a day — visible, never nagging */
      var HINT_AT = "cd-link-hint-at";
      var last = 0;
      try { last = Number(localStorage.getItem(HINT_AT) || 0); } catch (e) {}
      if (!last || (Date.now() - last) > 24 * 3600 * 1000) {
        try { localStorage.setItem(HINT_AT, String(Date.now())); } catch (e) {}
        say("🔑 This device has " + held.join(", ") + " saved on it, but no ADEWALE CLASSROOM account is linked in this browser — they exist ONLY on this device. " +
          "Sign in to the portal (or open the Teacher Studio → ⚙ Settings → ☁️ Cloud sync → Link account) and they upload to your account automatically.", "err", 14000);
      }
    }
  }
})();
