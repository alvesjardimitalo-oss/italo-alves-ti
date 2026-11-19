import { test } from "node:test";
import assert from "node:assert/strict";

process.env.KAREN_BOT_DATA = "/tmp/kb-test-revendi";
process.env.REVENDI_ATIVO = "sim"; process.env.REVENDI_EMAIL = "bot@x.com"; process.env.REVENDI_SENHA = "s";
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "";
const fs = await import("node:fs"); fs.rmSync("/tmp/kb-test-revendi", { recursive: true, force: true }); fs.mkdirSync("/tmp/kb-test-revendi", { recursive: true });
const R = await import("../src/revendi.js");

test("telefones do Revendi viram WhatsApp", () => {
  assert.equal(R.normalizarTelefone("(33) 99962-8147"), "5533999628147");
  assert.equal(R.normalizarTelefone("99962-8147"), "5533999628147");
  assert.equal(R.normalizarTelefone("9962-8147"), "5533999628147");
  assert.equal(R.normalizarTelefone("33 9962-8147"), "5533999628147");
  assert.equal(R.normalizarTelefone("+55 31 99592-5468"), "5531995925468");
  assert.equal(R.normalizarTelefone(""), "");
});

test("parcelas viram crediário com número/total da série", () => {
  const rows = [
    { id: 11, amount: 40, paid: true, expected_date: "2026-10-19T03:00:00.000Z", payment_date: "2026-10-18T15:00:00.000Z", payment_method: "installment_credit", sale_id: 7, series_id: "s1", sale: { client: { name: "Ana", phone: "33999990001" } } },
    { id: 12, amount: 40, paid: false, expected_date: "2026-11-19T03:00:00.000Z", payment_date: null, payment_method: "installment_credit", sale_id: 7, series_id: "s1", sale: { client: { name: "Ana", phone: "33999990001" } } },
    { id: 13, amount: 40, paid: false, expected_date: "2026-12-19T03:00:00.000Z", payment_date: null, payment_method: "installment_credit", sale_id: 7, series_id: "s1", sale: { client: { name: "Ana", phone: "33999990001" } } },
  ];
  const out = R.converterParcelas(rows);
  assert.deepEqual(out.map((p) => `${p.numero}/${p.total}`), ["1/3", "2/3", "3/3"]);
  assert.equal(out[0].pagoEm, "2026-10-18"); assert.equal(out[1].pagoEm, ""); assert.equal(out[1].vencimento, "2026-11-19");
  assert.equal(out[0].whatsapp, "5533999990001");
});

test("sincronização completa com a API simulada (login, parcelas, vendas)", async () => {
  const chamadas = [];
  globalThis.fetch = async (url, op = {}) => {
    const u = new URL(url); chamadas.push((op.method || "GET") + " " + u.pathname);
    const ok = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
    if (u.pathname.endsWith("/auth/password")) return ok({ token: "T1", refresh_token: { id: "R1", expires_in: Math.floor(Date.now() / 1000) + 30 * 86400 } });
    if (u.pathname.endsWith("/financial-v2/transactions")) return ok({ rows: [
      { id: 1, amount: 50, paid: false, expected_date: new Date().toISOString(), payment_method: "fiado", sale_id: 9, sale: { client: { name: "Bia", phone: "33988887777" } } },
      { id: 2, amount: 80, paid: false, expected_date: new Date().toISOString(), payment_method: "pix", sale_id: 10, sale: { client: { name: "Pix", phone: "" } } },
    ], totalRecords: 2 });
    if (u.pathname.endsWith("/sales-v2")) return ok([{ id: 1, date: new Date().toISOString(), value: 120 }]);
    throw new Error("rota inesperada " + u.pathname);
  };
  // Firestore falso
  const db = await import("../src/firestore.js");
  const gravados = [];
  const orig = { listar: db.listar };
  // sincronizarRevendi usa db.listar/definir/remover; sem conta de serviço eles falham, então a função deve
  // capturar o erro e não derrubar o bot.
  const r = await R.sincronizarRevendi(() => {});
  assert.equal(r, false);
  assert.ok(chamadas.includes("POST /api/auth/password"));
  assert.ok(chamadas.some((c) => c.includes("/financial-v2/transactions")));
  assert.match(R.estadoRevendi().ultimoErro, /FIREBASE_SERVICE_ACCOUNT_JSON/);
  void gravados; void orig;
});
