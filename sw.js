// Kaam service worker: keeps the app itself available offline.
// The page saves each user's roadmap and courses in the browser (see "offline" in index.html);
// this worker only makes sure the page, fonts and script libraries still load with no connection.
const CACHE = 'kaam-shell-v2';
const SHELL = ['/', '/index.html', '/ne.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kaam-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache the API: it carries private data and must stay fresh.
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // The app page: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === 'navigate' || (url.origin === location.origin && SHELL.includes(url.pathname))) {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? '/' : url.pathname, copy)); }
        return res;
      }).catch(() => caches.match(req.mode === 'navigate' ? '/' : url.pathname).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Fonts and script libraries: serve the saved copy at once and refresh it in the background.
  if (STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
