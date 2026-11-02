import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, norm, money, dataBR, numDoc, formatDoc, formatFone, enderecoTexto, botoesImpressao, modal, toast, vazio, hojeISO } from '../util.js';

export function lista(el) {
  let termo = '';
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('nota', 14)} atendimento</div><h1>Notas de serviço</h1><p>Documento não fiscal emitido ao concluir o serviço. Para emitir, abra um orçamento aprovado.</p></div>
    </div>
    <div class="filtros"><input type="search" id="q" placeholder="Nº da nota, cliente, OS…"></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const render = () => {
    const t = norm(termo).trim();
    const itens = store.lista('notas').sort((a, b) => (b.numero || 0) - (a.numero || 0))
      .filter((n) => !t || String(n.numero) === t.replace(/\D/g, '') || norm([n.cliente?.nome, n.osCodigo, n.equipamento?.tipo].join(' ')).includes(t));
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Nota</th><th>Cliente</th><th>Equipamento</th><th>Emissão</th><th>Garantia até</th><th class="r">Total</th></tr></thead><tbody>
      ${itens.map((n) => {
        const vigente = n.garantiaAte && n.garantiaAte >= hojeISO();
        return `<tr class="clicavel" data-href="#/notas/${n.id}" style="${n.cancelada ? 'opacity:.5' : ''}">
          <td><span class="cod">${numDoc(n.numero)}</span>${n.cancelada ? ' <span class="badge b-danger">cancelada</span>' : ''}</td>
          <td>${esc(n.cliente?.nome)}</td>
          <td><span class="cod">${esc(n.osCodigo)}</span> <span class="sub">${esc([n.equipamento?.tipo, n.equipamento?.marca].filter(Boolean).join(' '))}</span></td>
          <td class="nowrap">${dataBR(n.emitidaEm)}</td>
          <td class="nowrap">${n.garantiaAte ? dataBR(n.garantiaAte) + (vigente && !n.cancelada ? ' <span class="badge b-ok">vigente</span>' : '') : '<span class="sub">-</span>'}</td>
          <td class="r num">${money(n.total)}</td></tr>`;
      }).join('')}</tbody></table>` : vazio('Nenhuma nota de serviço emitida.', 'nota');
    el.querySelectorAll('#tab [data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  render();
  return { live: true, render };
}

export function detalhe(el, params) {
  const render = () => {
    const n = store.get('notas', params.id);
    if (!n) { el.innerHTML = vazio('Nota não encontrada.'); return; }
    const c = n.cliente || {};
    const e = n.equipamento || {};
    el.innerHTML = `
      <div class="page-head">
        <div><div class="crumb"><a href="#/notas">notas de serviço</a> / detalhe</div>
          <h1>Nota de serviço <span class="cod" style="font-size:1.3rem">${numDoc(n.numero)}</span> ${n.cancelada ? '<span class="badge b-danger">cancelada</span>' : ''}</h1>
          <p>Emitida em ${dataBR(n.emitidaEm, true)} · <a href="#/orcamentos/${n.orcamentoId}">orçamento #${n.orcamentoNumero}</a> · <a href="#/os/${n.osId}" class="cod">${esc(n.osCodigo)}</a></p></div>
        <div class="acoes">${botoesImpressao('nota', n.id, 'Nota')}
          ${!n.cancelada ? `<button class="btn btn-danger" id="cancelar">${icon('ban', 16)} Cancelar nota</button>` : ''}</div>
      </div>
      ${n.cancelada ? `<div class="aviso">${icon('alert')}<span>Cancelada em ${dataBR(n.canceladaEm, true)}. Motivo: ${esc(n.motivoCancelamento || '-')}</span></div>` : ''}
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>${icon('users')} Cliente</h2></div>
          <dl class="info"><dt>Nome</dt><dd>${esc(c.nome)}</dd>${c.documento ? `<dt>${esc(c.tipoDoc)}</dt><dd class="num">${esc(formatDoc(c.documento))}</dd>` : ''}
          <dt>Telefone</dt><dd>${esc(formatFone(c.telefone))}</dd>${enderecoTexto(c) ? `<dt>Endereço</dt><dd>${esc(enderecoTexto(c))}</dd>` : ''}</dl></div>
        <div class="card"><div class="card-head"><h2>${icon('os')} Equipamento</h2></div>
          <dl class="info"><dt>Equipamento</dt><dd>${esc([e.tipo, e.marca, e.modelo].filter(Boolean).join(' '))}</dd>${e.serie ? `<dt>Nº série</dt><dd class="num">${esc(e.serie)}</dd>` : ''}
          <dt>Entrada</dt><dd>${dataBR(e.entrada)}</dd><dt>Conclusão</dt><dd>${dataBR(n.conclusao)}</dd>
          <dt>Garantia</dt><dd>${n.garantiaDias ? `${n.garantiaDias} dias (até ${dataBR(n.garantiaAte)})` : 'sem garantia'}</dd></dl></div>
      </div>
      ${e.laudo ? `<div class="card"><div class="card-head"><h2>${icon('wrench')} Serviço executado</h2></div><div class="texto-bloco">${esc(e.laudo)}</div></div>` : ''}
      <div class="card flush"><div class="card-head"><h2>${icon('catalogo')} Itens</h2></div>
        <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Descrição</th><th>Tipo</th><th class="c">Qtd</th><th class="r">Unit.</th><th class="r">Subtotal</th></tr></thead><tbody>
        ${(n.itens || []).map((i) => `<tr><td>${esc(i.descricao)}</td><td class="sub">${esc(i.tipo)}</td><td class="c num">${i.qtd}</td><td class="r num">${money(i.valor)}</td><td class="r num">${money(i.qtd * i.valor)}</td></tr>`).join('')}
        </tbody><tfoot>
          ${n.desconto > 0 ? `<tr><td colspan="4" class="r">Desconto</td><td class="r num">- ${money(n.desconto)}</td></tr>` : ''}
          <tr><td colspan="4" class="r">Total</td><td class="r num">${money(n.total)}</td></tr>
          <tr><td colspan="4" class="r">Pago</td><td class="r num">${money(n.pago)}</td></tr>
          ${n.saldo > 0 ? `<tr><td colspan="4" class="r">Saldo</td><td class="r num" style="color:var(--danger)">${money(n.saldo)}</td></tr>` : ''}
        </tfoot></table></div></div>`;
    el.querySelector('#cancelar')?.addEventListener('click', () => {
      const m = modal({
        titulo: 'Cancelar nota ' + numDoc(n.numero),
        conteudo: `<form id="fc"><p class="confirm-txt">A nota continua registrada, marcada como cancelada. Depois disso, os pagamentos do orçamento podem ser corrigidos e uma nova nota pode ser emitida.</p>
          <div class="campo" style="margin-top:12px"><label class="req">Motivo</label><input name="motivo" maxlength="200" required></div>
          <div class="form-acoes"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn btn-danger">${icon('ban', 16)} Cancelar nota</button></div></form>`,
      });
      m.el.querySelector('#fc').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const motivo = ev.target.motivo.value.trim();
        if (!motivo) return;
        await store.atualizar('notas', n.id, { cancelada: true, canceladaEm: new Date().toISOString(), motivoCancelamento: motivo });
        m.fechar();
        toast('Nota cancelada.');
      });
    });
  };
  render();
  return { live: true, render };
}
