// Loja da Karen dentro do sistema da Ítalo InfoTec: área própria no painel, com subpáginas
// (visão geral, pedidos, produtos, cupons e roleta, Sacola Misteriosa e configurações).
// Dados internos ficam em ti/base/* (acesso restrito). O que o site público lê fica em
// ti/base/rastreio/*: sacolas-publicas (contato, Pix, estoque), loja-catalogo (produtos),
// kfoto-<produto> (fotos enviadas pelo painel) e kpedido-<código> (acompanhamento do pedido).
import { store } from '../store.js';
import { esc, money, parseMoney, toast, confirmar, dataBR, whatsapp, modal } from '../util.js';
import { semRef } from './leads.js';
import { PERFUMES } from '../perfumes-bf.js';
import { icon } from '../icons.js';

const URL_LOJA = 'https://italoinfotec.com.br/karen/';
const URL_SACOLA = URL_LOJA + 'sacola-misteriosa/';
const ROLETA_URL = URL_LOJA + 'roleta/';
const URL_PEDIDOS = URL_LOJA + 'pedidos/';
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
const ehSacola = (p) => p.origem === 'sacola-misteriosa' || p.servico === 'Sacola Misteriosa';

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

// ---------- Produtos ----------
const centavos = (n) => Math.round(n * 100) / 100;
const precoMinimoPadrao = (cheio) => Math.round(cheio * 90) / 100; // o cupom máximo (10%) chega aqui
const temEstoque = (p) => p.estoque !== '' && p.estoque !== null && p.estoque !== undefined;
const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36).replace(/-+$/, '') || 'produto';
export function produtosLoja() {
  return store.lista('produtos').slice().sort((a, b) =>
    (Number(Boolean(b.destaque)) - Number(Boolean(a.destaque))) || ((a.ordem ?? 999) - (b.ordem ?? 999)) ||
    String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
}
const fotoProduto = (p) => p.fotoDados || p.fotoUrl || '';
/** Estoque publicado: só os produtos ativos com quantidade informada são controlados. */
function estoqueBF() {
  const lista = produtosLoja();
  if (!lista.length) { // antes da importação: estoque antigo salvo na configuração
    const e = store.config.bfEstoque || {};
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([f, v]) => [f, Math.max(0, Number(v) || 0)]));
  }
  return Object.fromEntries(lista.filter((p) => p.ativo !== false && temEstoque(p)).map((p) => [p.id, Math.max(0, Math.floor(Number(p.estoque) || 0))]));
}
const nomeProduto = (id) => (store.get('produtos', id) || PERFUMES.find((p) => p.foto === id) || {}).nome || id;
function catalogoPublico() {
  const produtos = produtosLoja().filter((p) => p.ativo !== false && Number(p.cheio) > 0).map((p, i) => ({
    id: p.id, nome: String(p.nome || '').slice(0, 120), marca: String(p.marca || '').slice(0, 60),
    categoria: String(p.categoria || 'Outros').slice(0, 40), descricao: String(p.descricao || '').slice(0, 1200),
    cheio: centavos(Number(p.cheio) || 0), minimo: centavos(Math.min(Number(p.cheio) || 0, Number(p.minimo) || precoMinimoPadrao(Number(p.cheio) || 0))),
    img: p.fotoDados ? 'doc:kfoto-' + p.id : String(p.fotoUrl || ''), destaque: Boolean(p.destaque), ordem: i,
  }));
  const categorias = [...new Set(produtos.map((p) => p.categoria))];
  return { produtos, categorias };
}
let produtosImportados = false;
/** Primeira vez: traz os 7 perfumes da Black Friday para o cadastro de produtos. */
async function importarPerfumes() {
  if (produtosImportados || store.lista('produtos').length || store.config.lojaProdutosImportados) return;
  produtosImportados = true;
  const e = store.config.bfEstoque || {};
  const agora = new Date().toISOString();
  await store.importar(PERFUMES.map((p, i) => ({ col: 'produtos', id: p.foto, dados: {
    nome: p.nome, marca: p.marca, categoria: 'Perfumes', descricao: '', cheio: p.cheio, minimo: precoMinimoPadrao(p.cheio),
    estoque: e[p.foto] === undefined || e[p.foto] === '' || e[p.foto] === null ? '' : Math.max(0, Number(e[p.foto]) || 0),
    fotoUrl: '/karen/perfumes/' + p.foto + '.webp', fotoDados: '', ativo: true, destaque: false, ordem: i, criadoEm: agora,
  } })));
  await store.salvarConfig({ lojaProdutosImportados: true });
  await publicar();
  toast('Os 7 perfumes da Black Friday foram trazidos para o cadastro de produtos.');
}

// ---------- Cupons da roleta da Black Friday ----------
/** Lê o cupom gravado pela roleta: detalhe "... [cupom:BF-XXXXX:7]". */
function cupomDoLead(l) {
  const m = /\[cupom:([A-Z0-9-]+):(\d+)\]/.exec(l.detalhe || '');
  return m ? { codigo: m[1], pct: Number(m[2]) } : null;
}
const BF_FIM = new Date('2026-11-30T23:59:59-03:00');
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

// ---------- Pedidos do carrinho (Pix) ----------
const PRAZO_PIX_MIN = 10;
const ms = (v) => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v ? Date.parse(v) || 0 : 0);
// Etapas depois do Pix confirmado (a cliente acompanha em /karen/pedidos/).
const ETAPAS = [
  ['pago', 'Pago · separar'],
  ['separado', 'Separado'],
  ['a-caminho', 'Saiu para entrega / pronto para retirada'],
  ['entregue', 'Entregue'],
];
const rotuloEtapa = (e) => (ETAPAS.find(([k]) => k === e) || ETAPAS[0])[1];
const proximaEtapa = (e) => { const i = ETAPAS.findIndex(([k]) => k === e); return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1] : null; };
/** Lê o pedido gravado pelo carrinho: detalhe "... [pedido:PXXXXXX;cupom:...;pct:5;sub:..;total:..;itens:foto*2,...]". */
function pedidoDoLead(l) {
  const m = /\[pedido:([^\]]+)\]/.exec(l.detalhe || '');
  if (!m) return null;
  const d = Object.fromEntries(('pedido:' + m[1]).split(';').map((x) => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; }));
  const itens = Object.fromEntries(String(d.itens || '').split(',').filter(Boolean).map((x) => { const [f, q] = x.split('*'); return [f, Number(q) || 0]; }));
  const criado = ms(l.criadoEm);
  const prazo = criado + PRAZO_PIX_MIN * 60000;
  const estado = l.pagoEm ? 'pago' : l.canceladoEm ? 'cancelado' : (criado && Date.now() > prazo) ? 'expirado' : 'aguardando';
  const vagas = String(d.vagas || '').split(',').filter(Boolean);
  // A cliente cancelou no site: todas as vagas do pedido foram liberadas com o segredo dela.
  const pelaCliente = !l.pagoEm && !l.canceladoEm && vagas.length > 0 && vagas.every((v) => vagasCache[v] && vagasCache[v].segredo && vagasCache[v].canceladoEm);
  return { lead: l, codigo: d.pedido, cupom: d.cupom || '', pct: Number(d.pct) || 0, sub: Number(d.sub) || 0, total: Number(d.total) || 0, itens, vagas,
    segredo: d.segredo || '', criado, prazo, estado: pelaCliente ? 'cancelado' : estado, pelaCliente, etapa: l.pagoEm ? (l.etapa || 'pago') : '' };
}
function listarPedidosBF() {
  return store.lista('leads').filter((l) => l.origem === 'black-friday-pedido').map(pedidoDoLead).filter((p) => p && p.codigo)
    .sort((a, b) => b.criado - a.criado);
}
/** Situação de cada cupom nos pedidos: pago > aguardando > perdido. */
function cuponsNosPedidos() {
  const peso = { pago: 3, aguardando: 2, expirado: 1, cancelado: 1 };
  const mapa = {};
  listarPedidosBF().forEach((p) => {
    if (!p.cupom || p.pelaCliente) return;
    if (!mapa[p.cupom] || peso[p.estado] > peso[mapa[p.cupom].estado]) mapa[p.cupom] = p;
  });
  return mapa;
}
const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
let pedidosVistos = null;
let vagasCache = {};   // id da vaga -> documento (lido de tempos em tempos)
let vagasLidasEm = 0;
async function sha256hex(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function avisarNovaCompra(p) {
  const texto = 'Nova compra na loja! Pedido ' + p.codigo + ' de ' + (p.lead.nome || 'cliente') + ': ' + money(p.total) + ' no Pix.';
  toast(texto);
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175, 1568].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.18, ctx.currentTime + i * .14); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .14 + .3); o.start(ctx.currentTime + i * .14); o.stop(ctx.currentTime + i * .14 + .32); });
  } catch (_) {}
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Karen Cosméticos', { body: texto }); } catch (_) {}
}
/** Toca o aviso de compra nova em qualquer subpágina da loja (não toca ao abrir o painel). */
function verificarNovasCompras(pedidos) {
  const ids = new Set(pedidos.map((p) => p.lead.id));
  if (pedidosVistos) pedidos.filter((p) => !pedidosVistos.has(p.lead.id) && p.estado === 'aguardando').forEach(avisarNovaCompra);
  pedidosVistos = ids;
}
/** Disponível no site por produto, a partir das vagas (vendidas e reservadas). */
function contagemVagas() {
  const cont = {};
  Object.values(vagasCache).forEach((v) => {
    const m = /^(.+)-(\d+)$/.exec(v.id); if (!m) return;
    const c = (cont[m[1]] = cont[m[1]] || { vendidos: 0, reservados: 0 });
    if (v.pagoEm) c.vendidos++;
    else if (!v.canceladoEm && ms(v.criadoEm) + PRAZO_PIX_MIN * 60000 > Date.now()) c.reservados++;
  });
  return cont;
}
function disponivelProduto(p) {
  if (!temEstoque(p)) return null;
  const c = contagemVagas()[p.id] || { vendidos: 0, reservados: 0 };
  return Math.max(0, Math.floor(Number(p.estoque) || 0) - c.vendidos - c.reservados);
}

