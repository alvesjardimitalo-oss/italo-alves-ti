// Feedback e renovação do consórcio da Karen Cosméticos.
// Página acessível só pelo link enviado às participantes (noindex, fora do sitemap e dos menus).
// A resposta é gravada em ti/base/leads (origem "consorcio-renovacao", aparece no painel em
// Loja da Karen › Consórcio) e enviada para o WhatsApp da Karen.
// Grupos em andamento recebem o texto de renovação antecipada; grupos encerrados (G1, G2),
// o texto de agradecimento pelo consórcio que terminou.
import { salvarLead } from './leads.js';
import { carregarGrupos, mesLongo, brl } from './consorcio-publico.js';

const WHATSAPP_KAREN = '5533999628147';
const form = document.getElementById('form-renovacao');
const retorno = document.getElementById('retorno');
const enviar = document.getElementById('enviar');
const TEXTO_BOTAO = enviar ? enviar.textContent : '';

const GRUPOS = {
  G3: { nome: 'Consorcio G3 - 50,00 - Abril 2026 a Janeiro 2027' },
  G4: { nome: 'Consorcio G4 - 35,00 - Maio 2026 a Fevereiro 2027' },
  G5: { nome: 'Consorcio G5 - 50,00 - Junho 2026 a Abril 2027' },
  G2: { nome: 'Consorcio G2 - 25,00 - Agosto 2025 a Maio 2026', encerrado: true },
  G1: { nome: 'Consorcio G1 - 35,00 - Julho 2025 a Abril 2026', encerrado: true },
  outro: { nome: 'Outro / não lembra o grupo' },
};
const NOTAS = { 5: 'Excelente', 4: 'Muito bom', 3: 'Bom', 2: 'Regular', 1: 'Ruim' };
const RENOVA = {
  sim: 'Sim, quero garantir minha vaga no próximo consórcio',
  talvez: 'Talvez, quero saber mais antes de decidir',
  nao: 'Não vou participar desta vez',
};

const TEXTOS = {
  andamento: {
    titulo: 'Que bom ter <em>você aqui!</em>',
    lead: 'Obrigada por fazer parte do nosso consórcio. Cada parcela em dia é um voto de confiança, e a Karen agradece de coração.',
    agradece: 'Muito obrigada por estar com a gente! Seu consórcio continua normalmente até a última parcela, nada muda no que você já combinou com a Karen.',
    nota: 'Como está sendo o consórcio para você?',
  },
  encerrado: {
    titulo: 'Obrigada por <em>participar!</em>',
    lead: 'Foi um prazer ter você no nosso consórcio. Cada parcela paga foi um voto de confiança, e a Karen agradece de coração.',
    agradece: 'Muito obrigada por ter participado do consórcio da Karen Cosméticos! Sua confiança e seu carinho fizeram toda a diferença.',
    nota: 'Como foi o consórcio para você?',
  },
};

const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => {
  const d = digits(v);
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
};
const marcado = (nome) => { const r = form.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ''; };
const val = (id) => document.getElementById(id).value.trim();
const definir = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };

function aplicarTexto(grupo) {
  const t = (GRUPOS[grupo] && GRUPOS[grupo].encerrado) ? TEXTOS.encerrado : TEXTOS.andamento;
  definir('t-titulo', t.titulo); definir('t-lead', t.lead); definir('t-agradece', t.agradece);
  const n = document.getElementById('t-pergunta-nota'); if (n) n.textContent = t.nota;
}

function mostrar(texto, erro = false, waUrl = '') {
  retorno.hidden = false;
  retorno.style.color = erro ? '#a12b41' : '#276044';
  retorno.replaceChildren(document.createTextNode(texto));
  if (waUrl) {
    const a = document.createElement('a');
    a.href = waUrl; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'btn'; a.textContent = 'Enviar para a Karen no WhatsApp';
    a.style.marginTop = '12px'; a.style.display = 'flex';
    retorno.appendChild(a);
  }
}

// Link com ?g=G3 (G4, G5, G1, G2) já abre com o grupo escolhido e o texto certo.
const seletorGrupo = document.getElementById('grupo');
const grupoLink = String(new URLSearchParams(location.search).get('g') || '').toUpperCase();
if (seletorGrupo && GRUPOS[grupoLink]) seletorGrupo.value = grupoLink;
aplicarTexto(seletorGrupo ? seletorGrupo.value : '');
if (seletorGrupo) seletorGrupo.addEventListener('change', () => aplicarTexto(seletorGrupo.value));

