// Gestão dos grupos do consórcio da Karen (painel › Loja da Karen › Grupos do consórcio).
// Cada grupo é um documento em ti/base/consorcios com a configuração (parcela, nº de parcelas,
// início, prêmio, vencimento, vagas) e a lista de membros com as mensalidades pagas e o resgate.
// Ao salvar, publica em ti/base/rastreio/consorcio-grupos só código, valores e datas (sem
// nomes nem telefones) para os formulários públicos de renovação e reserva.
import { store } from '../store.js';
import { esc, money, parseMoney, toast, confirmar, dataBR, whatsapp, modal, formatFone } from '../util.js';
import { icon } from '../icons.js';

const COL = 'consorcios';
const URL_RENOVACAO = 'https://italoinfotec.com.br/karen/sacola-misteriosa/renovacao/';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const soNumeros = (v) => String(v || '').replace(/\D/g, '');
const celular = (v) => { const d = soNumeros(v); return (d.length === 10 || d.length === 11) ? '55' + d : d; };
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const foneBR = (v) => { const d = soNumeros(v); return d ? formatFone(d.startsWith('55') && d.length > 11 ? d.slice(2) : d) : ''; };
const novoId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Datas e cálculos ----------
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
function somarMes(ym, n) {
  const [a, m] = ym.split('-').map(Number);
  const t = a * 12 + (m - 1) + n;
  return Math.floor(t / 12) + '-' + String((t % 12) + 1).padStart(2, '0');
}
const rotuloMes = (ym, longo = false) => { const [a, m] = ym.split('-').map(Number); return longo ? MESES[m - 1] + ' ' + a : MES_CURTO[m - 1] + '/' + String(a).slice(2); };
export const mesesDo = (g) => (g.inicio && g.parcelas > 0) ? Array.from({ length: g.parcelas }, (_, i) => somarMes(g.inicio, i)) : [];
export const fimDo = (g) => (g.inicio && g.parcelas > 0) ? somarMes(g.inicio, g.parcelas - 1) : '';
export const nomeDoGrupo = (g) => 'Consorcio ' + g.codigo + ' - ' + money(g.valorParcela, false) + ' - ' + (g.inicio ? rotuloMes(g.inicio, true) + ' a ' + rotuloMes(fimDo(g), true) : 'datas a definir');

export function situacaoGrupo(g) {
  if (!g.inicio) return 'formando';
  const hoje = mesAtual();
  if (hoje < g.inicio) return 'formando';
  if (hoje > fimDo(g)) return 'encerrado';
  return 'andamento';
}
const ROTULO_SITUACAO = { formando: ['Formando', 'b-info'], andamento: ['Em andamento', 'b-ok'], encerrado: ['Encerrado', 'b-muted'] };

/** Meses que já deviam estar pagos: os anteriores ao mês atual e o atual depois do vencimento. */
function mesesDevidos(g) {
  const hoje = mesAtual();
  const dia = new Date().getDate();
  const venc = Number(g.vencimento) || 10;
  return mesesDo(g).filter((ym) => ym < hoje || (ym === hoje && dia > venc));
}
export function resumoMembro(g, m) {
  const pagos = m.pagos || {};
  const meses = mesesDo(g);
  const pagas = meses.filter((ym) => pagos[ym]).length;
  const atrasadas = mesesDevidos(g).filter((ym) => !pagos[ym]);
  return { pagas, total: meses.length, atrasadas, quitado: meses.length > 0 && pagas === meses.length };
}
function resumoGrupo(g) {
  const membros = g.membros || [];
  const valor = Number(g.valorParcela) || 0;
  let pagas = 0, atrasadasQtd = 0, comAtraso = 0;
  membros.forEach((m) => { const r = resumoMembro(g, m); pagas += r.pagas; atrasadasQtd += r.atrasadas.length; if (r.atrasadas.length) comAtraso++; });
  const hoje = mesAtual();
  const meses = mesesDo(g);
  const idx = meses.indexOf(hoje);
  return {
    membros: membros.length,
    arrecadado: pagas * valor,
    previsto: membros.length * meses.length * valor,
    emAtraso: atrasadasQtd * valor,
    comAtraso,
    parcelaAtual: idx >= 0 ? idx + 1 : (hoje > fimDo(g) ? meses.length : 0),
    pagosNoMes: idx >= 0 ? membros.filter((m) => (m.pagos || {})[hoje]).length : 0,
    resgataram: membros.filter((m) => m.resgatadoEm).length,
  };
}
export const gruposAtuais = () => store.lista(COL).slice().sort((a, b) => String(b.inicio || '9999').localeCompare(String(a.inicio || '9999')) || String(b.codigo).localeCompare(String(a.codigo)));
export function contarAtrasos() {
  return gruposAtuais().filter((g) => situacaoGrupo(g) === 'andamento').reduce((n, g) => n + resumoGrupo(g).comAtraso, 0);
}

