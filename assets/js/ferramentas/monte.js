// Monte seu PC: configuração equilibrada por objetivo e faixa de investimento (sem preços: mudam toda semana).
import { enviarAoTecnico, copiar, esc } from './comum.js';

const app = document.getElementById('app-ferramenta');
const R = { obj: null, faixa: null };

const OBJ = [
  ['estudo', 'Estudo e escritório', 'internet, Office, vídeos, sistemas'],
  ['trabalho', 'Trabalho pesado', 'muitas abas, planilhas grandes, programação'],
  ['jogos', 'Jogos em Full HD', 'jogos atuais em 1080p'],
  ['jogos+', 'Jogos e streaming', '1440p, altas taxas de quadros, lives'],
  ['edicao', 'Edição de vídeo / 3D', 'Premiere, DaVinci, Blender'],
];
const FAIXA = [['eco', 'Econômica', 'o essencial bem feito'], ['eq', 'Equilibrada', 'melhor custo-benefício'], ['top', 'Caprichada', 'folga para muitos anos']];

// cpu, gpu, ram, ssd, fonte, extra — descrições genéricas de categoria (modelos mudam rápido)
const BASE = {
  estudo: {
    eco: ['4 a 6 núcleos com vídeo integrado (linha Ryzen 3/5 com gráfico "G" ou Core i3/i5 recente)', 'Vídeo integrado do processador', '8 GB (ideal 2×4 GB, dual channel)', 'SSD NVMe 256–500 GB', '400–450 W com certificação 80 Plus', ''],
    eq: ['6 núcleos com vídeo integrado (Ryzen 5 "G" / Core i5 recente)', 'Vídeo integrado do processador', '16 GB (2×8 GB)', 'SSD NVMe 500 GB', '450–550 W 80 Plus Bronze', 'Wi-Fi na placa-mãe ou adaptador'],
    top: ['6–8 núcleos de geração atual', 'Vídeo integrado (ou placa de entrada para 2–3 monitores)', '16–32 GB', 'SSD NVMe 1 TB', '550 W 80 Plus Bronze/Gold', 'Gabinete silencioso, Wi-Fi 6'],
  },
  trabalho: {
    eco: ['6 núcleos de geração recente', 'Vídeo integrado', '16 GB (2×8 GB)', 'SSD NVMe 500 GB', '450–550 W 80 Plus Bronze', ''],
    eq: ['8 núcleos de geração recente (Ryzen 7 / Core i7 / Core Ultra 7)', 'Integrado ou placa de entrada para múltiplos monitores', '32 GB (2×16 GB)', 'SSD NVMe 1 TB', '550–650 W 80 Plus Bronze/Gold', 'Bom cooler para o processador'],
    top: ['8–12 núcleos de geração atual', 'Placa de vídeo intermediária (se usar aceleração por GPU)', '32–64 GB', 'SSD NVMe 1–2 TB (Gen4)', '650 W 80 Plus Gold', 'Nobreak recomendado'],
  },
  jogos: {
    eco: ['6 núcleos de geração recente', 'Placa de vídeo de entrada para 1080p com 8 GB de memória', '16 GB (2×8 GB)', 'SSD NVMe 500 GB–1 TB', '550 W 80 Plus Bronze', 'Gabinete com boa ventilação'],
    eq: ['6–8 núcleos de geração atual', 'Placa de vídeo intermediária para 1080p alto/ultra (8–12 GB)', '16–32 GB (2 pentes)', 'SSD NVMe 1 TB', '650 W 80 Plus Bronze/Gold', 'Air cooler de torre'],
    top: ['8 núcleos de geração atual, linha focada em jogos', 'Placa de vídeo intermediária-alta (12 GB ou mais)', '32 GB (2×16 GB)', 'SSD NVMe 1–2 TB (Gen4)', '750 W 80 Plus Gold', 'Monitor 144 Hz para aproveitar'],
  },
  'jogos+': {
    eco: ['6–8 núcleos de geração atual', 'Placa de vídeo intermediária (12 GB)', '32 GB (2×16 GB)', 'SSD NVMe 1 TB', '650–750 W 80 Plus Gold', 'Air cooler de torre'],
    eq: ['8 núcleos de geração atual', 'Placa de vídeo intermediária-alta (12–16 GB)', '32 GB (2×16 GB)', 'SSD NVMe 2 TB (Gen4)', '750–850 W 80 Plus Gold', 'Gabinete com fluxo de ar frontal'],
    top: ['8+ núcleos topo de linha para jogos', 'Placa de vídeo topo de linha (16 GB ou mais)', '32–64 GB', 'SSD NVMe 2 TB (Gen4/Gen5)', '850–1000 W 80 Plus Gold', 'Water cooler ou air cooler premium'],
  },
  edicao: {
    eco: ['8 núcleos de geração recente', 'Placa de vídeo intermediária com 8–12 GB (acelera a renderização)', '32 GB (2×16 GB)', 'SSD NVMe 1 TB + HD para arquivo', '650 W 80 Plus Bronze/Gold', ''],
    eq: ['8–12 núcleos de geração atual', 'Placa de vídeo intermediária-alta (12–16 GB)', '64 GB (2×32 GB)', 'SSD NVMe 1 TB (sistema) + 2 TB (projetos)', '750 W 80 Plus Gold', 'Monitor com boa fidelidade de cores'],
    top: ['12–16 núcleos de geração atual', 'Placa de vídeo topo de linha (16 GB ou mais)', '64–128 GB', 'SSD NVMe 2 TB Gen4 + 4 TB para projetos', '850–1000 W 80 Plus Gold', 'Nobreak e backup automático'],
  },
};