// Contadores do menu.
export function contarPendencias() {
  return listarPedidosBF().filter((p) => p.estado === 'aguardando' || (p.estado === 'pago' && p.etapa !== 'entregue')).length;
}
export function contarEsgotados() {
  return produtosLoja().filter((p) => p.ativo !== false && disponivelProduto(p) === 0).length;
}
export function contarSolicitacoes() {
  return store.lista('leads').filter((p) => ehSacola(p) && !pago(p) && (p.status || 'Novo') === 'Novo').length;
}

/** Publica (ou atualiza) o acompanhamento que a cliente vê em /karen/pedidos/. Sem nome nem telefone. */
async function publicarAcompanhamento(lead) {
  const p = pedidoDoLead(lead || {});
  if (!p || !/^P[A-Z0-9]{4,12}$/.test(p.codigo || '')) return;
  const situacao = p.estado === 'pago' ? p.etapa : p.estado === 'cancelado' ? 'cancelado' : p.estado;
  await store.definir('rastreio', 'kpedido-' + p.codigo, {
    codigo: p.codigo, situacao,
    itens: Object.entries(p.itens).map(([id, q]) => ({ nome: nomeProduto(id), q })),
    total: p.total, pct: p.pct, criadoEm: new Date(p.criado || Date.now()).toISOString(),
    historico: lead.etapas || {}, atualizadoEm: new Date().toISOString(),
  }).catch((e) => console.warn('Acompanhamento não publicado:', e));
}

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
async function publicarCatalogo() {
  const { produtos, categorias } = catalogoPublico();
  await store.definir('rastreio', 'loja-catalogo', { produtos, categorias, atualizadoEm: new Date().toISOString() });
}
async function publicar(xs = sacolasAtuais(), tel = store.config.sacolasWhatsapp || '') {
  await store.definir('rastreio', 'sacolas-publicas', {
    itens: publicos(xs),
    whatsapp: celular(tel),
    // Estoque dos produtos e Pix da Karen para o carrinho (chave Pix é pública por natureza).
    perfumes: estoqueBF(),
    pix: { chave: store.config.sacolasPixChave || '', nome: store.config.sacolasPixNome || '', cidade: store.config.sacolasPixCidade || '' },
    atualizadoEm: new Date().toISOString(),
  });
  if (store.lista('produtos').length) await publicarCatalogo();
}

/** Reduz a foto no próprio navegador (até 600×750, WebP) para caber no banco. */
function reduzirFoto(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, 600 / img.width, 750 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      let q = .82, dados = c.toDataURL('image/webp', q);
      if (!dados.startsWith('data:image/webp')) dados = c.toDataURL('image/jpeg', q);
      while (dados.length > 240000 && q > .4) { q -= .12; dados = c.toDataURL(dados.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg', q); }
      if (dados.length > 300000) { falha(new Error('foto muito grande mesmo depois de reduzir')); return; }
      ok(dados);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('arquivo não é uma imagem')); };
    img.src = url;
  });
}

// ---------- Estrutura das subpáginas ----------
const SECOES = {
  geral: ['', 'Visão geral', 'Resumo das vendas, do que precisa de atenção e atalhos da loja.'],
  pedidos: ['pedidos', 'Pedidos da loja', 'Compras feitas pelo carrinho com Pix. Confirme o Pix, separe e avise a entrega: a cliente acompanha em /karen/pedidos/.'],
  produtos: ['produtos', 'Produtos', 'Cadastre, edite, esconda e defina o estoque. O que está ativo aparece no catálogo da loja.'],
  cupons: ['cupons', 'Cupons e roleta', 'Cupons de 1% a 10% ganhos na roleta da Black Friday, indicações e giros extras.'],
  sacolas: ['sacolas', 'Sacola Misteriosa', 'Ação da loja: sacolas surpresa com conteúdo secreto e as solicitações recebidas.'],
  config: ['config', 'Configurações da loja', 'WhatsApp que recebe os pedidos, chave Pix e avisos de compra.'],
};
function cabecalho(secao) {
  const [, titulo, texto] = SECOES[secao];
  return '<div class="page-head"><div><div class="crumb">' + icon('bag', 14) + ' Loja da Karen</div><h1>' + esc(titulo) + '</h1>' +
    '<p>' + esc(texto) + '</p></div>' +
    '<div class="acoes"><a class="btn" href="/karen/" target="_blank" rel="noopener">' + icon('globe', 16) + ' Abrir loja</a></div></div>' +
    '<nav class="abas-loja" aria-label="Seções da loja">' + Object.entries(SECOES).map(([k, [rota, nome]]) =>
      '<a href="#/karen' + (rota ? '/' + rota : '') + '"' + (k === secao ? ' aria-current="page"' : '') + '>' + esc(nome) + '</a>').join('') + '</nav>';
}
const CARD_CONFIG = () => '<div class="grid g2" style="margin-bottom:18px"><div class="card"><div class="card-head"><h2>Contato e Pix</h2></div>' +
  '<form id="cfg-karen" class="form"><div class="campo c12"><label>WhatsApp da Karen (com DDD)</label>' +
  '<input name="numero" inputmode="tel" type="tel" placeholder="(33) 99999-9999" value="' +
  esc(store.config.sacolasWhatsapp || '') + '"><div class="dica">Recebe os pedidos e as dúvidas da loja. Não usa o WhatsApp da assistência técnica.</div></div>' +
  '<div class="campo c12"><label>Chave Pix da Karen</label><input name="pixChave" class="mono" placeholder="CPF, celular (+5533…), e-mail ou chave aleatória" value="' + esc(store.config.sacolasPixChave || '') + '">' +
  '<div class="dica">O carrinho gera o Pix (QR Code e copia e cola) com o valor exato do pedido.</div></div>' +
  '<div class="campo c6"><label>Nome no banco</label><input name="pixNome" maxlength="25" value="' + esc(store.config.sacolasPixNome || '') + '"></div>' +
  '<div class="campo c6"><label>Cidade</label><input name="pixCidade" maxlength="15" value="' + esc(store.config.sacolasPixCidade || '') + '"></div>' +
  '<div class="c12 form-acoes" style="margin-top:0"><button class="btn btn-primary">Salvar e publicar contato e Pix</button></div></form></div>' +
  '<div class="card"><div class="card-head"><h2>Avisos de compra</h2></div>' +
  '<p class="sub">Com o painel aberto, cada compra nova toca um som e mostra um aviso. Ative também a notificação do navegador para ser avisada com o painel em segundo plano.</p>' +
  '<div class="acoes" style="margin-top:14px;justify-content:flex-start"><button type="button" class="btn" id="avisos-bf">' + icon('alert', 16) + ' Ativar aviso no celular/computador</button></div>' +
  '<div class="card-head" style="margin-top:20px;padding:0"><h2>Páginas da loja</h2></div>' +
  '<ul class="lista-links"><li><a href="/karen/" target="_blank" rel="noopener">Loja (catálogo e carrinho)</a></li><li><a href="/karen/roleta/" target="_blank" rel="noopener">Roleta da Black Friday</a></li>' +
  '<li><a href="/karen/pedidos/" target="_blank" rel="noopener">Acompanhar pedido</a></li><li><a href="/karen/sacola-misteriosa/" target="_blank" rel="noopener">Sacola Misteriosa</a></li></ul>' +
  '<div class="acoes" style="margin-top:10px;justify-content:flex-start"><button class="btn" id="publicar-karen">' + icon('upload', 16) + ' Republicar tudo na loja</button></div>' +
  '<div id="status-karen" class="sub" style="margin-top:10px"></div></div></div>';
