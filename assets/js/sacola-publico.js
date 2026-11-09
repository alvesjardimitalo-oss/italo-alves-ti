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
const icons = ['🎁','💝','✨','🌷','🎀','🌺'];
const valido = (s) => s && typeof s.id === 'string' && typeof s.titulo === 'string'
  && Number.isFinite(Number(s.valor)) && Number(s.valor) > 0 && Number.isFinite(Number(s.estoque));

function selecionar(id) {
  seletor.value = id;
  document.getElementById('pedido').scrollIntoView({behavior:'smooth',block:'start'});
  seletor.focus({preventScroll:true});
}
function desenhar() {
  const ativos = itens.filter((s) => s.ativo !== false && valido(s));
  vitrine.innerHTML = '';
  seletor.replaceChildren(new Option(ativos.some((s) => s.estoque > 0) ? 'Selecione uma sacola' : 'Nenhuma sacola disponível', ''));
  ativos.forEach((s, i) => {
    const disponivel = Number(s.estoque) > 0;
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = '<div class="card-art" aria-hidden="true">' + icons[i % icons.length] + '</div>' +
      '<div class="card-body"><h3>' + esc(s.titulo.slice(0,100)) + '</h3><p>' +
      esc(String(s.descricaoPublica || 'Produtos de beleza surpresa, selecionados com carinho.').slice(0,260)) + '</p>' +
      '<div class="price">' + brl(s.valor) + '</div>' +
      '<div class="availability">' + (disponivel ? 'Disponível para solicitar' : 'Temporariamente esgotada') + '</div></div>';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = disponivel ? 'Quero esta sacola' : 'Esgotada';
    btn.disabled = !disponivel;
    if (disponivel) {
      seletor.appendChild(new Option(s.titulo + ' · ' + brl(s.valor), s.id));
      btn.addEventListener('click', () => selecionar(s.id));
    }
    card.querySelector('.card-body').appendChild(btn);
    vitrine.appendChild(card);
  });
  aviso.hidden = ativos.length > 0;
  vitrine.style.display = ativos.length ? '' : 'none';
  enviar.disabled = !ativos.some((s) => Number(s.estoque) > 0);
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
  aviso.innerHTML = '<strong>Carregando as sacolas…</strong>Verificando a disponibilidade.';
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
      aviso.innerHTML = '<strong>Em preparação 💝</strong>As opções serão divulgadas aqui assim que a Karen publicar as sacolas.';
    }
  } catch (e) {
    console.warn('Não foi possível carregar a vitrine:', e);
    itens = [];
    desenhar();
    aviso.innerHTML = '<strong>Não foi possível consultar as sacolas.</strong>Atualize a página para tentar novamente.';
  }
}
form.addEventListener('submit', async (ev) => {
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
  enviar.textContent = 'Enviar solicitação 💝';
});
carregar();
