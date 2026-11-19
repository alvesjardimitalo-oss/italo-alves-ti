// Bot da Karen Martins Cosméticos — consórcio, formulários do site e loja, no Discord.
// Roda no PC do Ítalo. O banco é o Firestore do painel (ti/base/*): o bot lê os grupos e os
// pedidos do site, avisa no Discord e grava de volta as baixas de parcela e as respostas.
import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, ChannelType,
  AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import * as db from "./firestore.js";
import * as C from "./consorcio.js";
import { montarServidor, alternarAreaClientes, completarCanais } from "./servidor.js";

const TOKEN = process.env.DISCORD_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const PORTA = Number(process.env.PORT || 3100);
const PASTA = process.env.KAREN_BOT_DATA || path.resolve("dados");
const INTERVALO = Math.max(45, Number(process.env.INTERVALO_SEGUNDOS || 90)) * 1000;
const COR = 0xab4c78, VERDE = 0x2e7d4f, VERMELHO = 0xc0392b, AZUL = 0x3b6ea5;
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
}

// ---------------------------------------------------------------- utilidades
// GuildMessages (não privilegiado) só para saber que chegou um print em #comprovantes.
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
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
  try { return await c.send(conteudo); } catch (e) { log(`não consegui postar em ${chave}: ${e.message}`); return null; }
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
  new SlashCommandBuilder().setName("loja").setDescription("Loja do site")
    .addSubcommand((s) => s.setName("pedidos").setDescription("Pedidos da loja dos últimos 7 dias")),
  new SlashCommandBuilder().setName("servidor").setDescription("Organização do servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName("montar").setDescription("APAGA os canais e cargos atuais e cria o servidor da Karen"))
    .addSubcommand((s) => s.setName("clientes").setDescription("Mostrar ou esconder a Área das Clientes")
      .addStringOption((o) => o.setName("acao").setDescription("abrir ou fechar").setRequired(true).addChoices({ name: "abrir", value: "abrir" }, { name: "fechar", value: "fechar" })))
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
    return `${ic} **${curto(m.nome, 40)}** · ${x.pagas}/${x.total}` + (x.atrasadas.length ? ` · ${x.atrasadas.length} atrasada(s)` : "") +
      (m.resgatadoEm ? " · 🎁 resgatou" : x.quitado ? " · 🎁 falta resgatar" : "") + renova;
  });
  const e = new EmbedBuilder().setColor(sit === "andamento" ? (r.comAtraso.length ? VERMELHO : VERDE) : sit === "formando" ? AZUL : 0x888888)
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
    e.setColor(renova === "sim" ? VERDE : renova === "talvez" ? 0xd4a72c : 0x888888)
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
      `${r.pagosNoMes}/${r.membros} pagaram ${C.rotuloMes(hoje.ym)}` + (r.comAtraso.length ? ` · ⚠️ ${r.comAtraso.length} em atraso (${C.brl(r.emAtraso)})` : " · sem atrasos") +
      (hoje.dia === venc ? "\n📅 **Vence hoje!**" : hoje.dia === venc - 1 ? "\n📅 Vence amanhã" : ""), 1000) });
  }
  if (!ativos.length) e.setDescription("Nenhum grupo em andamento. Cadastre os grupos no painel.");
  else e.setDescription(`💰 Recebido em ${C.rotuloMes(hoje.ym, true)}: **${C.brl(recebido)}** de ${C.brl(previsto)}`);
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
  await enviar("resumo", { embeds: [e] });
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
  const e = new EmbedBuilder().setColor(0xd4a72c).setTitle(`⏰ ${g.codigo}: parcela de ${C.rotuloMes(ym, true)} vence dia ${g.vencimento || 10}`)
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
  const resgates = [...grupos.values()].flatMap((g) => (g.membros || []).filter((m) => String(m.resgatadoEm || "").startsWith(ym)).map((m) => `${m.nome} (${g.codigo})`));
  if (resgates.length) e.addFields({ name: `🎁 Resgates no mês (${resgates.length})`, value: curto(resgates.join(" · "), 1000) });
  await enviar("resumo", { embeds: [e] });
}

async function backupSemanal() {
  const dados = { geradoEm: new Date().toISOString(), grupos: [...grupos.values()].map(({ _atualizado, ...g }) => g) };
  const arquivo = new AttachmentBuilder(Buffer.from(JSON.stringify(dados, null, 2), "utf8"), { name: `consorcio-backup-${C.agoraSP().data}.json` });
  await enviar("logs", { content: `💾 Backup semanal dos grupos do consórcio (${dados.grupos.length} grupos). Guarde se quiser; o painel continua sendo a fonte oficial.`, files: [arquivo] });
}

async function rotinas() {
  const h = C.agoraSP();
  if (h.hora >= 8 && h.hora < 21 && estado.resumoDia !== h.data) {
    estado.resumoDia = h.data; salvar();
    await resumoDoDia().catch((e) => log("resumo: " + e.message));
  }
  if (h.hora >= 9 && h.hora < 21) {
    if (h.dia === 1 && estado.relatorioMes !== h.ym) {
      estado.relatorioMes = h.ym; salvar();
      await relatorioMensal(C.somarMes(h.ym, -1)).catch((e) => log("relatório: " + e.message));
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
    await verificarGrupos();
    await verificarLeads();
    await rotinas();
    ultimoCiclo = new Date().toISOString(); ultimoErro = "";
    // Sinal de vida para o painel (a cada ~10 min).
    if (!ciclo.sinal || Date.now() - ciclo.sinal > 9 * 60000) {
      ciclo.sinal = Date.now();
      await db.definir("botKaren", "status", { vistoEm: ultimoCiclo, discord: client.isReady(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size, pc: PC }).catch(() => {});
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
  if (foco.name === "grupo") {
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
    if (sub === "vincular") {
      const u = i.options.getUser("pessoa");
      const tel = C.soNumeros(i.options.getString("whatsapp"));
      if (tel.length < 10) return i.reply({ ...EFEMERA, content: "WhatsApp inválido." });
      estado.vinculos[u.id] = tel; salvar();
      return i.reply({ ...EFEMERA, content: `Ligado: ${u} ↔ ${C.fone(tel)}. Agora essa pessoa pode usar /minhas-parcelas.` });
    }
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

async function modalEnviado(i) {
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
  if (!ehEquipe(i)) return i.reply({ ...EFEMERA, content: "Só a equipe da Karen pode usar isso." });

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
  }
  await ciclo();
  setInterval(ciclo, INTERVALO);
});

// Status para o atalho "Status" do PC.
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, papel, pc: PC, discordReady: client.isReady(), firebase: db.firestoreConfigurado(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size, ultimoCiclo, ultimoErro }));
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
