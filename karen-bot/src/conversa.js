// Conversa do ticket em HTML (com fotos), compactada em .zip.
// O Discord abre .html como texto dentro do chat; dentro de um .zip ele vira só um arquivo para baixar.
import zlib from "node:zlib";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function resolver(txt, guild) {
  return String(txt ?? "")
    .replace(/<@!?(\d+)>/g, (_, id) => `@${guild?.members.cache.get(id)?.displayName || guild?.client.users.cache.get(id)?.username || "pessoa"}`)
    .replace(/<@&(\d+)>/g, (_, id) => `@${guild?.roles.cache.get(id)?.name || "cargo"}`)
    .replace(/<#(\d+)>/g, (_, id) => `#${guild?.channels.cache.get(id)?.name || "canal"}`)
    .replace(/<t:(\d+)(?::\w)?>/g, (_, n) => new Date(Number(n) * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
}
const texto = (t, guild) => esc(resolver(t, guild))
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>")
  .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>').replace(/\n/g, "<br>");
const hora = (d) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** msgs: mensagens do canal em ordem cronológica. t: ticket ({ num, nome, tipoNome, assumido, abertoEm }). */
export function htmlConversa(msgs, t, guild, quem, motivo) {
  const linhas = msgs.filter((m) => !m.system).map((m) => {
    const anexos = [...m.attachments.values()].map((a) => (/\.(png|jpe?g|gif|webp)$/i.test(a.name || "")
      ? `<a href="${esc(a.url)}" target="_blank"><img src="${esc(a.url)}" alt="${esc(a.name)}"></a>`
      : `<a class="anexo" href="${esc(a.url)}" target="_blank">📎 ${esc(a.name)}</a>`)).join("");
    const embeds = m.embeds.map((e) => `<div class="embed">${e.title ? `<div class="et">${texto(e.title, guild)}</div>` : ""}${e.description ? `<div>${texto(e.description, guild)}</div>` : ""}${(e.fields || []).map((f) => `<div class="ef"><b>${texto(f.name, guild)}</b><br>${texto(f.value, guild)}</div>`).join("")}</div>`).join("");
    const vazio = !m.content && !m.attachments.size && !m.embeds.length && !m.author.bot;
    return `<div class="msg${m.author.bot ? " bot" : ""}"><img class="av" src="${esc(m.author.displayAvatarURL({ size: 64 }))}"><div class="corpo">
      <div class="topo"><span class="nome">${esc(m.member?.displayName || m.author.username)}</span>${m.author.bot ? '<span class="tag">BOT</span>' : ""}<span class="hora">${hora(m.createdTimestamp)}</span></div>
      ${m.content ? `<div class="txt">${texto(m.content, guild)}</div>` : ""}${vazio ? '<div class="txt oculto">(mensagem de texto — ligue a leitura de conversas no bot para ela aparecer aqui)</div>' : ""}${embeds}${anexos ? `<div class="anexos">${anexos}</div>` : ""}</div></div>`;
  }).join("");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket ${esc(t.num)} · Karen Martins Cosméticos</title><style>
*{box-sizing:border-box}body{margin:0;background:#1d0f17;color:#f5e9ef;font-family:Segoe UI,Roboto,Arial,sans-serif}
header{padding:24px;background:linear-gradient(135deg,#612746,#2a1320);border-bottom:2px solid #d4a72c}
header h1{margin:0 0 6px;font-size:22px;color:#fff}header p{margin:2px 0;color:#f3c6d8;font-size:14px}
main{max-width:900px;margin:0 auto;padding:16px}.msg{display:flex;gap:12px;padding:10px 8px;border-radius:8px}.msg:hover{background:#2a1320}
.av{width:40px;height:40px;border-radius:50%}.corpo{flex:1;min-width:0}.nome{font-weight:600;color:#fff}
.hora{color:#b98ba0;font-size:12px;margin-left:8px}.tag{background:#ab4c78;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:6px}
.txt{margin-top:2px;line-height:1.45;word-wrap:break-word}.oculto{color:#b98ba0;font-style:italic}a{color:#f3a6c4}
.embed{border-left:4px solid #ab4c78;background:#2a1320;padding:10px 12px;border-radius:4px;margin-top:6px}.et{font-weight:700;color:#fff;margin-bottom:4px}.ef{margin-top:6px}
.anexos img{max-width:320px;max-height:240px;border-radius:6px;margin-top:6px;display:block}.anexo{display:inline-block;margin-top:6px}
footer{text-align:center;color:#b98ba0;font-size:12px;padding:24px}</style></head><body>
<header><h1>🎫 Ticket ${esc(t.num)} · ${esc(t.tipoNome || "")}</h1>
<p>Cliente: ${esc(t.nome || "")}${t.assumido ? ` · Atendida por ${esc(t.assumido)}` : ""}</p>
<p>Aberto em ${hora(t.abertoEm)} · Fechado em ${hora(Date.now())} por ${esc(quem)}${motivo ? ` (${esc(motivo)})` : ""}</p></header>
<main>${linhas}</main><footer>Karen Martins Cosméticos 🌸</footer></body></html>`;
}

const TABELA = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Um .zip com um único arquivo (sem dependências). */
export function zipar(nome, conteudo) {
  const dados = Buffer.from(conteudo, "utf8"), comp = zlib.deflateRawSync(dados), nb = Buffer.from(nome, "utf8"), crc = crc32(dados);
  const d = new Date(), hr = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const loc = Buffer.alloc(30);
  loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(8, 8); loc.writeUInt16LE(hr, 10); loc.writeUInt16LE(dt, 12);
  loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dados.length, 22); loc.writeUInt16LE(nb.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(hr, 12); cen.writeUInt16LE(dt, 14);
  cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(nb.length, 28);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(1, 8); fim.writeUInt16LE(1, 10); fim.writeUInt32LE(cen.length + nb.length, 12); fim.writeUInt32LE(loc.length + nb.length + comp.length, 16);
  return Buffer.concat([loc, nb, comp, cen, nb, fim]);
}
