// Check-up do computador: dados do navegador + perguntas -> laudo prévio.
import { ambiente, ramTexto, enviarAoTecnico, copiar, esc } from './comum.js';

const app = document.getElementById('app-ferramenta');
const raiz = document.documentElement.dataset.raiz || '../';
let A = null; // ambiente
const R = { mesmo: null, tipo: null, idade: null, sintomas: [], disco: null, limpeza: null, evento: [] };

const SINTOMAS = [
  ['lento_ligar', 'Demora para ligar'], ['lento', 'Lento no uso'], ['quente', 'Esquenta / ventoinha alta'],
  ['desliga', 'Desliga sozinho'], ['azul', 'Tela azul / reinicia'], ['naoliga', 'Não liga'],
  ['bateria', 'Bateria dura pouco'], ['estalo', 'Barulho ou estalo no disco'], ['propaganda', 'Propagandas / páginas sozinhas'],
  ['wifi', 'Wi-Fi cai ou não conecta'], ['tela', 'Defeito na tela / imagem'], ['teclado', 'Teclado ou touchpad falhando'],
  ['nenhum', 'Nenhum, quero prevenir'],
];

const PASSOS = [
  { id: 'mesmo', titulo: 'Você está usando o computador com problema agora?', sub: 'Se sim, os dados acima são dele e entram no laudo.',
    opcoes: [['sim', 'Sim, é este'], ['nao', 'Não, estou em outro aparelho']] },
  { id: 'tipo', titulo: 'Qual é o equipamento?', opcoes: [['Notebook', 'Notebook'], ['Desktop', 'Computador de mesa'], ['All-in-one', 'All-in-one']] },
  { id: 'idade', titulo: 'Quantos anos ele tem, mais ou menos?', opcoes: [['0', 'Menos de 2 anos'], ['3', '2 a 4 anos'], ['6', '5 a 7 anos'], ['9', '8 anos ou mais']] },
  { id: 'sintomas', titulo: 'O que está acontecendo?', sub: 'Marque tudo o que se aplica.', multi: true, opcoes: SINTOMAS },
  { id: 'disco', titulo: 'Ele usa SSD ou HD?', sub: 'Na dúvida: se demora mais de 1 minuto para ligar, provavelmente é HD.', opcoes: [['SSD', 'SSD'], ['HD', 'HD (disco que gira)'], ['?', 'Não sei']] },
  { id: 'limpeza', titulo: 'Quando foi a última limpeza interna?', opcoes: [['nunca', 'Nunca / não sei'], ['2+', 'Mais de 2 anos'], ['1-2', 'Entre 1 e 2 anos'], ['<1', 'Menos de 1 ano']] },
  { id: 'evento', titulo: 'Aconteceu alguma destas coisas?', multi: true, opcoes: [['queda', 'Caiu ou levou pancada'], ['liquido', 'Molhou / derramou líquido'], ['energia', 'Queda ou pico de energia'], ['nada', 'Nada disso']] },
];

let passo = -1;

function cabecalhoDados() {
  const dado = (rot, val) => `<div class="dado"><span>${rot}</span><b>${esc(val || '—')}</b></div>`;
  return `<div class="card"><span class="passo-ferr">lido do seu aparelho</span><h2>O que o navegador consegue ver</h2>
    <div class="dados-aparelho">
      ${dado('Sistema', A.soTexto)}${dado('Navegador', A.navegador)}${dado('Processador', A.nucleos ? A.nucleos + ' núcleos (threads)' : '')}
      ${dado('Memória RAM', ramTexto(A.ramGB))}${dado('Placa de vídeo', A.gpu)}${dado('Tela', A.tela)}
      ${A.bateria ? dado('Bateria agora', A.bateria.nivel + '%' + (A.bateria.carregando ? ' · carregando' : '')) : ''}${A.conexao ? dado('Conexão', A.conexao) : ''}
    </div>
    <p class="sub" style="margin:12px 0 0">Por segurança, o navegador não deixa nenhum site ler temperatura, saúde do disco ou desgaste da bateria. Essas partes vêm das suas respostas.</p></div>`;
}

