import { store } from '../store.js';
import { icon } from '../icons.js';
import {
  esc, norm, digits, formatDoc, formatFone, formatCep, validCPF, validCNPJ, whatsapp, enderecoTexto,
  lerForm, ligarMascaras, toast, confirmar, badge, STATUS_OS, dataBR, vazio,
} from '../util.js';
import { clientesOrdenados, osDoCliente, pagamentosDo } from '../negocio.js';

export function lista(el, _p, query) {
  let termo = query.q || '';
  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb">${icon('users', 14)} atendimento</div><h1>Clientes</h1></div>
      <a class="btn btn-primary" href="#/clientes/novo">${icon('plus', 16)} Novo cliente</a>
    </div>
    <div class="filtros"><input type="search" id="q" placeholder="Nome, CPF/CNPJ, telefone, cidade…" value="${esc(termo)}"></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const tab = el.querySelector('#tab');
  const render = () => {
    const t = norm(termo).trim();
    const d = digits(termo);
    const itens = clientesOrdenados().filter((c) => !t
      || norm(c.nome + ' ' + (c.cidade || '') + ' ' + (c.email || '')).includes(t)
      || (d.length >= 3 && ((c.documento || '').includes(d) || (c.telefone || '').includes(d))));
    const nOS = {};
    store.lista('os').forEach((o) => { nOS[o.clienteId] = (nOS[o.clienteId] || 0) + 1; });
    tab.innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Cliente</th><th>Documento</th><th>Telefone</th><th>Cidade</th><th class="c">OS</th><th></th></tr></thead><tbody>
      ${itens.map((c) => {
        const wa = whatsapp(c.telefone);
        return `<tr class="clicavel" data-href="#/clientes/${c.id}">
          <td><div class="forte">${esc(c.nome)}</div>${c.email ? `<div class="sub">${esc(c.email)}</div>` : ''}</td>
          <td class="nowrap num">${c.documento ? esc(formatDoc(c.documento)) : '<span class="sub">-</span>'}</td>
          <td class="nowrap">${esc(formatFone(c.telefone))}</td>
          <td>${esc([c.cidade, c.uf].filter(Boolean).join('/'))}</td>
          <td class="c num">${nOS[c.id] || 0}</td>
          <td><div class="acoes">
            ${wa ? `<a class="btn btn-sm btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener" title="WhatsApp" data-stop>${icon('whatsapp', 16)}</a>` : ''}
            <a class="btn btn-sm" href="#/os/nova?cliente=${c.id}" title="Nova OS" data-stop>${icon('plus', 15)} OS</a>
          </div></td></tr>`;
      }).join('')}</tbody></table>` : vazio(termo ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.', 'users');
    tab.querySelectorAll('[data-href]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-stop]')) location.hash = tr.dataset.href; }));
  };
  el.querySelector('#q').addEventListener('input', (e) => { termo = e.target.value; render(); });
  render();
  return { live: true, render };
}

export function form(el, params, query) {
  const id = params.id;
  const c = id ? store.get('clientes', id) : null;
  if (id && !c) { el.innerHTML = vazio('Cliente não encontrado.'); return; }
  const v = c || { tipoDoc: 'CPF', uf: 'MG' };
  const historico = id ? osDoCliente(id) : [];

  el.innerHTML = `
    <div class="page-head">
      <div><div class="crumb"><a href="#/clientes">clientes</a> / ${id ? 'editar' : 'novo'}</div><h1>${id ? esc(c.nome) : 'Novo cliente'}</h1></div>
      ${id ? `<div class="acoes">
        ${whatsapp(c.telefone) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(whatsapp(c.telefone))}">${icon('whatsapp', 16)} WhatsApp</a>` : ''}
        <a class="btn btn-primary" href="#/os/nova?cliente=${id}">${icon('plus', 16)} Nova OS</a></div>` : ''}
    </div>
    <div class="grid ${id ? 'g-21' : ''}">
    <form class="card" id="f" novalidate>
      <div id="erros"></div>
      <div class="form">
        <div class="campo c8"><label class="req">Nome completo / Razão social</label><input name="nome" maxlength="100" value="${esc(v.nome)}" required></div>
        <div class="campo c2"><label>Tipo</label><select name="tipoDoc" id="tipoDoc">${['CPF', 'CNPJ'].map((t) => `<option ${v.tipoDoc === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo c2"><label>Documento</label><input name="documento" class="mono" inputmode="numeric" data-mask="doc" data-doc-tipo="#tipoDoc" value="${esc(formatDoc(v.documento))}"></div>
        <div class="campo c4"><label class="req">Telefone / WhatsApp</label><input name="telefone" inputmode="tel" data-mask="fone" value="${esc(formatFone(v.telefone))}"></div>
        <div class="campo c8"><label>E-mail</label><input name="email" type="email" maxlength="120" value="${esc(v.email)}"></div>
        <div class="campo c3"><label>CEP</label><input name="cep" id="cep" class="mono" inputmode="numeric" data-mask="cep" value="${esc(formatCep(v.cep))}"><div class="dica">Preenche o endereço sozinho.</div></div>
        <div class="campo c9"><label>Logradouro</label><input name="logradouro" maxlength="120" value="${esc(v.logradouro)}" placeholder="Rua, avenida…"></div>
        <div class="campo c2"><label>Número</label><input name="numero" maxlength="10" value="${esc(v.numero)}"></div>
        <div class="campo c4"><label>Complemento</label><input name="complemento" maxlength="60" value="${esc(v.complemento)}"></div>
        <div class="campo c6"><label>Bairro</label><input name="bairro" maxlength="60" value="${esc(v.bairro)}"></div>
        <div class="campo c9"><label>Cidade</label><input name="cidade" maxlength="60" value="${esc(v.cidade)}"></div>
        <div class="campo c3"><label>UF</label><input name="uf" maxlength="2" style="text-transform:uppercase" value="${esc(v.uf)}"></div>
        <div class="campo c12"><label>Observações</label><textarea name="obs" maxlength="1000">${esc(v.obs)}</textarea></div>
      </div>
      <div class="form-acoes">
        ${id ? `<button type="button" class="btn btn-danger" id="excluir">${icon('trash', 16)} Excluir</button><span style="flex:1"></span>` : ''}
        <a class="btn" href="#/clientes">Cancelar</a>
        ${!id ? `<button type="submit" class="btn" data-depois="os">Salvar e abrir OS</button>` : ''}
        <button type="submit" class="btn btn-primary">${icon('check', 16)} Salvar</button>
      </div>
    </form>
    ${id ? `<div class="card flush"><div class="card-head"><h2>${icon('os')} Histórico</h2></div>
      ${historico.length ? `<div class="tabela-wrap"><table class="tabela"><tbody>${historico.map((o) => `
        <tr class="clicavel" data-href="#/os/${o.id}"><td><span class="cod">${esc(o.codigo)}</span><div class="sub">${dataBR(o.entrada)}</div></td>
        <td>${esc(o.equipamento)} <span class="sub">${esc(o.marca || '')}</span></td><td>${badge(o.status, STATUS_OS)}</td></tr>`).join('')}</tbody></table></div>`
        : vazio('Nenhuma OS para este cliente.', 'os')}</div>` : ''}
    </div>`;

  const f = el.querySelector('#f');
  ligarMascaras(f);
  el.querySelectorAll('[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  el.querySelector('#tipoDoc').addEventListener('change', () => { f.documento.value = ''; f.documento.focus(); });

  // CEP -> endereço (ViaCEP)
  f.cep.addEventListener('blur', async () => {
    const d = digits(f.cep.value);
    if (d.length !== 8) return;
    try {
      const j = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
      if (j.erro) return;
      if (!f.logradouro.value) f.logradouro.value = j.logradouro || '';
      if (!f.bairro.value) f.bairro.value = j.bairro || '';
      if (!f.cidade.value) f.cidade.value = j.localidade || '';
      if (!f.uf.value || f.uf.value === 'MG') f.uf.value = j.uf || f.uf.value;
      if (!f.numero.value) f.numero.focus();
    } catch (e) { /* sem internet: preencher à mão */ }
  });

  let depois = '';
  f.querySelectorAll('[data-depois]').forEach((b) => b.addEventListener('click', () => { depois = b.dataset.depois; }));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = lerForm(f);
    const dados = {
      nome: d.nome, tipoDoc: d.tipoDoc, documento: digits(d.documento), telefone: digits(d.telefone), email: d.email.toLowerCase(),
      cep: digits(d.cep), logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro,
      cidade: d.cidade, uf: d.uf.toUpperCase(), obs: d.obs,
    };
    const erros = [];
    if (!dados.nome) erros.push('Informe o nome do cliente.');
    if (dados.documento) {
      if (!(dados.tipoDoc === 'CPF' ? validCPF(dados.documento) : validCNPJ(dados.documento))) erros.push(dados.tipoDoc + ' inválido. Confira os números.');
      const dup = store.lista('clientes').find((x) => x.documento === dados.documento && x.id !== id);
      if (dup) erros.push('Já existe um cliente com esse documento: ' + dup.nome + '.');
    }
    if (dados.telefone.length < 10) erros.push('Informe o telefone com DDD.');
    if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) erros.push('E-mail inválido.');
    el.querySelector('#erros').innerHTML = erros.length ? `<div class="erros">Corrija:<ul>${erros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    if (erros.length) { window.scrollTo(0, 0); return; }
    try {
      if (id) {
        await store.atualizar('clientes', id, dados);
        // mantém nome/telefone atualizados nas OS (aparecem nas listas)
        await Promise.all(store.lista('os').filter((o) => o.clienteId === id && (o.clienteNome !== dados.nome || o.clienteTelefone !== dados.telefone))
          .map((o) => store.atualizar('os', o.id, { clienteNome: dados.nome, clienteTelefone: dados.telefone })));
        toast('Cliente atualizado.');
        location.hash = '#/clientes';
      } else {
        const novo = await store.criar('clientes', dados);
        toast('Cliente cadastrado.');
        location.hash = depois === 'os' ? '#/os/nova?cliente=' + novo.id : '#/clientes';
      }
    } catch (err) { toast('Erro ao salvar: ' + err.message, 'erro'); }
  });

  el.querySelector('#excluir')?.addEventListener('click', async () => {
    const oss = osDoCliente(id);
    const orcs = store.lista('orcamentos').filter((o) => oss.some((x) => x.id === o.osId));
    if (orcs.some((o) => pagamentosDo(o.id).length)) {
      toast('Este cliente tem pagamentos registrados. Para proteger o histórico financeiro, ele não pode ser excluído.', 'erro', 6000);
      return;
    }
    if (store.lista('notas').some((n) => n.clienteId === id && !n.cancelada)) {
      toast('Este cliente tem notas de serviço emitidas e não pode ser excluído.', 'erro', 6000);
      return;
    }
    const ok = await confirmar(`Excluir "${c.nome}"? ${oss.length ? `As ${oss.length} OS e ${orcs.length} orçamento(s) dele também serão excluídos.` : ''}`, { perigo: true, botao: 'Excluir' });
    if (!ok) return;
    for (const o of orcs) await store.remover('orcamentos', o.id);
    for (const o of oss) await store.remover('os', o.id);
    await store.remover('clientes', id);
    toast('Cliente excluído.');
    location.hash = '#/clientes';
  });
}
