// Gestão das Sacolas Misteriosas dentro da área técnica da Ítalo InfoTec.
// Conteúdo interno fica somente em ti/base/sacolas (acesso restrito).
// Vitrine é uma cópia limitada em ti/base/rastreio/sacolas-publicas.
import { store } from '../store.js';
import { esc, money, parseMoney, toast, confirmar, dataBR, whatsapp, modal } from '../util.js';
import { semRef } from './leads.js';
import { icon } from '../icons.js';

const URL_LOJA = 'https://italoinfotec.com.br/sacola-misteriosa/';
const soNumeros = (v) => String(v || '').replace(/\D/g, '');
function celular(v) {
  const d = soNumeros(v);
  return (d.length === 10 || d.length === 11) ? '55' + d : d;
}
const publicos = (xs) => xs.map((s) => ({
  id: String(s.id || ''), titulo: String(s.titulo || '').slice(0, 100),
  descricaoPublica: String(s.descricaoPublica || '').slice(0, 260),
  valor: Number(s.valor) || 0, estoque: Math.max(0, Number(s.estoque) || 0), ativo: s.ativo !== false,
})).filter((s) => s.id && s.titulo && s.valor > 0);
const sacolasAtuais = () => store.lista('sacolas');

/** Descobre qual sacola o cliente pediu: pelo código [ref:...] ou, em pedidos antigos, pelo título. */
function sacolaDoPedido(p) {
  const ref = /\[ref:([^\]]+)\]/.exec(p.detalhe || '');
  if (ref && store.get('sacolas', ref[1])) return store.get('sacolas', ref[1]);
  const t = /Sacola:\s*(.+?)\s*(\||\[|$)/.exec(p.detalhe || '');
  if (!t) return null;
  const iguais = sacolasAtuais().filter((s) => (s.titulo || '').trim().toLowerCase() === t[1].trim().toLowerCase());
  return iguais.length === 1 ? iguais[0] : null;
}
const pago = (p) => Boolean(p.pagamentoConfirmadoEm);

