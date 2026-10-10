// Tutoring Connect — Service Worker (offline shell + push)
// Bump CACHE on every runtime release so previously cached code is purged.
//
// IMPORTANT: this file ships in BOTH the generator package AND every generated
// client ZIP, so the CORE list must only reference files that exist in the
// CLIENT build (builder.html / generator.js / wizard.js are generator-only and
// must NOT be precached here). Each URL is cached individually so one missing
// file never aborts the whole precache (cache.addAll is atomic).
const CACHE = 'tc-shell-v23-20261010';   /* bumped: V54 round 18 — verified credential sync (write+read-back before "saved" is claimed, push queue, single-flight refresh, persisted sync stamp, 🔍 Diagnose), deck service worker network-first for pages (the stale-page trap that made fixed bugs look unfixed), Google Drive backup real progress (staged panel + byte-level XHR upload + auto-sync pill) */  /* was: tc-shell-v22-20261010 */   /* bumped: V53 round 17 — credential-truth RPCs (TURN key really reaches the account), tc_stamp_backup (Last backup can no longer stay 'never'), tutor content isolation, staff 360 monitors (tutor + family), DataTools fix, TZ working-hours fix */  /* was: tc-shell-v21-20261010   /* bumped: V52 round 16 — timezone truth (dual studio+student times on every schedule page, meeting planner, world clocks), empty-ref-name race fix (auth-session gate + self-healing retry), family-safe link cells, App.detectRole, tc_last_backup (Last-backup card never 'never' again) */  /* was: tc-shell-v20-20261009; bumped: V51 round 15 — role-aware link names for the student portal, digital-library quiz + points workbench, homework points workbench, cloud last-backup, TURN-key save-to-cloud, Tablet Live field docs */

// Files guaranteed to exist in every generated client studio.
const CORE = [
  './',
  './index.html',
  './login.html',
  './dashboard.html',
  './offline.html',
  './about.html',
  './install.html',
  './feature-guide.html',
  './hmg-ecosystem.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/img/logo.png',
  './assets/img/logo.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache each file individually; a 404 on one must not fail the rest.
      await Promise.all(CORE.map(async url => {
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res && res.ok) await cache.put(url, res);
        } catch (err) {
          // offline at install time or file absent — non-fatal
        }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin && !url.hostname.includes('fonts.g')) return;
  // Never cache the Supabase/API traffic.
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      try {
        const net = await Promise.race([
          fetch(e.request),
          new Promise((_, rej) => setTimeout(() => rej(new Error('slow-network')), 4000))
        ]);
        if (net.ok) {
          const clone = net.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return net;
      } catch (err) {
        if (cached) return cached;
        return (await caches.match('./offline.html')) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  // Assets: stale-while-revalidate for instant load on slow networks
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchAndUpdate = fetch(e.request).then(res => {
        if (res && res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchAndUpdate;
    })
  );
});

// Push notification handler
self.addEventListener('push', e => {
  let data = { title: 'Tutoring Connect', body: 'You have a new notification', url: '/' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch (_) { if (e.data) data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'assets/img/logo.png',
    badge: 'assets/img/logo.png',
    data: { url: data.url },
    tag: data.tag || ('tc-' + Date.now()),
    requireInteraction: false,
    vibrate: [200, 100, 200]
  }));
});

// Notification click → focus existing tab or open the URL
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes(url.split('?')[0])) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
