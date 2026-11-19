// Sincronização Revendi → Firebase. SÓ LEITURA no Revendi.
// Baseado no exemplo oficial do suporte do Revendi (poc-integracao, 19/11/2026). Usa a API INTERNA
// do sistema (não é API pública): rotas e formatos podem mudar sem aviso. Se mudarem, a sincronização
// para, avisa em #logs-do-bot e o resto do bot continua normal.
//
// Autenticação: POST /auth/password { username, password } → { token (1 dia), refresh_token: { id, expires_in } (30 dias) }
//               POST /auth/refresh-token { refresh_token } → { token }   (não renova o refresh; após 30 dias, login de novo)
// Parcelas:     GET /financial-v2/transactions?type=income&categoryId=sales&periodType=custom&dateFrom&dateTo&dateReference=due&status&page&limit
//               crediário = payment_method "installment_credit" ou "fiado"
// Vendas:       GET /sales-v2?start&end&limit&offset
//
// Grava:  ti/base/crediario/rv-<id>   uma parcela por documento (cliente, WhatsApp, valor, vencimento, pago)
//         ti/base/botKaren/revendiVendas   só totais por dia (quantidade e valor), sem dados de clientes
// E-mail e senha ficam SÓ no .env do PC (REVENDI_EMAIL / REVENDI_SENHA). Use o usuário de integração (só leitura).
import fs from "node:fs";
import path from "node:path";
import * as db from "./firestore.js";
import { agoraSP } from "./consorcio.js";

const ATIVO = String(process.env.REVENDI_ATIVO || "").toLowerCase() === "sim";
const BASE_URL = String(process.env.REVENDI_API_URL || "https://api.revendi.app/api").replace(/\/$/, "");
const EMAIL = process.env.REVENDI_EMAIL || "";
const SENHA = process.env.REVENDI_SENHA || process.env.REVENDI_PASSWORD || "";
const INTERVALO = Math.max(15, Number(process.env.REVENDI_MINUTOS || 30)) * 60000;
const DDD_PADRAO = String(process.env.REVENDI_DDD_PADRAO || "33");
const DIAS_ATRAS = 180, DIAS_FRENTE = 150; // janela de vencimentos lida a cada sincronização
const UA = "karen-bot";
const ARQ = path.join(process.env.KAREN_BOT_DATA || path.resolve("dados"), "revendi-sessao.json");
const CREDIARIO = new Set(["installment_credit", "fiado"]);

let ultima = 0, ultimoErro = "", ultimoOk = "";
let sessao = (() => { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return null; } })();
const guardar = () => { try { fs.writeFileSync(ARQ, JSON.stringify(sessao)); } catch {} };

export const revendiAtivo = () => ATIVO && Boolean(EMAIL && SENHA);
export const estadoRevendi = () => ({ ativo: revendiAtivo(), ultimaTentativa: ultima ? new Date(ultima).toISOString() : "", ultimoOk, ultimoErro });

