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

// ---------- Cupons da roleta da Black Friday ----------
/** Lê o cupom gravado pela roleta: detalhe "... [cupom:BF-XXXXX:7]". */
function cupomDoLead(l) {
  const m = /\[cupom:([A-Z0-9-]+):(\d+)\]/.exec(l.detalhe || '');
  return m ? { codigo: m[1], pct: Number(m[2]) } : null;
}
const BF_FIM = new Date('2026-11-30T23:59:59-03:00');
const ROLETA_URL = 'https://italoinfotec.com.br/sacola-misteriosa/roleta/';
/**
 * Lista os cupons. Regras: só o primeiro giro de cada WhatsApp vale; giros extras
 * (link enviado pela Karen) valem uma vez por link. Calcula também as indicações.
 */
function listarCupons() {
  const cupons = store.lista('leads')
    .filter((l) => l.origem === 'black-friday')
    .map((l) => ({ lead: l, ...cupomDoLead(l), quando: String(l.criadoEm || ''), ind: String(l.indicacao || '') }))
    .filter((c) => c.codigo)
    .sort((a, b) => a.quando.localeCompare(b.quando));
  const telefones = new Set(), tokens = new Set();
  cupons.forEach((c) => {
    const tel = String(c.lead.whatsapp || '');
    if (c.ind.startsWith('giro:')) {
      c.extra = true;
      c.repetido = tokens.has(c.ind);
      tokens.add(c.ind);
    } else {
      c.repetido = telefones.has(tel);
      telefones.add(tel);
    }
  });
  cupons.forEach((c) => {
    const amigas = cupons.filter((x) => x.ind === 'amiga:' + c.codigo && !x.repetido && String(x.lead.whatsapp) !== String(c.lead.whatsapp));
    c.amigas = amigas.length;
    c.amigasCompraram = amigas.filter((x) => x.lead.cupomUsadoEm).length;
    c.girosExtras = Number(c.lead.girosExtras) || 0;
  });
  return cupons.reverse();
}
let ultimoPlacar = '';


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
    '<div class="card flush" style="margin-top:20px"><div class="card-head"><h2>Cupons da Black Friday</h2><span id="resumo-cupons" class="sub"></span></div>' +
    '<div id="aviso-cupons" style="padding:0 20px"></div>' +
    '<div style="padding:0 20px 14px;display:flex;gap:10px;flex-wrap:wrap"><input id="busca-cupom" placeholder="Digite o código (BF-XXXXX), nome ou WhatsApp" style="flex:1 1 260px" autocomplete="off">' +
    '<select id="filtro-cupom" style="flex:0 0 auto"><option value="">Todos os cupons</option><option value="abertos">Válidos ainda não usados</option><option value="usados">Usados</option><option value="indicacoes">Com giro extra para liberar</option></select></div>' +
    '<div class="tabela-wrap" id="cupons-karen"></div></div>' +
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
    desenharCupons();
    el.querySelectorAll('[data-desfazer]').forEach((b) => b.onclick = () => desfazerPagamento(b, store.get('leads', b.dataset.desfazer)));
  };

  function desenharCupons() {
    const alvo = el.querySelector('#cupons-karen');
    if (!alvo) return;
    const busca = el.querySelector('#busca-cupom');
    const filtro = el.querySelector('#filtro-cupom');
    const termo = (busca.value || '').trim().toUpperCase();
    const todos = listarCupons();
    const validos = todos.filter((c) => !c.repetido);
    const abertos = validos.filter((c) => !c.lead.cupomUsadoEm);
    const usados = validos.length - abertos.length;
    const paraLiberar = validos.filter((c) => c.amigasCompraram > c.girosExtras);
    el.querySelector('#resumo-cupons').textContent = validos.length + ' cupons · ' + usados + ' usados' +
      (todos.length > validos.length ? ' · ' + (todos.length - validos.length) + ' não valem' : '');
    publicarPlacar(validos.length, usados);

    // Aviso: lembrar quem não usou (últimos 3 dias) e giros extras pendentes.
    const dias = Math.ceil((BF_FIM - Date.now()) / 864e5);
    const avisos = [];
    if (dias >= 0 && dias <= 3 && abertos.length) avisos.push('Faltam ' + (dias || 'menos de 1') + ' dia(s) para acabar a Black Friday e ' + abertos.length + ' cupom(ns) ainda não foram usados. Filtre por <b>Válidos ainda não usados</b> e mande um lembrete.');
    if (paraLiberar.length) avisos.push(paraLiberar.length + ' cliente(s) indicaram amigas que já compraram e ganharam um giro extra. Filtre por <b>Com giro extra para liberar</b>.');
    el.querySelector('#aviso-cupons').innerHTML = avisos.map((t) => '<div class="alerta" style="margin:0 0 12px;padding:10px 14px;border-radius:10px;background:var(--warn-bg);color:var(--warn)">' + t + '</div>').join('');

    const digitos = termo.replace(/\D/g, '');
    let lista = !termo ? todos : todos.filter((c) => c.codigo.includes(termo) ||
      String(c.lead.nome || '').toUpperCase().includes(termo) || (digitos.length >= 4 && String(c.lead.whatsapp || '').includes(digitos)));
    if (filtro.value === 'abertos') lista = lista.filter((c) => !c.repetido && !c.lead.cupomUsadoEm);
    if (filtro.value === 'usados') lista = lista.filter((c) => !c.repetido && c.lead.cupomUsadoEm);
    if (filtro.value === 'indicacoes') lista = lista.filter((c) => !c.repetido && c.amigasCompraram > c.girosExtras);

    const situacao = (c) => c.repetido ? '<span class="badge b-danger">Não vale: ' + (c.extra ? 'giro extra já usado' : 'número já tinha girado') + '</span>'
      : c.lead.cupomUsadoEm ? '<span class="badge b-muted">Usado em ' + esc(dataBR(c.lead.cupomUsadoEm, true)) + '</span>'
      : '<span class="badge b-ok">Válido</span>';
    const origem = (c) => c.extra ? '<span class="badge b-info">Giro extra</span>' : c.ind.startsWith('amiga:') ? '<span class="sub">Indicada por ' + esc(c.ind.slice(6)) + '</span>' : '';
    const indicacoes = (c) => c.amigas ? c.amigas + ' amiga(s) · ' + c.amigasCompraram + ' comprou(aram)' : '—';
    const lembrete = (c) => 'Olá, ' + (c.lead.nome || '').split(' ')[0] + '! Aqui é a Karen 💝 Seu cupom ' + c.codigo + ' de ' + c.pct +
      '% da Black Friday vale até 30/11. Quer garantir seu perfume? Veja os preços com o seu cupom: ' + ROLETA_URL;
    alvo.innerHTML = lista.length ? '<table><thead><tr><th>Cupom</th><th>Desconto</th><th>Cliente</th><th>WhatsApp</th><th>Girou em</th><th>Indicações</th><th>Situação</th><th>Ação</th></tr></thead><tbody>' +
      lista.slice(0, 300).map((c) => '<tr><td><strong>' + esc(c.codigo) + '</strong><div>' + origem(c) + '</div></td><td><strong>' + c.pct + '%</strong></td><td>' + esc(c.lead.nome || '') +
        '</td><td>' + esc(c.lead.whatsapp || '') + '</td><td>' + esc(dataBR(c.lead.criadoEm, true)) + '</td><td>' + indicacoes(c) + '</td><td>' + situacao(c) + '</td><td class="nowrap">' +
        (c.repetido ? '' : c.lead.cupomUsadoEm
          ? '<button type="button" class="btn btn-sm" data-cupom-desfazer="' + esc(c.lead.id) + '">Desfazer uso</button>'
          : '<button type="button" class="btn btn-sm btn-primary" data-cupom-usar="' + esc(c.lead.id) + '">Marcar como usado</button>') +
        (!c.repetido && c.amigasCompraram > c.girosExtras ? ' <button type="button" class="btn btn-sm btn-primary" data-giro-extra="' + esc(c.lead.id) + '">Liberar giro extra</button>' : '') +
        (c.lead.giroExtraLink ? ' <a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(c.lead.whatsapp, 'Olá, ' + (c.lead.nome || '').split(' ')[0] + '! Sua amiga comprou com o cupom dela e você ganhou um giro extra na roleta da Black Friday 🎁 Gire aqui: ' + c.lead.giroExtraLink)) + '">Enviar giro extra</a>' : '') +
        ' <a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(c.lead.whatsapp, !c.repetido && !c.lead.cupomUsadoEm ? lembrete(c)
          : 'Olá, ' + (c.lead.nome || '') + '! Aqui é a Karen. Vi seu cupom ' + c.codigo + ' de ' + c.pct + '% da Black Friday.')) + '">' + (!c.repetido && !c.lead.cupomUsadoEm ? 'Lembrar no WhatsApp' : 'WhatsApp') + '</a></td></tr>').join('') +
      '</tbody></table>'
      : '<div class="sub" style="padding:28px">' + (termo ? 'Nenhum cupom encontrado para "' + esc(termo) + '". Confira se o código foi digitado certo.' : filtro.value ? 'Nenhum cupom neste filtro.' : 'Ainda ninguém girou a roleta.') + '</div>';
    alvo.querySelectorAll('[data-cupom-usar]').forEach((bt) => bt.onclick = () => marcarCupom(bt, bt.dataset.cupomUsar, true));
    alvo.querySelectorAll('[data-cupom-desfazer]').forEach((bt) => bt.onclick = () => marcarCupom(bt, bt.dataset.cupomDesfazer, false));
    alvo.querySelectorAll('[data-giro-extra]').forEach((bt) => bt.onclick = () => liberarGiro(bt, bt.dataset.giroExtra));
    if (!busca.dataset.ligado) {
      busca.dataset.ligado = '1';
      busca.addEventListener('input', desenharCupons);
      filtro.addEventListener('change', desenharCupons);
    }
  }

  // Placar público (cupons distribuídos), lido pela página da roleta.
  function publicarPlacar(cupons, usados) {
    const chave = cupons + '/' + usados;
    if (chave === ultimoPlacar) return;
    ultimoPlacar = chave;
    store.definir('rastreio', 'bf-placar', { cupons, usados, atualizadoEm: new Date().toISOString() }).catch(() => { ultimoPlacar = ''; });
  }

  // Giro extra: cria um link de uso único e guarda no cupom de quem indicou.
  async function liberarGiro(botao, id) {
    const lead = store.get('leads', id);
    const c = lead && cupomDoLead(lead);
    if (!c) return;
    if (!(await confirmar('Liberar um giro extra para ' + (lead.nome || 'cliente') + '? Uma amiga indicada já comprou com o cupom dela. ' +
      'Depois, use "Enviar giro extra" para mandar o link pelo WhatsApp.', { titulo: 'Giro extra', botao: 'Liberar giro extra' }))) return;
    botao.disabled = true;
    try {
      const bytes = new Uint8Array(10); crypto.getRandomValues(bytes);
      const token = [...bytes].map((v) => 'abcdefghjkmnpqrstuvwxyz23456789'[v % 31]).join('');
      await store.definir('rastreio', 'bfgiro-' + token, { codigoOrigem: c.codigo, criadoEm: new Date().toISOString() });
      await store.transacao([{ col: 'leads', id }], ([l]) => {
        if (!l) throw new Error('cupom não encontrado');
        return [{ col: 'leads', id, dados: { girosExtras: (Number(l.girosExtras) || 0) + 1, giroExtraLink: ROLETA_URL + '?giro=' + token } }];
      });
      toast('Giro extra liberado. Toque em "Enviar giro extra" para mandar no WhatsApp.');
      render();
    } catch (e) {
      toast('Não foi possível liberar: ' + e.message, 'erro');
      botao.disabled = false;
    }
  }

  async function marcarCupom(botao, id, usar) {
    const lead = store.get('leads', id);
    const c = lead && cupomDoLead(lead);
    if (!c) return;
    const texto = usar ? 'Marcar o cupom ' + c.codigo + ' (' + c.pct + '% para ' + (lead.nome || 'cliente') + ') como usado? Ele não poderá ser usado de novo.'
      : 'Desfazer o uso do cupom ' + c.codigo + '? Ele volta a valer.';
    if (!(await confirmar(texto, { titulo: usar ? 'Usar cupom' : 'Desfazer uso', botao: usar ? 'Marcar como usado' : 'Desfazer' }))) return;
    botao.disabled = true;
    try {
      await store.transacao([{ col: 'leads', id }], ([l]) => {
        if (!l) throw new Error('cupom não encontrado');
        if (usar && l.cupomUsadoEm) throw new Error('este cupom já foi usado');
        return [{ col: 'leads', id, dados: usar ? { cupomUsadoEm: new Date().toISOString(), status: 'Virou cliente' } : { cupomUsadoEm: '' } }];
      });
      toast(usar ? 'Cupom ' + c.codigo + ' marcado como usado.' : 'Uso do cupom ' + c.codigo + ' desfeito.');
      render();
    } catch (e) {
      toast('Não foi possível atualizar: ' + e.message, 'erro');
      botao.disabled = false;
    }
  }

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
