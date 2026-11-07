// Simulador educativo de upgrade: sugere prioridades, sem prometer ganho percentual nem preço fechado.
// Nenhuma resposta é enviada ao servidor até o visitante decidir pedir orçamento.
import { enviarAoTecnico, copiar, esc, ambiente, ramTexto } from './comum.js';

const el = document.querySelector('#app-ferramenta');
const R = {};
let leitura=null;
let iniciado=false;
const PASSOS = [
  { id:'equipamento', pergunta:'Qual é o seu equipamento?', opcoes:[['Notebook','Notebook'],['Desktop','Computador de mesa'],['All-in-one','All-in-one']] },
  { id:'uso', pergunta:'Para que você mais usa?', opcoes:[['estudo','Estudos, internet e documentos'],['trabalho','Trabalho, muitas abas e reuniões'],['jogos','Jogos ou edição de vídeos'],['outro','Um pouco de tudo']] },
  { id:'disco', pergunta:'Qual armazenamento ele usa?', opcoes:[['HD','HD tradicional (mais lento)'],['SSD','SSD'],['nao-sei','Não sei identificar']] },
  { id:'ram', pergunta:'Quanto de memória RAM tem?', opcoes:[['4','Até 4 GB'],['8','8 GB'],['16','16 GB ou mais'],['nao-sei','Não sei']] },
  { id:'sintoma', pergunta:'O que mais incomoda?', opcoes:[['iniciar','Demora a ligar e abrir programas'],['multitarefa','Trava com muitos programas abertos'],['jogos','Quero melhorar jogos / edição'],['preventiva','Quero prevenir problemas']] },
];
let passo = 0;

export function recomendarUpgrade(respostas) {
  const r = respostas || {};
  const itens = [];
  if (r.disco === 'HD') itens.push({ titulo:'Avaliar troca de HD por SSD', motivo:'O SSD pode melhorar a inicialização e a abertura de programas. É preciso verificar compatibilidade e o estado do HD.' });
  if (r.ram === '4' && ['trabalho','jogos','outro'].includes(r.uso)) itens.push({ titulo:'Verificar expansão de memória RAM', motivo:'Até 4 GB costuma limitar multitarefas. Verifique a capacidade máxima e os módulos compatíveis antes de comprar.' });
  else if (r.ram === '4') itens.push({ titulo:'Avaliar RAM junto com SSD', motivo:'A RAM pode limitar o uso de várias abas e aplicativos. O benefício depende do sistema e do equipamento.' });
  else if (r.ram === '8' && (r.uso === 'jogos' || r.sintoma === 'multitarefa')) itens.push({ titulo:'Considerar 16 GB de RAM', motivo:'Pode ajudar multitarefas e alguns jogos, mas só após verificar gargalos, requisitos e compatibilidade.' });
  if (r.sintoma === 'jogos') itens.push({ titulo:'Analisar processador e placa de vídeo', motivo:'Em jogos e edição, armazenamento e RAM não resolvem todos os gargalos. Notebook pode ter limitações de upgrade.' });
  if (r.disco === 'SSD' && r.ram === '16' && r.sintoma === 'iniciar') itens.push({ titulo:'Diagnóstico antes de trocar peças', motivo:'Com SSD e RAM suficiente, lentidão pode estar ligada ao sistema, temperatura ou saúde do hardware.' });
  if (r.sintoma === 'preventiva') itens.push({ titulo:'Revisão preventiva', motivo:'Verificar ventilação, temperatura, armazenamento e backup pode ser mais útil que comprar peça sem necessidade.' });
  if (r.disco === 'nao-sei' || r.ram === 'nao-sei') itens.push({ titulo:'Identificar a configuração atual', motivo:'O modelo e as especificações são necessários para recomendar peças e evitar compras incompatíveis.' });
  if (!itens.length) itens.push({ titulo:'Avaliação de desempenho direcionada', motivo:'Vamos identificar a causa principal da lentidão antes de recomendar uma compra.' });
  return itens.slice(0, 4);
}

