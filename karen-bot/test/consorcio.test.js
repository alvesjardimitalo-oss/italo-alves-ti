import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/consorcio.js";

test("meses e término do grupo", () => {
  const g = { codigo: "G5", valorParcela: 50, parcelas: 11, inicio: "2026-06" };
  assert.equal(C.fimDo(g), "2027-04");
  assert.equal(C.mesesDo(g).length, 11);
  assert.equal(C.somarMes("2026-12", 1), "2027-01");
});

test("atrasos e quitação", () => {
  const atual = C.mesAtual();
  const g = { codigo: "GX", valorParcela: 35, parcelas: 3, inicio: C.somarMes(atual, -2), vencimento: 1, membros: [] };
  const [m1, m2] = C.mesesDo(g);
  const membro = { id: "a", nome: "Ana Souza", pagos: { [m1]: "2026-01-01" } };
  const r = C.resumoMembro(g, membro);
  assert.equal(r.pagas, 1);
  assert.ok(r.atrasadas.includes(m2));
  assert.equal(C.situacao(g), "andamento");
});

test("situação pelo calendário", () => {
  const atual = C.mesAtual();
  assert.equal(C.situacao({ inicio: C.somarMes(atual, 1), parcelas: 10 }), "formando");
  assert.equal(C.situacao({ inicio: C.somarMes(atual, -20), parcelas: 10 }), "encerrado");
});

test("textos e links", () => {
  assert.equal(C.fone("5533999628147"), "(33) 99962-8147");
  assert.ok(C.linkWhats("33999628147", "oi").startsWith("https://wa.me/5533999628147?text="));
  assert.equal(C.semMarcas("Pedido X [vagas:1,2] [seg:abc]"), "Pedido X");
  const g = { codigo: "G4", valorParcela: 35, parcelas: 10, inicio: "2026-05" };
  assert.match(C.mensagemCobranca(g, { nome: "Maria Anita" }, ["2026-10", "2026-11"]), /Maria! .*Outubro 2026, Novembro 2026, total de R\$\s70,00/);
  assert.match(C.mensagemRenovacao(g, { nome: "Neuza" }), /\?g=G4$/);
});

test("lembrete, vencimento e dados públicos", () => {
  const g = { codigo: "G6", valorParcela: 50, parcelas: 10, inicio: "2027-01", vencimento: 31, membros: [{ id: "a", nome: "Ana", whatsapp: "5533999999999" }] };
  assert.equal(C.diaVencimento(g, 2027, 2), 28);
  assert.match(C.mensagemLembrete(g, { nome: "Ana Paula" }, "2027-02"), /Ana! .*Fevereiro 2027.*vence dia 31/);
  const [p] = C.gruposPublicos([g]);
  assert.equal(p.fim, "2027-10");
  assert.equal(p.ocupadas, 1);
  assert.ok(!JSON.stringify(p).includes("5533999999999"));
  assert.equal(C.chaveTel("+55 (33) 99999-9999"), "33999999999");
  assert.ok(C.agoraSP().diaSemana >= 0 && C.agoraSP().diaSemana <= 6);
});