const CARD_RESUMO = '<div class="kpis" id="kpis-loja"></div><div class="grid g2"><div class="card"><div class="card-head"><h2>Precisa de atenção</h2></div><div id="atencao-loja"></div></div>' +
  '<div class="card"><div class="card-head"><h2>Mais vendidos</h2><a class="btn btn-sm" href="#/karen/produtos">Produtos</a></div><div id="mais-vendidos"></div></div></div>';
const CARD_PEDIDOS = '<div class="card flush"><div class="card-head"><h2>Pedidos</h2><span id="resumo-pedidos-bf" class="sub"></span></div>' +
  '<p class="sub" style="padding:0 20px">A cliente tem ' + PRAZO_PIX_MIN + ' minutos para pagar. Sem pagamento, o pedido é cancelado sozinho, os produtos voltam ao site e o cupom é perdido. ' +
  'Confira o Pix no banco e clique em <b>Pix recebido</b>. Depois avance as etapas: a cliente vê cada mudança em “Meus pedidos”.</p>' +
  '<div class="barra-filtros" style="padding:12px 20px"><input id="busca-pedido" type="search" placeholder="Código do pedido, nome ou WhatsApp" style="flex:1 1 240px" autocomplete="off">' +
  '<select id="filtro-pedidos" style="flex:0 0 auto"><option value="abertos">Em andamento</option><option value="aguardando">Aguardando Pix</option><option value="entregar">Pagos para entregar</option>' +
  '<option value="entregues">Entregues</option><option value="cancelados">Cancelados e vencidos</option><option value="todos">Todos</option></select></div>' +
  '<div class="tabela-wrap" id="pedidos-bf"></div></div>';
const CARD_PRODUTOS = '<div class="card flush"><div class="card-head"><h2>Produtos cadastrados</h2><span id="resumo-produtos" class="sub"></span>' +
  '<button type="button" class="btn btn-primary btn-sm" id="novo-produto">' + icon('plus', 14) + ' Novo produto</button></div>' +
  '<p class="sub" style="padding:0 20px">Estoque é o <b>total à venda</b>: vendidos e reservados são descontados sozinhos. Em branco = sem controle; 0 = esgotado. ' +
  'O cupom da roleta é aplicado sobre o preço cheio e nunca passa do preço Black Friday.</p>' +
  '<div class="barra-filtros" style="padding:12px 20px"><input id="busca-produto" type="search" placeholder="Nome, marca ou categoria" style="flex:1 1 240px" autocomplete="off">' +
  '<select id="filtro-produto" style="flex:0 0 auto"><option value="">Todos</option><option value="ativos">Na loja</option><option value="ocultos">Ocultos</option><option value="esgotados">Esgotados</option><option value="destaques">Destaques</option></select></div>' +
  '<div class="tabela-wrap" id="tabela-produtos"></div></div><div id="editor-produto"></div>';
const CARD_CUPONS = '<div class="card flush"><div class="card-head"><h2>Cupons da roleta</h2><span id="resumo-cupons" class="sub"></span>' +
  '<a class="btn btn-sm" href="/karen/roleta/" target="_blank" rel="noopener">Abrir roleta</a></div>' +
  '<div id="aviso-cupons" style="padding:0 20px"></div>' +
  '<div class="barra-filtros" style="padding:0 20px 14px"><input id="busca-cupom" placeholder="Digite o código (BF-XXXXX), nome ou WhatsApp" style="flex:1 1 260px" autocomplete="off">' +
  '<select id="filtro-cupom" style="flex:0 0 auto"><option value="">Todos os cupons</option><option value="abertos">Válidos ainda não usados</option><option value="usados">Usados</option><option value="indicacoes">Com giro extra para liberar</option></select></div>' +
  '<div class="tabela-wrap" id="cupons-karen"></div></div>';
const CARD_SACOLAS = '<div class="card" style="margin-bottom:18px"><div class="card-head"><h2>Vitrine pública</h2>' +
  '<a class="btn btn-sm" href="/karen/sacola-misteriosa/" target="_blank" rel="noopener">Abrir página</a></div>' +
  '<p class="sub">Só nome, descrição pública, valor, estoque e disponibilidade vão para a página. O conteúdo real de cada sacola fica privado.</p>' +
  '<div class="acoes" style="margin-top:16px;justify-content:flex-start"><button class="btn" id="publicar-karen">' +
  icon('upload', 16) + ' Sincronizar vitrine</button><button class="btn btn-primary" id="nova-karen">' +
  icon('plus', 16) + ' Nova sacola</button></div><div id="status-karen" class="sub" style="margin-top:12px"></div></div>' +
  '<div class="card flush"><div class="card-head"><h2>Catálogo de sacolas</h2><span id="resumo-karen" class="sub"></span></div>' +
  '<div class="tabela-wrap" id="tabela-karen"></div></div>' +
  '<div class="card flush" style="margin-top:20px"><div class="card-head"><h2>Solicitações recebidas</h2></div>' +
  '<div class="tabela-wrap" id="pedidos-karen"></div></div><div id="editor-karen"></div>';