function desenhar() {
  if (!el||!iniciado) return;
  if (passo >= PASSOS.length) return mostrarResultado();
  const p = PASSOS[passo];
  el.innerHTML = `<div class="card"><span class="passo-ferr">etapa ${passo+1} de ${PASSOS.length}</span>
    <h2>${esc(p.pergunta)}</h2>
    <div class="opcoes-grandes">${p.opcoes.map(([v,t])=>`<button type="button" class="opc ${R[p.id]===v?'sel':''}" data-resp="${esc(v)}">${esc(t)}</button>`).join('')}</div>
    <div class="ferr-nav">${passo?'<button class="btn" id="voltar-upgrade" type="button">← Voltar</button>':'<span></span>'}
    <span class="sub">Sem cadastro. Respostas ficam só neste navegador.</span></div></div>`;
  el.querySelectorAll('[data-resp]').forEach((b)=> b.onclick=()=>{ R[p.id]=b.dataset.resp; passo++; desenhar(); });
  el.querySelector('#voltar-upgrade')?.addEventListener('click',()=>{passo--;desenhar();});
}

function mostrarResultado() {
  window.MetricasSite?.registrar('ferramenta_concluida', 'upgrade');
  const itens = recomendarUpgrade(R);
  const resumo = `Equipamento: ${R.equipamento}; uso: ${R.uso}; armazenamento declarado: ${R.disco}; RAM declarada: ${R.ram}; principal necessidade: ${R.sintoma}. ${leitura ? 'Navegador: '+leitura.soTexto+'; '+leitura.nucleos+' processadores lógicos; RAM estimada '+ramTexto(leitura.ramGB)+'. ' : ''}Sugestões: ${itens.map(i=>i.titulo).join('; ')}.`;
  el.innerHTML = `<div class="card">
    <span class="passo-ferr">seu resultado</span><h2>O upgrade que faz mais sentido investigar</h2>
    <p class="sub">Estas são prioridades iniciais, não uma lista de peças garantidamente compatíveis.</p>
    <div class="upgrade-recos">${itens.map((i,n)=>`<div class="upgrade-reco"><span class="upgrade-num">${n+1}</span><div><h3>${esc(i.titulo)}</h3><p>${esc(i.motivo)}</p></div></div>`).join('')}</div>
    <p class="sub">Para orçamento e peças compatíveis, confirme o modelo do aparelho e faça avaliação técnica. Nenhuma compra é necessária para usar esta ferramenta.</p>
    <div class="ferr-nav"><button type="button" class="btn" id="refazer-upgrade">Refazer análise</button>
    <button type="button" class="btn" id="copiar-upgrade">Copiar resultado</button>
    <button type="button" class="btn btn-pri" id="pedir-upgrade">Pedir avaliação de upgrade</button></div>
  </div>`;
  el.querySelector('#refazer-upgrade').onclick=()=>{passo=0;Object.keys(R).forEach(k=>delete R[k]);desenhar();};
  el.querySelector('#copiar-upgrade').onclick=(e)=>copiar(resumo,e.currentTarget);
  el.querySelector('#pedir-upgrade').onclick=()=>enviarAoTecnico({
    servico:'Upgrade ou montagem',equipamento:R.equipamento,problema:'Avaliar upgrade de SSD e memória',
    detalhe:resumo.slice(0,900),
  });
}
el.innerHTML='<div class="card"><h2>É este o computador do upgrade?</h2><p class="sub">Se quiser, o navegador informa dados gerais do aparelho. Modelo de CPU, SSD e compatibilidade precisam ser confirmados.</p><div class="ferr-nav"><button class="btn btn-pri" id="upgrade-identificar">Sim, identificar</button><button class="btn" id="upgrade-outro">É outro aparelho</button></div></div>';
el.querySelector('#upgrade-outro').onclick=()=>{iniciado=true;desenhar();};
el.querySelector('#upgrade-identificar').onclick=async()=>{el.querySelector('#upgrade-identificar').disabled=true;try{leitura=await ambiente();}catch(e){}iniciado=true;desenhar();};
