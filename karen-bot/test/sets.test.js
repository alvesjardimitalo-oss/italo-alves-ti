import { test } from "node:test";
import assert from "node:assert/strict";
const S = await import("../src/sets.js");

test("apelido com tag e limite de 32", () => {
  assert.equal(S.apelido(["G3"], "Juscelia Matos Fernandes"), "[G3] - Juscelia Matos Fernandes");
  assert.equal(S.apelido([], "Ana Paula"), "[CLIENTE] - Ana Paula");
  assert.equal(S.apelido(["G1", "G3"], "Maria Aparecida dos Santos Oliveira"), "[G1/G3] - Maria Oliveira");
  assert.ok(S.apelido([], "Nome Gigantesco Demais Para Caber Aqui").length <= 32);
});

test("grupos pelas etiquetas do Revendi respeitam a vigência", () => {
  const et = ["Consorcio G1 - 35,00 - Julho 2025 a Abril 2026", "Consorcio G3 - 50,00 - Março 2026 a Dezembro 2026", "VIP"];
  assert.deepEqual(S.gruposDasEtiquetas(et, "2026-11"), ["G3"]);
  assert.deepEqual(S.gruposDasEtiquetas(et, "2026-03"), ["G1", "G3"]);
});

test("grupos pelo painel do consórcio (só em vigência)", () => {
  const grupos = [
    { codigo: "G3", inicio: "2026-03", parcelas: 10, membros: [{ whatsapp: "(33) 99999-0001" }] },
    { codigo: "G1", inicio: "2025-01", parcelas: 5, membros: [{ whatsapp: "33999990001" }] },
  ];
  assert.deepEqual(S.gruposDoTelefone(grupos, "5533999990001"), ["G3"]);
});

test("acha no Revendi por WhatsApp ou nome completo", () => {
  const cl = [{ nome: "Juscelia Matos Fernandes", whatsapp: "5533999990001" }];
  assert.equal(S.acharNoRevendi(cl, "33 99999-0001", "").nome, "Juscelia Matos Fernandes");
  assert.equal(S.acharNoRevendi(cl, "", "Juscélia Matos Fernandes").nome, "Juscelia Matos Fernandes");
  assert.equal(S.acharNoRevendi(cl, "", "Juscelia"), null);
});

test("níveis por valor comprado", () => {
  assert.equal(S.nivel(0).atual, null); assert.equal(S.nivel(0).proximo.chave, "bronze"); assert.equal(S.nivel(0).faltam, 300);
  assert.equal(S.nivel(850.9).atual.chave, "prata"); assert.equal(S.nivel(850.9).faltam, 650);
  assert.equal(S.nivel(5000).atual.chave, "ouro"); assert.equal(S.nivel(5000).proximo, null);
});
test("dia de vencimento respeita o fim do mês", () => {
  assert.equal(S.diaVencimento("2026-02", 30), "2026-02-28");
  assert.equal(S.diaVencimento("2026-11", 10), "2026-11-10");
});
