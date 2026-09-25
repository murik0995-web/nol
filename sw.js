// NOL app shell offline: network first, the last good copy of a visited page and its nol.css / nol.js / language files when offline.
// Only same-origin GETs pass through here; the GitHub sync and the data (localStorage / IndexedDB) are never touched.
const CACHE = 'nol-shell-v1';
const key = url => { const u = new URL(url); return u.origin + u.pathname; }; // build stamps (?v=) and ?demo=1 would otherwise make every visit a new entry
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(key(r.url), copy))); }
    return res;
  }).catch(() => caches.match(key(r.url)).then(m => m || Response.error())));
});
// The page that registered the worker fetched its HTML, nol.css, nol.js and language files before the worker existed:
// it posts that list here once the worker is active, so the first visited page opens offline too.
self.addEventListener('message', e => {
  const urls = (e.data && e.data.cache || []).filter(u => { try { return new URL(u).origin === location.origin; } catch (x) { return false; } });
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.map(u => fetch(u).then(res => res.ok && c.put(key(u), res)).catch(() => {})))));
});
