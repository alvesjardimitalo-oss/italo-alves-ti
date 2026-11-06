// Service worker do SITE público. HTML e código: rede primeiro, cache apenas para offline.
// Evita arquivos JS/CSS desatualizados após publicações e não guarda cada URL de campanha.
// As páginas administrativas e o Firebase ficam fora deste cache.
const CACHE = 'italoti-site-v4';
const PREFIXO = 'italoti-site-';
const BASICO = ['./', './index.html', './assets/css/site.css', './assets/js/site.js', './assets/js/site-config.js', './assets/img/logo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(BASICO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Não apaga caches de outras aplicações que eventualmente compartilhem a origem.
  e.waitUntil(caches.keys().then((nomes) =>
    Promise.all(nomes.filter((nome) => nome.startsWith(PREFIXO) && nome !== CACHE).map((nome) => caches.delete(nome)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (/sistema\.html|imprimir\.html|\/assets\/js\/(store|app|views)|speedtest|\.bin$/i.test(url.pathname)) return;
  // Demonstração nunca deve ser colocada no cache do site público.
  if (url.searchParams.has('demo')) return;

  if (e.request.mode === 'navigate') {
    // UTM, ref e outras etiquetas de campanha não criam cópias infinitas da mesma página.
    const chave = new Request(url.origin + url.pathname);
    e.respondWith((async () => {
      try {
        const resposta = await fetch(e.request);
        const tipo = resposta.headers.get('content-type') || '';
        if (resposta.ok && tipo.includes('text/html')) {
          const copia = resposta.clone();
          e.waitUntil(caches.open(CACHE).then((cache) => cache.put(chave, copia)).catch(() => {}));
        }
        return resposta;
      } catch (_) {
        return (await caches.match(chave)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  if (/\.(css|js)$/i.test(url.pathname)) {
    // Código atualizado tem prioridade: não servir JS antigo indefinidamente.
    e.respondWith((async () => {
      try {
        const resposta = await fetch(e.request);
        if (resposta.ok) {
          const copia = resposta.clone();
          e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copia)).catch(() => {}));
        }
        return resposta;
      } catch (_) {
        return (await caches.match(e.request)) || Response.error();
      }
    })());
    return;
  }

  if (/\.(svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    // Imagens e fontes: cache primeiro para preservar rapidez e funcionamento offline.
    e.respondWith(caches.match(e.request).then(async (guardado) => {
      if (guardado) return guardado;
      try {
        const resposta = await fetch(e.request);
        if (resposta.ok) {
          const copia = resposta.clone();
          e.waitUntil(caches.open(CACHE).then((cache) => cache.put(e.request, copia)).catch(() => {}));
        }
        return resposta;
      } catch (_) {
        return Response.error();
      }
    }));
  }
});
