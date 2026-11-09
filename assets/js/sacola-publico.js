// Vitrine pública da Sacola Misteriosa. Só lê campos de divulgação,
// nunca o conteúdo secreto salvo no painel administrativo.
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';
import { salvarLead } from './leads.js';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
const vitrine = document.getElementById('vitrine');
const aviso = document.getElementById('aviso-vitrine');
const seletor = document.getElementById('sacola-select');
const form = document.getElementById('form-pedido');
const retorno = document.getElementById('retorno');
const enviar = document.getElementById('enviar');
let itens = [];
let telefoneKaren = '';

const brl = (n) => Number(n).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => {
  const d = digits(v);
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paletas = ['plum', 'rose', 'cream'];
const valido = (s) => s && typeof s.id === 'string' && typeof s.titulo === 'string'
  && Number.isFinite(Number(s.valor)) && Number(s.valor) > 0 && Number.isFinite(Number(s.estoque));
const arteSacola = (indice) => {
  const cor = paletas[indice % paletas.length];
  return '<div class="paperbag paperbag--' + cor + '">' +
    '<span class="paperbag__handle"></span><span class="paperbag__side"></span>' +
    '<span class="paperbag__front"><span class="paperbag__motif">✦</span>' +
    '<span class="paperbag__monogram">KC</span><span class="paperbag__name">Karen</span>' +
    '<span class="paperbag__type">COSMÉTICOS</span><span class="paperbag__line"></span>' +
    '<span class="paperbag__glint">✧</span></span></div>';
};
function selecionar(id) {
  const secao = document.getElementById('pedido');
  if (!seletor || !secao) {
    const url = new URL('/sacola-misteriosa/pedido/', window.location.origin);
    url.searchParams.set('sacola', id);
    if (window.KarenSound?.isEnabled()) {
      window.setTimeout(() => window.location.assign(url.href), 190);
    } else {
      window.location.assign(url.href);
    }
    return;
  }
  seletor.value = id;
  secao.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  const formCard = secao.querySelector('.form-card');
  if (formCard) {
    formCard.classList.add('sacola-selecionada');
    window.setTimeout(() => formCard.classList.remove('sacola-selecionada'), 1300);
  }
  seletor.focus({preventScroll:true});
}
function desenhar() {
  const ativos = itens.filter(s => s.ativo !== false && valido(s));
  if (vitrine) vitrine.replaceChildren();
  if (seletor) seletor.replaceChildren(new Option(ativos.some(s => Number(s.estoque) > 0) ?
    'Selecione sua sacola' : 'Nenhuma sacola disponível', ''));
  ativos.forEach((s,i) => {
    const disponivel = Number(s.estoque) > 0;
    const poucaQuantidade = disponivel && Number(s.estoque) <= 4;
    const card = document.createElement('article');
    card.className = 'card';
    const ribbon = document.createElement('span');
    ribbon.className = 'card-ribbon';
    ribbon.textContent = 'SACOLA SURPRESA';
    card.appendChild(ribbon);
    const art = document.createElement('button');
    art.type = 'button';
    art.className = 'card-art';
    art.setAttribute('aria-label', disponivel ?
      'Escolher ' + s.titulo + ', ' + brl(s.valor) : s.titulo + ' esgotada');
    art.innerHTML = arteSacola(i) +
      '<span class="card-art__spark" aria-hidden="true">✦</span>' +
      '<span class="card-art__spark" aria-hidden="true">✧</span>' +
      '<span class="card-art__hint" aria-hidden="true">' +
      (disponivel ? 'Toque para escolher ↗' : 'Esgotada no momento') + '</span>';
    art.disabled = !disponivel;
    card.appendChild(art);
    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = '<div class="card-tag">O SEGREDO ESTÁ DENTRO ✦</div>' +
      '<h3>' + esc(s.titulo.slice(0,100)) + '</h3>' +
      '<p>' + esc(String(s.descricaoPublica ||
        'Uma seleção de cosméticos surpresa preparada com carinho. Qual será o seu presente?').slice(0,260)) + '</p>' +
      '<div class="price">' + brl(s.valor) + '</div>' +
      '<div class="availability ' + (disponivel ? (poucaQuantidade ? 'low' : '') : 'soldout') + '">' +
      (disponivel ? (poucaQuantidade ?
        ('Restam ' + Number(s.estoque) + ' ' + (Number(s.estoque) === 1 ? 'unidade' : 'unidades')) :
        'Disponível para solicitar') : 'Temporariamente esgotada') + '</div>';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = disponivel ? 'Essa é a minha surpresa ↗' : 'Sacola esgotada';
    btn.disabled = !disponivel;
    if (disponivel) {
      if (seletor) seletor.appendChild(new Option(s.titulo + ' · ' + brl(s.valor), s.id));
      art.addEventListener('click', () => selecionar(s.id));
      btn.addEventListener('click', () => selecionar(s.id));
    }
    body.appendChild(btn);
    const nota = document.createElement('div');
    nota.className = 'card-teaser';
    nota.textContent = disponivel ? 'Você sabe o valor. O conteúdo é surpresa! ♡' : 'Confira outras opções disponíveis.';
    body.appendChild(nota);
    card.appendChild(body);
    if (vitrine) vitrine.appendChild(card);
  });
  if (aviso) aviso.hidden = ativos.length > 0;
  if (vitrine) vitrine.style.display = ativos.length ? '' : 'none';
  if (enviar) enviar.disabled = !ativos.some(s => Number(s.estoque) > 0);
  if (seletor) {
    const pedidoId = new URLSearchParams(window.location.search).get('sacola');
    if (pedidoId && ativos.some(s => s.id === pedidoId && Number(s.estoque) > 0)) seletor.value = pedidoId;
  }
}
function mostrar(texto, erro=false, waUrl='') {
  retorno.hidden = false;
  retorno.style.color = erro ? '#a12b41' : '#276044';
  retorno.replaceChildren(document.createTextNode(texto));
  if (waUrl) {
    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = ' Continuar no WhatsApp da Karen →';
    a.style.display = 'block';
    a.style.textDecoration = 'underline';
    a.style.marginTop = '9px';
    retorno.appendChild(a);
  }
}
async function carregar() {
  if (aviso) aviso.innerHTML = '<strong>Carregando as sacolas…</strong>Verificando a disponibilidade.';
  try {
    const [{initializeApp}, F] = await Promise.all([
      import(FB + 'firebase-app.js'),
      import(FB + 'firebase-firestore-lite.js')
    ]);
    const app = initializeApp(FIREBASE_CONFIG, 'karen-sacolas-publico');
    await iniciarAppCheck(app);
    const db = F.getFirestore(app);
    // A regra existente de rastreio permite apenas GET público neste documento.
    const snap = await F.getDoc(F.doc(db,'ti','base','rastreio','sacolas-publicas'));
    const dados = snap.exists() ? snap.data() : {};
    itens = Array.isArray(dados.itens) ? dados.itens : [];
    telefoneKaren = normalizeWhatsApp(dados.whatsapp);
    if (telefoneKaren.length < 12 || telefoneKaren.length > 13) telefoneKaren = '';
    desenhar();
    if (!itens.length) {
      if (aviso) aviso.innerHTML = '<strong>Em preparação 💝</strong>As opções serão divulgadas aqui assim que a Karen publicar as sacolas.';
    }
  } catch (e) {
    console.warn('Não foi possível carregar a vitrine:', e);
    itens = [];
    desenhar();
    if (aviso) aviso.innerHTML = '<strong>Não foi possível consultar as sacolas.</strong>Atualize a página para tentar novamente.';
  }
}
if (form) form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const id = seletor.value;
  const s = itens.find((i) => i.id === id && i.ativo !== false && Number(i.estoque) > 0);
  if (!s) { mostrar('Selecione uma sacola disponível.', true); return; }
  const nome = document.getElementById('nome').value.trim();
  const telefone = normalizeWhatsApp(document.getElementById('telefone').value);
  const obs = document.getElementById('observacao').value.trim();
  if (nome.length < 2 || !/^55[0-9]{10,11}$/.test(telefone)) {
    mostrar('Informe seu nome e um WhatsApp válido com DDD.', true); return;
  }
  if (!document.getElementById('aceite').checked) {
    mostrar('Precisamos da sua autorização para o contato.', true); return;
  }
  enviar.disabled = true;
  retorno.hidden = true;
  enviar.textContent = 'Enviando…';
  const resumo = 'Sacola: ' + s.titulo + ' | Valor anunciado: ' + brl(s.valor)
    + (obs ? ' | Observação: ' + obs : '');
  const ok = await salvarLead({
    nome,whatsapp:telefone,cidade:'',equipamento:'',problema:'Pedido de sacola',
    detalhe:resumo,atendimento:'WhatsApp',servico:'Sacola Misteriosa',
    origem:'sacola-misteriosa',utm:'sacola-misteriosa'
  });
  if (ok) {
    const mensagem = 'Olá, Karen! Meu nome é ' + nome + '. Fiz uma solicitação no site da Sacola Misteriosa.\n' +
      'Sacola: ' + s.titulo + '\nValor anunciado: ' + brl(s.valor) +
      (obs ? '\nObservação: ' + obs : '') + '\nQuero confirmar disponibilidade e pagamento.';
    const url = telefoneKaren ? 'https://wa.me/' + telefoneKaren + '?text=' + encodeURIComponent(mensagem) : '';
    mostrar('Solicitação recebida! A equipe entrará em contato para confirmar a disponibilidade, pagamento e entrega.', false, url);
    form.reset();
  } else {
    const mensagem = 'Olá, Karen! Quero solicitar a sacola ' + s.titulo + ' (' + brl(s.valor) + '). Meu nome é ' + nome + '.';
    const url = telefoneKaren ? 'https://wa.me/' + telefoneKaren + '?text=' + encodeURIComponent(mensagem) : '';
    mostrar('Não foi possível registrar a solicitação. Tente novamente.' + (url ? ' Você também pode entrar em contato diretamente:' : ''), true, url);
  }
  enviar.disabled = false;
  enviar.textContent = 'Quero confirmar minha surpresa 💝';
});
if (vitrine || seletor) carregar();
