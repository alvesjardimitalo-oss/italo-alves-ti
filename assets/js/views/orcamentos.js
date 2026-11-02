import { store } from '../store.js';
import { icon } from '../icons.js';
import {
  esc, norm, money, parseMoney, round2, badge, STATUS_ORC, SITUACAO_PAG, FORMAS_PAG, dataBR, hojeISO, somaDias,
  toast, confirmar, modal, lerForm, ligarMascaras, botoesImpressao, whatsapp, numDoc, vazio,
} from '../util.js';
import { pagamentosDo, pagoDo, saldoDo, situacaoDo, subtotalItens, notasDoOrcamento, empresa } from '../negocio.js';

/* =================================================================
 * Lista
 * ================================================================= */
export function lista(el, _p, query) {
  let filtro = query.status || 'todos';
  let termo = '';
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('orcamento', 14)} atendimento</div><h1>Orçamentos</h1><p>Para criar, abra uma OS e clique em "Orçamento".</p></div>
      <a class="btn btn-primary" href="#/os">${icon('plus', 16)} Novo (escolher OS)</a>
    </div>
    <div class="filtros"><input type="search" id="q" placeholder="Nº, cliente, equipamento…"><div class="pills" id="pills"></div></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const render = () => {
    const todos = store.lista('orcamentos').sort((a, b) => (b.numero || 0) - (a.numero || 0));
    const cont = { todos: todos.length };
    Object.keys(STATUS_ORC).forEach((s) => { cont[s] = todos.filter((o) => o.status === s).length; });
    el.querySelector('#pills').innerHTML = ['todos', ...Object.keys(STATUS_ORC)].map((s) => `<button class="pill ${filtro === s ? 'ativo' : ''}" data-s="${s}">${s === 'todos' ? 'Todos' : s}<span class="n">${cont[s]}</span></button>`).join('');
    el.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.s; render(); }));
    const t = norm(termo).trim().replace(/^#/, '');
    const itens = todos.filter((o) => (filtro === 'todos' || o.status === filtro)
      && (!t || String(o.numero) === t || norm([o.clienteNome, o.equipamentoDesc, o.osCodigo].join(' ')).includes(t)));
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Nº</th><th>Cliente</th><th>Equipamento</th><th>Data</th><th>Status</th><th class="r">Total</th><th>Pagamento</th></tr></thead><tbody>
      ${itens.map((o) => {
        const vencido = o.status === 'Pendente' && o.validadeDias > 0 && somaDias(o.data, o.validadeDias) < hojeISO();
        const temPag = pagamentosDo(o.id).length;
        return `<tr class="clicavel" data-href="#/orcamentos/${o.id}">
          <td><span class="cod">#${o.numero}</span></td>
          <td>${esc(o.clienteNome)}</td>
          <td><span class="cod">${esc(o.osCodigo || '')}</span> <span class="sub">${esc(o.equipamentoDesc || '')}</span></td>
          <td class="nowrap">${dataBR(o.data)}</td>
          <td>${badge(o.status, STATUS_ORC)}${vencido ? ' <span class="badge b-muted">vencido</span>' : ''}</td>
          <td class="r num nowrap">${money(o.total)}</td>
          <td>${o.status === 'Aprovado' || temPag ? badge(situacaoDo(o), SITUACAO_PAG) : '<span class="sub">-</span>'}</td></tr>`;
      }).join('')}</tbody></table>` : vazio('Nenhum orçamento encontrado.', 'orcamento');
    el.querySelectorAll('#tab [data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  render();
  return { live: true, render };
}

/* =================================================================
 * Formulário / detalhe
 * ================================================================= */
export function form(el, params, query) {
  const id = params.id;
  let orc = id ? store.get('orcamentos', id) : null;
  if (id && !orc) { el.innerHTML = vazio('Orçamento não encontrado.'); return; }
  const os = store.get('os', orc ? orc.osId : query.os);
  if (!os) {
    el.innerHTML = vazio('Escolha a ordem de serviço para fazer o orçamento.', 'os') + '<p class="c"><a class="btn" href="#/os">Ir para ordens de serviço</a></p>';
    return;
  }
  const emp = empresa();
  let itens = orc ? orc.itens.map((i) => ({ ...i })) : [];
  const cab = orc ? { status: orc.status, validadeDias: orc.validadeDias, desconto: orc.desconto, obs: orc.obs || '' }
    : { status: 'Pendente', validadeDias: emp.validadeDias, desconto: 0, obs: '' };
  const catalogo = () => store.lista('catalogo').filter((c) => c.ativo !== false).sort((a, b) => (a.tipo || '').localeCompare(b.tipo || '') || (a.nome || '').localeCompare(b.nome || ''));

  const linha = (i, k) => `<tr data-k="${k}">
      <td><input class="desc" list="lista-catalogo" value="${esc(i.descricao)}" placeholder="Digite ou escolha do catálogo…" maxlength="120"></td>
      <td style="width:118px"><select class="tipo">${['Serviço', 'Produto'].map((t) => `<option ${i.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
      <td class="w-qtd"><input class="qtd mono" type="number" min="1" step="1" value="${i.qtd || 1}"></td>
      <td class="w-val"><input class="val mono r" inputmode="decimal" data-mask="money" value="${i.valor != null ? money(i.valor, false) : ''}"></td>
      <td class="w-sub r num nowrap sub-l">${money((i.qtd || 0) * (i.valor || 0))}</td>
      <td class="w-x"><button type="button" class="icon-btn rem" title="Remover">${icon('x', 16)}</button></td></tr>`;

  const desenhar = () => {
    const pags = id ? pagamentosDo(id) : [];
    const pago = id ? pagoDo(id) : 0;
    const saldo = orc ? saldoDo(orc) : 0;
    const notas = id ? notasDoOrcamento(id) : [];
    const pct = orc && orc.total > 0 ? Math.min(100, (pago / orc.total) * 100) : 0;
    el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb"><a href="#/orcamentos">orçamentos</a> / ${id ? 'detalhe' : 'novo'}</div>
        <h1>${id ? `Orçamento <span class="cod" style="font-size:1.3rem">#${orc.numero}</span>` : 'Novo orçamento'}</h1>
        <p>${esc(os.clienteNome)} · <a href="#/os/${os.id}" class="cod">${esc(os.codigo)}</a> ${esc(os.equipamento)} ${esc(os.marca || '')} ${id ? badge(orc.status, STATUS_ORC) : ''}</p></div>
      ${id ? `<div class="acoes">${botoesImpressao('orcamento', id)}
        ${whatsapp(orc.clienteTelefone) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(whatsapp(orc.clienteTelefone, textoWhats(orc)))}">${icon('whatsapp', 16)} Enviar</a>` : ''}</div>` : ''}
    </div>
    <div class="grid ${id ? 'g-21' : ''}">
      <form class="card" id="f" novalidate>
        <div id="erros"></div>
        ${os.defeito ? `<div class="campo" style="margin-bottom:14px"><label>Defeito relatado</label><div class="texto-bloco">${esc(os.defeito)}</div></div>` : ''}
        <div class="card-head"><h2>${icon('catalogo')} Itens</h2><button type="button" class="btn btn-sm" id="add">${icon('plus', 15)} Adicionar item</button></div>
        <div class="tabela-wrap"><table class="tabela itens"><thead><tr><th>Descrição</th><th>Tipo</th><th>Qtd</th><th class="r">Valor unit.</th><th class="r">Subtotal</th><th></th></tr></thead>
          <tbody id="linhas">${itens.map(linha).join('')}</tbody></table></div>
        <datalist id="lista-catalogo">${catalogo().map((c) => `<option value="${esc(c.nome)}">${esc(c.tipo)} · ${money(c.valor)}</option>`).join('')}</datalist>
        <div class="totais">
          <div><span class="sub">Subtotal</span><span class="num" id="t-sub">R$ 0,00</span></div>
          <div><span class="sub">Desconto (R$)</span><input id="desconto" inputmode="decimal" data-mask="money" value="${money(cab.desconto, false)}"></div>
          <div class="tot"><span>Total</span><span id="t-tot">R$ 0,00</span></div>
        </div>
        <div class="form" style="margin-top:16px">
          <div class="campo c4"><label>Status</label><select name="status">${Object.keys(STATUS_ORC).map((s) => `<option ${cab.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="campo c4"><label>Validade (dias)</label><input name="validadeDias" type="number" min="0" max="365" value="${cab.validadeDias}"></div>
          <div class="campo c12"><label>Observações (saem na impressão)</label><textarea name="obs" maxlength="1500" placeholder="Prazo de entrega, condições de pagamento…">${esc(cab.obs)}</textarea></div>
        </div>
        <div class="form-acoes">
          ${id ? `<button type="button" class="btn btn-danger" id="excluir">${icon('trash', 16)} Excluir</button><span style="flex:1"></span>` : ''}
          <a class="btn" href="${id ? '#/orcamentos' : '#/os/' + os.id}">Voltar</a>
          <button type="submit" class="btn btn-primary">${icon('check', 16)} Salvar orçamento</button>
        </div>
      </form>
      ${id ? `<div>
        <div class="card">
          <div class="card-head"><h2>${icon('financeiro')} Pagamento</h2>${badge(situacaoDo(orc), SITUACAO_PAG)}</div>
          <dl class="info"><dt>Total</dt><dd class="num">${money(orc.total)}</dd><dt>Pago</dt><dd class="num">${money(pago)}</dd><dt>Saldo</dt><dd class="num forte">${money(saldo)}</dd></dl>
          <div class="barra" style="margin:12px 0"><span style="width:${pct}%"></span></div>
          ${saldo > 0 && !['Recusado', 'Cancelado'].includes(orc.status) ? `<button class="btn btn-ok" id="receber" style="width:100%">${icon('plus', 16)} Registrar pagamento</button>` : ''}
          ${pags.length ? `<ul class="timeline" style="margin-top:12px">${pags.map((p) => `<li>
            <div style="flex:1"><div class="num">${money(p.valor)} <span class="sub">· ${esc(p.forma)}</span></div><div class="sub">${dataBR(p.data)} · recibo ${numDoc(p.numero)}${p.obs ? ' · ' + esc(p.obs) : ''}</div></div>
            <a class="icon-btn" title="Recibo A4" target="_blank" href="imprimir.html${location.search.includes('demo') ? '?demo&' : '?'}t=recibo&id=${p.id}&f=a4">${icon('printer', 16)}</a>
            <a class="icon-btn" title="Recibo bobina" target="_blank" href="imprimir.html${location.search.includes('demo') ? '?demo&' : '?'}t=recibo&id=${p.id}&f=80">${icon('receipt', 16)}</a>
            <button class="icon-btn" data-del-pag="${p.id}" title="Excluir pagamento">${icon('trash', 16)}</button></li>`).join('')}</ul>` : ''}
        </div>
        <div class="card">
          <div class="card-head"><h2>${icon('nota')} Nota de serviço</h2></div>
          ${notas.length ? notas.map((n) => `<p style="margin:0 0 10px"><a href="#/notas/${n.id}" class="cod">Nº ${numDoc(n.numero)}</a> <span class="sub">emitida em ${dataBR(n.emitidaEm)}</span></p>
            ${botoesImpressao('nota', n.id, 'Nota')}`).join('')
            : orc.status === 'Aprovado'
              ? `<p class="sub" style="margin-top:0">Emita ao concluir o serviço. Ela registra itens, valores, pagamento e garantia.</p><button class="btn btn-primary" id="emitir" style="width:100%">${icon('nota', 16)} Emitir nota de serviço</button>`
              : '<p class="sub" style="margin:0">Disponível quando o orçamento estiver <b>Aprovado</b>.</p>'}
        </div>
      </div>` : ''}
    </div>`;
    ligar();
  };

  const lerLinhas = () => [...el.querySelectorAll('#linhas tr')].map((tr) => ({
    descricao: tr.querySelector('.desc').value.trim(),
    tipo: tr.querySelector('.tipo').value,
    qtd: parseInt(tr.querySelector('.qtd').value, 10) || 0,
    valor: parseMoney(tr.querySelector('.val').value),
  }));

  const recalcular = () => {
    const ls = lerLinhas();
    el.querySelectorAll('#linhas tr').forEach((tr, k) => { tr.querySelector('.sub-l').textContent = money(ls[k].qtd * ls[k].valor); });
    const sub = subtotalItens(ls);
    const desc = parseMoney(el.querySelector('#desconto').value);
    el.querySelector('#t-sub').textContent = money(sub);
    el.querySelector('#t-tot').textContent = money(Math.max(0, sub - desc));
  };

  const ligar = () => {
    const f = el.querySelector('#f');
    const corpo = el.querySelector('#linhas');
    ligarMascaras(f);
    const add = () => {
      corpo.insertAdjacentHTML('beforeend', linha({ qtd: 1, tipo: 'Serviço' }, corpo.children.length));
      ligarMascaras(corpo.lastElementChild);
      corpo.lastElementChild.querySelector('.desc').focus();
      recalcular();
    };
    el.querySelector('#add').addEventListener('click', add);
    if (!corpo.children.length) add();
    corpo.addEventListener('input', recalcular);
    corpo.addEventListener('change', (e) => {
      if (e.target.matches('.desc')) {
        const cat = catalogo().find((c) => c.nome === e.target.value);
        if (cat) {
          const tr = e.target.closest('tr');
          tr.querySelector('.tipo').value = cat.tipo;
          tr.querySelector('.val').value = money(cat.valor, false);
          tr.querySelector('.qtd').focus();
        }
      }
      recalcular();
    });
    corpo.addEventListener('click', (e) => { if (e.target.closest('.rem')) { e.target.closest('tr').remove(); recalcular(); } });
    el.querySelector('#desconto').addEventListener('input', recalcular);
    recalcular();

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerForm(f);
      const ls = lerLinhas().filter((l) => l.descricao || l.valor);
      const erros = [];
      if (!ls.length) erros.push('Adicione pelo menos um item.');
      if (ls.some((l) => !l.descricao)) erros.push('Preencha a descrição de todos os itens.');
      if (ls.some((l) => l.qtd <= 0)) erros.push('Quantidade inválida.');
      const subtotal = subtotalItens(ls);
      const desconto = parseMoney(el.querySelector('#desconto').value);
      if (desconto > subtotal) erros.push(`O desconto não pode ser maior que o subtotal (${money(subtotal)}).`);
      el.querySelector('#erros').innerHTML = erros.length ? `<div class="erros"><ul>${erros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
      if (erros.length) return;
      const total = round2(subtotal - desconto);
      const dados = {
        itens: ls, subtotal, desconto, total, status: d.status, validadeDias: parseInt(d.validadeDias, 10) || 0, obs: d.obs,
        osId: os.id, osCodigo: os.codigo, clienteId: os.clienteId, clienteNome: os.clienteNome, clienteTelefone: os.clienteTelefone || '',
        equipamentoDesc: [os.equipamento, os.marca, os.modelo].filter(Boolean).join(' '),
      };
      try {
        let destino = id;
        if (id) {
          await store.atualizar('orcamentos', id, dados);
          if (pagoDo(id) > total + 0.004) toast('Atenção: o valor já pago é maior que o novo total.', 'aviso', 6000);
        } else {
          const novo = await store.criar('orcamentos', { ...dados, data: new Date().toISOString() }, 'orcamento');
          destino = novo.id;
        }
        // status do orçamento move a OS
        if (d.status === 'Aprovado' && ['Recebido', 'Em análise', 'Aguardando aprovação'].includes(os.status)) {
          await store.atualizar('os', os.id, { status: 'Em manutenção' });
        } else if (d.status === 'Pendente' && ['Recebido', 'Em análise'].includes(os.status)) {
          await store.atualizar('os', os.id, { status: 'Aguardando aprovação' });
        }
        toast('Orçamento salvo.');
        if (id) { orc = store.get('orcamentos', id); itens = orc.itens; Object.assign(cab, { status: orc.status, validadeDias: orc.validadeDias, desconto: orc.desconto, obs: orc.obs }); desenhar(); }
        else location.hash = '#/orcamentos/' + destino;
      } catch (err) { toast('Erro ao salvar: ' + err.message, 'erro'); }
    });

    el.querySelector('#excluir')?.addEventListener('click', async () => {
      if (pagamentosDo(id).length || notasDoOrcamento(id).length) {
        toast('Este orçamento tem pagamento ou nota emitida. Marque como "Cancelado" em vez de excluir.', 'erro', 6000);
        return;
      }
      if (!(await confirmar(`Excluir o orçamento #${orc.numero}?`, { perigo: true, botao: 'Excluir' }))) return;
      await store.remover('orcamentos', id);
      toast('Orçamento excluído.');
      location.hash = '#/orcamentos';
    });
    el.querySelector('#receber')?.addEventListener('click', () => modalPagamento(orc, () => { orc = store.get('orcamentos', id); desenhar(); }));
    el.querySelectorAll('[data-del-pag]').forEach((b) => b.addEventListener('click', async () => {
      const p = store.get('pagamentos', b.dataset.delPag);
      if (notasDoOrcamento(id).length) { toast('Já existe nota de serviço emitida para este orçamento. Cancele a nota antes de mexer nos pagamentos.', 'erro', 6000); return; }
      if (!(await confirmar(`Excluir o pagamento de ${money(p.valor)} (recibo ${numDoc(p.numero)})?`, { perigo: true, botao: 'Excluir' }))) return;
      await store.remover('pagamentos', p.id);
      toast('Pagamento excluído.');
      desenhar();
    }));
    el.querySelector('#emitir')?.addEventListener('click', () => modalNota(orc, os));
  };

  desenhar();
  return { live: false };
}

function textoWhats(o) {
  const emp = empresa();
  return `Olá, ${o.clienteNome.split(' ')[0]}! Segue o orçamento nº ${o.numero} (${o.osCodigo} · ${o.equipamentoDesc}):\n`
    + o.itens.map((i) => `• ${i.qtd}x ${i.descricao} — ${money(i.qtd * i.valor)}`).join('\n')
    + (o.desconto > 0 ? `\nDesconto: ${money(o.desconto)}` : '')
    + `\n*Total: ${money(o.total)}*`
    + (o.validadeDias ? `\nVálido até ${dataBR(somaDias(o.data, o.validadeDias))}.` : '')
    + `\n\n${emp.nome}`;
}

/* ---------------- Modal: registrar pagamento ---------------- */
export function modalPagamento(orc, depois) {
  const saldo = saldoDo(orc);
  const m = modal({
    titulo: `Pagamento · orçamento #${orc.numero}`,
    conteudo: `<form id="fp" class="form">
      <div class="campo c12"><div class="aviso" style="margin:0">${icon('financeiro')}<span>Saldo em aberto: <b class="num">${money(saldo)}</b></span></div></div>
      <div class="campo c6"><label class="req">Valor (R$)</label><input name="valor" class="mono" inputmode="decimal" data-mask="money" value="${money(saldo, false)}"></div>
      <div class="campo c6"><label class="req">Data</label><input name="data" type="date" max="${hojeISO()}" value="${hojeISO()}"></div>
      <div class="campo c6"><label class="req">Forma</label><select name="forma">${FORMAS_PAG.map((f) => `<option>${f}</option>`).join('')}</select></div>
      <div class="campo c6"><label>Observação</label><input name="obs" maxlength="120" placeholder="Entrada, parcela 2/3…"></div>
      <div class="campo c12" id="erro-p"></div>
      <div class="c12 form-acoes" style="margin-top:0"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-ok">${icon('check', 16)} Registrar</button></div>
    </form>`,
  });
  const f = m.el.querySelector('#fp');
  ligarMascaras(f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerForm(f);
    const valor = parseMoney(d.valor);
    const erro = valor <= 0 ? 'Informe um valor maior que zero.' : valor > saldo + 0.004 ? `O valor passa do saldo (${money(saldo)}).` : !d.data ? 'Informe a data.' : d.data > hojeISO() ? 'A data não pode ser futura.' : '';
    if (erro) { m.el.querySelector('#erro-p').innerHTML = `<div class="erros" style="margin:0">${esc(erro)}</div>`; return; }
    try {
      await store.criar('pagamentos', {
        orcamentoId: orc.id, orcamentoNumero: orc.numero, osId: orc.osId, osCodigo: orc.osCodigo,
        clienteId: orc.clienteId, clienteNome: orc.clienteNome, valor, data: d.data, forma: d.forma, obs: d.obs,
      }, 'recibo');
      if (orc.status === 'Pendente') await store.atualizar('orcamentos', orc.id, { status: 'Aprovado' });
      const os = store.get('os', orc.osId);
      if (os && ['Recebido', 'Em análise', 'Aguardando aprovação'].includes(os.status)) await store.atualizar('os', os.id, { status: 'Em manutenção' });
      toast(`Pagamento de ${money(valor)} registrado.`);
      m.fechar();
      depois && depois();
    } catch (err) { toast('Erro: ' + err.message, 'erro'); }
  });
}

/* ---------------- Modal: emitir nota de serviço ---------------- */
function modalNota(orc, os) {
  const emp = empresa();
  const m = modal({
    titulo: `Emitir nota de serviço · orçamento #${orc.numero}`,
    largura: 560,
    conteudo: `<form id="fn" class="form">
      <div class="campo c12"><p class="sub" style="margin:0">A nota (não fiscal) congela os dados deste orçamento: itens, valores e pagamentos até agora. Depois de emitida, ela só pode ser cancelada.</p></div>
      <div class="campo c6"><label>Garantia (dias)</label><input name="garantiaDias" type="number" min="0" max="730" value="${emp.garantiaDias}"></div>
      <div class="campo c6"><label>Data de conclusão</label><input name="conclusao" type="date" value="${hojeISO()}"></div>
      <div class="campo c12"><label>Serviço executado / laudo (sai na nota)</label><textarea name="laudo" maxlength="2000">${esc(os.laudo || '')}</textarea></div>
      <div class="campo c12"><label class="check"><input type="checkbox" name="entregue" value="1" checked> Marcar ${esc(os.codigo)} como <b>Entregue</b></label></div>
      <div class="c12 form-acoes" style="margin-top:0"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">${icon('nota', 16)} Emitir nota</button></div>
    </form>`,
  });
  const f = m.el.querySelector('#fn');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerForm(f);
    const cli = store.get('clientes', orc.clienteId) || { nome: orc.clienteNome, telefone: orc.clienteTelefone };
    const pags = pagamentosDo(orc.id).map((p) => ({ numero: p.numero, data: p.data, forma: p.forma, valor: p.valor }));
    const pago = round2(pags.reduce((s, p) => s + p.valor, 0));
    const garantiaDias = parseInt(d.garantiaDias, 10) || 0;
    try {
      if (d.laudo !== (os.laudo || '')) await store.atualizar('os', os.id, { laudo: d.laudo });
      const nota = await store.criar('notas', {
        orcamentoId: orc.id, orcamentoNumero: orc.numero, osId: os.id, osCodigo: os.codigo, clienteId: orc.clienteId,
        cliente: { nome: cli.nome, tipoDoc: cli.tipoDoc || '', documento: cli.documento || '', telefone: cli.telefone || '', email: cli.email || '',
          logradouro: cli.logradouro || '', numero: cli.numero || '', complemento: cli.complemento || '', bairro: cli.bairro || '', cidade: cli.cidade || '', uf: cli.uf || '', cep: cli.cep || '' },
        equipamento: { tipo: os.equipamento, marca: os.marca || '', modelo: os.modelo || '', serie: os.serie || '', entrada: os.entrada || '', defeito: os.defeito || '', laudo: d.laudo },
        itens: orc.itens, subtotal: orc.subtotal, desconto: orc.desconto, total: orc.total,
        pagamentos: pags, pago, saldo: Math.max(0, round2(orc.total - pago)),
        garantiaDias, conclusao: d.conclusao || hojeISO(), garantiaAte: garantiaDias ? somaDias(d.conclusao || hojeISO(), garantiaDias) : '',
        emitidaEm: new Date().toISOString(), cancelada: false,
      }, 'nota');
      if (d.entregue) await store.atualizar('os', os.id, { status: 'Entregue', saida: os.saida || d.conclusao || hojeISO() });
      toast(`Nota de serviço ${numDoc(nota.numero)} emitida.`);
      m.fechar();
      location.hash = '#/notas/' + nota.id;
    } catch (err) { toast('Erro: ' + err.message, 'erro'); }
  });
}

