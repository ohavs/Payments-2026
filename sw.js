// Service worker — offline shell + cache-first for app files, network-only for Firebase.
const VERSION = 'v4';
const APP_SHELL = [
  '/',
  '/payments.html',
  '/app.jsx',
  '/components.jsx',
  '/data.jsx',
  '/firebase-init.jsx',
  '/feedback.jsx',
  '/notifications.jsx',
  '/auth.jsx',
  '/payment-card.jsx',
  '/screens.jsx',
  '/sheets.jsx',
  '/stacked-list.jsx',
  '/tweaks-panel.jsx',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Focus / open the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = all.find((c) => c.url.includes(self.location.origin));
    if (existing) { await existing.focus(); return; }
    await self.clients.openWindow('/payments.html');
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache: Firebase APIs (Firestore listen, Auth, etc.) and Firebase-injected scripts
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebase.com') ||
    url.pathname.startsWith('/__/')
  ) {
    return; // let it pass through to network
  }

  // Cross-origin CDN scripts (React, Babel) — cache-first
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => hit)
      )
    );
    return;
  }

  // Same-origin (app shell) — network-first, fall back to cache
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/payments.html')))
  );
});
