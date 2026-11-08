/* Offline cache. Bump VERSION whenever you upload a new build so players get the update. */
var VERSION = 'silly-duel-v39';
var FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './css/games2.css', './css/games3.css',
  './assets/fonts/Fredoka.ttf', './assets/fonts/Silkscreen-Regular.ttf', './assets/fonts/Silkscreen-Bold.ttf', './js/build.js', './js/powers.js', './js/storage.js', './js/fit.js', './js/firebase-config.js', './js/art.js', './js/progress.js', './js/audio.js', './js/fx.js', './js/engine.js',
  './js/games/freeze.js', './js/games/dodge.js', './js/games/beat.js', './js/games/pinata.js', './js/games/bomb.js', './js/games/flap.js', './js/games/hop.js', './js/games/stack.js', './js/games/balance.js', './js/games/snack.js', './js/games/knife.js', './js/games/zigzag.js', './js/games/skip.js', './js/games/echo.js', './js/games/lander.js', './js/games/boss.js', './js/pools.js', './js/net.js', './js/lobby.js', './js/server-config.js', './js/party.js', './css/party.css',
  './js/main.js', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
