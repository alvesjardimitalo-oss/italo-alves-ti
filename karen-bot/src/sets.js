// "Set" das clientes no Discord: confere o WhatsApp com o Revendi e com os grupos do consórcio e decide
// cargos e apelido. [CLIENTE] - Nome para cliente; [G3] - Nome para quem está num grupo em vigência
// (o cargo do grupo é removido quando o grupo termina e a pessoa volta a [CLIENTE]).
import * as C from "./consorcio.js";

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const sem = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Grupos (código) em vigência em que esse WhatsApp está, pelo painel do consórcio. */
export function gruposDoTelefone(grupos, whats) {
  const k = C.chaveTel(whats);
  if (!k) return [];
  return [...new Set(grupos.filter((g) => C.situacao(g) !== "encerrado" && (g.membros || []).some((m) => C.chaveTel(m.whatsapp) === k))
    .map((g) => String(g.codigo).toUpperCase()))].sort(ordemCodigo);
}

/** Grupos em vigência pelas etiquetas do Revendi: "Consorcio G1 - 35,00 - Julho 2025 a Abril 2026". */
export function gruposDasEtiquetas(etiquetas, ymHoje) {
  const out = [];
  for (const e of etiquetas || []) {
    const t = sem(e);
    const m = t.match(/consorcio\s*(g\s*\d+)/);
    if (!m) continue;
    const fim = t.match(/a\s+([a-zç]+)\s*(?:\/|de\s+)?(\d{4})\s*$/);
    if (fim && MESES[fim[1]]) {
      const ymFim = `${fim[2]}-${String(MESES[fim[1]]).padStart(2, "0")}`;
      if (ymHoje > ymFim) continue;
    }
    out.push(m[1].replace(/\s+/g, "").toUpperCase());
  }
  return [...new Set(out)].sort(ordemCodigo);
}
const ordemCodigo = (a, b) => (Number(a.replace(/\D/g, "")) || 0) - (Number(b.replace(/\D/g, "")) || 0) || a.localeCompare(b);

/** Apelido do Discord (máx. 32): "[G3] - Juscelia Matos Fernandes". Encurta o nome se precisar. */
export function apelido(codigos, nome) {
  const tag = `[${codigos.length ? codigos.join("/") : "CLIENTE"}] - `;
  const limpo = String(nome || "").replace(/\s+/g, " ").trim();
  const cabe = (n) => (tag + n).length <= 32;
  if (cabe(limpo)) return tag + limpo;
  const p = limpo.split(" ");
  const curto = p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0];
  if (cabe(curto)) return tag + curto;
  return (tag + curto).slice(0, 32);
}

/** Procura a cliente no Revendi pelo WhatsApp (e, sem WhatsApp, por nome igual). */
export function acharNoRevendi(clientes, whats, nome) {
  const k = C.chaveTel(whats);
  if (k) { const c = clientes.find((x) => C.chaveTel(x.whatsapp) === k); if (c) return c; }
  const n = sem(nome).trim();
  return n.split(" ").length >= 2 ? clientes.find((x) => sem(x.nome).trim() === n) || null : null;
}
