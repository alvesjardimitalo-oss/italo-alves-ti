// Jornadas comerciais Ítalo InfoTec: nenhuma solicitação equivale a agendamento confirmado.
import { SITE } from './site-config.js';
import { salvarLead } from './leads.js';
import { CATEGORIAS, sintomasPorCategoria, orientarSintoma } from './alvesinho-conhecimento.js';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const body = document.body;
const tipo = body.dataset.jornada;
const moeda = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(n);
const formataData = d => { const [ano,mes,dia] = d.split('-');return dia+'/'+mes+'/'+ano; };
function texto(el, value){ if(el) el.textContent=String(value); }
function mostrarErro(msg){ const e=$('[data-erro]');if(e){texto(e,msg);e.hidden=!msg;}}
function whatsapp(msg){return 'https://wa.me/'+SITE.whatsapp+'?text='+encodeURIComponent(msg);}
function abrirChat(codigo){
  const btn = $('[data-abrir-chat]');
  if(btn){btn.dataset.servico=codigo;btn.click();return true;}
  return false;
}
function valor(id){return ($('#'+id)?.value||'').trim();}
function nomeOk(n){return n.length>=2&&n.length<=80;}
function telefoneOk(n){return n.replace(/\D/g,'').length>=10&&n.replace(/\D/g,'').length<=13;}
function tratarContato(){
 const nome=valor('j-nome'), tel=valor('j-telefone'),cidade=valor('j-cidade');
 if(!nomeOk(nome)){mostrarErro('Informe seu nome (pelo menos 2 letras).');$('#j-nome')?.focus();return null;}
 if(!telefoneOk(tel)){mostrarErro('Informe WhatsApp com DDD válido.');$('#j-telefone')?.focus();return null;}
 const aceite=$('#j-aceite');if(aceite&&!aceite.checked){mostrarErro('Marque a confirmação de leitura da política de privacidade.');aceite.focus();return null;}
 mostrarErro('');
 return {nome,whatsapp:tel.replace(/\D/g,''),cidade:cidade.slice(0,80)};
}
async function enviarPedido({contato,servico,equipamento,problema,detalhe,atendimento}){
 const btn=$('[data-enviar]');if(btn){btn.disabled=true;btn.textContent='Preparando solicitação...';}
 let gravado=false;
 try{
   gravado=await salvarLead({...contato,equipamento,problema,detalhe,atendimento,servico,origem:location.pathname,utm:new URLSearchParams(location.search).get('utm_source')||''});
 }catch(e){gravado=false;}
 const msg=[
 'Olá! Vim pelo site da Ítalo InfoTec.',
 '*Solicitação:* '+servico,
 '*Nome:* '+contato.nome,
 '*Cidade:* '+(contato.cidade||'Não informada'),
 '*WhatsApp:* '+contato.whatsapp,
 '*Equipamento:* '+(equipamento||'Não informado'),
 '*Assunto:* '+(problema||'Não informado'),
 '*Detalhes:* '+detalhe,
 '',
 'Aguardo seu retorno para combinarmos os detalhes.'
 ].join('\n');
 const result=$('[data-envio-resultado]');
 if(result){
   result.hidden=false;
   result.replaceChildren();
   const h=document.createElement('h3');h.textContent=gravado?'Solicitação recebida':'Falta enviar pelo WhatsApp';
   const p=document.createElement('p');p.textContent=gravado?'Recebemos sua solicitação. Se for um plano mensal, enviaremos a proposta e o contrato para análise antes de qualquer cobrança ou ativação.':'Não consegui confirmar o registro pelo site. Envie a mensagem no WhatsApp para eu receber seu pedido.';
   const a=document.createElement('a');a.className='btn btn-pri';a.href=whatsapp(msg);a.target='_blank';a.rel='noopener noreferrer';a.textContent='Enviar detalhes pelo WhatsApp';
   result.append(h,p,a);
   result.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 if(btn){btn.disabled=false;btn.textContent='Reenviar solicitação';}
}

function iniciarDiagnostico(){
 const categoria=$('#j-categoria'), sintoma=$('#j-sintoma'), res=$('[data-diagnostico-resultado]'),equip=$('#j-equipamento');
 for(const c of CATEGORIAS){const o=document.createElement('option');o.value=c.id;o.textContent=c.titulo;categoria.append(o);}
 function atualizar(){sintoma.replaceChildren();for(const s of sintomasPorCategoria(categoria.value)){const o=document.createElement('option');o.value=s.id;o.textContent=s.titulo;sintoma.append(o);}}
 categoria.addEventListener('change',atualizar);categoria.selectedIndex=0;atualizar();
 $('#j-analisar')?.addEventListener('click',()=>{
   const relato=valor('j-relato');
   const categoriaItem=sintomasPorCategoria(categoria.value).find(x=>x.id===sintoma.value);
   const info=orientarSintoma(relato.length>=5?relato:categoriaItem);
   res.hidden=false;
   texto($('[data-diag-titulo]'),info.titulo);
   texto($('[data-diag-causa]'),info.possiveis);
   texto($('[data-diag-passo]'),info.passo);
   texto($('[data-diag-alerta]'),info.alerta?'Atenção: não continue usando o equipamento se houver risco elétrico, líquido ou bateria danificada.':'Orientação preliminar: o diagnóstico real depende de testes técnicos.');
   const link=$('[data-diag-artigo]');
   if(link){link.hidden=!info.dica;if(info.dica)link.href='../'+info.dica;}
   const submit=$('[data-pedir-diagnostico]');
   if(submit)submit.onclick=()=>abrirChat('Diagnóstico por sintomas');
   res.scrollIntoView({behavior:'smooth',block:'nearest'});
 });
}

function iniciarAgendamento(){
 const data=$('#j-data'), now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
 if(data)data.min=local.toISOString().slice(0,10);
 const form=$('#j-form');
 form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const contato=tratarContato();if(!contato)return;
  const dia=valor('j-data'),horario=valor('j-hora'),modo=valor('j-modo'),detalhes=valor('j-detalhe'),equip=valor('j-equipamento');
  if(!dia||!horario){mostrarErro('Escolha uma data e uma faixa de horário.');return;}
  const dataEscolhida=new Date(dia+'T12:00:00');
  const hoje=new Date();hoje.setHours(0,0,0,0);
  if(!Number.isFinite(dataEscolhida.getTime())||dataEscolhida<hoje){mostrarErro('Escolha uma data de hoje em diante.');return;}
  const resumo='Data desejada: '+formataData(dia)+'; período: '+horario+'; modalidade: '+modo+'; relato: '+detalhes.slice(0,450);
  await enviarPedido({contato,servico:'Solicitação de agendamento',equipamento:equip,problema:'Agendar atendimento',detalhe:resumo.slice(0,1500),atendimento:modo});
 });
}