/** Pergunta qual sacola foi vendida quando o pedido não identifica (pedidos antigos). */
function escolherSacola(p) {
  return new Promise((ok) => {
    const opcoes = sacolasAtuais().filter((s) => Number(s.estoque) > 0);
    if (!opcoes.length) { toast('Nenhuma sacola com estoque para dar baixa.', 'erro'); ok(null); return; }
    let escolhida = null;
    const m = modal({
      titulo: 'Qual sacola foi paga?',
      conteudo: '<p class="sub">Não consegui identificar a sacola deste pedido. Escolha qual vai sair do estoque.</p>' +
        '<p class="sub" style="margin-top:6px">' + esc(semRef(p.detalhe || '')) + '</p>' +
        '<div class="campo" style="margin-top:12px"><select id="sacola-baixa">' +
        opcoes.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.titulo) + ' · ' + money(s.valor) + ' · estoque ' + (Number(s.estoque) || 0) + '</option>').join('') +
        '</select></div><div class="form-acoes"><button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn-primary" id="ok-sacola-baixa">Continuar</button></div>',
      aoFechar: () => ok(escolhida),
    });
    m.el.querySelector('#ok-sacola-baixa').onclick = () => {
      escolhida = store.get('sacolas', m.el.querySelector('#sacola-baixa').value);
      m.fechar();
    };
  });
}
async function publicar(xs=sacolasAtuais(), tel=store.config.sacolasWhatsapp || '') {
  await store.definir('rastreio', 'sacolas-publicas', {
    itens: publicos(xs),
    whatsapp: celular(tel),
    atualizadoEm: new Date().toISOString(),
  });
}
function tituloPagina() {
  return '<div class="page-head"><div><div class="crumb">' + icon('catalogo',14) +
    ' campanha promocional</div><h1>Sacolas Misteriosas · Karen</h1>' +
    '<p>Cadastre preços e estoques, mantenha os produtos internos em segredo e publique na vitrine.</p></div>' +
    '<a class="btn" href="' + URL_LOJA + '" target="_blank" rel="noopener">' +
    icon('globe',16) + ' Abrir vitrine</a></div>';
}
export function tela(el) {
  el.innerHTML = tituloPagina() + '<div class="grid g2" style="margin-bottom:18px">' +
    '<div class="card"><div class="card-head"><h2>Configuração da promoção</h2></div>' +
    '<form id="cfg-karen" class="form"><div class="campo c12"><label>WhatsApp da Karen (com DDD)</label>' +
    '<input name="numero" inputmode="tel" type="tel" placeholder="(33) 99999-9999" value="' +
    esc(store.config.sacolasWhatsapp || '') + '"><div class="dica">Esse contato recebe os pedidos. Não usa o WhatsApp da assistência técnica.</div></div>' +
    '<div class="c12 form-acoes" style="margin-top:0"><button class="btn btn-primary">Salvar e publicar contato</button></div></form></div>' +
    '<div class="card"><div class="card-head"><h2>Vitrine pública</h2></div>' +
    '<p class="sub">Apenas nome, descrição pública, valor, estoque e disponibilidade são enviados à página do cliente. O conteúdo real permanece privado.</p>' +
    '<div class="acoes" style="margin-top:16px;justify-content:flex-start"><button class="btn" id="publicar-karen">' +
    icon('upload',16) + ' Sincronizar vitrine</button><button class="btn btn-primary" id="nova-karen">' +
    icon('plus',16) + ' Nova sacola</button></div><div id="status-karen" class="sub" style="margin-top:12px"></div></div></div>' +
    '<div class="card flush"><div class="card-head"><h2>Catálogo de sacolas</h2><span id="resumo-karen" class="sub"></span></div>' +
    '<div class="tabela-wrap" id="tabela-karen"></div></div>' +
    '<div class="card flush" style="margin-top:20px"><div class="card-head"><h2>Solicitações recebidas</h2>' +
    '<a href="#/leads" class="btn btn-sm">Ver todos os pedidos</a></div>' +
    '<div class="tabela-wrap" id="pedidos-karen"></div></div>' +
    '<div id="editor-karen"></div>';
  const status = (msg) => { const e = el.querySelector('#status-karen'); if (e) e.textContent = msg; };
  const sincronizar = async (lista) => {
    await publicar(lista);
    status('Catálogo sincronizado com a vitrine.');
  };
  el.querySelector('#cfg-karen').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const numero = celular(f.numero.value);
    if (numero && !/^55[0-9]{10,11}$/.test(numero)) {
      toast('Informe um WhatsApp válido com DDD ou deixe vazio.', 'erro'); return;
    }
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await store.salvarConfig({ sacolasWhatsapp: numero });
      await publicar(sacolasAtuais(), numero);
      status('WhatsApp da Karen salvo e publicado.');
      toast('Contato atualizado.');
    } catch (e) {
      toast('Não foi possível salvar o contato: ' + e.message, 'erro');
    } finally { btn.disabled = false; }
  });
  el.querySelector('#publicar-karen').addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    try { await sincronizar(); toast('Vitrine sincronizada.'); }
    catch (e) { toast('Erro ao publicar: ' + e.message, 'erro'); }
    finally { ev.currentTarget.disabled = false; }
  });
  el.querySelector('#nova-karen').addEventListener('click', () => editar(null));
  const render = () => {
    const todos = sacolasAtuais().slice().sort((a,b) =>
      (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    el.querySelector('#resumo-karen').textContent =
      todos.length + ' cadastradas · ' + todos.filter((s) => s.ativo !== false && Number(s.estoque) > 0).length + ' disponíveis';
    el.querySelector('#tabela-karen').innerHTML = todos.length ?
      '<table class="tabela"><thead><tr><th>Sacola</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead><tbody>' +
      todos.map((s) => '<tr><td><div class="forte">' + esc(s.titulo) + '</div><small class="sub">' +
      esc(s.descricaoPublica || '') + '</small></td><td class="num">' + money(s.valor) +
      '</td><td class="num">' + (Number(s.estoque) || 0) + '</td><td>' +
      (s.ativo === false ? '<span class="badge b-muted">Oculta</span>' :
      Number(s.estoque) > 0 ? '<span class="badge b-ok">Disponível</span>' :
      '<span class="badge b-warn">Esgotada</span>') + '</td><td><button type="button" class="btn btn-sm" data-editar="' +
      esc(s.id) + '">' + icon('edit',14) + ' Editar</button></td></tr>').join('') + '</tbody></table>' :
      '<div style="padding:28px" class="sub">Nenhuma sacola cadastrada. Clique em “Nova sacola” para começar.</div>';
    el.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () =>
      editar(store.get('sacolas', b.dataset.editar)));
    const pedidos = store.lista('leads')
      .filter((p) => p.origem === 'sacola-misteriosa' || p.servico === 'Sacola Misteriosa')
      .sort((a,b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    el.querySelector('#pedidos-karen').innerHTML = pedidos.length ?
      '<table class="tabela"><thead><tr><th>Data</th><th>Cliente</th><th>Sacola solicitada</th><th>Status</th><th>Ação</th></tr></thead><tbody>' +
      pedidos.map((p) => '<tr><td class="nowrap">' + esc(dataBR(p.criadoEm, true)) +
      '</td><td><b>' + esc(p.nome) + '</b><div class="sub">' + esc(p.whatsapp) + '</div></td>' +
      '<td>' + esc(semRef(p.detalhe || '')) + '</td><td>' +
      (pago(p) ? '<span class="badge b-ok">Pago · saiu do estoque</span><div class="sub">' + esc(dataBR(p.pagamentoConfirmadoEm, true)) + '</div>'
        : esc(p.status || 'Novo')) + '</td><td class="nowrap">' +
      (pago(p)
        ? '<button type="button" class="btn btn-sm" data-desfazer="' + esc(p.id) + '" title="Devolve 1 unidade ao estoque">Desfazer</button> '
        : '<button type="button" class="btn btn-sm btn-primary" data-pago="' + esc(p.id) + '">Confirmar pagamento</button> ') +
      '<a class="btn btn-sm" target="_blank" rel="noopener" href="' +
      esc(whatsapp(p.whatsapp, 'Olá, ' + (p.nome || '').split(' ')[0] +
      '! Aqui é da Karen Cosméticos. Recebemos sua solicitação de Sacola Misteriosa. Podemos confirmar seu pedido?')) +
      '">Responder</a></td></tr>').join('') + '</tbody></table>' :
      '<div class="sub" style="padding:28px">Ainda não há solicitações de sacolas.</div>';
    el.querySelectorAll('[data-pago]').forEach((b) => b.onclick = () => confirmarPagamento(b, store.get('leads', b.dataset.pago)));
    el.querySelectorAll('[data-desfazer]').forEach((b) => b.onclick = () => desfazerPagamento(b, store.get('leads', b.dataset.desfazer)));
  };

  // Pagamento confirmado: marca o pedido como pago e tira 1 unidade do estoque,
  // tudo na mesma transação (não baixa duas vezes, nem deixa estoque negativo).
  async function confirmarPagamento(botao, p) {
    if (!p || pago(p)) return;
    const sacola = sacolaDoPedido(p) || await escolherSacola(p);
    if (!sacola) return;
    const estoque = Number(sacola.estoque) || 0;
    if (estoque <= 0) { toast('A sacola "' + sacola.titulo + '" está sem estoque. Ajuste o estoque antes de confirmar.', 'erro'); return; }
    if (!(await confirmar('Confirmar o pagamento de ' + (p.nome || 'cliente') + ' pela sacola "' + sacola.titulo +
      '"? 1 unidade sai do estoque (de ' + estoque + ' para ' + (estoque - 1) + ') e a vitrine é atualizada.',
      { titulo: 'Confirmar pagamento', botao: 'Confirmar e dar baixa' }))) return;
    botao.disabled = true;
    try {
      let restante = 0;
      await store.transacao([{ col: 'leads', id: p.id }, { col: 'sacolas', id: sacola.id }], ([lead, sac]) => {
        if (!lead) throw new Error('pedido não encontrado');
        if (lead.pagamentoConfirmadoEm) throw new Error('este pagamento já foi confirmado');
        if (!sac) throw new Error('a sacola não existe mais');
        const atual = Number(sac.estoque) || 0;
        if (atual <= 0) throw new Error('a sacola "' + sac.titulo + '" esgotou');
        restante = atual - 1;
        return [
          { col: 'sacolas', id: sac.id, dados: { estoque: restante } },
          { col: 'leads', id: lead.id, dados: { status: 'Virou cliente', pagamentoConfirmadoEm: new Date().toISOString(), sacolaBaixadaId: sac.id } },
        ];
      });
      await publicar(sacolasAtuais().map((s) => (s.id === sacola.id ? { ...s, estoque: restante } : s)));
      toast(restante > 0 ? 'Pagamento confirmado. Restam ' + restante + ' unidade(s) de "' + sacola.titulo + '".'
        : 'Pagamento confirmado. "' + sacola.titulo + '" esgotou e aparece como esgotada na vitrine.');
      render();
    } catch (e) {
      toast('Não foi possível confirmar: ' + e.message, 'erro');
      botao.disabled = false;
    }
  }

  // Desfaz uma confirmação feita por engano: devolve 1 unidade ao estoque.
  async function desfazerPagamento(botao, p) {
    if (!p || !pago(p)) return;
    const sacola = store.get('sacolas', p.sacolaBaixadaId);
    if (!sacola) { toast('A sacola deste pedido foi excluída; ajuste o estoque manualmente.', 'erro'); return; }
    if (!(await confirmar('Desfazer a confirmação de pagamento de ' + (p.nome || 'cliente') + '? 1 unidade de "' +
      sacola.titulo + '" volta ao estoque.', { titulo: 'Desfazer pagamento', botao: 'Desfazer', perigo: true }))) return;
    botao.disabled = true;
    try {
      let novo = 0;
      await store.transacao([{ col: 'leads', id: p.id }, { col: 'sacolas', id: sacola.id }], ([lead, sac]) => {
        if (!lead || !lead.pagamentoConfirmadoEm) throw new Error('este pagamento não está confirmado');
        if (!sac) throw new Error('a sacola não existe mais');
        novo = (Number(sac.estoque) || 0) + 1;
        return [
          { col: 'sacolas', id: sac.id, dados: { estoque: novo } },
          { col: 'leads', id: lead.id, dados: { status: 'Em contato', pagamentoConfirmadoEm: '', sacolaBaixadaId: '' } },
        ];
      });
      await publicar(sacolasAtuais().map((s) => (s.id === sacola.id ? { ...s, estoque: novo } : s)));
      toast('Confirmação desfeita. Estoque de "' + sacola.titulo + '": ' + novo + '.');
      render();
    } catch (e) {
      toast('Não foi possível desfazer: ' + e.message, 'erro');
      botao.disabled = false;
    }
  }
  async function editar(item) {
    const container = el.querySelector('#editor-karen');
    container.innerHTML = '<div class="card" style="margin-top:20px" id="card-editor-karen">' +
      '<div class="card-head"><h2>' + (item ? 'Editar sacola' : 'Cadastrar nova sacola') + '</h2>' +
      '<button type="button" class="btn btn-sm" id="cancelar-karen">Fechar</button></div>' +
      '<form id="form-karen" class="form">' +
      '<div class="campo c6"><label>Título público *</label><input name="titulo" required maxlength="100" placeholder="Ex.: Sacola Surpresa" value="' + esc(item?.titulo || '') + '"></div>' +
      '<div class="campo c3"><label>Preço (R$) *</label><input name="valor" inputmode="decimal" required placeholder="Ex.: 59,90" value="' + esc(item ? money(item.valor, false) : '') + '"></div>' +
      '<div class="campo c3"><label>Quantidade disponível *</label><input name="estoque" type="number" min="0" max="99999" required value="' + esc(item?.estoque ?? 0) + '"></div>' +
      '<div class="campo c12"><label>Descrição pública (sem revelar os itens)</label><textarea name="descricaoPublica" maxlength="260" placeholder="Ex.: Produtos de beleza selecionados com carinho">' + esc(item?.descricaoPublica || '') + '</textarea></div>' +
      '<div class="campo c12"><label>Conteúdo secreto / composição da sacola (só admin)</label>' +
      '<textarea name="conteudoSecreto" maxlength="6000" rows="5" placeholder="Relacione os produtos, marcas e quantidades. Esta informação NÃO será publicada.">' +
      esc(item?.conteudoSecreto || '') + '</textarea></div>' +
      '<div class="campo c6"><label>Custo interno (R$, opcional)</label><input name="custoInterno" inputmode="decimal" placeholder="0,00" value="' +
      esc(item ? money(item.custoInterno || 0, false) : '') + '"></div>' +
      '<div class="campo c6"><label>Observações internas</label><input name="notasInternas" maxlength="500" value="' + esc(item?.notasInternas || '') + '"></div>' +
      '<div class="campo c12"><label class="check"><input type="checkbox" name="ativo" ' +
      (item?.ativo === false ? '' : 'checked') + '> Exibir esta sacola na vitrine pública</label></div>' +
      '<div class="c12 form-acoes" style="margin-top:0">' +
      (item ? '<button type="button" class="btn btn-danger" id="excluir-karen">Excluir sacola</button>' : '') +
      '<span style="flex:1"></span><button type="submit" class="btn btn-primary">Salvar e publicar</button></div></form></div>';
    container.scrollIntoView({behavior:'smooth',block:'start'});
    container.querySelector('#cancelar-karen').onclick = () => container.replaceChildren();
    const f = container.querySelector('#form-karen');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const dados = {
        titulo:String(fd.get('titulo') || '').trim().slice(0,100),
        valor:parseMoney(fd.get('valor')),
        estoque:Number.parseInt(fd.get('estoque'),10),
        descricaoPublica:String(fd.get('descricaoPublica') || '').trim().slice(0,260),
        conteudoSecreto:String(fd.get('conteudoSecreto') || '').trim().slice(0,6000),
        custoInterno:parseMoney(fd.get('custoInterno')),
        notasInternas:String(fd.get('notasInternas') || '').trim().slice(0,500),
        ativo:fd.has('ativo')
      };
      if (!dados.titulo || dados.valor <= 0 || !Number.isInteger(dados.estoque) ||
          dados.estoque < 0 || dados.estoque > 99999) {
        toast('Informe título, preço maior que zero e estoque válido.', 'erro'); return;
      }
      const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
      try {
        let novo;
        if (item) { await store.atualizar('sacolas',item.id,dados); novo = {...item,...dados}; }
        else novo = await store.criar('sacolas',dados);
        const lista = sacolasAtuais().filter((s) => s.id !== novo.id).concat(novo);
        await sincronizar(lista);
        toast('Sacola salva e publicada.');
        container.replaceChildren();
        render();
      } catch(e) {
        toast('Erro ao salvar ou publicar: ' + e.message, 'erro');
      } finally { btn.disabled = false; }
    };
    const excluir = container.querySelector('#excluir-karen');
    if (excluir) excluir.onclick = async () => {
      if (!(await confirmar('Excluir a sacola "' + item.titulo +
        '"? Ela sairá da vitrine. Pedidos anteriores permanecerão no histórico.', {perigo:true,botao:'Excluir'}))) return;
      excluir.disabled = true;
      try {
        await store.remover('sacolas',item.id);
        await sincronizar(sacolasAtuais().filter((s) => s.id !== item.id));
        toast('Sacola excluída da vitrine.');
        container.replaceChildren();
        render();
      } catch(e) { toast('Erro ao excluir: ' + e.message, 'erro'); excluir.disabled = false; }
    };
  }
  render();
  return { live:true, render };
}
