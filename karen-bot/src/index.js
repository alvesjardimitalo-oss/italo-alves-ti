// Bot da Karen Martins Cosméticos — consórcio, formulários do site e loja, no Discord.
// Roda no PC do Ítalo. O banco é o Firestore do painel (ti/base/*): o bot lê os grupos e os
// pedidos do site, avisa no Discord e grava de volta as baixas de parcela e as respostas.
import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  ActivityType, Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, ChannelType,
  AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import * as db from "./firestore.js";
import * as C from "./consorcio.js";
import { montarServidor, alternarAreaClientes, completarCanais, ESTRUTURA, mapaServidor, permissoes, RE_EQUIPE, cargosEquipeExtras } from "./servidor.js";
import * as CR from "./crediario.js";
import { sincronizarRevendi, estadoRevendi, revendiAtivo, forcarSincronizacao, buscarCatalogo } from "./revendi.js";
import * as PR from "./painel-revendi.js";
import * as G from "./graficos.js";
import * as V from "./visual.js";
import * as S from "./sets.js";

const TOKEN = process.env.DISCORD_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const PORTA = Number(process.env.PORT || 3100);
const PASTA = process.env.KAREN_BOT_DATA || path.resolve("dados");
const INTERVALO = Math.max(45, Number(process.env.INTERVALO_SEGUNDOS || 90)) * 1000;
const COR = V.CORES.marca, VERDE = V.CORES.pago, VERMELHO = V.CORES.atraso, AZUL = V.CORES.info, AMARELO = V.CORES.atencao, ROXO = V.CORES.crediario;
const EFEMERA = { flags: MessageFlags.Ephemeral };
// Revezamento entre PCs: só um bot fica ligado ao Discord; os outros esperam de reserva.
const PC = String(process.env.NOME_DO_PC || process.env.COMPUTERNAME || os.hostname()).slice(0, 60);
const LIDER_EXPIRA = 3 * 60000;
let papel = "iniciando";

if (!TOKEN || !GUILD_ID) { console.error("Faltam DISCORD_TOKEN e/ou DISCORD_GUILD_ID no .env."); process.exit(1); }
if (!db.firestoreConfigurado()) console.error("ATENÇÃO: falta FIREBASE_SERVICE_ACCOUNT_JSON no .env — o bot não consegue ler o painel.");

// ---------------------------------------------------------------- estado
fs.mkdirSync(PASTA, { recursive: true });
const ARQ = path.join(PASTA, "estado.json");
let estado = { canais: {}, cargos: {}, threads: {}, versoes: {}, vistos: {}, cursorLeads: "", resumoDia: "", cobrancaMes: {}, vinculos: {}, clientesAbertos: false };
function carregarLocal() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return null; } }
let salvarTimer = null;
function salvar() {
  estado._salvoEm = new Date().toISOString();
  fs.writeFileSync(ARQ, JSON.stringify(estado, null, 2));
  clearTimeout(salvarTimer);
  // Cópia no Firestore: reinstalar o bot em outro PC não perde canais, tópicos nem vínculos.
  salvarTimer = setTimeout(() => db.definir("botKaren", "estado", { json: JSON.stringify(estado), salvoEm: estado._salvoEm }).catch((e) => log("cópia do estado falhou: " + e.message)), 5000);
}
async function carregarEstado() {
  // Com dois PCs revezando, vale o estado mais novo (o do Firestore costuma ser o do outro PC).
  const local = carregarLocal();
  let remoto = null;
  try { const d = await db.obter("botKaren", "estado"); if (d?.json) remoto = { ...JSON.parse(d.json), _salvoEm: d.salvoEm || "" }; }
  catch (e) { log("estado do Firestore indisponível: " + e.message); }
  const usarRemoto = remoto && (!local || String(remoto._salvoEm) > String(local._salvoEm || ""));
  estado = { ...estado, ...(usarRemoto ? remoto : local || {}) };
  if (usarRemoto) log("estado recuperado do Firestore");
  V.usarEmojis(estado.emojis);
}

// ---------------------------------------------------------------- utilidades
// GuildMessages (não privilegiado) só para saber que chegou um print em #comprovantes.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });
let guild = null;
let grupos = new Map();
let ultimoCiclo = null, ultimoErro = "";
function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }
async function canal(chave) {
  const id = estado.canais?.[chave];
  if (!id || !guild) return null;
  try { return guild.channels.cache.get(id) || await guild.channels.fetch(id); } catch { return null; }
}
async function enviar(chave, conteudo) {
  const c = await canal(chave);
  if (!c) return null;
  try { return await c.send(V.decorar(conteudo)); } catch (e) { log(`não consegui postar em ${chave}: ${e.message}`); return null; }
}
async function avisarLog(texto) { log(texto); await enviar("logs", { content: texto.slice(0, 1900) }); }
const curto = (t, n) => { const s = String(t || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const ehEquipe = (i) => {
  const m = i.member;
  if (!m) return false;
  if (m.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;
  const ids = [estado.cargos?.dona, estado.cargos?.admin].filter(Boolean);
  return ids.some((id) => m.roles?.cache?.has(id));
};
const linhaLink = (rotulo, url) => url ? `[${rotulo}](${url})` : rotulo;

// ---------------------------------------------------------------- comandos
const comandos = [
  new SlashCommandBuilder().setName("consorcio").setDescription("Consórcio da Karen")
    .addSubcommand((s) => s.setName("resumo").setDescription("Resumo dos grupos ou de um grupo")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true)))
    .addSubcommand((s) => s.setName("atrasados").setDescription("Quem está com parcela atrasada")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true)))
    .addSubcommand((s) => s.setName("pagou").setDescription("Dar baixa numa parcela")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("membro").setDescription("Membro").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("mes").setDescription("Mês (em branco = a parcela mais antiga em aberto)").setAutocomplete(true)))
    .addSubcommand((s) => s.setName("desfazer").setDescription("Desmarcar uma parcela paga por engano")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("membro").setDescription("Membro").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("mes").setDescription("Mês pago").setAutocomplete(true).setRequired(true)))
    .addSubcommand((s) => s.setName("membro").setDescription("Situação de um membro")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("membro").setDescription("Membro").setAutocomplete(true).setRequired(true)))
    .addSubcommand((s) => s.setName("links").setDescription("Links de renovação e do banco de reserva"))
    .addSubcommand((s) => s.setName("atualizar").setDescription("Atualiza agora os tópicos dos grupos e as cobranças com o painel"))
    .addSubcommand((s) => s.setName("novo-grupo").setDescription("Cria um grupo novo (abre um formulário)"))
    .addSubcommand((s) => s.setName("adicionar").setDescription("Coloca uma pessoa num grupo (do banco de reserva, da renovação ou digitando)")
      .addStringOption((o) => o.setName("grupo").setDescription("Grupo").setAutocomplete(true).setRequired(true))
      .addStringOption((o) => o.setName("interessado").setDescription("Quem respondeu a renovação ou o banco de reserva").setAutocomplete(true))
      .addStringOption((o) => o.setName("nome").setDescription("Nome (se não for da lista)"))
      .addStringOption((o) => o.setName("whatsapp").setDescription("WhatsApp com DDD (se não for da lista)"))),
  new SlashCommandBuilder().setName("cliente").setDescription("Ficha da cliente: consórcios e crediário do Revendi")
    .addStringOption((o) => o.setName("quem").setDescription("Nome ou WhatsApp").setAutocomplete(true).setRequired(true)),
  new SlashCommandBuilder().setName("revendi").setDescription("Dados do Revendi")
    .addSubcommand((s) => s.setName("vendas").setDescription("Vendas de um período")
      .addStringOption((o) => o.setName("periodo").setDescription("Período").setRequired(true).addChoices(
        { name: "hoje", value: "0" }, { name: "últimos 7 dias", value: "7" }, { name: "últimos 30 dias", value: "30" }, { name: "este mês", value: "mes" })))
    .addSubcommand((s) => s.setName("entregas").setDescription("Vendas ainda não entregues"))
    .addSubcommand((s) => s.setName("estoque").setDescription("Vencendo, esgotados e parados"))
    .addSubcommand((s) => s.setName("aniversarios").setDescription("Aniversariantes dos próximos 30 dias"))
    .addSubcommand((s) => s.setName("sumidas").setDescription("Clientes sem comprar há 60+ dias"))
    .addSubcommand((s) => s.setName("sincronizar").setDescription("Lê o Revendi agora (em vez de esperar 30 min)"))
    .addSubcommand((s) => s.setName("meta").setDescription("Define a meta de vendas do mês (aparece no painel 🌸 hoje)")
      .addNumberOption((o) => o.setName("valor").setDescription("Meta em R$ (0 = sem meta)").setRequired(true).setMinValue(0))),
  new SlashCommandBuilder().setName("produto").setDescription("Catálogo das marcas: foto, preço sugerido e se tem no estoque")
    .addStringOption((o) => o.setName("busca").setDescription("Código da revista ou nome").setAutocomplete(true).setRequired(true)),
  new SlashCommandBuilder().setName("loja").setDescription("Loja do site")
    .addSubcommand((s) => s.setName("pedidos").setDescription("Pedidos da loja dos últimos 7 dias")),
  new SlashCommandBuilder().setName("servidor").setDescription("Organização do servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName("montar").setDescription("APAGA os canais e cargos atuais e cria o servidor da Karen"))
    .addSubcommand((s) => s.setName("clientes").setDescription("Mostrar ou esconder a Área das Clientes")
      .addStringOption((o) => o.setName("acao").setDescription("abrir ou fechar").setRequired(true).addChoices({ name: "abrir", value: "abrir" }, { name: "fechar", value: "fechar" })))
    .addSubcommand((s) => s.setName("acesso").setDescription("Define quem vê/entra num canal ou call criado à mão")
      .addChannelOption((o) => o.setName("canal").setDescription("Canal ou call").setRequired(true))
      .addStringOption((o) => o.setName("para").setDescription("Quem acessa").setRequired(true).addChoices(
        { name: "só a equipe (Karen e Admin)", value: "equipe" }, { name: "clientes e consorciadas", value: "clientes" },
        { name: "só consorciadas", value: "consorciadas" }, { name: "qualquer pessoa do servidor", value: "publico" })))
    .addSubcommand((s) => s.setName("mapa").setDescription("Mostra cada canal e call e quem consegue ver (todos, clientes, só equipe)"))
    .addSubcommand((s) => s.setName("vincular").setDescription("Liga uma pessoa do Discord ao WhatsApp dela (para /minhas-parcelas)")
      .addUserOption((o) => o.setName("pessoa").setDescription("Pessoa").setRequired(true))
      .addStringOption((o) => o.setName("whatsapp").setDescription("WhatsApp com DDD").setRequired(true))),
  new SlashCommandBuilder().setName("minhas-parcelas").setDescription("Ver as minhas parcelas do consórcio (só você vê)"),
  new SlashCommandBuilder().setName("ajuda").setDescription("O que o bot da Karen faz"),
].map((c) => c.toJSON());

async function registrarComandos() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: comandos });
  log(`${comandos.length} comandos registrados`);
}

// ---------------------------------------------------------------- respostas de renovação e reservas
let renovacoes = new Map(), reservas = [], respostasLidas = 0;
const renovaDoLead = (l) => (String(l.detalhe || "").match(/\[ref:renova-(sim|talvez|nao)\]/) || [])[1] || "";
const grupoDoLead = (l) => (String(l.detalhe || "").match(/\[grupo:([^\]]+)\]/) || [])[1] || "";
async function carregarRespostas(forcar = false) {
  if (!forcar && Date.now() - respostasLidas < 30 * 60000) return;
  const [ren, res] = await Promise.all([db.leadsPorOrigem("consorcio-renovacao"), db.leadsPorOrigem("consorcio-reserva")]);
  respostasLidas = Date.now();
  const mapa = new Map();
  ren.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))).forEach((l) => {
    const t = C.chaveTel(l.whatsapp);
    if (!t) return;
    const info = { renova: renovaDoLead(l), grupo: grupoDoLead(l), criadoEm: l.criadoEm, nome: l.nome, whatsapp: l.whatsapp };
    mapa.set(t + "|" + info.grupo, info); mapa.set(t, info);
  });
  renovacoes = mapa;
  reservas = res.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}
function renovacaoDe(g, m) {
  const t = C.chaveTel(m.whatsapp);
  return t ? renovacoes.get(t + "|" + g.codigo) || renovacoes.get(t) || null : null;
}
const ICONE_RENOVA = { sim: "🔁 renova", talvez: "🤔 talvez", nao: "❌ não renova" };
/** Quem respondeu "sim/talvez" ou entrou no banco de reserva e ainda não está num grupo em formação. */
function interessados() {
  const emFormacao = new Set([...grupos.values()].filter((g) => C.situacao(g) === "formando").flatMap((g) => (g.membros || []).map((m) => C.chaveTel(m.whatsapp))));
  const vistos = new Set(), out = [];
  const add = (nome, whatsapp, tipo) => { const t = C.chaveTel(whatsapp); if (!t || vistos.has(t) || emFormacao.has(t)) return; vistos.add(t); out.push({ nome, whatsapp, tipo, tel: t }); };
  [...renovacoes.entries()].filter(([k]) => !k.includes("|")).map(([, v]) => v).filter((v) => v.renova === "sim").forEach((v) => add(v.nome, v.whatsapp, "renova"));
  [...renovacoes.entries()].filter(([k]) => !k.includes("|")).map(([, v]) => v).filter((v) => v.renova === "talvez").forEach((v) => add(v.nome, v.whatsapp, "talvez"));
  reservas.forEach((l) => add(l.nome, l.whatsapp, "reserva R$ " + ((String(l.detalhe).match(/\[valor:([^\]]+)\]/) || [])[1] || "?")));
  return out;
}
// Crediário do Revendi (ti/base/crediario), lido a cada 5 min. Vazio enquanto a integração não liga.
let crediario = [], crediarioLido = 0, vendasPorDia = {};
async function carregarCrediario(forcar = false) {
  if (!forcar && Date.now() - crediarioLido < 5 * 60000) return;
  crediario = await db.listar("crediario");
  try { const v = await db.obter("botKaren", "revendiVendas"); vendasPorDia = v?.dias ? JSON.parse(v.dias) : {}; } catch { vendasPorDia = {}; }
  try {
    const p = await db.obter("botKaren", "revendiPainel");
    if (p?.json) { const d = JSON.parse(p.json); painelRV = { vendas: d.vendas || [], clientes: d.clientes || [], produtos: d.produtos || [], atualizadoEm: d.atualizadoEm || "" }; }
  } catch (e) { log("painel do Revendi: " + e.message); }
  crediarioLido = Date.now();
}
// Retrato do Revendi (vendas, clientes, estoque) gravado pela sincronização. Vazio até a primeira leitura.
let painelRV = { vendas: [], clientes: [], produtos: [], atualizadoEm: "" };
const temPainel = () => Boolean(painelRV.atualizadoEm);
const somarVendas = (filtro) => Object.entries(vendasPorDia).filter(([d]) => filtro(d)).reduce((t, [, v]) => ({ qtd: t.qtd + (v.qtd || 0), total: t.total + (v.total || 0) }), { qtd: 0, total: 0 });
const clientesCrediario = () => CR.porCliente(crediario);

async function publicarGrupos() {
  await db.definir("rastreio", "consorcio-grupos", { grupos: C.gruposPublicos([...grupos.values()]), atualizadoEm: new Date().toISOString() }).catch((e) => log("publicar grupos: " + e.message));
}

// ---------------------------------------------------------------- embeds do consórcio
function grupoPorCodigo(v) {
  const s = String(v || "").trim().toUpperCase();
  return grupos.get(v) || [...grupos.values()].find((g) => String(g.codigo).toUpperCase() === s) || null;
}
function embedGrupo(g) {
  const r = C.resumoGrupo(g);
  const sit = C.situacao(g);
  const membros = (g.membros || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const linhas = membros.map((m) => {
    const x = C.resumoMembro(g, m);
    const ic = x.quitado ? "✅" : x.atrasadas.length ? "⚠️" : sit === "formando" ? "🕒" : "🟢";
    const rv = sit !== "formando" ? renovacaoDe(g, m) : null;
    const renova = sit === "formando" ? "" : rv ? ` · ${ICONE_RENOVA[rv.renova] || "respondeu"}` : " · ⏳ sem resposta";
    return `${ic} **${curto(m.nome, 40)}** \`${V.barra(x.pagas, x.total, 10)}\` ${x.pagas}/${x.total}` + (x.atrasadas.length ? ` · ${x.atrasadas.length} atrasada(s)` : "") +
      (m.resgatadoEm ? " · 🎁 resgatou" : x.quitado ? " · 🎁 falta resgatar" : "") + renova;
  });
  const e = new EmbedBuilder().setColor(sit === "andamento" ? (r.comAtraso.length ? VERMELHO : VERDE) : sit === "formando" ? AZUL : V.CORES.neutro)
    .setTitle(C.nomeGrupo(g)).setURL(C.URL_PAINEL)
    .setDescription(curto(linhas.join("\n") || "_Sem membros. Adicione pelo painel._", 4000))
    .addFields(
      { name: "Situação", value: C.ROTULO[sit], inline: true },
      { name: "Prêmio", value: C.brl(g.premio), inline: true },
      { name: "Vencimento", value: `dia ${g.vencimento || 10}`, inline: true },
      { name: "Membros", value: `${r.membros}${g.vagas ? " / " + g.vagas : ""}`, inline: true },
      { name: "Parcela atual", value: sit === "andamento" ? `${r.parcelaAtual} de ${g.parcelas}` : "—", inline: true },
      { name: "Arrecadado", value: `${C.brl(r.arrecadado)} de ${C.brl(r.previsto)}`, inline: true },
    )
    .setFooter({ text: `Atualizado ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` });
  if (sit === "andamento") e.addFields({ name: "Este mês", value: `${r.pagosNoMes} pagaram · ${r.faltamNoMes.length} faltam`, inline: true }, { name: "Em atraso", value: r.comAtraso.length ? `${r.comAtraso.length} · ${C.brl(r.emAtraso)}` : "ninguém 🎉", inline: true });
  if (sit !== "formando" && membros.length) {
    const cont = { sim: 0, talvez: 0, nao: 0, sem: 0 };
    membros.forEach((m) => { const rv = renovacaoDe(g, m); cont[rv ? (rv.renova || "sem") : "sem"]++; });
    e.addFields({ name: "Renovação", value: `🔁 ${cont.sim} · 🤔 ${cont.talvez} · ❌ ${cont.nao} · ⏳ ${cont.sem} sem resposta`, inline: false });
  }
  if (g.obs) e.addFields({ name: "Observações", value: curto(g.obs, 1000) });
  return e;
}
function menuMembros(prefixo, g, lista, placeholder) {
  const opcoes = lista.slice(0, 25).map(({ m, descricao }) => ({ label: curto(m.nome, 100), value: m.id, description: curto(descricao, 100) }));
  if (!opcoes.length) return null;
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`${prefixo}:${g.id}`).setPlaceholder(placeholder).addOptions(opcoes));
}
function componentesGrupo(g) {
  const linhas = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`g:atualizar:${g.id}`).setLabel("Atualizar").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setLabel("Abrir no painel").setStyle(ButtonStyle.Link).setURL(C.URL_PAINEL),
  )];
  if (C.situacao(g) !== "formando") {
    const abertos = (g.membros || []).map((m) => ({ m, x: C.resumoMembro(g, m) })).filter(({ x }) => x.abertas.length)
      .sort((a, b) => b.x.atrasadas.length - a.x.atrasadas.length || String(a.m.nome).localeCompare(String(b.m.nome), "pt-BR"))
      .map(({ m, x }) => ({ m, descricao: `Próxima: ${C.rotuloMes(x.atrasadas[0] || x.abertas[0], true)}${x.atrasadas.length ? " · " + x.atrasadas.length + " atrasada(s)" : ""}` }));
    const menu = menuMembros("baixa", g, abertos, "✅ Dar baixa na parcela de…");
    if (menu) linhas.push(menu);
  }
  return linhas;
}

