// Banco de reserva do consórcio da Karen Cosméticos (/karen/consorcio/).
// Qualquer pessoa entra na lista de espera do próximo grupo. A reserva é gravada em
// ti/base/leads (origem "consorcio-reserva", painel › Loja da Karen › Consórcio)
// e enviada para o WhatsApp da Karen. Não gera cobrança.
import { salvarLead } from './leads.js';
import { carregarGrupos, mesLongo, brl } from './consorcio-publico.js';

const WHATSAPP_KAREN = '5533999628147';
const form = document.getElementById('form-reserva');
const retorno = document.getElementById('retorno');
const enviar = document.getElementById('enviar');
const TEXTO_BOTAO = enviar ? enviar.textContent : '';

const VALORES = { 25: 'R$ 25,00 por mês', 35: 'R$ 35,00 por mês', 50: 'R$ 50,00 por mês', outro: 'Outro valor (combinar)' };
const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => {
  const d = digits(v);
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
};
const marcado = (nome) => { const r = form.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : ''; };
const val = (id) => document.getElementById(id).value.trim();

// Indicação pelo link: /karen/consorcio/?ind=Maria
const indLink = String(new URLSearchParams(location.search).get('ind') || '').trim().slice(0, 60);
if (indLink && document.getElementById('indicacao')) document.getElementById('indicacao').value = indLink;

// Se o painel já tiver um próximo grupo em formação, mostra os dados dele.
carregarGrupos().then((lista) => {
  const prox = lista.filter((g) => g.situacao === 'formando').sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)))[0];
  const alvo = document.getElementById('proximo-grupo');
  if (!prox || !alvo) return;
  const livres = prox.vagas ? Math.max(0, prox.vagas - prox.ocupadas) : 0;
  alvo.innerHTML = '<b>Próximo grupo: ' + prox.codigo + '</b><p>' + brl(prox.valorParcela) + ' por mês, em ' + prox.parcelas + ' parcelas, começando em ' + mesLongo(prox.inicio) +
    '. Prêmio de ' + brl(prox.premio) + ' em produtos.' + (prox.vagas ? (livres ? ' Restam ' + livres + ' vaga(s)!' : ' Vagas preenchidas: sua reserva entra na lista de espera.') : '') + '</p>';
  alvo.hidden = false;
});

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
  const cidade = val('cidade');
  const valor = marcado('valor');
  const ja = marcado('ja');
  const indicacao = val('indicacao');
  const obs = val('observacao');

  if (nome.length < 2 || !/^55[0-9]{10,11}$/.test(telefone)) { mostrar('Informe seu nome e um WhatsApp válido com DDD.', true); return; }
  if (!VALORES[valor]) { mostrar('Escolha o valor de parcela que cabe melhor para você.', true); return; }
  if (!ja) { mostrar('Conte se você já participou de algum consórcio da Karen.', true); return; }
  if (!document.getElementById('aceite').checked) { mostrar('Precisamos da sua autorização para o contato.', true); return; }

  const linhas = [
    'Parcela desejada: ' + VALORES[valor],
    'Já participou: ' + (ja === 'sim' ? 'Sim' : 'Não, primeira vez'),
    cidade && 'Cidade: ' + cidade,
    indicacao && 'Indicação: ' + indicacao,
    obs && 'Observação: ' + obs,
  ].filter(Boolean);
  const mensagem = 'Olá, Karen! Aqui é ' + nome + '. Quero reservar minha vaga no próximo consórcio 💝\n\n' + linhas.join('\n');
  const url = 'https://wa.me/' + WHATSAPP_KAREN + '?text=' + encodeURIComponent(mensagem);

  enviar.disabled = true;
  retorno.hidden = true;
  enviar.textContent = 'Enviando…';
  const ok = await salvarLead({
    nome, whatsapp: telefone, cidade, equipamento: '', problema: 'Consórcio: reserva de vaga',
    detalhe: linhas.join(' | ') + ' [valor:' + valor + '][ja:' + ja + ']',
    atendimento: 'WhatsApp', servico: 'Consórcio Karen',
    origem: 'consorcio-reserva', utm: indicacao ? 'consorcio-indicacao' : 'consorcio-reserva',
    indicacao,
  });
  enviar.disabled = false;
  enviar.textContent = TEXTO_BOTAO;

  if (ok) {
    mostrar('Prontinho, ' + nome.split(' ')[0] + '! Você está no banco de reserva do próximo grupo 💝 A Karen chama você assim que o grupo abrir. Toque no botão para avisar ela agora pelo WhatsApp.', false, url);
    form.reset();
    if (indLink) document.getElementById('indicacao').value = indLink;
  } else {
    mostrar('Não conseguimos registrar sua reserva agora. Envie pelo WhatsApp para a Karen não perder:', true, url);
  }
});
