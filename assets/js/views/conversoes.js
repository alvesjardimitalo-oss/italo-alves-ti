// Painel de conversões. Visitas são sessões com consentimento; pedidos vêm da coleção real de leads.
// Sem taxas falsas: os contadores não identificam pessoas nem vinculam sessões a pedidos.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';

const TIPOS = {
  visita:'Sessões monitoradas', chat_aberto:'Conversas iniciadas',
  sintoma_selecionado:'Sintomas explorados', ferramenta_iniciada:'Ferramentas abertas',
  ferramenta_concluida:'Ferramentas concluídas', whatsapp_aberto:'Cliques para WhatsApp',
};
const CANAIS = { social:'Redes sociais', whatsapp:'WhatsApp', busca:'Buscadores', email:'E-mail', referencia:'Outros sites', direto:'Direto / não identificado' };
const FERRAMENTAS = { checkup:'Check-up do computador',upgrade:'Simulador de upgrade','consertar-ou-trocar':'Consertar ou trocar?','monte-seu-pc':'Monte seu PC',velocidade:'Teste de velocidade',testes:'Teclado, tela e som' };
const PAGINAS = { inicio:'Página inicial',ferramentas:'Ferramentas',dicas:'Dicas',atendimento:'Atendimento',acompanhar:'Acompanhar OS',institucional:'Outras páginas' };
const DATA = (v) => {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.getTime() : 0;
};
const contar = (lista,tipo) => lista.filter(x=>x.tipo===tipo).length;
const agrupado = (lista,chave) => {
  const mapa = new Map();
  lista.forEach(e=>mapa.set(e[chave]||'sem-info',(mapa.get(e[chave]||'sem-info')||0)+1));
  return [...mapa.entries()].sort((a,b)=>b[1]-a[1]);
};
const numero = n => Number(n||0).toLocaleString('pt-BR');
const dia = ts => new Date(ts).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit'});
const chaveDia = ts => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ts));

export function calcularConversoes(metricas, leads, dias=30, agora=Date.now()) {
  const limite = dias>0 ? agora - dias*864e5 : 0;
  const evento = (metricas||[]).filter(x=>DATA(x.criadoEm)>=limite && DATA(x.criadoEm)<=agora);
  const pedidos = (leads||[]).filter(x=>DATA(x.criadoEm)>=limite && DATA(x.criadoEm)<=agora);
  const kpis = Object.fromEntries(Object.keys(TIPOS).map(k=>[k,contar(evento,k)]));
  kpis.pedidos = pedidos.length;
  kpis.clientes = pedidos.filter(l=>l.status==='Virou cliente').length;
  kpis.conversaoPedidoCliente = pedidos.length ? Math.round(kpis.clientes*100/pedidos.length) : null;
  const datas = new Map();
  const somar = (ts, campo) => {
    const d = DATA(ts); if(!d)return;
    const chave=chaveDia(d);
    const linha=datas.get(chave)||{dia:chave,visitas:0,chats:0,pedidos:0,whatsapp:0};
    linha[campo]++;
    datas.set(chave,linha);
  };
  evento.forEach(x=>{ if(x.tipo==='visita')somar(x.criadoEm,'visitas'); if(x.tipo==='chat_aberto')somar(x.criadoEm,'chats'); if(x.tipo==='whatsapp_aberto')somar(x.criadoEm,'whatsapp'); });
  pedidos.forEach(x=>somar(x.criadoEm,'pedidos'));
  const historico=[...datas.values()].sort((a,b)=>a.dia.localeCompare(b.dia)).slice(-31);
  const ferramentas = FERRAMENTAS ? Object.entries(FERRAMENTAS).map(([key,nome])=>({
    id:key,nome,abertas:evento.filter(x=>x.tipo==='ferramenta_iniciada'&&x.categoria===key).length,
    concluidas:evento.filter(x=>x.tipo==='ferramenta_concluida'&&x.categoria===key).length,
  })).sort((a,b)=>b.abertas-a.abertas):[];
  const canais = agrupado(evento.filter(x=>x.tipo==='visita'),'canal').map(([chave,valor])=>({chave,nome:CANAIS[chave]||'Não identificado',valor}));
  const sintomas = agrupado(evento.filter(x=>x.tipo==='sintoma_selecionado'),'categoria').slice(0,8);
  const paginas = agrupado(evento.filter(x=>x.tipo==='visita'),'pagina').map(([key,valor])=>({nome:PAGINAS[key]||'Outras',valor}));
  const assuntos = agrupado(pedidos.map(x=>({problema:String(x.problema||'Não informado').slice(0,60)})),'problema').slice(0,6);
  return { kpis,historico,ferramentas,canais,sintomas,paginas,assuntos,temEventos:evento.length>0 };
}

