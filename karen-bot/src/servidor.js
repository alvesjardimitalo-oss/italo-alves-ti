// Estrutura do servidor da Karen: cargos, categorias e canais.
// /servidor montar apaga TODOS os canais e cargos antigos (do High OS) e cria tudo do zero.
import { ChannelType, PermissionFlagsBits as P } from "discord.js";

export const CARGOS = [
  { chave: "dona", nome: "👑 Karen", cor: 0xab4c78, hoist: true },
  { chave: "admin", nome: "🛠️ Admin", cor: 0x612746, hoist: true },
  { chave: "consorciada", nome: "💳 Consorciada", cor: 0xd4a72c, hoist: false },
  { chave: "cliente", nome: "🌸 Cliente", cor: 0xf3a6c4, hoist: false },
];

// tipo: texto | forum | anuncio. area: equipe (só Karen/Admin) | clientes (oculta até abrir).
export const ESTRUTURA = [
  { categoria: "📊 PAINEL", area: "equipe", canais: [
    { chave: "resumo", nome: "📋・resumo-do-dia", topico: "Todo dia às 8h: parcelas do mês, atrasos, renovações e pedidos da loja." },
    { chave: "alertas", nome: "🔔・alertas", topico: "Avisos na hora: pedidos da loja, renovações, reservas e erros do bot." },
  ] },
  { categoria: "🤝 CONSÓRCIO", area: "equipe", canais: [
    { chave: "grupos", nome: "📁・grupos", tipo: "forum", topico: "Um tópico por grupo, sempre atualizado com membros, parcelas e atrasos. Configure os grupos no painel." },
    { chave: "comprovantes", nome: "🧾・comprovantes", topico: "Cole aqui o print do Pix: o bot pergunta de quem é e já dá baixa na parcela." },
    { chave: "cobrancas", nome: "📲・cobrancas", topico: "Lembrete 2 dias antes do vencimento e cobranças no dia seguinte, com WhatsApp pronto e baixa." },
    { chave: "pagamentos", nome: "✅・pagamentos", topico: "Registro de cada parcela marcada como paga (pelo painel ou pelo bot)." },
    { chave: "resgates", nome: "🎁・resgates", topico: "Resgates de prêmio registrados." },
  ] },
  { categoria: "📥 FORMULÁRIOS DO SITE", area: "equipe", canais: [
    { chave: "renovacoes", nome: "🔁・renovacoes", topico: "Respostas do formulário de renovação (nota, críticas, sugestões e se renova)." },
    { chave: "reservas", nome: "📝・banco-de-reserva", topico: "Quem quer entrar no próximo grupo, pelo site." },
  ] },
  { categoria: "🛍️ LOJA DO SITE", area: "equipe", canais: [
    { chave: "pedidos", nome: "🛒・pedidos-da-loja", topico: "Pedidos feitos no carrinho da loja (Pix). Confirme o Pix no painel." },
    { chave: "sacola", nome: "🎁・sacola-misteriosa", topico: "Solicitações da Sacola Misteriosa." },
    { chave: "roleta", nome: "🎡・roleta", topico: "Cupons ganhos na roleta da Black Friday." },
  ] },
  { categoria: "🗂️ ADMIN", area: "equipe", canais: [
    { chave: "comandos", nome: "⌨️・comandos", topico: "Use os comandos do bot aqui: /consorcio, /loja, /servidor." },
    { chave: "logs", nome: "🧾・logs-do-bot", topico: "O que o bot fez e eventuais erros." },
  ] },
  { categoria: "🌸 ÁREA DAS CLIENTES", area: "clientes", canais: [
    { chave: "boasvindas", nome: "👋・boas-vindas", topico: "Bem-vinda à Karen Martins Cosméticos!" },
    { chave: "novidades", nome: "✨・novidades", topico: "Lançamentos, promoções e campanhas." },
    { chave: "meuconsorcio", nome: "💳・meu-consorcio", topico: "Use /minhas-parcelas para ver a sua situação (só você vê a resposta)." },
  ] },
];

const EQUIPE = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.UseApplicationCommands,
  P.CreatePublicThreads, P.SendMessagesInThreads, P.ManageMessages, P.ManageThreads];
const LEITURA_CLIENTE = [P.ViewChannel, P.ReadMessageHistory, P.UseApplicationCommands];

function permissoes(guild, area, cargos, clientesAbertos) {
  const lista = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: guild.members.me.id, allow: [...EQUIPE, P.ManageChannels] },
    { id: cargos.dona.id, allow: EQUIPE },
    { id: cargos.admin.id, allow: EQUIPE },
  ];
  if (area === "clientes" && clientesAbertos) {
    lista.push({ id: cargos.cliente.id, allow: LEITURA_CLIENTE, deny: [P.SendMessages] });
    lista.push({ id: cargos.consorciada.id, allow: LEITURA_CLIENTE, deny: [P.SendMessages] });
  }
  return lista;
}

