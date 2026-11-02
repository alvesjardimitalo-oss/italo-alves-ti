import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, dataBR, hojeISO, numDoc, whatsapp, vazio, FORMAS_PAG } from '../util.js';
import { aReceber, pagoDo, saldoDo, empresa } from '../negocio.js';
import { modalPagamento } from './orcamentos.js';

export function lista(el) {
  const hoje = hojeISO();
  let de = hoje.slice(0, 8) + '01';
  let ate = hoje;
  let forma = '';
  el.innerHTML = `
    <div class="page-head"><div><div class="crumb">${icon('financeiro', 14)} gestão</div><h1>Financeiro</h1><p>A receber, recebimentos e recibos.</p></div></div>
    <div id="kpis"></div>
    <div class="card flush"><div class="card-head"><h2>${icon('clock')} A receber</h2><span class="sub">orçamentos aprovados com saldo</span></div><div class="tabela-wrap" id="receber"></div></div>
    <div class="card flush" style="margin-top:18px">
      <div class="card-head"><h2>${icon('trend')} Recebimentos</h2>
        <div class="filtros" style="margin:0">
          <input type="date" id="de" value="${de}"> <input type="date" id="ate" value="${ate}">
          <select id="forma"><option value="">Todas as formas</option>${FORMAS_PAG.map((f) => `<option>${f}</option>`).join('')}</select>
          <button class="btn btn-sm" id="exp">${icon('download', 15)} CSV</button>
        </div></div>
      <div id="resumo" style="padding:0 20px"></div>
      <div class="tabela-wrap" id="recebidos"></div>
    </div>`;

  const filtrados = () => store.lista('pagamentos')
    .filter((p) => (p.data || '') >= de && (p.data || '') <= ate && (!forma || p.forma === forma))
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.numero || 0) - (a.numero || 0));

  const render = () => {
    const rec = aReceber();
    const totalRec = rec.reduce((s, o) => s + saldoDo(o), 0);
    const lista_ = filtrados();
    const total = lista_.reduce((s, p) => s + (+p.valor || 0), 0);
    const porForma = {};
    lista_.forEach((p) => { porForma[p.forma] = (porForma[p.forma] || 0) + (+p.valor || 0); });
    const ticket = lista_.length ? total / new Set(lista_.map((p) => p.orcamentoId)).size : 0;

    el.querySelector('#kpis').innerHTML = `<div class="kpis">
      <div class="kpi"><div class="kpi-top">Recebido no período ${icon('trend', 16)}</div><div class="kpi-val">${money(total)}</div><div class="kpi-sub">${lista_.length} pagamento(s)</div></div>
      <div class="kpi"><div class="kpi-top">A receber ${icon('clock', 16)}</div><div class="kpi-val">${money(totalRec)}</div><div class="kpi-sub">${rec.length} orçamento(s)</div></div>
      <div class="kpi"><div class="kpi-top">Ticket médio ${icon('financeiro', 16)}</div><div class="kpi-val">${money(ticket)}</div><div class="kpi-sub">por orçamento no período</div></div>
    </div>`;

    el.querySelector('#receber').innerHTML = rec.length ? `<table class="tabela"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Data</th><th class="r">Total</th><th class="r">Pago</th><th class="r">Saldo</th><th></th></tr></thead><tbody>
      ${rec.map((o) => {
        const wa = whatsapp(o.clienteTelefone, `Olá, ${o.clienteNome.split(' ')[0]}! Passando para lembrar do saldo de ${money(saldoDo(o))} referente ao orçamento nº ${o.numero} (${o.equipamentoDesc}). — ${empresa().nome}`);
        return `<tr><td><a class="cod" href="#/orcamentos/${o.id}">#${o.numero}</a></td><td>${esc(o.clienteNome)}</td><td>${dataBR(o.data)}</td>
          <td class="r num">${money(o.total)}</td><td class="r num">${money(pagoDo(o.id))}</td><td class="r num forte">${money(saldoDo(o))}</td>
          <td><div class="acoes">${wa ? `<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="${esc(wa)}" title="Cobrar pelo WhatsApp">${icon('whatsapp', 16)}</a>` : ''}
          <button class="btn btn-sm btn-ok" data-receber="${o.id}">${icon('plus', 14)} Receber</button></div></td></tr>`;
      }).join('')}</tbody></table>` : vazio('Nada em aberto.', 'check');

    el.querySelector('#resumo').innerHTML = Object.keys(porForma).length
      ? `<p class="sub">${Object.entries(porForma).sort((a, b) => b[1] - a[1]).map(([f, v]) => `${esc(f)}: <b class="num">${money(v)}</b>`).join(' &nbsp;·&nbsp; ')}</p>` : '';
    el.querySelector('#recebidos').innerHTML = lista_.length ? `<table class="tabela"><thead><tr><th>Recibo</th><th>Data</th><th>Cliente</th><th>Orçamento</th><th>Forma</th><th class="r">Valor</th><th></th></tr></thead><tbody>
      ${lista_.map((p) => `<tr><td class="cod">${numDoc(p.numero)}</td><td>${dataBR(p.data)}</td><td>${esc(p.clienteNome)}</td>
        <td><a href="#/orcamentos/${p.orcamentoId}" class="cod">#${p.orcamentoNumero}</a></td><td>${esc(p.forma)}</td><td class="r num">${money(p.valor)}</td>
        <td><div class="acoes"><a class="icon-btn" target="_blank" title="Recibo A4" href="imprimir.html${location.search.includes('demo') ? '?demo&' : '?'}t=recibo&id=${p.id}&f=a4">${icon('printer', 16)}</a>
        <a class="icon-btn" target="_blank" title="Recibo bobina" href="imprimir.html${location.search.includes('demo') ? '?demo&' : '?'}t=recibo&id=${p.id}&f=80">${icon('receipt', 16)}</a></div></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Total</td><td class="r num">${money(total)}</td><td></td></tr></tfoot></table>` : vazio('Nenhum recebimento no período.', 'financeiro');

    el.querySelectorAll('[data-receber]').forEach((b) => b.addEventListener('click', () => modalPagamento(store.get('orcamentos', b.dataset.receber), render)));
  };

  el.querySelector('#de').addEventListener('change', (e) => { de = e.target.value || '0000'; render(); });
  el.querySelector('#ate').addEventListener('change', (e) => { ate = e.target.value || '9999'; render(); });
  el.querySelector('#forma').addEventListener('change', (e) => { forma = e.target.value; render(); });
  el.querySelector('#exp').addEventListener('click', () => {
    const linhas = [['Recibo', 'Data', 'Cliente', 'Orcamento', 'OS', 'Forma', 'Valor', 'Obs']]
      .concat(filtrados().map((p) => [numDoc(p.numero), p.data, p.clienteNome, p.orcamentoNumero, p.osCodigo, p.forma, String(p.valor).replace('.', ','), p.obs || '']));
    const csv = '﻿' + linhas.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `recebimentos_${de}_a_${ate}.csv`;
    a.click();
  });
  render();
  return { live: true, render };
}
