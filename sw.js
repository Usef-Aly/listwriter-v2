// PWA Service Worker
const CACHE = 'apple-checklist-v1';
const ASSETS = ['/', '/index.html', '/style.css', '/script.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

