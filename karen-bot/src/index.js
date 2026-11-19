// Bot da Karen Martins Cosméticos — consórcio, formulários do site e loja, no Discord.
// Roda no PC do Ítalo. O banco é o Firestore do painel (ti/base/*): o bot lê os grupos e os
// pedidos do site, avisa no Discord e grava de volta as baixas de parcela e as respostas.
import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits, ChannelType,
} from "discord.js";
import * as db from "./firestore.js";
import * as C from "./consorcio.js";
import { montarServidor, alternarAreaClientes } from "./servidor.js";

const TOKEN = process.env.DISCORD_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const PORTA = Number(process.env.PORT || 3100);
const PASTA = process.env.KAREN_BOT_DATA || path.resolve("dados");
const INTERVALO = Math.max(45, Number(process.env.INTERVALO_SEGUNDOS || 90)) * 1000;
const COR = 0xab4c78, VERDE = 0x2e7d4f, VERMELHO = 0xc0392b, AZUL = 0x3b6ea5;
const EFEMERA = { flags: MessageFlags.Ephemeral };

if (!TOKEN || !GUILD_ID) { console.error("Faltam DISCORD_TOKEN e/ou DISCORD_GUILD_ID no .env."); process.exit(1); }
if (!db.firestoreConfigurado()) console.error("ATENÇÃO: falta FIREBASE_SERVICE_ACCOUNT_JSON no .env — o bot não consegue ler o painel.");

// ---------------------------------------------------------------- estado
fs.mkdirSync(PASTA, { recursive: true });
const ARQ = path.join(PASTA, "estado.json");
let estado = { canais: {}, cargos: {}, threads: {}, versoes: {}, vistos: {}, cursorLeads: "", resumoDia: "", cobrancaMes: {}, vinculos: {}, clientesAbertos: false };
function carregarLocal() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return null; } }
let salvarTimer = null;
function salvar() {
  fs.writeFileSync(ARQ, JSON.stringify(estado, null, 2));
  clearTimeout(salvarTimer);
  // Cópia no Firestore: reinstalar o bot em outro PC não perde canais, tópicos nem vínculos.
  salvarTimer = setTimeout(() => db.definir("botKaren", "estado", { json: JSON.stringify(estado), salvoEm: new Date().toISOString() }).catch((e) => log("cópia do estado falhou: " + e.message)), 5000);
}
async function carregarEstado() {
  const local = carregarLocal();
  if (local) { estado = { ...estado, ...local }; return; }
  try {
    const remoto = await db.obter("botKaren", "estado");
    if (remoto?.json) { estado = { ...estado, ...JSON.parse(remoto.json) }; log("estado recuperado do Firestore"); }
  } catch (e) { log("sem estado anterior: " + e.message); }
}

// ---------------------------------------------------------------- utilidades
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
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
    .addSubcommand((s) => s.setName("links").setDescription("Links de renovação e do banco de reserva")),
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
    return `${ic} **${curto(m.nome, 40)}** · ${x.pagas}/${x.total}` + (x.atrasadas.length ? ` · ${x.atrasadas.length} atrasada(s)` : "") + (m.resgatadoEm ? " · 🎁 resgatou" : "");
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
          await enviar("resgates", { content: `🎁 **${m.nome}** resgatou o prêmio do ${g.codigo} em ${C.dataBR(m.resgatadoEm)}` + (m.resgateValor ? ` · produtos ${C.brl(m.resgateValor)}` : "") + (m.resgateValor > g.premio ? ` · diferença ${C.brl(m.resgateValor - g.premio)}` : "") + (m.resgateObs ? `\n> ${curto(m.resgateObs, 300)}` : "") });
        }
      }
    }
    estado.vistos[g.id] = agora;
    try { await atualizarTopico(g); estado.versoes[g.id] = g._atualizado; } catch (e) { log(`tópico do ${g.codigo}: ${e.message}`); }
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