const SERVICOS = [
 {id:'avaliacao',nome:'Avaliação inicial',min:60,max:140,observacao:'Valor de exemplo, sujeito à avaliação.'},
 {id:'limpeza',nome:'Limpeza e revisão térmica',min:140,max:280,observacao:'Dependente de modelo e condições.'},
 {id:'sistema',nome:'Reinstalação/configuração de sistema',min:160,max:320,observacao:'Não inclui licenças, backup complexo ou peças.'},
 {id:'ssd',nome:'Instalação de SSD (mão de obra)',min:90,max:210,observacao:'SSD e eventual adaptação cobrados à parte.'},
 {id:'memoria',nome:'Upgrade de RAM (mão de obra)',min:70,max:170,observacao:'Memória não incluída.'},
 {id:'tela',nome:'Troca de tela (mão de obra)',min:130,max:290,observacao:'Painel novo cobrado à parte.'},
 {id:'software',nome:'Remoção de programas indesejados',min:100,max:240,observacao:'Procedimento depende do estado do sistema.'}
];
function iniciarEstimativa(){
 const lista=$('[data-estimativa-itens]'), res=$('[data-estimativa-resultado]');
 for(const s of SERVICOS){
   const label=document.createElement('label');label.className='jornada-choice';
   const box=document.createElement('input');box.type='checkbox';box.value=s.id;box.name='servico';box.style.marginRight='8px';
   const head=document.createElement('b');head.append(box,document.createTextNode(s.nome));
   const sub=document.createElement('span');sub.textContent='Simulação: '+moeda(s.min)+' a '+moeda(s.max);
   label.append(head,sub);lista.append(label);
   box.addEventListener('change',()=>label.classList.toggle('is-active',box.checked));
 }
 $('#j-calcular')?.addEventListener('click',()=>{
   const ids=$$('input[name="servico"]:checked',lista).map(x=>x.value);
   const selecionados=SERVICOS.filter(s=>ids.includes(s.id));
   if(!selecionados.length){mostrarErro('Selecione pelo menos um serviço.');return;}
   mostrarErro('');
   const lo=selecionados.reduce((x,s)=>x+s.min,0), hi=selecionados.reduce((x,s)=>x+s.max,0);
   const extra=valor('j-pecas'),pecas=extra===''?0:Number(extra.replace(',','.'));
   if(!Number.isFinite(pecas)||pecas<0||pecas>50000){mostrarErro('Informe um valor de peças válido ou deixe em branco.');return;}
   res.hidden=false;
   texto($('[data-estimativa-valor]'),moeda(lo+pecas)+' — '+moeda(hi+pecas));
   texto($('[data-estimativa-detalhes]'),selecionados.map(s=>s.nome+': '+moeda(s.min)+' a '+moeda(s.max)).join(' · '));
   texto($('[data-estimativa-peças]'),pecas>0?'Peças informadas por você: '+moeda(pecas):'Peças, licenças e problemas não identificados não estão incluídos.');
   const link=$('[data-estimativa-whatsapp]');
   link.href=whatsapp('Olá! Fiz uma simulação no site para '+valor('j-equipamento')+'. Serviços: '+selecionados.map(s=>s.nome).join(', ')+'. Faixa ilustrativa: '+moeda(lo+pecas)+' a '+moeda(hi+pecas)+'. Gostaria de um orçamento após avaliação.');
   res.scrollIntoView({behavior:'smooth',block:'nearest'});
 });
}

