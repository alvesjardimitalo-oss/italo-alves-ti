// Site público: menu, ano do rodapé e o assistente "Fale comigo" (pedido -> WhatsApp + lead).
import { SITE } from './site-config.js';
import { salvarLead } from './leads.js';

const raiz = document.documentElement.dataset.raiz || './'; // páginas em /dicas/ usam "../"
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- menu e rodapé ---------------- */
$('.menu-toggle')?.addEventListener('click', () => document.body.classList.toggle('menu-on'));
document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('menu-on')));
document.querySelectorAll('[data-ano]').forEach((el) => { el.textContent = new Date().getFullYear(); });
document.querySelectorAll('[data-horario]').forEach((el) => { if (SITE.horario) { el.textContent = SITE.horario; el.hidden = false; } });
document.querySelectorAll('[data-regiao]').forEach((el) => { el.textContent = SITE.regiaoPresencial; });
document.querySelectorAll('[data-wa-direto]').forEach((a) => {
  if (SITE.whatsapp) a.href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de um orçamento.')}`;
  else a.addEventListener('click', (e) => { e.preventDefault(); abrirChat(); });
});

/* ---------------- indicação (?ref=Nome) — vale por 60 dias ---------------- */
let indicacao = '';
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) localStorage.setItem('italoti-ref', JSON.stringify({ nome: ref.slice(0, 60), ate: Date.now() + 60 * 864e5 }));
  const salvo = JSON.parse(localStorage.getItem('italoti-ref') || 'null');
  if (salvo && salvo.ate > Date.now()) indicacao = salvo.nome;
} catch (e) { /* sem armazenamento */ }

/* ---------------- origem da visita (utm_*) — guardada por 60 dias, vale para qualquer página ---------------- */
let origemCampanha = '';
try {
  const q = new URLSearchParams(location.search);
  const u = ['utm_source', 'utm_medium', 'utm_campaign'].map((k) => q.get(k)).filter(Boolean).join(' / ');
  if (u) localStorage.setItem('italoti-utm', JSON.stringify({ u: u.slice(0, 120), ate: Date.now() + 60 * 864e5 }));
  else if (document.referrer && !document.referrer.startsWith(location.origin) && !localStorage.getItem('italoti-utm')) {
    localStorage.setItem('italoti-utm', JSON.stringify({ u: document.referrer.replace(/^https?:\/\//, '').split('/')[0].slice(0, 120), ate: Date.now() + 60 * 864e5 }));
  }
  const s = JSON.parse(localStorage.getItem('italoti-utm') || 'null');
  if (s && s.ate > Date.now()) origemCampanha = s.u;
} catch (e) { /* sem armazenamento */ }

/* ---------------- assistente ---------------- */
const ARTIGOS = [
  ['Notebook esquentando e desligando', 'dicas/notebook-esquentando.html'],
  ['Computador lento', 'dicas/computador-lento.html'],
  ['Computador não liga', 'dicas/computador-nao-liga.html'],
  ['Tela azul', 'dicas/tela-azul.html'],
  ['Vale a pena trocar o HD por SSD?', 'dicas/ssd-ou-hd.html'],
  ['Bateria do notebook', 'dicas/bateria-notebook.html'],
  ['Backup dos arquivos', 'dicas/backup.html'],
  ['Vírus e golpes', 'dicas/virus-e-golpes.html'],
];

const ICO_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
const ICO_ENV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';

document.body.insertAdjacentHTML('beforeend', `
  <button class="chat-fab" id="chat-fab" type="button" aria-label="Fale comigo">${ICO_CHAT}<span class="txt">Fale comigo</span><span class="pulso"></span></button>
  <div class="chat" id="chat" role="dialog" aria-label="Assistente de atendimento" aria-hidden="true">
    <div class="chat-head"><img src="${raiz}assets/img/logo.svg" alt=""><div><b>${esc(SITE.nome)}</b><small>Assistente de atendimento</small></div>
      <button type="button" id="chat-fechar" aria-label="Fechar">×</button></div>
    <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
    <form class="chat-form" id="chat-form" autocomplete="on">
      <input id="chat-in" placeholder="Escolha uma opção acima" disabled>
      <input id="chat-hp" name="empresa_site" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <button id="chat-env" type="submit" disabled aria-label="Enviar">${ICO_ENV}</button>
    </form>
    <div class="chat-legal">Seus dados são usados só para responder ao seu pedido. <a href="${raiz}politica-de-privacidade.html">Privacidade</a></div>
  </div>`);

const chat = $('#chat');
const msgs = $('#chat-msgs');
const entrada = $('#chat-in');
const btnEnv = $('#chat-env');
let iniciado = false;
let esperando = null; // função que recebe o texto digitado
const lead = {};

function abrirChat(prefill) {
  if (prefill && typeof prefill === 'object') Object.assign(lead, prefill);
  document.body.classList.add('chat-on');
  chat.classList.add('aberto');
  chat.setAttribute('aria-hidden', 'false');
  $('#chat-fab').hidden = true;
  if (!iniciado) { iniciado = true; inicio(); }
}
function fecharChat() {
  document.body.classList.remove('chat-on');
  chat.classList.remove('aberto');
  chat.setAttribute('aria-hidden', 'true');
  $('#chat-fab').hidden = false;
}
$('#chat-fab').addEventListener('click', abrirChat);
$('#chat-fechar').addEventListener('click', fecharChat);
document.querySelectorAll('[data-abrir-chat]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  abrirChat(b.dataset.servico ? { servico: b.dataset.servico } : null);
}));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.classList.contains('aberto')) fecharChat(); });

