import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, norm, money, parseMoney, modal, lerForm, ligarMascaras, toast, confirmar, badge, vazio } from '../util.js';

export function lista(el) {
  let termo = '';
  let tipo = '';
  let inativos = false;
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('catalogo', 14)} gestão</div><h1>Produtos e serviços</h1><p>Catálogo usado para preencher os orçamentos (o preço continua editável em cada orçamento).</p></div>
      <button class="btn btn-primary" id="novo">${icon('plus', 16)} Novo item</button>
    </div>
    <div class="filtros"><input type="search" id="q" placeholder="Buscar item…">
      <div class="pills" id="pills"></div>
      <label class="check"><input type="checkbox" id="inat"> mostrar inativos</label></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const render = () => {
    const todos = store.lista('catalogo');
    el.querySelector('#pills').innerHTML = [['', 'Todos'], ['Serviço', 'Serviços'], ['Produto', 'Produtos']]
      .map(([v, r]) => `<button class="pill ${tipo === v ? 'ativo' : ''}" data-t="${v}">${r}</button>`).join('');
    el.querySelectorAll('.pill').forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.t; render(); }));
    const t = norm(termo);
    const itens = todos.filter((c) => (!tipo || c.tipo === tipo) && (inativos || c.ativo !== false) && (!t || norm(c.nome).includes(t)))
      .sort((a, b) => (a.tipo || '').localeCompare(b.tipo || '') || (a.nome || '').localeCompare(b.nome || ''));
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Tipo</th><th>Nome</th><th class="r">Estoque</th><th class="r">Valor</th></tr></thead><tbody>
      ${itens.map((c) => `<tr class="clicavel" data-id="${c.id}" style="${c.ativo === false ? 'opacity:.5' : ''}">
        <td>${badge(c.tipo, { 'Serviço': 'info', 'Produto': 'primary' })}</td>
        <td class="forte">${esc(c.nome)}${c.ativo === false ? ' <span class="badge b-muted">inativo</span>' : ''}</td>
        <td class="r num">${c.tipo === 'Produto' ? (c.estoque ?? 0) : '<span class="sub">-</span>'}</td>
        <td class="r num">${money(c.valor)}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhum item no catálogo.', 'catalogo');
    el.querySelectorAll('#tab [data-id]').forEach((tr) => tr.addEventListener('click', () => editar(store.get('catalogo', tr.dataset.id))));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  el.querySelector('#inat').addEventListener('change', (e) => { inativos = e.target.checked; render(); });
  el.querySelector('#novo').addEventListener('click', () => editar(null));
  render();
  return { live: true, render };
}

function editar(item) {
  const v = item || { tipo: 'Serviço', ativo: true, estoque: 0, valor: 0 };
  const m = modal({
    titulo: item ? 'Editar item' : 'Novo item',
    conteudo: `<form id="fi" class="form">
      <div class="campo c4"><label>Tipo</label><select name="tipo">${['Serviço', 'Produto'].map((t) => `<option ${v.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="campo c8"><label class="req">Nome</label><input name="nome" maxlength="120" value="${esc(v.nome)}" placeholder="Formatação com backup, SSD 480GB…"></div>
      <div class="campo c6"><label class="req">Valor (R$)</label><input name="valor" class="mono" inputmode="decimal" data-mask="money" value="${money(v.valor, false)}"></div>
      <div class="campo c6"><label>Estoque</label><input name="estoque" type="number" min="0" value="${v.estoque ?? 0}"><div class="dica">Só para produtos.</div></div>
      <div class="campo c12"><label class="check"><input type="checkbox" name="ativo" value="1" ${v.ativo !== false ? 'checked' : ''}> Ativo (aparece nos orçamentos)</label></div>
      <div class="campo c12" id="erro-i"></div>
      <div class="c12 form-acoes" style="margin-top:0">
        ${item ? `<button type="button" class="btn btn-danger" id="del">${icon('trash', 16)}</button><span style="flex:1"></span>` : ''}
        <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">${icon('check', 16)} Salvar</button></div>
    </form>`,
  });
  const f = m.el.querySelector('#fi');
  ligarMascaras(f);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerForm(f);
    const dados = { tipo: d.tipo, nome: d.nome, valor: parseMoney(d.valor), estoque: parseInt(d.estoque, 10) || 0, ativo: !!d.ativo };
    const dup = store.lista('catalogo').find((c) => norm(c.nome) === norm(dados.nome) && c.id !== item?.id);
    const erro = !dados.nome ? 'Informe o nome.' : dup ? 'Já existe um item com esse nome.' : '';
    if (erro) { m.el.querySelector('#erro-i').innerHTML = `<div class="erros" style="margin:0">${esc(erro)}</div>`; return; }
    if (item) await store.atualizar('catalogo', item.id, dados); else await store.criar('catalogo', dados);
    toast('Item salvo.');
    m.fechar();
  });
  m.el.querySelector('#del')?.addEventListener('click', async () => {
    if (!(await confirmar(`Excluir "${item.nome}"? Os orçamentos antigos não mudam (guardam a descrição e o preço). Se preferir manter, desmarque "Ativo".`, { perigo: true, botao: 'Excluir' }))) return;
    await store.remover('catalogo', item.id);
    toast('Item excluído.');
    m.fechar();
  });
}