async function cobrancasDoMes(g) {
  const r = C.resumoGrupo(g);
  if (!r.comAtraso.length) {
    await enviar("cobrancas", { content: `🎉 **${g.codigo}**: todo mundo pagou ${C.rotuloMes(C.mesAtual(), true)}!` });
    return;
  }
  const lista = r.comAtraso.sort((a, b) => b.r.atrasadas.length - a.r.atrasadas.length).map(({ m, r: x }) => ({ m, descricao: `${x.atrasadas.length} atrasada(s) · ${C.brl(x.atrasadas.length * g.valorParcela)}` }));
  const e = new EmbedBuilder().setColor(VERMELHO).setTitle(`📲 Cobranças do ${g.codigo} · venceu dia ${g.vencimento || 10}`)
    .setDescription(curto(lista.map(({ m, descricao }) => `• **${m.nome}** · ${descricao}`).join("\n"), 4000))
    .setFooter({ text: "Escolha no primeiro menu para abrir o WhatsApp com a cobrança pronta; no segundo, para dar baixa." });
  const comp = [menuMembros("cob", g, lista, "📲 Cobrar no WhatsApp…"), menuMembros("baixa", g, lista, "✅ Já pagou: dar baixa…")].filter(Boolean);
  await enviar("cobrancas", { embeds: [e], components: comp });
}

async function rotinas() {
  const h = C.agoraSP();
  if (h.hora >= 8 && h.hora < 21 && estado.resumoDia !== h.data) {
    estado.resumoDia = h.data; salvar();
    await resumoDoDia().catch((e) => log("resumo: " + e.message));
  }
  if (h.hora >= 9 && h.hora < 21) {
    for (const g of grupos.values()) {
      if (C.situacao(g) !== "andamento") continue;
      const venc = Number(g.vencimento) || 10;
      if (h.dia > venc && estado.cobrancaMes[g.id] !== h.ym) {
        estado.cobrancaMes[g.id] = h.ym; salvar();
        await cobrancasDoMes(g).catch((e) => log("cobranças: " + e.message));
      }
    }
  }
}

async function ciclo() {
  if (!guild || !db.firestoreConfigurado()) return;
  try {
    await verificarGrupos();
    await verificarLeads();
    await rotinas();
    ultimoCiclo = new Date().toISOString(); ultimoErro = "";
    // Sinal de vida para o painel (a cada ~10 min).
    if (!ciclo.sinal || Date.now() - ciclo.sinal > 9 * 60000) {
      ciclo.sinal = Date.now();
      await db.definir("botKaren", "status", { vistoEm: ultimoCiclo, discord: client.isReady(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size }).catch(() => {});
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
      "• **#resumo-do-dia**: todo dia às 8h.",
      "Comandos: `/consorcio resumo`, `/consorcio atrasados`, `/consorcio pagou`, `/consorcio desfazer`, `/consorcio membro`, `/consorcio links`, `/loja pedidos`.",
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
  } catch (e) {
    log("interação: " + (e.stack || e.message));
    const msg = { content: "⚠️ " + e.message };
    try { if (i.deferred || i.replied) await i.editReply(msg); else await i.reply({ ...EFEMERA, ...msg }); } catch {}
  }
});

client.once(Events.ClientReady, async () => {
  log(`conectado como ${client.user.tag}`);
  guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();
  await registrarComandos().catch((e) => log("registrar comandos: " + e.message));
  if (!estado.canais?.grupos) log("servidor ainda não montado: use /servidor montar no Discord");
  await ciclo();
  setInterval(ciclo, INTERVALO);
});

// Status para o atalho "Status" do PC.
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, discordReady: client.isReady(), firebase: db.firestoreConfigurado(), servidorMontado: Boolean(estado.canais?.grupos), grupos: grupos.size, ultimoCiclo, ultimoErro }));
}).listen(PORTA, "127.0.0.1", () => log(`status em http://127.0.0.1:${PORTA}/health`));

await carregarEstado();
client.login(TOKEN);
