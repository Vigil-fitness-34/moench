// Bei jedem Update CACHE hochzählen, sonst behalten installierte Apps die alte Version.
const CACHE = 'moench-v1';
const CORE = ['./', 'index.html', 'app.css', 'app.js', 'uni.js', 'monk.js', 'ics.js', 'recipes.js', 'shared.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // nur eigene Caches aufräumen: andere Apps auf derselben Adresse bleiben in Ruhe
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('moench-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Eigene Dateien: Netz zuerst ohne HTTP-Cache (neue Versionen kommen sofort an), offline aus dem Cache
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  // Schrift, Icons und Barcode-Leser: Cache zuerst, im Hintergrund auffrischen
  if (/fonts\.(googleapis|gstatic)\.com|unpkg\.com|cdn\.jsdelivr\.net/.test(url.host)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
