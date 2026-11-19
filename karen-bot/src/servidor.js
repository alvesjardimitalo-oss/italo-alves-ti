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
    { chave: "hoje", nome: "🌸・hoje", topico: "Painel ao vivo do dia: vendas, meta do mês, crediário, consórcio, entregas e aniversários. Atualiza sozinho." },
    { chave: "resumo", nome: "📋・resumo-do-dia", topico: "Todo dia às 8h: parcelas do mês, atrasos, renovações e pedidos da loja." },
    { chave: "alertas", nome: "🔔・alertas", topico: "Avisos na hora: pedidos da loja, renovações, reservas e erros do bot." },
  ] },
  { categoria: "🛍️ REVENDI", area: "equipe", canais: [
    { chave: "rvVendas", nome: "💰・vendas", topico: "Cada venda lançada no Revendi: cliente, itens, valor, lucro e entrega, com agradecimento pronto no WhatsApp." },
    { chave: "crediario", nome: "💳・crediario", topico: "Todo dia às 9h: parcelas do crediário que vencem hoje e as atrasadas, com cobrança pronta no WhatsApp." },
    { chave: "rvEntregas", nome: "🚚・entregas", topico: "Painel sempre atualizado com as vendas ainda não entregues no Revendi e há quantos dias esperam." },
    { chave: "rvEstoque", nome: "📦・estoque", topico: "Painel do estoque: vencendo nos próximos 60 dias, esgotados que vendem e produtos parados." },
    { chave: "rvAniversarios", nome: "🎂・aniversarios", topico: "Aniversariantes do dia (8h) e da semana (segunda), com parabéns pronto no WhatsApp." },
    { chave: "rvReativar", nome: "💌・clientes-sumidas", topico: "Toda segunda: clientes sem comprar há mais de 60 dias, com mensagem pronta para chamar de volta." },
    { chave: "rvDesempenho", nome: "📈・desempenho", topico: "Toda segunda: a semana em números (vendas, lucro, ticket, campeões). No dia 1: o mês." },
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
    { chave: "comandos", nome: "🎛️・central", topico: "Central com botões (respostas só para você). Mensagens digitadas aqui somem em 1 minuto." },
    { chave: "logs", nome: "🧾・logs-do-bot", topico: "O que o bot fez e eventuais erros." },
  ] },
  // acesso (área das clientes): publico = qualquer pessoa que entrar vê (só lê); clientes = Cliente e Consorciada leem;
  // conversa = Cliente e Consorciada escrevem; consorciadas = só Consorciada; voz = call que Cliente e Consorciada entram e falam.
  { categoria: "🌸 ÁREA DAS CLIENTES", area: "clientes", canais: [
    { chave: "boasvindas", nome: "👋・boas-vindas", acesso: "publico", topico: "Bem-vinda à Karen Martins Cosméticos! Toque em 🌸 Entrar para ver o restante." },
    { chave: "novidades", nome: "✨・novidades", acesso: "clientes", topico: "Lançamentos, promoções e campanhas." },
    { chave: "faleconosco", nome: "💬・fale-com-a-karen", acesso: "conversa", topico: "Dúvidas, pedidos e encomendas. A Karen responde por aqui." },
    { chave: "meuconsorcio", nome: "💳・meu-consorcio", acesso: "consorciadas", topico: "Use /minhas-parcelas para ver a sua situação (só você vê)." },
    { chave: "callespera", nome: "⏳ Aguardando atendimento", tipo: "voz", acesso: "voz", topico: "", adotar: ["aguard", "espera"] },
  ] },
  // Calls de atendimento: só a equipe vê. A cliente entra em ⏳ Aguardando e a equipe puxa ela para cá (botão no aviso).
  { categoria: "🎧 ATENDIMENTO", area: "equipe", canais: [
    // adotar: usa a call que já existe com esse pedaço no nome (não cria outra). opcional: só adota, nunca cria.
    { chave: "callatend1", nome: "🎧 Atendimento", tipo: "voz", topico: "", adotar: ["atendimento"] },
    { chave: "callatend2", nome: "🎧 Atendimento 2", tipo: "voz", topico: "", adotar: ["atendimento"], opcional: true },
    { chave: "callequipe", nome: "🗣️ Equipe", tipo: "voz", topico: "", adotar: ["equipe", "reuni"], opcional: true },
  ] },
];