const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };
function bot(texto, ms = 450) {
  return new Promise((ok) => {
    const d = document.createElement('div');
    d.className = 'msg bot digitando';
    d.textContent = '• • •';
    msgs.appendChild(d); rolar();
    setTimeout(() => { d.classList.remove('digitando'); d.innerHTML = texto; rolar(); ok(); }, ms);
  });
}
function eu(texto) {
  const d = document.createElement('div');
  d.className = 'msg eu';
  d.textContent = texto;
  msgs.appendChild(d); rolar();
}
function opcoes(lista) {
  return new Promise((ok) => {
    const box = document.createElement('div');
    box.className = 'opcoes';
    lista.forEach((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = op;
      b.addEventListener('click', () => { box.remove(); eu(op); ok(op); });
      box.appendChild(b);
    });
    msgs.appendChild(box); rolar();
  });
}
function pergunta(placeholder, { tipo = 'text', validar } = {}) {
  return new Promise((ok) => {
    entrada.disabled = false; btnEnv.disabled = false;
    entrada.type = tipo; entrada.placeholder = placeholder; entrada.value = '';
    entrada.inputMode = tipo === 'tel' ? 'tel' : 'text';
    entrada.focus();
    esperando = async (txt) => {
      const erro = validar ? validar(txt) : '';
      if (erro) { await bot(erro, 250); return false; }
      entrada.disabled = true; btnEnv.disabled = true; entrada.placeholder = '';
      ok(txt);
      return true;
    };
  });
}
$('#chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = entrada.value.trim();
  if (!t || !esperando) return;
  eu(t);
  entrada.value = '';
  const f = esperando;
  const ok = await f(t);
  if (ok) esperando = null;
});

async function inicio() {
  await bot(`Olá! 👋 Sou o assistente da <b>${esc(SITE.nome)}</b>.\nEm menos de 1 minuto eu organizo o seu pedido e envio direto para o WhatsApp do técnico.`, 300);
  const servicos = ['Conserto / orçamento', 'Suporte remoto', 'Upgrade ou montagem', 'Só tirar uma dúvida'];
  const esc1 = lead.servico || await opcoes(servicos);
  lead.servico = esc1;
  if (esc1 === 'Só tirar uma dúvida') return duvida();
  return fluxoPedido();
}

async function duvida() {
  await bot('Separei explicações dos problemas mais comuns. Escolha um assunto:');
  const box = document.createElement('div');
  box.className = 'opcoes';
  box.innerHTML = ARTIGOS.map(([t, h]) => `<button type="button" data-h="${raiz}${h}">${esc(t)}</button>`).join('');
  msgs.appendChild(box); rolar();
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { location.href = b.dataset.h; }));
  await bot('Se preferir, falo com o técnico por você.', 300);
  await opcoes(['Quero falar com o técnico']);
  lead.servico = 'Dúvida / orientação';
  return fluxoPedido();
}

