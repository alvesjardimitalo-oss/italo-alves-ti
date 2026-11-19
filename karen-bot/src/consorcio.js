// Regras do consórcio — as mesmas do painel (assets/js/views/consorcios.js), no fuso de São Paulo.
const FUSO = "America/Sao_Paulo";
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const URL_RENOVACAO = "https://italoinfotec.com.br/karen/sacola-misteriosa/renovacao/";
export const URL_RESERVA = "https://italoinfotec.com.br/karen/consorcio/";
export const URL_PAINEL = "https://italoinfotec.com.br/sistema.html#/karen/grupos";

/** Partes da data/hora atual em São Paulo. */
export function agoraSP(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute, data: `${p.year}-${p.month}-${p.day}`, ym: `${p.year}-${p.month}` };
}
export const mesAtual = () => agoraSP().ym;
export function somarMes(ym, n) {
  const [a, m] = ym.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
}
export const rotuloMes = (ym, longo = false) => { const [a, m] = String(ym).split("-").map(Number); return longo ? `${MESES[m - 1]} ${a}` : `${CURTO[m - 1]}/${String(a).slice(2)}`; };
export const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export const soNumeros = (v) => String(v || "").replace(/\D/g, "");
export const fone = (v) => { let d = soNumeros(v); if (d.length > 11 && d.startsWith("55")) d = d.slice(2); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
export function linkWhats(tel, texto) {
  let d = soNumeros(tel);
  if (d.length < 10) return "";
  if (d.length <= 11) d = "55" + d;
  return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : "");
}
export const dataBR = (iso) => { const s = String(iso || "").slice(0, 10).split("-"); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : ""; };

export const mesesDo = (g) => (g.inicio && g.parcelas > 0) ? Array.from({ length: g.parcelas }, (_, i) => somarMes(g.inicio, i)) : [];
export const fimDo = (g) => (g.inicio && g.parcelas > 0) ? somarMes(g.inicio, g.parcelas - 1) : "";
export function situacao(g) {
  if (!g.inicio) return "formando";
  const hoje = mesAtual();
  if (hoje < g.inicio) return "formando";
  if (hoje > fimDo(g)) return "encerrado";
  return "andamento";
}
export const ROTULO = { formando: "🟦 Formando", andamento: "🟩 Em andamento", encerrado: "⬜ Encerrado" };

export function mesesDevidos(g) {
  const { ym, dia } = agoraSP();
  const venc = Number(g.vencimento) || 10;
  return mesesDo(g).filter((m) => m < ym || (m === ym && dia > venc));
}
export function resumoMembro(g, m) {
  const pagos = m.pagos || {};
  const meses = mesesDo(g);
  const pagas = meses.filter((x) => pagos[x]).length;
  const atrasadas = mesesDevidos(g).filter((x) => !pagos[x]);
  const abertas = meses.filter((x) => !pagos[x]);
  return { pagas, total: meses.length, atrasadas, abertas, quitado: meses.length > 0 && pagas === meses.length };
}
export function resumoGrupo(g) {
  const membros = g.membros || [];
  const valor = Number(g.valorParcela) || 0;
  const hoje = mesAtual();
  const meses = mesesDo(g);
  let pagas = 0, atrasadas = 0;
  const comAtraso = [];
  membros.forEach((m) => { const r = resumoMembro(g, m); pagas += r.pagas; atrasadas += r.atrasadas.length; if (r.atrasadas.length) comAtraso.push({ m, r }); });
  const idx = meses.indexOf(hoje);
  return {
    membros: membros.length, arrecadado: pagas * valor, previsto: membros.length * meses.length * valor,
    emAtraso: atrasadas * valor, comAtraso,
    parcelaAtual: idx >= 0 ? idx + 1 : (hoje > fimDo(g) ? meses.length : 0),
    pagosNoMes: idx >= 0 ? membros.filter((m) => (m.pagos || {})[hoje]).length : 0,
    faltamNoMes: idx >= 0 ? membros.filter((m) => !(m.pagos || {})[hoje]) : [],
    resgataram: membros.filter((m) => m.resgatadoEm).length,
  };
}
export const nomeGrupo = (g) => `Consórcio ${g.codigo} · ${brl(g.valorParcela)} · ${g.inicio ? rotuloMes(g.inicio, true) + " a " + rotuloMes(fimDo(g), true) : "datas a definir"}`;
export const ordenarGrupos = (gs) => gs.slice().sort((a, b) => String(b.inicio || "9999").localeCompare(String(a.inicio || "9999")) || String(b.codigo).localeCompare(String(a.codigo)));

export function mensagemCobranca(g, m, atrasadas) {
  const lista = atrasadas.map((ym) => rotuloMes(ym, true)).join(", ");
  return `Oi, ${primeiroNome(m.nome)}! Aqui é a Karen 💝 Passando para lembrar, com carinho, da parcela do Consórcio ${g.codigo} (${brl(g.valorParcela)}) referente a ${lista}` +
    (atrasadas.length > 1 ? `, total de ${brl(atrasadas.length * g.valorParcela)}` : "") + ". Se já pagou, me manda o comprovante que eu dou baixa. Obrigada! 🌸";
}
export function mensagemRenovacao(g, m) {
  const fim = situacao(g) === "encerrado";
  return `Oi, ${primeiroNome(m.nome)}! Aqui é a Karen 💝 Muito obrigada por ${fim ? "ter participado" : "fazer parte"} do nosso Consórcio ${g.codigo}! ` +
    `Já estamos organizando o próximo grupo e quem participa tem prioridade na vaga. Conta pra mim como ${fim ? "foi" : "está sendo"} e se quer garantir a sua, ` +
    `é sem compromisso e leva menos de 2 minutos: ${URL_RENOVACAO}?g=${encodeURIComponent(g.codigo)}`;
}
export function mensagemRecibo(g, m, ym) {
  const r = resumoMembro(g, m);
  return `Oi, ${primeiroNome(m.nome)}! Recebi sua parcela de ${rotuloMes(ym, true)} do Consórcio ${g.codigo} (${brl(g.valorParcela)}). ` +
    `Você está com ${r.pagas} de ${r.total} parcelas pagas. Obrigada! 💝`;
}

/** Tira as marcações internas ([ref:..], [cupom:..], [vagas:..] etc.) do texto que vai para o Discord. */
export const semMarcas = (t) => String(t || "").replace(/\s*\[[^\]]*\]/g, "").trim();
