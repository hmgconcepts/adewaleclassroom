// Tutoring Connect — Service Worker (V5 cumulative release, generator v8)
// Bump this literal on every runtime release so previously cached CBT/report code is purged.
const CACHE = 'sc-builder-v9.5-20260812-54';
const CORE = [
  './', './index.html', './builder.html', './voting.html', './notifications.html',
  './install.html', './ecosystem.html', './about.html', './guide.html', './offline.html',
  './assets/css/style.css',
  './assets/js/config.js', './assets/js/catalog.js',
  './assets/js/notifications.js', './assets/js/voting.js', './assets/js/pwa-install.js',
  './assets/js/super.js', './assets/js/wizard.js', './assets/js/generator.js', './assets/js/templates.js', './assets/js/site-help.js',
  './assets/img/logo.svg', './assets/img/favicon.svg', './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE).catch(err => console.warn('[SW] precache failed', err.message))).then(() => self.skipWaiting())
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
  if (url.origin !== location.origin && !e.request.url.includes('fonts.googleapis')) return;

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
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
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
    icon: 'assets/img/logo.svg',
    badge: 'assets/img/logo.svg',
    data: { url: data.url },
    tag: data.tag || ('sc-' + Date.now()),
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
