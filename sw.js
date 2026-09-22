/* JT3rDegre3 Dashboard — service worker (v1)
   NETWORK-FIRST for pages, so every deploy shows up immediately when online.
   Falls back to the last cached copy only when offline. Auto-activates (no
   waiting), so a new version never gets stuck behind an old cached one. */
const CACHE = 'jt-dashboard-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();                                   // take over right away
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))) // wipe old caches
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;      // let the Supabase API etc. go straight to network

  // Pages: always try the network first (fresh app), fall back to cache offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => { const cp = resp.clone(); caches.open(CACHE).then(c => c.put('/index.html', cp)); return resp; })
        .catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Other same-origin files (icons, manifest): network-first too, cache as a fallback.
  e.respondWith(
    fetch(req)
      .then(resp => { if (resp && resp.status === 200) { const cp = resp.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return resp; })
      .catch(() => caches.match(req))
  );
});
