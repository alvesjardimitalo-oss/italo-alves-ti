// Crediário (vendas parceladas) — vindo do Revendi.
// O bot só LÊ o crediário em ti/base/crediario (uma parcela por documento). Quem grava lá é a
// sincronização com o Revendi (revendi.js), quando a API estiver configurada.
//
// Formato de cada documento (parcela):
//   cliente, whatsapp, venda (id/código da venda), numero (1..n), total (n parcelas),
//   valor (R$), vencimento (AAAA-MM-DD), pagoEm (AAAA-MM-DD ou ""), origem ("revendi"), revendiId
import * as C from "./consorcio.js";

export const hojeISO = () => C.agoraSP().data;
export const aberta = (p) => !p.pagoEm;
export const venceHoje = (p) => aberta(p) && p.vencimento === hojeISO();
export const atrasada = (p) => aberta(p) && String(p.vencimento) < hojeISO();
export const daquiADias = (p, n) => {
  const alvo = new Date(Date.parse(hojeISO() + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  return aberta(p) && p.vencimento > hojeISO() && p.vencimento <= alvo;
};

/** Agrupa parcelas por cliente (pelo WhatsApp, ou pelo nome se não houver). */
export function porCliente(parcelas) {
  const mapa = new Map();
  for (const p of parcelas) {
    const k = C.chaveTel(p.whatsapp) || String(p.cliente || "").toLowerCase();
    if (!mapa.has(k)) mapa.set(k, { cliente: p.cliente, whatsapp: p.whatsapp, parcelas: [] });
    mapa.get(k).parcelas.push(p);
  }
  return [...mapa.values()].map((c) => {
    const abertas = c.parcelas.filter(aberta).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    const atrasadas = abertas.filter(atrasada);
    return { ...c, abertas, atrasadas, devendo: abertas.reduce((t, p) => t + (Number(p.valor) || 0), 0), emAtraso: atrasadas.reduce((t, p) => t + (Number(p.valor) || 0), 0) };
  });
}

export function resumo(parcelas) {
  const abertas = parcelas.filter(aberta);
  const soma = (xs) => xs.reduce((t, p) => t + (Number(p.valor) || 0), 0);
  const hoje = abertas.filter(venceHoje), atr = abertas.filter(atrasada);
  return { aReceber: soma(abertas), hoje: soma(hoje), qtdHoje: hoje.length, atraso: soma(atr), qtdAtraso: atr.length,
    clientesAtraso: porCliente(atr).length, semana: soma(abertas.filter((p) => daquiADias(p, 7))) };
}

export function mensagemCrediario(c, lista) {
  const itens = lista.map((p) => `${p.numero}/${p.total} de ${C.brl(p.valor)} (venc. ${C.dataBR(p.vencimento)})`).join(", ");
  const total = lista.reduce((t, p) => t + (Number(p.valor) || 0), 0);
  const vencida = lista.some(atrasada);
  return `Oi, ${C.primeiroNome(c.cliente)}! Aqui é a Karen 💝 ` + (vencida ? "Passando para lembrar, com carinho, da" : "Lembrete da") +
    ` parcela da sua compra: ${itens}` + (lista.length > 1 ? `, total de ${C.brl(total)}` : "") + ". Se já pagou, me manda o comprovante. Obrigada! 🌸";
}
