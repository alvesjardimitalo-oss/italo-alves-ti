// Catálogo da loja da Karen, publicado pelo painel em ti/base/rastreio/loja-catalogo.
// Enquanto o catálogo não existe (ou se a leitura falhar), a loja usa os 7 perfumes
// da Black Friday. Fotos enviadas pelo painel ficam em rastreio/kfoto-<produto>.
import { PERFUMES } from './perfumes-bf.js';

export const DESCONTO_MAXIMO = 10;
const r2 = (n) => Math.round(n * 100) / 100;
export const minimoPadrao = (cheio) => Math.round(cheio * 90) / 100;
const ID_OK = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const PADRAO = PERFUMES.map((p, i) => ({
  foto: p.foto, id: p.foto, nome: p.nome, marca: p.marca, categoria: 'Perfumes', descricao: '',
  cheio: p.cheio, minimo: minimoPadrao(p.cheio), img: '/karen/perfumes/' + p.foto + '.webp', destaque: false, ordem: i,
}));

/** Preço com o cupom: aplicado sobre o preço cheio e nunca abaixo do preço Black Friday. */
export function precoCom(p, pct) {
  const comCupom = Math.round(p.cheio * (100 - Math.min(Number(pct) || 0, DESCONTO_MAXIMO))) / 100;
  return r2(Math.max(p.minimo, comCupom));
}
/** Menor preço possível (cupom máximo). */
export const precoMinimo = (p) => precoCom(p, DESCONTO_MAXIMO);
export const temDesconto = (p) => p.minimo < p.cheio;

function normalizar(x, i) {
  const cheio = r2(Number(x.cheio) || 0);
  if (!x || !ID_OK.test(String(x.id || '')) || !(cheio > 0) || !x.nome) return null;
  const minimo = r2(Math.min(cheio, Math.max(0.01, Number(x.minimo) || minimoPadrao(cheio))));
  const img = String(x.img || '');
  return {
    foto: x.id, id: x.id, nome: String(x.nome).slice(0, 120), marca: String(x.marca || '').slice(0, 60),
    categoria: String(x.categoria || 'Outros').slice(0, 40), descricao: String(x.descricao || '').slice(0, 1200),
    cheio, minimo, img: /^(\/karen\/|doc:kfoto-|https:\/\/)/.test(img) ? img : '', destaque: Boolean(x.destaque), ordem: Number(x.ordem ?? i) || i,
  };
}

/** Lê o catálogo publicado (F = firestore-lite, db = Firestore). Sempre devolve uma lista. */
export async function carregarCatalogo(F, db) {
  if (!F || !db) return PADRAO;
  let dados = null;
  try {
    const snap = await F.getDoc(F.doc(db, 'ti', 'base', 'rastreio', 'loja-catalogo'));
    dados = snap.exists() ? snap.data() : null;
  } catch (e) { console.warn('Catálogo indisponível:', e); return PADRAO; }
  const lista = (Array.isArray(dados && dados.produtos) ? dados.produtos : []).map(normalizar).filter(Boolean);
  if (!lista.length) return PADRAO;
  // Fotos enviadas pelo painel: uma leitura por produto, em paralelo.
  await Promise.all(lista.filter((p) => p.img.startsWith('doc:')).map(async (p) => {
    try {
      const s = await F.getDoc(F.doc(db, 'ti', 'base', 'rastreio', p.img.slice(4)));
      const img = s.exists() ? String(s.data().img || '') : '';
      p.img = /^data:image\/(webp|jpeg|png);base64,/.test(img) ? img : '';
    } catch (_) { p.img = ''; }
  }));
  return lista;
}