async function atualizarTopico(g) {
  const forum = await canal("grupos");
  if (!forum) return;
  if (forum.type !== ChannelType.GuildForum) return atualizarMensagemGrupo(forum, g);
  const nome = curto(`${g.codigo} · ${C.brl(g.valorParcela)} · ${g.inicio ? C.rotuloMes(g.inicio) + " a " + C.rotuloMes(C.fimDo(g)) : "a definir"}`, 100);
  const conteudo = { embeds: [embedGrupo(g)], components: componentesGrupo(g) };
  let thread = null;
  const id = estado.threads[g.id];
  if (id) { try { thread = await client.channels.fetch(id); } catch { thread = null; } }
  if (!thread) {
    thread = await forum.threads.create({ name: nome, autoArchiveDuration: 10080, message: conteudo });
    estado.threads[g.id] = thread.id; salvar();
    return;
  }
  if (thread.archived) await thread.setArchived(false).catch(() => {});
  if (thread.name !== nome) await thread.setName(nome).catch(() => {});
  const inicial = await thread.fetchStarterMessage().catch(() => null);
  if (inicial) await inicial.edit(conteudo);
  else await thread.send(conteudo);
}

/** Servidor sem fórum: uma mensagem fixa por grupo no canal #grupos, editada a cada mudança. */
async function atualizarMensagemGrupo(c, g) {
  const conteudo = { embeds: [embedGrupo(g)], components: componentesGrupo(g) };
  const id = String(estado.threads[g.id] || "");
  const msg = id.startsWith("msg:") ? await c.messages.fetch(id.slice(4)).catch(() => null) : null;
  if (msg) { await msg.edit(conteudo); return; }
  const nova = await c.send(conteudo);
  estado.threads[g.id] = "msg:" + nova.id; salvar();
  await nova.pin().catch(() => {});
}

// ---------------------------------------------------------------- leitura do painel
const ORIGENS = {
  "consorcio-renovacao": "renovacoes", "consorcio-reserva": "reservas",
  "black-friday-pedido": "pedidos", "sacola-misteriosa": "sacola", "black-friday": "roleta",
};
function campo(detalhe, rotulo) {
  const m = String(detalhe || "").match(new RegExp(rotulo + ":\\s*([^|\\[]+)"));
  return m ? m[1].trim() : "";
}
function mensagemLead(l) {
  const destino = ORIGENS[l.origem];
  const tel = C.fone(l.whatsapp);
  const quando = new Date(l.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const e = new EmbedBuilder().setColor(COR).setFooter({ text: quando });
  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lead:wa:${l.id}`).setLabel("Responder no WhatsApp").setEmoji("📲").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`lead:ok:${l.id}`).setLabel("Marcar respondida").setEmoji("✅").setStyle(ButtonStyle.Secondary),
  );
  if (destino === "renovacoes") {
    const renova = (String(l.detalhe).match(/\[ref:renova-(sim|talvez|nao)\]/) || [])[1] || "";
    const nota = Number((String(l.detalhe).match(/\[nota:(\d)\]/) || [])[1]) || 0;
    e.setColor(renova === "sim" ? VERDE : renova === "talvez" ? AMARELO : V.CORES.neutro)
      .setTitle(`🔁 ${l.nome} respondeu a renovação`)
      .setDescription([
        `**Grupo:** ${campo(l.detalhe, "Grupo") || "—"}`,
        `**Nota:** ${nota ? "★".repeat(nota) + "☆".repeat(5 - nota) : "—"}`,
        `**Renova?** ${renova === "sim" ? "✅ Sim" : renova === "talvez" ? "🤔 Talvez" : renova === "nao" ? "❌ Não" : "—"}`,
        campo(l.detalhe, "O que gosta") && `**O que gosta:** ${campo(l.detalhe, "O que gosta")}`,
        campo(l.detalhe, "Pode melhorar") && `**Pode melhorar:** ${campo(l.detalhe, "Pode melhorar")}`,
        campo(l.detalhe, "Sugestões") && `**Sugestões:** ${campo(l.detalhe, "Sugestões")}`,
        `**WhatsApp:** ${tel}`,
      ].filter(Boolean).join("\n"));
  } else if (destino === "reservas") {
    e.setTitle(`📝 ${l.nome} entrou no banco de reserva`).setDescription(C.semMarcas(l.detalhe).split(" | ").map((t) => "• " + t).join("\n") + `\n**WhatsApp:** ${tel}`);
  } else if (destino === "pedidos") {
    e.setTitle(`🛒 Pedido na loja · ${l.equipamento || ""}`).setDescription(`**${l.nome}** · ${tel}\n${curto(C.semMarcas(l.detalhe), 1500)}\n\nConfirme o Pix no painel: Loja da Karen › Pedidos.`);
    botoes.addComponents(new ButtonBuilder().setLabel("Abrir pedidos").setStyle(ButtonStyle.Link).setURL("https://italoinfotec.com.br/sistema.html#/karen/pedidos"));
  } else if (destino === "sacola") {
    e.setTitle(`🎁 Sacola Misteriosa · ${l.nome}`).setDescription(`${curto(C.semMarcas(l.detalhe), 1500)}\n**WhatsApp:** ${tel}`);
  } else {
    e.setTitle(`🎡 Cupom da roleta · ${l.nome}`).setDescription(`${curto(C.semMarcas(l.detalhe), 600)}\n**WhatsApp:** ${tel}`);
  }
  return { destino, conteudo: { embeds: [e], components: [botoes] } };
}

async function verificarLeads() {
  // Na primeira vez, só o último dia (não inunda o Discord com a Black Friday inteira).
  const desde = estado.cursorLeads || new Date(Date.now() - 864e5).toISOString();
  const leads = await db.leadsDesde(desde);
  for (const l of leads) {
    if (ORIGENS[l.origem] && !l.discordEm) {
      const { destino, conteudo } = mensagemLead(l);
      const msg = await enviar(destino, conteudo);
      if (msg) {
        await db.atualizar("leads", l.id, { discordEm: new Date().toISOString() }).catch((e) => log("não marquei o lead: " + e.message));
        if (["renovacoes", "reservas", "pedidos"].includes(destino)) await enviar("alertas", { content: `🔔 Novo em <#${msg.channelId}>: **${curto(l.nome, 60)}**` });
        if (destino === "renovacoes" || destino === "reservas") respostasLidas = 0;
        if (destino === "renovacoes") {
          const t = C.chaveTel(l.whatsapp);
          for (const g of grupos.values()) if ((g.membros || []).some((m) => C.chaveTel(m.whatsapp) === t)) delete estado.versoes[g.id];
        }
      }
    }
    estado.cursorLeads = l.criadoEm;
  }
  if (leads.length) salvar();
}

async function verificarGrupos() {
  const lista = await db.listar("consorcios");
  grupos = new Map(lista.map((g) => [g.id, g]));
  for (const g of lista) {
    if (estado.versoes[g.id] === g._atualizado) continue;
    const antes = estado.vistos[g.id];
    const agora = {};
    for (const m of g.membros || []) agora[m.id] = { pagos: Object.keys(m.pagos || {}).filter((k) => m.pagos[k]), resgate: m.resgatadoEm || "" };
    if (antes) {
      for (const m of g.membros || []) {
        const a = antes[m.id] || { pagos: [], resgate: "" };
        const novos = agora[m.id].pagos.filter((ym) => !a.pagos.includes(ym));
        if (novos.length) {
          const x = C.resumoMembro(g, m);
          await enviar("pagamentos", { content: `✅ **${m.nome}** · ${g.codigo} · ${novos.map((ym) => C.rotuloMes(ym, true)).join(", ")} · ${x.pagas}/${x.total} pagas` + (g.atualizadoPor === "bot-discord" ? "" : " _(pelo painel)_") });
        }
        if (agora[m.id].resgate && !a.resgate) {
          const dif = (m.resgateValor || 0) - (g.premio || 0);
          const e = new EmbedBuilder().setColor(COR).setTitle(`🎁 ${m.nome} resgatou o prêmio do ${g.codigo}`)
            .setDescription([`**Data:** ${C.dataBR(m.resgatadoEm)}`, `**Prêmio:** ${C.brl(g.premio)}`, m.resgateValor ? `**Produtos:** ${C.brl(m.resgateValor)}` : "",
              dif > 0 ? `**Diferença a cobrar:** ${C.brl(dif)}` : "", m.resgateObs ? `**Itens:** ${curto(m.resgateObs, 600)}` : "",
              "", "📝 **Lançar no Revendi:** venda para esta cliente com os itens acima, o valor do consórcio como desconto/zerado" + (dif > 0 ? ` e ${C.brl(dif)} a receber.` : ".")].filter((x) => x !== "").join("\n"));
          await enviar("resgates", { embeds: [e], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("rev:ok").setLabel("Lançado no Revendi").setEmoji("✅").setStyle(ButtonStyle.Success))] });
        }
      }
    }
    estado.vistos[g.id] = agora;
    try { await atualizarTopico(g); estado.versoes[g.id] = g._atualizado; } catch (e) { log(`tópico do ${g.codigo}: ${e.message}`); }
    await atualizarCobranca(g);
  }
  for (const id of Object.keys(estado.threads)) {
    if (!grupos.has(id)) {
      const ref = String(estado.threads[id]);
      try {
        if (ref.startsWith("msg:")) { const c = await canal("grupos"); const m = await c?.messages.fetch(ref.slice(4)); await m?.delete(); }
        else { const t = await client.channels.fetch(ref); await t?.setArchived(true); }
      } catch {}
      delete estado.threads[id]; delete estado.versoes[id]; delete estado.vistos[id];
    }
  }
  salvar();
}

// ---------------------------------------------------------------- rotinas do dia
async function resumoDoDia() {
  const ativos = C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) === "andamento");
  const formando = [...grupos.values()].filter((g) => C.situacao(g) === "formando");
  const hoje = C.agoraSP();
  const e = new EmbedBuilder().setColor(COR).setTitle(`📋 Resumo do dia · ${C.dataBR(hoje.data)}`);
  let recebido = 0, previsto = 0;
  for (const g of ativos) {
    const r = C.resumoGrupo(g);
    recebido += r.pagosNoMes * g.valorParcela; previsto += r.membros * g.valorParcela;
    const venc = Number(g.vencimento) || 10;
    e.addFields({ name: `${g.codigo} · parcela ${r.parcelaAtual}/${g.parcelas} · vence dia ${venc}`, value: curto(
      `\`${V.barra(r.pagosNoMes, r.membros, 10)}\` ${r.pagosNoMes}/${r.membros} pagaram ${C.rotuloMes(hoje.ym)}` + (r.comAtraso.length ? ` · ⚠️ ${r.comAtraso.length} em atraso (${C.brl(r.emAtraso)})` : " · sem atrasos") +
      (hoje.dia === venc ? "\n📅 **Vence hoje!**" : hoje.dia === venc - 1 ? "\n📅 Vence amanhã" : ""), 1000) });
  }
  if (!ativos.length) e.setDescription("Nenhum grupo em andamento. Cadastre os grupos no painel.");
  else e.setDescription(`💰 Recebido em ${C.rotuloMes(hoje.ym, true)}: **${C.brl(recebido)}** de ${C.brl(previsto)}`);
  const ontem = new Date(Date.parse(hoje.data + "T12:00:00Z") - 864e5).toISOString().slice(0, 10);
  const vOntem = somarVendas((d) => d === ontem), vMes = somarVendas((d) => d.startsWith(hoje.ym));
  if (Object.keys(vendasPorDia).length) e.addFields({ name: "🛍️ Vendas (Revendi)", value: `Ontem: **${vOntem.qtd}** · ${C.brl(vOntem.total)} · No mês: ${vMes.qtd} · ${C.brl(vMes.total)}` });
  if (crediario.length) {
    const r = CR.resumo(crediario);
    e.addFields({ name: "💳 Crediário (Revendi)", value: `Vence hoje: **${C.brl(r.hoje)}** (${r.qtdHoje}) · Em atraso: **${C.brl(r.atraso)}** (${r.clientesAtraso} cliente(s)) · Próximos 7 dias: ${C.brl(r.semana)} · A receber: ${C.brl(r.aReceber)}` });
  }
  if (temPainel()) {
    const extras = [];
    const aniv = PR.aniversariantes(painelRV.clientes, hoje.data, 0);
    if (aniv.length) extras.push(`🎂 **${aniv.length}** aniversariante(s) hoje: ${curto(aniv.map((c) => C.primeiroNome(c.nome)).join(", "), 200)}`);
    const ent = PR.entregasPendentes(painelRV.vendas, hoje.data);
    if (ent.length) extras.push(`🚚 **${ent.length}** entrega(s) pendente(s)` + (ent.some((v) => v.esperando > 3) ? " · ⚠️ alguma há mais de 3 dias" : ""));
    const est = PR.alertasEstoque(painelRV.produtos, painelRV.vendas, hoje.data, { diasValidade: 30 });
    if (est.vencendo.length) extras.push(`⏰ **${est.vencendo.length}** produto(s) vencendo em 30 dias`);
    if (est.esgotados.length) extras.push(`🛒 **${est.esgotados.length}** esgotado(s) que vendem`);
    if (extras.length) e.addFields({ name: "🛍️ Revendi hoje", value: curto(extras.join("\n"), 1024) });
  }
  const pendentes = [...grupos.values()].flatMap((g) => (g.membros || []).filter((m) => !m.resgatadoEm && C.resumoMembro(g, m).quitado).map((m) => `${m.nome} (${g.codigo})`));
  if (pendentes.length) e.addFields({ name: `🎁 Quitaram e ainda não resgataram (${pendentes.length})`, value: curto(pendentes.join(" · "), 1000) });
  if (formando.length) e.addFields({ name: "🟦 Próximo grupo", value: formando.map((g) => `${g.codigo}: ${(g.membros || []).length}${g.vagas ? "/" + g.vagas : ""} membros · começa ${C.rotuloMes(g.inicio, true)}`).join("\n") });
  try {
    const semana = await db.leadsDesde(new Date(Date.now() - 864e5).toISOString(), 300);
    const conta = (o) => semana.filter((l) => l.origem === o).length;
    const linhas = [["consorcio-renovacao", "🔁 renovações"], ["consorcio-reserva", "📝 reservas"], ["black-friday-pedido", "🛒 pedidos da loja"], ["sacola-misteriosa", "🎁 sacolas"]]
      .map(([o, t]) => conta(o) ? `${conta(o)} ${t}` : "").filter(Boolean);
    if (linhas.length) e.addFields({ name: "Últimas 24 horas", value: linhas.join(" · ") });
  } catch {}
  const files = [];
  if (temPainel()) {
    const ini = PR.somarDias(hoje.data, -14), fim = PR.somarDias(hoje.data, -1);
    const serie = PR.serieDiaria(painelRV.vendas, ini, fim);
    if (serie.some((v) => v > 0)) {
      const png = await G.desenhar(G.configDiario("Vendas dos últimos 14 dias", PR.diasDoPeriodo(ini, fim).map((x) => PR.rotuloDia(x)), serie, null, ["Vendas"]), { altura: 360, log });
      if (png) { files.push(new AttachmentBuilder(png, { name: "vendas-14d.png" })); e.setImage("attachment://vendas-14d.png"); }
    }
  }
  await enviar("resumo", { embeds: [e], files });
}

function conteudoCobranca(g) {
  const r = C.resumoGrupo(g);
  const hora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (!r.comAtraso.length) {
    return { content: "", embeds: [new EmbedBuilder().setColor(VERDE).setTitle(`🎉 ${g.codigo}: ninguém em atraso`).setDescription(`Todo mundo pagou até ${C.rotuloMes(C.mesAtual(), true)}.`).setFooter({ text: "Atualizado " + hora })], components: [] };
  }
  const lista = r.comAtraso.sort((a, b) => b.r.atrasadas.length - a.r.atrasadas.length).map(({ m, r: x }) => ({ m, descricao: `${x.atrasadas.length} atrasada(s) · ${x.atrasadas.map((ym) => C.rotuloMes(ym)).join(", ")} · ${C.brl(x.atrasadas.length * g.valorParcela)}` }));
  const e = new EmbedBuilder().setColor(VERMELHO).setTitle(`📲 Cobranças do ${g.codigo} · vence dia ${g.vencimento || 10}`)
    .setDescription(curto(lista.map(({ m, descricao }) => `• **${m.nome}** · ${descricao}`).join("\n"), 4000))
    .setFooter({ text: `Atualiza sozinho quando alguém paga · ${hora}` });
  const comp = [menuMembros("cob", g, lista, "📲 Cobrar no WhatsApp…"), menuMembros("baixa", g, lista, "✅ Já pagou: dar baixa…")].filter(Boolean);
  return { content: "", embeds: [e], components: comp };
}
async function cobrancasDoMes(g) {
  const msg = await enviar("cobrancas", conteudoCobranca(g));
  if (msg) { estado.cobrancaMsg = estado.cobrancaMsg || {}; estado.cobrancaMsg[g.id] = msg.id; salvar(); }
}
/** Mantém a mensagem de cobrança do mês igual ao painel (some quem pagou). */
async function atualizarCobranca(g) {
  let id = estado.cobrancaMsg?.[g.id];
  const c = await canal("cobrancas");
  if (!id && c && estado.cobrancaMes?.[g.id] === C.mesAtual()) {
    // Mensagem postada pela versão anterior do bot: encontra e passa a atualizar.
    const ultimas = await c.messages.fetch({ limit: 50 }).catch(() => null);
    const antiga = ultimas && [...ultimas.values()].find((m) => m.author?.id === client.user.id &&
      (m.embeds?.[0]?.title?.includes(`Cobranças do ${g.codigo} `) || m.content?.includes(`**${g.codigo}**`)));
    if (antiga) { estado.cobrancaMsg = estado.cobrancaMsg || {}; estado.cobrancaMsg[g.id] = id = antiga.id; salvar(); }
  }
  if (!id) return;
  const msg = c && await c.messages.fetch(id).catch(() => null);
  if (!msg) { delete estado.cobrancaMsg[g.id]; return; }
  await msg.edit(conteudoCobranca(g)).catch((e) => log("cobrança do " + g.codigo + ": " + e.message));
}

async function lembreteVencimento(g) {
  const ym = C.mesAtual();
  const faltam = C.resumoGrupo(g).faltamNoMes;
  if (!faltam.length) return;
  const lista = faltam.map((m) => ({ m, descricao: m.whatsapp ? C.fone(m.whatsapp) : "sem WhatsApp" }));
  const e = new EmbedBuilder().setColor(AMARELO).setTitle(`⏰ ${g.codigo}: parcela de ${C.rotuloMes(ym, true)} vence dia ${g.vencimento || 10}`)
    .setDescription(curto(`Ainda não pagaram (${faltam.length}):\n` + faltam.map((m) => `• ${m.nome}`).join("\n"), 4000))
    .setFooter({ text: "Escolha no menu para abrir o WhatsApp com o lembrete pronto." });
  await enviar("cobrancas", { embeds: [e], components: [menuMembros("lem", g, lista, "📲 Lembrar no WhatsApp…")].filter(Boolean) });
}

async function avisoFimDeGrupo(g, ultimo) {
  const membros = g.membros || [];
  const quitados = membros.filter((m) => C.resumoMembro(g, m).quitado).length;
  const semResgate = membros.filter((m) => !m.resgatadoEm);
  const semResposta = membros.filter((m) => !renovacaoDe(g, m));
  const cont = { sim: 0, talvez: 0, nao: 0 };
  membros.forEach((m) => { const r = renovacaoDe(g, m); if (r && cont[r.renova] !== undefined) cont[r.renova]++; });
  const e = new EmbedBuilder().setColor(AZUL).setTitle(`🏁 ${g.codigo} ${ultimo ? "está no último mês" : "termina no mês que vem"} (${C.rotuloMes(C.fimDo(g), true)})`)
    .setDescription([`**Quitados:** ${quitados}/${membros.length}`, `**Ainda não resgataram:** ${semResgate.length}` + (semResgate.length ? ` — ${curto(semResgate.map((m) => C.primeiroNome(m.nome)).join(", "), 700)}` : ""),
      `**Renovação:** 🔁 ${cont.sim} · 🤔 ${cont.talvez} · ❌ ${cont.nao} · ⏳ ${semResposta.length} sem resposta`,
      semResposta.length ? "\nUse o menu para mandar o link de renovação a quem ainda não respondeu." : "\nTodo mundo já respondeu a renovação. 🎉"].join("\n"));
  const comp = [menuMembros("ren", g, semResposta.filter((m) => m.whatsapp).map((m) => ({ m, descricao: C.fone(m.whatsapp) })), "🔁 Mandar renovação para…")].filter(Boolean);
  await enviar("alertas", { embeds: [e], components: comp });
}