function desenhar() {
  if (passo < 0) {
    app.innerHTML = cabecalhoDados() + `<div class="card"><h2>Vamos lá?</h2><p class="sub">São 7 perguntas rápidas. No fim você recebe um laudo prévio e pode enviá-lo ao técnico.</p>
      <div class="ferr-nav"><span></span><button class="btn btn-pri" id="comecar">Começar check-up</button></div></div>`;
    app.querySelector('#comecar').onclick = () => { passo = 0; desenhar(); };
    return;
  }
  if (passo >= PASSOS.length) return laudo();
  const p = PASSOS[passo];
  if (p.id === 'tipo' && R.mesmo === 'sim' && !A.movel && R.tipo === null) {
    R.tipo = A.bateria && !A.bateria.carregando ? 'Notebook' : null; // pista; o visitante confirma
  }
  const val = R[p.id];
  app.innerHTML = `<div class="card"><span class="passo-ferr">pergunta ${passo + 1} de ${PASSOS.length}</span><h2>${p.titulo}</h2>${p.sub ? `<p class="sub" style="margin-top:-6px">${p.sub}</p>` : ''}
    <div class="opcoes-grandes">${p.opcoes.map(([v, t]) => `<button type="button" class="opc ${(p.multi ? val.includes(v) : val === v) ? 'sel' : ''}" data-v="${v}">${esc(t)}</button>`).join('')}</div>
    <div class="ferr-nav"><button class="btn" id="voltar">${passo ? '← Voltar' : '← Início'}</button><button class="btn btn-pri" id="seguir" ${p.multi && !val.length ? 'disabled' : ''}>${p.multi ? 'Continuar →' : 'Pular →'}</button></div></div>`;
  app.querySelectorAll('.opc').forEach((b) => b.onclick = () => {
    const v = b.dataset.v;
    if (p.multi) {
      let arr = R[p.id];
      const exclusivo = v === 'nenhum' || v === 'nada';
      if (exclusivo) arr = arr.includes(v) ? [] : [v];
      else { arr = arr.filter((x) => x !== 'nenhum' && x !== 'nada'); arr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }
      R[p.id] = arr;
      desenhar();
    } else { R[p.id] = v; passo++; desenhar(); }
  });
  app.querySelector('#voltar').onclick = () => { passo--; desenhar(); };
  app.querySelector('#seguir').onclick = () => { passo++; desenhar(); };
  window.scrollTo({ top: app.offsetTop - 90, behavior: 'smooth' });
}

