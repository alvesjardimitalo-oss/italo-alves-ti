import { store, COLECOES } from '../store.js';
import { icon } from '../icons.js';
import { esc, lerForm, toast, confirmar, digits, codOS, round2, hojeISO } from '../util.js';
import { empresa } from '../negocio.js';

export function tela(el) {
  const e = empresa();
  el.innerHTML = `
    <div class="page-head"><div><div class="crumb">${icon('config', 14)} gestão</div><h1>Configurações</h1><p>Dados que aparecem no orçamento, na nota de serviço e nos recibos.</p></div></div>
    <form id="f" class="grid g2">
      <div class="card">
        <div class="card-head"><h2>${icon('cpu')} Empresa</h2></div>
        <div class="form">
          <div class="campo c8"><label>Nome</label><input name="nome" value="${esc(e.nome)}"></div>
          <div class="campo c4"><label>CNPJ / CPF</label><input name="documento" class="mono" value="${esc(e.documento)}"></div>
          <div class="campo c12"><label>Endereço</label><input name="endereco" value="${esc(e.endereco)}"></div>
          <div class="campo c6"><label>Cidade</label><input name="cidade" value="${esc(e.cidade)}"></div>
          <div class="campo c2"><label>UF</label><input name="uf" maxlength="2" value="${esc(e.uf)}"></div>
          <div class="campo c4"><label>CEP</label><input name="cep" class="mono" value="${esc(e.cep)}"></div>
          <div class="campo c6"><label>Telefone / WhatsApp</label><input name="telefone" value="${esc(e.telefone)}"></div>
          <div class="campo c6"><label>E-mail</label><input name="email" value="${esc(e.email)}"></div>
          <div class="campo c12"><label>Frase do rodapé</label><input name="rodape" value="${esc(e.rodape)}"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>${icon('pix')} PIX</h2></div>
        <p class="sub" style="margin-top:0">Com a chave preenchida, o orçamento e a nota saem com QR Code PIX válido (padrão Banco Central) no valor do saldo.</p>
        <div class="form">
          <div class="campo c12"><label>Chave PIX</label><input name="pixChave" class="mono" value="${esc(e.pixChave)}" placeholder="e-mail, telefone (+5533…), CPF/CNPJ ou chave aleatória"></div>
          <div class="campo c6"><label>Nome do recebedor</label><input name="pixNome" maxlength="25" value="${esc(e.pixNome)}"><div class="dica">Até 25 letras, como no banco.</div></div>
          <div class="campo c6"><label>Cidade do recebedor</label><input name="pixCidade" maxlength="15" value="${esc(e.pixCidade)}"></div>
        </div>
        <div class="card-head" style="margin-top:18px"><h2>${icon('receipt')} Documentos</h2></div>
        <div class="form">
          <div class="campo c6"><label>Garantia padrão (dias)</label><input name="garantiaDias" type="number" min="0" value="${e.garantiaDias}"></div>
          <div class="campo c6"><label>Validade do orçamento (dias)</label><input name="validadeDias" type="number" min="0" value="${e.validadeDias}"></div>
          <div class="campo c12"><label>Condições (saem no orçamento)</label><textarea name="condicoes" maxlength="800">${esc(e.condicoes)}</textarea></div>
          <div class="campo c12"><label>Termos do comprovante de entrada (um por linha)</label><textarea name="termosEntrada" maxlength="1500">${esc(e.termosEntrada)}</textarea></div>
        </div>
      </div>
      <div class="c12 form-acoes" style="grid-column:1/-1;margin-top:0"><button class="btn btn-primary">${icon('check', 16)} Salvar configurações</button></div>
    </form>

    <div class="grid g2" style="margin-top:18px">
      <div class="card">
        <div class="card-head"><h2>${icon('download')} Backup</h2></div>
        <p class="sub" style="margin-top:0">Baixa todos os dados (clientes, OS, orçamentos, notas e pagamentos) em um arquivo JSON. Guarde no Google Drive de vez em quando.</p>
        <button class="btn" id="backup">${icon('download', 16)} Baixar backup</button>
      </div>
      <div class="card">
        <div class="card-head"><h2>${icon('upload')} Importar do sistema antigo (WAMP)</h2></div>
        <p class="sub" style="margin-top:0">1) Copie <code>tools/exportar_para_firebase.php</code> para a pasta do sistema antigo no WAMP e abra no navegador. 2) Envie aqui o arquivo JSON gerado. Pode importar mais de uma vez: o mesmo registro é atualizado, não duplica.</p>
        <input type="file" id="arq" accept=".json,application/json" style="display:none">
        <button class="btn" id="importar">${icon('upload', 16)} Escolher arquivo JSON</button>
        <div id="imp-res" style="margin-top:12px"></div>
      </div>
    </div>`;

  el.querySelector('#f').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = lerForm(ev.target);
    d.garantiaDias = parseInt(d.garantiaDias, 10) || 0;
    d.validadeDias = parseInt(d.validadeDias, 10) || 0;
    d.uf = (d.uf || '').toUpperCase();
    try { await store.salvarConfig(d); toast('Configurações salvas.'); } catch (err) { toast('Erro: ' + err.message, 'erro'); }
  });

  el.querySelector('#backup').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(store.exportar(), null, 1)], { type: 'application/json' }));
    a.download = `italo-alves-ti_backup_${hojeISO()}.json`;
    a.click();
  });

  const arq = el.querySelector('#arq');
  el.querySelector('#importar').addEventListener('click', () => arq.click());
  arq.addEventListener('change', async () => {
    const file = arq.files[0];
    arq.value = '';
    if (!file) return;
    let json;
    try { json = JSON.parse(await file.text()); } catch (e) { toast('Arquivo inválido.', 'erro'); return; }
    const plano = json.origem === 'mysql' ? converterMySQL(json) : converterBackup(json);
    if (!plano) { toast('Formato de arquivo não reconhecido.', 'erro'); return; }
    const resumo = Object.entries(plano.resumo).map(([k, n]) => `${n} ${k}`).join(', ');
    if (!(await confirmar(`Importar ${resumo}?`, { botao: 'Importar' }))) return;
    el.querySelector('#imp-res').innerHTML = '<div class="sub">Importando…</div>';
    try {
      const cont = {};
      Object.entries(plano.contadores || {}).forEach(([k, n]) => { cont[k] = Math.max(Number(n) || 0, Number(store.contadores[k]) || 0); });
      await store.importar(plano.itens, cont);
      el.querySelector('#imp-res').innerHTML = `<div class="aviso" style="color:var(--ok);background:var(--ok-bg);border-color:transparent">${icon('check')}<span>Importado: ${esc(resumo)}.</span></div>`;
      toast('Importação concluída.');
    } catch (err) {
      el.querySelector('#imp-res').innerHTML = `<div class="erros">${esc(err.message)}</div>`;
    }
  });
}