async function relatorioMensal(ym) {
  const e = new EmbedBuilder().setColor(COR).setTitle(`📊 Relatório do consórcio · ${C.rotuloMes(ym, true)}`);
  let recebido = 0, previsto = 0;
  const linhas = [];
  for (const g of C.ordenarGrupos([...grupos.values()])) {
    if (!C.mesesDo(g).includes(ym)) continue;
    const membros = g.membros || [];
    const pagaram = membros.filter((m) => m.pagos?.[ym]).length;
    recebido += pagaram * g.valorParcela; previsto += membros.length * g.valorParcela;
    linhas.push(`**${g.codigo}** · ${pagaram}/${membros.length} pagaram · ${C.brl(pagaram * g.valorParcela)}`);
  }
  const atrasoAgora = [...grupos.values()].filter((g) => C.situacao(g) === "andamento").reduce((t, g) => t + C.resumoGrupo(g).emAtraso, 0);
  e.setDescription((linhas.join("\n") || "Nenhum grupo com parcela nesse mês.") + `\n\n💰 **Recebido:** ${C.brl(recebido)} de ${C.brl(previsto)}` +
    (previsto ? ` (${Math.round((recebido / previsto) * 100)}%)` : "") + `\n⚠️ **Em atraso hoje:** ${C.brl(atrasoAgora)}`);
  try {
    await carregarRespostas(true);
    const [ren, res] = await Promise.all([db.leadsPorOrigem("consorcio-renovacao"), db.leadsPorOrigem("consorcio-reserva")]);
    const doMes = (l) => String(new Date(l.criadoEm).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })).startsWith(ym);
    const r = ren.filter(doMes), rs = res.filter(doMes);
    const notas = r.map((l) => Number((String(l.detalhe).match(/\[nota:(\d)\]/) || [])[1]) || 0).filter(Boolean);
    const conta = (v) => r.filter((l) => renovaDoLead(l) === v).length;
    if (r.length) e.addFields({ name: `🔁 Renovação (${r.length} respostas)`, value: `Sim ${conta("sim")} · Talvez ${conta("talvez")} · Não ${conta("nao")}` + (notas.length ? ` · nota média ${(notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1).replace(".", ",")}/5` : "") });
    const criticas = r.map((l) => (String(l.detalhe).match(/Pode melhorar:\s*([^|\[]+)/) || [])[1]).filter(Boolean).map((t) => "• " + curto(t.trim(), 180));
    if (criticas.length) e.addFields({ name: "💬 O que podemos melhorar", value: curto(criticas.join("\n"), 1000) });
    const sugestoes = r.map((l) => (String(l.detalhe).match(/Sugestões:\s*([^|\[]+)/) || [])[1]).filter(Boolean).map((t) => "• " + curto(t.trim(), 180));
    if (sugestoes.length) e.addFields({ name: "💡 Sugestões", value: curto(sugestoes.join("\n"), 1000) });
    if (rs.length) e.addFields({ name: "📝 Banco de reserva", value: `${rs.length} nova(s) reserva(s) no mês` });
  } catch (err) { log("relatório (respostas): " + err.message); }
  const vm = somarVendas((d) => d.startsWith(ym));
  if (vm.qtd) e.addFields({ name: "🛍️ Vendas no Revendi", value: `${vm.qtd} venda(s) · ${C.brl(vm.total)} · ticket médio ${C.brl(vm.total / vm.qtd)}` });
  if (crediario.length) {
    const doMes = crediario.filter((p) => String(p.vencimento).startsWith(ym));
    const pagas = doMes.filter((p) => p.pagoEm);
    const soma = (xs) => xs.reduce((t, p) => t + (Number(p.valor) || 0), 0);
    if (doMes.length) e.addFields({ name: "💳 Crediário do mês", value: `${pagas.length}/${doMes.length} parcelas pagas · ${C.brl(soma(pagas))} de ${C.brl(soma(doMes))}` });
  }
  const files = [];
  const gs = C.ordenarGrupos([...grupos.values()]).filter((g) => C.mesesDo(g).includes(ym) && (g.membros || []).length);
  if (gs.length) {
    const { cfg, extra } = G.configRanking(`Consórcio · % que pagou ${C.rotuloMes(ym)}`, gs.map((g) => g.codigo),
      gs.map((g) => Math.round(((g.membros || []).filter((m) => m.pagos?.[ym]).length / g.membros.length) * 100)), "pct");
    const png = await G.desenhar(cfg, { altura: 120 + gs.length * 46, extra, log });
    if (png) { files.push(new AttachmentBuilder(png, { name: "consorcio.png" })); e.setImage("attachment://consorcio.png"); }
  }
  const resgates = [...grupos.values()].flatMap((g) => (g.membros || []).filter((m) => String(m.resgatadoEm || "").startsWith(ym)).map((m) => `${m.nome} (${g.codigo})`));
  if (resgates.length) e.addFields({ name: `🎁 Resgates no mês (${resgates.length})`, value: curto(resgates.join(" · "), 1000) });
  await enviar("resumo", { embeds: [e], files });
}

async function backupSemanal() {
  const dados = { geradoEm: new Date().toISOString(), grupos: [...grupos.values()].map(({ _atualizado, ...g }) => g) };
  const arquivo = new AttachmentBuilder(Buffer.from(JSON.stringify(dados, null, 2), "utf8"), { name: `consorcio-backup-${C.agoraSP().data}.json` });
  await enviar("logs", { content: `💾 Backup semanal dos grupos do consórcio (${dados.grupos.length} grupos). Guarde se quiser; o painel continua sendo a fonte oficial.`, files: [arquivo] });
}

async function cobrancasCrediario() {
  const clientes = clientesCrediario().filter((c) => c.abertas.some((p) => CR.venceHoje(p) || CR.atrasada(p)))
    .sort((a, b) => b.emAtraso - a.emAtraso);
  if (!clientes.length) return;
  const linhas = clientes.map((c) => {
    const hoje = c.abertas.filter(CR.venceHoje), atr = c.atrasadas;
    return `• **${c.cliente}** · ` + [atr.length ? `⚠️ ${atr.length} atrasada(s) ${C.brl(c.emAtraso)}` : "", hoje.length ? `📅 vence hoje ${C.brl(hoje.reduce((t, p) => t + p.valor, 0))}` : ""].filter(Boolean).join(" · ");
  });
  const opcoes = clientes.filter((c) => c.whatsapp).slice(0, 25).map((c) => ({ label: curto(c.cliente, 100), value: curto(C.chaveTel(c.whatsapp), 100), description: curto(`Em aberto ${C.brl(c.devendo)}`, 100) }));
  const e = new EmbedBuilder().setColor(ROXO).setTitle(`💳 Crediário de hoje · ${C.dataBR(CR.hojeISO())}`).setDescription(curto(linhas.join("\n"), 4000))
    .setFooter({ text: "Dados do Revendi (só leitura). Dê baixa no Revendi; aqui atualiza na próxima sincronização." });
  const comp = opcoes.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("crd").setPlaceholder("📲 Cobrar no WhatsApp…").addOptions(opcoes))] : [];
  const files = [];
  const hoje = CR.hojeISO(), semanas = Array.from({ length: 8 }, (_, n) => PR.somarDias(hoje, n * 7));
  const porSemana = semanas.map((ini) => { const fim = PR.somarDias(ini, 6); return Math.round(crediario.filter((p) => CR.aberta(p) && p.vencimento >= ini && p.vencimento <= fim).reduce((t, p) => t + (Number(p.valor) || 0), 0) * 100) / 100; });
  const atraso = CR.resumo(crediario).atraso;
  if (porSemana.some((v) => v > 0) || atraso > 0) {
    const png = await G.desenhar(G.configDiario("Crediário a receber", ["Em atraso", ...semanas.map((x, n) => n === 0 ? "esta semana" : "sem. " + PR.rotuloDia(x, false))],
      [atraso, ...porSemana], null, ["A receber"]), { altura: 380, log });
    if (png) { files.push(new AttachmentBuilder(png, { name: "crediario.png" })); e.setImage("attachment://crediario.png"); }
  }
  await enviar(estado.canais?.crediario ? "crediario" : "cobrancas", { embeds: [e], components: comp, files });
}

// ---------------------------------------------------------------- Revendi no Discord
const ROSA_RV = V.CORES.venda;
const menuZap = (id, placeholder, itens) => itens.length
  ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(itens.slice(0, 25)))] : [];
const linhaItem = (it) => `${it.brinde ? "🎁" : V.emojiMarca(it.marca) || "•"} ${it.qtd}× ${curto(it.nome, 55)}${it.marca ? ` · ${curto(it.marca, 20)}` : ""}${it.brinde ? " (brinde)" : ` · ${C.brl(it.preco * it.qtd)}`}`;

function embedVenda(v) {
  const sit = PR.situacaoPagamento(v);
  const itens = v.itens?.length ? v.itens.map(linhaItem).join("\n") : `${v.qtdItens || "?"} item(ns)`;
  const e = new EmbedBuilder().setColor(sit === "pago" ? VERDE : sit === "parcial" ? AMARELO : ROSA_RV)
    .setTitle(`🛍️ ${curto(v.cliente, 60)} · ${C.brl(v.valor)}`)
    .setDescription(curto(itens, 3500) + (v.obs ? `\n\n📝 ${curto(v.obs, 200)}` : ""))
    .addFields(
      { name: "Pagamento", value: PR.ROTULO_PAG[sit] + (sit !== "pago" ? ` · falta ${C.brl(v.valor - v.pago)}` : ""), inline: true },
      { name: "Lucro", value: C.brl(v.lucro) + (v.valor ? ` (${Math.round((v.lucro / v.valor) * 100)}%)` : ""), inline: true },
      { name: "Entrega", value: v.entrega === "PENDING" ? "🚚 A entregar" : "✅ Entregue", inline: true })
    .setFooter({ text: `Venda ${v.id} no Revendi · ${C.dataBR(v.data)}` + (v.desconto ? ` · desconto ${C.brl(v.desconto)}` : "") });
  const foto = v.itens?.find((it) => /^https:\/\//.test(it.foto || ""))?.foto;
  if (foto) e.setThumbnail(foto);
  return e;
}

/** #vendas: posta cada venda nova. Na primeira vez só marca as que já existiam (não inunda o canal). */
async function postarVendasNovas() {
  if (!temPainel() || !estado.canais?.rvVendas) return;
  const vistas = new Set(estado.rvVendasVistas || []);
  if (!estado.rvVendasIniciado) {
    estado.rvVendasIniciado = new Date().toISOString();
    estado.rvVendasVistas = painelRV.vendas.slice(0, 600).map((v) => v.id); salvar();
    const ult = painelRV.vendas.slice(0, 3).reverse();
    for (const v of ult) await enviar("rvVendas", { content: "↩️ Últimas vendas antes de ligar o canal:", embeds: [embedVenda(v)] });
    return;
  }
  const novas = painelRV.vendas.filter((v) => !vistas.has(v.id)).reverse();
  if (!novas.length) return;
  for (const v of novas.slice(-15)) {
    const zap = v.whatsapp ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`rvw:ag:${v.id}`).setLabel("Agradecer no WhatsApp").setEmoji("💝").setStyle(ButtonStyle.Secondary))] : [];
    await enviar("rvVendas", { embeds: [embedVenda(v)], components: zap });
    vistas.add(v.id);
  }
  novas.forEach((v) => vistas.add(v.id));
  estado.rvVendasVistas = [...vistas].slice(-600); salvar();
}

