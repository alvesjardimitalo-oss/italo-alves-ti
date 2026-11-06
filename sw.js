// Service worker do SITE público: abre rápido e funciona com internet fraca.
// Páginas: rede primeiro (sempre atualizadas), cache se offline. Arquivos estáticos: cache primeiro.
// O sistema (sistema.html / imprimir.html) e o Firebase NUNCA passam pelo cache.
const CACHE = 'italoti-site-v3';
const BASICO = ['./', './index.html', './assets/css/site.css', './assets/js/site.js', './assets/js/site-config.js', './assets/img/logo.svg'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (/sistema\.html|imprimir\.html|\/assets\/js\/(store|app|views)|speedtest|\.bin$/.test(url.pathname)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
    return;
  }
  if (/\.(css|js|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
      return resp;
    })));
  }
});
