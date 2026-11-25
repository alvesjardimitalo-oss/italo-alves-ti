// Regras de negócio calculadas a partir dos dados em memória.
import { store } from './store.js';
import { round2, situacaoPagamento, norm, STATUS_OS_ABERTO } from './util.js';
import { idRastreio } from './rastreio-hash.js';
import { pixPayload } from './pix.js';

export const pagamentosDo = (orcId) => store.lista('pagamentos').filter((p) => p.orcamentoId === orcId)
  .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.numero || 0) - (b.numero || 0));
export const pagoDo = (orcId) => round2(pagamentosDo(orcId).reduce((s, p) => s + (Number(p.valor) || 0), 0));
export const saldoDo = (orc) => Math.max(0, round2((Number(orc.total) || 0) - pagoDo(orc.id)));
export const situacaoDo = (orc) => situacaoPagamento(Number(orc.total) || 0, pagoDo(orc.id));

export const orcamentosDaOS = (osId) => store.lista('orcamentos').filter((o) => o.osId === osId).sort((a, b) => (b.numero || 0) - (a.numero || 0));
export const osDoCliente = (cliId) => store.lista('os').filter((o) => o.clienteId === cliId).sort((a, b) => (b.numero || 0) - (a.numero || 0));
export const notasDoOrcamento = (orcId) => store.lista('notas').filter((n) => n.orcamentoId === orcId && !n.cancelada);

export const subtotalItens = (itens = []) => round2(itens.reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valor) || 0), 0));

export function clientesOrdenados() {
  return store.lista('clientes').sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}
export const osAbertas = () => store.lista('os').filter((o) => STATUS_OS_ABERTO.includes(o.status));

export function aReceber() {
  return store.lista('orcamentos')
    .filter((o) => o.status === 'Aprovado' && saldoDo(o) > 0.004)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}

export function empresa() {
  const c = store.config || {};
  return {
    nome: c.nome || 'Ítalo InfoTec',
    documento: c.documento || '',
    endereco: c.endereco || 'Rua Agostinho Moreira de Lima, nº 45, Planalto',
    cidade: c.cidade || 'Frei Inocêncio',
    uf: c.uf || 'MG',
    cep: c.cep || '35112-000',
    telefone: c.telefone || '33998556503',
    email: c.email || 'alvesjardim.italo@gmail.com',
    rodape: c.rodape ?? '"Feliz é a nação cujo Deus é o Senhor."',
    garantiaDias: Number(c.garantiaDias ?? 90),
    validadeDias: Number(c.validadeDias ?? 15),
    condicoes: c.condicoes || '',
    termosEntrada: c.termosEntrada || 'O equipamento passará por análise técnica e o orçamento será informado antes de qualquer serviço.\nRecomenda-se manter cópia dos seus arquivos; não nos responsabilizamos por dados já corrompidos ou perdidos em razão do defeito.\nA retirada será feita mediante apresentação deste comprovante ou documento do titular.',
    pixChave: c.pixChave || '',
    pixNome: c.pixNome || 'ITALO ALVES',
    pixCidade: c.pixCidade || 'FREI INOCENCIO',
    bobinaColunas: Number(c.bobinaColunas || 48),
  };
}

/** Busca global: clientes, OS, orçamentos, notas */
export function buscar(termo) {
  const t = norm(termo).trim();
  if (t.length < 2) return [];
  const dig = t.replace(/\D/g, '');
  const res = [];
  store.lista('clientes').forEach((c) => {
    if (norm(c.nome).includes(t) || (dig.length >= 3 && ((c.documento || '').includes(dig) || (c.telefone || '').includes(dig)))) {
      res.push({ tipo: 'Cliente', titulo: c.nome, sub: c.telefone || '', href: '#/clientes/' + c.id, ico: 'users' });
    }
  });
  store.lista('os').forEach((o) => {
    if (norm(o.codigo).includes(t) || norm(o.equipamento + ' ' + (o.marca || '') + ' ' + (o.modelo || '')).includes(t) || norm(o.serie).includes(t) || norm(o.clienteNome).includes(t)) {
      res.push({ tipo: 'OS', titulo: `${o.codigo} · ${o.equipamento} ${o.marca || ''}`, sub: o.clienteNome, href: '#/os/' + o.id, ico: 'os' });
    }
  });
  store.lista('orcamentos').forEach((o) => {
    if (String(o.numero) === t.replace('#', '') || norm(o.clienteNome).includes(t)) {
      res.push({ tipo: 'Orçamento', titulo: `Orçamento #${o.numero} · ${o.clienteNome}`, sub: o.status, href: '#/orcamentos/' + o.id, ico: 'orcamento' });
    }
  });
  store.lista('notas').forEach((n) => {
    if (String(n.numero) === t.replace(/\D/g, '') || norm(n.cliente?.nome).includes(t)) {
      res.push({ tipo: 'Nota', titulo: `Nota ${String(n.numero).padStart(5, '0')} · ${n.cliente?.nome || ''}`, sub: n.cancelada ? 'cancelada' : '', href: '#/notas/' + n.id, ico: 'nota' });
    }
  });
  return res.slice(0, 12);
}

