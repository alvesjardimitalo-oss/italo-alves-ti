import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizarBusca, combinaBusca, iniciarBuscaConteudo } from '../../assets/js/busca-conteudo.js';

assert.equal(normalizarBusca('  Wi-Fi, NÃO conecta! '), 'wi fi nao conecta');
assert(combinaBusca('Notebook com tela preta', 'TELA preta'));
assert(combinaBusca('Notebook não carrega', 'nao carrega'));
assert(combinaBusca('Problemas com SSD e HD', 'hd ssd'));
assert(!combinaBusca('Bateria do notebook', 'tela quebrada'));
assert(combinaBusca('Qualquer artigo', ''));
assert(!combinaBusca('Impressora', 'wifi'));

const raiz = new URL('../../', import.meta.url);
const ler = (p) => readFileSync(new URL(p, raiz), 'utf8');
const gen = ler('tools/site/gerar.py');
const cat = ler('tools/site/paginas/catalogos.py');
const dicas = ler('tools/site/paginas/dicas.py');
const site = ler('assets/js/site.js');
assert(cat.includes('data-busca-conteudo') && cat.includes('data-grupo-busca') && cat.includes('data-item-busca'));
assert(dicas.includes('data-busca-conteudo') && dicas.includes('data-item-busca'));
assert(cat.includes('busca-conteudo.js') && dicas.includes('busca-conteudo.js'));
assert(gen.includes('aria-expanded="false"') && gen.includes('aria-controls="menu-principal"'));
assert(site.includes('definirMenu(') && site.includes("e.key === 'Escape'"));

const problemaHtml=ler('problemas/index.html'), dicasHtml=ler('dicas/index.html');
assert(problemaHtml.includes('id="buscar-sintoma"'));
assert(dicasHtml.includes('id="buscar-dica"'));
assert((problemaHtml.match(/data-item-busca=/g)||[]).length===20);
assert((dicasHtml.match(/data-item-busca=/g)||[]).length===18);
for(const page of [problemaHtml,dicasHtml]) {
  assert(page.includes('data-busca-contagem'));
  assert(page.includes('data-busca-vazio'));
  assert(page.includes('assets/js/busca-conteudo.js?v=2.4.0'));
}
console.log('OK: busca local com acentos, todos os artigos e sintomas pesquisáveis, navegação mobile acessível.');