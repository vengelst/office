/**
 * Minimaler Service Worker für die Monteur-PWA (`/worker-app`, `/kiosk`).
 *
 * Auftrag #13: App-Shell-Routen offline laden (Navigation-Fallback), weiterhin
 * **kein** Caching von `/api/**`. Build-Assets und Icons wie zuvor.
 */
const CACHE = 'vh-shell-v2';

/** HTML-App-Shell-Routen (Navigation offline → gecachte Seite). */
const SHELL_PATHS = [
  '/worker-app',
  '/worker-app/dashboard',
  '/kiosk',
  '/kiosk/terminal',
];

function isApi(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/'))
  );
}

function isShellNavigation(request, url) {
  if (request.mode !== 'navigate') return false;
  if (url.origin !== self.location.origin) return false;
  if (isApi(url)) return false;
  return SHELL_PATHS.some(
    (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Shell vorwärmen – Fehler einzeln ignorieren (Build-Pfad kann abweichen)
      await Promise.all(
        SHELL_PATHS.map((path) =>
          fetch(path, { credentials: 'same-origin' })
            .then((res) => {
              if (res.ok) return cache.put(path, res);
            })
            .catch(() => {}),
        ),
      );
      self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Niemals API cachen
  if (isApi(url)) return;

  // App-Shell: network-first, Fallback auf Cache
  if (isShellNavigation(request, url)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE);
            const path =
              SHELL_PATHS.find(
                (p) => url.pathname === p || url.pathname.startsWith(`${p}/`),
              ) ?? url.pathname;
            cache.put(path, response.clone());
          }
          return response;
        } catch {
          const cache = await caches.open(CACHE);
          const exact = await cache.match(url.pathname);
          if (exact) return exact;
          for (const p of SHELL_PATHS) {
            if (url.pathname === p || url.pathname.startsWith(`${p}/`)) {
              const cached = await cache.match(p);
              if (cached) return cached;
            }
          }
          const fallback = await cache.match('/worker-app');
          if (fallback) return fallback;
          throw new Error('Offline – keine Shell im Cache');
        }
      })(),
    );
    return;
  }

  // Statische Assets: cache-first
  if (!isStaticAsset(url)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
