// Parkiet NBA service worker: offline app shell, last-known ESPN data, cached logos and fonts.
// Bump VERSION whenever you upload a new index.html so phones pick up the change.
const VERSION = 'parkiet-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'parkiet-data' && k !== 'parkiet-static').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first, fall back to the last saved copy (app files and ESPN data).
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: false });
    if (hit) return hit;
    throw err;
  }
}

// Cache first for things that rarely change (logos, headshots, fonts).
async function cacheFirst(req) {
  const cache = await caches.open('parkiet-static');
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, VERSION).catch(() => caches.match('./index.html')));
  } else if (/(^|\.)api\.espn\.com$/.test(url.hostname)) {
    e.respondWith(networkFirst(req, 'parkiet-data'));
  } else if (url.hostname === 'a.espncdn.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});
