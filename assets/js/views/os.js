import { store } from '../store.js';
import { icon } from '../icons.js';
import {
  esc, norm, badge, STATUS_OS, STATUS_OS_ABERTO, STATUS_ORC, TIPOS_EQUIP, dataBR, hojeISO, diasDesde, formatFone,
  lerForm, toast, confirmar, codOS, money, whatsapp, botoesImpressao, vazio,
} from '../util.js';
import { clientesOrdenados, orcamentosDaOS, pagamentosDo, situacaoDo, empresa, linkAcompanhar } from '../negocio.js';

export function lista(el, _p, query) {
  let filtro = query.status || 'abertas';
  let termo = query.q || '';
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('os', 14)} atendimento</div><h1>Ordens de serviço</h1><p>Entrada de equipamentos, status e laudo técnico.</p></div>
      <a class="btn btn-primary" href="#/os/nova">${icon('plus', 16)} Nova OS</a>
    </div>
    <div class="filtros"><input type="search" id="q" placeholder="OS, equipamento, nº de série, cliente…" value="${esc(termo)}"><div class="pills" id="pills"></div></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const render = () => {
    const todas = store.lista('os').sort((a, b) => (b.numero || 0) - (a.numero || 0));
    const cont = { abertas: todas.filter((o) => STATUS_OS_ABERTO.includes(o.status)).length, todas: todas.length };
    Object.keys(STATUS_OS).forEach((s) => { cont[s] = todas.filter((o) => o.status === s).length; });
    const opcoes = ['abertas', 'todas', ...Object.keys(STATUS_OS).filter((s) => cont[s])];
    el.querySelector('#pills').innerHTML = opcoes.map((s) => `<button class="pill ${filtro === s ? 'ativo' : ''}" data-s="${esc(s)}">${s === 'abertas' ? 'Na bancada' : s === 'todas' ? 'Todas' : esc(s)}<span class="n">${cont[s]}</span></button>`).join('');
    el.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.s; render(); }));
    const t = norm(termo).trim();
    const itens = todas.filter((o) => (filtro === 'todas' || (filtro === 'abertas' ? STATUS_OS_ABERTO.includes(o.status) : o.status === filtro))
      && (!t || norm([o.codigo, o.equipamento, o.marca, o.modelo, o.serie, o.clienteNome].join(' ')).includes(t)));
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Entrada</th><th>Status</th><th class="r">Dias</th></tr></thead><tbody>
      ${itens.map((o) => {
        const d = STATUS_OS_ABERTO.includes(o.status) ? diasDesde(o.entrada) : null;
        return `<tr class="clicavel" data-href="#/os/${o.id}">
          <td class="nowrap"><span class="cod">${esc(o.codigo)}</span></td>
          <td>${esc(o.clienteNome)}<div class="sub">${esc(formatFone(o.clienteTelefone))}</div></td>
          <td>${esc(o.equipamento)} <span class="sub">${esc([o.marca, o.modelo].filter(Boolean).join(' '))}</span>${o.defeito ? `<div class="sub">${esc(o.defeito.slice(0, 80))}${o.defeito.length > 80 ? '…' : ''}</div>` : ''}</td>
          <td class="nowrap">${dataBR(o.entrada)}</td>
          <td>${badge(o.status, STATUS_OS)}</td>
          <td class="r num" style="${d > 15 ? 'color:var(--danger);font-weight:600' : ''}">${d ?? '<span class="sub">-</span>'}</td></tr>`;
      }).join('')}</tbody></table>` : vazio('Nenhuma ordem de serviço encontrada.', 'os');
    el.querySelectorAll('#tab [data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  render();
  return { live: true, render };
}

export function form(el, params, query) {
  const id = params.id;
  const os = id ? store.get('os', id) : null;
  if (id && !os) { el.innerHTML = vazio('Ordem de serviço não encontrada.'); return; }
  const v = os || { clienteId: query.cliente || '', status: 'Recebido', entrada: hojeISO() };
  const clientes = clientesOrdenados();

  const desenhar = () => {
    const orcs = id ? orcamentosDaOS(id) : [];
    const cli = store.get('clientes', v.clienteId);
    el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb"><a href="#/os">ordens de serviço</a> / ${id ? 'detalhe' : 'nova'}</div>
        <h1>${id ? `<span class="cod" style="font-size:1.3rem">${esc(os.codigo)}</span> · ${esc(os.equipamento)}` : 'Nova ordem de serviço'}</h1>
        ${id ? `<p>${esc(os.clienteNome)} · entrada em ${dataBR(os.entrada)} ${badge(os.status, STATUS_OS)}</p>` : '<p>Registre o equipamento que o cliente deixou na bancada.</p>'}</div>
      ${id ? `<div class="acoes">${botoesImpressao('entrada', id, 'Comprovante')}
        ${whatsapp(os.clienteTelefone) ? `<a class="btn" target="_blank" rel="noopener" title="Mandar o link para o cliente acompanhar" href="${esc(whatsapp(os.clienteTelefone, `Olá, ${os.clienteNome.split(' ')[0]}! Você pode acompanhar o conserto do seu ${os.equipamento} (${os.codigo}) por aqui: ${linkAcompanhar(os.codigo)} (use o código ${os.codigo} e o seu telefone). — ${empresa().nome}`))}">${icon('globe', 16)} Link de acompanhamento</a>` : ''}
        ${os.status === 'Pronto para retirada' && whatsapp(os.clienteTelefone) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(whatsapp(os.clienteTelefone, `Olá, ${os.clienteNome.split(' ')[0]}! Seu ${os.equipamento} (${os.codigo}) está pronto para retirada. — ${empresa().nome}`))}">${icon('whatsapp', 16)} Avisar cliente</a>` : ''}
        <a class="btn btn-primary" href="#/orcamentos/novo?os=${id}">${icon('plus', 16)} Orçamento</a></div>` : ''}
    </div>
    ${!clientes.length ? `<div class="aviso">${icon('alert')} <span>Cadastre um cliente antes. <a href="#/clientes/novo">Novo cliente</a></span></div>` : ''}
    <div class="grid ${id ? 'g-21' : ''}">
      <form class="card" id="f" novalidate>
        <div id="erros"></div>
        <div class="form">
          <div class="campo c8"><label class="req">Cliente</label>
            <select name="clienteId" required><option value="">Selecione…</option>
              ${clientes.map((c) => `<option value="${c.id}" ${c.id === v.clienteId ? 'selected' : ''}>${esc(c.nome)}${c.telefone ? ' · ' + esc(formatFone(c.telefone)) : ''}</option>`).join('')}
            </select><div class="dica">Cliente novo? <a href="#/clientes/novo">Cadastre aqui</a>.</div></div>
          <div class="campo c4"><label>Status</label><select name="status">${Object.keys(STATUS_OS).map((s) => `<option ${v.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
          <div class="campo c4"><label class="req">Equipamento</label><input name="equipamento" list="tipos" maxlength="60" value="${esc(v.equipamento)}" placeholder="Notebook, Desktop…">
            <datalist id="tipos">${TIPOS_EQUIP.map((t) => `<option>${t}</option>`).join('')}</datalist></div>
          <div class="campo c4"><label>Marca</label><input name="marca" maxlength="40" value="${esc(v.marca)}"></div>
          <div class="campo c4"><label>Modelo</label><input name="modelo" maxlength="60" value="${esc(v.modelo)}"></div>
          <div class="campo c4"><label>Nº de série</label><input name="serie" class="mono" maxlength="60" value="${esc(v.serie)}"></div>
          <div class="campo c4"><label class="req">Entrada</label><input name="entrada" type="date" value="${esc(v.entrada)}"></div>
          <div class="campo c4"><label>Saída</label><input name="saida" type="date" value="${esc(v.saida)}"><div class="dica">Preenchida ao marcar "Entregue".</div></div>
          <div class="campo c12"><label>Acessórios recebidos</label><input name="acessorios" maxlength="200" value="${esc(v.acessorios)}" placeholder="Carregador, bolsa, mouse… ou nenhum"></div>
          <div class="campo c6"><label>Defeito relatado pelo cliente</label><textarea name="defeito" maxlength="2000">${esc(v.defeito)}</textarea></div>
          <div class="campo c6"><label>Laudo técnico / solução</label><textarea name="laudo" maxlength="2000">${esc(v.laudo)}</textarea></div>
          <div class="campo c12"><label>Recado para o cliente <span class="sub">(aparece na página "Acompanhar OS" do site)</span></label><input name="recado" maxlength="200" value="${esc(v.recado)}" placeholder="Ex.: peça chega na quinta; pode retirar a partir das 14h…"></div>
        </div>
        <div class="form-acoes">
          ${id ? `<button type="button" class="btn btn-danger" id="excluir">${icon('trash', 16)} Excluir</button><span style="flex:1"></span>` : ''}
          <a class="btn" href="#/os">Voltar</a>
          ${!id ? '<button type="submit" class="btn" data-depois="orc">Salvar e orçar</button>' : ''}
          <button type="submit" class="btn btn-primary">${icon('check', 16)} Salvar</button>
        </div>
      </form>
      ${id ? `<div>
        <div class="card"><div class="card-head"><h2>${icon('users')} Cliente</h2>${cli ? `<a class="btn btn-sm" href="#/clientes/${cli.id}">Abrir</a>` : ''}</div>
          <dl class="info"><dt>Nome</dt><dd>${esc(os.clienteNome)}</dd><dt>Telefone</dt><dd>${esc(formatFone(os.clienteTelefone))}</dd>
          ${os.acessorios ? `<dt>Acessórios</dt><dd>${esc(os.acessorios)}</dd>` : ''}<dt>Na bancada</dt><dd class="num">${STATUS_OS_ABERTO.includes(os.status) ? diasDesde(os.entrada) + ' dia(s)' : '-'}</dd></dl></div>
        <div class="card flush"><div class="card-head"><h2>${icon('orcamento')} Orçamentos</h2></div>
          ${orcs.length ? `<div class="tabela-wrap"><table class="tabela"><tbody>${orcs.map((o) => `
            <tr class="clicavel" data-href="#/orcamentos/${o.id}"><td><span class="cod">#${o.numero}</span><div class="sub">${dataBR(o.data)}</div></td>
            <td>${badge(o.status, STATUS_ORC)}<div class="sub">${pagamentosDo(o.id).length ? situacaoDo(o) : ''}</div></td><td class="r num">${money(o.total)}</td></tr>`).join('')}</tbody></table></div>`
            : vazio('Nenhum orçamento ainda.', 'orcamento')}</div>
      </div>` : ''}
    </div>`;
    ligar();
  };

  const ligar = () => {
    const f = el.querySelector('#f');
    el.querySelectorAll('[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
    let depois = '';
    f.querySelectorAll('[data-depois]').forEach((b) => b.addEventListener('click', () => { depois = b.dataset.depois; }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerForm(f);
      const cli = store.get('clientes', d.clienteId);
      const erros = [];
      if (!cli) erros.push('Selecione o cliente.');
      if (!d.equipamento) erros.push('Informe o equipamento.');
      if (!d.entrada) erros.push('Informe a data de entrada.');
      if (d.status === 'Entregue' && !d.saida) d.saida = hojeISO();
      el.querySelector('#erros').innerHTML = erros.length ? `<div class="erros"><ul>${erros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
      if (erros.length) return;
      const dados = { ...d, clienteNome: cli.nome, clienteTelefone: cli.telefone || '' };
      try {
        if (id) {
          await store.atualizar('os', id, dados);
          Object.assign(v, dados, { id });
          Object.assign(os, dados);
          toast('OS atualizada.');
          desenhar();
        } else {
          const nova = await store.criar('os', dados, 'os', (n) => ({ codigo: codOS(n) }));
          toast('Entrada registrada: ' + codOS(nova.numero));
          location.hash = depois === 'orc' ? '#/orcamentos/novo?os=' + nova.id : '#/os/' + nova.id;
        }
      } catch (err) { toast('Erro ao salvar: ' + err.message, 'erro'); }
    });
    el.querySelector('#excluir')?.addEventListener('click', async () => {
      const orcs = orcamentosDaOS(id);
      if (orcs.some((o) => pagamentosDo(o.id).length) || store.lista('notas').some((n) => n.osId === id && !n.cancelada)) {
        toast('Esta OS tem pagamentos ou nota de serviço. Para proteger o histórico, ela não pode ser excluída.', 'erro', 6000);
        return;
      }
      if (!(await confirmar(`Excluir ${os.codigo}${orcs.length ? ` e ${orcs.length} orçamento(s)` : ''}?`, { perigo: true, botao: 'Excluir' }))) return;
      for (const o of orcs) await store.remover('orcamentos', o.id);
      await store.remover('os', id);
      toast(os.codigo + ' excluída.');
      location.hash = '#/os';
    });
  };
  desenhar();
}
