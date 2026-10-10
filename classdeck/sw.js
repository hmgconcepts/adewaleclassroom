/* ============================================================
   ADEWALE CLASSROOM DECK — Service Worker v11.1.1
   Cache-first for the app shell so the studio opens instantly
   and works offline (live class still needs internet, but the
   whiteboard/PDF/notes work fully offline).
   
   NEW: Forces PWA install by returning index.html for navigation
   requests, making the site feel native on repeat visits.
   Bump CACHE_VERSION whenever you deploy changes.
   ============================================================ */
const CACHE_VERSION = "hmg-classdeck-v15.1.0-r21-classflex";  /* bumped: r21 — seamless mid-class broadcast switching (replaceTrack, nothing stops), WebM recordings gain a real Cues seek index (VLC/laptop players seek without stopping), Co-Tutor role (full tutor toolkit), shared screens never cropped + 1080p detail + theater view, teacher chooses who sees a student screen (me / whole class) and can present a student board to the class, CBT text clarity pass */  /* bumped: V55 round 20 — the cloud sync boots on EVERY teacher-facing deck page (js/cloud-sync-boot.js: pull + visible self-heal + not-linked hint), a service-worker update banner ends the first-open-after-redeploy handover gap, diagnose gains the local-device inventory step, and relay-only devices count as holding credentials */  /* bumped: V53 round 17 — credential writes go through the tc_set_user_setting RPC (the REST upsert class of silent failures is gone), sync card re-renders on push, honest not-linked warning on save */  /* bumped: V52 round 16 — cloud credential sync truth: push resolves uid BEFORE upload (the silent NULL-user 403 that left "nothing saved yet" on other devices), shape-based channel restore, real two-way Sync now, last-sync stamps on push */  /* bumped: v14.1 MicDoctor (laptop mic failures: constraint ladder, silence watchdog, recovery banner), CBT console + Archive Recovery Center on Quizzes, role-aware Homework page, V46 assignment automation */  /* bumped: v14 adds assistant tutors (co-hosts), mute-all/lower-hands/attendance CSV, scrollable zoomable whiteboard pages and PDF anchored zoom with visible scrollbars */

const SHELL = [
  "./",
  "./index.html",
  "./teach.html",
  "./admin.html",
  "./join.html",
  "./stream.html",
  "./cbt.html",
  "./classroom.html",
  "./community.html",
  "./parent.html",
  "./generate.html",
  "./404.html",
  "./css/style.css",
  "./js/common.js",
  "./js/whiteboard.js",
  "./js/webcast.js",
  "./js/rtc.js",
  "./js/teach.js",
  "./js/toolkit.js",
  "./js/toolkit-data.js",
  "./js/toolkit-data2.js",
  "./js/toolkit-data3.js",
  "./js/toolkit-ext.js",
  "./js/security-config.js",
  "./js/auth.js",
  "./js/cloud-creds.js",
  "./js/cloud-sync-boot.js",
  "./js/webm-cues.js",
  "./js/join.js",
  "./js/portal-bridge.js",
  "./js/enhancements.js",
  "./js/generator.js",
  "./js/config.js",
  "./js/license.js",
  "./js/ecosystem-branding.js",
  "./js/enterprise-enhanced.js",
  "./vendor/peerjs.min.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/qrcode.min.js",
  "./assets/icon-96.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/hmg-academy-logo.png",
  "./assets/founder-photo.jpg",
  "./assets/icon-master.png",
  "./manifest.json",
  "./manifest.webmanifest",
  "./version.json",
  "./robots.txt",
  "./sitemap.xml"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(async (c) => {
      /* addAll is atomic — one missing optional entry (e.g. generate.html
         inside a generated client deck that ships without the generator at
         root) would otherwise fail the whole install. Use allSettled so the
         available shell assets are still cached and the SW activates. */
      const results = await Promise.allSettled(SHELL.map((url) => c.add(url)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed) console.warn("[SW] Skipped", failed, "optional precache resource(s)");
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept WebRTC signalling, relay calls, or cross-origin calls.
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  /* v15 (round 18) — NETWORK-FIRST FOR PAGES. The old handler was
     stale-while-revalidate for EVERYTHING, HTML included: it served the
     CACHED page on every visit and refreshed only in the background.
     That is precisely why fixed bugs "persisted" for users — the visit
     right after a redeploy still ran the PREVIOUS build's teach.html
     (and with it the previous JS), and the fix only arrived on the
     visit after that. Documents now go to the NETWORK first and fall
     back to the cache only when offline; versioned assets (?v=NN are
     immutable by construction) stay cache-first. The old handler also
     fetched every served-from-cache resource TWICE (once for
     fetchPromise, once inside the cached branch) — fixed. */
  const isPage = e.request.mode === "navigate" ||
    (e.request.destination || "") === "document" ||
    (/\.html?$/.test(url.pathname) && url.search.indexOf("v=") === -1);

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);

      if (isPage) {
        try {
          /* v15.0.3: bypass the HTTP cache for pages — network-first must
             mean the NETWORK, not a stale intermediate copy. */
          const res = await fetch(e.request, { cache: "no-cache" });
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        } catch (err) {
          /* offline (or the server is down): the cached page still opens */
          const same = await cache.match(e.request) || await cache.match(url.pathname);
          const fallback = same || await cache.match("./index.html");
          if (fallback) return fallback;
          return Response.error();
        }
      }

      /* v10: exact match — a new ?v= query is a cache MISS, so updated JS
         reaches students on their very next load. (ignoreSearch served the
         stale precached copy forever and defeated every version bump.) */
      const cached = await cache.match(e.request) || (url.search === "" ? await cache.match(url.pathname) : null);

      // Stale-while-revalidate (assets only): serve cached instantly, refresh once in background
      if (cached) {
        fetch(e.request).then(res => {
          if (res && res.ok) cache.put(e.request, res);
        }).catch(() => {});
        return cached;
      }

      try {
        const res = await fetch(e.request);
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })()
  );
});