function coluna(nome,valor,max) {
  const pct=max>0?Math.max(3,Math.round(valor/max*100)):0;
  return `<div class="conv-barra"><span>${esc(nome)}</span><div class="conv-trilho"><i style="width:${pct}%"></i></div><b>${numero(valor)}</b></div>`;
}

function exportarCSV(resumo) {
  const linhas=['Dia;Sessoes monitoradas;Conversas;Pedidos;Cliques WhatsApp',...resumo.historico.map(x=>[x.dia,x.visitas,x.chats,x.pedidos,x.whatsapp].join(';'))];
  const blob=new Blob(['\uFEFF'+linhas.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='italoinfotec-conversoes.csv';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

export function tela(el) {
  let dias=30;
  el.innerHTML=`<div class="page-head">
    <div><div class="crumb">${icon('dashboard',14)} marketing / conversões</div>
    <h1>Conversões do site</h1><p>O que desperta interesse e quantos pedidos realmente chegam.</p></div>
    <div class="acoes"><select class="conv-periodo" id="conv-periodo" aria-label="Período"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="0">Todo o período</option></select><button class="btn" id="conv-exportar" type="button">${icon('receipt',16)} Exportar CSV</button></div>
    </div>
    <div class="conv-aviso" id="conv-aviso"></div>
    <div id="conv-kpis"></div><div id="conv-corpo"></div>`;

  let ultimo=null;
  const render=()=>{
    const dados=calcularConversoes(store.lista('metricasSite'),store.lista('leads'),dias);
    ultimo=dados;
    const k=dados.kpis;
    const card=(titulo,valor,sub)=>`<div class="kpi"><div class="kpi-top">${esc(titulo)}</div><div class="kpi-val">${valor}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
    el.querySelector('#conv-aviso').innerHTML = store.modo==='demo'
      ? '<div class="conv-observacao">Modo demonstração: eventos ficam somente neste navegador, sem Firestore real.</div>'
      : !dados.temEventos ? '<div class="conv-observacao">Ainda não há interações monitoradas neste período. Os eventos exigem consentimento e a publicação da regra específica no Firebase. Pedidos existentes são contabilizados separadamente.</div>'
      : '<div class="conv-observacao">Visitas e interações são registradas somente quando o visitante permite métricas. Não representam todo o tráfego nem identificam pessoas.</div>';
    el.querySelector('#conv-kpis').innerHTML=`<div class="kpis conv-kpis">
      ${card('Sessões monitoradas',numero(k.visita),'Aproximação por sessão com consentimento')}
      ${card('Alvesinho aberto',numero(k.chat_aberto),'Conversas iniciadas')}
      ${card('Sintomas explorados',numero(k.sintoma_selecionado),'Problemas selecionados')}
      ${card('Ferramentas abertas',numero(k.ferramenta_iniciada),'Usos iniciais das ferramentas')}
      ${card('Cliques no WhatsApp',numero(k.whatsapp_aberto),'Aberturas de link, não mensagens enviadas')}
      ${card('Pedidos de orçamento',numero(k.pedidos),'Registros confirmados no Firebase')}
      ${card('Viraram clientes',numero(k.clientes),'Atualizados em Pedidos do site')}
      ${card('Pedidos → clientes',k.conversaoPedidoCliente===null?'—':k.conversaoPedidoCliente+'%','Somente pedidos recebidos no período')}
    </div>`;
    const diasVisiveis=dados.historico.slice(-14);
    const max=Math.max(1,...diasVisiveis.map(x=>Math.max(x.visitas,x.chats,x.pedidos)));
    const historico=diasVisiveis.length?diasVisiveis.map(x=>`<div class="conv-dia"><b>${esc(x.dia.slice(5).replace('-','/'))}</b><div class="conv-dia-barras">
       <div class="conv-h-visitas" style="width:${Math.round(x.visitas/max*100)}%" title="Sessões ${x.visitas}"></div>
       <div class="conv-h-chat" style="width:${Math.round(x.chats/max*100)}%" title="Alvesinho ${x.chats}"></div>
       <div class="conv-h-lead" style="width:${Math.round(x.pedidos/max*100)}%" title="Pedidos ${x.pedidos}"></div>
    </div><small>${x.visitas} / ${x.chats} / ${x.pedidos}</small></div>`).join(''):'<p class="sub">Ainda não há dados para exibir a evolução.</p>';
    const maiorCanal=Math.max(1,...dados.canais.map(c=>c.valor));
    const maiorPag=Math.max(1,...dados.paginas.map(c=>c.valor));
    el.querySelector('#conv-corpo').innerHTML=`<div class="conv-paineis">
      <section class="card"><h2>Movimento do site</h2><p class="sub">Sessões (azul), conversas com Alvesinho (verde) e pedidos (amarelo). São contagens independentes, não um funil de pessoas identificadas.</p><div class="conv-historico">${historico}</div></section>
      <section class="card"><h2>Origem das sessões monitoradas</h2>${dados.canais.length?dados.canais.map(c=>coluna(c.nome,c.valor,maiorCanal)).join(''):'<p class="sub">Sem dados de origem ainda.</p>'}</section>
      <section class="card"><h2>Ferramentas que despertam interesse</h2><div class="tabela-wrap"><table class="tabela"><thead><tr><th>Ferramenta</th><th>Aberturas</th><th>Conclusões</th></tr></thead><tbody>${dados.ferramentas.map(f=>`<tr><td>${esc(f.nome)}</td><td>${numero(f.abertas)}</td><td>${numero(f.concluidas)}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><h2>Temas mais procurados</h2><p class="sub">Seleções de sintomas no Alvesinho, sem guardar o que foi digitado.</p>${dados.sintomas.length?dados.sintomas.map(([id,n])=>coluna(id.replaceAll('-',' '),n,Math.max(1,dados.sintomas[0][1]))).join(''):'<p class="sub">Ainda sem sintomas registrados.</p>'}</section>
      <section class="card"><h2>Áreas visitadas</h2>${dados.paginas.length?dados.paginas.map(x=>coluna(x.nome,x.valor,maiorPag)).join(''):'<p class="sub">Ainda sem dados.</p>'}</section>
      <section class="card"><h2>Problemas nos pedidos reais</h2>${dados.assuntos.length?dados.assuntos.map(([id,n])=>coluna(id,n,Math.max(1,dados.assuntos[0][1]))).join(''):'<p class="sub">Nenhum pedido no período.</p>'}
        <p style="margin-top:16px"><a class="btn btn-primary" href="#/leads">Gerenciar pedidos recebidos</a></p></section>
    </div><div class="conv-observacao">Importante: sessões monitoradas dependem da escolha de privacidade. Não calcule taxa de conversão de visitantes totais com estes números. Pedidos do período e status “Virou cliente” vêm diretamente do sistema e podem ser analisados separadamente.</div>`;
  };
  el.querySelector('#conv-periodo').onchange=(e)=>{dias=Number(e.target.value);render();};
  el.querySelector('#conv-exportar').onclick=()=>ultimo&&exportarCSV(ultimo);
  render();
  return {live:true,render};
}
