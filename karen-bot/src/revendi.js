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

async function listarClientes() {
  const d = await get("/clients");
  if (!Array.isArray(d)) throw new Error("o Revendi mudou o formato dos clientes");
  return d;
}
async function listarProdutos() {
  const todos = [];
  for (let page = 1; page <= 60; page++) {
    const d = await get("/v2/products", { with_count: "true", page });
    if (!d || !Array.isArray(d.rows)) throw new Error("o Revendi mudou o formato do estoque");
    todos.push(...d.rows);
    const total = Number(d._count?.total_products || 0);
    if (!d.rows.length || (total && todos.length >= total)) break;
  }
  return todos;
}
const detalheVenda = (id) => get(`/sales-v2/${encodeURIComponent(id)}`);
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ---------------------------------------------------------------- conversão
const num = (v) => Math.round((Number(v) || 0) * 100) / 100;
export function converterCliente(c) {
  return { id: String(c.id), nome: String(c.name || "Cliente sem nome").slice(0, 80), whatsapp: normalizarTelefone(c.phone),
    aniversario: mesDiaAniv(c.birthday), etiquetas: (c.clientTags || []).map((t) => String(t.tag?.name || "")).filter(Boolean).slice(0, 10) };
}
const mesDiaAniv = (v) => { const m = String(v || "").match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}` : ""; };
export function converterProduto(p) {
  const validades = (p.units || []).filter((u) => !u.sold && u.expiration_date).map((u) => String(u.expiration_date).slice(0, 10)).sort();
  return { id: String(p.id), nome: String(p.name || "").slice(0, 80), marca: String(p.brand?.name || ""), codigo: String(p.brand_sku || ""),
    unidades: Number(p.available_units) || 0, preco: num(p.sale_price), validade: String(p.nearest_expiration_date || validades[0] || "").slice(0, 10),
    vencendo: Boolean(p.expires_soon) };
}
export function converterItens(itens) {
  return (itens || []).map((it) => ({ produtoId: String(it.product_id), nome: String(it.product?.name || "Produto").slice(0, 70),
    marca: String(it.product?.brand?.name || ""), codigo: String(it.product?.brand_sku || ""), foto: String(it.product?.product_image || it.product?.product_image_sm || ""),
    qtd: Number(it.quantity) || 1, preco: num(it.price), brinde: Boolean(it.is_gift) }));
}
export function converterVenda(v, itens = null) {
  return { id: String(v.id), data: dia(v.date || v.created_at), criadaEm: String(v.created_at || ""), atualizadaEm: String(v.updated_at || ""),
    clienteId: String(v.client_id || v.client?.id || ""), cliente: String(v.client?.name || "Cliente sem nome").slice(0, 80),
    whatsapp: normalizarTelefone(v.client?.phone), valor: num(v.value), pago: num(v.paid_amount), lucro: num(v.profit), desconto: num(v.discount),
    entrega: String(v.delivery_status || ""), qtdItens: Number(v._count?.items) || 0, obs: String(v.description || "").slice(0, 200), itens };
}
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

// ---------------------------------------------------------------- painel (vendas, clientes, estoque)
const DIAS_VENDAS = 400, DIAS_ITENS = 120;
/** Lê clientes, estoque e vendas do último ano (com os itens das vendas dos últimos 120 dias) e grava
 *  um retrato em ti/base/botKaren/revendiPainel. Os itens já lidos ficam em cache (só relê se a venda mudou). */
async function montarPainel(agora, log) {
  const anterior = await db.obter("botKaren", "revendiPainel").catch(() => null);
  let cache = new Map();
  try { cache = new Map((JSON.parse(anterior?.json || "{}").vendas || []).filter((v) => v.itens).map((v) => [v.id, v])); } catch {}
  const [clientes, produtos, vendasRaw] = await Promise.all([
    listarClientes(), listarProdutos(), listarVendas(new Date(agora.getTime() - DIAS_VENDAS * 864e5), agora)]);
  const limiteItens = dia(new Date(agora.getTime() - DIAS_ITENS * 864e5).toISOString());
  const vendas = [];
  let lidas = 0;
  for (const raw of vendasRaw) {
    const v = converterVenda(raw);
    const c = cache.get(v.id);
    if (c && c.atualizadaEm === v.atualizadaEm && c.itens.every((it) => "foto" in it)) v.itens = c.itens;
    else if (v.data >= limiteItens && lidas < 80) {
      try { v.itens = converterItens((await detalheVenda(v.id))?.items); lidas++; await espera(120); }
      catch (e) { log("Revendi (itens da venda " + v.id + "): " + e.message); }
    } else if (c) v.itens = c.itens;
    vendas.push(v);
  }
  vendas.sort((a, b) => b.data.localeCompare(a.data) || b.criadaEm.localeCompare(a.criadaEm));
  const painel = { atualizadoEm: agora.toISOString(), clientes: clientes.filter((c) => !c.deleted).map(converterCliente),
    produtos: produtos.map(converterProduto), vendas };
  await db.definir("botKaren", "revendiPainel", { json: JSON.stringify(painel), atualizadoEm: painel.atualizadoEm });
  if (lidas) log(`Revendi: painel atualizado (${vendas.length} vendas, ${painel.clientes.length} clientes, ${painel.produtos.length} produtos; ${lidas} venda(s) detalhada(s))`);
}

// ---------------------------------------------------------------- catálogo das marcas (consulta ao vivo)
const MARCAS = String(process.env.REVENDI_MARCAS || "7,5,57,222"); // O Boticário, Eudora, Quem Disse Berenice, O.U.i
export function converterCatalogo(p) {
  return { id: String(p.id), nome: String(p.name || "").slice(0, 120), codigo: String(p.brand_sku || ""), marca: String(p.brand?.name || ""),
    descricao: String(p.description || "").replace(/\s+/g, " ").trim(), foto: String(p.product_image || p.product_image_sm || ""),
    fotoPequena: String(p.product_image_sm || p.product_image || ""), preco: num(p.sale_price) };
}
/** Busca no catálogo das marcas por código da revista ou nome. Código exato vem primeiro. */
export async function buscarCatalogo(texto, limite = 10) {
  if (!revendiAtivo()) throw new Error("este PC não tem o login do Revendi (REVENDI_EMAIL/SENHA no .env)");
  const s = String(texto || "").trim();
  if (s.length < 2) return [];
  const d = await get("/catalog", { s, brands: MARCAS, limit: Math.max(limite, 25) });
  if (!Array.isArray(d)) throw new Error("o Revendi mudou o formato do catálogo");
  const lista = d.map(converterCatalogo);
  const cod = s.replace(/\D/g, "");
  return lista.sort((a, b) => Number(b.codigo === cod) - Number(a.codigo === cod)).slice(0, limite);
}

/** Faz a próxima sincronização rodar já (comando /revendi sincronizar). */
export function forcarSincronizacao() { ultima = 0; }

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
    try { await montarPainel(agora, log); }
    catch (e) { log("Revendi (painel): " + e.message); }
    if (ultimoErro) log("Revendi: sincronização voltou a funcionar");
    ultimoErro = ""; ultimoOk = agora.toISOString();
    if (gravadas || removidas) log(`Revendi: ${gravadas} parcela(s) atualizada(s)` + (removidas ? `, ${removidas} removida(s)` : ""));
    return true; // crediário e/ou painel podem ter mudado: o bot relê do Firebase
  } catch (e) {
    const primeira = ultimoErro !== e.message;
    ultimoErro = e.message;
    if (primeira) log("⚠️ Revendi: " + e.message + " (o resto do bot continua normal)");
    return false;
  }
}
