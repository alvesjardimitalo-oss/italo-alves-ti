// Testes isolados de conversão, privacidade e integração; não acessam o Firebase de produção.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ler=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const importar=async texto=>import('data:text/javascript;base64,'+Buffer.from(texto).toString('base64'));

globalThis.location={search:'?demo',pathname:'/',origin:'https://italoinfotec.com.br'};
globalThis.document={referrer:''};
const coleta=ler('assets/js/metricas.js').replace(
  "import { FIREBASE_CONFIG } from './config.js';",
  "const FIREBASE_CONFIG = {};").replace(
  "import { iniciarAppCheck } from './app-check.js';",
  "const iniciarAppCheck = async () => {};");
const modulo=await importar(coleta);

assert.equal(modulo.tipoPagina('/'),'inicio');
assert.equal(modulo.tipoPagina('/ferramentas/upgrade.html'),'ferramentas');
assert.equal(modulo.ferramentaAtual('/ferramentas/upgrade.html'),'upgrade');
assert.equal(modulo.ferramentaAtual('/ferramentas/nao-existe.html'),'');
assert.equal(modulo.classificarCanal('?utm_source=instagram',''),'social');
assert.equal(modulo.classificarCanal('?utm_source=google',''),'busca');
assert.equal(modulo.classificarCanal('?utm_source=whatsapp',''),'whatsapp');
assert.equal(modulo.classificarCanal('',''),'direto');
assert.deepEqual(Object.keys(modulo.eventoSeguro('visita','')),['tipo','categoria','pagina','canal']);
assert.equal(modulo.eventoSeguro('evento_inventado'),null);
assert.equal(modulo.eventoSeguro('visita','telefone-33999999999-data-identificavel-ruim'),null);
assert.equal(modulo.eventoSeguro('visita','categoria livre com espaços'),null);

const analyticsSrc=ler('assets/js/views/conversoes.js')
  .replace("import { store } from '../store.js';",'const store={};')
  .replace("import { icon } from '../icons.js';",'const icon=()=>"";')
  .replace("import { esc } from '../util.js';",'const esc=String;')
  .replace("import { leadsTI } from '../loja-comum.js';",'const leadsTI=()=>[];');
const painel=await importar(analyticsSrc);
const agora=Date.now();
const data=new Date(agora-10000).toISOString(),antigo=new Date(agora-150*864e5).toISOString();
const met=[
  {tipo:'visita',criadoEm:data,canal:'social',pagina:'inicio',categoria:''},
  {tipo:'chat_aberto',criadoEm:data,canal:'social',pagina:'inicio',categoria:''},
  {tipo:'sintoma_selecionado',criadoEm:data,canal:'social',pagina:'inicio',categoria:'lento'},
  {tipo:'ferramenta_iniciada',criadoEm:data,canal:'direto',pagina:'ferramentas',categoria:'upgrade'},
  {tipo:'ferramenta_concluida',criadoEm:data,canal:'direto',pagina:'ferramentas',categoria:'upgrade'},
  {tipo:'whatsapp_aberto',criadoEm:data,canal:'social',pagina:'inicio',categoria:''},
  {tipo:'visita',criadoEm:antigo,canal:'direto',pagina:'inicio',categoria:''},
];
const leads=[
  {criadoEm:data,status:'Novo',problema:'Lento'},
  {criadoEm:data,status:'Virou cliente',problema:'Não liga'},
  {criadoEm:antigo,status:'Virou cliente',problema:'Antigo'},
];
const r=painel.calcularConversoes(met,leads,30,agora);
assert.equal(r.kpis.visita,1);
assert.equal(r.kpis.chat_aberto,1);
assert.equal(r.kpis.sintoma_selecionado,1);
assert.equal(r.kpis.ferramenta_iniciada,1);
assert.equal(r.kpis.ferramenta_concluida,1);
assert.equal(r.kpis.whatsapp_aberto,1);
assert.equal(r.kpis.pedidos,2);
assert.equal(r.kpis.clientes,1);
assert.equal(r.kpis.conversaoPedidoCliente,50);
assert.equal(r.ferramentas.find(x=>x.id==='upgrade').abertas,1);
assert.equal(r.ferramentas.find(x=>x.id==='upgrade').concluidas,1);
assert.equal(r.canais[0].chave,'social');
assert.deepEqual(painel.calcularConversoes([],[],30,agora).kpis.conversaoPedidoCliente,null);
assert.equal(painel.calcularConversoes(met,leads,0,agora).kpis.visita,2);

const site=ler('assets/js/site.js'), app=ler('assets/js/app.js'),store=ler('assets/js/store.js');
const regras=ler('firebase/regras-ti.rules');
assert(site.includes("iniciarMetricas(raiz)")&&site.includes("registrarEvento('chat_aberto')"), 'Chat não instrumentado');
assert(app.includes("'/conversoes'")&&app.includes("vConversoes.tela"),'Dashboard não roteado');
assert(store.includes("'metricasSite'"),'Assinatura das métricas ausente');
assert(regras.includes('match /ti/base/metricasSite/{eventoId}'), 'Regras de coleta não preparadas');
for(const campo of ['telefone','whatsapp','nome','mensagem','email']) {
  assert(!/request\.resource\.data\.keys\(\)\.hasOnly\(\['tipo', 'categoria', 'pagina', 'canal', 'criadoEm',/.test(regras),'Dados pessoais inesperados nas regras');
}
const politica=ler('politica-de-privacidade.html');
assert(politica.includes('Métricas de uso opcionais'),'Informação de privacidade não gerada');
console.log('OK: classificação segura, funil de conversões, privacidade, painel e regras preparadas.');