/** Mensagem fixa num canal, editada quando o conteúdo muda (painéis de entregas e estoque). */
async function painelFixo(chave, conteudo) {
  V.decorar(conteudo);
  const c = await canal(chave);
  if (!c) return;
  estado.rvFixos = estado.rvFixos || {};
  const marca = createHash("sha1").update(JSON.stringify(conteudo).replace(/Atualizado [^"·]+/g, "")).digest("hex");
  const atual = estado.rvFixos[chave];
  if (atual?.marca === marca) return;
  let msg = null;
  if (atual?.msg) { try { msg = await c.messages.fetch(atual.msg); } catch {} }
  try {
    if (msg) await msg.edit(conteudo); else msg = await c.send(conteudo);
    estado.rvFixos[chave] = { msg: msg.id, marca }; salvar();
  } catch (e) { log(`painel ${chave}: ${e.message}`); }
}

function conteudoEntregas() {
  const hoje = CR.hojeISO();
  const lista = PR.entregasPendentes(painelRV.vendas, hoje);
  const e = new EmbedBuilder().setColor(lista.some((v) => v.esperando > 3) ? VERMELHO : lista.length ? AMARELO : VERDE)
    .setTitle(`🚚 Entregas pendentes (${lista.length})`)
    .setDescription(lista.length ? curto(lista.map((v) => `${v.esperando > 3 ? "🔴" : v.esperando > 1 ? "🟡" : "🟢"} **${curto(v.cliente, 40)}** · ${C.brl(v.valor)} · vendida ${C.dataBR(v.data)}` +
      ` · ${v.esperando === 0 ? "hoje" : v.esperando + " dia(s)"}` + (v.itens?.length ? `\n  ${curto(v.itens.map((it) => `${it.qtd}× ${it.nome}`).join(", "), 180)}` : "")).join("\n"), 4000)
      : "Tudo entregue! 🎉")
    .setFooter({ text: "Marque como entregue no Revendi; este painel se atualiza sozinho · 🟢 até 1 dia · 🟡 2-3 dias · 🔴 mais de 3" });
  const op = lista.filter((v) => v.whatsapp).map((v) => ({ label: curto(v.cliente, 100), value: v.id, description: curto(`${C.brl(v.valor)} · ${v.esperando} dia(s) esperando`, 100) }));
  return { embeds: [e], components: menuZap("rvw:en", "📲 Combinar entrega no WhatsApp…", op) };
}
async function painelEntregas() { await painelFixo("rvEntregas", conteudoEntregas()); }

function conteudoEstoque() {
  const a = PR.alertasEstoque(painelRV.produtos, painelRV.vendas, CR.hojeISO());
  const e = new EmbedBuilder().setColor(a.vencendo.some((p) => p.faltam <= 15) ? VERMELHO : COR).setTitle("📦 Estoque")
    .setDescription(`**${a.totalProdutos}** produtos · **${a.totalUnidades}** unidades · valor de venda ${C.brl(a.valorEstoque)}`);
  if (a.vencendo.length) e.addFields({ name: `⏰ Vencendo nos próximos 60 dias (${a.vencendo.length})`, value: curto(a.vencendo.map((p) =>
    `${p.faltam < 0 ? "⛔ venceu" : p.faltam <= 15 ? "🔴" : p.faltam <= 30 ? "🟡" : "🟢"} ${curto(p.nome, 50)}${p.marca ? " · " + p.marca : ""} · ${p.unidades} un · ${C.dataBR(p.validade)}` +
    (p.faltam >= 0 ? ` (${p.faltam} dias)` : "")).join("\n"), 1024) });
  else e.addFields({ name: "⏰ Vencendo nos próximos 60 dias", value: "Nada vencendo. ✅" });
  if (a.esgotados.length) e.addFields({ name: `🛒 Esgotados que vendem (repor) (${a.esgotados.length})`, value: curto(a.esgotados.map((p) =>
    `${V.emojiMarca(p.marca) || "•"} ${curto(p.nome, 50)}${p.codigo ? " · cód. " + p.codigo : ""} · ${p.vendidos} vendido(s) em 90 dias`).join("\n"), 1024) });
  if (a.parados.length) e.addFields({ name: `💤 Parados há mais de 90 dias (${a.parados.length} · ${C.brl(a.valorParado)})`, value: curto(a.parados.slice(0, 12).map((p) =>
    `${V.emojiMarca(p.marca) || "•"} ${curto(p.nome, 50)} · ${p.unidades} un · ${C.brl(p.valorParado)}`).join("\n") +
    (a.parados.length > 12 ? `\n… e mais ${a.parados.length - 12}` : "") + "\n💡 Boa hora para promoção, kit ou brinde.", 1024) });
  e.setFooter({ text: `Atualizado ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · dados do Revendi` });
  return { embeds: [e] };
}
async function painelEstoque() { await painelFixo("rvEstoque", conteudoEstoque()); }

async function aniversariosDoDia(segunda) {
  const hoje = CR.hojeISO();
  const doDia = PR.aniversariantes(painelRV.clientes, hoje, 0);
  const hist = new Map(PR.historicoClientes(painelRV.vendas).map((h) => [h.chave, h]));
  const extra = (c) => { const h = hist.get(C.chaveTel(c.whatsapp) || c.nome.toLowerCase()); return h ? ` · ${h.compras} compra(s), ${C.brl(h.total)}` : ""; };
  if (doDia.length) {
    const e = new EmbedBuilder().setColor(ROSA_RV).setTitle(`🎂 Aniversariantes de hoje · ${C.dataBR(hoje)}`)
      .setDescription(doDia.map((c) => `🎉 **${c.nome}**${c.whatsapp ? " · " + C.fone(c.whatsapp) : " · sem WhatsApp"}${extra(c)}`).join("\n"));
    const op = doDia.filter((c) => c.whatsapp).map((c) => ({ label: curto(c.nome, 100), value: c.id }));
    await enviar("rvAniversarios", { embeds: [e], components: menuZap("rvw:an", "🎂 Mandar parabéns no WhatsApp…", op) });
  }
  if (segunda) {
    const semana = PR.aniversariantes(painelRV.clientes, hoje, 6).filter((c) => c.emDias > 0);
    const e = new EmbedBuilder().setColor(ROSA_RV).setTitle("📅 Aniversários desta semana")
      .setDescription(semana.length ? semana.map((c) => `• ${C.dataBR(c.data).slice(0, 5)} · **${c.nome}**${extra(c)}`).join("\n") : "Ninguém faz aniversário nos próximos 6 dias.")
      .setFooter({ text: "No dia, o parabéns aparece aqui com o WhatsApp pronto." });
    await enviar("rvAniversarios", { embeds: [e] });
  }
}

async function reativacaoSemanal() {
  const lista = PR.paraReativar(painelRV.vendas, CR.hojeISO(), 60).slice(0, 25);
  const e = new EmbedBuilder().setColor(COR).setTitle(`💌 Clientes sumidas · ${lista.length} para chamar de volta`)
    .setDescription(lista.length ? curto(lista.map((h) => `• **${curto(h.cliente, 40)}** · ${h.semComprar} dias sem comprar · ${h.compras} compra(s), ${C.brl(h.total)}` +
      (h.marcaFavorita ? ` · gosta de ${h.marcaFavorita}` : "")).join("\n"), 4000) : "Todas as clientes compraram nos últimos 60 dias. 🎉")
    .setFooter({ text: "Ordenadas por quanto já compraram no último ano · a mensagem cita a marca favorita dela" });
  const op = lista.map((h) => ({ label: curto(h.cliente, 100), value: curto(h.chave, 100), description: curto(`${h.semComprar} dias · ${C.brl(h.total)}`, 100) }));
  await enviar("rvReativar", { embeds: [e], components: menuZap("rvw:re", "📲 Chamar no WhatsApp…", op) });
}

const MEDALHA = ["🥇", "🥈", "🥉"];
function embedDesempenho(titulo, d, ant) {
  const e = new EmbedBuilder().setColor(COR).setTitle(titulo)
    .setDescription(`**${d.qtd}** venda(s) · **${C.brl(d.total)}** (${PR.variacao(d.total, ant.total)})\n` +
      `💰 Lucro ${C.brl(d.lucro)} · margem ${d.margem}% (${PR.variacao(d.lucro, ant.lucro)})\n` +
      `🧾 Ticket médio ${C.brl(d.ticket)} (${PR.variacao(d.ticket, ant.ticket)}) · recebido ${C.brl(d.recebido)}\n` +
      `👥 ${d.topClientes.length} cliente(s), ${d.clientesNovas} nova(s)`);
  if (d.topProdutos.length) e.addFields({ name: "🏆 Mais vendidos", value: curto(d.topProdutos.slice(0, 5).map((p, n) => `${MEDALHA[n] || n + 1 + "."} ${V.emojiMarca(p.marca)} ${curto(p.nome, 50)} · ${p.qtd} un · ${C.brl(p.total)}`).join("\n"), 1024) });
  if (d.topClientes.length) e.addFields({ name: "💖 Clientes que mais compraram", value: curto(d.topClientes.slice(0, 5).map((c, n) => `${MEDALHA[n] || n + 1 + "."} ${curto(c.cliente, 40)} · ${C.brl(c.total)}`).join("\n"), 1024), inline: true });
  if (d.topMarcas.length) e.addFields({ name: "🏷️ Marcas", value: curto(d.topMarcas.slice(0, 5).map((m) => `• ${m.marca} · ${C.brl(m.total)}`).join("\n"), 1024), inline: true });
  return e.setFooter({ text: `Comparação com o período anterior de mesmo tamanho · dados do Revendi` });
}
/** Desempenho com gráficos: barras por dia (período × anterior) e ranking dos mais vendidos. */
async function relatorioDesempenho(titulo, ini, fim, iniAnt, fimAnt) {
  const d = PR.desempenho(painelRV.vendas, ini, fim), ant = PR.desempenho(painelRV.vendas, iniAnt, fimAnt);
  const e = embedDesempenho(titulo, d, ant);
  const dias = PR.diasDoPeriodo(ini, fim), longo = dias.length > 10;
  const files = [], embeds = [e];
  const png = await G.desenhar(G.configDiario("Vendas por dia", dias.map((x) => longo ? x.slice(8, 10) : PR.rotuloDia(x)),
    PR.serieDiaria(painelRV.vendas, ini, fim), PR.serieDiaria(painelRV.vendas, iniAnt, fimAnt).slice(0, dias.length),
    [longo ? "Este período" : "Esta semana", longo ? "Período anterior" : "Semana anterior"]), { log });
  if (png) { files.push(new AttachmentBuilder(png, { name: "vendas.png" })); e.setImage("attachment://vendas.png"); }
  const top = d.topProdutos.slice(0, 8);
  if (top.length >= 2) {
    const { cfg, extra } = G.configRanking("Mais vendidos (unidades)", top.map((p) => G.rotulo(p.nome)), top.map((p) => p.qtd), "un");
    const png2 = await G.desenhar(cfg, { altura: 120 + top.length * 42, extra, log });
    if (png2) { files.push(new AttachmentBuilder(png2, { name: "produtos.png" })); embeds.push(new EmbedBuilder().setColor(COR).setImage("attachment://produtos.png")); }
  }
  return { embeds, files };
}
async function desempenhoSemanal() {
  const hoje = CR.hojeISO(), fim = PR.somarDias(hoje, -1), ini = PR.somarDias(hoje, -7);
  await enviar("rvDesempenho", await relatorioDesempenho(`📈 Semana ${C.dataBR(ini).slice(0, 5)} a ${C.dataBR(fim).slice(0, 5)}`, ini, fim, PR.somarDias(ini, -7), PR.somarDias(ini, -1)));
}
async function desempenhoMensal(ym) {
  const ini = ym + "-01", fim = PR.somarDias(C.somarMes(ym, 1) + "-01", -1), ymA = C.somarMes(ym, -1);
  await enviar("rvDesempenho", await relatorioDesempenho(`📊 ${C.rotuloMes(ym, true)} no Revendi`, ini, fim, ymA + "-01", PR.somarDias(ini, -1)));
}

async function rotinasRevendi(h) {
  if (!temPainel() || !estado.canais?.rvVendas) return;
  await postarVendasNovas().catch((e) => log("vendas: " + e.message));
  if (estado.rvPainelVisto !== painelRV.atualizadoEm) {
    estado.rvPainelVisto = painelRV.atualizadoEm;
    await painelEntregas().catch((e) => log("entregas: " + e.message));
    await painelEstoque().catch((e) => log("estoque: " + e.message));
  }
  if (h.hora < 8 || h.hora >= 21) return;
  if (estado.rvAniv !== h.data) { estado.rvAniv = h.data; salvar(); await aniversariosDoDia(h.diaSemana === 1 || !estado.rvAnivSemana).catch((e) => log("aniversários: " + e.message)); estado.rvAnivSemana = true; }
  if (h.hora >= 9 && (h.diaSemana === 1 || !estado.rvDesSemana) && estado.rvDesSemana !== h.data) { estado.rvDesSemana = h.data; salvar(); await desempenhoSemanal().catch((e) => log("desempenho: " + e.message)); }
  if (h.hora >= 9 && h.dia === 1 && estado.rvDesMes !== h.ym) { estado.rvDesMes = h.ym; salvar(); await desempenhoMensal(C.somarMes(h.ym, -1)).catch((e) => log("desempenho do mês: " + e.message)); }
  if (h.hora >= 10 && (h.diaSemana === 1 || !estado.rvReativar) && estado.rvReativar !== h.data) { estado.rvReativar = h.data; salvar(); await reativacaoSemanal().catch((e) => log("reativar: " + e.message)); }
}

// ---------------------------------------------------------------- limpeza automática dos canais
// Dias que cada canal guarda as mensagens do bot. Canais que não estão aqui (vendas, pagamentos, resgates,
// desempenho, grupos, renovações, pedidos…) guardam tudo: são histórico. Mensagens fixadas e os painéis
// fixos nunca são apagados. Mudar no .env: LIMPEZA_<CANAL>=dias (ex.: LIMPEZA_CREDIARIO=5) ou LIMPEZA=nao.
const RETENCAO = { crediario: 3, rvAniversarios: 7, rvReativar: 8, resumo: 15, alertas: 7, logs: 10, cobrancas: 40, comprovantes: 40, comandos: 1 };
const LIMPEZA_LIGADA = String(process.env.LIMPEZA || "").toLowerCase() !== "nao";
const diasDe = (chave) => { const v = process.env["LIMPEZA_" + chave.replace(/^rv/, "").toUpperCase()]; return v !== undefined && v !== "" ? Number(v) : RETENCAO[chave]; };
async function limparCanal(chave, dias) {
  const c = await canal(chave);
  if (!c?.messages || !(dias > 0)) return 0;
  const corte = Date.now() - dias * 864e5, limite14 = Date.now() - 13.5 * 864e5;
  const protegidas = new Set([estado.central?.msg, ...Object.values(estado.rvFixos || {}).map((x) => x.msg)].filter(Boolean));
  const recentes = [], antigas = [];
  let antes;
  for (let pagina = 0; pagina < 10; pagina++) {
    const lote = await c.messages.fetch({ limit: 100, ...(antes ? { before: antes } : {}) }).catch(() => null);
    if (!lote?.size) break;
    for (const m of lote.values()) {
      if (m.pinned || protegidas.has(m.id) || m.createdTimestamp > corte) continue;
      if (m.author?.id !== client.user.id && chave !== "comandos") continue;
      if (m.embeds?.[0]?.title?.startsWith("📊") || (chave === "logs" && m.attachments?.size)) continue; // relatórios do mês e backups ficam
      (m.createdTimestamp > limite14 ? recentes : antigas).push(m);
    }
    antes = lote.last().id;
    if (lote.size < 100) break;
  }
  let n = 0;
  for (let i = 0; i < recentes.length; i += 100) { try { const r = await c.bulkDelete(recentes.slice(i, i + 100), true); n += r.size; } catch (e) { log(`limpeza ${chave}: ${e.message}`); } }
  for (const m of antigas.slice(0, 40)) { try { await m.delete(); n++; await new Promise((ok) => setTimeout(ok, 1200)); } catch {} }
  return n;
}
async function limpezaDiaria(h) {
  if (!LIMPEZA_LIGADA || estado.limpezaDia === h.data) return;
  estado.limpezaDia = h.data; salvar();
  const feitos = [];
  for (const chave of Object.keys(RETENCAO)) { const n = await limparCanal(chave, diasDe(chave)).catch(() => 0); if (n) feitos.push(`${chave} ${n}`); }
  if (feitos.length) log("🧹 limpeza: " + feitos.join(", "));
}

function embedAniv30() {
  const l = PR.aniversariantes(painelRV.clientes, CR.hojeISO(), 30);
  return new EmbedBuilder().setColor(ROSA_RV).setTitle("🎂 Aniversários · próximos 30 dias")
    .setDescription(l.length ? curto(l.map((c) => `• ${C.dataBR(c.data).slice(0, 5)}${c.emDias === 0 ? " (hoje!)" : ""} · **${c.nome}**`).join("\n"), 4000) : "Ninguém nos próximos 30 dias (ou as clientes estão sem data de aniversário no Revendi).");
}
function embedCrediario() {
  const r = CR.resumo(crediario);
  const atr = clientesCrediario().filter((c) => c.atrasadas.length).sort((a, b) => b.emAtraso - a.emAtraso).slice(0, 15);
  return new EmbedBuilder().setColor(r.atraso ? VERMELHO : ROXO).setTitle("💳 Crediário")
    .setDescription(`A receber: **${C.brl(r.aReceber)}** · vence hoje ${C.brl(r.hoje)} · próximos 7 dias ${C.brl(r.semana)}\n⚠️ Em atraso: **${C.brl(r.atraso)}** (${r.clientesAtraso} cliente(s))`)
    .addFields({ name: "Quem está em atraso", value: atr.length ? curto(atr.map((c) => `• **${curto(c.cliente, 40)}** · ${c.atrasadas.length} parcela(s) · ${C.brl(c.emAtraso)}`).join("\n"), 1024) : "Ninguém. 🎉" })
    .setFooter({ text: "Para cobrar: /cliente ou o menu do post das 9h em #crediario" });
}

// ---------------------------------------------------------------- painel 🌸 hoje (ao vivo) e status do bot
const metaDoMes = (ym) => Number(estado.metas?.[ym] ?? process.env.META_VENDAS_MES ?? 0) || 0;
function conteudoHoje() {
  const h = C.agoraSP(), hoje = h.data, ini = h.ym + "-01";
  const e = new EmbedBuilder().setColor(COR).setTitle(`🌸 Hoje · ${PR.rotuloDia(hoje)}`);
  if (temPainel()) {
    const dHoje = PR.desempenho(painelRV.vendas, hoje, hoje), dMes = PR.desempenho(painelRV.vendas, ini, hoje), meta = metaDoMes(h.ym);
    const diasMes = new Date(h.ano, h.mes, 0).getDate();
    const linhasMes = [`**${C.brl(dMes.total)}** em ${dMes.qtd} venda(s) · lucro ${C.brl(dMes.lucro)}`];
    if (meta) {
      const esperado = meta * (h.dia / diasMes), falta = Math.max(0, meta - dMes.total), porDia = falta / Math.max(1, diasMes - h.dia + 1);
      linhasMes.push(`🎯 \`${V.barra(dMes.total, meta, 12)}\` **${V.pct(dMes.total, meta)}%** de ${C.brl(meta)}`,
        dMes.total >= meta ? "🏆 Meta batida!" : `${dMes.total >= esperado ? "✅ No ritmo" : "⚠️ Abaixo do ritmo"} · faltam ${C.brl(falta)} (≈ ${C.brl(porDia)}/dia)`);
    } else linhasMes.push("🎯 Sem meta: use `/revendi meta`");
    e.addFields({ name: "🛍️ Vendas de hoje", value: dHoje.qtd ? `**${dHoje.qtd}** · ${C.brl(dHoje.total)} · lucro ${C.brl(dHoje.lucro)}` : "Nenhuma ainda", inline: true },
      { name: `📅 ${C.rotuloMes(h.ym, true)}`, value: linhasMes.join("\n"), inline: true });
    const ent = PR.entregasPendentes(painelRV.vendas, hoje), aniv = PR.aniversariantes(painelRV.clientes, hoje, 0);
    const est = PR.alertasEstoque(painelRV.produtos, painelRV.vendas, hoje, { diasValidade: 30 });
    e.addFields(
      { name: "🚚 Entregas", value: ent.length ? `**${ent.length}** pendente(s)` + (ent.some((v) => v.esperando > 3) ? " · 🔴 atrasada" : "") : "✅ Tudo entregue", inline: true },
      { name: "🎂 Aniversários", value: aniv.length ? curto(aniv.map((c) => C.primeiroNome(c.nome)).join(", "), 200) : "Ninguém hoje", inline: true },
      { name: "📦 Estoque", value: [est.vencendo.length ? `⏰ ${est.vencendo.length} vencendo` : "", est.esgotados.length ? `🛒 ${est.esgotados.length} p/ repor` : ""].filter(Boolean).join(" · ") || "✅ Em dia", inline: true });
  }
  if (crediario.length) {
    const r = CR.resumo(crediario);
    e.addFields({ name: "💳 Crediário", value: `Hoje ${C.brl(r.hoje)} · ⚠️ atraso ${C.brl(r.atraso)} (${r.clientesAtraso})\n7 dias ${C.brl(r.semana)} · a receber ${C.brl(r.aReceber)}`, inline: false });
  }
  const ativos = C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) === "andamento");
  if (ativos.length) e.addFields({ name: `🤝 Consórcio · ${C.rotuloMes(h.ym, true)}`, value: curto(ativos.map((g) => { const r = C.resumoGrupo(g);
    return `**${g.codigo}** \`${V.barra(r.pagosNoMes, r.membros, 10)}\` ${r.pagosNoMes}/${r.membros}` + (r.comAtraso.length ? ` · ⚠️ ${r.comAtraso.length}` : " · ✅"); }).join("\n"), 1024) });
  if (!temPainel() && !crediario.length && !ativos.length) e.setDescription("Aguardando a primeira leitura do Revendi e do painel.");
  e.setFooter({ text: `Atualizado ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })} · atualiza sozinho` });
  return { embeds: [e] };
}
async function painelHoje() { if (estado.canais?.hoje) await painelFixo("hoje", conteudoHoje()); }

let statusAtual = "";
function atualizarStatus() {
  if (!client.user) return;
  const hoje = CR.hojeISO();
  const partes = [];
  if (temPainel()) {
    const d = PR.desempenho(painelRV.vendas, hoje, hoje), ent = PR.entregasPendentes(painelRV.vendas, hoje).length;
    partes.push(d.qtd ? `🛍️ ${d.qtd} venda(s) hoje · ${C.brl(d.total)}` : "🛍️ Sem vendas hoje ainda");
    if (ent) partes.push(`🚚 ${ent} entrega(s)`);
  } else partes.push("💝 Karen Martins Cosméticos");
  const texto = curto(partes.join(" · "), 120);
  if (texto === statusAtual) return;
  statusAtual = texto;
  try { client.user.setPresence({ status: "online", activities: [{ name: texto, state: texto, type: ActivityType.Custom }] }); } catch {}
}

// ---------------------------------------------------------------- área das clientes: boas-vindas e mapa
async function gravarMapa() {
  const mapa = await mapaServidor(guild, estado);
  try { fs.writeFileSync(path.join(PASTA, "servidor-mapa.json"), JSON.stringify({ geradoEm: new Date().toISOString(), clientesAbertos: Boolean(estado.clientesAbertos), mapa }, null, 2)); } catch {}
  return mapa;
}
function conteudoBoasVindas() {
  const e = new EmbedBuilder().setColor(COR).setTitle("Bem-vinda à Karen Martins Cosméticos! 💝")
    .setDescription("Aqui você acompanha as **novidades**, fala direto com a Karen e, se estiver no **consórcio**, vê as suas parcelas.\n\n" +
      "👉 Toque em **🌸 Entrar** e peça seu **set** com nome e WhatsApp. Se você já é cliente da Karen, é liberado na hora; se estiver no consórcio, ganha a tag do seu grupo.")
    .addFields({ name: "O que você vai encontrar", value: "✨ **novidades**: lançamentos e promoções\n🎫 **abrir-ticket**: fale com a Karen em particular\n💬 **fale-com-a-karen**: conversa aberta com as clientes\n⏳ **Aguardando atendimento**: entre na call e espere, a Karen te chama\n💳 **meu-consorcio**: suas parcelas (para consorciadas)" })
    .setThumbnail(V.LOGO_URL).setFooter({ text: "O Boticário · Eudora · Quem Disse, Berenice? · O.U.i · Consórcio" });
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cli:entrar").setLabel("Entrar · pedir set").setEmoji("🌸").setStyle(ButtonStyle.Success))] };
}

// ---------------------------------------------------------------- fila de atendimento por voz
// Cliente entra em ⏳ Aguardando → aviso em #alertas marcando Karen/Admin, com botões para puxar para 🎧 Atendimento 1/2.
const avisosEspera = new Map(); // userId → mensagem do aviso
const CALLS_ATEND = ["callatend1", "callatend2", "callatend3"];
const ehCallAtend = (id) => id && CALLS_ATEND.some((k) => estado.canais?.[k] === id);
/** Libera só para essa cliente a call de atendimento (as outras clientes continuam sem ver) e move ela. */
async function puxarCliente(membro, destino, quem) {
  await destino.permissionOverwrites.edit(membro.id, { ViewChannel: true, Connect: true, Speak: true, UseVAD: true, Stream: true, SendMessages: true, ReadMessageHistory: true }, { reason: "Atendimento" });
  await membro.voice.setChannel(destino, `Atendimento puxado por ${quem}`);
}
/** Tira a liberação quando a cliente sai da call de atendimento. */
async function tirarLiberacao(canalId, userId) {
  const ch = guild.channels.cache.get(canalId);
  if (ch?.permissionOverwrites?.cache?.has(userId)) await ch.permissionOverwrites.delete(userId, "Fim do atendimento").catch(() => {});
}
const ehDaEquipe = (m) => m?.permissions?.has(PermissionFlagsBits.Administrator) || [estado.cargos?.dona, estado.cargos?.admin].some((id) => id && m?.roles?.cache?.has(id)) || m?.roles?.cache?.some((r) => RE_EQUIPE.test(r.name) && !r.managed);
async function entrouNaEspera(membro) {
  const c = await canal("alertas");
  if (!c) return;
  const tel = estado.vinculos?.[membro.id], chave = tel ? C.chaveTel(tel) : "";
  const cons = chave ? [...new Set([...grupos.values()].filter((g) => (g.membros || []).some((m) => C.chaveTel(m.whatsapp) === chave)).map((g) => g.codigo))] : [];
  const cred = chave ? clientesCrediario().find((x) => C.chaveTel(x.whatsapp) === chave) : null;
  const linhas = [`${membro} está na call **⏳ Aguardando atendimento**.`];
  if (tel) linhas.push(`📱 ${C.fone(tel)}`);
  if (cons.length) linhas.push(`💳 Consórcio: ${cons.join(", ")}`);
  if (cred?.atrasadas?.length) linhas.push(`⚠️ Crediário: ${cred.atrasadas.length} parcela(s) em atraso (${C.brl(cred.emAtraso)})`);
  const linha = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`atd:minha:${membro.id}`).setLabel("Puxar para a minha call").setEmoji("🎧").setStyle(ButtonStyle.Success));
  for (const k of CALLS_ATEND) {
    const ch = guild.channels.cache.get(estado.canais?.[k]);
    if (!ch) continue;
    const ocupada = ch.members?.some((m) => !ehDaEquipe(m));
    linha.addComponents(new ButtonBuilder().setCustomId(`atd:puxar:${membro.id}:${k}`).setLabel(curto(ch.name.replace(/^[^\p{L}\p{N}]+/u, ""), 30) + (ocupada ? " (ocupada)" : "")).setStyle(ocupada ? ButtonStyle.Secondary : ButtonStyle.Primary));
  }
  const mencoes = [estado.cargos?.dona, estado.cargos?.admin, ...cargosEquipeExtras(guild, estado.cargos).map((r) => r.id)].filter(Boolean);
  const msg = await c.send(V.decorar({ content: "@here " + mencoes.map((id) => `<@&${id}>`).join(" "), allowedMentions: { parse: ["everyone"], roles: mencoes },
    embeds: [new EmbedBuilder().setColor(AMARELO).setTitle(`🔔 ${curto(membro.displayName, 60)} aguardando atendimento`).setDescription(linhas.join("\n")).setFooter({ text: "Toque para puxar para a call de atendimento" }).setTimestamp()],
    components: [linha] })).catch((e) => { log("aviso de espera: " + e.message); return null; });
  if (msg) avisosEspera.set(membro.id, msg);
}
async function fecharAviso(userId, texto) {
  const msg = avisosEspera.get(userId);
  if (!msg) return;
  avisosEspera.delete(userId);
  const e = EmbedBuilder.from(msg.embeds[0]).setColor(texto.startsWith("✅") ? VERDE : V.CORES.neutro).setFooter({ text: texto });
  await msg.edit({ content: "", embeds: [e], components: [] }).catch(() => {});
}
client.on(Events.VoiceStateUpdate, async (antes, depois) => {
  try {
    const espera = estado.canais?.callespera;
    if (!espera || !depois.member || depois.member.user.bot) return;
    if (depois.channelId === espera && antes.channelId !== espera && !ehDaEquipe(depois.member)) await entrouNaEspera(depois.member);
    if (ehCallAtend(antes.channelId) && antes.channelId !== depois.channelId && !ehDaEquipe(depois.member)) await tirarLiberacao(antes.channelId, depois.member.id);
    if (antes.channelId === espera && depois.channelId !== espera) {
      const destino = depois.channel;
      await fecharAviso(depois.member.id, destino ? `✅ Em atendimento em ${destino.name}` : "Saiu da espera sem ser atendida");
    }
  } catch (e) { log("call de espera: " + e.message); }
});

