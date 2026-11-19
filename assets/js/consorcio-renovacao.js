// Feedback e renovação do consórcio da Karen Cosméticos.
// Página acessível só pelo link enviado às participantes (noindex, fora do sitemap e dos menus).
// A resposta é gravada em ti/base/leads (origem "consorcio-renovacao", aparece no painel em
// Loja da Karen › Consórcio) e enviada para o WhatsApp da Karen.
import { salvarLead } from './leads.js';

const WHATSAPP_KAREN = '5533999628147';
const form = document.getElementById('form-renovacao');
const retorno = document.getElementById('retorno');
const enviar = document.getElementById('enviar');
const TEXTO_BOTAO = enviar ? enviar.textContent : '';

const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => {
  const d = digits(v);
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
};
const NOTAS = { 5: 'Excelente', 4: 'Muito bom', 3: 'Bom', 2: 'Regular', 1: 'Ruim' };
const RENOVA = { sim: 'Sim, quero participar do novo consórcio', nao: 'Não vou participar desta vez' };
const marcado = (nome) => { const r = form.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ''; };
const val = (id) => document.getElementById(id).value.trim();

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

if (form) form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const nome = val('nome');
  const telefone = normalizeWhatsApp(val('telefone'));
  const nota = marcado('nota');
  const renova = marcado('renova');
  const elogios = val('elogios');
  const criticas = val('criticas');
  const sugestoes = val('sugestoes');

  if (nome.length < 2 || !/^55[0-9]{10,11}$/.test(telefone)) { mostrar('Informe seu nome e um WhatsApp válido com DDD.', true); return; }
  if (!NOTAS[nota]) { mostrar('Conte pra gente como foi o consórcio (escolha uma nota).', true); return; }
  if (!RENOVA[renova]) { mostrar('Diga se você deseja participar do novo consórcio.', true); return; }
  if (!document.getElementById('aceite').checked) { mostrar('Precisamos da sua autorização para o contato.', true); return; }

  const linhas = [
    'Avaliação: ' + nota + '/5 (' + NOTAS[nota] + ')',
    'Renovação: ' + RENOVA[renova],
    elogios && 'O que gostou: ' + elogios,
    criticas && 'Críticas: ' + criticas,
    sugestoes && 'Sugestões: ' + sugestoes,
  ].filter(Boolean);

  const mensagem = 'Olá, Karen! Aqui é ' + nome + '. Respondi o formulário do consórcio 💝\n\n' + linhas.join('\n');
  const url = 'https://wa.me/' + WHATSAPP_KAREN + '?text=' + encodeURIComponent(mensagem);

  enviar.disabled = true;
  retorno.hidden = true;
  enviar.textContent = 'Enviando…';
  const ok = await salvarLead({
    nome, whatsapp: telefone, cidade: '', equipamento: '', problema: 'Consórcio: feedback e renovação',
    detalhe: linhas.join(' | ') + ' [ref:renova-' + renova + '][nota:' + nota + ']',
    atendimento: 'WhatsApp', servico: 'Consórcio Karen',
    origem: 'consorcio-renovacao', utm: 'consorcio-renovacao',
  });
  enviar.disabled = false;
  enviar.textContent = TEXTO_BOTAO;

  if (ok) {
    mostrar(renova === 'sim'
      ? 'Resposta registrada! Obrigada por continuar com a gente. Agora toque no botão para enviar também pelo WhatsApp.'
      : 'Resposta registrada! Obrigada por ter participado. Toque no botão para enviar também pelo WhatsApp.', false, url);
    form.reset();
  } else {
    mostrar('Não conseguimos registrar sua resposta agora. Envie pelo WhatsApp para a Karen não perder:', true, url);
  }
});