/** Publica (ou atualiza) o status público da OS para a página "Acompanhar OS" do site. */
export async function publicarRastreio(osId) {
  let os = store.get('os', osId);
  for (let t = 0; !os && t < 5; t++) { await new Promise((r) => setTimeout(r, 400)); os = store.get('os', osId); }
  if (!os || !os.codigo) return;
  const id = await idRastreio(os.codigo, os.clienteTelefone);
  if (os.rastreioId && os.rastreioId !== id) await store.apagarDoc('rastreio', os.rastreioId).catch(() => {});
  if (!id) return;
  const orc = orcamentosDaOS(osId).find((o) => o.status !== 'Cancelado');
  const documentos = documentosPublicos(os);
  await store.definir('rastreio', id, {
    codigo: os.codigo,
    equipamento: [os.equipamento, os.marca].filter(Boolean).join(' '),
    status: os.status,
    entrada: os.entrada || '',
    saida: os.saida || '',
    recado: os.recado || '',
    orcamento: orc ? { numero: orc.numero, status: orc.status, total: orc.total } : null,
    documentos,
    atualizadoEm: new Date().toISOString(),
  });
  if (os.rastreioId !== id) await store.atualizar('os', osId, { rastreioId: id }, { semGatilho: true });
}

/* Documentos que o cliente vê no "Acompanhar OS": comprovante de entrada,
   orçamentos, notas de serviço e recibos. Ficam no mesmo documento público do
   rastreio (que só abre com código da OS + telefone) e levam SÓ o que é do
   serviço: nada de nome, CPF, telefone ou endereço do cliente. */
const itensPublicos = (itens = []) => itens.map((i) => ({
  descricao: String(i.descricao || ''), tipo: String(i.tipo || ''), qtd: Number(i.qtd) || 0, valor: Number(i.valor) || 0,
}));
function pixPublico(valor, txid) {
  const e = empresa();
  if (!(valor > 0.004)) return '';
  return pixPayload({ chave: e.pixChave, nome: e.pixNome, cidade: e.pixCidade, valor, txid }) || '';
}
function somaDiasISO(iso, dias) {
  if (!iso || !dias) return '';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().slice(0, 10);
}
export function documentosPublicos(os) {
  const e = empresa();
  const orcs = orcamentosDaOS(os.id).filter((o) => o.status !== 'Cancelado');
  const orcamentos = orcs.map((o) => {
    const pago = pagoDo(o.id);
    const saldo = Math.max(0, round2((Number(o.total) || 0) - pago));
    return {
      numero: o.numero, data: o.data || '', status: o.status || '',
      validade: o.validadeDias ? somaDiasISO(o.data, o.validadeDias) : '',
      itens: itensPublicos(o.itens), subtotal: Number(o.subtotal) || 0, desconto: Number(o.desconto) || 0,
      total: Number(o.total) || 0, pago, saldo, obs: o.obs || '', diagnostico: os.laudo || '',
      pix: o.status === 'Aprovado' ? pixPublico(saldo, 'ORC' + o.numero) : '',
    };
  });
  const idsOrc = new Set(orcs.map((o) => o.id));
  const notas = store.lista('notas').filter((n) => n.osId === os.id || idsOrc.has(n.orcamentoId))
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .map((n) => ({
      numero: n.numero, emitidaEm: n.emitidaEm || '', conclusao: n.conclusao || '', orcamentoNumero: n.orcamentoNumero || '',
      cancelada: !!n.cancelada, motivoCancelamento: n.cancelada ? (n.motivoCancelamento || '') : '',
      itens: itensPublicos(n.itens), subtotal: Number(n.subtotal) || 0, desconto: Number(n.desconto) || 0,
      total: Number(n.total) || 0, pago: Number(n.pago) || 0, saldo: Number(n.saldo) || 0,
      pagamentos: (n.pagamentos || []).map((p) => ({ data: p.data || '', forma: p.forma || '', valor: Number(p.valor) || 0 })),
      garantiaDias: Number(n.garantiaDias) || 0, garantiaAte: n.garantiaAte || '', servico: n.equipamento?.laudo || '',
      pix: !n.cancelada ? pixPublico(Number(n.saldo) || 0, 'NS' + n.numero) : '',
    }));
  const recibos = orcs.flatMap((o) => pagamentosDo(o.id).map((p) => ({
    numero: p.numero, data: p.data || '', forma: p.forma || '', valor: Number(p.valor) || 0, orcamentoNumero: o.numero,
  })));
  return {
    empresa: { nome: e.nome, documento: e.documento, endereco: e.endereco, cidade: e.cidade, uf: e.uf, telefone: e.telefone, email: e.email, rodape: e.rodape },
    entrada: {
      codigo: os.codigo, data: os.entrada || '',
      equipamento: [os.equipamento || os.tipo, os.marca, os.modelo].filter(Boolean).join(' '),
      serie: os.serie || '', acessorios: os.acessorios || '', defeito: os.defeito || '',
    },
    orcamentos, notas, recibos,
  };
}

/** Link público para o cliente acompanhar a OS. */
export function linkAcompanhar(codigo) {
  return new URL('acompanhar.html?os=' + encodeURIComponent(codigo), location.href.split('#')[0].replace(/[^/]*$/, '')).href.replace(/\?demo&?/, '?');
}

/** Clientes cuja última OS foi entregue há 11 meses ou mais (lembrete de manutenção preventiva). */
export function lembretesManutencao() {
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 11);
  const lim = limite.toISOString().slice(0, 10);
  const porCliente = {};
  store.lista('os').forEach((o) => {
    const atual = porCliente[o.clienteId];
    if (!atual || (o.entrada || '') > (atual.entrada || '')) porCliente[o.clienteId] = o;
  });
  return Object.values(porCliente)
    .filter((o) => o.status === 'Entregue' && (o.saida || o.entrada || '') <= lim && !(o.lembreteEm && o.lembreteEm.slice(0, 10) > lim))
    .sort((a, b) => (a.saida || a.entrada || '').localeCompare(b.saida || b.entrada || ''));
}
