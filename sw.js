// Service Worker — offline shell + FCM background push.
// One SW handles both because two SWs at root scope would conflict.

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDvFsWsB6gH988212-SbF8VdgIV-dfrAvA',
  authDomain: 'schedual-fdde7.firebaseapp.com',
  projectId: 'schedual-fdde7',
  storageBucket: 'schedual-fdde7.firebasestorage.app',
  messagingSenderId: '267719533646',
  appId: '1:267719533646:web:c5fe14d9fa9d3930734f1f',
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'תזכורת תשלום', {
    body: n.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    lang: 'he', dir: 'rtl',
    data: payload.data || {},
    tag: payload.data?.tag,
  });
});

const VERSION = 'v21';
const APP_SHELL = [
  '/',
  '/payments.html',
  '/app.jsx',
  '/components.jsx',
  '/data.jsx',
  '/firebase-init.jsx',
  '/feedback.jsx',
  '/fx.jsx',
  '/notifications.jsx',
  '/auth.jsx',
  '/payment-card.jsx',
  '/screens.jsx',
  '/sheets.jsx',
  '/stacked-list.jsx',
  '/lists.jsx',
  '/budget.jsx',
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

  // Never cache: Firebase APIs, Firestore, FCM
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('gstatic.com') ||
    url.pathname.startsWith('/__/')
  ) {
    return;
  }

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

  // Same-origin — NETWORK FIRST, BYPASSING the browser HTTP cache so a Firebase
  // Hosting Cache-Control header can't keep serving stale .jsx after a deploy.
  // Fall back to the SW cache only if the network actually fails (offline).
  event.respondWith(
    fetch(req, { cache: 'no-store' }).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(VERSION).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => {
      if (hit) return hit;
      // Only fall back to the HTML shell for page navigations. Never serve HTML
      // in place of a missing .jsx/asset — that would execute as JS and crash.
      if (req.mode === 'navigate') return caches.match('/payments.html');
      return Response.error();
    }))
  );
});