function desenhar() {
  app.innerHTML = `<div class="card"><span class="passo-ferr">1. objetivo</span><h2>Para que vai usar?</h2>
      <div class="opcoes-grandes">${OBJ.map(([v, t, s]) => `<button class="opc ${R.obj === v ? 'sel' : ''}" data-o="${v}">${t}<small>${s}</small></button>`).join('')}</div></div>
    <div class="card"><span class="passo-ferr">2. investimento</span><h2>Qual faixa?</h2>
      <div class="opcoes-grandes">${FAIXA.map(([v, t, s]) => `<button class="opc ${R.faixa === v ? 'sel' : ''}" data-f="${v}">${t}<small>${s}</small></button>`).join('')}</div></div>
    <div id="cfg"></div>`;
  app.querySelectorAll('[data-o]').forEach((b) => b.onclick = () => { R.obj = b.dataset.o; desenhar(); });
  app.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { R.faixa = b.dataset.f; desenhar(); });
  if (R.obj && R.faixa) config();
}

function config() {
  const c = BASE[R.obj][R.faixa];
  const nomes = ['Processador', 'Placa de vídeo', 'Memória RAM', 'Armazenamento', 'Fonte', 'Extras'];
  const objT = OBJ.find((x) => x[0] === R.obj)[1];
  const faixaT = FAIXA.find((x) => x[0] === R.faixa)[1];
  const txt = `MONTE SEU PC — ${objT} · ${faixaT}\n` + nomes.map((n, k) => (c[k] ? `${n}: ${c[k]}` : '')).filter(Boolean).join('\n');
  const el = app.querySelector('#cfg');
  el.innerHTML = `<div class="card"><span class="passo-ferr">configuração sugerida</span><h2>${esc(objT)} · ${esc(faixaT)}</h2>
    <table class="config-tabela">${nomes.map((n, k) => (c[k] ? `<tr><td>${n}</td><td>${esc(c[k])}</td></tr>` : '')).join('')}
      <tr><td>Placa-mãe</td><td>Compatível com o processador, com espaço para ampliar a memória e um segundo SSD</td></tr>
      <tr><td>Gabinete</td><td>Com boa entrada de ar frontal; vidro lateral é opcional</td></tr></table>
    <p class="sub" style="margin-top:12px">As descrições são por categoria porque modelos e preços mudam toda semana. Na hora de comprar, eu indico as peças exatas com o melhor preço do momento e confiro a compatibilidade de tudo.</p>
    <div class="ferr-nav"><button class="btn" id="copiar">Copiar configuração</button><button class="btn btn-pri" id="enviar">Quero que o Ítalo monte</button></div></div>`;
  el.querySelector('#copiar').onclick = (e) => copiar(txt, e.target);
  el.querySelector('#enviar').onclick = () => enviarAoTecnico({ servico: 'Montagem de computador', equipamento: 'Computador (desktop)', problema: 'Montagem nova', detalhe: txt });
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

desenhar();
