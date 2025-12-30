self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Pre-cache essential assets for offline use
const CACHE_NAME = 'ganan-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn('Some assets failed to cache:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
    // if this is NOT our origin, do nothing special (let it load normally)
    if (!e.request.url.startsWith(self.location.origin)) return;

    // Cache first for assets, network first for everything else
    if (e.request.url.includes('.js') || e.request.url.includes('.css') || e.request.url.includes('.json')) {
        e.respondWith(
            caches.match(e.request)
                .then(response => response || fetch(e.request))
                .then(response => {
                    if (!response) return response;
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            fetch(e.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(e.request))
        );
    }
});