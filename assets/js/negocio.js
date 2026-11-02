// Regras de negócio calculadas a partir dos dados em memória.
import { store } from './store.js';
import { round2, situacaoPagamento, norm, STATUS_OS_ABERTO } from './util.js';

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
    nome: c.nome || 'Ítalo Alves TI',
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
