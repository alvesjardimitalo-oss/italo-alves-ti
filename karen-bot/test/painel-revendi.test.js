import { test } from "node:test";
import assert from "node:assert/strict";

process.env.KAREN_BOT_DATA = "/tmp/kb-test-painel";
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "";
const fs = await import("node:fs"); fs.mkdirSync("/tmp/kb-test-painel", { recursive: true });
const PR = await import("../src/painel-revendi.js");
const R = await import("../src/revendi.js");

const it = (produtoId, qtd, preco, marca = "Boticário", nome = "Produto " + produtoId) => ({ produtoId, nome, marca, qtd, preco, brinde: false });
const venda = (id, data, cliente, whatsapp, valor, extra = {}) => ({ id, data, criadaEm: data + "T12:00:00Z", clienteId: "c" + cliente, cliente, whatsapp, valor, pago: valor, lucro: valor * 0.3, desconto: 0, entrega: "DONE", itens: [], ...extra });

test("converte venda, itens, cliente e produto do formato do Revendi", () => {
  const v = R.converterVenda({ id: 9, value: 150.5, paid_amount: 50, profit: 40, discount: 0, date: "2026-11-18T15:00:00.000Z", delivery_status: "PENDING",
    client_id: 3, client: { name: "Ana Souza", phone: "(33) 99962-8147" }, _count: { items: 2 }, created_at: "2026-11-18T15:00:00.000Z", updated_at: "x" },
  R.converterItens([{ product_id: 7, quantity: 2, price: 50, is_gift: false, product: { name: "Malbec", brand_sku: "89831", product_image: "https://x/7/89831.jpg", brand: { name: "O Boticário" } } }]));
  assert.equal(v.data, "2026-11-18"); assert.equal(v.whatsapp, "5533999628147"); assert.equal(v.entrega, "PENDING");
  assert.deepEqual(v.itens[0], { produtoId: "7", nome: "Malbec", marca: "O Boticário", codigo: "89831", foto: "https://x/7/89831.jpg", qtd: 2, preco: 50, brinde: false });
  assert.equal(PR.situacaoPagamento(v), "parcial");
  const c = R.converterCliente({ id: 1, name: "Bia", phone: "33999628147", birthday: "1990-05-12T00:00:00.000Z", clientTags: [{ tag: { name: "Consorcio G1" } }] });
  assert.equal(c.aniversario, "05-12"); assert.deepEqual(c.etiquetas, ["Consorcio G1"]);
  const p = R.converterProduto({ id: 4, name: "Lily", brand: { name: "Boticário" }, available_units: 2, sale_price: 199.9, nearest_expiration_date: "2027-01-10T00:00:00Z", units: [] });
  assert.equal(p.validade, "2027-01-10"); assert.equal(p.unidades, 2);
});

test("aniversariantes de hoje e da semana", () => {
  const cl = [{ id: "1", nome: "Ana", aniversario: "11-19" }, { id: "2", nome: "Bia", aniversario: "11-22" }, { id: "3", nome: "Cris", aniversario: "" }];
  assert.deepEqual(PR.aniversariantes(cl, "2026-11-19", 0).map((c) => c.nome), ["Ana"]);
  const sem = PR.aniversariantes(cl, "2026-11-19", 6);
  assert.deepEqual(sem.map((c) => [c.nome, c.emDias]), [["Ana", 0], ["Bia", 3]]);
  assert.equal(PR.aniversariantes([{ id: "x", nome: "Leap", aniversario: "02-29" }], "2027-02-28", 0).length, 1);
  assert.equal(PR.mesDia("12/05/1990"), "05-12");
});

test("entregas pendentes ordenadas por espera", () => {
  const vs = [venda("1", "2026-11-18", "Ana", "5533999990001", 50, { entrega: "PENDING" }), venda("2", "2026-11-10", "Bia", "5533999990002", 80, { entrega: "PENDING" }), venda("3", "2026-11-10", "Cris", "", 10)];
  const l = PR.entregasPendentes(vs, "2026-11-19");
  assert.deepEqual(l.map((v) => [v.id, v.esperando]), [["2", 9], ["1", 1]]);
});