const EQUIPE = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks, P.AddReactions, P.UseApplicationCommands,
  P.CreatePublicThreads, P.SendMessagesInThreads, P.ManageMessages, P.ManageThreads];
const LEITURA_CLIENTE = [P.ViewChannel, P.ReadMessageHistory, P.UseApplicationCommands];
const CONVERSA_CLIENTE = [...LEITURA_CLIENTE, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions];
const VOZ_CLIENTE = [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD, P.SendMessages, P.ReadMessageHistory];
const VOZ_EQUIPE = [P.Connect, P.Speak, P.Stream, P.UseVAD, P.MuteMembers, P.MoveMembers, P.DeafenMembers, P.PrioritySpeaker];

/** Permissões de um canal. `canal` (opcional) traz o `acesso` dos canais da área das clientes. */
export function permissoes(guild, area, cargos, clientesAbertos, canal = null) {
  const lista = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: guild.members.me.id, allow: [...EQUIPE, ...VOZ_EQUIPE, P.ManageChannels, P.ManageRoles] },
    { id: cargos.dona.id, allow: [...EQUIPE, ...VOZ_EQUIPE] },
    { id: cargos.admin.id, allow: [...EQUIPE, ...VOZ_EQUIPE] },
  ];
  if (area !== "clientes" || !clientesAbertos) return lista;
  const acesso = canal?.acesso || "clientes";
  const ambos = (allow, deny = []) => { lista.push({ id: cargos.cliente.id, allow, deny }, { id: cargos.consorciada.id, allow, deny }); };
  if (acesso === "publico") { lista[0] = { id: guild.roles.everyone.id, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.AddReactions, P.CreatePublicThreads] }; ambos(LEITURA_CLIENTE, [P.SendMessages]); }
  else if (acesso === "conversa") ambos(CONVERSA_CLIENTE);
  else if (acesso === "voz") ambos(VOZ_CLIENTE);
  else if (acesso === "consorciadas") lista.push({ id: cargos.consorciada.id, allow: LEITURA_CLIENTE, deny: [P.SendMessages] });
  else ambos(LEITURA_CLIENTE, [P.SendMessages]);
  return lista;
}
const tipoDiscord = (c) => c.tipo === "voz" ? ChannelType.GuildVoice : c.tipo === "forum" ? ChannelType.GuildForum : ChannelType.GuildText;
const opcoesCanal = (c, cat, perms) => ({ name: c.nome, type: tipoDiscord(c), parent: cat.id, ...(c.tipo === "voz" ? {} : { topic: c.topico }), permissionOverwrites: perms });

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
      const tipo = tipoDiscord(c);
      const opcoes = opcoesCanal(c, cat, permissoes(guild, bloco.area, cargos, false, c));
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
  const alvos = bloco.canais.map((c) => [c, guild.channels.cache.get(estado.canais?.[c.chave])]).filter(([, ch]) => ch);
  const cat = alvos[0]?.[1]?.parent;
  if (cat) await cat.permissionOverwrites.set(permissoes(guild, "clientes", cargos, abrir, { acesso: "clientes" }));
  for (const [c, ch] of alvos) await ch.permissionOverwrites.set(permissoes(guild, "clientes", cargos, abrir, c));
}

