import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, norm, dataBR, formatFone, whatsapp, badge, toast, confirmar, modal, vazio } from '../util.js';
import { empresa } from '../negocio.js';
import { leadsTI } from '../loja-comum.js';

/** Remove os códigos internos [ref:...] (sacola) e [cupom:...] (roleta) gravados no detalhe. */
export const semRef = (t) => String(t || '').replace(/\s*\[(ref|cupom|pedido):[^\]]*\]/g, '');

export const STATUS_LEAD = { 'Novo': 'info', 'Em contato': 'warn', 'Virou cliente': 'ok', 'Perdido': 'muted' };

export function lista(el, _p, query) {
  let filtro = query.status || 'abertos';
  let termo = '';
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('chat', 14)} atendimento</div><h1>Pedidos do site</h1><p>Contatos enviados pelo assistente "Fale comigo" do site.</p></div>
      <a class="btn" href="./" target="_blank" rel="noopener">${icon('globe', 16)} Abrir o site</a>
    </div>
    <div id="kpis"></div>
    <div class="filtros"><input type="search" id="q" placeholder="Nome, cidade, problema…"><div class="pills" id="pills"></div></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;

  const render = () => {
    const todos = leadsTI().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    const cont = { abertos: todos.filter((l) => ['Novo', 'Em contato'].includes(l.status)).length, todos: todos.length };
    Object.keys(STATUS_LEAD).forEach((s) => { cont[s] = todos.filter((l) => l.status === s).length; });
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = todos.filter((l) => (l.criadoEm || '').startsWith(mes));
    const conv = doMes.length ? Math.round((doMes.filter((l) => l.status === 'Virou cliente').length / doMes.length) * 100) : 0;
    const remotos = doMes.filter((l) => /remoto/i.test(l.atendimento)).length;
    el.querySelector('#kpis').innerHTML = `<div class="kpis">
      <div class="kpi"><div class="kpi-top">Pedidos no mês ${icon('chat', 16)}</div><div class="kpi-val">${doMes.length}</div><div class="kpi-sub">${cont.Novo} aguardando primeiro contato</div></div>
      <div class="kpi"><div class="kpi-top">Conversão no mês ${icon('trend', 16)}</div><div class="kpi-val">${conv}%</div><div class="kpi-sub">pedidos que viraram cliente</div></div>
      <div class="kpi"><div class="kpi-top">Atendimento remoto ${icon('globe', 16)}</div><div class="kpi-val">${remotos}</div><div class="kpi-sub">pedidos de outras cidades/remoto no mês</div></div>
    </div>`;
    el.querySelector('#pills').innerHTML = ['abertos', 'todos', ...Object.keys(STATUS_LEAD)].map((s) => `<button class="pill ${filtro === s ? 'ativo' : ''}" data-s="${s}">${s === 'abertos' ? 'Em aberto' : s === 'todos' ? 'Todos' : s}<span class="n">${cont[s]}</span></button>`).join('');
    el.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.s; render(); }));
    const t = norm(termo);
    const itens = todos.filter((l) => (filtro === 'todos' || (filtro === 'abertos' ? ['Novo', 'Em contato'].includes(l.status) : l.status === filtro))
      && (!t || norm([l.nome, l.cidade, l.problema, l.equipamento, l.detalhe].join(' ')).includes(t)));
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Recebido</th><th>Contato</th><th>Pedido</th><th>Atendimento</th><th>Status</th><th></th></tr></thead><tbody>
      ${itens.map((l) => `<tr>
        <td class="nowrap">${dataBR(l.criadoEm, true)}<div class="sub">${esc(l.origem || '')}${l.utm ? ' · ' + esc(l.utm) : ''}</div>${l.indicacao ? `<div class="sub" style="color:var(--ok)">indicação: ${esc(l.indicacao)}</div>` : ''}</td>
        <td><div class="forte">${esc(l.nome)}</div><div class="sub">${esc(formatFone(l.whatsapp))} · ${esc(l.cidade)}</div></td>
        <td>${esc(l.equipamento)} · ${esc(l.problema)}<div class="sub">${esc(l.servico || '')}${l.detalhe ? ' — ' + esc(semRef(l.detalhe).slice(0, 90)) + (semRef(l.detalhe).length > 90 ? '…' : '') : ''}</div></td>
        <td class="sub">${esc(l.atendimento)}</td>
        <td>${badge(l.status || 'Novo', STATUS_LEAD)}</td>
        <td><div class="acoes">
          <a class="btn btn-sm btn-ok" target="_blank" rel="noopener" data-contato="${l.id}" href="${esc(whatsapp(l.whatsapp, `Olá, ${(l.nome || '').split(' ')[0]}! Aqui é da ${empresa().nome}. Recebi seu pedido sobre o ${(l.equipamento || '').toLowerCase()} (${(l.problema || '').toLowerCase()}). Podemos conversar?`))}">${icon('whatsapp', 15)} Responder</a>
          <button class="btn btn-sm" data-abrir="${l.id}">${icon('edit', 15)}</button>
        </div></td></tr>`).join('')}</tbody></table>` : vazio(todos.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido ainda. Divulgue o link do site!', 'chat');

    el.querySelectorAll('[data-contato]').forEach((a) => a.addEventListener('click', () => {
      const l = store.get('leads', a.dataset.contato);
      if (l && (l.status || 'Novo') === 'Novo') store.atualizar('leads', l.id, { status: 'Em contato' });
    }));
    el.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => detalhe(store.get('leads', b.dataset.abrir))));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  render();
  return { live: true, render };
}

function detalhe(l) {
  const m = modal({
    titulo: 'Pedido de ' + l.nome,
    largura: 560,
    conteudo: `<dl class="info">
        <dt>Recebido</dt><dd>${dataBR(l.criadoEm, true)}</dd><dt>WhatsApp</dt><dd>${esc(formatFone(l.whatsapp))}</dd><dt>Cidade</dt><dd>${esc(l.cidade)}</dd>
        <dt>Pedido</dt><dd>${esc(l.servico)}</dd><dt>Equipamento</dt><dd>${esc(l.equipamento)}</dd><dt>Problema</dt><dd>${esc(l.problema)}</dd>
        <dt>Atendimento</dt><dd>${esc(l.atendimento)}</dd>${l.indicacao ? `<dt>Indicação</dt><dd>${esc(l.indicacao)}</dd>` : ''}${l.origem ? `<dt>Origem</dt><dd>${esc(l.origem)}${l.utm ? ' · ' + esc(l.utm) : ''}</dd>` : ''}</dl>
      ${l.detalhe ? `<div class="texto-bloco" style="margin-top:12px">${esc(semRef(l.detalhe))}</div>` : ''}
      <form id="fl" class="form" style="margin-top:16px">
        <div class="campo c6"><label>Status</label><select name="status">${Object.keys(STATUS_LEAD).map((s) => `<option ${l.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="campo c12"><label>Anotações</label><textarea name="anotacao" maxlength="1000">${esc(l.anotacao || '')}</textarea></div>
        <div class="c12 form-acoes" style="margin-top:0">
          <button type="button" class="btn btn-danger" id="del">${icon('trash', 16)}</button><span style="flex:1"></span>
          <button type="button" class="btn" id="cliente">${icon('users', 16)} Cadastrar como cliente</button>
          <button class="btn btn-primary">${icon('check', 16)} Salvar</button></div>
      </form>`,
  });
  const f = m.el.querySelector('#fl');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.atualizar('leads', l.id, { status: f.status.value, anotacao: f.anotacao.value.trim() });
    toast('Pedido atualizado.');
    m.fechar();
  });
  m.el.querySelector('#cliente').addEventListener('click', async () => {
    const [cidade, uf] = String(l.cidade || '').split(/\s*[/-]\s*/);
    const existente = store.lista('clientes').find((c) => c.telefone && c.telefone.endsWith(String(l.whatsapp).slice(-9)));
    let id = existente?.id;
    if (!id) {
      const novo = await store.criar('clientes', { nome: l.nome, telefone: String(l.whatsapp).replace(/^55(?=\d{10,11}$)/, ''), cidade: cidade || '', uf: (uf || '').toUpperCase().slice(0, 2), tipoDoc: 'CPF', obs: `Veio pelo site: ${l.equipamento} — ${l.problema}${l.detalhe ? '. ' + l.detalhe : ''}` });
      id = novo.id;
    }
    await store.atualizar('leads', l.id, { status: 'Virou cliente', clienteId: id });
    toast(existente ? 'Cliente já existia — pedido vinculado.' : 'Cliente cadastrado a partir do pedido.');
    m.fechar();
    location.hash = '#/clientes/' + id;
  });
  m.el.querySelector('#del').addEventListener('click', async () => {
    if (!(await confirmar('Apagar este pedido? (use para spam ou a pedido do cliente — LGPD)', { perigo: true, botao: 'Apagar' }))) return;
    await store.remover('leads', l.id);
    toast('Pedido apagado.');
    m.fechar();
  });
}