/* ---------------- Conversão do MySQL antigo ---------------- */
const FORMA = { 'Cartão Crédito': 'Cartão de Crédito', 'Cartão Débito': 'Cartão de Débito' };
const dataISO = (v) => (v && !String(v).startsWith('0000') ? String(v).slice(0, 10) : '');
const dataHoraISO = (v) => (v && !String(v).startsWith('0000') ? new Date(String(v).replace(' ', 'T')).toISOString() : new Date().toISOString());

export function converterMySQL(j) {
  const itens = [];
  const agora = new Date().toISOString();
  const meta = { criadoEm: agora, criadoPor: 'importação' };
  const cli = {}; const os = {}; const orc = {};
  const pagosPorOrc = {};
  (j.pagamentos || []).forEach((p) => { pagosPorOrc[p.orcamento_id] = (pagosPorOrc[p.orcamento_id] || 0) + Number(p.valor_pago || 0); });

  (j.clientes || []).forEach((c) => {
    const id = 'm-cli-' + c.id;
    const d = {
      nome: c.nome_completo || '(sem nome)', tipoDoc: c.tipo_doc || 'CPF', documento: digits(c.documento), telefone: digits(c.telefone),
      email: (c.email || '').toLowerCase(), cep: digits(c.cep), logradouro: [c.logradouro, c.nome_logradouro].filter(Boolean).join(' '),
      numero: c.numero || '', complemento: c.complemento || '', bairro: c.bairro || '', cidade: c.cidade || '', uf: c.uf || '', obs: c.observacoes || '', ...meta,
    };
    cli[c.id] = { id, ...d };
    itens.push({ col: 'clientes', id, dados: d });
  });
  const itensCat = {};
  (j.itens || []).forEach((i) => {
    const id = 'm-cat-' + i.id;
    itensCat[i.id] = i;
    itens.push({ col: 'catalogo', id, dados: { tipo: i.tipo === 'Produto' ? 'Produto' : 'Serviço', nome: i.nome || '', valor: Number(i.valor_unitario || 0), estoque: Number(i.quantidade || 0), ativo: i.ativo === undefined ? true : Number(i.ativo) === 1, ...meta } });
  });
  const orcsPorEquip = {};
  (j.orcamentos || []).forEach((o) => { (orcsPorEquip[o.equipamento_id] = orcsPorEquip[o.equipamento_id] || []).push(o); });
  (j.equipamentos || []).forEach((e) => {
    const id = 'm-os-' + e.id;
    const c = cli[e.cliente_id] || {};
    const pago = (orcsPorEquip[e.id] || []).some((o) => pagosPorOrc[o.id] > 0);
    const d = {
      numero: Number(e.id), codigo: e.cod_equipamento || codOS(e.id), clienteId: c.id || '', clienteNome: c.nome || '', clienteTelefone: c.telefone || '',
      equipamento: e.nome || '', marca: e.marca || '', modelo: e.modelo || '', serie: e.numero_serie || '', acessorios: e.acessorios || '',
      entrada: dataISO(e.data_entrada), saida: dataISO(e.data_saida), status: e.status || (pago ? 'Entregue' : 'Recebido'),
      defeito: e.sintomas || '', laudo: e.solucao || '', ...meta,
    };
    os[e.id] = { id, ...d };
    itens.push({ col: 'os', id, dados: d });
  });
  const linhas = {};
  (j.orcamento_itens || []).forEach((l) => {
    const cat = itensCat[l.item_id] || {};
    (linhas[l.orcamento_id] = linhas[l.orcamento_id] || []).push({
      descricao: l.descricao || cat.nome || 'Item', tipo: (l.tipo || cat.tipo) === 'Produto' ? 'Produto' : 'Serviço',
      qtd: Number(l.quantidade || 1), valor: Number(l.valor_unitario || 0),
    });
  });
  (j.orcamentos || []).forEach((o) => {
    const id = 'm-orc-' + o.id;
    const e = os[o.equipamento_id] || {};
    const ls = linhas[o.id] || [];
    const subtotal = round2(ls.reduce((s, l) => s + l.qtd * l.valor, 0));
    const d = {
      numero: Number(o.id), osId: e.id || '', osCodigo: e.codigo || '', clienteId: e.clienteId || '', clienteNome: e.clienteNome || '', clienteTelefone: e.clienteTelefone || '',
      equipamentoDesc: [e.equipamento, e.marca, e.modelo].filter(Boolean).join(' '), itens: ls, subtotal,
      desconto: Number(o.desconto || 0), total: Number(o.total ?? subtotal), status: o.status || (pagosPorOrc[o.id] > 0 ? 'Aprovado' : 'Pendente'),
      validadeDias: Number(o.validade_dias || 15), obs: o.observacoes || '', data: dataHoraISO(o.data_criacao), ...meta,
    };
    orc[o.id] = { id, ...d };
    itens.push({ col: 'orcamentos', id, dados: d });
  });
  (j.pagamentos || []).forEach((p) => {
    const o = orc[p.orcamento_id] || {};
    itens.push({ col: 'pagamentos', id: 'm-pag-' + p.id, dados: {
      numero: Number(p.id), orcamentoId: o.id || '', orcamentoNumero: o.numero || 0, osId: o.osId || '', osCodigo: o.osCodigo || '',
      clienteId: o.clienteId || '', clienteNome: o.clienteNome || '', valor: Number(p.valor_pago || 0), data: dataISO(p.data_pagamento),
      forma: FORMA[p.forma_pagamento] || p.forma_pagamento || 'Dinheiro', obs: p.observacao || '', ...meta,
    } });
  });
  const max = (arr) => Math.max(0, ...(arr || []).map((x) => Number(x.id) || 0));
  return {
    itens,
    contadores: { os: max(j.equipamentos), orcamento: max(j.orcamentos), recibo: max(j.pagamentos) },
    resumo: { clientes: (j.clientes || []).length, 'itens do catálogo': (j.itens || []).length, OS: (j.equipamentos || []).length, 'orçamentos': (j.orcamentos || []).length, pagamentos: (j.pagamentos || []).length },
  };
}

/* ---------------- Restaurar backup deste sistema ---------------- */
function converterBackup(j) {
  if (!j || j.versao !== 1) return null;
  const itens = [];
  const resumo = {};
  COLECOES.forEach((c) => {
    (j[c] || []).forEach((d) => { const { id, ...resto } = d; itens.push({ col: c, id, dados: resto }); });
    resumo[c] = (j[c] || []).length;
  });
  return { itens, contadores: j.contadores || {}, resumo };
}