/** Cria os canais que faltam (versões novas do bot) sem mexer no resto. Devolve os ids novos. */
export async function completarCanais(guild, estado, log = () => {}) {
  await guild.channels.fetch();
  const cargos = Object.fromEntries(Object.entries(estado.cargos || {}).map(([k, id]) => [k, guild.roles.cache.get(id)]));
  if (!cargos.dona || !cargos.admin || !cargos.cliente || !cargos.consorciada) return {};
  const novos = {};
  const usados = new Set(Object.values(estado.canais || {}));
  const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const bloco of ESTRUTURA) {
    for (const c of bloco.canais) {
      if (estado.canais?.[c.chave] && guild.channels.cache.get(estado.canais[c.chave])) continue;
      if (c.adotar) {
        const achado = [...guild.channels.cache.values()].filter((x) => x.type === tipoDiscord(c) && !usados.has(x.id) && !novos[c.chave])
          .filter((x) => c.adotar.some((k) => norm(x.name).includes(k)) && !(c.chave !== "callespera" && /aguard|espera/.test(norm(x.name))))
          .sort((a, b) => a.position - b.position)[0];
        if (achado) {
          try { await achado.permissionOverwrites.set(permissoes(guild, bloco.area, cargos, bloco.area === "clientes" && estado.clientesAbertos, c)); } catch (e) { log("permissões de " + achado.name + ": " + e.message); }
          novos[c.chave] = achado.id; usados.add(achado.id);
          log(`call adotada: ${achado.name} (${bloco.area === "clientes" ? "clientes entram" : "só a equipe"})`);
          continue;
        }
        if (c.opcional) continue;
      }
      const irmao = bloco.canais.map((x) => guild.channels.cache.get(estado.canais?.[x.chave])).find(Boolean);
      let cat = irmao?.parent || guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && x.name === bloco.categoria);
      if (!cat) cat = await guild.channels.create({ name: bloco.categoria, type: ChannelType.GuildCategory, permissionOverwrites: permissoes(guild, bloco.area, cargos, estado.clientesAbertos) });
      try {
        const canal = await guild.channels.create(opcoesCanal(c, cat, permissoes(guild, bloco.area, cargos, bloco.area === "clientes" && estado.clientesAbertos, c)));
        novos[c.chave] = canal.id;
        log("canal novo criado: " + c.nome);
      } catch (e) { log("não criei o canal " + c.nome + ": " + e.message); }
    }
  }
  return novos;
}

/** Mapa do servidor: cada categoria/canal/call e quem consegue ver (todos, clientes, consorciadas, só equipe). */
export async function mapaServidor(guild, estado) {
  await guild.channels.fetch();
  const cargo = (k) => guild.roles.cache.get(estado.cargos?.[k]);
  const quem = (ch) => {
    const ve = (r) => r && ch.permissionsFor(r)?.has(P.ViewChannel);
    const fala = (r) => r && ch.permissionsFor(r)?.has(ch.isVoiceBased?.() ? P.Connect : P.SendMessages);
    if (ve(guild.roles.everyone)) return fala(guild.roles.everyone) ? "todos (entram/escrevem)" : "todos (só veem)";
    if (ve(cargo("cliente"))) return fala(cargo("cliente")) ? "clientes (entram/escrevem)" : "clientes (só veem)";
    if (ve(cargo("consorciada"))) return "só consorciadas";
    return "só equipe";
  };
  const gerenciados = new Set(Object.values(estado.canais || {}));
  const tipo = (ch) => ch.type === ChannelType.GuildVoice ? "call" : ch.type === ChannelType.GuildStageVoice ? "palco" : ch.type === ChannelType.GuildForum ? "fórum" : "texto";
  const todos = [...guild.channels.cache.values()].filter((c) => !c.isThread?.());
  const cats = todos.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
  const linha = (ch) => ({ id: ch.id, nome: ch.name, tipo: tipo(ch), quemVe: quem(ch), doBot: gerenciados.has(ch.id) });
  const out = [{ categoria: "(sem categoria)", canais: todos.filter((c) => !c.parentId && c.type !== ChannelType.GuildCategory).sort((a, b) => a.position - b.position).map(linha) }];
  for (const cat of cats) out.push({ categoria: cat.name, quemVe: quem(cat), canais: todos.filter((c) => c.parentId === cat.id).sort((a, b) => a.position - b.position).map(linha) });
  return out.filter((b) => b.canais.length || b.categoria !== "(sem categoria)");
}
