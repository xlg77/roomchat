const CACHE_NAME = 'roomchat-mobile-pwa-v1';
const APP_SHELL = [
  '/roomchat/',
  '/roomchat/index.html',
  '/roomchat/manifest.webmanifest',
  '/roomchat/styles.css',
  '/roomchat/app.js',
  '/roomchat/soundboard.js',
  '/roomchat/floating-chat.js',
  '/roomchat/pwa-mobile.js',
  '/roomchat/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok) await cache.put(url, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('roomchat-mobile-pwa-') && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/roomchat/')) return;
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/') || url.pathname.includes('/storage/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/roomchat/index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('/roomchat/index.html')) || (await caches.match('/roomchat/')) || Response.error();
      }
    })());
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url.pathname);
      const network = fetch(request).then((response) => {
        if (response.ok) cache.put(url.pathname, response.clone());
        return response;
      }).catch(() => cached);
      return cached || network;
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow(new URL(target, self.registration.scope).href);
  })());
});