// Testes da Loja da Karen: preço com cupom (nunca abaixo do preço Black Friday),
// leitura do catálogo publicado e separação entre pedidos da loja e da assistência.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ler=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const importar=async texto=>import('data:text/javascript;base64,'+Buffer.from(texto).toString('base64'));

const cat = await import(new URL('../../assets/js/catalogo-loja.js', import.meta.url));
const kaiak = { cheio: 180, minimo: 162 };
assert.equal(cat.precoCom(kaiak, 0), 180);
assert.equal(cat.precoCom(kaiak, 5), 171);
assert.equal(cat.precoCom(kaiak, 10), 162);
assert.equal(cat.precoCom(kaiak, 50), 162, 'cupom nunca passa de 10%');
assert.equal(cat.precoCom({ cheio: 100, minimo: 95 }, 10), 95, 'nunca abaixo do preço Black Friday');
assert.equal(cat.precoCom({ cheio: 29.9, minimo: 29.9 }, 10), 29.9, 'produto sem desconto');
assert.equal(cat.PADRAO.length, 7);
assert(cat.PADRAO.every((p) => p.minimo === Math.round(p.cheio * 90) / 100));

// Catálogo publicado: itens inválidos são ignorados, fotos do painel são lidas à parte.
const docs = {
  'loja-catalogo': { produtos: [
    { id: 'batom', nome: 'Batom', cheio: 30, minimo: 25, img: 'doc:kfoto-batom', categoria: 'Maquiagem' },
    { id: 'Ruim Id', nome: 'x', cheio: 10 },
    { id: 'sem-preco', nome: 'y', cheio: 0 },
    { id: 'creme', nome: 'Creme', cheio: 50, minimo: 80, img: 'javascript:alert(1)' },
  ] },
  'kfoto-batom': { img: 'data:image/webp;base64,AAAA' },
};
const F = { doc: (...a) => a[a.length - 1], getDoc: async (id) => ({ exists: () => id in docs, data: () => docs[id] }) };
const lista = await cat.carregarCatalogo(F, {});
assert.deepEqual(lista.map((p) => p.id), ['batom', 'creme']);
assert.equal(lista[0].img, 'data:image/webp;base64,AAAA');
assert.equal(lista[1].minimo, 50, 'preço Black Friday limitado ao preço cheio');
assert.equal(lista[1].img, '', 'endereço de imagem não permitido');
assert.equal(lista[1].categoria, 'Outros');
assert.equal((await cat.carregarCatalogo(null, null)).length, 7, 'sem conexão: perfumes padrão');

// Pedidos da loja não aparecem na assistência técnica.
const comum = await importar(ler('assets/js/loja-comum.js').replace("import { store } from './store.js';",
  "const store={lista:()=>[{origem:'site'},{origem:'black-friday'},{origem:'black-friday-pedido'},{origem:'sacola-misteriosa'},{servico:'Sacola Misteriosa'},{origem:'indicacao'}]};"));
assert.equal(comum.leadsTI().length, 2);
assert.equal(comum.leadsLoja().length, 4);

// Regra das vagas aceita produtos novos cadastrados pelo painel.
const regras = ler('firebase/regras-ti.rules');
const re = new RegExp(/id\.matches\('([^']+)'\)/.exec(regras.slice(regras.indexOf('function tiVagaNova')))[1]);
for (const id of ['kaiak-extremo-1', 'batom-matte-vermelho-paixao-12', '300kmh-max-turbo-3']) assert(re.test(id), id);
for (const id of ['Kaiak-1', 'kaiak', '-x-1', 'a'.repeat(45) + '-1']) assert(!re.test(id), id);
console.log('Loja da Karen: ok');
