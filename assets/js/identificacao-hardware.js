// Identificação parcial do equipamento pelo navegador: execução somente mediante clique.
import { ambiente, ramTexto } from './ferramentas/comum.js';

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const limitar = (v,n=140) => String(v ?? '').trim().slice(0,n);
const titulo = (v) => v || 'Não informado pelo navegador';

function montarRelatorio(a, dadosManuais) {
 const linhas = ['IDENTIFICAÇÃO PRELIMINAR — ÍTALO INFOTEC','Origem: '+(a?'dados permitidos pelo navegador deste aparelho':'informações declaradas pelo cliente')];
 if(a){
   linhas.push('Sistema: '+titulo(a.soTexto),'Navegador: '+titulo(a.navegador));
   if(a.nucleos) linhas.push('Processadores lógicos informados: '+a.nucleos+' (não é o modelo da CPU)');
   if(a.ramGB) linhas.push('Memória aproximada informada: '+ramTexto(a.ramGB));
   if(a.gpu) linhas.push('Renderizador gráfico informado: '+limitar(a.gpu)+' (não confirma a placa física)');
   if(a.tela) linhas.push('Resolução da tela: '+a.tela);
   if(a.conexao) linhas.push('Estimativa da conexão do navegador: '+a.conexao+' (não é teste de velocidade)');
 }
 if(dadosManuais.modelo)linhas.push('Marca/modelo declarado: '+dadosManuais.modelo);
 if(dadosManuais.ram)linhas.push('RAM declarada: '+dadosManuais.ram);
 if(dadosManuais.disco)linhas.push('Armazenamento declarado: '+dadosManuais.disco);
 if(dadosManuais.cpu)linhas.push('Processador declarado: '+dadosManuais.cpu);
 linhas.push('Modelo exato, capacidade física de RAM, SSD/HD, temperaturas e compatibilidade exigem confirmação técnica.');
 return linhas.join('\n').slice(0,1100);
}

function iniciar(container) {
 let maquina = null;
 const uid = container.id || 'identificacao-'+Math.random().toString(36).slice(2,7);
 container.id=uid;
 const modo = container.dataset.identificacao || 'form';
 const permitirManual = modo !== 'compacto';
 container.innerHTML = `<div class="identifica-box">
  <div class="identifica-top"><div><span class="jornada-step">Identificação opcional</span><h3>Está usando o computador que precisa de ajuda?</h3><p>Podemos identificar algumas informações deste aparelho. O navegador não consegue ver o modelo exato das peças ou testar a saúde do hardware.</p></div></div>
  <div class="identifica-botoes"><button class="btn btn-pri" type="button" data-identificar>Sim, analisar este aparelho</button><button class="btn" type="button" data-outro>Não, é outro aparelho</button></div>
  <p class="jornada-small" data-feedback role="status" aria-live="polite"></p>
  <div class="identifica-resultado" data-resultado hidden></div>
  ${permitirManual?`<div data-manual hidden><p class="jornada-small">Se souber, informe os dados que aparecem na etiqueta ou nas configurações do equipamento. Pode deixar em branco.</p>
    <div class="jornada-inputs">
    <div class="jornada-field wide"><label for="${uid}-modelo">Marca e modelo</label><input id="${uid}-modelo" data-manual-modelo maxlength="100" placeholder="Ex.: Dell Inspiron 15"></div>
    <div class="jornada-field"><label for="${uid}-ram">Memória RAM</label><select id="${uid}-ram" data-manual-ram><option value="">Não sei</option><option>4 GB</option><option>8 GB</option><option>16 GB</option><option>32 GB ou mais</option></select></div>
    <div class="jornada-field"><label for="${uid}-disco">Armazenamento</label><select id="${uid}-disco" data-manual-disco><option value="">Não sei</option><option>HD</option><option>SSD</option><option>HD e SSD</option></select></div>
    <div class="jornada-field wide"><label for="${uid}-cpu">Modelo do processador, se souber</label><input id="${uid}-cpu" data-manual-cpu maxlength="100" placeholder="Ex.: Intel Core i5-8250U"></div>
    </div>
    <button type="button" class="btn" data-montar style="margin-top:12px">Preparar relatório</button>
  </div>`:''}
  <div class="identifica-acoes" data-acoes hidden><button class="btn" data-copiar type="button">Copiar relatório</button><button class="btn" data-limpar type="button">Limpar dados</button></div>
 </div>`;
 const $=sel=>container.querySelector(sel), obterDados=()=>({
 modelo:limitar($('[data-manual-modelo]')?.value,100),ram:limitar($('[data-manual-ram]')?.value),disco:limitar($('[data-manual-disco]')?.value),cpu:limitar($('[data-manual-cpu]')?.value,100)
 });
 function emitir(relatorio) {
   container.dataset.relatorio=relatorio;
   container.dispatchEvent(new CustomEvent('identificacao-alterada',{bubbles:true,detail:{relatorio}}));
 }
 function render() {
  const relatorio=montarRelatorio(maquina,obterDados());
  const rows=relatorio.split('\n');
  $('[data-resultado]').innerHTML='<strong>Resumo para o atendimento</strong><ul>'+rows.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul>';
  $('[data-resultado]').hidden=false;$('[data-acoes]').hidden=false;
  emitir(relatorio);
 }
 $('[data-identificar]').addEventListener('click',async ()=>{
  $('[data-feedback]').textContent='Lendo apenas os dados disponibilizados pelo navegador…';
  $('[data-identificar]').disabled=true;
  try{maquina=await ambiente();$('[data-feedback]').textContent='Leitura concluída. Confira as informações antes de enviar ao técnico.';render();if(permitirManual)$('[data-manual]').hidden=false;}
  catch(err){$('[data-feedback]').textContent='Não foi possível identificar este aparelho. Você pode informar os dados manualmente.';if(permitirManual)$('[data-manual]').hidden=false;}
  finally{$('[data-identificar]').disabled=false;}
 });
 $('[data-outro]').addEventListener('click',()=>{
  maquina=null;$('[data-feedback]').textContent='Tudo bem. Informe o equipamento manualmente ou continue sem identificação.';
  if(permitirManual){$('[data-manual]').hidden=false;render();}
  else{emitir('');$('[data-resultado]').hidden=true;$('[data-acoes]').hidden=true;}
 });
 $('[data-montar]')?.addEventListener('click',render);
 $('[data-manual]')?.addEventListener('change',()=>{if(!$('[data-resultado]').hidden)render()});
 $('[data-limpar]').addEventListener('click',()=>{
  maquina=null;container.querySelectorAll('[data-manual] input,[data-manual] select').forEach(x=>x.value='');
  $('[data-manual]')?.setAttribute('hidden','');$('[data-resultado]').hidden=true;$('[data-acoes]').hidden=true;
  $('[data-feedback]').textContent='Dados apagados desta página.';emitir('');
 });
 $('[data-copiar]').addEventListener('click',async(e)=>{
  try{await navigator.clipboard.writeText(container.dataset.relatorio||'');e.currentTarget.textContent='Copiado!';}
  catch(err){$('[data-feedback]').textContent='Não foi possível copiar. Selecione o resumo e copie manualmente.';}
 });
}
document.querySelectorAll('[data-identificacao-hardware]').forEach(iniciar);
