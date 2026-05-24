/* ========================================
   Pup File — Service Worker
   Cache-first for static assets,
   network-only for API calls.
   Version auto-busts via activate handler.
   ======================================== */

const CACHE = 'pupfile-cache-v2';

const PRECACHE = [
  '/',
  '/dashboard',
  '/auth',
  '/admin',
  '/privacy',
  '/terms',
  '/cookies',
  '/index.html',
  '/dashboard.html',
  '/auth.html',
  '/admin.html',
  '/privacy.html',
  '/terms.html',
  '/cookies.html',
  '/public-profile.html',
  '/manifest.json',
  '/css/globals.css',
  '/js/app.js',
  '/js/api.js',
  '/js/ui.js',
  '/js/calculators.js',
  '/js/analytics.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
  '/icons/favicon.svg',
];

const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'js.paystack.co',
];

const API_PATHS = [
  '/api/',
  'supabase.co',
  'openrouter.ai',
  'paystack.co',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(PRECACHE).catch((err) => {
        console.warn('SW pre-cache partial failure:', err.message);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (API_PATHS.some((p) => url.href.includes(p))) {
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        const htmlPath = url.pathname + '.html';
        return caches.match(htmlPath).then((htmlCached) => {
          if (htmlCached && event.request.mode === 'navigate') return htmlCached;
          return fetch(event.request).then((res) => {
            if (res.ok && res.type === 'basic') {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, clone));
            }
            return res;
          }).catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('Offline', { status: 503 });
          });
        });
      })
    );
    return;
  }

  if (CDN_ORIGINS.some((o) => url.hostname === o)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 200 }));
      })
    );
    return;
  }
});
