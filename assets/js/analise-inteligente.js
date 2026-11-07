// Analizador orientativo: sinais de desgaste e oportunidades de upgrade.
// Não lê S.M.A.R.T., temperatura, saúde da bateria, modelo físico ou arquivos locais.
import { ambiente,ramTexto,esc } from './ferramentas/comum.js';
const app=document.querySelector('#analisador');
const fmt = v=>String(v||'').trim().slice(0,240);
const respostas={};
let detectado=null;
const perguntas=[
{id:'equipamento',texto:'Qual equipamento você quer avaliar?',itens:['Notebook','Computador desktop','All-in-one','Outro']},
{id:'idade',texto:'Há quanto tempo você usa esse equipamento?',itens:['Até 2 anos','De 3 a 5 anos','6 anos ou mais','Não sei']},
{id:'disco',texto:'Você sabe se o armazenamento é HD ou SSD?',itens:['HD','SSD','HD e SSD','Não sei']},
{id:'ram',texto:'Quanto de RAM ele tem?',itens:['4 GB ou menos','8 GB','16 GB ou mais','Não sei']},
{id:'uso',texto:'O que você mais faz no computador?',itens:['Internet e estudos','Trabalho, muitas abas e reuniões','Jogos ou edição','Uso misto']},
{id:'sintomas',texto:'Quais problemas já percebeu?',multi:true,itens:['Demora para ligar','Fica lento ao abrir programas','Trava com muitas abas','Esquenta ou ventoinha faz muito barulho','Desliga sozinho','Bateria dura pouco','HD faz estalos ou ruídos','Tela azul / reinicia sem aviso','Arquivos somem ou aparecem erros','Não apresenta problemas']},
{id:'evento',texto:'Ocorreu alguma situação importante?',multi:true,itens:['Caiu líquido','Bateria estufada / carcaça levantada','Cheiro de queimado ou fumaça','Sofreu queda ou pancada','Nenhuma dessas situações']}
];
let pagina=0;
const dadosManuais={modelo:'',cpu:''};
function txt(s){return String(s??'')}
function opcoes(p){return p.itens.map((it,i)=>`<label class="analise-check"><input type="${p.multi?'checkbox':'radio'}" name="${p.id}" value="${esc(it)}" ${p.multi?(respostas[p.id]||[]).includes(it)?'checked':'':respostas[p.id]===it?'checked':''}><span>${esc(it)}</span></label>`).join('')}
function tela(){
 if(pagina<perguntas.length){
 const p=perguntas[pagina];
 app.innerHTML=`<div class="jornada-panel"><span class="jornada-step">Etapa ${pagina+1} de ${perguntas.length}</span><h2 style="margin:12px 0">${esc(p.texto)}</h2><div class="analise-opcoes">${opcoes(p)}</div><div class="jornada-controls"><button class="btn" type="button" id="a-voltar" ${pagina===0?'disabled':''}>Voltar</button><button class="btn btn-pri" type="button" id="a-avancar">${pagina===perguntas.length-1?'Ver minha análise':'Continuar'}</button></div><p class="jornada-error" data-erro hidden></p></div>`;
 const check=()=>[...app.querySelectorAll('input:checked')].map(x=>x.value);
 const set=(val)=>{
   const a=app.querySelector('[data-erro]');
   if(!val.length){a.textContent='Selecione pelo menos uma opção.';a.hidden=false;return false}
   respostas[p.id]=p.multi?val:val[0];
   return true
 };
 app.querySelector('#a-avancar').onclick=()=>{if(set(check())){pagina++;tela()}};
 app.querySelector('#a-voltar').onclick=()=>{pagina--;tela()};
 if(p.multi)app.querySelectorAll('input').forEach(e=>e.addEventListener('change',()=>{
 const v=e.value;
 if(v==='Não apresenta problemas'||v==='Nenhuma dessas situações'){
   if(e.checked)app.querySelectorAll('input').forEach(x=>{if(x!==e)x.checked=false})
 }else if(e.checked)app.querySelectorAll('input').forEach(x=>{if(x.value==='Não apresenta problemas'||x.value==='Nenhuma dessas situações')x.checked=false});
 }));
 return;
 }
 resultado();
}
function avaliar(){
 const findings=[];
 const add=(nivel,titulo,texto,acao,tipo='sinal')=>findings.push({nivel,titulo,texto,acao,tipo});
 const sint=new Set(respostas.sintomas||[]),eventos=new Set(respostas.evento||[]);
 const presente=t=>sint.has(t);
 let alerta=false;
 if(eventos.has('Cheiro de queimado ou fumaça')){alerta=true;add('urgente','Sinal de possível risco elétrico','Pare de usar. Desconecte apenas se for seguro e procure avaliação técnica. Não tente religar.','Avaliação antes de qualquer teste');}
 if(eventos.has('Bateria estufada / carcaça levantada')){alerta=true;add('urgente','Possível bateria danificada','Pare de carregar e usar. Não pressione, abra nem perfure a bateria.','Avaliar retirada segura');}
 if(eventos.has('Caiu líquido')){alerta=true;add('urgente','Contato com líquido','Não ligue o equipamento. Mesmo após secar, podem existir corrosão e curtos.','Inspeção em laboratório');}
 if(presente('HD faz estalos ou ruídos')||presente('Arquivos somem ou aparecem erros')){
   add('atencao','Sinais que podem indicar problema no armazenamento','Ruídos mecânicos ou erros de arquivos podem apontar falha de disco, mas não confirmam desgaste. Evite testes pesados; priorize preservar dados importantes.','Avaliar saúde do disco e possibilidade de backup');
 }
 if(presente('Desliga sozinho')||presente('Esquenta ou ventoinha faz muito barulho')){
   add('atencao','Possível problema de temperatura ou alimentação','Aquecimento, desligamentos e ruído podem ter várias causas: sujeira, ventilação, energia ou desgaste de componentes. O site não mede temperatura.','Avaliar refrigeração e alimentação');
 }
 if(presente('Bateria dura pouco')&&respostas.equipamento==='Notebook'){
  add('atencao','Autonomia de bateria reduzida','A duração reduzida pode estar ligada a desgaste, configurações ou uso. Não é possível obter a saúde química pelo navegador.','Teste de capacidade e orçamento, se necessário');
 }
 if(presente('Tela azul / reinicia sem aviso'))add('atencao','Instabilidade a investigar','Falhas de driver, sistema, RAM, armazenamento ou hardware podem explicar as reinicializações.','Testes de memória e disco');
 const leve=presente('Demora para ligar')||presente('Fica lento ao abrir programas');
 if(respostas.disco==='HD'&&leve)add('melhoria','SSD pode ser o upgrade mais vantajoso','Se esse computador ainda inicia por um HD mecânico, um SSD compatível costuma melhorar muito as tarefas ligadas ao armazenamento.','Verificar modelo, conexão e capacidade do SSD','upgrade');
 else if(respostas.disco==='Não sei'&&leve)add('melhoria','Descobrir se usa HD ou SSD','Identificar o tipo de armazenamento ajuda a decidir se compensa investir em SSD. O navegador não consegue determinar isso sozinho.','Conferir especificação de armazenamento','upgrade');
 let ram=respostas.ram;
 if(ram==='Não sei'&&detectado?.ramGB>0)ram=ramTexto(detectado.ramGB)==='8 GB ou mais'?'Não sei':detectado.ramGB<=4?'4 GB ou menos':'Não sei';
 if((ram==='4 GB ou menos')&&(presente('Trava com muitas abas')||respostas.uso!=='Internet e estudos')){
   add('melhoria','Possível benefício de ampliar a RAM','Em multitarefa, 4 GB ou menos podem limitar o uso. O site não confirma quantidade de slots ou compatibilidade.','Verificar placa, slots e memória compatível','upgrade');
 }else if(ram==='8 GB'&&(respostas.uso==='Jogos ou edição'||presente('Trava com muitas abas'))){
   add('melhoria','Investigar 16 GB de RAM','Mais memória pode ajudar nos programas que consomem muita RAM, caso o equipamento permita expansão.','Confirmar gargalo antes de comprar memória','upgrade');
 }
 if(respostas.uso==='Jogos ou edição')add('melhoria','Verificar GPU e processador antes de investir','O navegador não identifica modelos exatos de CPU/GPU nem desempenho real; jogos e edição exigem avaliação específica.','Analisar aplicativos, GPU e possibilidades de upgrade','upgrade');
 if(respostas.idade==='6 anos ou mais'&&!alerta){
   add('preventiva','Vale considerar uma revisão preventiva','O tempo de uso, sozinho, não prova desgaste. Uma inspeção pode encontrar poeira, refrigeração comprometida ou peças envelhecendo.','Revisão preventiva opcional');
 }
 if(!findings.length)add('ok','Nenhum sinal evidente nas respostas','Sem sintomas relatados, não há motivo para recomendar troca de peças. Mantenha backups e atualizações em dia.','Manutenção preventiva conforme uso');
 return findings;
}
function resumo(f){
 const linhas=['ANÁLISE INICIAL — ÍTALO INFOTEC','Dados informados pelo cliente: '+respostas.equipamento+'; idade '+respostas.idade+'; armazenamento '+respostas.disco+'; RAM '+respostas.ram+'; uso '+respostas.uso];
 if(dadosManuais.modelo)linhas.push('Modelo informado: '+dadosManuais.modelo);
 if(dadosManuais.cpu)linhas.push('CPU informada: '+dadosManuais.cpu);
 linhas.push('Sintomas: '+(respostas.sintomas||[]).join(', '),'Ocorrências: '+(respostas.evento||[]).join(', '));
 if(detectado)linhas.push('Navegador deste aparelho: '+detectado.soTexto+'; '+detectado.nucleos+' processadores lógicos; RAM estimada '+ramTexto(detectado.ramGB));
 linhas.push('Orientações: '+f.map(v=>v.titulo+' — '+v.acao).join('; '),'Avaliação preliminar, sem diagnóstico comprovado, sem medição de desgaste ou compatibilidade garantida.');
 return linhas.join('\n').slice(0,1450);
}
function resultado(){
 const findings=avaliar(), urgentes=findings.filter(x=>x.nivel==='urgente');
 const up=findings.filter(x=>x.tipo==='upgrade');
 app.innerHTML=`<div class="jornada-panel"><span class="jornada-step">Resultado preliminar</span><h2 style="margin:10px 0">O que vale investigar no seu computador</h2>
 <p class="jornada-note">Baseado nas suas respostas; nada foi diagnosticado como defeito confirmado. ${urgentes.length?'Existem sinais de risco: não continue usando o equipamento até avaliar.':'Você pode decidir se quer seguir alguma recomendação.'}</p>
 <div class="analise-achados">${findings.map(f=>`<article class="analise-achado" data-nivel="${f.nivel}"><span class="analise-nivel">${{urgente:'Atenção imediata',atencao:'Vale investigar',melhoria:'Upgrade possível',preventiva:'Revisão opcional',ok:'Sem alerta'}[f.nivel]}</span><h3>${esc(f.titulo)}</h3><p>${esc(f.texto)}</p><small>Próximo passo: ${esc(f.acao)}</small></article>`).join('')}</div>
 <div class="jornada-separator"></div>
 <h3>Quer completar a identificação?</h3>
 <p class="jornada-small">Você pode informar marca e modelo. Se estiver neste computador, o navegador consegue ler poucos dados gerais, mas não mede o desgaste de peças.</p>
 <div class="jornada-inputs"><div class="jornada-field"><label for="a-modelo">Marca / modelo (opcional)</label><input id="a-modelo" maxlength="100" placeholder="Ex.: Lenovo Ideapad 3" value="${esc(dadosManuais.modelo)}"></div>
 <div class="jornada-field"><label for="a-cpu">CPU, se souber (opcional)</label><input id="a-cpu" maxlength="100" placeholder="Ex.: Ryzen 5 5500U" value="${esc(dadosManuais.cpu)}"></div></div>
 <div class="jornada-controls"><button class="btn" id="a-ler" type="button">Ler informações deste aparelho</button><button class="btn" id="a-voltar" type="button">Refazer respostas</button></div>
 <p class="jornada-small" data-hw-status role="status" aria-live="polite"></p>
 <div class="jornada-result" data-hw-resultado hidden></div>
 <div class="jornada-separator"></div>
 <p class="jornada-note">Você não precisa contratar nada para usar a ferramenta. ${up.length?'Há possibilidades de upgrade, mas a compra só faz sentido depois de verificar a compatibilidade.':'A ferramenta não encontrou uma indicação clara de upgrade; não recomendamos comprar peças sem avaliação.'}</p>
 <div class="jornada-controls"><button class="btn btn-pri" type="button" id="a-orcamento">Quero conversar sobre este resultado</button><button class="btn" type="button" id="a-copiar">Copiar relatório</button><a class="btn" href="../ferramentas/velocidade.html">Testar internet</a></div></div>`;
 const $=s=>app.querySelector(s);
 const getReport=()=>{dadosManuais.modelo=fmt($('#a-modelo').value).slice(0,100);dadosManuais.cpu=fmt($('#a-cpu').value).slice(0,100);return resumo(findings)};
 $('#a-voltar').onclick=()=>{pagina=0;tela()};
 $('#a-ler').onclick=async()=>{
   $('#a-ler').disabled=true;$('[data-hw-status]').textContent='Verificando os dados que o navegador permite…';
   try{detectado=await ambiente();$('[data-hw-resultado]').hidden=false;
   $('[data-hw-resultado]').textContent=['Sistema: '+detectado.soTexto,'Navegador: '+detectado.navegador,'Processadores lógicos: '+(detectado.nucleos||'não informado'),'RAM: '+ramTexto(detectado.ramGB),'Renderizador gráfico (pode ser genérico): '+(detectado.gpu||'não informado')].join(' | ');
   $('[data-hw-status]').textContent='Leitura concluída. Nenhuma informação foi enviada automaticamente.';
   }catch(e){$('[data-hw-status]').textContent='Seu navegador não disponibilizou os dados. Continue com suas respostas.';}
   $('#a-ler').disabled=false;
 };
 $('#a-copiar').onclick=async()=>{const r=getReport();try{await navigator.clipboard.writeText(r);$('[data-hw-status]').textContent='Relatório copiado!';}catch(e){$('[data-hw-status]').textContent='Não foi possível copiar automaticamente.';}};
 $('#a-orcamento').onclick=()=>{
    const r=getReport();
    // Navegação por link somente após clique. O relatório nunca é colocado na URL.
    try{sessionStorage.setItem('italoti-analise-pendente',JSON.stringify({relatorio:r,validade:Date.now()+900000}));}catch(e){}
    location.href='../atendimento-pessoal/?origem=analise';
 };
}
if(app)tela();
