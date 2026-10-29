// Garde l'app disponible hors connexion. Change VERSION à chaque mise à jour.
const VERSION = 'studio-lt-4';
const FILES = [
  './', 'index.html', 'css/app.css', 'js/app.js', 'js/templates.js', 'js/insta.js', 'js/vendor/mediabunny.min.mjs',
  'fonts/GeneralSans-Variable.ttf', 'samples/vibraphone.jpg',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'manifest.webmanifest'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Réseau d'abord pour avoir les mises à jour, cache si hors ligne
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
