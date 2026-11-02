// Impressão de documentos: A4 e bobina térmica 80 mm.
// imprimir.html?t=entrada|orcamento|nota|recibo&id=...&f=a4|80
import { store } from './store.js';
import { qrSvg } from '../vendor/qrcode.js';
import { pixPayload } from './pix.js';
import {
  esc, money, dataBR, dataExtenso, formatDoc, formatFone, enderecoTexto, valorExtenso, numDoc, somaDias, round2,
} from './util.js';
import { empresa, pagamentosDo, pagoDo } from './negocio.js';

const qs = new URLSearchParams(location.search);
const tipo = qs.get('t');
const id = qs.get('id');
let formato = qs.get('f') === '80' ? '80' : 'a4';
const $ = (s) => document.querySelector(s);

const TITULOS = { entrada: 'Comprovante de entrada', orcamento: 'Orçamento', nota: 'Nota de serviço', recibo: 'Recibo' };

/* ---------------- Peças comuns ---------------- */
function cabecalho(titulo, numero, data) {
  const e = empresa();
  const contato = [e.telefone && formatFone(e.telefone), e.email].filter(Boolean).join(' · ');
  const end = [e.endereco, [e.cidade, e.uf].filter(Boolean).join('/'), e.cep && 'CEP ' + e.cep].filter(Boolean).join(' · ');
  if (formato === '80') {
    return `<header class="cab">
      <img src="assets/img/logo-print.svg" alt="" class="logo">
      <div class="emp-nome">${esc(e.nome)}</div>
      ${e.documento ? `<div class="pequeno">CNPJ/CPF ${esc(formatDoc(e.documento))}</div>` : ''}
      <div class="pequeno">${esc(end)}</div>${contato ? `<div class="pequeno">${esc(contato)}</div>` : ''}
      <div class="sep"></div>
      <div class="doc-titulo">${esc(titulo)}</div>
      <div class="doc-num">${esc(numero)}</div>${data ? `<div class="pequeno">${esc(data)}</div>` : ''}
      <div class="sep"></div></header>`;
  }
  return `<header class="cab">
    <div class="cab-esq"><img src="assets/img/logo.svg" alt="" class="logo">
      <div><div class="emp-nome">${esc(e.nome)}</div><div class="pequeno">${esc(end)}</div>
      ${contato ? `<div class="pequeno">${esc(contato)}</div>` : ''}${e.documento ? `<div class="pequeno">CNPJ/CPF ${esc(formatDoc(e.documento))}</div>` : ''}</div></div>
    <div class="cab-dir"><div class="doc-titulo">${esc(titulo)}</div><div class="doc-num">${esc(numero)}</div>${data ? `<div class="pequeno">${esc(data)}</div>` : ''}</div>
  </header>`;
}

