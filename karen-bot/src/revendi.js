// Sincronização Revendi → Firebase (ti/base/crediario). SÓ LEITURA no Revendi.
// O suporte do Revendi (19/11/2026): não há API pública; usa-se a API do próprio sistema com o
// login da conta (e-mail e senha), que devolve um token e um refresh token. O token precisa ser
// renovado com o refresh token para a conexão não cair. O suporte vai mandar um repositório de
// exemplo; com ele, completar as rotas marcadas com A COMPLETAR.
// E-mail e senha ficam SÓ no .env do PC (REVENDI_EMAIL / REVENDI_SENHA). Nada disso vai para o GitHub.
// Enquanto REVENDI_ATIVO não for "sim", nada aqui roda.
import fs from "node:fs";
import path from "node:path";
import * as db from "./firestore.js";

const ATIVO = String(process.env.REVENDI_ATIVO || "").toLowerCase() === "sim";
const BASE_URL = String(process.env.REVENDI_API_URL || "").replace(/\/$/, "");
const EMAIL = process.env.REVENDI_EMAIL || "";
const SENHA = process.env.REVENDI_SENHA || "";
const INTERVALO = Math.max(10, Number(process.env.REVENDI_MINUTOS || 30)) * 60000;
const ARQ_TOKEN = path.join(process.env.KAREN_BOT_DATA || path.resolve("dados"), "revendi-token.json");
let ultima = 0, ultimoErro = "";
let sessao = (() => { try { return JSON.parse(fs.readFileSync(ARQ_TOKEN, "utf8")); } catch { return { token: "", refresh: "", expira: 0 }; } })();
const guardarSessao = () => { try { fs.writeFileSync(ARQ_TOKEN, JSON.stringify(sessao)); } catch {} };

export const revendiAtivo = () => ATIVO && Boolean(BASE_URL && EMAIL && SENHA);
export const estadoRevendi = () => ({ ativo: revendiAtivo(), ultima: ultima ? new Date(ultima).toISOString() : "", ultimoErro });

// A COMPLETAR (repositório do suporte): rotas e nomes dos campos de login e de renovação.
const ROTA_LOGIN = process.env.REVENDI_ROTA_LOGIN || "/auth/login";
const ROTA_REFRESH = process.env.REVENDI_ROTA_REFRESH || "/auth/refresh";
function lerSessao(d) {
  const token = d.token || d.accessToken || d.access_token || d.data?.token || "";
  const refresh = d.refreshToken || d.refresh_token || d.data?.refreshToken || sessao.refresh || "";
  const segundos = Number(d.expiresIn || d.expires_in || 3600);
  if (!token) throw new Error("o Revendi não devolveu token no login");
  sessao = { token, refresh, expira: Date.now() + segundos * 1000 };
  guardarSessao();
}
async function post(rota, corpo) {
  const r = await fetch(BASE_URL + rota, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`Revendi ${rota}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function garantirToken() {
  if (sessao.token && Date.now() < sessao.expira - 120000) return sessao.token;
  if (sessao.refresh) {
    try { lerSessao(await post(ROTA_REFRESH, { refreshToken: sessao.refresh })); return sessao.token; } catch { /* refresh vencido: faz login de novo */ }
  }
  lerSessao(await post(ROTA_LOGIN, { email: EMAIL, password: SENHA }));
  return sessao.token;
}
async function chamar(caminho, tentouDeNovo = false) {
  const r = await fetch(BASE_URL + caminho, { headers: { accept: "application/json", authorization: "Bearer " + (await garantirToken()) } });
  if (r.status === 401 && !tentouDeNovo) { sessao.expira = 0; return chamar(caminho, true); }
  if (!r.ok) throw new Error(`Revendi ${caminho}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/**
 * Devolve as parcelas do crediário no formato do crediario.js.
 * A COMPLETAR com a documentação do Revendi (endpoint de vendas/parcelas a receber).
 */
async function buscarParcelas() {
  void chamar;
  throw new Error("integração com o Revendi ainda não configurada (aguardando a documentação da API)");
}

/** Roda no ciclo do bot; respeita o intervalo e grava só o que mudou. */
export async function sincronizarRevendi(log) {
  if (!revendiAtivo() || Date.now() - ultima < INTERVALO) return false;
  ultima = Date.now();
  try {
    const parcelas = await buscarParcelas();
    const atuais = new Map((await db.listar("crediario")).map((p) => [p.id, p]));
    let gravadas = 0;
    for (const p of parcelas) {
      const id = "rv-" + String(p.revendiId).replace(/[^\w-]/g, "_");
      const a = atuais.get(id);
      const campos = { cliente: p.cliente || "", whatsapp: String(p.whatsapp || ""), venda: String(p.venda || ""), numero: Number(p.numero) || 1,
        total: Number(p.total) || 1, valor: Number(p.valor) || 0, vencimento: p.vencimento || "", pagoEm: p.pagoEm || "", origem: "revendi", revendiId: String(p.revendiId) };
      if (a && Object.keys(campos).every((k) => String(a[k] ?? "") === String(campos[k]))) continue;
      await db.definir("crediario", id, { ...campos, sincronizadoEm: new Date().toISOString() });
      gravadas++;
    }
    ultimoErro = "";
    if (gravadas) log(`Revendi: ${gravadas} parcela(s) atualizada(s)`);
    return gravadas > 0;
  } catch (e) {
    if (ultimoErro !== e.message) log("Revendi: " + e.message);
    ultimoErro = e.message;
    return false;
  }
}
