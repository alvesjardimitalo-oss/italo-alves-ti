// Testes isolados do service worker: não precisam de navegador nem de Firebase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const codigo = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
const listeners = new Map();
const armazenamentos = new Map([['cache-de-outra-aplicacao', new Map()], ['italoti-site-v3', new Map()]]);
const chave = (request) => typeof request === 'string' ? request : request.url;
const copia = (response) => response?.clone() || null;

const cachesMock = {
  async open(nome) {
    if (!armazenamentos.has(nome)) armazenamentos.set(nome, new Map());
    const cache = armazenamentos.get(nome);
    return {
      async addAll(lista) {
        for (const item of lista) cache.set(chave(item), new Response('precache', { status: 200 }));
      },
      async put(request, response) { cache.set(chave(request), copia(response)); },
      async match(request) { return copia(cache.get(chave(request))); },
    };
  },
  async keys() { return [...armazenamentos.keys()]; },
  async delete(nome) { return armazenamentos.delete(nome); },
  async match(request) {
    for (const cache of armazenamentos.values()) {
      if (cache.has(chave(request))) return copia(cache.get(chave(request)));
    }
    return undefined;
  },
};

let semRede = false;
let respostaRede = () => new Response('pagina', { status: 200, headers: { 'content-type': 'text/html' } });
let requisicoes = 0;
const selfMock = {
  location: { origin: 'https://italoinfotec.com.br' },
  clients: { claim: async () => {} },
  skipWaiting: async () => {},
  addEventListener(tipo, fn) { listeners.set(tipo, fn); },
};
runInNewContext(codigo, {
  self: selfMock, caches: cachesMock, URL, Request, Response,
  fetch: async (req) => {
    requisicoes++;
    if (semRede) throw new Error('sem internet');
    return respostaRede(req);
  },
});

async function disparar(tipo, request) {
  const aguardando = [];
  let resposta;
  let interceptada = false;
  const evento = {
    request,
    waitUntil(promessa) { aguardando.push(Promise.resolve(promessa)); },
    respondWith(promessa) { interceptada = true; resposta = promessa; },
  };
  listeners.get(tipo)(evento);
  const resultado = interceptada ? await resposta : undefined;
  await Promise.all(aguardando);
  return { interceptada, resultado };
}

const navegar = (caminho) => ({
  url: 'https://italoinfotec.com.br' + caminho, method: 'GET', mode: 'navigate',
});
const asset = (caminho) => ({
  url: 'https://italoinfotec.com.br' + caminho, method: 'GET', mode: 'same-origin',
});

await disparar('install');
assert(armazenamentos.has('italoti-site-v4'), 'novo cache não foi preparado');
await disparar('activate');
assert(!armazenamentos.has('italoti-site-v3'), 'cache antigo do site não foi apagado');
assert(armazenamentos.has('cache-de-outra-aplicacao'), 'cache de outra aplicação foi apagado');

await disparar('fetch', navegar('/dicas/notebook.html?utm_source=instagram&ref=cliente'));
const cache = armazenamentos.get('italoti-site-v4');
assert(cache.has('https://italoinfotec.com.br/dicas/notebook.html'), 'página deveria usar chave sem rastreamento');
assert(!cache.has('https://italoinfotec.com.br/dicas/notebook.html?utm_source=instagram&ref=cliente'), 'campanhas geraram páginas duplicadas');

respostaRede = () => new Response('não encontrado', { status: 404, headers: { 'content-type': 'text/html' } });
await disparar('fetch', navegar('/rota-inexistente'));
assert(!cache.has('https://italoinfotec.com.br/rota-inexistente'), 'HTTP 404 foi armazenado indevidamente');

const antes = requisicoes;
const demo = await disparar('fetch', navegar('/?demo&utm_source=teste'));
assert(!demo.interceptada && requisicoes === antes, 'modo demo não deve passar pelo cache');
const adm = await disparar('fetch', navegar('/sistema.html'));
assert(!adm.interceptada, 'sistema administrativo não deve passar pelo service worker');

await (await cachesMock.open('italoti-site-v4')).put(asset('/assets/js/site.js?v=2.0.0'), new Response('versao antiga'));
respostaRede = () => new Response('versao atual', { status: 200, headers: { 'content-type': 'application/javascript' } });
const js = await disparar('fetch', asset('/assets/js/site.js?v=2.0.0'));
assert.equal(await js.resultado.text(), 'versao atual', 'JS desatualizado foi usado em vez do servidor');
assert.equal(await cache.get('https://italoinfotec.com.br/assets/js/site.js?v=2.0.0').text(), 'versao atual', 'cache JS não foi atualizado');

semRede = true;
const jsOffline = await disparar('fetch', asset('/assets/js/site.js?v=2.0.0'));
assert.equal(await jsOffline.resultado.text(), 'versao atual', 'JS offline não usou o cache');
const paginaOffline = await disparar('fetch', navegar('/dicas/notebook.html?utm_source=outro'));
assert.equal(await paginaOffline.resultado.text(), 'pagina', 'página não utilizou cache offline');

console.log('OK: cache PWA atualizado, URLs normalizadas, sem 404, sem DEMO/área técnica e com fallback offline.');