function blocoCliente(c) {
  const linhas = [
    ['Cliente', c.nome],
    c.documento ? [c.tipoDoc || 'Doc.', formatDoc(c.documento)] : null,
    ['Telefone', formatFone(c.telefone)],
    enderecoTexto(c) ? ['Endereço', enderecoTexto(c)] : null,
  ].filter(Boolean);
  return secao('Cliente', kv(linhas));
}
function blocoEquip(e) {
  const linhas = [
    ['Equipamento', [e.equipamento || e.tipo, e.marca, e.modelo].filter(Boolean).join(' ')],
    e.serie ? ['Nº série', e.serie] : null,
    e.entrada ? ['Entrada', dataBR(e.entrada)] : null,
    e.acessorios ? ['Acessórios', e.acessorios] : null,
  ].filter(Boolean);
  return secao('Equipamento', kv(linhas));
}
const kv = (linhas) => `<dl class="kv">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '-')}</dd>`).join('')}</dl>`;
const secao = (titulo, corpo) => `<section class="secao"><h3>${esc(titulo)}</h3>${corpo}</section>`;
const texto = (titulo, t) => (t ? secao(titulo, `<div class="caixa">${esc(t)}</div>`) : '');

function tabelaItens(itens) {
  if (formato === '80') {
    return secao('Itens', `<div class="itens80">${itens.map((i) => `
      <div class="it"><div class="it-desc">${esc(i.descricao)}</div>
      <div class="it-val"><span>${i.qtd} x ${money(i.valor, false)}</span><span>${money(i.qtd * i.valor, false)}</span></div></div>`).join('')}</div>`);
  }
  return secao('Peças e serviços', `<table class="itens"><thead><tr><th>Descrição</th><th>Tipo</th><th class="c">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${itens.map((i) => `<tr><td>${esc(i.descricao)}</td><td>${esc(i.tipo)}</td><td class="c">${i.qtd}</td><td class="r">${money(i.valor)}</td><td class="r">${money(i.qtd * i.valor)}</td></tr>`).join('')}</tbody></table>`);
}

function totais(linhas) {
  return `<div class="totais">${linhas.filter(Boolean).map(([k, v, cls]) => `<div class="${cls || ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`;
}

function blocoPix(valor, txid) {
  const e = empresa();
  const payload = pixPayload({ chave: e.pixChave, nome: e.pixNome, cidade: e.pixCidade, valor, txid });
  if (!payload || valor <= 0) return '';
  const tam = formato === '80' ? 170 : 130;
  return `<section class="pix">
    <div class="pix-qr">${qrSvg(payload, { tamanho: tam })}</div>
    <div class="pix-txt"><div class="pix-tit">Pague com PIX · ${money(valor)}</div>
      <div class="pequeno">Abra o app do banco e leia o QR Code ou use o "copia e cola":</div>
      <div class="copia">${esc(payload)}</div></div></section>`;
}

function assinaturas(esq, dir) {
  return `<div class="assin">${[esq, dir].filter(Boolean).map(([nome, legenda]) => `<div><div class="linha"></div><div>${esc(nome)}</div><div class="pequeno">${esc(legenda)}</div></div>`).join('')}</div>`;
}
function rodape(extra = '') {
  const e = empresa();
  return `<footer class="rod">${extra}${e.rodape ? `<div class="frase">${esc(e.rodape)}</div>` : ''}<div class="pequeno">Emitido em ${new Date().toLocaleString('pt-BR')}</div></footer>`;
}

/* ---------------- Documentos ---------------- */
function docEntrada() {
  const os = store.get('os', id);
  if (!os) return null;
  const cli = store.get('clientes', os.clienteId) || { nome: os.clienteNome, telefone: os.clienteTelefone };
  const e = empresa();
  const termos = (e.termosEntrada || '').split('\n').map((t) => t.trim()).filter(Boolean);
  return cabecalho(TITULOS.entrada, os.codigo, 'Entrada em ' + dataBR(os.entrada))
    + blocoCliente(cli) + blocoEquip(os)
    + texto('Defeito relatado pelo cliente', os.defeito || '-')
    + (termos.length ? secao('Termos', `<ol class="termos">${termos.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`) : '')
    + assinaturas([cli.nome, 'Cliente'], [e.nome, 'Recebido em ' + dataBR(os.entrada)])
    + rodape(formato === '80' ? '<div class="pequeno forte">Apresente este comprovante na retirada.</div>' : '');
}

function docOrcamento() {
  const o = store.get('orcamentos', id);
  if (!o) return null;
  const os = store.get('os', o.osId) || {};
  const cli = store.get('clientes', o.clienteId) || { nome: o.clienteNome, telefone: o.clienteTelefone };
  const e = empresa();
  const pago = pagoDo(o.id);
  const saldo = Math.max(0, round2(o.total - pago));
  const validade = o.validadeDias ? somaDias(o.data, o.validadeDias) : '';
  const cond = [validade && `Orçamento válido até ${dataBR(validade)}.`, e.garantiaDias && `Garantia de ${e.garantiaDias} dias para os serviços executados.`, e.condicoes].filter(Boolean).join(' ');
  return cabecalho(TITULOS.orcamento, 'Nº ' + numDoc(o.numero), 'Emitido em ' + dataBR(o.data))
    + blocoCliente(cli) + blocoEquip({ ...os, equipamento: os.equipamento || o.equipamentoDesc, codigo: o.osCodigo })
    + texto('Defeito relatado', os.defeito) + texto('Diagnóstico', os.laudo)
    + tabelaItens(o.itens || [])
    + totais([
      o.desconto > 0 && ['Subtotal', money(o.subtotal)], o.desconto > 0 && ['Desconto', '- ' + money(o.desconto)],
      ['TOTAL', money(o.total), 'tot'], pago > 0 && ['Já pago', money(pago)], pago > 0 && ['Saldo', money(saldo), 'forte'],
    ])
    + texto('Observações', o.obs)
    + (cond ? secao('Condições', `<p class="pequeno just">${esc(cond)}</p>`) : '')
    + blocoPix(saldo, 'ORC' + o.numero)
    + assinaturas([cli.nome, 'De acordo — aprovo o orçamento'], formato === 'a4' ? [e.nome, `${e.cidade}, ${dataExtenso(o.data)}`] : null)
    + rodape();
}

function docNota() {
  const n = store.get('notas', id);
  if (!n) return null;
  const e = empresa();
  const eq = n.equipamento || {};
  return cabecalho(TITULOS.nota, 'Nº ' + numDoc(n.numero), 'Emitida em ' + dataBR(n.emitidaEm, true))
    + (n.cancelada ? `<div class="cancelada">NOTA CANCELADA — ${esc(n.motivoCancelamento || '')}</div>` : '')
    + `<div class="aviso-fiscal">Documento sem valor fiscal</div>`
    + blocoCliente(n.cliente || {})
    + blocoEquip({ ...eq, equipamento: eq.tipo })
    + secao('Referência', kv([['OS', n.osCodigo], ['Orçamento', 'Nº ' + numDoc(n.orcamentoNumero)], ['Conclusão', dataBR(n.conclusao)]]))
    + texto('Serviço executado', eq.laudo)
    + tabelaItens(n.itens || [])
    + totais([
      n.desconto > 0 && ['Subtotal', money(n.subtotal)], n.desconto > 0 && ['Desconto', '- ' + money(n.desconto)],
      ['TOTAL', money(n.total), 'tot'],
      ...(n.pagamentos || []).map((p) => [`${dataBR(p.data)} · ${p.forma}`, money(p.valor)]),
      ['Pago', money(n.pago), 'forte'], n.saldo > 0 && ['Saldo a pagar', money(n.saldo), 'forte'],
    ])
    + secao('Garantia', `<p class="pequeno just">${n.garantiaDias ? `Garantia de <b>${n.garantiaDias} dias</b> para os serviços executados, válida até <b>${dataBR(n.garantiaAte)}</b>, mediante apresentação desta nota. Não cobre mau uso, quedas, líquidos, surtos elétricos ou violação por terceiros.` : 'Serviço sem garantia.'}</p>`)
    + (n.saldo > 0 && !n.cancelada ? blocoPix(n.saldo, 'NS' + n.numero) : '')
    + assinaturas([n.cliente?.nome || '', 'Recebi o equipamento e o serviço'], formato === 'a4' ? [e.nome, `${e.cidade}, ${dataExtenso(n.conclusao || n.emitidaEm)}`] : null)
    + rodape();
}

function docRecibo() {
  const p = store.get('pagamentos', id);
  if (!p) return null;
  const o = store.get('orcamentos', p.orcamentoId) || { total: p.valor };
  const cli = store.get('clientes', p.clienteId) || { nome: p.clienteNome };
  const e = empresa();
  const ate = pagamentosDo(p.orcamentoId).filter((x) => (x.data || '') < (p.data || '') || ((x.data || '') === (p.data || '') && (x.numero || 0) <= (p.numero || 0)));
  const pagoAte = round2(ate.reduce((s, x) => s + (+x.valor || 0), 0));
  const saldo = Math.max(0, round2((o.total || 0) - pagoAte));
  const doc = cli.documento ? `, ${cli.tipoDoc || ''} ${formatDoc(cli.documento)}` : '';
  return cabecalho(TITULOS.recibo, 'Nº ' + numDoc(p.numero), 'Pago em ' + dataBR(p.data))
    + `<div class="valor-dest">${money(p.valor)}</div>`
    + `<p class="recibo-txt">Recebi(emos) de <b>${esc(cli.nome)}</b>${esc(doc)} a importância de <b>${money(p.valor)}</b> (${esc(valorExtenso(p.valor))}), via <b>${esc(p.forma)}</b>, referente ao orçamento nº ${numDoc(p.orcamentoNumero)} (${esc(p.osCodigo || '')} · ${esc(o.equipamentoDesc || '')})${p.obs ? '. Obs.: ' + esc(p.obs) : ''}.</p>`
    + totais([['Total do orçamento', money(o.total)], ['Pago até este recibo', money(pagoAte)], ['Saldo', saldo > 0 ? money(saldo) : 'QUITADO', 'tot']])
    + `<p class="pequeno">${esc(e.cidade)}, ${dataExtenso(p.data)}.</p>`
    + assinaturas(null, [e.nome, 'Recebedor'])
    + rodape();
}

/* ---------------- Montagem ---------------- */
function aplicarFormato() {
  document.body.className = formato === '80' ? 'f80' : 'fa4';
  $('#page-size').textContent = formato === '80'
    ? '@page { size: 80mm auto; margin: 0; }'
    : '@page { size: A4; margin: 12mm 14mm; }';
  $('#dica').hidden = formato !== '80';
  document.querySelectorAll('#formatos button').forEach((b) => b.classList.toggle('ativo', b.dataset.f === formato));
}

function desenhar() {
  aplicarFormato();
  const fn = { entrada: docEntrada, orcamento: docOrcamento, nota: docNota, recibo: docRecibo }[tipo];
  const html = fn ? fn() : null;
  $('#doc').innerHTML = html || '<p class="carregando">Documento não encontrado.</p>';
  $('#titulo-doc').textContent = TITULOS[tipo] || 'Documento';
  document.title = (TITULOS[tipo] || 'Documento') + ' · ' + empresa().nome;
  return !!html;
}

document.querySelectorAll('#formatos button').forEach((b) => b.addEventListener('click', () => {
  formato = b.dataset.f;
  const u = new URL(location.href);
  u.searchParams.set('f', formato);
  history.replaceState(null, '', u);
  desenhar();
}));
$('#btn-imprimir').addEventListener('click', () => window.print());
$('#btn-fechar').addEventListener('click', () => window.close());

aplicarFormato();
store.iniciar({
  aoEntrar() {
    if (desenhar() && !qs.has('sem-auto')) setTimeout(() => window.print(), 450);
  },
  aoSair(motivo) {
    $('#doc').innerHTML = `<p class="carregando">${esc(motivo || 'Entre no sistema primeiro (na aba principal) e tente de novo.')}</p>`;
  },
}).catch(() => { $('#doc').innerHTML = '<p class="carregando">Sem conexão.</p>'; });
