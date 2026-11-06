// Utilitários: formatação, validação e componentes de interface.
import { icon } from './icons.js';

export const VERSAO = '1.0.1';

/* ---------------- Texto e HTML ---------------- */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const digits = (v) => String(v ?? '').replace(/\D/g, '');
export const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ---------------- Dinheiro ---------------- */
export function money(v, simbolo = true) {
  const s = (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return simbolo ? 'R$ ' + s : s;
}
export function parseMoney(v) {
  let s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------------- Datas ---------------- */
export function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export function dataBR(iso, hora = false) {
  if (!iso) return '-';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('pt-BR') + (hora ? ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
}
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const mesNome = (m) => MESES[m] || '';
export function dataExtenso(iso) {
  const d = iso ? new Date((iso.length === 10 ? iso + 'T12:00:00' : iso)) : new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
export function somaDias(iso, dias) {
  const d = new Date((iso || hojeISO()).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + Number(dias || 0));
  return d.toISOString().slice(0, 10);
}
export function diasDesde(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso.slice(0, 10) + 'T00:00:00').getTime()) / 86400000));
}

/* ---------------- Documentos e contatos ---------------- */
export function formatDoc(v) {
  const d = digits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return v || '';
}
export function formatFone(v) {
  const d = digits(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v || '';
}
export function formatCep(v) {
  const d = digits(v);
  return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : v || '';
}
export function whatsapp(fone, texto = '') {
  let d = digits(fone);
  if (d.length < 10) return '';
  if (d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
}
export function validCPF(v) {
  const c = digits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
    if (+c[t] !== ((10 * s) % 11) % 10) return false;
  }
  return true;
}
export function validCNPJ(v) {
  const c = digits(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const pesos = [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]];
  return [12, 13].every((pos, k) => {
    let s = 0;
    for (let i = 0; i < pos; i++) s += +c[i] * pesos[k][i];
    const r = s % 11;
    return +c[pos] === (r < 2 ? 0 : 11 - r);
  });
}
export function enderecoTexto(c = {}) {
  let s = [c.logradouro, c.numero ? 'nº ' + c.numero : '', c.complemento].filter(Boolean).join(', ');
  if (c.bairro) s += (s ? ' - ' : '') + c.bairro;
  const cid = [c.cidade, c.uf].filter(Boolean).join('/');
  if (cid) s += (s ? ' - ' : '') + cid;
  if (c.cep) s += (s ? ' - CEP ' : 'CEP ') + formatCep(c.cep);
  return s;
}

/* ---------------- Valor por extenso ---------------- */
function centena(n) {
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  if (n === 100) return 'cem';
  const p = [];
  if (n >= 100) { p.push(c[Math.floor(n / 100)]); n %= 100; }
  if (n >= 20) { p.push(d[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) p.push(u[n]);
  return p.join(' e ');
}
function numeroExtenso(n) {
  if (n === 0) return 'zero';
  const esc_ = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
  const g = [];
  while (n > 0) { g.push(n % 1000); n = Math.floor(n / 1000); }
  const partes = [];
  for (let i = g.length - 1; i >= 0; i--) {
    const v = g[i];
    if (!v) continue;
    const t = i === 1 && v === 1 ? 'mil' : centena(v) + (i > 0 ? ' ' + (v === 1 ? esc_[i][0] : esc_[i][1]) : '');
    partes.push({ t, v });
  }
  return partes.map((p, k) => (k === 0 ? p.t : (k === partes.length - 1 && (p.v < 100 || p.v % 100 === 0) ? ' e ' : ' ') + p.t)).join('');
}
export function valorExtenso(v) {
  v = round2(v);
  const reais = Math.floor(v);
  const cent = Math.round((v - reais) * 100);
  const p = [];
  if (reais) p.push(numeroExtenso(reais) + (reais === 1 ? ' real' : reais % 1000000 === 0 ? ' de reais' : ' reais'));
  if (cent) p.push(numeroExtenso(cent) + (cent === 1 ? ' centavo' : ' centavos'));
  return p.join(' e ') || 'zero real';
}

/* ---------------- Listas do negócio ---------------- */
export const STATUS_OS = {
  'Recebido': 'info', 'Em análise': 'info', 'Aguardando aprovação': 'warn', 'Em manutenção': 'primary',
  'Aguardando peça': 'warn', 'Pronto para retirada': 'ok', 'Entregue': 'muted', 'Sem conserto': 'danger',
};
export const STATUS_OS_ABERTO = ['Recebido', 'Em análise', 'Aguardando aprovação', 'Em manutenção', 'Aguardando peça', 'Pronto para retirada'];
export const STATUS_ORC = { 'Pendente': 'warn', 'Aprovado': 'ok', 'Recusado': 'danger', 'Cancelado': 'muted' };
export const SITUACAO_PAG = { 'Em aberto': 'danger', 'Parcial': 'warn', 'Quitado': 'ok' };
export const FORMAS_PAG = ['PIX', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Boleto'];
export const TIPOS_EQUIP = ['Notebook', 'Desktop', 'All-in-one', 'Impressora', 'Monitor', 'Celular', 'Tablet', 'Console', 'Roteador', 'Outro'];

export function badge(texto, mapa) {
  return `<span class="badge b-${mapa[texto] || 'muted'}">${esc(texto)}</span>`;
}
export function situacaoPagamento(total, pago) {
  if (pago <= 0) return 'Em aberto';
  return pago + 0.004 >= total ? 'Quitado' : 'Parcial';
}
export const codOS = (n) => 'OS' + String(n).padStart(6, '0');
export const numDoc = (n) => String(n ?? '').padStart(5, '0');

/* ---------------- Interface: toast, modal, confirmação ---------------- */
export function toast(msg, tipo = 'ok', ms = 3800) {
  const el = document.createElement('div');
  el.className = 'toast t-' + tipo;
  el.innerHTML = icon(tipo === 'erro' ? 'alert' : tipo === 'aviso' ? 'alert' : 'check', 18) + '<span>' + esc(msg) + '</span>';
  document.getElementById('toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

/** Abre um modal. conteudo = HTML do corpo. Retorna {el, fechar}. */
export function modal({ titulo, conteudo, largura = 520, aoFechar } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="max-width:${largura}px">
      <div class="modal-head"><h3>${esc(titulo || '')}</h3><button class="icon-btn" data-fechar aria-label="Fechar">${icon('x')}</button></div>
      <div class="modal-body">${conteudo}</div></div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const fechar = () => {
    wrap.classList.remove('show');
    document.removeEventListener('keydown', esc_);
    setTimeout(() => wrap.remove(), 200);
    aoFechar && aoFechar();
  };
  const esc_ = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', esc_);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) fechar(); });
  wrap.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fechar));
  const primeiro = wrap.querySelector('input, select, textarea');
  if (primeiro) setTimeout(() => primeiro.focus(), 60);
  return { el: wrap.querySelector('.modal'), fechar };
}

export function confirmar(texto, { titulo = 'Confirmar', botao = 'Confirmar', perigo = false } = {}) {
  return new Promise((ok) => {
    let decidido = false;
    const m = modal({
      titulo,
      conteudo: `<p class="confirm-txt">${esc(texto)}</p><div class="form-acoes">
        <button class="btn" data-fechar>Cancelar</button>
        <button class="btn ${perigo ? 'btn-danger' : 'btn-primary'}" data-sim>${esc(botao)}</button></div>`,
      largura: 440,
      aoFechar: () => { if (!decidido) ok(false); },
    });
    m.el.querySelector('[data-sim]').addEventListener('click', () => { decidido = true; ok(true); m.fechar(); });
  });
}

/* ---------------- Formulários ---------------- */
export function lerForm(form) {
  const d = {};
  new FormData(form).forEach((v, k) => { d[k] = typeof v === 'string' ? v.trim() : v; });
  return d;
}

const MASCARAS = {
  cpf: (d) => d.slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  cnpj: (d) => d.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2'),
  fone: (d) => (d = d.slice(0, 11), d.length <= 10 ? d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2') : d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')),
  cep: (d) => d.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
};
/** Liga máscaras (data-mask="cpf|cnpj|fone|cep|doc|money") dentro de um elemento. */
export function ligarMascaras(raiz) {
  raiz.querySelectorAll('[data-mask]').forEach((inp) => {
    const tipo = inp.dataset.mask;
    if (tipo === 'money') {
      inp.addEventListener('blur', () => { if (inp.value.trim() !== '') inp.value = money(parseMoney(inp.value), false); });
      return;
    }
    const aplicar = () => {
      let t = tipo;
      if (t === 'doc') t = (raiz.querySelector(inp.dataset.docTipo)?.value === 'CNPJ') ? 'cnpj' : 'cpf';
      inp.value = MASCARAS[t](digits(inp.value));
    };
    inp.addEventListener('input', aplicar);
    aplicar();
  });
}

export function vazio(texto, ico = 'search') {
  return `<div class="vazio">${icon(ico, 28)}<p>${esc(texto)}</p></div>`;
}

/** Botões "Imprimir A4 / Bobina 80mm" que abrem a página de impressão. */
export function botoesImpressao(tipo, id, rotulo = 'Imprimir') {
  const url = (f) => `imprimir.html${location.search.includes('demo') ? '?demo&' : '?'}t=${tipo}&id=${encodeURIComponent(id)}&f=${f}`;
  return `<span class="btn-grupo">
    <a class="btn" href="${url('a4')}" target="_blank" rel="noopener" title="${esc(rotulo)} em folha A4">${icon('printer', 16)} ${esc(rotulo)} A4</a>
    <a class="btn" href="${url('80')}" target="_blank" rel="noopener" title="${esc(rotulo)} na impressora de bobina 80mm">${icon('receipt', 16)} Bobina</a>
  </span>`;
}
