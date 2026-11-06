// Consertar, fazer upgrade ou trocar? Recomendação com motivos (sem preços, que mudam toda semana).
import { enviarAoTecnico, copiar, esc } from './comum.js';

const app = document.getElementById('app-ferramenta');
const R = {};
const PERG = [
  { id: 'tipo', t: 'Qual é o equipamento?', o: [['Notebook', 'Notebook'], ['Desktop', 'Computador de mesa'], ['All-in-one', 'All-in-one']] },
  { id: 'idade', t: 'Quantos anos ele tem?', o: [['1', 'Até 3 anos'], ['2', '4 a 6 anos'], ['3', '7 a 9 anos'], ['4', '10 anos ou mais']] },
  { id: 'linha', t: 'Quando foi comprado, ele era…', o: [['basico', 'Básico / de entrada', 'Celeron, Pentium, Atom, i3 antigo, 4 GB'], ['medio', 'Intermediário', 'i5 / Ryzen 5, 8 GB'], ['topo', 'Topo de linha / gamer', 'i7 / Ryzen 7, placa de vídeo']] },
  { id: 'problema', t: 'Qual é o problema principal?', o: [['lento', 'Está lento'], ['quente', 'Esquenta / desliga'], ['placa', 'Não liga / problema de placa'], ['tela', 'Tela quebrada ou com defeito'], ['bateria', 'Bateria / carregador'], ['carcaca', 'Carcaça, dobradiça ou teclado'], ['sistema', 'Vírus / Windows com erro']] },
  { id: 'uso', t: 'Para que você quer usar daqui pra frente?', o: [['basico', 'Básico', 'internet, documentos, vídeos'], ['trabalho', 'Trabalho e estudo', 'vários programas e abas'], ['pesado', 'Pesado', 'jogos, edição, programação']] },
];
let i = 0;

function pergunta() {
  if (i >= PERG.length) return resultado();
  const p = PERG[i];
  app.innerHTML = `<div class="card"><span class="passo-ferr">pergunta ${i + 1} de ${PERG.length}</span><h2>${p.t}</h2>
    <div class="opcoes-grandes">${p.o.map(([v, t, s]) => `<button class="opc ${R[p.id] === v ? 'sel' : ''}" data-v="${v}">${esc(t)}${s ? `<small>${esc(s)}</small>` : ''}</button>`).join('')}</div>
    <div class="ferr-nav">${i ? '<button class="btn" id="voltar">← Voltar</button>' : '<span></span>'}<span></span></div></div>`;
  app.querySelectorAll('.opc').forEach((b) => b.onclick = () => { R[p.id] = b.dataset.v; i++; pergunta(); });
  app.querySelector('#voltar')?.addEventListener('click', () => { i--; pergunta(); });
}

