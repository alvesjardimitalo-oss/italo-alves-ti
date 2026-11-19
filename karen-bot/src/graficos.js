// Gráficos em PNG para os relatórios do Discord. O desenho é feito pelo QuickChart (Chart.js) e a
// imagem é anexada na mensagem — fica guardada no Discord, não depende do link depois.
// Só vão números e nomes de produtos/marcas/grupos: nenhum nome ou telefone de cliente sai do PC.
// Se o QuickChart falhar, o relatório sai normal, só sem o gráfico.
//
// Paleta validada (fundo escuro do Discord, daltonismo e contraste): período atual #d55181, anterior #3987e5.
const URL_QC = process.env.GRAFICOS_URL || "https://quickchart.io/chart";
const DESLIGADO = String(process.env.GRAFICOS || "").toLowerCase() === "nao";
export const COR = { atual: "#d55181", anterior: "#3987e5", fundo: "#1a1a19", texto: "#f0efec", texto2: "#c3c2b7", grade: "#2f2f2c" };

const BRL = "function(v){return 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0})}";
const BRL_TIP = "function(t,d){var v=t.yLabel!==undefined&&t.yLabel!==''?t.yLabel:t.xLabel;return d.datasets[t.datasetIndex].label+': R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}";
const PCT = "function(v){return v+'%'}";
const FUNCOES = { "__BRL__": BRL, "__BRL_TIP__": BRL_TIP, "__PCT__": PCT };
/** JSON com funções: troca os marcadores "__X__" pelo código da função (o QuickChart aceita o gráfico como texto JS). */
export const comoTexto = (config) => JSON.stringify(config).replace(/"(__[A-Z_]+__)"/g, (m, k) => FUNCOES[k] || m);

const eixo = (extra = {}) => ({ gridLines: { color: COR.grade, zeroLineColor: COR.grade, drawBorder: false }, ticks: { fontColor: COR.texto2, fontSize: 13, ...extra } });
const base = (titulo, legenda) => ({
  title: { display: Boolean(titulo), text: titulo, fontColor: COR.texto, fontSize: 18, fontStyle: "bold", padding: 14 },
  legend: { display: legenda, position: "top", align: "end", labels: { fontColor: COR.texto2, fontSize: 13, boxWidth: 12, usePointStyle: true } },
  layout: { padding: { left: 8, right: 18, top: 4, bottom: 4 } },
  plugins: { datalabels: { display: false } },
});

/** Barras por dia: período atual × anterior (mesmo tamanho), alinhados pelo dia do período. */
export function configDiario(titulo, rotulos, atual, anterior, nomes = ["Este período", "Período anterior"]) {
  const ds = [{ label: nomes[0], data: atual, backgroundColor: COR.atual }];
  if (anterior) ds.push({ label: nomes[1], data: anterior, backgroundColor: COR.anterior });
  return { type: "bar", data: { labels: rotulos, datasets: ds.map((d) => ({ ...d, borderWidth: 0, barPercentage: 0.85, categoryPercentage: 0.7 })) },
    options: { ...base(titulo, ds.length > 1), tooltips: { callbacks: { label: "__BRL_TIP__" } },
      scales: { xAxes: [{ ...eixo({ maxRotation: 0, autoSkipPadding: 8 }), gridLines: { display: false } }], yAxes: [eixo({ beginAtZero: true, maxTicksLimit: 6, callback: "__BRL__" })] } } };
}
/** Barras horizontais de uma série só (ranking). `formato`: "brl" | "un" | "pct". Rótulo do valor na ponta. */
export function configRanking(titulo, rotulos, valores, formato = "brl") {
  const fmt = formato === "brl" ? "function(v){return 'R$ '+Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}"
    : formato === "pct" ? "function(v){return v+'%'}" : "function(v){return v+' un'}";
  const cfg = { type: "horizontalBar", data: { labels: rotulos, datasets: [{ label: titulo, data: valores, backgroundColor: COR.atual, borderWidth: 0, barPercentage: 0.8, categoryPercentage: 0.8 }] },
    options: { ...base(titulo, false), layout: { padding: { left: 8, right: 60, top: 4, bottom: 4 } }, scales: { xAxes: [eixo({ beginAtZero: true, maxTicksLimit: 5, ...(formato === "pct" ? { max: 100, callback: "__PCT__" } : formato === "brl" ? { callback: "__BRL__" } : {}) })],
      yAxes: [{ ...eixo({ fontColor: COR.texto, fontSize: 13 }), gridLines: { display: false } }] },
      plugins: { datalabels: { display: true, anchor: "end", align: "end", color: COR.texto, font: { size: 13, weight: "bold" }, formatter: "__FMT__" } } } };
  return { cfg, extra: { "__FMT__": fmt } };
}

let avisado = false;
/** Desenha e devolve o PNG (Buffer), ou null se não deu. */
export async function desenhar(config, { largura = 900, altura = 420, extra = {}, log = () => {} } = {}) {
  if (DESLIGADO) return null;
  try {
    let chart = comoTexto(config);
    for (const [k, f] of Object.entries(extra)) chart = chart.replace(`"${k}"`, f);
    const r = await fetch(URL_QC, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ version: "2", backgroundColor: COR.fundo, width: largura, height: altura, devicePixelRatio: 2, format: "png", chart }) });
    if (!r.ok) throw new Error("QuickChart respondeu " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500 || buf[0] !== 0x89) throw new Error("imagem inválida");
    avisado = false;
    return buf;
  } catch (e) {
    if (!avisado) { log("gráfico não saiu (o relatório vai sem ele): " + e.message); avisado = true; }
    return null;
  }
}
/** Corta nomes longos para caber no eixo. */
export const rotulo = (t, n = 34) => { const s = String(t || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
