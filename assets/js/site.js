// Site público: menu, ano do rodapé e o assistente "Fale comigo" (pedido -> WhatsApp + lead).
import { SITE } from './site-config.js';
import { salvarLead } from './leads.js';
import { iniciarMetricas, registrarEvento, MetricasSite } from './metricas.js';

import { CATEGORIAS, sintomasPorCategoria, orientarSintoma } from './alvesinho-conhecimento.js';

const raiz = document.documentElement.dataset.raiz || './';
// Exposição somente da função de métricas, para as ferramentas públicas.
window.MetricasSite = MetricasSite;
iniciarMetricas(raiz); // páginas em /dicas/ usam "../"
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- menu e rodapé ---------------- */
const botaoMenu = $('.menu-toggle');
function definirMenu(aberto) {
  document.body.classList.toggle('menu-on', aberto);
  if (botaoMenu) {
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  }
}
botaoMenu?.addEventListener('click', () => definirMenu(!document.body.classList.contains('menu-on')));
document.querySelectorAll('.menu a').forEach((link) => link.addEventListener('click', () => definirMenu(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('menu-on')) {
    definirMenu(false);
    botaoMenu?.focus();
  }
});
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('menu-on') && !e.target.closest('.topo')) definirMenu(false);
});
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
  <button class="chat-fab" id="chat-fab" type="button" aria-label="Conversar com Alvesinho"><img src="${raiz}assets/img/alvesinho.svg" alt="" width="30" height="30"><span class="txt">Fale com o Alvesinho</span><span class="pulso"></span></button>
  <div class="chat" id="chat" role="dialog" aria-label="Assistente de atendimento" aria-hidden="true">
    <div class="chat-head"><img class="alvesinho-avatar" src="${raiz}assets/img/alvesinho.svg" alt="Avatar do Alvesinho"><div><b>Alvesinho</b><small>Assistente virtual · ${esc(SITE.nome)}</small></div>
      <button type="button" id="chat-fechar" aria-label="Fechar">×</button></div>
    <div class="chat-msgs" id="chat-msgs" aria-live="polite"></div>
    <form class="chat-form" id="chat-form" autocomplete="on">
      <input id="chat-in" placeholder="Escolha uma opção acima" disabled>
      <input id="chat-hp" name="empresa_site" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <button id="chat-env" type="submit" disabled aria-label="Enviar">${ICO_ENV}</button>
    </form>
    <div class="chat-legal">Sou um assistente virtual automatizado. Orientações iniciais não são diagnóstico técnico. Seus dados são usados para responder ao pedido. <a href="${raiz}politica-de-privacidade.html">Privacidade</a></div>
  </div>`);

const chat = $('#chat');
const msgs = $('#chat-msgs');
const entrada = $('#chat-in');
const btnEnv = $('#chat-env');
let iniciado = false;
let esperando = null; // função que recebe o texto digitado
const lead = {};

function abrirChat(prefill) {
  registrarEvento('chat_aberto');
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
$('#chat-fab').addEventListener('click', () => abrirChat());
$('#chat-fechar').addEventListener('click', fecharChat);
document.querySelectorAll('[data-abrir-chat]').forEach((b) => b.addEventListener('click', (e) => {
  e.preventDefault();
  abrirChat(b.dataset.sintoma ? { problema: b.dataset.sintoma, servico: 'Diagnóstico por sintomas', equipamento: b.dataset.equipamento || '' }
    : b.dataset.servico ? { servico: b.dataset.servico } : null);
}));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.classList.contains('aberto')) fecharChat(); });

const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };
function bot(texto, ms = 450) {
  return new Promise((ok) => {
    const linha = document.createElement('div');
    linha.className = 'alvesinho-resposta';
    const avatar = document.createElement('img');
    avatar.src = raiz + 'assets/img/alvesinho.svg';
    avatar.alt = '';
    avatar.width = 27;
    avatar.height = 27;
    avatar.className = 'alvesinho-mini';
    const d = document.createElement('div');
    d.className = 'msg bot digitando';
    d.textContent = 'digitando…';
    linha.append(avatar, d);
    msgs.appendChild(linha); rolar();
    const tempo = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : Math.min(850, Math.max(140, ms + texto.length * 3));
    setTimeout(() => { d.classList.remove('digitando'); d.innerHTML = texto; rolar(); ok(); }, tempo);
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
  await bot(`Olá! 👋 Eu sou o <b>Alvesinho</b>, assistente virtual da <b>${esc(SITE.nome)}</b>. Posso te orientar pelos sintomas e encaminhar seu pedido diretamente ao técnico.`, 250);
  if (lead.problema && lead.servico === 'Diagnóstico por sintomas') return diagnostico(lead.problema);
  const servicos = ['Conserto / orçamento', 'Diagnóstico por sintomas', 'Descrever meu problema', 'Suporte remoto', 'Upgrade ou montagem', 'Vale consertar ou trocar?', 'Acompanhar OS', 'Só tirar uma dúvida'];
  const esc1 = lead.servico || await opcoes(servicos);
  lead.servico = esc1;
  if (esc1 === 'Diagnóstico por sintomas') return diagnostico();
  if (esc1 === 'Descrever meu problema') {
    await bot('Pode me contar com suas palavras o que está acontecendo? Vou procurar uma orientação inicial.', 200);
    const relato = await pergunta('Ex.: meu notebook liga, mas fica com tela preta', {
      validar: (t) => t.length < 5 ? 'Descreva um pouco mais o sintoma, por favor.' : t.length > 450 ? 'Resuma em até 450 caracteres, por favor.' : '',
    });
    return diagnostico(relato);
  }
  if (esc1 === 'Vale consertar ou trocar?') {
    await bot(`Essa dúvida é muito comum. Tenho uma ferramenta gratuita com perguntas sobre a idade do computador, defeito e o uso. <a href="${raiz}ferramentas/consertar-ou-trocar.html">Descobrir se compensa consertar ou trocar</a>.`);
    const proximo = await opcoes(['Quero orçamento mesmo assim', 'Ver sintomas primeiro']);
    if (proximo === 'Ver sintomas primeiro') return diagnostico();
    lead.servico = 'Avaliar conserto ou troca';
    return fluxoPedido();
  }
  if (esc1 === 'Acompanhar OS') {
    await bot(`Para conferir o andamento do conserto, você precisa do código da ordem de serviço e do telefone cadastrado. <a href="${raiz}acompanhar.html">Abrir acompanhamento de OS</a>.`);
    const proximo = await opcoes(['Preciso de ajuda com a OS', 'Quero outro atendimento']);
    if (proximo === 'Quero outro atendimento') { lead.servico = 'Conserto / orçamento'; return fluxoPedido(); }
    lead.servico = 'Dúvida sobre acompanhamento de OS';
    return fluxoPedido();
  }
  if (esc1 === 'Só tirar uma dúvida') return duvida();
  return fluxoPedido();
}

async function diagnostico(relato = '') {
  if (!lead.equipamento) {
    await bot('Vamos entender o equipamento primeiro. Qual deles está apresentando o problema?');
    lead.equipamento = await opcoes(['Notebook', 'Computador (desktop)', 'All-in-one', 'Impressora', 'Outro']);
  }
  if (!relato) {
    await bot('Em qual área está o sintoma? Se preferir, pode escrever o problema com suas palavras.');
    const grupo = await opcoes([...CATEGORIAS.map((g) => g.titulo), 'Descrever outro sintoma']);
    if (grupo === 'Descrever outro sintoma') {
      await bot('Conte o que acontece quando tenta usar o equipamento.');
      relato = await pergunta('Ex.: não carrega, tela piscando, Wi-Fi cai...', {
        validar: (t) => t.length < 4 ? 'Conte um pouco mais, por favor.' : t.length > 450 ? 'Resuma em até 450 caracteres.' : '',
      });
    } else {
      const categoria = CATEGORIAS.find((g) => g.titulo === grupo);
      const itens = sintomasPorCategoria(categoria.id);
      await bot('Qual destas situações parece mais com a sua?');
      relato = await opcoes([...itens.map((x) => x.titulo), 'Outra situação']);
      if (relato === 'Outra situação') {
        relato = await pergunta('Descreva o sintoma...', { validar: (t) => t.length < 4 ? 'Pode descrever mais?' : '' });
      }
    }
  }
  const orientacao = orientarSintoma(relato);
  if (orientacao.conhecido) registrarEvento('sintoma_selecionado', orientacao.id);
  lead.problema = orientacao.conhecido ? orientacao.titulo : String(relato).slice(0, 160);
  // Preserva a descrição pessoal sem transformá-la em diagnóstico.
  if (!orientacao.conhecido) lead.detalhe = String(relato).slice(0, 450);
  await bot(`<b>${esc(orientacao.titulo)}</b>\n${esc(orientacao.possiveis)}`, 350);
  await bot(`${orientacao.alerta ? '<b>Atenção:</b> ' : '<b>Primeiro cuidado:</b> '}${esc(orientacao.passo)}`, 330);
  await bot('Isso é uma orientação preliminar: só uma avaliação técnica confirma a causa e o valor do reparo.', 200);
  if (orientacao.dica) {
    await bot(`Se quiser entender melhor, veja também: <a href="${raiz}${esc(orientacao.dica)}">ler dica relacionada</a>.`, 150);
  }
  const opcao = await opcoes(['Quero solicitar orçamento', 'Avaliar outro sintoma', 'Falar direto no WhatsApp']);
  if (opcao === 'Avaliar outro sintoma') { lead.problema = ''; lead.detalhe = ''; return diagnostico(); }
  if (opcao === 'Falar direto no WhatsApp' && SITE.whatsapp) {
    const msg = `Olá! Conversei com o Alvesinho sobre ${lead.equipamento}: ${lead.problema}. Gostaria de uma avaliação.`;
    await bot(`Preparei sua mensagem. <a class="btn btn-wa btn-sm" href="https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Abrir conversa no WhatsApp</a>`);
    return;
  }
  lead.servico = 'Diagnóstico e orçamento';
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
    await bot('O que está acontecendo? Você também pode escolher <b>Outros sintomas</b> para uma orientação mais detalhada.');
    lead.problema = await opcoes(['Não liga', 'Está lento', 'Esquenta / desliga sozinho', 'Tela / imagem', 'Vírus / propagandas', 'Formatar / instalar Windows', 'Trocar peça / upgrade', 'Bateria / carregador', 'Internet / Wi-Fi', 'Impressora', 'Outros sintomas']);
    if (lead.problema === 'Outros sintomas') { lead.problema = ''; return diagnostico(); }
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

  // A gravação precisa ser confirmada antes de informar que o pedido foi registrado.
  // O intervalo local é apenas um limitador de conveniência, não uma proteção contra bots.
  let ultimo = 0;
  try { ultimo = Number(localStorage.getItem('italoti-ultimo-lead') || 0); } catch (_) {}
  const bloqueado = Boolean($('#chat-hp').value) || Date.now() - ultimo < 120000;
  let registrado = false;
  if (!bloqueado) {
    registrado = await salvarLead({
      ...lead, indicacao, origem: location.pathname.split('/').pop() || 'inicio', utm: origemCampanha,
    });
    if (registrado) {
      try { localStorage.setItem('italoti-ultimo-lead', String(Date.now())); } catch (_) {}
    }
  }

  if (registrado) {
    await bot('Seu pedido foi registrado no sistema. ✅ O técnico poderá consultar seus dados de contato.', 250);
  } else {
    await bot('Não foi possível confirmar o registro automático deste pedido. Para garantir o atendimento, envie a mensagem diretamente pelo WhatsApp.', 250);
  }

  if (SITE.whatsapp) {
    const url = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(textoPedido())}`;
    await bot('Toque abaixo para conversar com o técnico pelo WhatsApp. A mensagem já está pronta 👇', 250);
    const box = document.createElement('div');
    box.className = 'opcoes';
    box.innerHTML = `<a class="btn btn-wa btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`;
    msgs.appendChild(box); rolar();
  } else if (!registrado) {
    await bot(`Entre em contato pelo e-mail ${SITE.email ? `<a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>` : 'de atendimento informado no site'}.`);
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