// ---------- Publicação para os formulários públicos (sem dados pessoais) ----------
async function publicarGrupos() {
  const grupos = gruposAtuais().map((g) => ({
    codigo: String(g.codigo || ''), nome: nomeDoGrupo(g), valorParcela: Number(g.valorParcela) || 0,
    parcelas: Number(g.parcelas) || 0, inicio: g.inicio || '', fim: fimDo(g), premio: Number(g.premio) || 0,
    situacao: situacaoGrupo(g), vagas: Number(g.vagas) || 0, ocupadas: (g.membros || []).length,
  })).filter((g) => g.codigo);
  try { await store.definir('rastreio', 'consorcio-grupos', { grupos, atualizadoEm: new Date().toISOString() }); }
  catch (e) { console.warn('Publicação dos grupos:', e); }
}

// ---------- Grupos atuais (cadastro inicial a partir das etiquetas do sistema antigo) ----------
const GRUPOS_INICIAIS = [
  { codigo: 'G1', valorParcela: 35, parcelas: 10, inicio: '2025-07', membros: [
    ['Juscelia Almeida de Matos Fernandes', '33998177165'], ['Ireni Alves Pinheiro Jardim', '33984388080'], ['Larissa Nascimento Silva', '33984180272'],
    ['Marcos de Souza Ferreira', '33998035293'], ['Maria Anita Duarte Sena', '31995925468'], ['Silvana Aparecida Duarte', '33984069220']] },
  { codigo: 'G2', valorParcela: 25, parcelas: 10, inicio: '2025-08', membros: [
    ['Jackeline Teles', '33984446597'], ['Neuza Pereira', '33984091236'], ['Nilma Garajau', '33984023735'], ['Simony Souza Santos', '33984045200']] },
  { codigo: 'G3', valorParcela: 50, parcelas: 10, inicio: '2026-04', membros: [
    ['Adrieny Karla', '33984200711'], ['Delci', '33999964876'], ['Edilene Master', '33991725348'], ['Jessica Alves', '33984326176'],
    ['Juliano Juscelia', '33984434533'], ['Juscelia Almeida de Matos Fernandes', '33998177165'], ['Leia De Oliveira', '33998459189'],
    ['Luzia Juscelia', '33991124609'], ['Rafael Cornelio', '33998234067'], ['Samile', '33998025604']] },
  { codigo: 'G4', valorParcela: 35, parcelas: 10, inicio: '2026-05', membros: [
    ['Gabriela Martins de Castro', '33984028333'], ['Ireni Alves Pinheiro Jardim', '33984388080'], ['Jackeline Teles', '33984446597'],
    ['Juscelia Almeida de Matos Fernandes', '33998177165'], ['Larissa Nascimento Silva', '33984180272'], ['Luana Sabino dos Santos', '33984394699'],
    ['Marcos de Souza Ferreira', '33998035293'], ['Maria Anita Duarte Sena', '31995925468'], ['Neuza Pereira', '33984091236'], ['Silvana Aparecida Duarte', '33984069220']] },
  { codigo: 'G5', valorParcela: 50, parcelas: 11, inicio: '2026-06', membros: [
    ['Alber Neto', '33984671709'], ['Christine Teles Araújo', '33984358850'], ['Elizeth Freire Dornelas', '33984237807'],
    ['Ellem Maressa da Silva Coutinho', '33997060195'], ['Elton Lopes Pasos', '33984657007'], ['Gilsilene Ferreira Neto', '33984055210'],
    ['Nilma Garajau', '33984023735'], ['Priscila de Souza Silva Peitieiros', '33988918084'], ['Regina Mattos Farias', '33984169162'], ['Simony Souza Santos', '33984045200']] },
];

// ---------- Interessados: renovações "sim/talvez" e banco de reserva ----------
const renovaDe = (l) => (String(l.detalhe || '').match(/\[ref:renova-(sim|talvez|nao)\]/) || [])[1] || '';
const valorDe = (l) => (String(l.detalhe || '').match(/\[valor:([^\]]+)\]/) || [])[1] || '';
function interessados() {
  const noGrupo = new Set(gruposAtuais().filter((g) => situacaoGrupo(g) === 'formando').flatMap((g) => (g.membros || []).map((m) => soNumeros(m.whatsapp))));
  const vistos = new Set();
  return store.lista('leads')
    .filter((l) => (l.origem === 'consorcio-renovacao' && ['sim', 'talvez'].includes(renovaDe(l))) || l.origem === 'consorcio-reserva')
    .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))
    .filter((l) => { const t = soNumeros(l.whatsapp); if (!t || vistos.has(t) || noGrupo.has(t)) return false; vistos.add(t); return true; })
    .map((l) => ({ nome: l.nome, whatsapp: l.whatsapp, tipo: l.origem === 'consorcio-reserva' ? 'Reserva' + (valorDe(l) ? ' · R$ ' + valorDe(l) : '') : (renovaDe(l) === 'sim' ? 'Renova' : 'Talvez') }));
}

