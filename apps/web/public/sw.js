/**
 * Minimaler Service Worker für die Monteur-PWA (`/worker-app`, `/kiosk`).
 *
 * Absichtlich klein gehalten (Auftrag #6, Nicht-Ziele): Er macht die App
 * installierbar und beschleunigt den Start, aber es gibt **kein** Offline-First
 * und keinerlei Zwischenspeicher für API-Antworten – Stempelungen und
 * Arbeitsitems müssen immer echte Server-Antworten sein.
 *
 * Gecacht wird ausschließlich unveränderliches Buildmaterial
 * (`/_next/static/**`, gehashte Dateinamen) sowie die App-Icons.
 */
const CACHE = 'vh-shell-v1';

/** Nur diese Pfade landen im Cache – alles andere geht direkt ans Netz. */
function isCacheable(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/'))
  );
}

self.addEventListener('install', () => {
  self.skipWaiting();
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
  if (!isCacheable(url)) return; // Navigationen und API: unverändert ans Netz

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