// ---------------------------------------------------------------- tickets
const TIPOS_TICKET = {
  pedido: { emoji: "🛍️", nome: "Pedido / encomenda" },
  consorcio: { emoji: "💳", nome: "Consórcio" },
  pagamento: { emoji: "💰", nome: "Pagamento / crediário" },
  troca: { emoji: "🔁", nome: "Troca / defeito" },
  outro: { emoji: "❓", nome: "Outro assunto" },
};
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
function conteudoAbrirTicket() {
  const e = new EmbedBuilder().setColor(COR).setTitle("🎫 Fale com a Karen em particular")
    .setDescription("Escolha o assunto: abre um canal **só seu com a equipe**, ninguém mais vê.\n" +
      "Respondemos assim que possível (seg. a sáb.). Se preferir falar por voz, entre na call **Aguardando**.")
    .setFooter({ text: "Um ticket sem mensagens por 3 dias é fechado sozinho" });
  const b = (k) => new ButtonBuilder().setCustomId(`tk:abrir:${k}`).setLabel(TIPOS_TICKET[k].nome).setEmoji(TIPOS_TICKET[k].emoji).setStyle(k === "pedido" ? ButtonStyle.Primary : ButtonStyle.Secondary);
  return { embeds: [e], components: [new ActionRowBuilder().addComponents(...Object.keys(TIPOS_TICKET).map(b))] };
}
const ticketsAbertosDe = (userId) => Object.entries(estado.tickets || {}).filter(([id, t]) => t.user === userId && guild.channels.cache.get(id));
async function abrirTicket(i, tipo, texto) {
  const tp = TIPOS_TICKET[tipo] || TIPOS_TICKET.outro;
  const abertos = ticketsAbertosDe(i.user.id);
  if (abertos.length >= 2) return i.editReply(`Você já tem ticket aberto: <#${abertos[0][0]}>. Continue por lá 💝`);
  const cat = (await canal("ticketsFechados"))?.parent;
  if (!cat) return i.editReply("Os tickets ainda estão sendo preparados. Tente de novo em instantes.");
  const membro = await guild.members.fetch(i.user.id);
  estado.ticketSeq = (estado.ticketSeq || 0) + 1;
  const num = String(estado.ticketSeq).padStart(4, "0");
  const nome = estado.sets?.[i.user.id]?.nome || membro.displayName.replace(/^\[[^\]]*\]\s*-\s*/, "");
  const perms = permissoes(guild, "equipe", Object.fromEntries(Object.entries(estado.cargos || {}).map(([k, id]) => [k, guild.roles.cache.get(id)])), false);
  perms.push({ id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions] });
  const ch = await guild.channels.create({ name: `${tp.emoji}・${num}-${slug(nome) || "cliente"}`, parent: cat.id, topic: `Ticket ${num} · ${tp.nome} · ${nome}`, permissionOverwrites: perms });
  estado.tickets = { ...(estado.tickets || {}), [ch.id]: { user: i.user.id, tipo, num, nome, abertoEm: new Date().toISOString(), ultimo: Date.now(), assumido: "" } }; salvar();
  const acoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`tk:assumir:${ch.id}`).setLabel("Assumir").setEmoji("✋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`tk:fechar:${ch.id}`).setLabel("Fechar ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger));
  await ch.send(V.decorar({ content: `${membro} 💝`, embeds: [new EmbedBuilder().setColor(ROSA_RV).setTitle(`${tp.emoji} Ticket ${num} · ${tp.nome}`)
    .setDescription((texto ? `**${nome}** escreveu:\n> ${curto(texto, 1500).replace(/\n/g, "\n> ")}\n\n` : "") + "Obrigada por chamar! Alguém da equipe já vai te responder por aqui. Pode mandar fotos e prints. 🌸")
    .setFooter({ text: "Só você e a equipe da Karen veem este canal" })], components: [acoes] }));
  // ficha para a equipe (no #alertas, a cliente não vê)
  const set = estado.sets?.[i.user.id], tel = set?.tel || estado.vinculos?.[i.user.id];
  const linhas = [`${membro} abriu <#${ch.id}> · **${tp.nome}**`];
  if (tel) {
    linhas.push(`📱 ${C.fone(tel)}`);
    const h = PR.historicoClientes(painelRV.vendas).find((x) => C.chaveTel(x.whatsapp) === C.chaveTel(tel));
    if (h) linhas.push(`🛍️ ${h.compras} compra(s) no ano · ${C.brl(h.total)} · última ${C.dataBR(h.ultima)}`);
    if (set?.grupos?.length) linhas.push(`💳 Consórcio: ${set.grupos.join(", ")}`);
    const cr = clientesCrediario().find((x) => C.chaveTel(x.whatsapp) === C.chaveTel(tel));
    if (cr?.atrasadas?.length) linhas.push(`⚠️ Crediário: ${cr.atrasadas.length} parcela(s) em atraso (${C.brl(cr.emAtraso)})`);
  } else linhas.push("❔ Sem set (WhatsApp não ligado)");
  const mencoes = [estado.cargos?.dona, estado.cargos?.admin, ...cargosEquipeExtras(guild, estado.cargos).map((r) => r.id)].filter(Boolean);
  await enviar("alertas", { content: mencoes.map((id) => `<@&${id}>`).join(" "), allowedMentions: { roles: mencoes },
    embeds: [new EmbedBuilder().setColor(ROSA_RV).setTitle(`🎫 Ticket ${num} aberto`).setDescription(linhas.join("\n"))] });
  return i.editReply(`Seu ticket foi aberto: <#${ch.id}> 💝`);
}
async function fecharTicket(chId, quem, motivo = "") {
  const t = estado.tickets?.[chId], ch = guild.channels.cache.get(chId);
  if (!t || !ch) { if (t) { delete estado.tickets[chId]; salvar(); } return; }
  const msgs = [];
  let antes;
  for (let n = 0; n < 10; n++) {
    const lote = await ch.messages.fetch({ limit: 100, ...(antes ? { before: antes } : {}) }).catch(() => null);
    if (!lote?.size) break;
    msgs.push(...lote.values()); antes = lote.last().id;
    if (lote.size < 100) break;
  }
  const quando = (d) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const txt = [`Ticket ${t.num} · ${TIPOS_TICKET[t.tipo]?.nome || t.tipo} · ${t.nome}`, `Aberto: ${quando(t.abertoEm)} · Fechado: ${quando(Date.now())} por ${quem}${motivo ? " (" + motivo + ")" : ""}`, ""]
    .concat(msgs.reverse().filter((m) => m.content || m.attachments.size).map((m) => `[${quando(m.createdTimestamp)}] ${m.member?.displayName || m.author.username}: ${m.content}` +
      [...m.attachments.values()].map((a) => ` [anexo: ${a.url}]`).join(""))).join("\n");
  await enviar("ticketsFechados", { embeds: [new EmbedBuilder().setColor(V.CORES.neutro).setTitle(`🗂️ Ticket ${t.num} · ${t.nome}`)
    .setDescription(`${TIPOS_TICKET[t.tipo]?.emoji || ""} ${TIPOS_TICKET[t.tipo]?.nome || t.tipo} · <@${t.user}>\nFechado por ${quem}${motivo ? ` (${motivo})` : ""}` + (t.assumido ? ` · atendido por ${t.assumido}` : ""))],
    files: [new AttachmentBuilder(Buffer.from(txt, "utf8"), { name: `ticket-${t.num}.txt` })] });
  delete estado.tickets[chId]; salvar();
  await ch.delete(`Ticket fechado por ${quem}`).catch((e) => log("fechar ticket: " + e.message));
}
async function revisarTickets() {
  for (const [id, t] of Object.entries(estado.tickets || {})) {
    if (!guild.channels.cache.get(id)) { delete estado.tickets[id]; salvar(); continue; }
    const parado = Date.now() - (t.ultimo || Date.parse(t.abertoEm));
    if (parado > 72 * 3600e3) await fecharTicket(id, "bot", "3 dias sem mensagens");
    else if (parado > 48 * 3600e3 && !t.avisado) {
      t.avisado = true; salvar();
      await guild.channels.cache.get(id).send(`<@${t.user}> Ainda precisa de ajuda? 💝 Se ninguém escrever aqui, este ticket fecha sozinho amanhã.`).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------- central de botões (#comandos)
function conteudoCentral() {
  const e = new EmbedBuilder().setColor(COR).setTitle("💝 Central da Karen")
    .setDescription("Toque num botão: a resposta aparece **só para você** e some sozinha, sem encher o canal.\n" +
      "Para buscar um produto: `/produto` · uma cliente: `/cliente` · dar baixa no consórcio: `/consorcio pagou`.")
    .addFields(
      { name: "🛍️ Revendi", value: "Vendas de hoje e da semana, estoque, entregas, crediário, aniversários e clientes sumidas.", inline: true },
      { name: "🤝 Consórcio", value: "Resumo dos grupos e quem está em atraso.", inline: true })
    .setFooter({ text: temPainel() ? `Revendi lido em ${new Date(painelRV.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Revendi ainda não lido" });
  const b = (id, label, emoji, estilo = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId("cen:" + id).setLabel(label).setEmoji(emoji).setStyle(estilo);
  return { embeds: [e], components: [
    new ActionRowBuilder().addComponents(b("hoje", "Vendas de hoje", "🛍️", ButtonStyle.Primary), b("semana", "Semana", "📈"), b("mes", "Mês", "📊"), b("crediario", "Crediário", "💳")),
    new ActionRowBuilder().addComponents(b("estoque", "Estoque", "📦"), b("entregas", "Entregas", "🚚"), b("aniv", "Aniversários", "🎂"), b("sumidas", "Sumidas", "💌")),
    new ActionRowBuilder().addComponents(b("grupos", "Consórcio", "🤝"), b("atrasados", "Atrasados", "⚠️"), b("sync", "Atualizar Revendi", "🔄", ButtonStyle.Success)),
  ] };
}
async function centralFixa() {
  const c = await canal("comandos");
  if (!c) return;
  estado.central = estado.central || {};
  let msg = null;
  if (estado.central.msg) { try { msg = await c.messages.fetch(estado.central.msg); } catch {} }
  const conteudo = V.decorar(conteudoCentral());
  try {
    if (msg) await msg.edit(conteudo);
    else { msg = await c.send(conteudo); await msg.pin().catch(() => {}); estado.central.msg = msg.id; salvar(); }
  } catch (e) { log("central: " + e.message); }
}

async function rotinas() {
  const h = C.agoraSP();
  await limpezaDiaria(h).catch((e) => log("limpeza: " + e.message));
  if (estado.canais?.boasvindas) await painelFixo("boasvindas", conteudoBoasVindas()).catch(() => {});
  if (estado.canais?.abrirticket) await painelFixo("abrirticket", conteudoAbrirTicket()).catch(() => {});
  await revisarTickets().catch((e) => log("tickets: " + e.message));
  const meiaHora = h.data + h.hora + (C.agoraSP().minuto >= 30 ? "b" : "a");
  if (estado.setsRevisados !== meiaHora) { estado.setsRevisados = meiaHora; await revisarSets().catch((e) => log("sets: " + e.message)); }
  if (estado.mapaHora !== h.data + h.hora) { estado.mapaHora = h.data + h.hora; await gravarMapa().catch((e) => log("mapa: " + e.message)); }
  if (!estado.central?.msg || estado.central.lido !== painelRV.atualizadoEm) { await centralFixa(); if (estado.central) { estado.central.lido = painelRV.atualizadoEm; } }
  await rotinasRevendi(h);
  await painelHoje().catch((e) => log("painel hoje: " + e.message));
  atualizarStatus();
  if (h.hora >= 8 && h.hora < 21 && estado.resumoDia !== h.data) {
    estado.resumoDia = h.data; salvar();
    await resumoDoDia().catch((e) => log("resumo: " + e.message));
  }
  if (h.hora >= 9 && h.hora < 21) {
    if (h.dia === 1 && estado.relatorioMes !== h.ym) {
      estado.relatorioMes = h.ym; salvar();
      await relatorioMensal(C.somarMes(h.ym, -1)).catch((e) => log("relatório: " + e.message));
    }
    if (crediario.length && estado.crediarioDia !== h.data) {
      estado.crediarioDia = h.data; salvar();
      await cobrancasCrediario().catch((e) => log("crediário: " + e.message));
    }
    if (h.diaSemana === 0 && estado.backupData !== h.data) {
      estado.backupData = h.data; salvar();
      await backupSemanal().catch((e) => log("backup: " + e.message));
    }
    for (const g of grupos.values()) {
      if (C.situacao(g) !== "andamento") continue;
      const recente = g.criadoEm && Date.now() - Date.parse(g.criadoEm) < 6 * 3600e3;
      const vDia = C.diaVencimento(g, h.ano, h.mes);
      estado.lembreteMes = estado.lembreteMes || {}; estado.fimAviso = estado.fimAviso || {};
      if (vDia > 2 && h.dia === vDia - 2 && estado.lembreteMes[g.id] !== h.ym && !recente) {
        estado.lembreteMes[g.id] = h.ym; salvar();
        await lembreteVencimento(g).catch((e) => log("lembrete: " + e.message));
      }
      const fim = C.fimDo(g);
      if ((h.ym === fim || h.ym === C.somarMes(fim, -1)) && estado.fimAviso[g.id] !== h.ym) {
        estado.fimAviso[g.id] = h.ym; salvar();
        await carregarRespostas(true).catch(() => {});
        await avisoFimDeGrupo(g, h.ym === fim).catch((e) => log("fim de grupo: " + e.message));
      }
      const venc = Number(g.vencimento) || 10;
      const novo = g.criadoEm && Date.now() - Date.parse(g.criadoEm) < 6 * 3600e3;
      if (h.dia > venc && estado.cobrancaMes[g.id] !== h.ym && !novo) {
        estado.cobrancaMes[g.id] = h.ym; salvar();
        await cobrancasDoMes(g).catch((e) => log("cobranças: " + e.message));
      }
    }
  }
}

async function ciclo() {
  if (!guild || !db.firestoreConfigurado()) return;
  try {
    await carregarRespostas().catch((e) => log("respostas: " + e.message));
    if (await sincronizarRevendi((t) => (t.startsWith("⚠️") || t.includes("voltou") ? avisarLog(t) : log(t)))) crediarioLido = 0;
    await carregarCrediario().catch((e) => log("crediário: " + e.message));
    await verificarGrupos();
    await verificarLeads();
    await rotinas();
    ultimoCiclo = new Date().toISOString(); ultimoErro = "";
    // Sinal de vida para o painel (a cada ~10 min).
    if (!ciclo.sinal || Date.now() - ciclo.sinal > 9 * 60000) {
      ciclo.sinal = Date.now();
      await db.definir("botKaren", "status", { vistoEm: ultimoCiclo, discord: client.isReady(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size, pc: PC, revendi: revendiAtivo() }).catch(() => {});
    }
  } catch (e) {
    if (ultimoErro !== e.message) await avisarLog("⚠️ Erro ao ler o painel: " + e.message);
    ultimoErro = e.message;
  }
}

// ---------------------------------------------------------------- baixa de parcela
async function darBaixa(grupoId, membroId, ym, desfazer = false) {
  let resultado = null;
  const g = await db.alterarConsorcio(grupoId, (membros, atual) => {
    const m = membros.find((x) => x.id === membroId);
    if (!m) throw new Error("membro não encontrado");
    const meses = C.mesesDo(atual);
    m.pagos = m.pagos || {};
    let alvo = ym;
    if (!alvo) alvo = C.resumoMembro(atual, m).atrasadas[0] || meses.find((x) => !m.pagos[x]);
    if (!alvo || !meses.includes(alvo)) throw new Error("não há parcela em aberto para esse membro");
    if (desfazer) { if (!m.pagos[alvo]) throw new Error("essa parcela não estava paga"); delete m.pagos[alvo]; }
    else { if (m.pagos[alvo]) throw new Error(`a parcela de ${C.rotuloMes(alvo, true)} já estava paga`); m.pagos[alvo] = C.agoraSP().data; }
    resultado = { nome: m.nome, ym: alvo };
    return membros;
  });
  grupos.set(g.id, g);
  const m = (g.membros || []).find((x) => x.id === membroId);
  return { g, m, ...resultado };
}

// ---------------------------------------------------------------- interações
async function autocompletar(i) {
  const foco = i.options.getFocused(true);
  const texto = String(foco.value || "").toLowerCase();
  let opcoes = [];
  if (foco.name === "busca") {
    let lista = [];
    try { if (texto.length >= 2) lista = await buscarCatalogo(foco.value, 25); } catch {}
    return i.respond(lista.map((p) => ({ name: curto(`${p.codigo} · ${p.nome} · ${p.marca}`, 100), value: curto(p.codigo || p.nome, 100) }))).catch(() => {});
  }
  if (foco.name === "quem") {
    const vistos = new Set();
    const lista = [];
    for (const g of grupos.values()) for (const m of g.membros || []) { const k = C.chaveTel(m.whatsapp) || m.nome; if (!vistos.has(k)) { vistos.add(k); lista.push({ name: curto(`${m.nome} · consórcio`, 100), value: curto(k, 100) }); } }
    for (const c of clientesCrediario()) { const k = C.chaveTel(c.whatsapp) || c.cliente; if (!vistos.has(k)) { vistos.add(k); lista.push({ name: curto(`${c.cliente} · crediário`, 100), value: curto(k, 100) }); } }
    for (const c of painelRV.clientes) { const k = C.chaveTel(c.whatsapp) || c.nome; if (!vistos.has(k)) { vistos.add(k); lista.push({ name: curto(`${c.nome} · Revendi`, 100), value: curto(k, 100) }); } }
    opcoes = lista.filter((o) => o.name.toLowerCase().includes(texto) || o.value.includes(texto.replace(/\D/g, "") || "§"));
  } else if (foco.name === "grupo") {
    opcoes = C.ordenarGrupos([...grupos.values()]).map((g) => ({ name: curto(`${g.codigo} · ${C.brl(g.valorParcela)} · ${C.ROTULO[C.situacao(g)]}`, 100), value: g.id }));
  } else {
    const g = grupoPorCodigo(i.options.getString("grupo"));
    if (foco.name === "interessado") opcoes = interessados().map((p) => ({ name: curto(`${p.nome} · ${p.tipo}`, 100), value: p.tel }));
    if (g && foco.name === "membro") opcoes = (g.membros || []).map((m) => ({ name: curto(m.nome, 100), value: m.id }));
    if (g && foco.name === "mes") {
      const m = (g.membros || []).find((x) => x.id === i.options.getString("membro"));
      const meses = C.mesesDo(g);
      const lista = i.options.getSubcommand() === "desfazer" ? meses.filter((x) => m?.pagos?.[x]) : meses.filter((x) => !m?.pagos?.[x]);
      opcoes = lista.map((x) => ({ name: C.rotuloMes(x, true), value: x }));
    }
  }
  await i.respond(opcoes.filter((o) => o.name.toLowerCase().includes(texto)).slice(0, 25)).catch(() => {});
}

function embedMembro(g, m) {
  const x = C.resumoMembro(g, m);
  const grade = C.mesesDo(g).map((ym) => `${m.pagos?.[ym] ? "✅" : x.atrasadas.includes(ym) ? "⚠️" : "▫️"} ${C.rotuloMes(ym)}`).join("  ");
  return new EmbedBuilder().setColor(x.atrasadas.length ? VERMELHO : VERDE).setTitle(`${m.nome} · ${g.codigo}`)
    .setDescription(`${grade}\n\n**${x.pagas} de ${x.total}** pagas` + (x.atrasadas.length ? ` · ⚠️ ${x.atrasadas.length} atrasada(s): ${C.brl(x.atrasadas.length * g.valorParcela)}` : "") +
      `\nPrêmio: ${C.brl(g.premio)}` + (m.resgatadoEm ? ` · 🎁 resgatou em ${C.dataBR(m.resgatadoEm)}` : "") + (m.whatsapp ? `\nWhatsApp: ${C.fone(m.whatsapp)}` : ""));
}

async function comando(i) {
  const nome = i.commandName;
  if (nome === "ajuda") {
    return i.reply({ ...EFEMERA, content: [
      "**Bot da Karen** 💝 — tudo o que ele faz vem do painel (italoinfotec.com.br/sistema.html) e volta para ele.",
      "• **#grupos**: um tópico por grupo, atualizado sozinho. Menu para dar baixa na parcela.",
      "• **#cobrancas**: no dia seguinte ao vencimento, quem falta pagar, com cobrança pronta no WhatsApp.",
      "• **#renovacoes / #banco-de-reserva**: respostas dos formulários do site na hora.",
      "• **#pedidos-da-loja / #sacola-misteriosa / #roleta**: o que chega pela loja do site.",
      "• **#comprovantes**: cole o print do Pix e escolha de quem é — o bot dá baixa e prepara o recibo.",
      "• **#resumo-do-dia**: todo dia às 8h; no dia 1, o relatório do mês anterior.",
      "• Lembrete 2 dias antes do vencimento, aviso de fim de grupo, lançamento do resgate no Revendi e backup aos domingos.",
      "• **🛍️ REVENDI**: #vendas (cada venda nova), #crediario (9h), #entregas e #estoque (painéis que se atualizam), #aniversarios (8h), #clientes-sumidas (segunda), #desempenho (segunda e dia 1).",
      "Catálogo: `/produto <código ou nome>` (foto, preço sugerido e estoque). Revendi: `/revendi vendas`, `/revendi entregas`, `/revendi estoque`, `/revendi aniversarios`, `/revendi sumidas`, `/revendi sincronizar`, `/cliente`.",
      "Comandos: `/consorcio resumo`, `/consorcio atrasados`, `/consorcio pagou`, `/consorcio desfazer`, `/consorcio membro`, `/consorcio novo-grupo`, `/consorcio adicionar`, `/consorcio links`, `/consorcio atualizar`, `/loja pedidos`.",
    ].join("\n") });
  }
  if (nome === "minhas-parcelas") {
    const tel = C.soNumeros(estado.vinculos?.[i.user.id]);
    if (!tel) return i.reply({ ...EFEMERA, content: "Seu Discord ainda não está ligado ao seu WhatsApp. Peça para a Karen fazer isso. 💝" });
    const meus = [...grupos.values()].flatMap((g) => (g.membros || []).filter((m) => C.soNumeros(m.whatsapp).endsWith(tel.slice(-11))).map((m) => ({ g, m })));
    if (!meus.length) return i.reply({ ...EFEMERA, content: "Não encontrei consórcio no seu número. Fale com a Karen. 💝" });
    return i.reply({ ...EFEMERA, embeds: meus.slice(0, 10).map(({ g, m }) => embedMembro(g, m)) });
  }
  if (!ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Esse comando é só para a equipe da Karen." });

  if (nome === "servidor") {
    const sub = i.options.getSubcommand();
    if (sub === "montar") {
      const linha = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("srv:montar").setLabel("Sim, apagar tudo e montar").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("srv:cancelar").setLabel("Cancelar").setStyle(ButtonStyle.Secondary));
      return i.reply({ ...EFEMERA, content: "⚠️ Isso **apaga todos os canais e cargos** deste servidor e cria a estrutura da Karen. Não dá para desfazer. Continuar?", components: [linha] });
    }
    if (sub === "clientes") {
      const abrir = i.options.getString("acao") === "abrir";
      await i.deferReply(EFEMERA);
      await alternarAreaClientes(guild, estado, abrir);
      estado.clientesAbertos = abrir; salvar();
      return i.editReply(abrir ? "🌸 Área das Clientes visível para quem tiver o cargo Cliente ou Consorciada." : "🔒 Área das Clientes escondida.");
    }
    if (sub === "acesso") {
      const ch = guild.channels.cache.get(i.options.getChannel("canal").id);
      const para = i.options.getString("para");
      if (!ch || ch.isThread?.()) return i.reply({ ...EFEMERA, content: "Escolha um canal, call ou categoria." });
      if (Object.values(estado.canais || {}).includes(ch.id)) return i.reply({ ...EFEMERA, content: "Esse canal é do bot e já tem o acesso certo. Use isso para canais e calls criados à mão." });
      const cargos = Object.fromEntries(Object.entries(estado.cargos || {}).map(([k, id]) => [k, guild.roles.cache.get(id)]));
      const voz = ch.isVoiceBased?.();
      const acesso = para === "clientes" ? (voz ? "voz" : "conversa") : para === "consorciadas" ? "consorciadas" : "publico";
      const perms = permissoes(guild, para === "equipe" ? "equipe" : "clientes", cargos, true, { acesso });
      if (para === "publico" && voz) perms[0] = { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] };
      if (para === "consorciadas" && voz) perms[perms.length - 1] = { id: cargos.consorciada.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream, PermissionFlagsBits.UseVAD] };
      await ch.permissionOverwrites.set(perms);
      estado.acessos = { ...(estado.acessos || {}), [ch.id]: para }; salvar();
      const rot = { equipe: "🔒 só a equipe", clientes: "🌸 clientes e consorciadas", consorciadas: "💳 só consorciadas", publico: "🌍 qualquer pessoa" }[para];
      await gravarMapa().catch(() => {});
      return i.reply({ ...EFEMERA, content: `${voz ? "🔊" : "#"} **${ch.name}** agora: ${rot}.` + (para !== "equipe" && !estado.clientesAbertos ? "\n⚠️ A área das clientes está fechada: use `/servidor clientes abrir` quando quiser receber clientes." : "") });
    }
    if (sub === "mapa") {
      await i.deferReply(EFEMERA);
      const mapa = await gravarMapa();
      const ic = (q) => q.startsWith("todos") ? "🌍" : q.startsWith("clientes") ? "🌸" : q.startsWith("só consorciadas") ? "💳" : "🔒";
      const embeds = mapa.slice(0, 10).map((b) => new EmbedBuilder().setColor(COR).setTitle(curto(b.categoria, 250))
        .setDescription(curto(b.canais.map((c) => `${ic(c.quemVe)} ${c.tipo === "call" ? "🔊" : "#"} ${c.nome} · ${c.quemVe}${c.doBot ? "" : " · *criado à mão*"}`).join("\n") || "(vazia)", 4000)));
      embeds[0]?.setFooter({ text: "🌍 qualquer pessoa · 🌸 clientes · 💳 consorciadas · 🔒 só equipe (Karen/Admin)" });
      return i.editReply({ embeds });
    }
    if (sub === "vincular") {
      const u = i.options.getUser("pessoa");
      const tel = C.soNumeros(i.options.getString("whatsapp"));
      if (tel.length < 10) return i.reply({ ...EFEMERA, content: "WhatsApp inválido." });
      const rv = S.acharNoRevendi(painelRV.clientes, tel, "");
      await i.deferReply(EFEMERA);
      const r = await aprovarSet(u.id, rv?.nome || estado.sets?.[u.id]?.nome || u.username, tel, i.user.username);
      return i.editReply(`Ligado: ${u} ↔ ${C.fone(tel)} → **${r?.nick || "-"}**` + (rv ? ` (Revendi: ${rv.nome})` : " (não está no Revendi)") + (r?.cods?.length ? ` · grupos ${r.cods.join(", ")}` : "") + ". Pode usar /minhas-parcelas.");
    }
  }

  if (nome === "cliente") {
    const q = String(i.options.getString("quem") || "").trim();
    const tel = C.chaveTel(q);
    const bate = (nomeX, w) => (tel.length >= 8 && C.chaveTel(w) === tel) || String(nomeX || "").toLowerCase() === q.toLowerCase();
    const consorcios = [...grupos.values()].flatMap((g) => (g.membros || []).filter((m) => bate(m.nome, m.whatsapp)).map((m) => ({ g, m })));
    const cred = clientesCrediario().find((c) => bate(c.cliente, c.whatsapp));
    const rvCli = painelRV.clientes.find((c) => bate(c.nome, c.whatsapp));
    const rvHist = PR.historicoClientes(painelRV.vendas).find((h) => bate(h.cliente, h.whatsapp));
    if (!consorcios.length && !cred && !rvCli && !rvHist) return i.reply({ ...EFEMERA, content: "Não encontrei essa cliente no consórcio, no crediário nem no Revendi." });
    const embeds = [];
    if (rvCli || rvHist) {
      const nomeC = rvCli?.nome || rvHist.cliente;
      const ultimas = painelRV.vendas.filter((v) => bate(v.cliente, v.whatsapp)).slice(0, 5);
      const e = new EmbedBuilder().setColor(ROSA_RV).setTitle(`🛍️ ${nomeC} · Revendi`).setDescription([
        rvHist ? `**${rvHist.compras}** compra(s) no último ano · **${C.brl(rvHist.total)}** · última em ${C.dataBR(rvHist.ultima)} (${PR.diasEntre(rvHist.ultima, CR.hojeISO())} dias)` : "Sem compras no último ano.",
        rvHist?.marcaFavorita ? `💖 Marca favorita: ${rvHist.marcaFavorita}` : "",
        rvCli?.aniversario ? `🎂 Aniversário: ${rvCli.aniversario.slice(3)}/${rvCli.aniversario.slice(0, 2)}` : "",
        rvCli?.etiquetas?.length ? `🏷️ ${rvCli.etiquetas.join(" · ")}` : "",
        (rvCli?.whatsapp || rvHist?.whatsapp) ? `📱 ${C.fone(rvCli?.whatsapp || rvHist?.whatsapp)}` : "",
      ].filter(Boolean).join("\n"));
      if (ultimas.length) e.addFields({ name: "Últimas compras", value: curto(ultimas.map((v) => `• ${C.dataBR(v.data)} · ${C.brl(v.valor)} · ${PR.ROTULO_PAG[PR.situacaoPagamento(v)]}` +
        (v.itens?.length ? ` · ${curto(v.itens.map((it) => it.nome).join(", "), 90)}` : "")).join("\n"), 1024) });
      embeds.push(e);
    }
    embeds.push(...consorcios.slice(0, 7).map(({ g, m }) => embedMembro(g, m)));
    if (cred) embeds.push(new EmbedBuilder().setColor(cred.atrasadas.length ? VERMELHO : ROXO).setTitle(`💳 ${cred.cliente} · crediário (Revendi)`)
      .setDescription(cred.abertas.length ? curto(cred.abertas.map((p) => `${CR.atrasada(p) ? "⚠️" : CR.venceHoje(p) ? "📅" : "▫️"} ${C.dataBR(p.vencimento)} · ${p.numero}/${p.total} · ${C.brl(p.valor)}${p.venda ? " · venda " + p.venda : ""}`).join("\n"), 4000) + `\n\n**Em aberto:** ${C.brl(cred.devendo)}` + (cred.emAtraso ? ` · **em atraso:** ${C.brl(cred.emAtraso)}` : "")
        : "Nada em aberto no crediário. 🎉"));
    const zap = (cred?.whatsapp || consorcios[0]?.m.whatsapp || rvCli?.whatsapp);
    const comp = cred?.abertas.length && zap ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`crdc:${curto(C.chaveTel(zap), 60)}`).setLabel("Cobrar crediário").setEmoji("📲").setStyle(ButtonStyle.Primary))] : [];
    return i.reply({ ...EFEMERA, embeds: embeds.slice(0, 10), components: comp });
  }
  if (nome === "produto") {
    await i.deferReply(EFEMERA);
    let lista;
    try { lista = await buscarCatalogo(i.options.getString("busca"), 5); }
    catch (e) { return i.editReply("⚠️ Não consegui consultar o catálogo: " + e.message); }
    if (!lista.length) return i.editReply("Nada encontrado no catálogo de O Boticário, Eudora, Quem Disse Berenice e O.U.i.");
    const embeds = lista.slice(0, lista[0].codigo === C.soNumeros(i.options.getString("busca")) ? 1 : 5).map((p, n) => {
      const est = painelRV.produtos.find((x) => (p.codigo && x.codigo === p.codigo) || x.nome.toLowerCase() === p.nome.toLowerCase());
      const e = new EmbedBuilder().setColor(ROSA_RV).setTitle(curto(p.nome, 250))
        .addFields({ name: "Código", value: p.codigo || "—", inline: true }, { name: "Marca", value: p.marca || "—", inline: true },
          { name: "Preço sugerido", value: p.preco ? C.brl(p.preco) : "—", inline: true },
          { name: "No estoque da Karen", value: est ? (est.unidades > 0 ? `✅ ${est.unidades} un · ${C.brl(est.preco)}` + (est.validade ? ` · validade ${C.dataBR(est.validade)}` : "") : "❌ esgotado") : "Não cadastrado" });
      if (p.descricao && n === 0) e.setDescription(curto(p.descricao, 600));
      if (/^https:\/\//.test(p.foto)) n === 0 ? e.setImage(p.foto) : e.setThumbnail(p.fotoPequena);
      return e;
    });
    return i.editReply({ embeds });
  }
  if (nome === "revendi") {
    const sub = i.options.getSubcommand();
    if (sub === "meta") {
      const v = Math.round(i.options.getNumber("valor") * 100) / 100, ym = C.mesAtual();
      estado.metas = { ...(estado.metas || {}), [ym]: v }; salvar();
      await painelHoje().catch(() => {});
      return i.reply({ ...EFEMERA, content: v ? `🎯 Meta de ${C.rotuloMes(ym, true)}: **${C.brl(v)}**. Acompanhe em <#${estado.canais?.hoje}>.` : "Meta do mês removida." });
    }
    if (sub === "sincronizar") {
      if (!revendiAtivo()) return i.reply({ ...EFEMERA, content: "Este PC não tem o login do Revendi (REVENDI_EMAIL/SENHA no .env). Se o outro PC tiver, ele lê sozinho a cada 30 min." });
      await i.deferReply(EFEMERA);
      forcarSincronizacao(); await ciclo();
      const st = estadoRevendi();
      return i.editReply(st.ultimoErro ? `⚠️ ${st.ultimoErro}` : `✅ Revendi lido agora: ${painelRV.vendas.length} vendas, ${painelRV.clientes.length} clientes, ${painelRV.produtos.length} produtos, ${crediario.length} parcelas.`);
    }
    if (!temPainel()) return i.reply({ ...EFEMERA, content: "Ainda não li o Revendi. Confira REVENDI_ATIVO no .env do PC e use /revendi sincronizar." });
    const hoje = CR.hojeISO();
    if (sub === "vendas") {
      const p = i.options.getString("periodo");
      const ini = p === "mes" ? hoje.slice(0, 8) + "01" : PR.somarDias(hoje, -Math.max(0, Number(p) - 1));
      await i.deferReply(EFEMERA);
      const dias = PR.diasEntre(ini, hoje) + 1;
      const rel = await relatorioDesempenho(`🛍️ Vendas ${p === "0" ? "de hoje" : p === "mes" ? "do mês" : `dos últimos ${p} dias`}`, ini, hoje, PR.somarDias(ini, -dias), PR.somarDias(ini, -1));
      const e = rel.embeds[0];
      const lista = painelRV.vendas.filter((v) => v.data >= ini && v.data <= hoje).slice(0, 15);
      if (lista.length) e.addFields({ name: "Vendas", value: curto(lista.map((v) => `• ${C.dataBR(v.data).slice(0, 5)} · ${curto(v.cliente, 30)} · ${C.brl(v.valor)} · ${PR.ROTULO_PAG[PR.situacaoPagamento(v)]}`).join("\n"), 1024) });
      return i.editReply(rel);
    }
    if (sub === "entregas") { await painelEntregas(); return i.reply({ ...EFEMERA, content: `Painel atualizado em <#${estado.canais?.rvEntregas}>.` }); }
    if (sub === "estoque") { estado.rvFixos = { ...(estado.rvFixos || {}), rvEstoque: { ...(estado.rvFixos?.rvEstoque || {}), marca: "" } }; await painelEstoque(); return i.reply({ ...EFEMERA, content: `Painel atualizado em <#${estado.canais?.rvEstoque}>.` }); }
    if (sub === "aniversarios") return i.reply({ ...EFEMERA, embeds: [embedAniv30()] });
    if (sub === "sumidas") { await i.deferReply(EFEMERA); await reativacaoSemanal(); return i.editReply(`Lista enviada em <#${estado.canais?.rvReativar}>.`); }
  }
  if (nome === "loja") {
    await i.deferReply(EFEMERA);
    const leads = (await db.leadsDesde(new Date(Date.now() - 7 * 864e5).toISOString(), 300)).filter((l) => l.origem === "black-friday-pedido");
    if (!leads.length) return i.editReply("Nenhum pedido na loja nos últimos 7 dias.");
    const linhas = leads.reverse().slice(0, 25).map((l) => `• ${l.pagoEm ? "✅" : l.canceladoEm ? "❌" : "⏳"} **${curto(l.nome, 40)}** · ${l.equipamento || ""} · ${curto((C.semMarcas(l.detalhe).match(/Total no Pix ([^.]+)/) || [])[1] || "", 20)}`);
    return i.editReply({ embeds: [new EmbedBuilder().setColor(COR).setTitle("🛒 Pedidos da loja · 7 dias").setDescription(linhas.join("\n")).setFooter({ text: "✅ pago · ⏳ aguardando Pix · ❌ cancelado" })] });
  }

  // /consorcio
  const sub = i.options.getSubcommand();
  if (sub === "novo-grupo") {
    const proximo = "G" + (Math.max(0, ...[...grupos.values()].map((x) => Number(String(x.codigo).replace(/\D/g, "")) || 0)) + 1);
    const p = C.somarMes(C.mesAtual(), 1).split("-");
    const campo = (id, rotulo, valor, dica) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(rotulo).setStyle(TextInputStyle.Short).setRequired(true).setValue(valor).setPlaceholder(dica));
    const modal = new ModalBuilder().setCustomId("ng").setTitle("Novo grupo do consórcio").addComponents(
      campo("codigo", "Código do grupo", proximo, "G6"), campo("valor", "Mensalidade (R$)", "50,00", "50,00"),
      campo("parcelas", "Número de parcelas", "10", "10"), campo("inicio", "Mês de início (MM/AAAA)", `${p[1]}/${p[0]}`, "01/2027"),
      campo("vencimento", "Dia do vencimento", "10", "10"));
    return i.showModal(modal);
  }
  if (sub === "adicionar") {
    await i.deferReply(EFEMERA);
    const alvo = grupoPorCodigo(i.options.getString("grupo"));
    if (!alvo) return i.editReply("Grupo não encontrado.");
    const tel = i.options.getString("interessado");
    const p = tel ? interessados().find((x) => x.tel === tel) : null;
    const nome = String(i.options.getString("nome") || p?.nome || "").trim();
    let whats = C.soNumeros(i.options.getString("whatsapp") || p?.whatsapp || "");
    if (whats.length === 10 || whats.length === 11) whats = "55" + whats;
    if (nome.length < 2) return i.editReply("Escolha alguém da lista ou informe o nome.");
    if (whats && !/^55\d{10,11}$/.test(whats)) return i.editReply("WhatsApp inválido. Use DDD + número.");
    const g = await db.alterarConsorcio(alvo.id, (membros) => {
      if (whats && membros.some((m) => C.chaveTel(m.whatsapp) === C.chaveTel(whats))) throw new Error(`${nome} já está no ${alvo.codigo}`);
      membros.push({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome, whatsapp: whats, obs: p ? "Veio do " + (p.tipo.startsWith("reserva") ? "banco de reserva" : "formulário de renovação") : "", pagos: {}, entrouEm: C.agoraSP().data });
      return membros;
    });
    grupos.set(g.id, g);
    await publicarGrupos();
    return i.editReply(`✅ **${nome}** entrou no **${g.codigo}** (${(g.membros || []).length}${g.vagas ? "/" + g.vagas : ""} membros).`);
  }
  if (sub === "atualizar") {
    await i.deferReply(EFEMERA);
    estado.versoes = {};
    await verificarGrupos();
    return i.editReply(`🔄 Atualizei ${grupos.size} grupo(s) e as cobranças com o que está no painel agora.`);
  }
  if (sub === "links") {
    const ativos = C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) !== "formando");
    return i.reply({ ...EFEMERA, content: "**Renovação** (cada link já abre com o grupo):\n" + ativos.map((g) => `• ${g.codigo}: <${C.URL_RENOVACAO}?g=${g.codigo}>`).join("\n") + `\n\n**Banco de reserva:** <${C.URL_RESERVA}>` });
  }
  const g = i.options.getString("grupo") ? grupoPorCodigo(i.options.getString("grupo")) : null;
  if (i.options.getString("grupo") && !g) return i.reply({ ...EFEMERA, content: "Grupo não encontrado." });
  if (sub === "resumo") {
    const lista = g ? [g] : C.ordenarGrupos([...grupos.values()]).filter((x) => C.situacao(x) !== "encerrado");
    if (!lista.length) return i.reply({ ...EFEMERA, content: "Nenhum grupo cadastrado no painel." });
    return i.reply({ ...EFEMERA, embeds: lista.slice(0, 10).map(embedGrupo) });
  }
  if (sub === "atrasados") {
    const lista = (g ? [g] : [...grupos.values()]).filter((x) => C.situacao(x) === "andamento");
    const linhas = lista.flatMap((x) => C.resumoGrupo(x).comAtraso.map(({ m, r }) => `• **${x.codigo}** · ${m.nome} · ${r.atrasadas.map((ym) => C.rotuloMes(ym)).join(", ")} · ${C.brl(r.atrasadas.length * x.valorParcela)}`));
    return i.reply({ ...EFEMERA, content: linhas.length ? curto("**Parcelas atrasadas**\n" + linhas.join("\n"), 1990) : "🎉 Ninguém em atraso." });
  }
  const m = g && (g.membros || []).find((x) => x.id === i.options.getString("membro") || String(x.nome).toLowerCase() === String(i.options.getString("membro")).toLowerCase());
  if (!m) return i.reply({ ...EFEMERA, content: "Membro não encontrado nesse grupo." });
  if (sub === "membro") {
    const extra = m.whatsapp ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`m:cob:${g.id}:${m.id}`).setLabel("Cobrar").setEmoji("📲").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`m:ren:${g.id}:${m.id}`).setLabel("Renovação").setEmoji("🔁").setStyle(ButtonStyle.Secondary))] : [];
    return i.reply({ ...EFEMERA, embeds: [embedMembro(g, m)], components: extra });
  }
  if (sub === "pagou" || sub === "desfazer") {
    await i.deferReply(EFEMERA);
    const r = await darBaixa(g.id, m.id, i.options.getString("mes") || "", sub === "desfazer");
    return i.editReply(respostaBaixa(r, sub === "desfazer"));
  }
}