// ---------- HTML do cartão ----------
export const CARD_GRUPOS = '<div id="status-bot" class="sub" style="margin:-6px 0 12px"></div><div class="kpis" id="kpis-grupos"></div>' +
  '<div class="card" style="margin:18px 0"><div class="card-head"><h2>Grupos</h2><span id="resumo-grupos" class="sub"></span>' +
  '<div class="acoes" style="gap:8px"><button type="button" class="btn btn-sm" id="importar-grupos" hidden>' + icon('download', 14) + ' Cadastrar G1 a G5</button>' +
  '<button type="button" class="btn btn-primary btn-sm" id="novo-grupo">' + icon('plus', 14) + ' Novo grupo</button></div></div>' +
  '<div id="lista-grupos" class="grupos-grid"></div></div>' +
  '<div id="detalhe-grupo"></div>' +
  '<style>.grupos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;padding:4px 0}' +
  '.grupo-card{border:1px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;background:var(--surface);text-align:left;font:inherit;color:inherit;transition:border-color .2s,box-shadow .2s}' +
  '.grupo-card:hover,.grupo-card[aria-current="true"]{border-color:var(--primary);box-shadow:var(--shadow)}.grupo-card h3{margin:0 0 4px;font-size:1.15rem;display:flex;justify-content:space-between;gap:8px;align-items:center}' +
  '.grupo-card .linha{display:flex;justify-content:space-between;font-size:.85rem;margin-top:6px}.barra{height:7px;border-radius:9px;background:var(--muted-bg);margin-top:10px;overflow:hidden}.barra i{display:block;height:100%;background:var(--primary);border-radius:9px}' +
  '.meses{display:flex;flex-wrap:wrap;gap:4px;min-width:260px}.mes{border:1px solid var(--border-strong);background:transparent;border-radius:7px;padding:3px 6px;font-size:.72rem;cursor:pointer;line-height:1.2;color:inherit}' +
  '.mes.pago{background:var(--ok);border-color:var(--ok);color:#fff}.mes.atrasado{border-color:var(--danger);color:var(--danger);font-weight:700;background:var(--danger-bg)}.mes.futuro{opacity:.55}' +
  '.membro-nome{font-weight:700}.membro-sub{font-size:.8rem;opacity:.75}</style>';

