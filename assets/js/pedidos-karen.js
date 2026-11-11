// "Meus pedidos" da loja da Karen: lista os pedidos feitos neste aparelho (ou pelo código)
// e mostra a etapa publicada pela Karen no painel (ti/base/rastreio/kpedido-<código>).
// O documento público não tem nome nem telefone: só código, itens, total e etapas.
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';
import { meusPedidos, lembrarPedido } from './carrinho-bf.js?v=10';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
const PRAZO_MIN = 10;
const CODIGO = /^P[A-Z0-9]{4,12}$/;
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const quando = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const ETAPAS = [
  ['feito', 'Pedido feito'],
  ['pago', 'Pix confirmado'],
  ['separado', 'Separado'],
  ['a-caminho', 'Saiu para entrega ou pronto para retirada'],
  ['entregue', 'Entregue'],
];
const K_ESCONDIDOS = 'karen-pedidos-escondidos';
const lerJSON = (k, p) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? p; } catch (_) { return p; } };

let F = null, db = null, whatsKaren = '';
async function conectar() {
  try {
    const [{ initializeApp }, Fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore-lite.js')]);
    const app = initializeApp(FIREBASE_CONFIG, 'karen-pedidos-publico');
    await iniciarAppCheck(app);
    F = Fs; db = Fs.getFirestore(app);
    const c = await F.getDoc(F.doc(db, 'ti', 'base', 'rastreio', 'sacolas-publicas')).catch(() => null);
    const t = String((c && c.exists() && c.data().whatsapp) || '').replace(/\D/g, '');
    whatsKaren = t.length >= 12 && t.length <= 13 ? t : '';
  } catch (e) { console.warn('Sem conexão com a loja:', e); }
}
async function lerAcompanhamento(codigo) {
  if (!db) return { erro: true };
  try {
    const s = await F.getDoc(F.doc(db, 'ti', 'base', 'rastreio', 'kpedido-' + codigo));
    return s.exists() ? s.data() : null;
  } catch (e) { return { erro: true }; }
}

function linhaDoTempo(situacao, historico, feitoEm) {
  const atual = situacao === 'aguardando' || !situacao ? 0 : Math.max(0, ETAPAS.findIndex(([k]) => k === situacao));
  return '<ol class="pedido-etapas">' + ETAPAS.map(([k, nome], i) => {
    const em = k === 'feito' ? feitoEm : historico && historico[k];
    const cls = i < atual ? 'feita' : i === atual ? 'atual' : '';
    return '<li class="' + cls + '"' + (i === atual ? ' aria-current="step"' : '') + '><strong>' + esc(nome) + '</strong>' + (em && i <= atual ? '<span>' + esc(quando(em)) + '</span>' : '') + '</li>';
  }).join('') + '</ol>';
}

function cartao(local, doc) {
  const codigo = local.codigo;
  const pendente = lerJSON('karen-bf-pedido', null);
  const feitoEm = (doc && doc.criadoEm) || local.em || '';
  let situacao = doc && !doc.erro ? doc.situacao : '';
  let aviso = '';
  if (doc && doc.erro) aviso = 'Não foi possível consultar agora. Verifique a internet e toque em Atualizar.';
  else if (!doc) {
    const aberto = pendente && pendente.codigo === codigo && new Date(pendente.prazo).getTime() > Date.now();
    const venceu = feitoEm && Date.now() - new Date(feitoEm).getTime() > PRAZO_MIN * 60000;
    situacao = 'aguardando';
    aviso = aberto ? 'Aguardando o seu Pix. Toque no botão “Pix pendente” no canto da tela para ver o QR Code.'
      : venceu ? 'A Karen ainda não confirmou o Pix. Se você pagou dentro dos 10 minutos, envie o comprovante pelo WhatsApp.'
      : 'Aguardando a Karen confirmar o seu Pix.';
  }
  const titulo = { cancelado: 'Pedido cancelado', expirado: 'Pix não pago no prazo', entregue: 'Pedido entregue' }[situacao] || ETAPAS.find(([k]) => k === situacao)?.[1] || 'Aguardando Pix';
  const itens = doc && Array.isArray(doc.itens) ? doc.itens : [];
  const total = doc && doc.total ? doc.total : local.total;
  const msg = 'Olá, Karen! Quero falar sobre o meu pedido ' + codigo + '.';
  return '<article class="pedido-card" data-situacao="' + esc(situacao) + '">' +
    '<header><div><span class="pedido-cod">Pedido ' + esc(codigo) + '</span><h2>' + esc(titulo) + '</h2></div>' + (total ? '<b class="pedido-total">' + brl(total) + '</b>' : '') + '</header>' +
    (situacao === 'cancelado' || situacao === 'expirado'
      ? '<p class="pedido-aviso">' + (situacao === 'cancelado' ? 'Este pedido foi cancelado. Se você já pagou, fale com a Karen.' : 'O Pix não foi pago em 10 minutos e o pedido foi cancelado.') + '</p>'
      : linhaDoTempo(situacao, doc && doc.historico, feitoEm)) +
    (aviso ? '<p class="pedido-aviso">' + esc(aviso) + '</p>' : '') +
    (itens.length ? '<ul class="pedido-itens">' + itens.map((i) => '<li><span>' + esc(i.q) + '×</span> ' + esc(i.nome) + '</li>').join('') + '</ul>' : '') +
    '<div class="pedido-acoes">' + (whatsKaren ? '<a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/' + whatsKaren + '?text=' + encodeURIComponent(msg) + '">Falar com a Karen</a>' : '') +
    '<button type="button" class="pedido-esquecer" data-esquecer="' + esc(codigo) + '">Remover desta lista</button></div></article>';
}

async function desenhar() {
  const box = $('#meus-pedidos');
  const escondidos = new Set(lerJSON(K_ESCONDIDOS, []));
  const lista = meusPedidos().filter((p) => !escondidos.has(p.codigo));
  if (!lista.length) {
    box.innerHTML = '<div class="pedido-vazio"><p>Nenhum pedido neste aparelho ainda. Os pedidos feitos pelo carrinho aparecem aqui sozinhos.</p>' +
      '<a class="btn bf-girar" href="/karen/#perfumes-bf">Ver os produtos</a></div>';
    return;
  }
  box.setAttribute('aria-busy', 'true');
  const docs = await Promise.all(lista.map((p) => lerAcompanhamento(p.codigo)));
  box.removeAttribute('aria-busy');
  box.innerHTML = lista.map((p, i) => cartao(p, docs[i])).join('');
  // Pedido que estava "Pix pendente" neste aparelho e já foi confirmado ou cancelado pela Karen.
  const pendente = lerJSON('karen-bf-pedido', null);
  const i = pendente ? lista.findIndex((p) => p.codigo === pendente.codigo) : -1;
  const sit = i >= 0 && docs[i] && !docs[i].erro ? docs[i].situacao : '';
  if (sit && sit !== 'aguardando') {
    try {
      localStorage.removeItem('karen-bf-pedido');
      if (pendente.cupom) {
        const u = lerJSON('karen-bf-cupons-usados', {});
        u[pendente.cupom] = { ...(u[pendente.cupom] || {}), estado: sit === 'cancelado' || sit === 'expirado' ? 'perdido' : 'usado' };
        localStorage.setItem('karen-bf-cupons-usados', JSON.stringify(u));
      }
    } catch (_) {}
    const carrinho = lerJSON('karen-bf-carrinho', {});
    const fab = document.querySelector('.carrinho-fab');
    if (fab && !Object.values(carrinho).some((q) => q > 0)) fab.hidden = true;
  }
  box.querySelectorAll('[data-esquecer]').forEach((b) => b.onclick = () => {
    const xs = new Set(lerJSON(K_ESCONDIDOS, [])); xs.add(b.dataset.esquecer);
    try { localStorage.setItem(K_ESCONDIDOS, JSON.stringify([...xs])); } catch (_) {}
    desenhar();
  });
}

function adicionarCodigo(bruto) {
  const codigo = String(bruto || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!CODIGO.test(codigo)) return false;
  const escondidos = lerJSON(K_ESCONDIDOS, []).filter((c) => c !== codigo);
  try { localStorage.setItem(K_ESCONDIDOS, JSON.stringify(escondidos)); } catch (_) {}
  if (!meusPedidos().some((p) => p.codigo === codigo)) lembrarPedido(codigo);
  return true;
}

(async () => {
  const param = new URLSearchParams(location.search).get('p');
  if (param) adicionarCodigo(param);
  $('#form-codigo').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const campo = $('#codigo-pedido');
    const erro = $('#erro-codigo');
    if (!adicionarCodigo(campo.value)) { erro.hidden = false; erro.textContent = 'Código inválido. Ele começa com P e tem 7 caracteres, por exemplo P7KQ2MX.'; campo.focus(); return; }
    erro.hidden = true; campo.value = '';
    desenhar();
  });
  $('#atualizar-pedidos').addEventListener('click', () => desenhar());
  await conectar();
  await desenhar();
  // Atualiza sozinho enquanto a página estiver aberta.
  setInterval(() => { if (!document.hidden) desenhar(); }, 30000);
})();