// ---------------------------------------------------------------- autenticação
async function login() {
  const r = await fetch(`${BASE_URL}/auth/password`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ username: EMAIL, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login no Revendi falhou (${r.status}) — confira REVENDI_EMAIL e REVENDI_SENHA`);
  const d = await r.json();
  if (!d.token || !d.refresh_token?.id) throw new Error("o Revendi mudou a resposta do login");
  sessao = { token: d.token, refresh: d.refresh_token.id, refreshExpira: Number(d.refresh_token.expires_in || 0) * 1000 || Date.now() + 29 * 864e5, tokenEm: Date.now() };
  guardar();
}
async function renovar() {
  if (!sessao?.refresh || Date.now() > sessao.refreshExpira - 3600e3) return login();
  const r = await fetch(`${BASE_URL}/auth/refresh-token`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({ refresh_token: sessao.refresh }),
  });
  if (!r.ok) return login();
  const d = await r.json();
  if (!d.token) return login();
  sessao.token = d.token; sessao.tokenEm = Date.now(); guardar();
}
async function get(caminho, params = {}) {
  if (!sessao?.token) await login();
  else if (Date.now() - (sessao.tokenEm || 0) > 22 * 3600e3) await renovar(); // token vale 1 dia: renova antes
  const url = new URL(BASE_URL + caminho);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const pedir = () => fetch(url, { headers: { authorization: `Bearer ${sessao.token}`, "user-agent": UA, accept: "application/json" } });
  let r = await pedir();
  if (r.status === 401) { await renovar(); r = await pedir(); }
  if (!r.ok) throw new Error(`GET ${caminho} falhou (${r.status})`);
  return r.json();
}

// ---------------------------------------------------------------- consultas (iguais ao exemplo do suporte)
async function listarParcelas(inicio, fim) {
  const limit = 100, todas = [];
  for (let page = 1; page <= 100; page++) {
    const d = await get("/financial-v2/transactions", { type: "income", categoryId: "sales", periodType: "custom",
      dateFrom: inicio.toISOString(), dateTo: fim.toISOString(), dateReference: "due", status: "all", page, limit });
    if (!d || !Array.isArray(d.rows)) throw new Error("o Revendi mudou o formato das parcelas");
    todas.push(...d.rows);
    if (todas.length >= Number(d.totalRecords || 0) || d.rows.length === 0) break;
  }
  return todas.filter((p) => CREDIARIO.has(p.payment_method));
}
async function listarVendas(inicio, fim) {
  const limit = 100, todas = [];
  for (let offset = 0; offset < 10000; offset += limit) {
    const pagina = await get("/sales-v2", { start: inicio.toISOString(), end: fim.toISOString(), limit, offset });
    if (!Array.isArray(pagina)) throw new Error("o Revendi mudou o formato das vendas");
    todas.push(...pagina);
    if (pagina.length < limit) break;
  }
  return todas;
}

// ---------------------------------------------------------------- conversão
/** Telefone do Revendi (formato livre) → 55 + DDD + número. Sem DDD, assume o DDD padrão (33). */
export function normalizarTelefone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 8) d = DDD_PADRAO + "9" + d;      // celular antigo, sem o 9 e sem DDD
  else if (d.length === 9) d = DDD_PADRAO + d;      // sem DDD
  else if (d.length === 10 && /^[6-9]/.test(d.slice(2))) d = d.slice(0, 2) + "9" + d.slice(2); // celular sem o 9
  return d.length === 10 || d.length === 11 ? "55" + d : "";
}
const dia = (iso) => {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? String(iso).slice(0, 10) : new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};
/** Parcelas do Revendi → formato do crediario.js; número/total contados dentro da série (mesmo parcelamento). */
export function converterParcelas(rows) {
  const series = new Map();
  for (const p of rows) { const k = p.series_id || "venda-" + p.sale_id; if (!series.has(k)) series.set(k, []); series.get(k).push(p); }
  const out = [];
  for (const lista of series.values()) {
    lista.sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)) || a.id - b.id);
    lista.forEach((p, i) => {
      const c = p.sale?.client || {};
      out.push({ revendiId: String(p.id), cliente: String(c.name || "Cliente sem nome").slice(0, 80), whatsapp: normalizarTelefone(c.phone),
        venda: String(p.sale_id || ""), numero: i + 1, total: lista.length, valor: Math.round((Number(p.amount) || 0) * 100) / 100,
        vencimento: dia(p.expected_date), pagoEm: p.paid ? (dia(p.payment_date) || dia(p.updated_at) || agoraSP().data) : "" });
    });
  }
  return out;
}
export function totaisPorDia(vendas) {
  const dias = {};
  for (const v of vendas) {
    const d = dia(v.date || v.created_at);
    if (!d) continue;
    dias[d] = dias[d] || { qtd: 0, total: 0 };
    dias[d].qtd++; dias[d].total = Math.round((dias[d].total + (Number(v.value) || 0)) * 100) / 100;
  }
  return dias;
}

// ---------------------------------------------------------------- sincronização
/** Roda no ciclo do bot; respeita o intervalo. Devolve true se algo mudou. */
export async function sincronizarRevendi(log) {
  if (!revendiAtivo() || Date.now() - ultima < INTERVALO) return false;
  ultima = Date.now();
  try {
    const agora = new Date();
    const inicio = new Date(agora.getTime() - DIAS_ATRAS * 864e5), fim = new Date(agora.getTime() + DIAS_FRENTE * 864e5);
    const novas = converterParcelas(await listarParcelas(inicio, fim));
    const atuais = new Map((await db.listar("crediario")).filter((p) => p.origem === "revendi").map((p) => [p.id, p]));
    const vistos = new Set();
    let gravadas = 0, removidas = 0;
    for (const p of novas) {
      const id = "rv-" + p.revendiId.replace(/[^\w-]/g, "_");
      vistos.add(id);
      const a = atuais.get(id);
      const campos = { ...p, origem: "revendi" };
      if (a && Object.keys(campos).every((k) => String(a[k] ?? "") === String(campos[k]))) continue;
      await db.definir("crediario", id, { ...campos, sincronizadoEm: agora.toISOString() });
      gravadas++;
    }
    // Parcelas da janela que sumiram do Revendi (venda apagada ou forma de pagamento trocada).
    const ini = dia(inicio.toISOString()), fimD = dia(fim.toISOString());
    for (const [id, a] of atuais) {
      if (!vistos.has(id) && a.vencimento >= ini && a.vencimento <= fimD) { await db.remover("crediario", id); removidas++; }
    }
    // Vendas: só totais por dia dos últimos 40 dias (para o resumo e o relatório).
    try {
      const vendas = await listarVendas(new Date(agora.getTime() - 40 * 864e5), agora);
      await db.definir("botKaren", "revendiVendas", { dias: JSON.stringify(totaisPorDia(vendas)), atualizadoEm: agora.toISOString() });
    } catch (e) { log("Revendi (vendas): " + e.message); }
    if (ultimoErro) log("Revendi: sincronização voltou a funcionar");
    ultimoErro = ""; ultimoOk = agora.toISOString();
    if (gravadas || removidas) log(`Revendi: ${gravadas} parcela(s) atualizada(s)` + (removidas ? `, ${removidas} removida(s)` : ""));
    return gravadas > 0 || removidas > 0;
  } catch (e) {
    const primeira = ultimoErro !== e.message;
    ultimoErro = e.message;
    if (primeira) log("⚠️ Revendi: " + e.message + " (o resto do bot continua normal)");
    return false;
  }
}