/** Apaga canais e cargos antigos e cria a estrutura. Devolve { canais: {chave: id}, cargos: {chave: id}, preservados: [] }. */
export async function montarServidor(guild, log = () => {}) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const eu = guild.members.me;
  const preservados = [];

  // 1) Canais antigos: todos.
  const guardar = () => false;
  const canais = [...guild.channels.cache.values()];
  for (const c of canais.filter((c) => c.type !== ChannelType.GuildCategory)) {
    if (guardar(c)) { preservados.push(c.name); continue; }
    try { await c.delete("Reorganização: servidor da Karen Cosméticos"); } catch (e) { log("não apaguei o canal " + c.name + ": " + e.message); }
  }
  for (const c of canais.filter((c) => c.type === ChannelType.GuildCategory)) {
    const temGuardado = [...guild.channels.cache.values()].some((x) => x.parentId === c.id && guardar(x));
    if (temGuardado) continue;
    try { await c.delete("Reorganização"); } catch (e) { log("não apaguei a categoria " + c.name + ": " + e.message); }
  }

  // 2) Cargos antigos que o bot consegue apagar (abaixo dele, não gerenciados por integração).
  for (const r of [...guild.roles.cache.values()]) {
    if (r.id === guild.roles.everyone.id || r.managed || r.position >= eu.roles.highest.position) continue;
    try { await r.delete("Reorganização"); } catch (e) { log("não apaguei o cargo " + r.name + ": " + e.message); }
  }

  // 3) Cargos novos.
  const cargos = {};
  for (const c of CARGOS) {
    cargos[c.chave] = await guild.roles.create({ name: c.nome, color: c.cor, hoist: c.hoist, mentionable: false, reason: "Servidor da Karen" });
  }

  // 4) Categorias e canais.
  const ids = {};
  for (const bloco of ESTRUTURA) {
    const cat = await guild.channels.create({ name: bloco.categoria, type: ChannelType.GuildCategory, permissionOverwrites: permissoes(guild, bloco.area, cargos, false) });
    for (const c of bloco.canais) {
      const tipo = c.tipo === "forum" ? ChannelType.GuildForum : ChannelType.GuildText;
      const opcoes = { name: c.nome, type: tipo, parent: cat.id, topic: c.topico, permissionOverwrites: permissoes(guild, bloco.area, cargos, false) };
      let canal;
      try { canal = await guild.channels.create(opcoes); }
      catch (e) {
        if (tipo !== ChannelType.GuildForum) throw e;
        log("fórum indisponível neste servidor, usando canal de texto: " + e.message);
        canal = await guild.channels.create({ ...opcoes, type: ChannelType.GuildText });
      }
      ids[c.chave] = canal.id;
    }
  }
  if (preservados.length) {
    const sistema = await guild.channels.create({ name: "🔒 SISTEMA (não mexer)", type: ChannelType.GuildCategory, permissionOverwrites: permissoes(guild, "equipe", cargos, false) });
    for (const c of guild.channels.cache.filter((x) => guardar(x)).values()) { try { await c.setParent(sistema.id, { lockPermissions: false }); } catch {} }
  }
  try { await guild.setName("Karen Martins Cosméticos"); } catch (e) { log("não renomeei o servidor: " + e.message); }

  return { canais: ids, cargos: Object.fromEntries(Object.entries(cargos).map(([k, r]) => [k, r.id])), preservados };
}

/** Mostra ou esconde a Área das Clientes para os cargos Cliente e Consorciada. */
export async function alternarAreaClientes(guild, estado, abrir) {
  const cargos = Object.fromEntries(Object.entries(estado.cargos || {}).map(([k, id]) => [k, guild.roles.cache.get(id)]));
  if (!cargos.cliente || !cargos.consorciada || !cargos.dona || !cargos.admin) throw new Error("cargos não encontrados; rode /servidor montar");
  const bloco = ESTRUTURA.find((b) => b.area === "clientes");
  const alvos = bloco.canais.map((c) => guild.channels.cache.get(estado.canais?.[c.chave])).filter(Boolean);
  const cat = alvos[0]?.parent;
  for (const c of [cat, ...alvos].filter(Boolean)) await c.permissionOverwrites.set(permissoes(guild, "clientes", cargos, abrir));
}

/** Cria os canais que faltam (versões novas do bot) sem mexer no resto. Devolve os ids novos. */
export async function completarCanais(guild, estado, log = () => {}) {
  await guild.channels.fetch();
  const cargos = Object.fromEntries(Object.entries(estado.cargos || {}).map(([k, id]) => [k, guild.roles.cache.get(id)]));
  if (!cargos.dona || !cargos.admin || !cargos.cliente || !cargos.consorciada) return {};
  const novos = {};
  for (const bloco of ESTRUTURA) {
    for (const c of bloco.canais) {
      if (estado.canais?.[c.chave] && guild.channels.cache.get(estado.canais[c.chave])) continue;
      const irmao = bloco.canais.map((x) => guild.channels.cache.get(estado.canais?.[x.chave])).find(Boolean);
      let cat = irmao?.parent || guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === bloco.categoria);
      if (!cat) cat = await guild.channels.create({ name: bloco.categoria, type: ChannelType.GuildCategory, permissionOverwrites: permissoes(guild, bloco.area, cargos, estado.clientesAbertos) });
      const tipo = c.tipo === "forum" ? ChannelType.GuildForum : ChannelType.GuildText;
      try {
        const canal = await guild.channels.create({ name: c.nome, type: tipo, parent: cat.id, topic: c.topico, permissionOverwrites: permissoes(guild, bloco.area, cargos, bloco.area === "clientes" && estado.clientesAbertos) });
        novos[c.chave] = canal.id;
        log("canal novo criado: " + c.nome);
      } catch (e) { log("não criei o canal " + c.nome + ": " + e.message); }
    }
  }
  return novos;
}
