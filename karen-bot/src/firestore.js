// Acesso ao Firestore do projeto high-os pela API REST, com a conta de serviço do .env.
// Mesmo método do bot do High OS (sem dependências extras). A conta de serviço ignora as
// regras do Firestore, então este arquivo só toca em ti/base/leads, ti/base/consorcios e
// ti/base/botKaren.
import { createSign } from "node:crypto";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "high-os";
const RAW = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.HIGH_OS_FIREBASE_SERVICE_ACCOUNT_JSON || "";
const DOCS = `projects/${PROJECT_ID}/databases/(default)/documents`;
const API = `https://firestore.googleapis.com/v1/${DOCS}`;
export const BASE = "ti/base";

let cache = { token: "", expira: 0 };

function conta() {
  try {
    const j = JSON.parse(RAW);
    return j.client_email && j.private_key ? j : null;
  } catch { return null; }
}
export const firestoreConfigurado = () => Boolean(conta());

async function token() {
  if (cache.token && Date.now() < cache.expira - 60000) return cache.token;
  const sa = conta();
  if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON ausente ou inválido no .env.");
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const semAssinatura = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
  });
  const s = createSign("RSA-SHA256"); s.update(semAssinatura); s.end();
  const assertion = semAssinatura + "." + s.sign(sa.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) throw new Error("Login no Firebase falhou: " + r.status + " " + (await r.text()));
  const d = await r.json();
  cache = { token: d.access_token, expira: Date.now() + Number(d.expires_in || 3600) * 1000 };
  return cache.token;
}

async function chamar(url, opcoes = {}) {
  const r = await fetch(url, { ...opcoes, headers: { authorization: "Bearer " + (await token()), "content-type": "application/json", ...(opcoes.headers || {}) } });
  if (r.status === 404 && (opcoes.method || "GET") === "GET") return null;
  if (!r.ok) {
    const erro = new Error("Firestore " + (opcoes.method || "GET") + " " + r.status + ": " + (await r.text()).slice(0, 300));
    erro.status = r.status;
    throw erro;
  }
  return r.status === 204 ? null : r.json();
}

// ---------- Conversão de valores ----------
function ler(v) {
  if (!v || typeof v !== "object") return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(ler);
  if ("mapValue" in v) return lerCampos(v.mapValue.fields || {});
  return null;
}
const lerCampos = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, ler(v)]));
function gravar(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(gravar) } };
  if (typeof v === "object") return { mapValue: { fields: gravarCampos(v) } };
  return { stringValue: String(v) };
}
const gravarCampos = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, gravar(v)]));
const doc = (d) => ({ id: decodeURIComponent(d.name.split("/").pop()), _atualizado: d.updateTime, ...lerCampos(d.fields || {}) });

// ---------- Operações ----------
export async function listar(colecao) {
  const out = [];
  let pagina = "";
  do {
    const q = new URLSearchParams({ pageSize: "300" });
    if (pagina) q.set("pageToken", pagina);
    const d = await chamar(`${API}/${BASE}/${colecao}?${q}`);
    (d?.documents || []).forEach((x) => out.push(doc(x)));
    pagina = d?.nextPageToken || "";
  } while (pagina);
  return out;
}

export async function obter(colecao, id) {
  const d = await chamar(`${API}/${BASE}/${colecao}/${encodeURIComponent(id)}`);
  return d ? doc(d) : null;
}

/** Atualiza só os campos informados. `versao` (updateTime lido) evita sobrescrever mudança do painel. */
export async function atualizar(colecao, id, campos, versao) {
  const q = new URLSearchParams();
  Object.keys(campos).forEach((k) => q.append("updateMask.fieldPaths", k));
  if (versao) q.set("currentDocument.updateTime", versao); else q.set("currentDocument.exists", "true");
  const d = await chamar(`${API}/${BASE}/${colecao}/${encodeURIComponent(id)}?${q}`, { method: "PATCH", body: JSON.stringify({ fields: gravarCampos(campos) }) });
  return doc(d);
}

/** Grava (cria ou substitui os campos informados) um documento de controle do bot. */
export async function definir(colecao, id, campos) {
  const q = new URLSearchParams();
  Object.keys(campos).forEach((k) => q.append("updateMask.fieldPaths", k));
  await chamar(`${API}/${BASE}/${colecao}/${encodeURIComponent(id)}?${q}`, { method: "PATCH", body: JSON.stringify({ fields: gravarCampos(campos) }) });
}

/** Leads criados depois de `desdeISO` (índice simples de criadoEm, sem índice composto). */
export async function leadsDesde(desdeISO, limite = 200) {
  const corpo = {
    structuredQuery: {
      from: [{ collectionId: "leads" }],
      where: { fieldFilter: { field: { fieldPath: "criadoEm" }, op: "GREATER_THAN", value: { timestampValue: desdeISO } } },
      orderBy: [{ field: { fieldPath: "criadoEm" }, direction: "ASCENDING" }],
      limit: limite,
    },
  };
  const r = await chamar(`${API}/${BASE}:runQuery`, { method: "POST", body: JSON.stringify(corpo) });
  return (r || []).filter((x) => x.document).map((x) => doc(x.document));
}

/** Lê, altera e grava com conferência de versão; tenta de novo se o painel mexeu no meio. */
export async function alterarConsorcio(id, alterar, tentativas = 4) {
  for (let i = 0; i < tentativas; i++) {
    const atual = await obter("consorcios", id);
    if (!atual) throw new Error("grupo não encontrado");
    const membros = alterar(structuredClone(atual.membros || []), atual);
    if (!membros) return atual;
    try { return await atualizar("consorcios", id, { membros, atualizadoEm: new Date().toISOString(), atualizadoPor: "bot-discord" }, atual._atualizado); }
    catch (e) { if (e.status !== 400 && e.status !== 409 && e.status !== 412) throw e; }
  }
  throw new Error("o grupo foi alterado ao mesmo tempo no painel; tente de novo");
}