function respostaBaixa(r, desfazer) {
  const x = C.resumoMembro(r.g, r.m);
  const recibo = !desfazer && r.m.whatsapp ? C.linkWhats(r.m.whatsapp, C.mensagemRecibo(r.g, r.m, r.ym)) : "";
  return { content: desfazer ? `↩️ Desmarquei ${C.rotuloMes(r.ym, true)} de **${r.nome}** (${r.g.codigo}). Agora ${x.pagas}/${x.total}.`
    : `✅ Baixa: **${r.nome}** · ${r.g.codigo} · ${C.rotuloMes(r.ym, true)}. Agora ${x.pagas}/${x.total} pagas.` + (recibo ? `\n${linhaLink("📲 Mandar recibo no WhatsApp", recibo)}` : "") };
}

// ---------------------------------------------------------------- set das clientes: cargos por grupo e apelido
const ymAgora = () => C.agoraSP().ym;
/** Cargo de cada grupo em vigência (cria se faltar; apaga o dos grupos que terminaram). */
async function cargosDosGrupos() {
  estado.cargosGrupo = estado.cargosGrupo || {};
  const vigentes = new Set(C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) !== "encerrado").map((g) => String(g.codigo).toUpperCase()));
  for (const cod of vigentes) {
    if (estado.cargosGrupo[cod] && guild.roles.cache.get(estado.cargosGrupo[cod])) continue;
    const r = guild.roles.cache.find((x) => x.name === `💳 ${cod}`) ||
      await guild.roles.create({ name: `💳 ${cod}`, color: V.CORES.atencao, hoist: true, mentionable: false, reason: "Grupo do consórcio" }).catch((e) => { log(`cargo ${cod}: ${e.message}`); return null; });
    if (r) { estado.cargosGrupo[cod] = r.id; log(`cargo do grupo criado: ${r.name}`); }
  }
  for (const [cod, id] of Object.entries(estado.cargosGrupo)) {
    if (vigentes.has(cod)) continue;
    await guild.roles.cache.get(id)?.delete("Grupo do consórcio terminou").catch(() => {});
    delete estado.cargosGrupo[cod]; log(`cargo do grupo removido (terminou): ${cod}`);
  }
  salvar();
}
/** Grupos em vigência da pessoa: painel do consórcio + etiquetas do Revendi. */
function gruposDaPessoa(tel) {
  const rv = S.acharNoRevendi(painelRV.clientes, tel, "");
  const cods = new Set([...S.gruposDoTelefone([...grupos.values()], tel), ...S.gruposDasEtiquetas(rv?.etiquetas, ymAgora())]);
  return [...cods].filter((c) => estado.cargosGrupo?.[c]).sort((a, b) => (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0));
}
/** Acerta cargos (Cliente, Consorciada, G1, G3…) e apelido "[G3] - Nome" / "[CLIENTE] - Nome" de quem tem set. */
async function aplicarSet(userId) {
  const set = estado.sets?.[userId];
  if (!set) return null;
  const membro = await guild.members.fetch(userId).catch(() => null);
  if (!membro) return null;
  const cods = gruposDaPessoa(set.tel);
  const querer = new Set([estado.cargos?.cliente, ...(cods.length ? [estado.cargos?.consorciada] : []), ...cods.map((c) => estado.cargosGrupo[c])].filter(Boolean));
  const gerenciados = new Set([estado.cargos?.consorciada, ...Object.values(estado.cargosGrupo || {})].filter(Boolean));
  const add = [...querer].filter((id) => !membro.roles.cache.has(id));
  const tirar = [...gerenciados].filter((id) => !querer.has(id) && membro.roles.cache.has(id));
  if (add.length) await membro.roles.add(add, "Set da cliente").catch((e) => log(`cargos de ${membro.user.tag}: ${e.message}`));
  if (tirar.length) await membro.roles.remove(tirar, "Grupo terminou / saiu do grupo").catch(() => {});
  const nick = S.apelido(cods, set.nome);
  if (membro.manageable && membro.nickname !== nick) await membro.setNickname(nick, "Set da cliente").catch(() => {});
  if (cods.join() !== (set.grupos || []).join()) { set.grupos = cods; salvar(); }
  return { membro, cods, nick };
}
async function revisarSets() {
  await cargosDosGrupos().catch((e) => log("cargos dos grupos: " + e.message));
  for (const [id, tel] of Object.entries(estado.vinculos || {})) {
    if (estado.sets?.[id]) continue;
    const rv = S.acharNoRevendi(painelRV.clientes, tel, "");
    if (rv || S.gruposDoTelefone([...grupos.values()], tel).length) {
      const m = await guild.members.fetch(id).catch(() => null);
      if (m) estado.sets = { ...(estado.sets || {}), [id]: { nome: rv?.nome || m.displayName.replace(/^\[[^\]]*\]\s*-\s*/, ""), tel, em: new Date().toISOString(), por: "migração" } };
    }
  }
  for (const id of Object.keys(estado.sets || {})) await aplicarSet(id).catch((e) => log("set: " + e.message));
}
/** Aprova o set (automático quando bate com o Revendi/consórcio, ou pela equipe). */
async function aprovarSet(userId, nome, tel, por) {
  estado.sets = { ...(estado.sets || {}), [userId]: { nome, tel, em: new Date().toISOString(), por } };
  estado.vinculos[userId] = tel; delete estado.pedidosSet?.[userId]; salvar();
  await cargosDosGrupos().catch(() => {});
  return aplicarSet(userId);
}

