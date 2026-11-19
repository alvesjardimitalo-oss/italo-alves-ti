// Identidade visual da Karen Martins Cosméticos no Discord: cores fixas por tipo de aviso, cabeçalho e
// rodapé com a logo em todo post, avatar/banner do bot, ícone/banner do servidor, emojis das marcas e
// barras de progresso. As imagens ficam em karen-bot/assets (no GitHub e no PC).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EmbedBuilder } from "discord.js";

const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
export const LOGO_URL = "https://raw.githubusercontent.com/alvesjardimitalo-oss/italo-alves-ti/main/karen-bot/assets/logo-256.png";
export const NOME = "Karen Martins Cosméticos";
const VERSAO = 1; // aumente para reaplicar avatar, banner, ícone e emojis

/** Cores fixas: cada tipo de aviso tem sempre a mesma cor. */
export const CORES = {
  marca: 0xa74971,     // rosé da Karen: resumos, central, relatórios
  venda: 0xd55181,     // vendas e aniversários
  pago: 0x2e9e6b,      // pago, quitado, tudo certo
  atencao: 0xe0a526,   // pago em parte, vence logo, esperando
  atraso: 0xd64545,    // atraso, vencido, urgente
  crediario: 0x8e5bd6, // crediário
  info: 0x3987e5,      // consórcio formando, informação
  neutro: 0x6b6a63,    // encerrado
};

/** Barra de progresso em texto: ▰▰▰▰▰▰▱▱▱▱ */
export function barra(atual, total, n = 10) {
  const t = Math.max(0, Number(total) || 0), a = Math.max(0, Math.min(t, Number(atual) || 0));
  const cheios = t ? Math.round((a / t) * n) : 0;
  return "▰".repeat(cheios) + "▱".repeat(n - cheios);
}
export const pct = (a, t) => (t ? Math.round((a / t) * 100) : 0);

// ---------------------------------------------------------------- cabeçalho e rodapé
/** Põe a logo e o nome da Karen no topo e a logo no rodapé de cada embed que ainda não tem. */
export function decorar(conteudo) {
  if (!conteudo || typeof conteudo !== "object" || !Array.isArray(conteudo.embeds)) return conteudo;
  conteudo.embeds.forEach((e, n) => {
    if (!(e instanceof EmbedBuilder)) return;
    const d = e.data;
    if (n === 0 && !d.author && d.title) e.setAuthor({ name: NOME, iconURL: LOGO_URL });
    if (d.footer?.text && !d.footer.icon_url) e.setFooter({ text: d.footer.text, iconURL: LOGO_URL });
    if (!d.color) e.setColor(CORES.marca);
  });
  return conteudo;
}

// ---------------------------------------------------------------- emojis das marcas
const EMOJIS = [
  { nome: "kc_boticario", arq: "e-boticario.png", marcas: ["boticário", "boticario"] },
  { nome: "kc_eudora", arq: "e-eudora.png", marcas: ["eudora"] },
  { nome: "kc_qdb", arq: "e-qdb.png", marcas: ["quem disse", "berenice"] },
  { nome: "kc_oui", arq: "e-oui.png", marcas: ["o.u.i", "oui"] },
  { nome: "kc_karen", arq: "e-karen.png", marcas: [] },
];
let ids = {};
export const usarEmojis = (mapa) => { ids = mapa || {}; };
/** "<:kc_eudora:123>" para a marca, ou "" se não houver emoji. */
export function emojiMarca(marca) {
  const m = String(marca || "").toLowerCase();
  const e = EMOJIS.find((x) => x.marcas.some((k) => m.includes(k)));
  return e && ids[e.nome] ? `<:${e.nome}:${ids[e.nome]}>` : "";
}

// ---------------------------------------------------------------- aplicar no Discord (uma vez por versão)
const ler = (arq) => { try { return fs.readFileSync(path.join(PASTA, arq)); } catch { return null; } };
export async function aplicarIdentidade(client, guild, estado, salvar, log) {
  await guild.emojis.fetch().catch(() => {});
  const mapa = { ...(estado.emojis || {}) };
  for (const e of EMOJIS) {
    const existe = guild.emojis.cache.find((x) => x.name === e.nome);
    if (existe) { mapa[e.nome] = existe.id; continue; }
    const img = ler(e.arq);
    if (!img) continue;
    try { const novo = await guild.emojis.create({ attachment: img, name: e.nome, reason: "Emojis da Karen" }); mapa[e.nome] = novo.id; }
    catch (err) { log(`emoji ${e.nome}: ${err.message}`); }
  }
  estado.emojis = mapa; usarEmojis(mapa);
  if (estado.visualVersao === VERSAO) { salvar(); return; }
  const avatar = ler("avatar.png"), banner = ler("banner.png");
  if (avatar) await client.user.setAvatar(avatar).then(() => log("foto do bot atualizada")).catch((e) => log("foto do bot: " + e.message));
  if (banner && client.user.setBanner) await client.user.setBanner(banner).catch((e) => log("banner do bot: " + e.message));
  if (avatar) await guild.setIcon(avatar).then(() => log("ícone do servidor atualizado")).catch((e) => log("ícone do servidor: " + e.message));
  if (banner) await guild.setBanner(banner).catch(() => {}); // só com impulso (boost) nível 2
  estado.visualVersao = VERSAO; salvar();
}
