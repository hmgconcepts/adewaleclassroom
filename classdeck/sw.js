/* ============================================================
   ADEWALE CLASSROOM DECK — Service Worker v11.1.1
   Cache-first for the app shell so the studio opens instantly
   and works offline (live class still needs internet, but the
   whiteboard/PDF/notes work fully offline).
   
   NEW: Forces PWA install by returning index.html for navigation
   requests, making the site feel native on repeat visits.
   Bump CACHE_VERSION whenever you deploy changes.
   ============================================================ */
const CACHE_VERSION = "hmg-classdeck-v11.1.1-classdesk-v3";

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
  "./js/join.js",
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

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);

      // Stale-while-revalidate: serve cached instantly, refresh in background
      if (cached) {
        fetch(e.request).then(res => {
          if (res && res.ok) cache.put(e.request, res);
        }).catch(() => {});
        return cached;
      }

      try {
        return await fetchPromise;
      } catch (err) {
        // For navigation requests, return index.html as offline fallback
        if (e.request.mode === "navigate") {
          const fallback = await cache.match("./index.html");
          if (fallback) return fallback;
        }
        return Response.error();
      }
    })()
  );
});