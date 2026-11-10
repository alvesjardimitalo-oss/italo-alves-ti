// Testes sem Firebase e sem navegador externo: base do Alvesinho + simulação de upgrade + site gerado.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const ler = (p) => readFileSync(resolve(root,p), 'utf8');
const carregar = async (codigo) => import('data:text/javascript;base64,' + Buffer.from(codigo).toString('base64'));

const sintomas = await carregar(ler('assets/js/alvesinho-conhecimento.js'));
assert(sintomas.SINTOMAS.length >= 25, 'Poucos sintomas atendidos pelo Alvesinho');
const casos = [
  ['meu computador não liga', 'nao-liga'],
  ['meu notebook molhou', 'molhou'],
  ['a bateria está estufada', 'bateria-estufada'],
  ['o Wi-Fi cai toda hora', 'wifi'],
  ['não dá vídeo', 'liga-sem-imagem'],
  ['minha tela está quebrada', 'tela-quebrada'],
  ['quero aumentar memoria ram', 'upgrade'],
  ['tela azul no Windows', 'tela-azul'],
];
for (const [frase,id] of casos) {
  const resposta = sintomas.orientarSintoma(frase);
  assert.equal(resposta.id, id, 'Classificação incorreta para ' + frase);
  assert(resposta.possiveis.length > 20 && resposta.passo.length > 20, 'Orientação incompleta ' + frase);
}
assert(sintomas.orientarSintoma('notebook molhou').alerta, 'Caso de líquido deve alertar');
assert(sintomas.orientarSintoma('não reconheço o problema descrito de jeito nenhum').conhecido === false, 'Não inventar diagnóstico');
const cards = JSON.parse(ler('conteudo/sintomas.json')).itens;
assert(cards.length >= 18, 'O catálogo de problemas precisa conter os sintomas completos');
const ids = new Set(sintomas.SINTOMAS.map(s=>s.id));
for (const item of cards) assert(ids.has(item.id), 'Cartão sem resposta no Alvesinho: ' + item.id);
assert(new Set(cards.map(x=>x.id)).size === cards.length, 'Cards duplicados');

// Substitui o import de ./comum.js (a lista de nomes pode crescer) por stubs.
const upOrig = ler('assets/js/ferramentas/upgrade.js')
  .replace(/import\s*\{[^}]*\}\s*from\s*'\.\/comum\.js';/, "const enviarAoTecnico=()=>{}, copiar=()=>{}, esc=String, ambiente=async()=>null, ramTexto=String;");
assert(!/from '\.\/comum\.js'/.test(upOrig), 'Import de comum.js não substituído no teste');
// Elemento falso: o módulo desenha a tela inicial ao carregar.
const elFalso = { innerHTML: '', querySelector: () => ({ onclick: null, addEventListener() {}, disabled: false }), querySelectorAll: () => [] };
globalThis.document = { querySelector: () => elFalso };
const upgrade = await carregar(upOrig);
const hdd = upgrade.recomendarUpgrade({disco:'HD',ram:'4',uso:'trabalho',sintoma:'iniciar'});
assert(hdd.some(x=>/SSD/.test(x.titulo)), 'HD deve sugerir avaliação de SSD');
assert(hdd.some(x=>/memória/.test(x.titulo)), 'RAM baixa deve sugerir avaliação');
const ssd = upgrade.recomendarUpgrade({disco:'SSD',ram:'16',uso:'trabalho',sintoma:'iniciar'});
assert(ssd.some(x=>/Diagnóstico/.test(x.titulo)), 'SSD e RAM suficiente não devem induzir troca de peça');

const home = ler('index.html'), ferramentas = ler('ferramentas/index.html');
// Home atual (refeita à mão): vitrine animada do Alvesinho + atalho para o catálogo completo.
assert(home.includes('id="solucoes"') && home.includes('data-alves-apresentacao'), 'Seções comerciais faltando');
assert(/assets\/img\/alvesinho(-premium)?\.svg/.test(home), 'Avatar ausente da home');
assert(home.includes('href="problemas/"'), 'Home deve levar ao catálogo de problemas');
const catalogo = ler('problemas/index.html');
assert((home.match(/data-alves-escolher="/g)||[]).length <= 8, 'A home deve destacar poucos sintomas para ser objetiva');
assert((catalogo.match(/data-sintoma="/g)||[]).length === cards.length, 'Catálogo deve exibir todos os sintomas');
for (const item of cards) assert(catalogo.includes('data-sintoma="' + item.id + '"'), 'Problema ausente no catálogo: ' + item.id);
assert(home.includes('data-abrir-chat'), 'CTAs chat ausentes');
assert(ferramentas.includes('upgrade.html') && existsSync(resolve(root,'ferramentas/upgrade.html')), 'Ferramenta de upgrade ausente');
assert(ler('assets/js/site.js').includes('assistente virtual') || ler('assets/js/site.js').includes('Assistente virtual'), 'Chat deve informar que é automatizado');
console.log('OK: ' + sintomas.SINTOMAS.length + ' diagnósticos locais, destaques na home, ' + cards.length + ' no catálogo, avatar e simulador de upgrade.');
