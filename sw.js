// IMPORTANT:
// The old implementation used cache-first for JS/CSS/JSON which can permanently pin users
// on old versions after a deploy. This implementation uses network-first so clients pick
// up updates immediately when online, but still works offline via Cache Storage.

const CACHE_PREFIX = 'ganan-cache-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const scope = self.registration?.scope || self.location.origin + '/';
const urlForScope = (path) => new URL(path, scope).toString();

const ASSETS_TO_CACHE = [
  urlForScope('./'),
  urlForScope('index.html'),
  urlForScope('app.js'),
  urlForScope('style.css'),
  urlForScope('manifest.json')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(ASSETS_TO_CACHE);
      } catch (error) {
        // Some hosts (or transient network errors) can make addAll fail; cache what we can.
        await Promise.all(
          ASSETS_TO_CACHE.map(async (assetUrl) => {
            try {
              await cache.add(assetUrl);
            } catch {
              // ignore
            }
          })
        );
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Bypass the browser HTTP cache so we see fresh deploys immediately.
    const networkRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(networkRequest);

    if (response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(networkFirst(request));
});