async function entradaCliente(i) {
  const nomeDigitado = String(i.fields.getTextInputValue("nome") || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const tel = C.soNumeros(i.fields.getTextInputValue("whats") || "");
  if (tel.length < 10) return i.reply({ ...EFEMERA, content: "Confira o WhatsApp com DDD (ex.: 33 99999-9999) e toque em 🌸 Entrar de novo." });
  await i.deferReply(EFEMERA);
  const rv = S.acharNoRevendi(painelRV.clientes, tel, nomeDigitado);
  const cods = S.gruposDoTelefone([...grupos.values()], tel);
  if (rv || cods.length) {
    const nome = rv?.nome || nomeDigitado;
    const r = await aprovarSet(i.user.id, nome, tel, "automático");
    await enviar("alertas", { embeds: [new EmbedBuilder().setColor(VERDE).setTitle("🌸 Set aprovado automaticamente")
      .setDescription(`<@${i.user.id}> → **${r?.nick || nome}**\n📱 ${C.fone(tel)}` + (rv ? `\n🛍️ Revendi: ${rv.nome}` : "\n🛍️ Não está no Revendi (achei pelo consórcio)") + (r?.cods?.length ? `\n💳 Grupos: ${r.cods.join(", ")}` : ""))] });
    return i.editReply(`Prontinho, ${C.primeiroNome(nome)}! 💝 Seu set foi aprovado: **${r?.nick || nome}**.\nAgora você vê a 🌸 Área das Clientes. Para falar com a Karen por voz, entre na call **Aguardando** e espere: alguém da equipe te chama.` +
      (r?.cods?.length ? `\nVocê está no consórcio (${r.cods.join(", ")}). Use **/minhas-parcelas** para ver sua situação (só você vê).` : ""));
  }
  estado.pedidosSet = { ...(estado.pedidosSet || {}), [i.user.id]: { nome: nomeDigitado, tel, em: new Date().toISOString() } }; salvar();
  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`set:ok:${i.user.id}`).setLabel("Aprovar como cliente").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`set:tel:${i.user.id}`).setLabel("Corrigir WhatsApp e aprovar").setEmoji("📱").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`set:nao:${i.user.id}`).setLabel("Recusar").setStyle(ButtonStyle.Danger));
  const mencoes = [estado.cargos?.dona, estado.cargos?.admin].filter(Boolean);
  await enviar("alertas", { content: mencoes.map((id) => `<@&${id}>`).join(" "), allowedMentions: { roles: mencoes },
    embeds: [new EmbedBuilder().setColor(AMARELO).setTitle("🌸 Pedido de set para conferir")
      .setDescription(`<@${i.user.id}> diz ser **${nomeDigitado}** · 📱 ${C.fone(tel)}\n❓ Não achei esse WhatsApp no Revendi nem no consórcio.`)
      .setFooter({ text: "Se for cliente com outro número, use Corrigir WhatsApp" })], components: [botoes] });
  return i.editReply(`Recebemos seu pedido, ${C.primeiroNome(nomeDigitado)}! 💝 Não achei esse WhatsApp no cadastro da Karen, então a equipe vai conferir e liberar seu acesso em breve.`);
}

