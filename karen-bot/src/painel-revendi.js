// Análises do Revendi para o Discord (funções puras, sem rede): vendas, entregas, estoque,
// aniversários, clientes para reativar e desempenho. Os dados vêm do "painel" que a sincronização
// grava em ti/base/botKaren/revendiPainel (ver revendi.js).
//
// Formato do painel:
//   vendas:   [{ id, data (AAAA-MM-DD), criadaEm, clienteId, cliente, whatsapp, valor, pago, lucro, desconto,
//                entrega ("DONE"|"PENDING"), itens: [{ produtoId, nome, marca, qtd, preco, brinde }] | null }]
//   clientes: [{ id, nome, whatsapp, aniversario ("MM-DD" ou ""), etiquetas: [..] }]
//   produtos: [{ id, nome, marca, codigo, unidades, preco, validade ("AAAA-MM-DD" ou ""), vencendo }]
import * as C from "./consorcio.js";

const soma = (xs, f) => xs.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const somarDias = (iso, n) => new Date(Date.parse(String(iso).slice(0, 10) + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export const diasEntre = (a, b) => Math.round((Date.parse(String(b).slice(0, 10) + "T12:00:00Z") - Date.parse(String(a).slice(0, 10) + "T12:00:00Z")) / 864e5);
const chave = (whats, nome) => C.chaveTel(whats) || String(nome || "").trim().toLowerCase();

/** "1990-05-12", "1990-05-12T00:00:00.000Z" ou "12/05/1990" → "05-12". */
export function mesDia(v) {
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[2]}-${m[1]}` : "";
}
export const situacaoPagamento = (v) => (v.pago >= v.valor - 0.01 ? "pago" : v.pago > 0.009 ? "parcial" : "aberto");
export const ROTULO_PAG = { pago: "✅ Pago", parcial: "🟡 Pago em parte", aberto: "⏳ A receber" };

// ---------------------------------------------------------------- aniversários
/** Clientes que fazem aniversário entre hoje e hoje+dias (inclusive). Cada um com `emDias`. */
export function aniversariantes(clientes, hojeISO, dias = 0) {
  const out = [];
  for (let n = 0; n <= dias; n++) {
    const d = somarDias(hojeISO, n), md = d.slice(5);
    for (const c of clientes) if (c.aniversario === md || (md === "02-28" && c.aniversario === "02-29" && !ehBissexto(d))) out.push({ ...c, emDias: n, data: d });
  }
  return out;
}
const ehBissexto = (iso) => { const a = Number(iso.slice(0, 4)); return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0; };

// ---------------------------------------------------------------- entregas
export function entregasPendentes(vendas, hojeISO) {
  return vendas.filter((v) => v.entrega === "PENDING")
    .map((v) => ({ ...v, esperando: Math.max(0, diasEntre(v.data, hojeISO)) }))
    .sort((a, b) => b.esperando - a.esperando);
}

// ---------------------------------------------------------------- estoque
/** Produtos vencendo (com unidade em estoque), esgotados que venderam nos últimos 90 dias e parados. */
export function alertasEstoque(produtos, vendas, hojeISO, { diasValidade = 60, diasParado = 90 } = {}) {
  const limite = somarDias(hojeISO, diasValidade);
  const vencendo = produtos.filter((p) => p.unidades > 0 && p.validade && p.validade <= limite)
    .map((p) => ({ ...p, faltam: diasEntre(hojeISO, p.validade) })).sort((a, b) => a.validade.localeCompare(b.validade));
  const desde90 = somarDias(hojeISO, -90), desdeParado = somarDias(hojeISO, -diasParado);
  const vendidos90 = new Map(), vendidosParado = new Set();
  for (const v of vendas) for (const it of v.itens || []) {
    if (v.data >= desde90) vendidos90.set(it.produtoId, (vendidos90.get(it.produtoId) || 0) + it.qtd);
    if (v.data >= desdeParado) vendidosParado.add(it.produtoId);
  }
  const esgotados = produtos.filter((p) => p.unidades <= 0 && vendidos90.has(p.id))
    .map((p) => ({ ...p, vendidos: vendidos90.get(p.id) })).sort((a, b) => b.vendidos - a.vendidos);
  const parados = produtos.filter((p) => p.unidades > 0 && !vendidosParado.has(p.id))
    .map((p) => ({ ...p, valorParado: r2(p.unidades * (p.preco || 0)) })).sort((a, b) => b.valorParado - a.valorParado);
  return {
    vencendo, esgotados, parados,
    totalProdutos: produtos.filter((p) => p.unidades > 0).length,
    totalUnidades: soma(produtos, (p) => Math.max(0, p.unidades)),
    valorEstoque: r2(soma(produtos, (p) => Math.max(0, p.unidades) * (p.preco || 0))),
    valorParado: r2(soma(parados, (p) => p.valorParado)),
  };
}

// ---------------------------------------------------------------- clientes
/** Histórico de compras por cliente (chave = WhatsApp ou nome). */
export function historicoClientes(vendas) {
  const mapa = new Map();
  for (const v of vendas) {
    const k = chave(v.whatsapp, v.cliente);
    if (!k) continue;
    if (!mapa.has(k)) mapa.set(k, { chave: k, clienteId: v.clienteId, cliente: v.cliente, whatsapp: v.whatsapp, compras: 0, total: 0, ultima: "", primeira: "", marcas: new Map() });
    const h = mapa.get(k);
    h.compras++; h.total = r2(h.total + v.valor);
    if (v.data > h.ultima) h.ultima = v.data;
    if (!h.primeira || v.data < h.primeira) h.primeira = v.data;
    for (const it of v.itens || []) if (it.marca) h.marcas.set(it.marca, (h.marcas.get(it.marca) || 0) + it.qtd);
  }
  return [...mapa.values()].map((h) => ({ ...h, marcaFavorita: [...h.marcas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "", marcas: undefined }));
}
/** Quem comprou alguma vez e está sem comprar há `dias` (até 1 ano), ordenado pelo quanto já gastou. */
export function paraReativar(vendas, hojeISO, dias = 60) {
  const corte = somarDias(hojeISO, -dias), ano = somarDias(hojeISO, -365);
  return historicoClientes(vendas).filter((h) => h.ultima && h.ultima < corte && h.ultima >= ano && h.whatsapp)
    .map((h) => ({ ...h, semComprar: diasEntre(h.ultima, hojeISO) })).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------- desempenho
export function desempenho(vendas, inicio, fim) {
  const vs = vendas.filter((v) => v.data >= inicio && v.data <= fim);
  const total = r2(soma(vs, (v) => v.valor)), lucro = r2(soma(vs, (v) => v.lucro)), recebido = r2(soma(vs, (v) => Math.min(v.pago, v.valor)));
  const produtos = new Map(), marcas = new Map();
  for (const v of vs) for (const it of v.itens || []) {
    if (it.brinde) continue;
    const p = produtos.get(it.produtoId) || { nome: it.nome, marca: it.marca, qtd: 0, total: 0 };
    p.qtd += it.qtd; p.total = r2(p.total + it.qtd * it.preco); produtos.set(it.produtoId, p);
    if (it.marca) marcas.set(it.marca, r2((marcas.get(it.marca) || 0) + it.qtd * it.preco));
  }
  const clientes = historicoClientes(vs).sort((a, b) => b.total - a.total);
  return {
    inicio, fim, qtd: vs.length, total, lucro, recebido, ticket: vs.length ? r2(total / vs.length) : 0,
    margem: total ? Math.round((lucro / total) * 100) : 0,
    topProdutos: [...produtos.values()].sort((a, b) => b.qtd - a.qtd || b.total - a.total),
    topMarcas: [...marcas.entries()].map(([marca, total]) => ({ marca, total })).sort((a, b) => b.total - a.total),
    topClientes: clientes, clientesNovas: clientes.filter((c) => !vendas.some((v) => chave(v.whatsapp, v.cliente) === c.chave && v.data < inicio)).length,
  };
}
/** "+12%" / "-5%" / "novo" comparando dois números. */
export function variacao(atual, anterior) {
  if (!anterior) return atual ? "novo" : "=";
  const p = Math.round(((atual - anterior) / anterior) * 100);
  return (p > 0 ? "+" : "") + p + "%";
}

// ---------------------------------------------------------------- mensagens de WhatsApp
export const msgAgradecer = (v) => `Oi, ${C.primeiroNome(v.cliente)}! Aqui é a Karen 💝 Muito obrigada pela sua compra! ` +
  `Qualquer dúvida sobre os produtos é só me chamar. Espero que você ame! 🌸`;
export const msgEntrega = (v) => `Oi, ${C.primeiroNome(v.cliente)}! Aqui é a Karen 💝 Seu pedido já está separadinho para você. ` +
  `Qual o melhor dia e horário para eu te entregar? 🌸`;
export const msgAniversario = (c) => `Feliz aniversário, ${C.primeiroNome(c.nome)}! 🎂🎉 Aqui é a Karen 💝 ` +
  `Desejo um novo ano cheio de saúde, alegria e muitos motivos para sorrir. Obrigada por fazer parte da minha história! 🌸`;
export const msgReativar = (h) => `Oi, ${C.primeiroNome(h.cliente)}! Aqui é a Karen 💝 Estava com saudade! ` +
  (h.marcaFavorita ? `Chegaram novidades de ${h.marcaFavorita} e lembrei de você. ` : "Chegaram novidades lindas e lembrei de você. ") +
  `Quer que eu te mostre? 🌸`;

// ---------------------------------------------------------------- séries para gráficos
/** Total vendido por dia entre inicio e fim (inclusive), na ordem dos dias. */
export function serieDiaria(vendas, inicio, fim) {
  const n = diasEntre(inicio, fim) + 1, out = Array(Math.max(0, n)).fill(0);
  for (const v of vendas) { const i = diasEntre(inicio, v.data); if (i >= 0 && i < n) out[i] = r2(out[i] + v.valor); }
  return out;
}
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const rotuloDia = (iso, comSemana = true) => (comSemana ? SEMANA[new Date(iso + "T12:00:00Z").getUTCDay()] + " " : "") + iso.slice(8, 10) + "/" + iso.slice(5, 7);
export const diasDoPeriodo = (inicio, fim) => Array.from({ length: diasEntre(inicio, fim) + 1 }, (_, i) => somarDias(inicio, i));