// ---------- Tela ----------
export function montarGrupos(el) {
  const $ = (s) => el.querySelector(s);
  let selecionado = null;

  $('#novo-grupo').onclick = () => editarGrupo(null);
  // Sinal de vida do bot do Discord (karen-bot, no PC), gravado em ti/base/botKaren/status.
  store.buscar('botKaren').then((docs) => {
    const st = docs.find((d) => d.id === 'status');
    const alvo = $('#status-bot');
    if (!alvo) return;
    if (!st || !st.vistoEm) { alvo.innerHTML = icon('cloud', 14) + ' Bot do Discord ainda não instalado'; return; }
    const min = Math.round((Date.now() - Date.parse(st.vistoEm)) / 60000);
    const ok = min <= 20 && st.discord;
    alvo.innerHTML = '<span class="badge ' + (ok ? 'b-ok' : 'b-warn') + '">' + (ok ? 'Bot do Discord ligado' : 'Bot do Discord desligado') + '</span> ' +
      '<span class="sub">visto há ' + (min < 60 ? min + ' min' : Math.round(min / 60) + ' h') + (ok ? '' : ' · o PC pode estar desligado; nada se perde, ele põe tudo em dia quando ligar') + '</span>';
  }).catch(() => {});
  $('#importar-grupos').onclick = importarIniciais;

  function desenhar() {
    if (!$('#lista-grupos')) return;
    const grupos = gruposAtuais();
    const ativos = grupos.filter((g) => situacaoGrupo(g) === 'andamento');
    const membrosAtivos = new Set(ativos.flatMap((g) => (g.membros || []).map((m) => soNumeros(m.whatsapp) || m.nome)));
    const hoje = mesAtual();
    const doMes = ativos.reduce((t, g) => t + resumoGrupo(g).pagosNoMes * (Number(g.valorParcela) || 0), 0);
    const previstoMes = ativos.reduce((t, g) => t + (g.membros || []).length * (Number(g.valorParcela) || 0), 0);
    const atraso = ativos.reduce((t, g) => t + resumoGrupo(g).emAtraso, 0);
    const comAtraso = ativos.reduce((t, g) => t + resumoGrupo(g).comAtraso, 0);
    const kpi = (titulo, ico, v, sub) => '<div class="kpi"><div class="kpi-top">' + esc(titulo) + ' ' + icon(ico, 16) + '</div><div class="kpi-val">' + v + '</div><div class="kpi-sub">' + sub + '</div></div>';
    $('#kpis-grupos').innerHTML = kpi('Grupos em andamento', 'users', ativos.length, membrosAtivos.size + ' pessoa(s) participando') +
      kpi('Recebido em ' + rotuloMes(hoje, true).toLowerCase(), 'pix', money(doMes), 'de ' + money(previstoMes) + ' previsto no mês') +
      kpi('Em atraso', 'alert', money(atraso), comAtraso + ' participação(ões) com parcela atrasada') +
      kpi('Interessados no próximo', 'trend', interessados().length, 'renovações e reservas ainda sem grupo');
    $('#resumo-grupos').textContent = grupos.length ? grupos.length + ' grupo(s)' : '';
    $('#importar-grupos').hidden = grupos.some((g) => GRUPOS_INICIAIS.some((i) => i.codigo === g.codigo));
    $('#lista-grupos').innerHTML = grupos.length ? grupos.map((g) => {
      const r = resumoGrupo(g);
      const s = situacaoGrupo(g);
      const [rot, cls] = ROTULO_SITUACAO[s];
      const pct = r.previsto ? Math.round((r.arrecadado / r.previsto) * 100) : 0;
      return '<button type="button" class="grupo-card" data-grupo="' + esc(g.id) + '"' + (selecionado === g.id ? ' aria-current="true"' : '') + '>' +
        '<h3>' + esc(g.codigo) + ' <span class="badge ' + cls + '">' + rot + '</span></h3>' +
        '<div class="sub">' + money(g.valorParcela) + ' × ' + (g.parcelas || '?') + ' · ' + (g.inicio ? rotuloMes(g.inicio) + ' a ' + rotuloMes(fimDo(g)) : 'datas a definir') + '</div>' +
        '<div class="linha"><span>Prêmio</span><b>' + money(g.premio) + '</b></div>' +
        '<div class="linha"><span>Membros</span><b>' + r.membros + (g.vagas ? ' / ' + g.vagas : '') + '</b></div>' +
        (s === 'andamento' ? '<div class="linha"><span>Parcela atual</span><b>' + r.parcelaAtual + ' de ' + g.parcelas + '</b></div>' : '') +
        (s !== 'formando' ? '<div class="linha"><span>Arrecadado</span><b>' + money(r.arrecadado) + '</b></div>' : '') +
        (r.comAtraso && s !== 'formando' ? '<div class="linha" style="color:var(--danger)"><span>Em atraso</span><b>' + r.comAtraso + ' · ' + money(r.emAtraso) + '</b></div>' : '') +
        (s !== 'formando' ? '<div class="barra" title="' + pct + '% arrecadado"><i style="width:' + pct + '%"></i></div>' : '') +
        '</button>';
    }).join('') : '<div class="sub" style="padding:18px">Nenhum grupo cadastrado. Use <b>Cadastrar G1 a G5</b> para trazer os grupos atuais com os membros, ou <b>Novo grupo</b>.</div>';
    el.querySelectorAll('[data-grupo]').forEach((b) => b.onclick = () => { selecionado = selecionado === b.dataset.grupo ? null : b.dataset.grupo; desenhar(); if (selecionado) $('#detalhe-grupo').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    desenharDetalhe();
  }

  // ---------- Detalhe do grupo ----------
  function desenharDetalhe() {
    const alvo = $('#detalhe-grupo');
    const g = selecionado && store.get(COL, selecionado);
    if (!g) { alvo.innerHTML = ''; return; }
    const meses = mesesDo(g);
    const devidos = new Set(mesesDevidos(g));
    const r = resumoGrupo(g);
    const membros = (g.membros || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const situacaoMembro = (m) => {
      const x = resumoMembro(g, m);
      if (x.quitado) return '<span class="badge b-ok">Quitado</span>';
      if (x.atrasadas.length) return '<span class="badge b-danger">' + x.atrasadas.length + ' atrasada(s)</span>';
      return situacaoGrupo(g) === 'formando' ? '<span class="badge b-info">Aguardando início</span>' : '<span class="badge b-ok">Em dia</span>';
    };
    alvo.innerHTML = '<div class="card flush"><div class="card-head"><h2>' + esc(g.codigo) + ' · ' + money(g.valorParcela) + ' por mês</h2>' +
      '<span class="sub">' + esc(g.inicio ? rotuloMes(g.inicio, true) + ' a ' + rotuloMes(fimDo(g), true) : 'Datas a definir') + ' · prêmio ' + money(g.premio) + ' · vence dia ' + (g.vencimento || 10) + '</span>' +
      '<div class="acoes" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="g-editar">' + icon('edit', 14) + ' Configurar</button>' +
      '<button type="button" class="btn btn-sm" id="g-membro">' + icon('plus', 14) + ' Adicionar membro</button>' +
      (situacaoGrupo(g) !== 'formando' ? '<button type="button" class="btn btn-sm" id="g-emdia" title="Marca como pagas todas as parcelas até o mês passado">' + icon('check', 14) + ' Todos em dia até o mês passado</button>' : '') +
      (situacaoGrupo(g) === 'formando' ? '<button type="button" class="btn btn-sm btn-primary" id="g-puxar" title="Adiciona de uma vez quem respondeu Sim na renovação">' + icon('users', 14) + ' Adicionar quem renovou</button>' : '') +
      '<button type="button" class="btn btn-sm" id="g-copiar">' + icon('copy', 14) + ' Copiar lista</button></div></div>' +
      '<p class="sub" style="padding:0 20px">Toque no mês para marcar ou desmarcar a parcela paga. Em vermelho: parcela vencida sem pagamento. ' +
      r.membros + ' membro(s) · ' + money(r.arrecadado) + ' arrecadado de ' + money(r.previsto) + ' · ' + r.resgataram + ' resgate(s) feitos.' + (g.obs ? '<br><b>Obs.:</b> ' + esc(g.obs) : '') + '</p>' +
      (membros.length ? '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Membro</th><th>Mensalidades</th><th>Pagas</th><th>Situação</th><th>Resgate do prêmio</th><th>Ações</th></tr></thead><tbody>' +
      membros.map((m) => {
        const x = resumoMembro(g, m);
        const pagos = m.pagos || {};
        return '<tr><td><div class="membro-nome">' + esc(m.nome) + '</div><div class="membro-sub">' + esc(foneBR(m.whatsapp) || 'sem WhatsApp') + (m.obs ? ' · ' + esc(m.obs) : '') + '</div></td>' +
          '<td><div class="meses">' + meses.map((ym) => '<button type="button" class="mes ' + (pagos[ym] ? 'pago' : devidos.has(ym) ? 'atrasado' : 'futuro') + '" data-mes="' + ym + '" data-m="' + esc(m.id) + '" title="' +
            esc(rotuloMes(ym, true) + (pagos[ym] ? ' · pago em ' + dataBR(pagos[ym]) : devidos.has(ym) ? ' · em atraso' : '')) + '">' + rotuloMes(ym) + '</button>').join('') + '</div></td>' +
          '<td class="num nowrap">' + x.pagas + '/' + x.total + '</td><td>' + situacaoMembro(m) + '</td>' +
          '<td>' + (m.resgatadoEm ? '<span class="badge b-ok">Resgatou ' + esc(dataBR(m.resgatadoEm)) + '</span><div class="membro-sub">' + (m.resgateValor ? 'Produtos: ' + money(m.resgateValor) : '') +
            (m.resgateValor > g.premio ? ' · diferença ' + money(m.resgateValor - g.premio) : '') + (m.resgateObs ? '<br>' + esc(m.resgateObs) : '') + '</div>' +
            '<button type="button" class="btn btn-sm" data-resgate="' + esc(m.id) + '" style="margin-top:4px">Editar</button>'
            : '<button type="button" class="btn btn-sm" data-resgate="' + esc(m.id) + '">' + icon('gift', 14) + ' Registrar resgate</button>') + '</td>' +
          '<td class="nowrap">' + (x.atrasadas.length && m.whatsapp ? '<a class="btn btn-sm btn-primary" target="_blank" rel="noopener" href="' + esc(whatsapp(m.whatsapp, mensagemCobranca(g, m, x))) + '">Lembrar parcela</a> ' : '') +
          (m.whatsapp ? '<a class="btn btn-sm" target="_blank" rel="noopener" href="' + esc(whatsapp(m.whatsapp, mensagemRenovacao(g, m))) + '">Renovação</a> ' : '') +
          '<button type="button" class="btn btn-sm" data-editar-m="' + esc(m.id) + '" title="Editar membro">' + icon('edit', 14) + '</button> ' +
          '<button type="button" class="btn btn-sm" data-remover-m="' + esc(m.id) + '" title="Remover do grupo">' + icon('trash', 14) + '</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="sub" style="padding:28px">Nenhum membro neste grupo. Clique em <b>Adicionar membro</b> para incluir alguém ou puxar quem respondeu a renovação e o banco de reserva.</div>') + '</div>';

    $('#g-editar').onclick = () => editarGrupo(g);
    $('#g-membro').onclick = () => editarMembro(g, null);
    if ($('#g-emdia')) $('#g-emdia').onclick = () => todosEmDia(g);
    if ($('#g-puxar')) $('#g-puxar').onclick = () => puxarRenovacoes(g);
    $('#g-copiar').onclick = async () => {
      const txt = nomeDoGrupo(g) + '\n' + membros.map((m, i) => (i + 1) + '. ' + m.nome + (m.whatsapp ? ' · ' + m.whatsapp : '') + ' · ' + resumoMembro(g, m).pagas + '/' + meses.length + ' pagas').join('\n');
      try { await navigator.clipboard.writeText(txt); toast('Lista copiada.'); } catch (e) { toast('Não foi possível copiar.', 'erro'); }
    };
    alvo.querySelectorAll('[data-mes]').forEach((b) => b.onclick = () => alternarMes(g, b.dataset.m, b.dataset.mes, b));
    alvo.querySelectorAll('[data-resgate]').forEach((b) => b.onclick = () => registrarResgate(g, b.dataset.resgate));
    alvo.querySelectorAll('[data-editar-m]').forEach((b) => b.onclick = () => editarMembro(g, (g.membros || []).find((m) => m.id === b.dataset.editarM)));
    alvo.querySelectorAll('[data-remover-m]').forEach((b) => b.onclick = () => removerMembro(g, b.dataset.removerM));
  }

  // ---------- Mensagens prontas ----------
  function mensagemCobranca(g, m, x) {
    const lista = x.atrasadas.map((ym) => rotuloMes(ym, true)).join(', ');
    return 'Oi, ' + primeiroNome(m.nome) + '! Aqui é a Karen 💝 Passando para lembrar, com carinho, da parcela do Consórcio ' + g.codigo + ' (' + money(g.valorParcela) + ')' +
      ' referente a ' + lista + (x.atrasadas.length > 1 ? ', total de ' + money(x.atrasadas.length * g.valorParcela) : '') + '. Se já pagou, me manda o comprovante que eu dou baixa. Obrigada! 🌸';
  }
  function mensagemRenovacao(g, m) {
    const encerrado = situacaoGrupo(g) === 'encerrado';
    return 'Oi, ' + primeiroNome(m.nome) + '! Aqui é a Karen 💝 Muito obrigada por ' + (encerrado ? 'ter participado' : 'fazer parte') + ' do nosso Consórcio ' + g.codigo + '! ' +
      'Já estamos organizando o próximo grupo e quem participa tem prioridade na vaga. Conta pra mim como ' + (encerrado ? 'foi' : 'está sendo') +
      ' e se quer garantir a sua, é sem compromisso e leva menos de 2 minutos: ' + URL_RENOVACAO + '?g=' + encodeURIComponent(g.codigo);
  }

  // ---------- Gravações ----------
  async function salvarMembros(g, membros, aviso) {
    try { await store.atualizar(COL, g.id, { membros }); if (aviso) toast(aviso); publicarGrupos(); }
    catch (e) { toast('Não foi possível salvar: ' + e.message, 'erro'); }
  }
  async function alternarMes(g, idMembro, ym, botao) {
    botao.disabled = true;
    const atual = store.get(COL, g.id) || g;
    const membros = (atual.membros || []).map((m) => {
      if (m.id !== idMembro) return m;
      const pagos = { ...(m.pagos || {}) };
      if (pagos[ym]) delete pagos[ym]; else pagos[ym] = new Date().toISOString().slice(0, 10);
      return { ...m, pagos };
    });
    await salvarMembros(atual, membros);
  }
  async function todosEmDia(g) {
    const ate = somarMes(mesAtual(), -1);
    const alvo = mesesDo(g).filter((ym) => ym <= ate);
    if (!alvo.length) { toast('Ainda não há parcelas de meses anteriores neste grupo.'); return; }
    if (!(await confirmar('Marcar como pagas as parcelas de ' + rotuloMes(alvo[0], true) + ' a ' + rotuloMes(alvo[alvo.length - 1], true) + ' de todos os membros do ' + g.codigo + '? Use para começar o controle; depois desmarque quem estiver devendo.', { titulo: 'Todos em dia', botao: 'Marcar como pagas' }))) return;
    const membros = (g.membros || []).map((m) => {
      const pagos = { ...(m.pagos || {}) };
      alvo.forEach((ym) => { if (!pagos[ym]) pagos[ym] = ym + '-' + String(Number(g.vencimento) || 10).padStart(2, '0'); });
      return { ...m, pagos };
    });
    await salvarMembros(g, membros, 'Parcelas marcadas como pagas até ' + rotuloMes(ate, true) + '.');
  }
  async function puxarRenovacoes(g) {
    const lista = interessados().filter((p) => p.tipo === 'Renova');
    if (!lista.length) { toast('Ninguém com resposta "Sim, quero renovar" fora deste grupo ainda.'); return; }
    if (!(await confirmar('Adicionar ao ' + g.codigo + ' as ' + lista.length + ' pessoa(s) que responderam "Sim, quero renovar"? ' + lista.map((p) => p.nome).join(', ') + '.', { titulo: 'Adicionar quem renovou', botao: 'Adicionar' }))) return;
    const atual = store.get(COL, g.id) || g;
    const hoje = new Date().toISOString().slice(0, 10);
    await salvarMembros(atual, [...(atual.membros || []), ...lista.map((p) => ({ id: novoId(), nome: p.nome, whatsapp: celular(p.whatsapp), obs: 'Renovou pelo formulário', pagos: {}, entrouEm: hoje }))],
      lista.length + ' pessoa(s) adicionada(s) ao ' + g.codigo + '.');
  }
  async function removerMembro(g, id) {
    const m = (g.membros || []).find((x) => x.id === id);
    if (!m || !(await confirmar('Remover ' + m.nome + ' do ' + g.codigo + '? O histórico de parcelas dela neste grupo será apagado.', { titulo: 'Remover membro', botao: 'Remover', perigo: true }))) return;
    await salvarMembros(g, (g.membros || []).filter((x) => x.id !== id), m.nome + ' removido(a) do grupo.');
  }

  function editarGrupo(g) {
    const novo = !g;
    const proximo = 'G' + (Math.max(0, ...gruposAtuais().map((x) => Number(String(x.codigo).replace(/\D/g, '')) || 0)) + 1);
    const d = g || { codigo: proximo, valorParcela: 50, parcelas: 10, inicio: somarMes(mesAtual(), 1), vencimento: 10, vagas: 10, premio: '' };
    const m = modal({ titulo: novo ? 'Novo grupo do consórcio' : 'Configurar ' + g.codigo, largura: 620, conteudo:
      '<form class="form" id="f-grupo"><div class="campo c4"><label>Código do grupo</label><input name="codigo" required maxlength="10" value="' + esc(d.codigo) + '"></div>' +
      '<div class="campo c4"><label>Mensalidade (R$)</label><input name="valorParcela" required inputmode="decimal" value="' + esc(money(d.valorParcela, false)) + '"></div>' +
      '<div class="campo c4"><label>Nº de parcelas</label><input name="parcelas" type="number" min="1" max="36" required value="' + esc(d.parcelas) + '"></div>' +
      '<div class="campo c4"><label>Mês de início</label><input name="inicio" type="month" required value="' + esc(d.inicio || '') + '"></div>' +
      '<div class="campo c4"><label>Dia do vencimento</label><input name="vencimento" type="number" min="1" max="28" value="' + esc(d.vencimento || 10) + '"></div>' +
      '<div class="campo c4"><label>Vagas (opcional)</label><input name="vagas" type="number" min="0" max="200" value="' + esc(d.vagas || '') + '"></div>' +
      '<div class="campo c6"><label>Valor do prêmio (R$)</label><input name="premio" inputmode="decimal" placeholder="Em branco = mensalidade × parcelas" value="' + esc(d.premio ? money(d.premio, false) : '') + '">' +
      '<div class="dica" id="dica-premio"></div></div>' +
      '<div class="campo c6"><label>Término</label><input id="fim-grupo" readonly class="mono"></div>' +
      '<div class="campo c12"><label>Observações (regras, sorteio, brinde…)</label><textarea name="obs" maxlength="500">' + esc(d.obs || '') + '</textarea></div>' +
      '<div class="c12 form-acoes">' + (novo ? '' : '<button type="button" class="btn btn-danger" id="excluir-grupo">Excluir grupo</button>') +
      '<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">Salvar grupo</button></div></form>' });
    const f = m.el.querySelector('#f-grupo');
    const atualizar = () => {
      const v = parseMoney(f.valorParcela.value), n = Number(f.parcelas.value) || 0;
      m.el.querySelector('#dica-premio').textContent = v && n ? 'Total pago por membro: ' + money(v * n) : '';
      m.el.querySelector('#fim-grupo').value = f.inicio.value && n ? rotuloMes(somarMes(f.inicio.value, n - 1), true) : '';
    };
    ['input', 'change'].forEach((ev) => f.addEventListener(ev, atualizar)); atualizar();
    const ex = m.el.querySelector('#excluir-grupo');
    if (ex) ex.onclick = async () => {
      if (!(await confirmar('Excluir o grupo ' + g.codigo + ' com ' + (g.membros || []).length + ' membro(s) e todo o histórico de parcelas? Não dá para desfazer.', { titulo: 'Excluir grupo', botao: 'Excluir', perigo: true }))) return;
      try { await store.remover(COL, g.id); selecionado = null; m.fechar(); toast('Grupo excluído.'); publicarGrupos(); } catch (e) { toast('Erro ao excluir: ' + e.message, 'erro'); }
    };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const codigo = f.codigo.value.trim().toUpperCase();
      if (gruposAtuais().some((x) => x.codigo === codigo && (!g || x.id !== g.id))) { toast('Já existe um grupo ' + codigo + '.', 'erro'); return; }
      const valorParcela = parseMoney(f.valorParcela.value), parcelas = Number(f.parcelas.value) || 0;
      if (!valorParcela || !parcelas || !f.inicio.value) { toast('Informe mensalidade, parcelas e mês de início.', 'erro'); return; }
      const dados = { codigo, valorParcela, parcelas, inicio: f.inicio.value, vencimento: Number(f.vencimento.value) || 10,
        vagas: Number(f.vagas.value) || 0, premio: parseMoney(f.premio.value) || valorParcela * parcelas, obs: f.obs.value.trim() };
      try {
        if (novo) { const r = await store.criar(COL, { ...dados, membros: [] }); selecionado = r.id; }
        else await store.atualizar(COL, g.id, dados);
        m.fechar(); toast('Grupo ' + codigo + ' salvo.'); publicarGrupos();
      } catch (e) { toast('Não foi possível salvar: ' + e.message, 'erro'); }
    };
  }

  function editarMembro(g, membro) {
    const novo = !membro;
    const lista = novo ? interessados() : [];
    const m = modal({ titulo: novo ? 'Adicionar membro ao ' + g.codigo : 'Editar ' + membro.nome, largura: 560, conteudo:
      (lista.length ? '<div class="campo"><label>Puxar de quem respondeu (renovação ou reserva)</label><select id="m-interessado"><option value="">Escolher…</option>' +
        lista.map((p, i) => '<option value="' + i + '">' + esc(p.nome + ' · ' + p.tipo) + '</option>').join('') + '</select></div>' : '') +
      '<form class="form" id="f-membro"><div class="campo c12"><label>Nome</label><input name="nome" required maxlength="80" value="' + esc(membro?.nome || '') + '"></div>' +
      '<div class="campo c12"><label>WhatsApp</label><input name="whatsapp" inputmode="tel" placeholder="(33) 99999-9999" value="' + esc(membro?.whatsapp || '') + '"></div>' +
      '<div class="campo c12"><label>Observação</label><input name="obs" maxlength="120" placeholder="Ex.: paga sempre no dia 5" value="' + esc(membro?.obs || '') + '"></div>' +
      '<div class="c12 form-acoes"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">' + (novo ? 'Adicionar' : 'Salvar') + '</button></div></form>' });
    const f = m.el.querySelector('#f-membro');
    const sel = m.el.querySelector('#m-interessado');
    if (sel) sel.onchange = () => { const p = lista[Number(sel.value)]; if (p) { f.nome.value = p.nome; f.whatsapp.value = p.whatsapp; } };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const atual = store.get(COL, g.id) || g;
      const tel = celular(f.whatsapp.value);
      if (tel && !/^55[0-9]{10,11}$/.test(tel)) { toast('WhatsApp inválido. Use DDD + número.', 'erro'); return; }
      const dados = { nome: f.nome.value.trim(), whatsapp: tel, obs: f.obs.value.trim() };
      if (novo && atual.vagas && (atual.membros || []).length >= atual.vagas && !(await confirmar('O ' + g.codigo + ' já está com as ' + atual.vagas + ' vagas preenchidas. Adicionar mesmo assim?', { botao: 'Adicionar' }))) return;
      const membros = novo ? [...(atual.membros || []), { id: novoId(), ...dados, pagos: {}, entrouEm: new Date().toISOString().slice(0, 10) }]
        : (atual.membros || []).map((x) => x.id === membro.id ? { ...x, ...dados } : x);
      m.fechar();
      await salvarMembros(atual, membros, novo ? dados.nome + ' entrou no ' + g.codigo + '.' : 'Membro atualizado.');
    };
  }

  function registrarResgate(g, id) {
    const membro = (g.membros || []).find((x) => x.id === id);
    if (!membro) return;
    const m = modal({ titulo: 'Resgate do prêmio · ' + membro.nome, largura: 520, conteudo:
      '<form class="form" id="f-resgate"><p class="sub c12" style="margin:0">Prêmio do ' + esc(g.codigo) + ': <b>' + money(g.premio) + '</b>. Se os produtos passarem disso, a cliente paga a diferença.</p>' +
      '<div class="campo c6"><label>Data do resgate</label><input name="data" type="date" required value="' + esc(membro.resgatadoEm || new Date().toISOString().slice(0, 10)) + '"></div>' +
      '<div class="campo c6"><label>Valor em produtos (R$)</label><input name="valor" inputmode="decimal" value="' + esc(membro.resgateValor ? money(membro.resgateValor, false) : money(g.premio, false)) + '"><div class="dica" id="dif"></div></div>' +
      '<div class="campo c12"><label>Produtos escolhidos (opcional)</label><textarea name="obs" maxlength="300">' + esc(membro.resgateObs || '') + '</textarea></div>' +
      '<div class="c12 form-acoes">' + (membro.resgatadoEm ? '<button type="button" class="btn btn-danger" id="desfazer-resgate">Desfazer resgate</button>' : '') +
      '<button type="button" class="btn" data-fechar>Cancelar</button><button class="btn btn-primary">Salvar resgate</button></div></form>' });
    const f = m.el.querySelector('#f-resgate');
    const dif = () => { const v = parseMoney(f.valor.value); m.el.querySelector('#dif').textContent = v > g.premio ? 'Diferença a pagar: ' + money(v - g.premio) : v && v < g.premio ? 'Saldo não usado: ' + money(g.premio - v) : ''; };
    f.valor.addEventListener('input', dif); dif();
    const salvar = async (dados, aviso) => {
      const atual = store.get(COL, g.id) || g;
      m.fechar();
      await salvarMembros(atual, (atual.membros || []).map((x) => x.id === id ? { ...x, ...dados } : x), aviso);
    };
    const desf = m.el.querySelector('#desfazer-resgate');
    if (desf) desf.onclick = () => salvar({ resgatadoEm: '', resgateValor: 0, resgateObs: '' }, 'Resgate desfeito.');
    f.onsubmit = (ev) => { ev.preventDefault(); salvar({ resgatadoEm: f.data.value, resgateValor: parseMoney(f.valor.value), resgateObs: f.obs.value.trim() }, 'Resgate registrado.'); };
  }

  async function importarIniciais() {
    const existentes = new Set(gruposAtuais().map((g) => g.codigo));
    const faltam = GRUPOS_INICIAIS.filter((g) => !existentes.has(g.codigo));
    if (!faltam.length) { toast('Os grupos G1 a G5 já estão cadastrados.'); return; }
    if (!(await confirmar('Cadastrar ' + faltam.map((g) => g.codigo).join(', ') + ' com os membros das etiquetas do sistema antigo? Nenhuma parcela vem marcada: depois use "Todos em dia até o mês passado" e desmarque quem estiver devendo. G1 e G2 podem estar com a lista de membros incompleta.', { titulo: 'Cadastrar grupos atuais', botao: 'Cadastrar' }))) return;
    try {
      for (const g of faltam) {
        await store.criar(COL, { codigo: g.codigo, valorParcela: g.valorParcela, parcelas: g.parcelas, inicio: g.inicio, vencimento: 10, vagas: 0,
          premio: g.valorParcela * g.parcelas, obs: '', membros: g.membros.map(([nome, tel]) => ({ id: novoId(), nome, whatsapp: '55' + tel, pagos: {}, entrouEm: g.inicio + '-01' })) });
      }
      toast(faltam.length + ' grupo(s) cadastrado(s).');
      publicarGrupos();
    } catch (e) { toast('Erro ao cadastrar: ' + e.message, 'erro'); }
  }

  return desenhar;
}