const PLANOS={
 essencial:{titulo:'Essencial — até 5 máquinas',min:1,max:5,visitas:'1 visita presencial e 1 ciclo de coleta/devolução mensal',itens:['Cobertura de 1 a 5 computadores ou notebooks cadastrados','Uma visita preventiva presencial por mês na empresa','Até 1 ciclo de retirada e devolução de um equipamento por mês','Registro individual das intervenções e ordens de serviço','Verificações de desempenho, armazenamento, segurança e ventilação conforme necessidade','Garantia de 90 dias sobre os serviços efetivamente executados e registrados']},
 profissional:{titulo:'Profissional — 6 a 15 máquinas',min:6,max:15,visitas:'2 visitas presenciais e 2 ciclos de coleta/devolução mensais',itens:['Cobertura de 6 a 15 computadores ou notebooks cadastrados','Duas visitas preventivas presenciais por mês','Até 2 ciclos de retirada e devolução, um equipamento por ciclo','Registro de chamados e histórico de manutenção por equipamento','Orientações de backup, segurança, rede e atualizações conforme escopo','Garantia de 90 dias dos serviços executados, registrada por ordem de serviço']},
 empresa:{titulo:'Empresarial — 16 a 30 máquinas',min:16,max:30,visitas:'Visitas conforme proposta e 3 ciclos de coleta/devolução mensais',itens:['Cobertura de 16 a 30 computadores ou notebooks cadastrados','Visitas presenciais planejadas com a empresa','Até 3 ciclos de retirada e devolução, um equipamento por ciclo','Inventário, histórico por máquina e acompanhamento de chamados','Registro das ordens de serviço, ocorrências, recomendações e conclusão','Garantia de 90 dias sobre os serviços executados, documentada por OS']},
 personalizado:{titulo:'Personalizado — acima de 30 máquinas',min:31,max:2000,visitas:'Cronograma sob avaliação',itens:['Para mais de 30 máquinas, é preciso avaliar distribuição, localização e criticidade','Atendimento presencial e transporte definidos em proposta personalizada','Inventário, acompanhamento por equipamento e registro de intervenções','Garantias dos serviços executados documentadas em cada OS','Limites, disponibilidade, prazo de resposta e mensalidade definidos em proposta']}
};
// Preços iniciais de referência em reais, para contratos mensais sem infraestrutura especial.
function cotarPlano(id,quantidade){
 if(id==='personalizado')return null;
 const politica={
  essencial:{unitario:119,minimo:499,ciclos:1},
  profissional:{unitario:109,minimo:890,ciclos:2},
  empresa:{unitario:99,minimo:1890,ciclos:3}
 }[id];
 return politica?{...politica,total:Math.max(politica.minimo,politica.unitario*quantidade)}:null;
}
function iniciarPlanos(){
 const box=$('[data-plano-resumo]'),quantidade=$('#j-quantidade'),faixa=$('[data-plano-faixa]');
 let escolhido='essencial';
 const recomendado=q=>q>30?'personalizado':q>=16?'empresa':q>=6?'profissional':'essencial';
 function render(){
  const p=PLANOS[escolhido];
  texto($('[data-plano-titulo]'),p.titulo);
  const q=Number(quantidade.value);
  const estimativa=Number.isInteger(q)&&q>=1&&q<=2000?cotarPlano(escolhido,q):null;
  texto($('[data-plano-preco]'),estimativa?moeda(estimativa.total)+'/mês':'Valor sob consulta');
  texto($('[data-plano-calculo]'),estimativa?(q+' '+(q===1?'máquina':'máquinas')+' × '+moeda(estimativa.unitario)+' · mínimo de '+moeda(estimativa.minimo)+' · '+estimativa.ciclos+' ciclos de coleta/devolução incluídos'):'Mais de 30 máquinas: avaliação e proposta personalizada.');
  box.replaceChildren();
  for(const item of p.itens){const li=document.createElement('li');li.textContent=item;box.append(li);}
  $$('[data-plano]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.plano===escolhido));b.classList.toggle('is-active',b.dataset.plano===escolhido);});
  if(Number.isInteger(q)&&q>=1&&q<=2000){
   const ideal=recomendado(q);
   texto(faixa,ideal==='personalizado'?'Acima de 30 máquinas: orçamento personalizado.':('Para '+q+' '+(q===1?'máquina':'máquinas')+', a faixa indicada é '+PLANOS[ideal].titulo+'.'));
  }
 }
 $$('[data-plano]').forEach(b=>b.addEventListener('click',()=>{
  escolhido=b.dataset.plano;
  quantidade.value=String(PLANOS[escolhido].min);
  render();
 }));
 quantidade?.addEventListener('input',()=>{
  const q=Number(quantidade.value);
  if(Number.isInteger(q)&&q>=1&&q<=2000)escolhido=recomendado(q);
  render();
 });
 render();
 $('#j-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const qtd=Number(valor('j-quantidade'));
  if(!Number.isInteger(qtd)||qtd<1||qtd>2000){mostrarErro('Informe a quantidade de computadores ou notebooks, entre 1 e 2000.');quantidade.focus();return;}
  const ideal=recomendado(qtd);
  if(ideal!==escolhido){escolhido=ideal;render();}
  const empresa=valor('j-empresa');
  if(empresa.length<2){mostrarErro('Informe o nome da empresa.');$('#j-empresa').focus();return;}
  const ciente=$('#j-condicoes');if(ciente&&!ciente.checked){mostrarErro('Confirme que deseja receber a proposta e o contrato para análise.');ciente.focus();return;}
  const contato=tratarContato();if(!contato)return;
  const relato=valor('j-detalhe'),frequencia=valor('j-frequencia'),suporte=valor('j-suporte'),preco=cotarPlano(ideal,qtd);
  const referencia=preco?moeda(preco.total)+'/mês (estimativa)':'sob consulta';
  await enviarPedido({contato,servico:'Solicitação de contratação mensal',equipamento:'Computadores e notebooks',problema:PLANOS[ideal].titulo,detalhe:('Empresa: '+empresa+'; Plano: '+PLANOS[ideal].titulo+'; Máquinas: '+qtd+'; Mensalidade estimada: '+referencia+'; Periodicidade prevista: '+PLANOS[ideal].visitas+'; Visitas desejadas: '+frequencia+'; Suporte: '+suporte+'; Histórico por máquina e OS: previsto; Garantia dos serviços: 90 dias conforme política e OS; Atendimento presencial na empresa; logística de coleta e devolução incluída dentro do limite mensal do plano e da área urbana; peças não incluídas; reparos extras sob orçamento; contratação depende de proposta e assinatura; Necessidade: '+relato).slice(0,1500),atendimento:'Contratação pendente de proposta e assinatura'});
 });
}