// Grupos configurados no painel substituem a lista fixa (novos grupos aparecem sozinhos).
carregarGrupos().then((lista) => {
  const visiveis = lista.filter((g) => g.situacao !== 'formando');
  if (!visiveis.length || !seletorGrupo) return;
  visiveis.forEach((g) => { GRUPOS[g.codigo] = { nome: g.nome, encerrado: g.situacao === 'encerrado' }; });
  const escolhido = seletorGrupo.value;
  const ordem = visiveis.slice().sort((a, b) => (a.situacao === 'encerrado') - (b.situacao === 'encerrado') || String(a.inicio).localeCompare(String(b.inicio)));
  seletorGrupo.innerHTML = '<option value="">Escolha o seu grupo</option>' + ordem.map((g) =>
    '<option value="' + g.codigo + '">Consórcio ' + g.codigo + ' · ' + brl(g.valorParcela) + ' · ' + mesLongo(g.inicio) + ' a ' + mesLongo(g.fim) +
    (g.situacao === 'encerrado' ? ' (encerrado)' : '') + '</option>').join('') + '<option value="outro">Outro / não lembro</option>';
  seletorGrupo.value = GRUPOS[escolhido] ? escolhido : '';
  aplicarTexto(seletorGrupo.value);
});

if (form) form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nome = val('nome');
  const telefone = normalizeWhatsApp(val('telefone'));
  const grupo = val('grupo');
  const nota = marcado('nota');
  const renova = marcado('renova');
  const elogios = val('elogios');
  const criticas = val('criticas');
  const sugestoes = val('sugestoes');

  if (nome.length < 2 || !/^55[0-9]{10,11}$/.test(telefone)) { mostrar('Informe seu nome e um WhatsApp válido com DDD.', true); return; }
  if (!GRUPOS[grupo]) { mostrar('Escolha qual consórcio você participa.', true); return; }
  if (!NOTAS[nota]) { mostrar('Conte pra gente como está sendo o consórcio (escolha uma nota).', true); return; }
  if (!RENOVA[renova]) { mostrar('Diga se você quer participar do próximo consórcio.', true); return; }
  if (!document.getElementById('aceite').checked) { mostrar('Precisamos da sua autorização para o contato.', true); return; }

  const linhas = [
    'Grupo: ' + GRUPOS[grupo].nome,
    'Avaliação: ' + nota + '/5 (' + NOTAS[nota] + ')',
    'Renovação: ' + RENOVA[renova],
    elogios && 'O que gosta: ' + elogios,
    criticas && 'Pode melhorar: ' + criticas,
    sugestoes && 'Sugestões: ' + sugestoes,
  ].filter(Boolean);

  const mensagem = 'Olá, Karen! Aqui é ' + nome + '. Respondi o formulário do consórcio 💝\n\n' + linhas.join('\n');
  const url = 'https://wa.me/' + WHATSAPP_KAREN + '?text=' + encodeURIComponent(mensagem);

  enviar.disabled = true;
  retorno.hidden = true;
  enviar.textContent = 'Enviando…';
  const ok = await salvarLead({
    nome, whatsapp: telefone, cidade: '', equipamento: '', problema: 'Consórcio: feedback e renovação',
    detalhe: linhas.join(' | ') + ' [ref:renova-' + renova + '][nota:' + nota + '][grupo:' + grupo + ']',
    atendimento: 'WhatsApp', servico: 'Consórcio Karen',
    origem: 'consorcio-renovacao', utm: 'consorcio-renovacao',
  });
  enviar.disabled = false;
  enviar.textContent = TEXTO_BOTAO;

  if (ok) {
    const textos = {
      sim: 'Prontinho, sua vaga no próximo grupo está reservada! 💝 A Karen vai chamar você para confirmar valor e datas. Toque no botão para avisar ela agora pelo WhatsApp.',
      talvez: 'Recebemos! A Karen vai te explicar tudo com calma, sem compromisso. Toque no botão para mandar sua resposta pelo WhatsApp.',
      nao: 'Recebemos, e obrigada pela sinceridade! Você continua sendo cliente querida da Karen. Toque no botão para mandar sua resposta pelo WhatsApp.',
    };
    mostrar(textos[renova], false, url);
    form.reset();
    if (GRUPOS[grupoLink]) seletorGrupo.value = grupoLink;
    aplicarTexto(seletorGrupo.value);
  } else {
    mostrar('Não conseguimos registrar sua resposta agora. Envie pelo WhatsApp para a Karen não perder:', true, url);
  }
});
