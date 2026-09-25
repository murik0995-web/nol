// NOL app shell offline: network first, the last good copy of a visited page and its nol.css / nol.js / language files when offline.
// Only same-origin GETs pass through here; the GitHub sync and the data (localStorage / IndexedDB) are never touched.
const CACHE = 'nol-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const key = u.origin + u.pathname; // build stamps (?v=) and ?demo=1 would otherwise make every visit a new entry
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy))); }
    return res;
  }).catch(() => caches.match(key).then(m => m || Response.error())));
});