async function fluxoPedido() {
  if (!lead.equipamento) {
    await bot('Qual é o equipamento?');
    lead.equipamento = await opcoes(['Notebook', 'Computador (desktop)', 'All-in-one', 'Impressora', 'Outro']);
  }
  if (!lead.problema) {
    await bot('O que está acontecendo?');
    lead.problema = await opcoes(['Não liga', 'Está lento', 'Esquenta / desliga sozinho', 'Tela / imagem', 'Vírus / propagandas', 'Formatar / instalar Windows', 'Trocar peça / upgrade', 'Outro']);
  }
  if (lead.detalhe) {
    await bot('Já anexei o resultado da ferramenta ao seu pedido. ✅', 300);
  } else {
    await bot('Se quiser, descreva com suas palavras (desde quando, se caiu, se molhou, mensagens de erro…). Ou toque em <b>Pular</b>.');
    const det = await Promise.race([
      pergunta('Descreva o problema…', { validar: (t) => (t.length > 600 ? 'Texto muito longo, resuma um pouco 🙂' : '') }),
      opcoes(['Pular']).then(() => { entrada.disabled = true; btnEnv.disabled = true; esperando = null; return ''; }),
    ]);
    document.querySelectorAll('#chat-msgs .opcoes').forEach((o) => o.remove());
    lead.detalhe = det;
  }

  await bot('Como prefere o atendimento?');
  lead.atendimento = await opcoes([`Levo até a assistência (${SITE.cidade})`, 'Atendimento remoto (qualquer cidade)', 'Preciso que busquem o equipamento']);

  await bot('Qual é o seu nome?');
  lead.nome = await pergunta('Seu nome', { validar: (t) => (t.length < 2 ? 'Pode me dizer seu nome?' : '') });

  await bot(`Prazer, ${esc(lead.nome.split(' ')[0])}! De qual cidade você fala? (ex.: Governador Valadares/MG)`);
  lead.cidade = await pergunta('Cidade / UF', { validar: (t) => (t.length < 2 ? 'Qual a sua cidade?' : '') });

  await bot('Por último: qual o seu WhatsApp com DDD? É por ele que o técnico vai te responder.');
  const wa = await pergunta('(33) 9 9999-9999', {
    tipo: 'tel',
    validar: (t) => { const d = t.replace(/\D/g, ''); return d.length < 10 || d.length > 13 ? 'Confere o número com DDD? Ex.: 33 99999-9999' : ''; },
  });
  lead.whatsapp = wa.replace(/\D/g, '');
  return concluir();
}

function textoPedido() {
  return [
    `Olá! Vim pelo site da ${SITE.nome}.`,
    '',
    `*Pedido:* ${lead.servico}`,
    `*Equipamento:* ${lead.equipamento}`,
    `*Problema:* ${lead.problema}`,
    lead.detalhe ? `*Detalhes:* ${lead.detalhe}` : '',
    indicacao ? `*Indicação de:* ${indicacao}` : '',
    `*Atendimento:* ${lead.atendimento}`,
    `*Nome:* ${lead.nome}`,
    `*Cidade:* ${lead.cidade}`,
    `*WhatsApp:* ${lead.whatsapp}`,
  ].filter((l, i) => i === 1 || l).join('\n');
}

async function concluir() {
  await bot('Perfeito! Confira o seu pedido:', 300);
  const r = document.createElement('div');
  r.className = 'resumo';
  r.textContent = textoPedido().replace(/\*/g, '');
  msgs.appendChild(r); rolar();

  // anti-spam simples: campo invisível e 1 envio a cada 2 minutos por navegador
  const ultimo = Number(localStorage.getItem('italoti-ultimo-lead') || 0);
  const bloqueado = $('#chat-hp').value || Date.now() - ultimo < 120000;

  if (!bloqueado) {
    localStorage.setItem('italoti-ultimo-lead', String(Date.now()));
    salvarLead({ ...lead, indicacao, origem: location.pathname.split('/').pop() || 'inicio', utm: origemCampanha });
  }

  if (SITE.whatsapp) {
    const url = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(textoPedido())}`;
    await bot('Toque no botão abaixo para enviar pelo WhatsApp. A mensagem já vai pronta 👇');
    const box = document.createElement('div');
    box.className = 'opcoes';
    box.innerHTML = `<a class="btn btn-wa btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`;
    msgs.appendChild(box); rolar();
  } else {
    await bot(`Pedido registrado! ✅ O técnico vai te chamar no WhatsApp informado.${SITE.email ? `\nSe preferir, escreva para <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>.` : ''}`);
  }
  await bot('Obrigado pelo contato! Enquanto isso, veja <a href="' + raiz + 'dicas/">nossas dicas</a>.', 600);
}

// abre o assistente direto se o link tiver #fale-comigo
if (location.hash === '#fale-comigo') abrirChat();

// API para as ferramentas: window.FaleComigo.abrir({ servico, equipamento, problema, detalhe })
window.FaleComigo = { abrir: abrirChat };

// app instalável (PWA): guarda as páginas para abrir rápido e funcionar com internet fraca
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register(raiz + 'sw.js').catch(() => {}));
}