function iniciarAvaliacaoEmpresarial(){
 const form=$('#j-form');if(!form)return;
 exibirAnalisePendente();
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const empresa=valor('j-empresa');
  if(empresa.length<2||empresa.length>100){mostrarErro('Informe o nome da empresa.');$('#j-empresa').focus();return;}
  const qtd=Number(valor('j-quantidade'));
  if(!Number.isInteger(qtd)||qtd<1||qtd>2000){mostrarErro('Informe a quantidade de equipamentos (entre 1 e 2000).');$('#j-quantidade').focus();return;}
  const contato=tratarContato();if(!contato)return;
  const setor=valor('j-segmento'),prioridade=valor('j-prioridade'),relato=valor('j-detalhe');
  const resumo=('Empresa: '+empresa+'; Setor: '+setor+'; Quantidade: '+qtd+'; Principal dificuldade: '+prioridade+'; Detalhes: '+relato+'; Cliente deseja avaliação inicial e eventual visita, sujeita a confirmação prévia de disponibilidade e valores.').slice(0,1500);
  await enviarPedido({contato,servico:'Avaliação inicial empresarial',equipamento:'Computadores e notebooks',problema:prioridade,detalhe:resumo,atendimento:'Visita na empresa sob confirmação'});
 });
}


function exibirAnalisePendente(){
 let item=null;try{item=JSON.parse(sessionStorage.getItem('italoti-analise-pendente')||'null');}catch(e){}
 const area=$('#analise-recebida');if(!area)return;
 if(!item||!item.relatorio||item.validade<Date.now()){try{sessionStorage.removeItem('italoti-analise-pendente')}catch(e){}return;}
 area.hidden=false;texto($('#analise-resumo-previo'),String(item.relatorio).slice(0,1450));
 $('#descartar-analise')?.addEventListener('click',()=>{area.hidden=true;$('#incluir-analise').checked=false;try{sessionStorage.removeItem('italoti-analise-pendente')}catch(e){}});
}
function iniciarAtendimentoPessoal(){
 const form=$('#j-form');if(!form)return;
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const contato=tratarContato();if(!contato)return;
  const equipamento=valor('j-equipamento'),problema=valor('j-prioridade'),atendimento=valor('j-atendimento'),relato=valor('j-detalhe');
  if(!equipamento||!problema||!atendimento){mostrarErro('Escolha o equipamento, o problema e a forma de atendimento.');return;}
  const identificado=$('#identificacao-pessoal')?.dataset.relatorio||'';
  const incluir=$('#incluir-analise')?.checked;
  let resumoAnterior='';
  try{const item=JSON.parse(sessionStorage.getItem('italoti-analise-pendente')||'null');if(incluir&&item&&item.validade>Date.now())resumoAnterior=String(item.relatorio||'').slice(0,850);}catch(e){}
  const partes=['Sintoma: '+problema,'Preferência: '+atendimento,'Relato: '+relato];
  if(resumoAnterior)partes.push('Análise orientativa autorizada: '+resumoAnterior);
  if(identificado)partes.push('Dados do aparelho autorizados: '+identificado);
  partes.push('Orçamento sujeito a avaliação e aprovação.');
  const detalhe=partes.join('; ').slice(0,1500);
  await enviarPedido({contato,servico:'Atendimento pessoa física',equipamento,problema,detalhe,atendimento});
 });
}

if(tipo==='atendimento-pessoal')iniciarAtendimentoPessoal();
if(tipo==='avaliacao-empresa')iniciarAvaliacaoEmpresarial();
if(tipo==='diagnostico')iniciarDiagnostico();
if(tipo==='agendar')iniciarAgendamento();
if(tipo==='estimativa')iniciarEstimativa();
if(tipo==='planos')iniciarPlanos();