export function tela(el, params = {}) {
  const secao = Object.keys(SECOES).find((k) => SECOES[k][0] === (params.secao || '')) || (params.secao ? null : 'geral');
  if (!secao) { location.replace('#/karen'); return null; }
  el.innerHTML = cabecalho(secao) + ({ geral: CARD_RESUMO, pedidos: CARD_PEDIDOS, produtos: CARD_PRODUTOS, cupons: CARD_CUPONS, sacolas: CARD_SACOLAS, config: CARD_CONFIG() })[secao];
  const $ = (s) => el.querySelector(s);
  const ligar = (s, ev, fn) => { const e = $(s); if (e) e.addEventListener(ev, fn); };
  const status = (msg) => { const e = $('#status-karen'); if (e) e.textContent = msg; };
  importarPerfumes().catch((e) => { produtosImportados = false; console.warn('Importação dos perfumes:', e); });

  ligar('#cfg-karen', 'submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const numero = celular(f.numero.value);
    if (numero && !/^55[0-9]{10,11}$/.test(numero)) {
      toast('Informe um WhatsApp válido com DDD ou deixe vazio.', 'erro'); return;
    }
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await store.salvarConfig({ sacolasWhatsapp: numero, sacolasPixChave: f.pixChave.value.trim(),
        sacolasPixNome: f.pixNome.value.trim(), sacolasPixCidade: f.pixCidade.value.trim() });
      await publicar(sacolasAtuais(), numero);
      status('WhatsApp e Pix da Karen salvos e publicados.');
      toast('Contato atualizado.');
    } catch (e) {
      toast('Não foi possível salvar o contato: ' + e.message, 'erro');
    } finally { btn.disabled = false; }
  });
  ligar('#publicar-karen', 'click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { await publicar(); status('Loja atualizada: contato, Pix, estoque, produtos e sacolas.'); toast('Publicado na loja.'); }
    catch (e) { toast('Erro ao publicar: ' + e.message, 'erro'); }
    finally { b.disabled = false; }
  });
  ligar('#nova-karen', 'click', () => editar(null));
  ligar('#novo-produto', 'click', () => editarProduto(null));
  ligar('#avisos-bf', 'click', async () => {
    if (!('Notification' in window)) { toast('Este navegador não mostra notificações. O aviso com som continua funcionando com o painel aberto.'); return; }
    const r = await Notification.requestPermission();
    toast(r === 'granted' ? 'Avisos ativados: você será avisada de cada compra enquanto o painel estiver aberto.' : 'Avisos não permitidos no navegador.');
  });
  ['#busca-pedido', '#filtro-pedidos'].forEach((s) => ligar(s, s.startsWith('#busca') ? 'input' : 'change', () => desenharPedidosBF()));
  ['#busca-produto', '#filtro-produto'].forEach((s) => ligar(s, s.startsWith('#busca') ? 'input' : 'change', () => desenharProdutos()));
  ['#busca-cupom', '#filtro-cupom'].forEach((s) => ligar(s, s.startsWith('#busca') ? 'input' : 'change', () => desenharCupons()));

  let relogio = null;
  const render = () => {
    const pedidos = listarPedidosBF();
    verificarNovasCompras(pedidos);
    if (secao === 'geral') desenharResumo(pedidos);
    if (secao === 'pedidos') desenharPedidosBF();
    if (secao === 'produtos') desenharProdutos();
    if (secao === 'cupons') desenharCupons();
    if (secao === 'sacolas') desenharSacolas();
    // Contagem dos 10 minutos e vencimentos enquanto a tela estiver aberta.
    clearInterval(relogio);
    const marca = el.firstElementChild;
    if (pedidos.some((p) => p.estado === 'aguardando')) relogio = setInterval(() => {
      if (!document.body.contains(marca)) { clearInterval(relogio); return; }
      if (secao === 'geral') desenharResumo(listarPedidosBF());
      if (secao === 'pedidos') desenharPedidosBF();
    }, 5000);
    atualizarVagas();
  };

  // ---------- Visão geral ----------
  function desenharResumo(pedidos) {
    const alvo = $('#kpis-loja');
    if (!alvo) return;
    const pagos = pedidos.filter((p) => p.estado === 'pago');
    const aguardando = pedidos.filter((p) => p.estado === 'aguardando');
    const entregar = pagos.filter((p) => p.etapa !== 'entregue');
    const mes = new Date().toISOString().slice(0, 7);
    const doMes = pagos.filter((p) => String(p.lead.pagoEm || '').startsWith(mes));
    const cupons = listarCupons().filter((c) => !c.repetido);
    const produtos = produtosLoja().filter((p) => p.ativo !== false);
    const esgotados = produtos.filter((p) => disponivelProduto(p) === 0);
    const sacolasNovas = contarSolicitacoes();
    const kpi = (href, titulo, ico, val, sub) => '<a class="kpi" href="' + href + '"><div class="kpi-top">' + esc(titulo) + ' ' + icon(ico, 16) + '</div><div class="kpi-val">' + val + '</div><div class="kpi-sub">' + sub + '</div></a>';
    alvo.innerHTML =
      kpi('#/karen/pedidos', 'Vendido no mês', 'trend', money(doMes.reduce((a, p) => a + p.total, 0)), doMes.length + ' pedido(s) pago(s) · total geral ' + money(pagos.reduce((a, p) => a + p.total, 0))) +
      kpi('#/karen/pedidos', 'Aguardando Pix', 'clock', aguardando.length, aguardando.length ? 'confira o banco e confirme' : 'nenhum no momento') +
      kpi('#/karen/pedidos', 'Para entregar', 'truck', entregar.length, 'pagos, ainda não entregues') +
      kpi('#/karen/cupons', 'Cupons da roleta', 'pix', cupons.length, cupons.filter((c) => c.lead.cupomUsadoEm).length + ' usado(s)') +
      kpi('#/karen/produtos', 'Produtos na loja', 'tag', produtos.length, esgotados.length ? esgotados.length + ' esgotado(s)' : 'nenhum esgotado');
    const itens = [];
    aguardando.forEach((p) => itens.push(['clock', 'Pedido ' + p.codigo + ' de ' + (p.lead.nome || 'cliente') + ' aguarda Pix de ' + money(p.total) + ' (até ' + hora(p.prazo) + ')', '#/karen/pedidos']));
    entregar.slice(0, 8).forEach((p) => itens.push(['truck', 'Pedido ' + p.codigo + ' (' + (p.lead.nome || 'cliente') + '): ' + rotuloEtapa(p.etapa), '#/karen/pedidos']));
    esgotados.forEach((p) => itens.push(['tag', (p.nome || p.id) + ' está esgotado no site', '#/karen/produtos']));
    if (sacolasNovas) itens.push(['gift', sacolasNovas + ' solicitação(ões) nova(s) de Sacola Misteriosa', '#/karen/sacolas']);
    const paraLiberar = cupons.filter((c) => c.amigasCompraram > c.girosExtras).length;
    if (paraLiberar) itens.push(['pix', paraLiberar + ' giro(s) extra(s) para liberar por indicação', '#/karen/cupons']);
    if (!store.config.sacolasPixChave) itens.push(['alert', 'Cadastre a chave Pix da Karen: sem ela o carrinho não gera o Pix', '#/karen/config']);
    if (!store.config.sacolasWhatsapp) itens.push(['alert', 'Cadastre o WhatsApp da Karen para receber os pedidos', '#/karen/config']);
    $('#atencao-loja').innerHTML = itens.length ? '<ul class="lista-atencao">' + itens.map(([ico, t, h]) => '<li><a href="' + h + '">' + icon(ico, 16) + '<span>' + esc(t) + '</span></a></li>').join('') + '</ul>'
      : '<p class="sub">Tudo em dia. Nenhum pedido esperando e nada esgotado.</p>';
    const vendidos = {};
    pagos.forEach((p) => Object.entries(p.itens).forEach(([id, q]) => { vendidos[id] = (vendidos[id] || 0) + q; }));
    const top = Object.entries(vendidos).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('#mais-vendidos').innerHTML = top.length ? '<ol class="lista-top">' + top.map(([id, q]) => '<li><span>' + esc(nomeProduto(id)) + '</span><b>' + q + '</b></li>').join('') + '</ol>'
      : '<p class="sub">Ainda sem vendas pagas.</p>';
  }

  // ---------- Produtos ----------
  function desenharProdutos() {
    const alvo = $('#tabela-produtos');
    if (!alvo) return;
    const todos = produtosLoja();
    const termo = String($('#busca-produto')?.value || '').trim().toLowerCase();
    const filtro = $('#filtro-produto')?.value || '';
    const cont = contagemVagas();
    let lista = todos.filter((p) => !termo || [p.nome, p.marca, p.categoria].some((v) => String(v || '').toLowerCase().includes(termo)));
    if (filtro === 'ativos') lista = lista.filter((p) => p.ativo !== false);
    if (filtro === 'ocultos') lista = lista.filter((p) => p.ativo === false);
    if (filtro === 'esgotados') lista = lista.filter((p) => disponivelProduto(p) === 0);
    if (filtro === 'destaques') lista = lista.filter((p) => p.destaque);
    $('#resumo-produtos').textContent = todos.length + ' cadastrado(s) · ' + todos.filter((p) => p.ativo !== false).length + ' na loja';
    alvo.innerHTML = lista.length ? '<table class="tabela tabela-produtos"><thead><tr><th></th><th>Produto</th><th>Preço cheio</th><th>Black Friday</th><th>Estoque</th><th>Situação</th><th></th></tr></thead><tbody>' +
      lista.map((p) => {
        const c = cont[p.id] || { vendidos: 0, reservados: 0 };
        const disp = disponivelProduto(p);
        const foto = fotoProduto(p);
        return '<tr><td>' + (foto ? '<img class="mini-foto" src="' + esc(foto) + '" alt="" loading="lazy">' : '<span class="mini-foto vazia">' + icon('tag', 18) + '</span>') + '</td>' +
          '<td><div class="forte">' + esc(p.nome) + '</div><small class="sub">' + esc([p.marca, p.categoria].filter(Boolean).join(' · ')) + '</small></td>' +
          '<td class="num">' + money(p.cheio) + '</td><td class="num">' + money(Number(p.minimo) || precoMinimoPadrao(Number(p.cheio) || 0)) + '</td>' +
          '<td class="num">' + (disp === null ? '<span class="sub">sem controle</span>' : disp + ' <span class="sub">de ' + (Number(p.estoque) || 0) + '</span>') +
          (c.vendidos || c.reservados ? '<div class="sub">' + c.vendidos + ' vendido(s) · ' + c.reservados + ' reservado(s)</div>' : '') + '</td><td>' +
          (p.ativo === false ? '<span class="badge b-muted">Oculto</span>' : disp === 0 ? '<span class="badge b-warn">Esgotado</span>' : '<span class="badge b-ok">Na loja</span>') +
          (p.destaque ? ' <span class="badge b-info">Destaque</span>' : '') + '</td>' +
          '<td class="nowrap"><button type="button" class="btn btn-sm" data-produto="' + esc(p.id) + '">' + icon('edit', 14) + ' Editar</button></td></tr>';
      }).join('') + '</tbody></table>'
      : '<div class="sub" style="padding:28px">' + (todos.length ? 'Nenhum produto neste filtro.' : 'Nenhum produto cadastrado. Clique em “Novo produto”.') + '</div>';
    alvo.querySelectorAll('[data-produto]').forEach((b) => b.onclick = () => editarProduto(store.get('produtos', b.dataset.produto)));
  }

  function editarProduto(item) {
    const box = $('#editor-produto');
    if (!box) return;
    const categorias = [...new Set(produtosLoja().map((p) => p.categoria).filter(Boolean).concat(['Perfumes', 'Maquiagem', 'Cuidados com a pele', 'Cabelos', 'Corpo e banho', 'Kits e presentes']))];
    let fotoDados = item?.fotoDados || '';
    let fotoUrl = item?.fotoUrl || '';
    box.innerHTML = '<div class="card" style="margin-top:20px"><div class="card-head"><h2>' + (item ? 'Editar produto' : 'Novo produto') + '</h2>' +
      '<button type="button" class="btn btn-sm" id="fechar-produto">Fechar</button></div>' +
      '<form id="form-produto" class="form">' +
      '<div class="campo c12 foto-produto"><div class="foto-previa" id="foto-previa"></div><div><label>Foto do produto</label>' +
      '<input type="file" id="foto-arquivo" accept="image/*"><div class="dica">A foto é reduzida no próprio aparelho antes de enviar. Prefira foto em pé, com fundo limpo.</div>' +
      '<button type="button" class="btn btn-sm" id="foto-remover" style="margin-top:8px">Remover foto</button></div></div>' +
      '<div class="campo c8"><label>Nome *</label><input name="nome" required maxlength="120" placeholder="Ex.: Kaiak Extremo masculino 100 ml" value="' + esc(item?.nome || '') + '"></div>' +
      '<div class="campo c4"><label>Marca</label><input name="marca" maxlength="60" placeholder="Ex.: Natura" value="' + esc(item?.marca || '') + '"></div>' +
      '<div class="campo c4"><label>Categoria *</label><input name="categoria" required maxlength="40" list="categorias-loja" value="' + esc(item?.categoria || '') + '">' +
      '<datalist id="categorias-loja">' + categorias.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist></div>' +
      '<div class="campo c4"><label>Preço cheio (R$) *</label><input name="cheio" inputmode="decimal" required placeholder="0,00" value="' + esc(item ? money(item.cheio, false) : '') + '"></div>' +
      '<div class="campo c4"><label>Preço Black Friday (R$)</label><input name="minimo" inputmode="decimal" placeholder="em branco = 10% abaixo do cheio" value="' + esc(item && item.minimo ? money(item.minimo, false) : '') + '">' +
      '<div class="dica">Menor preço com cupom. Igual ao preço cheio = o cupom não vale neste produto.</div></div>' +
      '<div class="campo c4"><label>Estoque à venda</label><input name="estoque" type="number" min="0" max="999" step="1" inputmode="numeric" placeholder="sem controle" value="' + esc(item && temEstoque(item) ? item.estoque : '') + '"></div>' +
      '<div class="campo c8"><label>Ordem na loja</label><input name="ordem" type="number" min="0" max="999" step="1" value="' + esc(item?.ordem ?? produtosLoja().length) + '"><div class="dica">Menor aparece primeiro. Destaques sempre vêm antes.</div></div>' +
      '<div class="campo c12"><label>Descrição</label><textarea name="descricao" maxlength="1200" rows="4" placeholder="Fragrância, volume, para quem é indicado, como usar">' + esc(item?.descricao || '') + '</textarea></div>' +
      '<div class="campo c6"><label class="check"><input type="checkbox" name="ativo" ' + (item?.ativo === false ? '' : 'checked') + '> Mostrar na loja</label></div>' +
      '<div class="campo c6"><label class="check"><input type="checkbox" name="destaque" ' + (item?.destaque ? 'checked' : '') + '> Destaque (aparece primeiro)</label></div>' +
      '<div class="c12 form-acoes" style="margin-top:0">' + (item ? '<button type="button" class="btn btn-danger" id="excluir-produto">Excluir produto</button>' : '') +
      '<span style="flex:1"></span><button type="submit" class="btn btn-primary">Salvar e publicar</button></div></form></div>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const previa = () => {
      const f = fotoDados || fotoUrl;
      box.querySelector('#foto-previa').innerHTML = f ? '<img src="' + esc(f) + '" alt="">' : '<span>' + icon('tag', 28) + '<small>sem foto</small></span>';
      box.querySelector('#foto-remover').hidden = !f;
    };
    previa();
    box.querySelector('#fechar-produto').onclick = () => box.replaceChildren();
    box.querySelector('#foto-remover').onclick = () => { fotoDados = ''; fotoUrl = ''; previa(); };
    box.querySelector('#foto-arquivo').onchange = async (ev) => {
      const arq = ev.target.files && ev.target.files[0];
      if (!arq) return;
      try { fotoDados = await reduzirFoto(arq); fotoUrl = ''; previa(); }
      catch (e) { toast('Não foi possível usar esta foto: ' + e.message, 'erro'); }
    };
    const f = box.querySelector('#form-produto');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const cheio = parseMoney(fd.get('cheio'));
      const minimoTxt = String(fd.get('minimo') || '').trim();
      const minimo = minimoTxt ? parseMoney(minimoTxt) : precoMinimoPadrao(cheio);
      const estTxt = String(fd.get('estoque') || '').trim();
      const dados = {
        nome: String(fd.get('nome') || '').trim().slice(0, 120), marca: String(fd.get('marca') || '').trim().slice(0, 60),
        categoria: String(fd.get('categoria') || '').trim().slice(0, 40), descricao: String(fd.get('descricao') || '').trim().slice(0, 1200),
        cheio, minimo: centavos(minimo), estoque: estTxt === '' ? '' : Math.max(0, Math.min(999, Math.floor(Number(estTxt) || 0))),
        ordem: Math.max(0, Math.min(999, Math.floor(Number(fd.get('ordem')) || 0))),
        ativo: fd.has('ativo'), destaque: fd.has('destaque'), fotoDados, fotoUrl,
      };
      if (!dados.nome || !dados.categoria || !(cheio > 0)) { toast('Informe nome, categoria e preço cheio maior que zero.', 'erro'); return; }
      if (!(minimo > 0) || minimo > cheio) { toast('O preço Black Friday deve ser maior que zero e no máximo igual ao preço cheio.', 'erro'); return; }
      const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
      try {
        let id = item?.id;
        if (!id) {
          const base = slug(dados.nome);
          id = base;
          for (let n = 2; store.get('produtos', id) || PERFUMES.some((p) => p.foto === id && store.get('produtos', p.foto)); n++) id = base + '-' + n;
          await store.definir('produtos', id, { ...dados, criadoEm: new Date().toISOString(), criadoPor: store.usuario?.email || '' });
        } else await store.atualizar('produtos', id, dados);
        if (fotoDados && fotoDados !== item?.fotoDados) await store.definir('rastreio', 'kfoto-' + id, { img: fotoDados, atualizadoEm: new Date().toISOString() });
        await publicar();
        toast('Produto salvo e publicado na loja.');
        box.replaceChildren();
        atualizarVagas(true);
        render();
      } catch (e) { toast('Erro ao salvar o produto: ' + e.message, 'erro'); }
      finally { btn.disabled = false; }
    };
    const excluir = box.querySelector('#excluir-produto');
    if (excluir) excluir.onclick = async () => {
      if (!(await confirmar('Excluir "' + item.nome + '"? Ele sai da loja na hora. Pedidos antigos continuam no histórico. Para só esconder, desmarque “Mostrar na loja”.', { perigo: true, botao: 'Excluir' }))) return;
      excluir.disabled = true;
      try { await store.remover('produtos', item.id); await publicar(); toast('Produto excluído.'); box.replaceChildren(); render(); }
      catch (e) { toast('Erro ao excluir: ' + e.message, 'erro'); excluir.disabled = false; }
    };
  }

  // ---------- Sacola Misteriosa ----------
  function desenharSacolas() {
    if (!$('#tabela-karen')) return;
    const todos = sacolasAtuais().slice().sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    $('#resumo-karen').textContent = todos.length + ' cadastradas · ' + todos.filter((s) => s.ativo !== false && Number(s.estoque) > 0).length + ' disponíveis';
    $('#tabela-karen').innerHTML = todos.length ?
      '<table class="tabela"><thead><tr><th>Sacola</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead><tbody>' +
      todos.map((s) => '<tr><td><div class="forte">' + esc(s.titulo) + '</div><small class="sub">' +
      esc(s.descricaoPublica || '') + '</small></td><td class="num">' + money(s.valor) +
      '</td><td class="num">' + (Number(s.estoque) || 0) + '</td><td>' +
      (s.ativo === false ? '<span class="badge b-muted">Oculta</span>' :
      Number(s.estoque) > 0 ? '<span class="badge b-ok">Disponível</span>' :
      '<span class="badge b-warn">Esgotada</span>') + '</td><td><button type="button" class="btn btn-sm" data-editar="' +
      esc(s.id) + '">' + icon('edit', 14) + ' Editar</button></td></tr>').join('') + '</tbody></table>' :
      '<div style="padding:28px" class="sub">Nenhuma sacola cadastrada. Clique em “Nova sacola” para começar.</div>';
    el.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () => editar(store.get('sacolas', b.dataset.editar)));
    const pedidos = store.lista('leads').filter(ehSacola).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
    $('#pedidos-karen').innerHTML = pedidos.length ?
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
  }

  // ---------- Cupons ----------
  function desenharCupons() {
    const alvo = $('#cupons-karen');
    if (!alvo) return;
    const termo = String($('#busca-cupom').value || '').trim().toUpperCase();
    const filtro = $('#filtro-cupom');
    const todos = listarCupons();
    const validos = todos.filter((c) => !c.repetido);
    const nosPedidos = cuponsNosPedidos();
    const perdido = (c) => ['expirado', 'cancelado'].includes((nosPedidos[c.codigo] || {}).estado);
    const abertos = validos.filter((c) => !c.lead.cupomUsadoEm && !perdido(c));
    const usados = validos.length - abertos.length;
    const paraLiberar = validos.filter((c) => c.amigasCompraram > c.girosExtras);
    $('#resumo-cupons').textContent = validos.length + ' cupons · ' + usados + ' usados' +
      (todos.length > validos.length ? ' · ' + (todos.length - validos.length) + ' não valem' : '');
    publicarPlacar(validos.length, usados);

    // Aviso: lembrar quem não usou (últimos 3 dias) e giros extras pendentes.
    const dias = Math.ceil((BF_FIM - Date.now()) / 864e5);
    const avisos = [];
    if (dias >= 0 && dias <= 3 && abertos.length) avisos.push('Faltam ' + (dias || 'menos de 1') + ' dia(s) para acabar a Black Friday e ' + abertos.length + ' cupom(ns) ainda não foram usados. Filtre por <b>Válidos ainda não usados</b> e mande um lembrete.');
    if (paraLiberar.length) avisos.push(paraLiberar.length + ' cliente(s) indicaram amigas que já compraram e ganharam um giro extra. Filtre por <b>Com giro extra para liberar</b>.');
    $('#aviso-cupons').innerHTML = avisos.map((t) => '<div class="alerta" style="margin:0 0 12px;padding:10px 14px;border-radius:10px;background:var(--warn-bg);color:var(--warn)">' + t + '</div>').join('');

    const digitos = termo.replace(/\D/g, '');
    let lista = !termo ? todos : todos.filter((c) => c.codigo.includes(termo) ||
      String(c.lead.nome || '').toUpperCase().includes(termo) || (digitos.length >= 4 && String(c.lead.whatsapp || '').includes(digitos)));
    if (filtro.value === 'abertos') lista = lista.filter((c) => !c.repetido && !c.lead.cupomUsadoEm && !perdido(c));
    if (filtro.value === 'usados') lista = lista.filter((c) => !c.repetido && c.lead.cupomUsadoEm);
    if (filtro.value === 'indicacoes') lista = lista.filter((c) => !c.repetido && c.amigasCompraram > c.girosExtras);

    const situacao = (c) => {
      if (c.repetido) return '<span class="badge b-danger">Não vale: ' + (c.extra ? 'giro extra já usado' : 'número já tinha girado') + '</span>';
      if (c.lead.cupomUsadoEm) return '<span class="badge b-muted">Usado em ' + esc(dataBR(c.lead.cupomUsadoEm, true)) + '</span>';
      const ped = nosPedidos[c.codigo];
      if (ped && ped.estado === 'aguardando') return '<span class="badge b-warn">Reservado no pedido ' + esc(ped.codigo) + '</span>';
      if (ped && (ped.estado === 'expirado' || ped.estado === 'cancelado')) return '<span class="badge b-danger">Perdido: pedido ' + esc(ped.codigo) + ' não foi pago</span>';
      return '<span class="badge b-ok">Válido</span>';
    };
    const origem = (c) => c.extra ? '<span class="badge b-info">Giro extra</span>' : c.ind.startsWith('amiga:') ? '<span class="sub">Indicada por ' + esc(c.ind.slice(6)) + '</span>' : '';
    const indicacoes = (c) => c.amigas ? c.amigas + ' amiga(s) · ' + c.amigasCompraram + ' comprou(aram)' : '—';
    const lembrete = (c) => 'Olá, ' + (c.lead.nome || '').split(' ')[0] + '! Aqui é a Karen 💝 Seu cupom ' + c.codigo + ' de ' + c.pct +
      '% da Black Friday vale até 30/11. Quer garantir seu perfume? Veja os preços com o seu cupom: ' + URL_LOJA;
    alvo.innerHTML = lista.length ? '<table class="tabela"><thead><tr><th>Cupom</th><th>Desconto</th><th>Cliente</th><th>WhatsApp</th><th>Girou em</th><th>Indicações</th><th>Situação</th><th>Ação</th></tr></thead><tbody>' +
      lista.slice(0, 300).map((c) => '<tr><td><strong>' + esc(c.codigo) + '</strong><div>' + origem(c) + '</div></td><td><strong>' + c.pct + '%</strong></td><td>' + esc(c.lead.nome || '') +
        '</td><td>' + esc(c.lead.whatsapp || '') + '</td><td>' + esc(dataBR(c.lead.criadoEm, true)) + '</td><td>' + indicacoes(c) + '</td><td>' + situacao(c) + '</td><td class="nowrap">' +
        (c.repetido || perdido(c) ? '' : c.lead.cupomUsadoEm
          ? '<button type="button" class="btn btn-sm" data-cupom-desfazer="' + esc(c.lead.id) + '">Desfazer uso</button>'
          : '<button type="button" class="btn btn-sm btn-primary" data-cupom-usar="' + esc(c.lead.id) + '">Marcar como usado</button>') +
        (!c.repetido && c.amigasCompraram > c.girosExtras ? ' <button type="button" class="btn btn-sm btn-primary" data-giro-extra="' + esc(c.lead.id) + '">Liberar giro extra</button>' : '') +
        (c.lead.giroExtraLink ? ' <a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(c.lead.whatsapp, 'Olá, ' + (c.lead.nome || '').split(' ')[0] + '! Sua amiga comprou com o cupom dela e você ganhou um giro extra na roleta da Black Friday 🎁 Gire aqui: ' + c.lead.giroExtraLink)) + '">Enviar giro extra</a>' : '') +
        ' <a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(c.lead.whatsapp, !c.repetido && !c.lead.cupomUsadoEm && !perdido(c) ? lembrete(c)
          : 'Olá, ' + (c.lead.nome || '') + '! Aqui é a Karen. Vi seu cupom ' + c.codigo + ' de ' + c.pct + '% da Black Friday.')) + '">' + (!c.repetido && !c.lead.cupomUsadoEm && !perdido(c) ? 'Lembrar no WhatsApp' : 'WhatsApp') + '</a></td></tr>').join('') +
      '</tbody></table>'
      : '<div class="sub" style="padding:28px">' + (termo ? 'Nenhum cupom encontrado para "' + esc(termo) + '". Confira se o código foi digitado certo.' : filtro.value ? 'Nenhum cupom neste filtro.' : 'Ainda ninguém girou a roleta.') + '</div>';
    alvo.querySelectorAll('[data-cupom-usar]').forEach((bt) => bt.onclick = () => marcarCupom(bt, bt.dataset.cupomUsar, true));
    alvo.querySelectorAll('[data-cupom-desfazer]').forEach((bt) => bt.onclick = () => marcarCupom(bt, bt.dataset.cupomDesfazer, false));
    alvo.querySelectorAll('[data-giro-extra]').forEach((bt) => bt.onclick = () => liberarGiro(bt, bt.dataset.giroExtra));
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
    const container = $('#editor-karen');
    if (!container) return;
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
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    container.querySelector('#cancelar-karen').onclick = () => container.replaceChildren();
    const f = container.querySelector('#form-karen');
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const dados = {
        titulo: String(fd.get('titulo') || '').trim().slice(0, 100),
        valor: parseMoney(fd.get('valor')),
        estoque: Number.parseInt(fd.get('estoque'), 10),
        descricaoPublica: String(fd.get('descricaoPublica') || '').trim().slice(0, 260),
        conteudoSecreto: String(fd.get('conteudoSecreto') || '').trim().slice(0, 6000),
        custoInterno: parseMoney(fd.get('custoInterno')),
        notasInternas: String(fd.get('notasInternas') || '').trim().slice(0, 500),
        ativo: fd.has('ativo'),
      };
      if (!dados.titulo || dados.valor <= 0 || !Number.isInteger(dados.estoque) ||
          dados.estoque < 0 || dados.estoque > 99999) {
        toast('Informe título, preço maior que zero e estoque válido.', 'erro'); return;
      }
      const btn = f.querySelector('[type="submit"]'); btn.disabled = true;
      try {
        let novo;
        if (item) { await store.atualizar('sacolas', item.id, dados); novo = { ...item, ...dados }; }
        else novo = await store.criar('sacolas', dados);
        await publicar(sacolasAtuais().filter((s) => s.id !== novo.id).concat(novo));
        status('Catálogo sincronizado com a vitrine.');
        toast('Sacola salva e publicada.');
        container.replaceChildren();
        render();
      } catch (e) {
        toast('Erro ao salvar ou publicar: ' + e.message, 'erro');
      } finally { btn.disabled = false; }
    };
    const excluir = container.querySelector('#excluir-karen');
    if (excluir) excluir.onclick = async () => {
      if (!(await confirmar('Excluir a sacola "' + item.titulo +
        '"? Ela sairá da vitrine. Pedidos anteriores permanecerão no histórico.', { perigo: true, botao: 'Excluir' }))) return;
      excluir.disabled = true;
      try {
        await store.remover('sacolas', item.id);
        await publicar(sacolasAtuais().filter((s) => s.id !== item.id));
        toast('Sacola excluída da vitrine.');
        container.replaceChildren();
        render();
      } catch (e) { toast('Erro ao excluir: ' + e.message, 'erro'); excluir.disabled = false; }
    };
  }

  async function atualizarVagas(forcar) {
    if (!forcar && Date.now() - vagasLidasEm < 15000) return;
    vagasLidasEm = Date.now();
    let vagas = [];
    try { vagas = await store.buscar('vagas-bf'); } catch (e) { console.warn('Vagas indisponíveis:', e); return; }
    const antes = JSON.stringify(vagasCache);
    vagasCache = Object.fromEntries(vagas.map((v) => [v.id, v]));
    if (JSON.stringify(vagasCache) !== antes) {
      if (secao === 'pedidos') desenharPedidosBF();
      if (secao === 'produtos') desenharProdutos();
      if (secao === 'geral') desenharResumo(listarPedidosBF());
    }
  }

  // ---------- Pedidos ----------
  function desenharPedidosBF() {
    const alvo = $('#pedidos-bf');
    if (!alvo) return;
    const pedidos = listarPedidosBF();
    const cont = { aguardando: 0, entregar: 0, entregues: 0, perdidos: 0 };
    pedidos.forEach((p) => {
      if (p.estado === 'aguardando') cont.aguardando++;
      else if (p.estado === 'pago') { if (p.etapa === 'entregue') cont.entregues++; else cont.entregar++; }
      else cont.perdidos++;
    });
    $('#resumo-pedidos-bf').textContent = cont.aguardando + ' aguardando Pix · ' + cont.entregar + ' para entregar · ' + cont.entregues + ' entregue(s) · ' + cont.perdidos + ' cancelado(s)';
    const situacao = (p) => {
      if (p.estado === 'pago') return '<span class="badge ' + (p.etapa === 'entregue' ? 'b-muted' : 'b-ok') + '">' + esc(rotuloEtapa(p.etapa)) + '</span>';
      if (p.estado === 'cancelado') return '<span class="badge b-muted">' + (p.pelaCliente ? 'Cancelado pela cliente' : 'Cancelado') + '</span>';
      if (p.estado === 'expirado') return '<span class="badge b-danger">Cancelado: Pix não pago até ' + hora(p.prazo) + '</span>';
      const s = Math.max(0, Math.ceil((p.prazo - Date.now()) / 1000));
      return '<span class="badge b-warn">Aguardando Pix · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</span>';
    };
    const filtro = $('#filtro-pedidos')?.value || 'abertos';
    const termo = String($('#busca-pedido')?.value || '').trim().toUpperCase();
    const digitos = termo.replace(/\D/g, '');
    const regra = {
      abertos: (p) => p.estado === 'aguardando' || (p.estado === 'pago' && p.etapa !== 'entregue'),
      aguardando: (p) => p.estado === 'aguardando',
      entregar: (p) => p.estado === 'pago' && p.etapa !== 'entregue',
      entregues: (p) => p.estado === 'pago' && p.etapa === 'entregue',
      cancelados: (p) => p.estado === 'cancelado' || p.estado === 'expirado',
      todos: () => true,
    }[filtro] || (() => true);
    const visiveis = pedidos.filter(regra).filter((p) => !termo || String(p.codigo).includes(termo) ||
      String(p.lead.nome || '').toUpperCase().includes(termo) || (digitos.length >= 4 && String(p.lead.whatsapp || '').includes(digitos)));
    const msgWhats = (p) => {
      const nome = (p.lead.nome || '').split(' ')[0];
      if (p.estado !== 'pago') return 'Olá, ' + nome + '! Aqui é a Karen. Sobre o seu pedido ' + p.codigo + ' de ' + money(p.total) + ':';
      if (p.etapa === 'a-caminho') return 'Olá, ' + nome + '! Seu pedido ' + p.codigo + ' está a caminho / pronto para retirada 💝 Acompanhe: ' + URL_PEDIDOS + '?p=' + p.codigo;
      return 'Olá, ' + nome + '! Aqui é a Karen 💝 Recebi seu Pix do pedido ' + p.codigo + ' (' + money(p.total) + '). Vamos combinar a entrega? Acompanhe: ' + URL_PEDIDOS + '?p=' + p.codigo;
    };
    alvo.innerHTML = visiveis.length ? '<table class="tabela"><thead><tr><th>Pedido</th><th>Cliente</th><th>Itens</th><th>Cupom</th><th>Total</th><th>Situação</th><th>Ação</th></tr></thead><tbody>' +
      visiveis.slice(0, 200).map((p) => {
        const prox = p.estado === 'pago' ? proximaEtapa(p.etapa) : null;
        return '<tr><td><strong>' + esc(p.codigo) + '</strong><div class="sub">' + esc(dataBR(p.lead.criadoEm, true)) + '</div></td>' +
        '<td>' + esc(p.lead.nome || '') + '<div class="sub">' + esc(p.lead.whatsapp || '') + '</div></td>' +
        '<td>' + Object.entries(p.itens).map(([f, q]) => q + '× ' + esc(nomeProduto(f))).join('<br>') + '</td>' +
        '<td>' + (p.cupom ? esc(p.cupom) + ' (' + p.pct + '%)' : '—') + '</td><td><strong>' + money(p.total) + '</strong></td><td>' + situacao(p) + '</td><td class="nowrap">' +
        (p.estado === 'aguardando' || p.estado === 'expirado' ? '<button type="button" class="btn btn-sm btn-primary" data-pix-ok="' + esc(p.lead.id) + '">Pix recebido</button> ' : '') +
        (p.estado === 'aguardando' ? '<button type="button" class="btn btn-sm" data-pix-cancelar="' + esc(p.lead.id) + '">Cancelar</button> ' : '') +
        (prox ? '<button type="button" class="btn btn-sm btn-primary" data-etapa="' + esc(p.lead.id) + '" data-para="' + prox[0] + '">Marcar: ' + esc(prox[0] === 'a-caminho' ? 'saiu / pronto' : prox[1].toLowerCase()) + '</button> ' : '') +
        (p.estado === 'pago' && p.etapa === 'pago' ? '<button type="button" class="btn btn-sm" data-pix-desfazer="' + esc(p.lead.id) + '">Desfazer Pix</button> ' : '') +
        (p.estado === 'pago' && p.etapa !== 'pago' ? '<button type="button" class="btn btn-sm" data-voltar="' + esc(p.lead.id) + '">Voltar etapa</button> ' : '') +
        '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(p.lead.whatsapp, msgWhats(p))) + '">WhatsApp</a></td></tr>';
      }).join('') +
      '</tbody></table>' : '<div class="sub" style="padding:28px">' + (pedidos.length ? 'Nenhum pedido neste filtro.' : 'Nenhuma compra pelo carrinho ainda.') + '</div>';
    alvo.querySelectorAll('[data-pix-ok]').forEach((b) => b.onclick = () => pixRecebido(b, b.dataset.pixOk));
    alvo.querySelectorAll('[data-pix-cancelar]').forEach((b) => b.onclick = () => cancelarPedido(b, b.dataset.pixCancelar));
    alvo.querySelectorAll('[data-pix-desfazer]').forEach((b) => b.onclick = () => desfazerPix(b, b.dataset.pixDesfazer));
    alvo.querySelectorAll('[data-etapa]').forEach((b) => b.onclick = () => mudarEtapa(b, b.dataset.etapa, b.dataset.para));
    alvo.querySelectorAll('[data-voltar]').forEach((b) => b.onclick = () => {
      const p = pedidoDoLead(store.get('leads', b.dataset.voltar) || {});
      const i = ETAPAS.findIndex(([k]) => k === (p && p.etapa));
      if (i > 0) mudarEtapa(b, b.dataset.voltar, ETAPAS[i - 1][0], true);
    });
  }

  async function mudarEtapa(botao, id, para, voltando) {
    const lead = store.get('leads', id);
    const p = lead && pedidoDoLead(lead);
    if (!p || p.estado !== 'pago') return;
    if (voltando && !(await confirmar('Voltar o pedido ' + p.codigo + ' para “' + rotuloEtapa(para) + '”? A cliente verá a etapa anterior.', { titulo: 'Voltar etapa', botao: 'Voltar' }))) return;
    botao.disabled = true;
    try {
      const agora = new Date().toISOString();
      const etapas = { ...(lead.etapas || {}), [para]: agora };
      if (voltando) ETAPAS.slice(ETAPAS.findIndex(([k]) => k === para) + 1).forEach(([k]) => { etapas[k] = ''; });
      await store.atualizar('leads', id, { etapa: para, etapas, ...(para === 'entregue' ? { status: 'Concluído' } : {}) });
      await publicarAcompanhamento({ ...lead, etapa: para, etapas });
      toast('Pedido ' + p.codigo + ': ' + rotuloEtapa(para) + '. A cliente já vê a mudança em “Meus pedidos”.');
      render();
    } catch (e) { toast('Não foi possível atualizar: ' + e.message, 'erro'); botao.disabled = false; }
  }

  const cupomLeadId = (codigo) => (listarCupons().find((c) => c.codigo === codigo && !c.repetido) || {}).lead?.id || '';
  async function pixRecebido(botao, id) {
    const p = pedidoDoLead(store.get('leads', id) || {});
    if (!p) return;
    const atrasado = p.estado === 'expirado';
    if (!(await confirmar((atrasado ? 'ATENÇÃO: o prazo deste pedido acabou às ' + hora(p.prazo) + ' e os produtos já voltaram ao site. Só confirme se o Pix chegou até esse horário. ' : '') +
      'Confirmar o Pix de ' + money(p.total) + ' do pedido ' + p.codigo + ' (' + (p.lead.nome || 'cliente') + ')? Os produtos ficam vendidos' + (p.cupom ? ' e o cupom ' + p.cupom + ' fica usado' : '') + '.',
      { titulo: 'Pix recebido', botao: 'Confirmar pagamento', perigo: atrasado }))) return;
    botao.disabled = true;
    try {
      const idCupom = p.cupom ? cupomLeadId(p.cupom) : '';
      const trava = p.segredo ? await sha256hex(p.segredo) : '';
      const leituras = [{ col: 'leads', id }].concat(idCupom ? [{ col: 'leads', id: idCupom }] : [], p.vagas.map((v) => ({ col: 'vagas-bf', id: v })));
      const agora = new Date().toISOString();
      let perdidas = [];
      await store.transacao(leituras, (docs) => {
        const [lead] = docs;
        const cupom = idCupom ? docs[1] : null;
        const vagasDocs = docs.slice(idCupom ? 2 : 1);
        if (!lead) throw new Error('pedido não encontrado');
        if (lead.pagoEm) throw new Error('este pedido já está pago');
        if (lead.canceladoEm) throw new Error('este pedido foi cancelado');
        const w = [{ col: 'leads', id, dados: { pagoEm: agora, status: 'Virou cliente', etapa: 'pago', etapas: { pago: agora } } }];
        perdidas = [];
        vagasDocs.forEach((v, i) => {
          // Se o prazo passou, outra cliente pode ter pegado a vaga: não mexe nela.
          if (v && v.trava === trava) w.push({ col: 'vagas-bf', id: p.vagas[i], dados: { pagoEm: agora, canceladoEm: '' } });
          else perdidas.push(p.vagas[i]);
        });
        if (cupom && !cupom.cupomUsadoEm) w.push({ col: 'leads', id: idCupom, dados: { cupomUsadoEm: agora } });
        return w;
      });
      await publicarAcompanhamento({ ...store.get('leads', id), pagoEm: agora, etapa: 'pago', etapas: { pago: agora } });
      toast(perdidas.length
        ? 'Pagamento confirmado, mas ' + perdidas.length + ' unidade(s) já tinham sido reservadas por outra cliente depois do prazo. Aumente o estoque se tiver o produto.'
        : 'Pagamento confirmado. Os produtos ficaram vendidos.');
      atualizarVagas(true);
      render();
    } catch (e) { toast('Não foi possível confirmar: ' + e.message, 'erro'); botao.disabled = false; }
  }

  async function cancelarPedido(botao, id) {
    const p = pedidoDoLead(store.get('leads', id) || {});
    if (!p) return;
    if (!(await confirmar('Cancelar o pedido ' + p.codigo + ' de ' + (p.lead.nome || 'cliente') + '? Ele sai da lista, os produtos voltam ao site na hora' + (p.cupom ? ' e o cupom ' + p.cupom + ' é perdido' : '') + '. Se a cliente estiver na tela do Pix, ela verá que o pedido foi cancelado.',
      { titulo: 'Cancelar pedido?', botao: 'Sim, cancelar pedido', perigo: true }))) return;
    botao.disabled = true;
    try {
      const agora = new Date().toISOString();
      const trava = p.segredo ? await sha256hex(p.segredo) : '';
      await store.transacao([{ col: 'leads', id }].concat(p.vagas.map((v) => ({ col: 'vagas-bf', id: v }))), ([lead, ...vagasDocs]) => {
        if (!lead) throw new Error('pedido não encontrado');
        if (lead.pagoEm) throw new Error('este pedido já está pago');
        return [{ col: 'leads', id, dados: { canceladoEm: agora } }]
          .concat(vagasDocs.map((v, i) => (v && v.trava === trava && !v.pagoEm ? { col: 'vagas-bf', id: p.vagas[i], dados: { canceladoEm: agora } } : null)).filter(Boolean));
      });
      await publicarAcompanhamento({ ...store.get('leads', id), canceladoEm: agora });
      atualizarVagas(true);
      toast('Pedido ' + p.codigo + ' cancelado e removido da lista.');
      render();
    } catch (e) { toast('Não foi possível cancelar: ' + e.message, 'erro'); botao.disabled = false; }
  }

  async function desfazerPix(botao, id) {
    const p = pedidoDoLead(store.get('leads', id) || {});
    if (!p) return;
    if (!(await confirmar('Desfazer a confirmação do Pix do pedido ' + p.codigo + '? Os produtos voltam ao site e o pedido fica cancelado.',
      { titulo: 'Desfazer pagamento', botao: 'Desfazer', perigo: true }))) return;
    botao.disabled = true;
    try {
      const idCupom = p.cupom ? cupomLeadId(p.cupom) : '';
      const agora = new Date().toISOString();
      const trava = p.segredo ? await sha256hex(p.segredo) : '';
      await store.transacao([{ col: 'leads', id }].concat(idCupom ? [{ col: 'leads', id: idCupom }] : [], p.vagas.map((v) => ({ col: 'vagas-bf', id: v }))), (docs) => {
        const [lead] = docs;
        const vagasDocs = docs.slice(idCupom ? 2 : 1);
        if (!lead || !lead.pagoEm) throw new Error('este pedido não está pago');
        return [{ col: 'leads', id, dados: { pagoEm: '', canceladoEm: agora, status: 'Em contato', etapa: '' } }]
          .concat(idCupom ? [{ col: 'leads', id: idCupom, dados: { cupomUsadoEm: '' } }] : [])
          .concat(vagasDocs.map((v, i) => (v && v.trava === trava ? { col: 'vagas-bf', id: p.vagas[i], dados: { pagoEm: '', canceladoEm: agora } } : null)).filter(Boolean));
      });
      await publicarAcompanhamento({ ...store.get('leads', id), pagoEm: '', canceladoEm: agora, etapa: '' });
      atualizarVagas(true);
      toast('Pagamento desfeito; produtos de volta ao estoque.');
      render();
    } catch (e) { toast('Não foi possível desfazer: ' + e.message, 'erro'); botao.disabled = false; }
  }

  render();
  return { live: true, render };
}