test("estoque: vencendo, esgotados que vendem e parados", () => {
  const produtos = [
    { id: "a", nome: "Vence logo", marca: "B", unidades: 3, preco: 10, validade: "2026-12-01" },
    { id: "b", nome: "Esgotou", marca: "B", unidades: 0, preco: 20, validade: "" },
    { id: "c", nome: "Parado", marca: "E", unidades: 4, preco: 25, validade: "" },
    { id: "d", nome: "Gira", marca: "E", unidades: 1, preco: 30, validade: "2028-01-01" },
  ];
  const vendas = [venda("1", "2026-11-01", "Ana", "5533999990001", 50, { itens: [it("b", 2, 20), it("d", 1, 30)] })];
  const a = PR.alertasEstoque(produtos, vendas, "2026-11-19");
  assert.deepEqual(a.vencendo.map((p) => [p.id, p.faltam]), [["a", 12]]);
  assert.deepEqual(a.esgotados.map((p) => [p.id, p.vendidos]), [["b", 2]]);
  assert.deepEqual(a.parados.map((p) => p.id), ["c", "a"]);
  assert.equal(a.totalUnidades, 8); assert.equal(a.valorEstoque, 160);
});

test("clientes para reativar e marca favorita", () => {
  const vs = [
    venda("1", "2026-08-01", "Ana", "5533999990001", 300, { itens: [it("x", 3, 100, "Eudora")] }),
    venda("2", "2026-11-15", "Bia", "5533999990002", 100),
    venda("3", "2026-07-01", "Cris", "5533999990003", 50, { itens: [it("y", 1, 50, "Oui")] }),
    venda("4", "2025-01-01", "Velha", "5533999990004", 999),
  ];
  const l = PR.paraReativar(vs, "2026-11-19", 60);
  assert.deepEqual(l.map((h) => h.cliente), ["Ana", "Cris"]);
  assert.equal(l[0].marcaFavorita, "Eudora");
  assert.match(PR.msgReativar(l[0]), /novidades de Eudora/);
});

test("desempenho do período e comparação", () => {
  const vs = [
    venda("1", "2026-11-12", "Ana", "5533999990001", 100, { itens: [it("x", 2, 50, "Eudora", "Batom")] }),
    venda("2", "2026-11-13", "Bia", "5533999990002", 60, { pago: 0, itens: [it("y", 1, 60, "Oui", "Perfume")] }),
    venda("3", "2026-11-01", "Ana", "5533999990001", 40),
  ];
  const d = PR.desempenho(vs, "2026-11-12", "2026-11-18");
  assert.equal(d.qtd, 2); assert.equal(d.total, 160); assert.equal(d.recebido, 100); assert.equal(d.ticket, 80);
  assert.equal(d.topProdutos[0].nome, "Batom"); assert.equal(d.topMarcas[0].marca, "Eudora");
  assert.equal(d.clientesNovas, 1); // Bia é nova; Ana já tinha comprado antes
  assert.equal(PR.variacao(160, 100), "+60%"); assert.equal(PR.variacao(5, 0), "novo");
});

test("catálogo das marcas: converte produto", () => {
  const p = R.converterCatalogo({ id: 1, name: "Malbec", brand_sku: "89831", description: "Linha\n  amadeirada", product_image: "https://a/7/89831.jpg", product_image_sm: "https://a/7/89831-small.jpg", sale_price: "199.90", brand: { name: "O Boticário" } });
  assert.deepEqual(p, { id: "1", nome: "Malbec", codigo: "89831", marca: "O Boticário", descricao: "Linha amadeirada", foto: "https://a/7/89831.jpg", fotoPequena: "https://a/7/89831-small.jpg", preco: 199.9 });
});