function decidir() {
  const idade = +R.idade;
  const lin = { basico: 0, medio: 1, topo: 2 }[R.linha];
  const uso = { basico: 0, trabalho: 1, pesado: 2 }[R.uso];
  const motivos = [];
  let pontos = 0; // + favorece consertar, - favorece trocar

  // idade x linha: quanto "sobra" de desempenho
  const folga = lin * 1.5 - (idade - 1) - uso;
  if (folga >= 0) { pontos += 2; motivos.push('O equipamento ainda tem desempenho para o uso que você quer.'); }
  else if (folga >= -1.5) { pontos += 0; motivos.push('O desempenho está no limite para o uso pretendido. Um upgrade pode resolver.'); }
  else { pontos -= 2; motivos.push('Para o uso pretendido, o equipamento já está defasado. Mesmo consertado, deve ficar abaixo do esperado.'); }

  switch (R.problema) {
    case 'lento': pontos += 2; motivos.push('Lentidão quase sempre se resolve com SSD, mais memória e limpeza do sistema, por uma fração do preço de um novo.'); break;
    case 'quente': pontos += 3; motivos.push('Superaquecimento costuma se resolver com limpeza e troca de pasta térmica, um serviço barato perto do valor do equipamento.'); break;
    case 'sistema': pontos += 3; motivos.push('Vírus e erros de Windows se resolvem com limpeza ou formatação com backup.'); break;
    case 'bateria': pontos += R.tipo === 'Notebook' ? 2 : 1; motivos.push('Bateria e carregador são peças de reposição comuns.'); break;
    case 'carcaca': pontos += 1; motivos.push('Carcaça, dobradiça e teclado têm reposição para a maioria dos modelos. O custo depende de encontrar a peça.'); break;
    case 'tela': pontos += idade >= 3 ? -1 : 1; motivos.push(idade >= 3 ? 'Tela de notebook é uma das peças mais caras. Em equipamento antigo, pode chegar perto do valor dele.' : 'Telas são substituíveis. Vale orçar a peça para o seu modelo.'); break;
    case 'placa': pontos -= idade >= 3 ? 2 : 0; motivos.push('Defeito de placa precisa de diagnóstico: às vezes é um componente simples, às vezes o reparo não compensa.' + (idade >= 3 ? ' Na sua idade de equipamento, a troca entra forte na conta.' : '')); break;
    default: break;
  }
  if (idade >= 4) { pontos -= 1; motivos.push('Com mais de 10 anos, peças ficam difíceis de achar e o sistema pode não ter mais suporte.'); }
  if (R.tipo === 'Desktop') { pontos += 1; motivos.push('Computador de mesa é fácil de atualizar peça por peça: dá para trocar só o que limita.'); }

  let v;
  if (pontos >= 3) v = ['Consertar', '#34d399', 'O reparo é a escolha mais econômica.'];
  else if (pontos >= 1) v = ['Consertar + upgrade', '#22d3ee', 'Conserte e aproveite para colocar SSD/memória: deve ganhar mais alguns anos de uso.'];
  else if (pontos >= -1) v = ['Avaliar antes de decidir', '#fbbf24', 'Depende do orçamento do reparo. Peça o diagnóstico e compare com o preço de um equivalente novo.'];
  else v = ['Considere trocar', '#f87171', 'O reparo tende a não compensar. Aproveite para recuperar seus arquivos do equipamento antigo.'];
  return { v, motivos };
}

function resultado() {
  window.MetricasSite?.registrar('ferramenta_concluida', 'consertar-ou-trocar');
  const { v, motivos } = decidir();
  const txt = `CONSERTAR OU TROCAR — ${R.tipo}, faixa de idade ${R.idade}/4, linha ${R.linha}, problema ${R.problema}, uso ${R.uso}\nResultado: ${v[0]}`;
  app.innerHTML = `<div class="card"><span class="passo-ferr">recomendação</span><div class="veredito" style="color:${v[1]}">${v[0]}</div><p>${esc(v[2])}</p>
    <h3 style="margin-top:18px">Por quê</h3><ul class="lista-check">${motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <div class="callout" style="margin-top:14px">Regra prática: se o reparo passar de <b>metade do preço de um equivalente novo</b> e o equipamento já estiver defasado, a troca costuma valer mais. Se for trocar, <b>recupere os arquivos</b> do antigo antes.</div>
    <div class="ferr-nav"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="refazer">Refazer</button><button class="btn" id="copiar">Copiar</button></div>
      <button class="btn btn-pri" id="enviar">${v[0] === 'Considere trocar' ? 'Quero ajuda para escolher' : 'Pedir orçamento do reparo'}</button></div></div>`;
  app.querySelector('#refazer').onclick = () => { for (const k in R) delete R[k]; i = 0; pergunta(); };
  app.querySelector('#copiar').onclick = (e) => copiar(txt, e.target);
  app.querySelector('#enviar').onclick = () => enviarAoTecnico({ servico: v[0] === 'Considere trocar' ? 'Orientação de compra' : 'Conserto / orçamento', equipamento: R.tipo, problema: PERG[3].o.find((x) => x[0] === R.problema)[1], detalhe: txt });
}

pergunta();