async function modalEnviado(i) {
  if (i.customId === "cli:entrar") return entradaCliente(i);
  if (i.customId.startsWith("tk:abrir:")) { await i.deferReply(EFEMERA); return abrirTicket(i, i.customId.split(":")[2], String(i.fields.getTextInputValue("texto") || "").trim()); }
  if (i.customId.startsWith("set:tel:")) {
    if (!ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só a equipe pode aprovar." });
    const userId = i.customId.split(":")[2], tel = C.soNumeros(i.fields.getTextInputValue("whats"));
    if (tel.length < 10) return i.reply({ ...EFEMERA, content: "WhatsApp inválido." });
    const rv = S.acharNoRevendi(painelRV.clientes, tel, "");
    const nome = String(i.fields.getTextInputValue("nome") || "").trim() || rv?.nome || estado.pedidosSet?.[userId]?.nome || "Cliente";
    const r = await aprovarSet(userId, rv?.nome && !String(i.fields.getTextInputValue("nome") || "").trim() ? rv.nome : nome, tel, i.user.username);
    if (i.message) await i.message.edit({ content: "", embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(VERDE).setFooter({ text: `✅ Aprovado por ${i.user.username}: ${r?.nick || nome}` })], components: [] }).catch(() => {});
    return i.reply({ ...EFEMERA, content: `✅ Set aprovado: **${r?.nick || nome}**` + (rv ? ` (Revendi: ${rv.nome})` : " (não está no Revendi)") + (r?.cods?.length ? ` · grupos ${r.cods.join(", ")}` : "") });
  }
  if (!ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só a equipe da Karen pode criar grupos." });
  if (i.customId !== "ng") return;
  const v = (id) => String(i.fields.getTextInputValue(id) || "").trim();
  const codigo = v("codigo").toUpperCase().replace(/\s+/g, "");
  const valor = Number(v("valor").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  const parcelas = Number(v("parcelas"));
  const [mm, aaaa] = v("inicio").split(/[\/\-]/).map((x) => x.trim());
  const inicio = aaaa && mm ? `${aaaa.length === 2 ? "20" + aaaa : aaaa}-${String(mm).padStart(2, "0")}` : "";
  const vencimento = Math.min(28, Math.max(1, Number(v("vencimento")) || 10));
  if (!/^[A-Z0-9-]{1,10}$/.test(codigo)) return i.reply({ ...EFEMERA, content: "Código inválido (use algo como G6)." });
  if (!(valor > 0) || !(parcelas > 0 && parcelas <= 36) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(inicio)) return i.reply({ ...EFEMERA, content: "Confira a mensalidade, as parcelas (1 a 36) e o início (MM/AAAA)." });
  if ([...grupos.values()].some((g) => String(g.codigo).toUpperCase() === codigo)) return i.reply({ ...EFEMERA, content: `Já existe um grupo ${codigo}.` });
  await i.deferReply(EFEMERA);
  const agora = new Date().toISOString();
  const g = await db.criar("consorcios", { codigo, valorParcela: valor, parcelas, inicio, vencimento, vagas: 0, premio: Math.round(valor * parcelas * 100) / 100, obs: "", membros: [], criadoEm: agora, criadoPor: "bot-discord" });
  grupos.set(g.id, g);
  await publicarGrupos();
  await i.editReply(`✅ Grupo **${codigo}** criado: ${C.brl(valor)} × ${parcelas}, de ${C.rotuloMes(inicio, true)} a ${C.rotuloMes(C.fimDo(g), true)}, prêmio ${C.brl(g.premio)}.\nAgora use \`/consorcio adicionar\` para colocar as pessoas (o banco de reserva e quem disse "sim" aparecem na lista). Vagas e observações dá para ajustar no painel.`);
  await atualizarTopico(g).catch(() => {});
}

async function componente(i) {
  const [tipo, acao, a, b] = i.customId.split(":");
  if (tipo === "srv") {
    if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator)) return i.reply({ ...EFEMERA, content: "Só o dono do servidor pode montar." });
    if (acao === "cancelar") return i.update({ content: "Cancelado. Nada foi apagado.", components: [] });
    await i.update({ content: "⏳ Montando o servidor… isso leva um ou dois minutos.", components: [] });
    const r = await montarServidor(guild, log);
    estado.canais = r.canais; estado.cargos = r.cargos; estado.threads = {}; estado.versoes = {}; estado.clientesAbertos = false; salvar();
    try { const membro = await guild.members.fetch(i.user.id); await membro.roles.add(r.cargos.admin); } catch {}
    await enviar("comandos", { embeds: [new EmbedBuilder().setColor(COR).setTitle("💝 Servidor da Karen pronto").setDescription(
      "• Dê o cargo **👑 Karen** para a Karen (Configurações do servidor › Membros).\n• Os grupos aparecem em **#grupos** em até 2 minutos.\n• Respostas do site, pedidos da loja e cobranças chegam sozinhos.\n• `/ajuda` mostra os comandos." +
      (r.preservados.length ? `\n\nMantive em 🔒 SISTEMA: ${r.preservados.join(", ")}` : ""))] });
    estado.versoes = {}; await ciclo();
    return;
  }
  if (tipo === "tk" && acao === "abrir") {
    return i.showModal(new ModalBuilder().setCustomId(`tk:abrir:${a}`).setTitle(`${TIPOS_TICKET[a]?.emoji || "🎫"} ${TIPOS_TICKET[a]?.nome || "Ticket"}`).addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("texto").setLabel("Conte rapidinho o que você precisa").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000))));
  }
  if (tipo === "tk" && acao === "fechar") {
    const t = estado.tickets?.[a];
    if (!t) return i.reply({ ...EFEMERA, content: "Esse ticket já foi fechado." });
    const m = await guild.members.fetch(i.user.id).catch(() => null);
    if (t.user !== i.user.id && !ehDaEquipe(m) && !ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só quem abriu ou a equipe pode fechar." });
    if (b !== "sim") return i.reply({ ...EFEMERA, content: "Fechar o ticket? A conversa fica guardada no histórico da equipe.",
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`tk:fechar:${a}:sim`).setLabel("Sim, fechar").setStyle(ButtonStyle.Danger))] });
    await i.update({ content: "🔒 Fechando o ticket em 5 segundos…", components: [] });
    await guild.channels.cache.get(a)?.send("🔒 Ticket fechado. Obrigada pelo contato! 💝").catch(() => {});
    setTimeout(() => fecharTicket(a, m?.displayName || i.user.username).catch((e) => log("fechar ticket: " + e.message)), 5000);
    return;
  }
  if (tipo === "tk" && acao === "assumir") {
    const m = await guild.members.fetch(i.user.id).catch(() => null);
    if (!ehDaEquipe(m) && !ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só a equipe pode assumir." });
    const t = estado.tickets?.[a];
    if (!t) return i.reply({ ...EFEMERA, content: "Esse ticket já foi fechado." });
    t.assumido = m?.displayName || i.user.username; salvar();
    await i.reply({ content: `✋ **${t.assumido}** assumiu este ticket e vai te atender, <@${t.user}>! 💝` });
    return;
  }
  if (tipo === "cli" && acao === "entrar") {
    const modal = new ModalBuilder().setCustomId("cli:entrar").setTitle("Pedir set · Karen Cosméticos 🌸").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Seu nome completo").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("whats").setLabel("Seu WhatsApp com DDD (o mesmo da Karen)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder("(33) 99999-9999")));
    return i.showModal(modal);
  }
  if (tipo === "atd" && !ehEquipe(i)) {
    const m = await guild.members.fetch(i.user.id).catch(() => null);
    if (!ehDaEquipe(m)) return i.reply({ ...EFEMERA, content: "Só a equipe da Karen pode puxar clientes." });
  } else if (!ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só a equipe da Karen pode usar isso." });

  if (tipo === "crd" || tipo === "crdc") {
    const k = tipo === "crd" ? i.values?.[0] : acao;
    const c = clientesCrediario().find((x) => C.chaveTel(x.whatsapp) === k);
    if (!c?.whatsapp) return i.reply({ ...EFEMERA, content: "Cliente sem WhatsApp no Revendi." });
    const lista = c.atrasadas.length ? c.atrasadas : c.abertas.slice(0, 1);
    return i.reply({ ...EFEMERA, content: linhaLink("📲 Abrir WhatsApp de " + c.cliente, C.linkWhats(c.whatsapp, CR.mensagemCrediario(c, lista))) });
  }
  if (tipo === "atd" && (acao === "puxar" || acao === "minha")) {
    const membro = await guild.members.fetch(a).catch(() => null);
    const eu0 = await guild.members.fetch(i.user.id).catch(() => null);
    let destino = guild.channels.cache.get(estado.canais?.[b]);
    if (acao === "minha") {
      if (!ehCallAtend(eu0?.voice?.channelId)) return i.reply({ ...EFEMERA, content: "Entre primeiro numa call de atendimento (01, 02 ou 03) e toque de novo. Ou use os botões com o número da call." });
      destino = eu0.voice.channel;
    }
    if (destino && destino.members?.some((m) => !ehDaEquipe(m) && m.id !== a)) return i.reply({ ...EFEMERA, content: `**${destino.name}** já tem uma cliente em atendimento. Escolha outra call.` });
    if (!membro?.voice?.channelId) { await fecharAviso(a, "Saiu da espera sem ser atendida"); return i.reply({ ...EFEMERA, content: "Ela já saiu da call de espera." }); }
    if (!destino) return i.reply({ ...EFEMERA, content: "Call de atendimento não encontrada." });
    await puxarCliente(membro, destino, i.user.tag);
    await fecharAviso(a, `✅ Em atendimento em ${destino.name} com ${eu0?.displayName || i.user.username}`);
    const eu = eu0;
    const euJa = eu?.voice?.channelId === destino.id;
    return i.reply({ ...EFEMERA, content: `🎧 ${membro.displayName} foi para **${destino.name}**.` + (euJa ? "" : eu?.voice?.channelId ? " Entre lá também." : ` Entre em <#${destino.id}> para atender.`) });
  }
  if (tipo === "set") {
    const p = estado.pedidosSet?.[a];
    if (acao === "tel") {
      return i.showModal(new ModalBuilder().setCustomId(`set:tel:${a}`).setTitle("Aprovar set com outro WhatsApp").addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("whats").setLabel("WhatsApp cadastrado no Revendi/consórcio").setStyle(TextInputStyle.Short).setRequired(true).setValue(p?.tel || "")),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("nome").setLabel("Nome (vazio = nome do Revendi)").setStyle(TextInputStyle.Short).setRequired(false).setValue(p?.nome || ""))));
    }
    if (!p) return i.update({ components: [] });
    if (acao === "nao") {
      delete estado.pedidosSet[a]; salvar();
      return i.update({ embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(V.CORES.neutro).setFooter({ text: `Recusado por ${i.user.username}` })], components: [] });
    }
    const r = await aprovarSet(a, p.nome, p.tel, i.user.username);
    return i.update({ content: "", embeds: [EmbedBuilder.from(i.message.embeds[0]).setColor(VERDE).setFooter({ text: `✅ Aprovado por ${i.user.username}: ${r?.nick || p.nome}` })], components: [] });
  }
  if (tipo === "cen") {
    const precisaRV = ["hoje", "semana", "mes", "estoque", "entregas", "aniv", "sumidas"].includes(acao);
    if (precisaRV && !temPainel()) return i.reply({ ...EFEMERA, content: "Ainda não li o Revendi. Toque em 🔄 Atualizar Revendi." });
    const hoje = CR.hojeISO();
    if (["hoje", "semana", "mes"].includes(acao)) {
      await i.deferReply(EFEMERA);
      const ini = acao === "hoje" ? hoje : acao === "semana" ? PR.somarDias(hoje, -6) : hoje.slice(0, 8) + "01";
      const dias = PR.diasEntre(ini, hoje) + 1;
      const rel = await relatorioDesempenho(acao === "hoje" ? "🛍️ Vendas de hoje" : acao === "semana" ? "📈 Últimos 7 dias" : "📊 Este mês", ini, hoje, PR.somarDias(ini, -dias), PR.somarDias(ini, -1));
      const lista = painelRV.vendas.filter((v) => v.data >= ini && v.data <= hoje).slice(0, 15);
      if (lista.length) rel.embeds[0].addFields({ name: "Vendas", value: curto(lista.map((v) => `• ${C.dataBR(v.data).slice(0, 5)} · ${curto(v.cliente, 30)} · ${C.brl(v.valor)} · ${PR.ROTULO_PAG[PR.situacaoPagamento(v)]}`).join("\n"), 1024) });
      return i.editReply(rel);
    }
    if (acao === "estoque") return i.reply({ ...EFEMERA, ...conteudoEstoque() });
    if (acao === "entregas") return i.reply({ ...EFEMERA, ...conteudoEntregas() });
    if (acao === "aniv") return i.reply({ ...EFEMERA, embeds: [embedAniv30()] });
    if (acao === "crediario") return i.reply({ ...EFEMERA, embeds: [embedCrediario()] });
    if (acao === "sumidas") {
      const l = PR.paraReativar(painelRV.vendas, hoje, 60).slice(0, 25);
      return i.reply({ ...EFEMERA, embeds: [new EmbedBuilder().setColor(COR).setTitle(`💌 ${l.length} clientes sem comprar há 60+ dias`)
        .setDescription(l.length ? curto(l.map((h) => `• **${curto(h.cliente, 40)}** · ${h.semComprar} dias · ${C.brl(h.total)}`).join("\n"), 4000) : "Ninguém. 🎉")],
        components: menuZap("rvw:re", "📲 Chamar no WhatsApp…", l.map((h) => ({ label: curto(h.cliente, 100), value: curto(h.chave, 100), description: curto(`${h.semComprar} dias · ${C.brl(h.total)}`, 100) }))) });
    }
    if (acao === "grupos" || acao === "atrasados") {
      const ativos = C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) !== "encerrado");
      if (!ativos.length) return i.reply({ ...EFEMERA, content: "Nenhum grupo ativo no painel." });
      if (acao === "grupos") return i.reply({ ...EFEMERA, embeds: ativos.slice(0, 10).map((g) => embedGrupo(g)) });
      const linhas = ativos.flatMap((g) => (g.membros || []).map((m) => ({ g, m, x: C.resumoMembro(g, m) })).filter(({ x }) => x.atrasadas.length)
        .map(({ g, m, x }) => `• **${curto(m.nome, 40)}** · ${g.codigo} · ${x.atrasadas.length} parcela(s) · ${C.brl(x.atrasadas.length * g.valorParcela)}`));
      return i.reply({ ...EFEMERA, embeds: [new EmbedBuilder().setColor(linhas.length ? VERMELHO : VERDE).setTitle("⚠️ Consórcio em atraso").setDescription(linhas.length ? curto(linhas.join("\n"), 4000) : "Ninguém em atraso. 🎉")] });
    }
    if (acao === "sync") {
      if (!revendiAtivo()) return i.reply({ ...EFEMERA, content: "Este PC não tem o login do Revendi. O outro PC lê sozinho a cada 30 min." });
      await i.deferReply(EFEMERA);
      forcarSincronizacao(); await ciclo();
      const st = estadoRevendi();
      return i.editReply(st.ultimoErro ? `⚠️ ${st.ultimoErro}` : `✅ Revendi lido agora: ${painelRV.vendas.length} vendas, ${painelRV.clientes.length} clientes, ${painelRV.produtos.length} produtos.`);
    }
  }
  if (tipo === "rvw") {
    const id = acao === "ag" ? a : i.values?.[0];
    let alvo = null, texto = "";
    if (acao === "ag" || acao === "en") { const v = painelRV.vendas.find((x) => x.id === id); if (v) { alvo = { nome: v.cliente, whatsapp: v.whatsapp }; texto = acao === "ag" ? PR.msgAgradecer(v) : PR.msgEntrega(v); } }
    if (acao === "an") { const c = painelRV.clientes.find((x) => x.id === id); if (c) { alvo = c; texto = PR.msgAniversario(c); } }
    if (acao === "re") { const h = PR.paraReativar(painelRV.vendas, CR.hojeISO(), 60).find((x) => x.chave === id); if (h) { alvo = { nome: h.cliente, whatsapp: h.whatsapp }; texto = PR.msgReativar(h); } }
    if (!alvo?.whatsapp) return i.reply({ ...EFEMERA, content: "Cliente sem WhatsApp no Revendi (ou o registro mudou)." });
    return i.reply({ ...EFEMERA, content: linhaLink("📲 Abrir WhatsApp de " + alvo.nome, C.linkWhats(alvo.whatsapp, texto)) });
  }
  if (tipo === "rev") {
    const e = EmbedBuilder.from(i.message.embeds[0]).setFooter({ text: `✅ Lançado no Revendi por ${i.user.username} · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` });
    return i.update({ embeds: [e], components: [] });
  }
  if (tipo === "lem" || tipo === "ren") {
    const g = grupos.get(acao); const m = g?.membros?.find((x) => x.id === i.values?.[0]);
    if (!m?.whatsapp) return i.reply({ ...EFEMERA, content: "Esse membro está sem WhatsApp no painel." });
    const texto = tipo === "lem" ? C.mensagemLembrete(g, m, C.mesAtual()) : C.mensagemRenovacao(g, m);
    return i.reply({ ...EFEMERA, content: linhaLink("📲 Abrir WhatsApp de " + m.nome, C.linkWhats(m.whatsapp, texto)) });
  }
  if (tipo === "comp") {
    if (acao === "g") {
      const g = grupos.get(i.values?.[0]);
      if (!g) return i.update({ content: "Grupo não encontrado.", components: [] });
      const lista = (g.membros || []).map((m) => ({ m, x: C.resumoMembro(g, m) })).filter(({ x }) => x.abertas.length)
        .sort((a2, b2) => b2.x.atrasadas.length - a2.x.atrasadas.length || String(a2.m.nome).localeCompare(String(b2.m.nome), "pt-BR"))
        .map(({ m, x }) => ({ m, descricao: `Vai dar baixa em ${C.rotuloMes(x.atrasadas[0] || x.abertas[0], true)}` }));
      const menu = menuMembros(`comp:m:${a}`, g, lista, `De quem é? (${g.codigo})`);
      return i.update({ content: menu ? `Grupo **${g.codigo}**. De quem é o comprovante?` : `Ninguém do ${g.codigo} tem parcela em aberto.`, components: menu ? [menu] : [] });
    }
    if (acao === "m") {
      // customId: comp:m:<mensagem>:<grupo>
      const [, , msgId, grupoId] = i.customId.split(":");
      await i.deferUpdate();
      const r = await darBaixa(grupoId, i.values?.[0], "");
      const resp = respostaBaixa(r, false);
      await i.editReply({ content: resp.content, components: [] });
      const c = await canal("comprovantes");
      const original = c && await c.messages.fetch(msgId).catch(() => null);
      await original?.react("✅").catch(() => {});
      await atualizarTopico(r.g).catch(() => {});
      return;
    }
  }
  if (tipo === "g" && acao === "atualizar") {
    await i.deferUpdate();
    const g = await db.obter("consorcios", a);
    if (g) { grupos.set(g.id, g); await atualizarTopico(g); estado.versoes[g.id] = g._atualizado; salvar(); }
    return;
  }
  if (tipo === "baixa" || tipo === "cob") {
    const grupoId = acao, membroId = i.values?.[0];
    if (tipo === "cob") {
      const g = grupos.get(grupoId); const m = g?.membros?.find((x) => x.id === membroId);
      if (!m?.whatsapp) return i.reply({ ...EFEMERA, content: "Esse membro está sem WhatsApp no painel." });
      return i.reply({ ...EFEMERA, content: `${linhaLink("📲 Abrir WhatsApp de " + m.nome, C.linkWhats(m.whatsapp, C.mensagemCobranca(g, m, C.resumoMembro(g, m).atrasadas)))}` });
    }
    await i.deferReply(EFEMERA);
    const r = await darBaixa(grupoId, membroId, "");
    await i.editReply(respostaBaixa(r, false));
    await atualizarTopico(r.g).catch(() => {});
    return;
  }
  if (tipo === "m") {
    const g = grupos.get(a); const m = g?.membros?.find((x) => x.id === b);
    if (!m) return i.reply({ ...EFEMERA, content: "Membro não encontrado." });
    const texto = acao === "cob" ? C.mensagemCobranca(g, m, C.resumoMembro(g, m).atrasadas.length ? C.resumoMembro(g, m).atrasadas : [C.resumoMembro(g, m).abertas[0]].filter(Boolean)) : C.mensagemRenovacao(g, m);
    return i.reply({ ...EFEMERA, content: linhaLink("📲 Abrir WhatsApp de " + m.nome, C.linkWhats(m.whatsapp, texto)) });
  }
  if (tipo === "lead") {
    const l = await db.obter("leads", a);
    if (!l) return i.reply({ ...EFEMERA, content: "Esse registro não existe mais no painel." });
    if (acao === "wa") {
      const p = C.primeiroNome(l.nome);
      const renova = (String(l.detalhe).match(/\[ref:renova-(sim|talvez|nao)\]/) || [])[1];
      const texto = l.origem === "consorcio-renovacao"
        ? (renova === "sim" ? `Olá, ${p}! Aqui é a Karen 💝 Obrigada pelo seu retorno! Sua vaga no próximo grupo está garantida, com prioridade. Vou te passar os detalhes:`
          : renova === "talvez" ? `Olá, ${p}! Aqui é a Karen 💝 Obrigada pelo seu retorno! Vou te explicar com calma como vai ser o próximo grupo, sem compromisso:`
            : `Olá, ${p}! Aqui é a Karen 💝 Obrigada pelo carinho e pela sinceridade! Você continua sendo cliente querida. Quando quiser voltar, é só me chamar.`)
        : l.origem === "consorcio-reserva" ? `Olá, ${p}! Aqui é a Karen 💝 Recebi sua reserva para o consórcio, muito obrigada pela confiança! Vou te passar como vai funcionar o próximo grupo:`
          : `Olá, ${p}! Aqui é a Karen Cosméticos 💝 Recebi seu pedido pelo site. Vamos confirmar?`;
      return i.reply({ ...EFEMERA, content: linhaLink("📲 Abrir WhatsApp de " + l.nome, C.linkWhats(l.whatsapp, texto)) });
    }
    if (acao === "ok") {
      await db.atualizar("leads", l.id, { status: "Em contato", atualizadoEm: new Date().toISOString(), atualizadoPor: "bot-discord" });
      const e = EmbedBuilder.from(i.message.embeds[0]).setFooter({ text: `${i.message.embeds[0]?.footer?.text || ""} · ✅ respondida por ${i.user.username}` });
      return i.update({ embeds: [e], components: [] });
    }
  }
}

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isAutocomplete()) return await autocompletar(i);
    if (i.isChatInputCommand()) return await comando(i);
    if (i.isButton() || i.isStringSelectMenu()) return await componente(i);
    if (i.isModalSubmit()) return await modalEnviado(i);
  } catch (e) {
    log("interação: " + (e.stack || e.message));
    const msg = { content: "⚠️ " + e.message };
    try { if (i.deferred || i.replied) await i.editReply(msg); else await i.reply({ ...EFEMERA, ...msg }); } catch {}
  }
});

// #comprovantes: a cada print colado, o bot pergunta de quem é e dá baixa.
client.on(Events.MessageCreate, async (msg) => {
  const tk = estado.tickets?.[msg.channelId];
  if (tk && !msg.author?.bot) { tk.ultimo = Date.now(); tk.avisado = false; }
  if (LIMPEZA_LIGADA && !msg.author?.bot && estado.canais?.comandos && msg.channelId === estado.canais.comandos && !msg.pinned) {
    setTimeout(() => msg.delete().catch(() => {}), 60000);
    return;
  }
  try {
    if (msg.author?.bot || !estado.canais?.comprovantes || msg.channelId !== estado.canais.comprovantes) return;
    const ativos = C.ordenarGrupos([...grupos.values()]).filter((g) => C.situacao(g) === "andamento" && (g.membros || []).some((m) => C.resumoMembro(g, m).abertas.length));
    if (!ativos.length) return void msg.reply("Não há grupo com parcela em aberto.").catch(() => {});
    const menu = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`comp:g:${msg.id}`).setPlaceholder("De qual grupo é este comprovante?")
      .addOptions(ativos.slice(0, 25).map((g) => ({ label: `${g.codigo} · ${C.brl(g.valorParcela)}`, value: g.id, description: curto(`${C.resumoGrupo(g).faltamNoMes.length} faltam pagar ${C.rotuloMes(C.mesAtual())}`, 100) }))));
    await msg.reply({ content: "🧾 Comprovante recebido! De qual grupo é?", components: [menu] });
  } catch (e) { log("comprovante: " + e.message); }
});

client.once(Events.ClientReady, async () => {
  log(`conectado como ${client.user.tag}`);
  guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();
  await registrarComandos().catch((e) => log("registrar comandos: " + e.message));
  if (!estado.canais?.grupos) log("servidor ainda não montado: use /servidor montar no Discord");
  else {
    const novos = await completarCanais(guild, estado, log).catch((e) => { log("canais novos: " + e.message); return {}; });
    if (Object.keys(novos).length) { estado.canais = { ...estado.canais, ...novos }; salvar(); }
    await V.aplicarIdentidade(client, guild, estado, salvar, log).catch((e) => log("identidade visual: " + e.message));
    for (const k of CALLS_ATEND) {
      const ch = guild.channels.cache.get(estado.canais?.[k]);
      for (const ow of ch?.permissionOverwrites?.cache?.values() || []) if (ow.type === 1 && !ch.members.has(ow.id)) await ch.permissionOverwrites.delete(ow.id).catch(() => {});
    }
    if (estado.permClientes !== 3 && estado.cargos?.cliente) {
      await alternarAreaClientes(guild, estado, Boolean(estado.clientesAbertos)).then(() => { estado.permClientes = 3; salvar(); }).catch((e) => log("permissões da área das clientes: " + e.message));
    }
    if (estado.ordemCategorias !== 4) {
      try {
        const cats = ESTRUTURA.map((b) => guild.channels.cache.get(estado.canais?.[(b.canais.find((c) => !c.adotar) || b.canais[0]).chave])?.parent).filter(Boolean);
        await guild.channels.setPositions(cats.map((c, n) => ({ channel: c.id, position: n })));
        for (const b of ESTRUTURA) for (const c of b.canais) {
          const ch = guild.channels.cache.get(estado.canais?.[c.chave]);
          if (ch && !c.adotar && (ch.name !== c.nome || (ch.topic !== undefined && ch.topic !== c.topico))) await ch.edit({ name: c.nome, topic: c.topico }).catch((e) => log(`renomear ${c.nome}: ${e.message}`));
        }
        const pos = [];
        for (const b of ESTRUTURA) b.canais.forEach((c, n) => { const ch = !c.adotar && guild.channels.cache.get(estado.canais?.[c.chave]); if (ch) pos.push({ channel: ch.id, position: n }); });
        await guild.channels.setPositions(pos).catch((e) => log("ordem dos canais: " + e.message));
        estado.ordemCategorias = 4; salvar();
      } catch (e) { log("ordem das categorias: " + e.message); }
    }
  }
  await ciclo();
  setInterval(ciclo, INTERVALO);
});

// Status para o atalho "Status" do PC.
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, papel, pc: PC, revendi: estadoRevendi(), crediario: crediario.length, discordReady: client.isReady(), firebase: db.firestoreConfigurado(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size, ultimoCiclo, ultimoErro }));
}).listen(PORTA, "127.0.0.1", () => log(`status em http://127.0.0.1:${PORTA}/health`));

/** Tenta ser o PC principal. Ganha se ninguém renovou o revezamento nos últimos 3 minutos. */
async function assumirLideranca() {
  const agora = new Date().toISOString();
  const atual = await db.obter("botKaren", "lider");
  const livre = !atual || atual.dono === PC || !atual.vistoEm || Date.now() - Date.parse(atual.vistoEm) > LIDER_EXPIRA;
  if (!livre) return { ok: false, dono: atual.dono, vistoEm: atual.vistoEm };
  try {
    if (atual) await db.atualizar("botKaren", "lider", { dono: PC, vistoEm: agora }, atual._atualizado);
    else await db.definir("botKaren", "lider", { dono: PC, vistoEm: agora });
    return { ok: true };
  } catch { return { ok: false, dono: "outro PC", vistoEm: agora }; }
}

async function iniciar() {
  if (!db.firestoreConfigurado()) { papel = "principal"; await carregarEstado(); return client.login(TOKEN); }
  let aviso = "";
  for (;;) {
    let r;
    try { r = await assumirLideranca(); } catch (e) { r = { ok: false, dono: "?", erro: e.message }; }
    if (r.ok) break;
    papel = "reserva";
    // Se o PC principal não tem o login do Revendi e este tem, a leitura do Revendi roda daqui
    // (só grava no Firebase; o principal posta no Discord).
    if (revendiAtivo()) {
      try {
        const st = await db.obter("botKaren", "status");
        if (!st?.revendi) await sincronizarRevendi((t) => log("reserva · " + t));
      } catch (e) { log("reserva · Revendi: " + e.message); }
    }
    const msg = r.erro ? `reserva: sem acesso ao Firebase (${r.erro}); tentando de novo` : `reserva: o PC "${r.dono}" está com o bot; assumo se ele ficar 3 min sem sinal`;
    if (msg !== aviso) { log(msg); aviso = msg; }
    await new Promise((ok) => setTimeout(ok, 60000));
  }
  papel = "principal";
  log(`principal: este PC (${PC}) está com o bot`);
  // Renova a cada minuto. Se outro PC assumiu (este ficou sem rede ou dormiu), sai e volta como reserva.
  setInterval(async () => {
    try {
      const r = await assumirLideranca();
      if (!r.ok) { log(`o PC "${r.dono}" assumiu o bot; este volta para a reserva`); client.destroy(); process.exit(0); }
    } catch (e) { log("revezamento: " + e.message); }
  }, 60000);
  await carregarEstado();
  return client.login(TOKEN);
}
iniciar();
