import { test } from "node:test";
import assert from "node:assert/strict";
import * as CR from "../src/crediario.js";

const hoje = CR.hojeISO();
const dia = (n) => new Date(Date.parse(hoje + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const P = [
  { cliente: "Ana Souza", whatsapp: "5533999990001", venda: "V1", numero: 1, total: 3, valor: 40, vencimento: dia(-5), pagoEm: "" },
  { cliente: "Ana Souza", whatsapp: "5533999990001", venda: "V1", numero: 2, total: 3, valor: 40, vencimento: hoje, pagoEm: "" },
  { cliente: "Ana Souza", whatsapp: "5533999990001", venda: "V1", numero: 3, total: 3, valor: 40, vencimento: dia(25), pagoEm: "" },
  { cliente: "Bia", whatsapp: "33988887777", venda: "V2", numero: 1, total: 1, valor: 99.9, vencimento: dia(3), pagoEm: "" },
  { cliente: "Bia", whatsapp: "33988887777", venda: "V0", numero: 1, total: 1, valor: 10, vencimento: dia(-30), pagoEm: dia(-29) },
];
test("resumo do crediário", () => {
  const r = CR.resumo(P);
  assert.equal(r.hoje, 40); assert.equal(r.atraso, 40); assert.equal(r.clientesAtraso, 1);
  assert.equal(Math.round(r.semana * 100), 9990); assert.equal(Math.round(r.aReceber * 100), 21990);
});
test("agrupa por cliente e monta cobrança", () => {
  const cs = CR.porCliente(P);
  const ana = cs.find((c) => c.cliente === "Ana Souza");
  assert.equal(ana.abertas.length, 3); assert.equal(ana.atrasadas.length, 1); assert.equal(ana.emAtraso, 40);
  assert.match(CR.mensagemCrediario(ana, ana.atrasadas), /Ana! .*lembrar, com carinho.*1\/3 de R\$\s40,00/);
});