function analisar() {
  const s = new Set(R.sintomas);
  const ev = new Set(R.evento);
  const idade = parseInt(R.idade || '3', 10);
  const usaDados = R.mesmo === 'sim';
  const itens = [];
  const add = (nivel, titulo, texto, link) => itens.push({ nivel, titulo, texto, link });

  if (ev.has('liquido')) add('alto', 'Contato com líquido', 'Desligue, tire da tomada (e a bateria, se sair) e não tente ligar até a avaliação. Ligar molhado é o que mais causa curto na placa. Quanto antes for aberto e limpo, maiores as chances.');
  if (s.has('naoliga')) add('alto', 'Não liga: falha de energia ou de placa', 'As causas mais comuns são carregador/fonte, conector de carga, bateria, memória com mau contato ou placa-mãe. Faça as verificações simples do artigo antes; se não resolver, precisa de diagnóstico.', 'dicas/computador-nao-liga.html');
  if (s.has('estalo')) add('alto', 'Disco com sinais de falha', 'Estalos ou cliques indicam HD morrendo. Faça backup dos arquivos importantes agora e evite deixar ligado à toa. A troca por SSD resolve e ainda deixa o computador muito mais rápido.', 'dicas/ssd-esta-bom.html');
  if (s.has('propaganda')) add('alto', 'Possível infecção (vírus/adware)', 'Não acesse banco nem digite senhas nesse aparelho até a limpeza. Depois, troque as senhas importantes usando outro aparelho.', 'dicas/virus-e-golpes.html');
  const semLimpeza = R.limpeza === 'nunca' || R.limpeza === '2+';
  if (s.has('desliga') || s.has('quente')) {
    add(s.has('desliga') || semLimpeza ? 'alto' : 'medio', 'Superaquecimento', `${s.has('desliga') ? 'Desligar sozinho é a proteção contra temperatura agindo. ' : ''}${semLimpeza ? 'Sem limpeza há muito tempo, poeira e pasta térmica ressecada são as causas mais prováveis. ' : ''}Limpeza interna com troca de pasta térmica resolve na maioria dos casos. Usar assim por muito tempo pode danificar a placa.`, 'dicas/notebook-esquentando.html');
  }
  if (s.has('azul')) add('medio', 'Tela azul / reinicializações', 'Pode ser driver, memória RAM, disco ou atualização com problema. Anote ou fotografe o código do erro. Se for frequente, faça backup e peça diagnóstico (testes de memória e disco).', 'dicas/tela-azul.html');
  if (s.has('lento') || s.has('lento_ligar')) {
    const provHD = R.disco === 'HD' || (R.disco === '?' && (idade >= 5 || s.has('lento_ligar')));
    if (provHD) add('medio', 'Lentidão: provável HD mecânico', 'O HD é o principal vilão da lentidão. Trocar por SSD costuma ser o upgrade com o melhor custo-benefício: liga em segundos e os programas abrem na hora. Seus arquivos são migrados.', 'dicas/ssd-ou-hd.html');
    if (usaDados && A.ramGB && A.ramGB <= 4) add('medio', 'Pouca memória RAM', `O navegador indica cerca de ${A.ramGB} GB. Para o Windows atual e várias abas abertas, 8 GB é o mínimo confortável. Veja se o seu modelo aceita ampliação.`);
    if (!provHD && !(usaDados && A.ramGB && A.ramGB <= 4)) add('medio', 'Lentidão: sistema, programas ou vírus', 'Com SSD e memória suficientes, a lentidão costuma vir de programas na inicialização, vírus, disco cheio ou sistema desgastado. Uma limpeza do sistema ou formatação com backup resolve.', 'dicas/computador-lento.html');
  }
  if (usaDados && A.so === 'Windows' && A.soVersao === '10') add('medio', 'Windows 10 sem suporte', 'O suporte gratuito do Windows 10 terminou em 14/10/2025: ele não recebe mais atualizações de segurança. Vale verificar se o seu computador aceita o Windows 11 ou se compensa um upgrade.');
  if (usaDados && A.so === 'Windows' && A.soVersao === '7/8') add('alto', 'Windows muito antigo', 'Windows 7/8 não recebem atualizações há anos e muitos sites e programas já não funcionam. É hora de atualizar o sistema (e provavelmente colocar um SSD).');
  if (usaDados && A.nucleos && A.nucleos <= 2) add('baixo', 'Processador modesto', 'O navegador indica só 2 núcleos. Para uso básico serve, mas tarefas pesadas vão ser lentas mesmo depois de otimizar. Pode valer avaliar se compensa consertar ou trocar.', 'ferramentas/consertar-ou-trocar.html');
  if (s.has('bateria') && R.tipo !== 'Desktop') add(idade >= 3 ? 'medio' : 'baixo', 'Bateria desgastada', `${idade >= 3 ? 'Com essa idade, o desgaste é natural.' : 'Para um equipamento novo, vale checar a garantia.'} Se o notebook estiver estufado ou com a carcaça abrindo, pare de usar: é risco de incêndio.`, 'dicas/bateria-notebook.html');
  if (s.has('wifi')) add('baixo', 'Wi-Fi instável', 'Teste se o problema é do roteador ou do notebook. Redefinir a rede e atualizar o driver resolvem a maioria dos casos. Se a placa estiver com defeito, a troca é simples.', 'dicas/wifi-nao-conecta.html');
  if (s.has('tela')) add('medio', 'Defeito de tela', 'Use o teste de tela para ver se são pixels mortos, manchas ou listras. Listras que mudam ao mexer na tampa costumam ser o cabo flat; manchas fixas costumam ser o painel.', 'ferramentas/testes.html');
  if (s.has('teclado')) add('baixo', 'Teclado ou touchpad', 'Use o teste de teclado para ver quais teclas falham. Pode ser sujeira, líquido ou o teclado em si (a troca é comum em notebooks).', 'ferramentas/testes.html');
  if (ev.has('queda')) add('medio', 'Queda ou pancada', 'Pode afetar dobradiças, tela, conectores e o HD (SSD resiste melhor). Se surgiu algum defeito depois da queda, ela é a principal suspeita.');
  if (ev.has('energia')) add('medio', 'Problema de energia', 'Picos e quedas podem danificar a fonte e a placa. Use um filtro de linha de qualidade ou um nobreak, principalmente em regiões com quedas frequentes.');
  if (semLimpeza && idade >= 2 && !(s.has('desliga') || s.has('quente'))) add('baixo', 'Manutenção preventiva atrasada', 'Mesmo sem sintomas, a limpeza a cada 12–18 meses evita superaquecimento e prolonga a vida útil.', 'dicas/notebook-esquentando.html');
  if (!itens.length) add('baixo', 'Tudo indica que está bem', 'Nenhum sinal de problema nas respostas. Mantenha o backup em dia e faça a limpeza preventiva no prazo.', 'dicas/backup.html');
  const ordem = { alto: 0, medio: 1, baixo: 2 };
  return itens.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

function textoResumo(itens) {
  const sint = R.sintomas.map((k) => (SINTOMAS.find((x) => x[0] === k) || [])[1]).filter(Boolean).join(', ');
  const linhas = [
    `CHECK-UP DO SITE — ${R.tipo || 'equipamento'}, ~${({ 0: '<2', 3: '2-4', 6: '5-7', 9: '8+' })[R.idade] || '?'} anos, disco: ${R.disco || '?'}, limpeza: ${R.limpeza || '?'}`,
    sint ? `Sintomas: ${sint}` : '',
    R.evento.length && !R.evento.includes('nada') ? `Ocorrências: ${R.evento.join(', ')}` : '',
    R.mesmo === 'sim' ? `Aparelho: ${A.soTexto} · ${A.navegador} · ${A.nucleos || '?'} núcleos · RAM ${ramTexto(A.ramGB)}${A.gpu ? ' · ' + A.gpu : ''}` : '',
    'Laudo prévio: ' + itens.map((i) => `[${i.nivel}] ${i.titulo}`).join('; '),
  ];
  return linhas.filter(Boolean).join('\n');
}

function laudo() {
  window.MetricasSite?.registrar('ferramenta_concluida', 'checkup');
  const itens = analisar();
  const pior = itens[0].nivel;
  const ver = { alto: ['Precisa de atenção', 'var(--danger, #f87171)'], medio: ['Vale resolver logo', '#fbbf24'], baixo: ['Situação tranquila', '#34d399'] }[pior];
  app.innerHTML = (R.mesmo === 'sim' ? cabecalhoDados() : '') + `<div class="card">
    <span class="passo-ferr">laudo prévio</span>
    <div class="veredito" style="color:${ver[1]}">${ver[0]}</div>
    <p class="sub" style="margin-top:0">Baseado nas suas respostas${R.mesmo === 'sim' ? ' e nos dados do navegador' : ''}. É uma orientação: a confirmação vem no diagnóstico técnico.</p>
    ${itens.map((i) => `<div class="laudo-item"><span class="nivel ${i.nivel}">${{ alto: 'alto', medio: 'médio', baixo: 'baixo' }[i.nivel]}</span>
      <div><h3>${esc(i.titulo)}</h3><p>${esc(i.texto)}${i.link ? ` <a href="${raiz}${i.link}">Saiba mais →</a>` : ''}</p></div></div>`).join('')}
    <div class="ferr-nav">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="refazer">Refazer</button><button class="btn" id="copiar">Copiar resultado</button></div>
      <button class="btn btn-pri" id="enviar">Enviar check-up ao técnico</button>
    </div></div>`;
  const resumo = textoResumo(itens);
  const probl = (SINTOMAS.find((x) => x[0] === R.sintomas[0]) || [, 'Check-up'])[1];
  app.querySelector('#enviar').onclick = () => enviarAoTecnico({ servico: 'Check-up do site', equipamento: R.tipo || 'Outro', problema: probl.slice(0, 60), detalhe: resumo });
  app.querySelector('#copiar').onclick = (e) => copiar(resumo, e.target);
  app.querySelector('#refazer').onclick = () => { Object.assign(R, { mesmo: null, tipo: null, idade: null, sintomas: [], disco: null, limpeza: null, evento: [] }); passo = 0; desenhar(); };
  window.scrollTo({ top: app.offsetTop - 90, behavior: 'smooth' });
}

ambiente().then((a) => { A = a; desenhar(); });
