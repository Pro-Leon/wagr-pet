/* ========================================
   Wagr — Service Worker
   Cache-first for static assets,
   network-only for API calls.
   ======================================== */

const CACHE = 'wagr-v1';

const PRECACHE = [
  '/',
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

// CDN origins to cache
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'js.paystack.co',
];

// API paths to never cache
const API_PATHS = [
  '/api/',
  'supabase.co',
  'openrouter.ai',
  'paystack.co',
];

// Install: pre-cache core files
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

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-only for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls
  if (API_PATHS.some((p) => url.href.includes(p))) {
    return;
  }

  // Cache-first for same-origin static assets
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => {
          // Offline fallback for HTML navigations
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Cache-first for CDN scripts
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
