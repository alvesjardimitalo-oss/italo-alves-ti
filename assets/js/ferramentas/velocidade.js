// Teste de velocidade: latência e download (baixando arquivos do próprio site, sem serviço externo).
import { esc, enviarAoTecnico } from './comum.js';

const app = document.getElementById('app-ferramenta');
const raiz = document.documentElement.dataset.raiz || '../';
const ARQ = raiz + 'assets/speedtest/5mb.bin';
const PING = raiz + 'assets/img/logo.svg';

app.innerHTML = `<div class="card" style="text-align:center">
  <div class="medidor-valor" id="valor">—</div><div class="medidor-unid" id="unid">Mbps</div>
  <div class="dados-aparelho" style="margin:20px 0">
    <div class="dado"><span>Download</span><b id="d-down">—</b></div>
    <div class="dado"><span>Latência</span><b id="d-ping">—</b></div>
    <div class="dado"><span>Variação (jitter)</span><b id="d-jit">—</b></div>
  </div>
  <button class="btn btn-pri" id="iniciar">Iniciar teste</button>
  <p class="sub" id="status" style="margin-top:12px">O teste baixa até ~25 MB. No plano de dados do celular, prefira o Wi-Fi.</p>
</div><div id="interp"></div>`;

const $ = (s) => app.querySelector(s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function latencia() {
  const t = [];
  for (let i = 0; i < 8; i++) {
    const ini = performance.now();
    await fetch(PING + '?p=' + Math.random(), { cache: 'no-store' });
    t.push(performance.now() - ini);
    await espera(80);
  }
  t.sort((a, b) => a - b);
  const uteis = t.slice(1, -1);
  const media = uteis.reduce((s, x) => s + x, 0) / uteis.length;
  const jitter = uteis.slice(1).reduce((s, x, k) => s + Math.abs(x - uteis[k]), 0) / (uteis.length - 1);
  return { ping: Math.round(t[1]), jitter: Math.round(jitter), media };
}

async function baixar(onParcial) {
  let bytes = 0;
  const ini = performance.now();
  const limiteMs = 9000;
  let rodadas = 0;
  while (performance.now() - ini < limiteMs && rodadas < 5) {
    const paralelo = rodadas === 0 ? 1 : 2;
    await Promise.all(Array.from({ length: paralelo }, async () => {
      const r = await fetch(ARQ + '?d=' + Math.random(), { cache: 'no-store' });
      const leitor = r.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        bytes += value.length;
        const seg = (performance.now() - ini) / 1000;
        onParcial((bytes * 8) / seg / 1e6);
        if (performance.now() - ini > limiteMs + 3000) { leitor.cancel(); break; }
      }
    }));
    rodadas += paralelo;
  }
  const seg = (performance.now() - ini) / 1000;
  return (bytes * 8) / seg / 1e6;
}

function interpretar(down, ping) {
  const n = [];
  if (down < 5) n.push(['alto', 'Internet muito lenta', 'Abaixo de 5 Mbps, até vídeos e chamadas travam. Teste perto do roteador e em outro aparelho. Se continuar baixo, o problema está no plano ou na operadora.']);
  else if (down < 20) n.push(['medio', 'Internet básica', 'Dá para navegar e assistir vídeos, mas várias pessoas usando ao mesmo tempo vão sentir. Compare com a velocidade contratada.']);
  else n.push(['baixo', 'Velocidade boa', 'Se mesmo assim o computador parece lento ao navegar, a causa provavelmente está nele (disco, memória, vírus) e não na internet.']);
  if (ping > 100) n.push(['medio', 'Latência alta', 'Tempo de resposta alto deixa sites "pensando" e atrapalha jogos e chamadas. Wi-Fi longe do roteador e muitos aparelhos conectados pioram isso.']);
  n.push(['baixo', 'Compare no cabo e no Wi-Fi', 'Se pelo cabo dá bem mais do que pelo Wi-Fi, o gargalo é o sinal ou a placa de rede do aparelho.']);
  return n;
}

$('#iniciar').onclick = async () => {
  const b = $('#iniciar');
  b.disabled = true;
  try {
    $('#status').textContent = 'Medindo latência…';
    const l = await latencia();
    $('#d-ping').textContent = l.ping + ' ms';
    $('#d-jit').textContent = l.jitter + ' ms';
    $('#status').textContent = 'Medindo download…';
    const down = await baixar((v) => { $('#valor').textContent = v.toFixed(v < 10 ? 1 : 0); });
    $('#valor').textContent = down.toFixed(down < 10 ? 1 : 0);
    $('#d-down').textContent = down.toFixed(1) + ' Mbps';
    $('#status').textContent = 'Teste concluído. Upload não é medido aqui.';
    const its = interpretar(down, l.ping);
    $('#interp').innerHTML = `<div class="card" style="margin-top:18px"><span class="passo-ferr">o que significa</span>
      ${its.map(([nv, t, x]) => `<div class="laudo-item"><span class="nivel ${nv}">${{ alto: 'alto', medio: 'médio', baixo: 'ok' }[nv]}</span><div><h3>${esc(t)}</h3><p>${esc(x)}</p></div></div>`).join('')}
      <div class="ferr-nav"><a class="btn" href="../dicas/wifi-nao-conecta.html">Dicas de Wi-Fi</a><button class="btn btn-pri" id="ajuda">Pedir ajuda com a rede</button></div></div>`;
    $('#ajuda').onclick = () => enviarAoTecnico({ servico: 'Rede / Wi-Fi', problema: 'Wi-Fi cai / internet lenta', detalhe: `TESTE DE VELOCIDADE — download ${down.toFixed(1)} Mbps · latência ${l.ping} ms · jitter ${l.jitter} ms` });
  } catch (e) {
    $('#status').textContent = 'Não foi possível concluir o teste. Verifique a conexão e tente de novo.';
  }
  b.disabled = false;
  b.textContent = 'Testar de novo';
};
