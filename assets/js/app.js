// Ítalo Alves TI — aplicação (roteador, layout, busca global)
import { store } from './store.js';
import { icon } from './icons.js';
import { esc, VERSAO, toast } from './util.js';
import { buscar, osAbertas, aReceber, publicarRastreio, lembretesManutencao } from './negocio.js';
import * as vDashboard from './views/dashboard.js';
import * as vClientes from './views/clientes.js';
import * as vOS from './views/os.js';
import * as vOrc from './views/orcamentos.js';
import * as vNotas from './views/notas.js';
import * as vFin from './views/financeiro.js';
import * as vCat from './views/catalogo.js';
import * as vCfg from './views/config.js';
import * as vLeads from './views/leads.js';
import * as vDiv from './views/divulgacao.js';
import * as vLemb from './views/lembretes.js';

const $ = (s) => document.querySelector(s);
$('#versao').textContent = VERSAO;

/* ---------------- Rotas ---------------- */
const ROTAS = [
  ['/', vDashboard.lista],
  ['/clientes', vClientes.lista], ['/clientes/novo', vClientes.form], ['/clientes/:id', vClientes.form],
  ['/os', vOS.lista], ['/os/nova', vOS.form], ['/os/:id', vOS.form],
  ['/orcamentos', vOrc.lista], ['/orcamentos/novo', vOrc.form], ['/orcamentos/:id', vOrc.form],
  ['/notas', vNotas.lista], ['/notas/:id', vNotas.detalhe],
  ['/financeiro', vFin.lista],
  ['/leads', vLeads.lista],
  ['/divulgacao', vDiv.tela],
  ['/lembretes', vLemb.lista],
  ['/catalogo', vCat.lista],
  ['/config', vCfg.tela],
];

const MENU = [
  ['Visão geral'],
  ['/', 'dashboard', 'Painel'],
  ['Atendimento'],
  ['/leads', 'chat', 'Pedidos do site', () => store.lista('leads').filter((l) => (l.status || 'Novo') === 'Novo').length],
  ['/os', 'os', 'Ordens de serviço', () => osAbertas().length],
  ['/orcamentos', 'orcamento', 'Orçamentos', () => store.lista('orcamentos').filter((o) => o.status === 'Pendente').length],
  ['/notas', 'nota', 'Notas de serviço'],
  ['/clientes', 'users', 'Clientes'],
  ['Gestão'],
  ['/lembretes', 'clock', 'Lembretes de manutenção', () => lembretesManutencao().length],
  ['/financeiro', 'financeiro', 'Financeiro', () => aReceber().length],
  ['/divulgacao', 'globe', 'Divulgação e indicação'],
  ['/catalogo', 'catalogo', 'Produtos e serviços'],
  ['/config', 'config', 'Configurações'],
];

let viewAtual = null; // { live, render }

function casar(caminho) {
  const partes = caminho.split('/').filter(Boolean);
  for (const [padrao, fn] of ROTAS) {
    const p = padrao.split('/').filter(Boolean);
    if (p.length !== partes.length) continue;
    const params = {};
    if (p.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(partes[i])), true) : seg === partes[i]))) {
      return { fn, params };
    }
  }
  return null;
}

function lerHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [caminho, qs] = h.split('?');
  return { caminho, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

function navegar() {
  const { caminho, query } = lerHash();
  const r = casar(caminho) || casar('/');
  const el = $('#view');
  el.innerHTML = '';
  window.scrollTo(0, 0);
  document.body.classList.remove('menu-aberto');
  viewAtual = r.fn(el, r.params, query) || null;
  desenharMenu();
}

export function ir(hash) { location.hash = hash; }
window.ItaloTI = { ir };

function desenharMenu() {
  const atual = '/' + (lerHash().caminho.split('/').filter(Boolean)[0] || '');
  $('#nav').innerHTML = MENU.map(([href, ico, rotulo, contar]) => {
    if (!ico) return `<div class="nav-sec">${esc(href)}</div>`;
    const n = contar ? contar() : 0;
    const ativo = href === atual || (href === '/' && atual === '/');
    return `<a href="#${href}" class="nav-link ${ativo ? 'ativo' : ''}">${icon(ico)}<span>${esc(rotulo)}</span>${n ? `<span class="nav-count">${n}</span>` : ''}</a>`;
  }).join('');
}

/* ---------------- Atualização em tempo real ---------------- */
let agendado = false;
store.on(() => {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(() => {
    agendado = false;
    desenharMenu();
    statusConexao();
    if (viewAtual && viewAtual.live && typeof viewAtual.render === 'function') viewAtual.render();
  });
});

function statusConexao() {
  const s = $('#status-conexao');
  if (store.modo === 'demo') { s.className = 'chip-status demo'; s.textContent = 'modo demo'; return; }
  s.className = 'chip-status' + (store.online ? '' : ' off');
  s.textContent = store.online ? 'sincronizado' : 'offline';
}

/* ---------------- Busca global ---------------- */
function ligarBusca() {
  const inp = $('#busca-global');
  const box = $('#busca-resultados');
  let sel = -1;
  let res = [];
  const desenhar = () => {
    res = buscar(inp.value);
    sel = -1;
    if (!inp.value.trim()) { box.hidden = true; return; }
    box.innerHTML = res.length
      ? res.map((r, i) => `<a class="busca-item" href="${r.href}" data-i="${i}">${icon(r.ico, 16)}<span>${esc(r.titulo)}</span><small>${esc(r.tipo)}</small></a>`).join('')
      : '<div class="busca-item">Nada encontrado.</div>';
    box.hidden = false;
  };
  inp.addEventListener('input', desenhar);
  inp.addEventListener('focus', () => inp.value && desenhar());
  inp.addEventListener('keydown', (e) => {
    const itens = [...box.querySelectorAll('a.busca-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      itens.forEach((a, i) => a.classList.toggle('sel', i === sel));
    } else if (e.key === 'Enter') {
      const alvo = itens[sel >= 0 ? sel : 0];
      if (alvo) { location.hash = alvo.getAttribute('href'); inp.value = ''; box.hidden = true; inp.blur(); }
    } else if (e.key === 'Escape') { inp.value = ''; box.hidden = true; inp.blur(); }
  });
  box.addEventListener('click', () => { inp.value = ''; box.hidden = true; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.busca-global')) box.hidden = true; });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); }
  });
}

/* ---------------- Tema ---------------- */
function desenharTema() {
  const t = document.documentElement.dataset.theme;
  $('#btn-tema').innerHTML = icon(t === 'dark' ? 'sun' : 'moon') + `<span>${t === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>`;
}
$('#btn-tema').addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('ti-tema', t); } catch (e) { /* sem armazenamento */ }
  desenharTema();
});

/* ---------------- Início ---------------- */
$('#btn-sair').innerHTML = icon('logout') + '<span>Sair</span>';
$('.menu-btn').innerHTML = icon('menu', 20);
$('.busca-ico').innerHTML = icon('search', 16);
$('#btn-sair').addEventListener('click', () => store.sair());
$('[data-abrir-menu]').addEventListener('click', () => document.body.classList.add('menu-aberto'));
$('[data-fechar-menu]').addEventListener('click', () => document.body.classList.remove('menu-aberto'));
desenharTema();
ligarBusca();

$('#btn-login').addEventListener('click', async () => {
  $('#login-msg').textContent = '';
  try { await store.entrar(); } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') $('#login-msg').textContent = 'Não foi possível entrar: ' + (e.message || e);
  }
});

// "Acompanhar OS" do site: toda OS gravada (ou orçamento dela) atualiza o status público
store.aposGravar('os', (id) => publicarRastreio(id));
store.aposGravar('orcamentos', (id) => { const o = store.get('orcamentos', id); if (o) publicarRastreio(o.osId); });

let iniciado = false;
$('#view').innerHTML = '<div class="carregando"><div class="spinner"></div>carregando…</div>';
store.iniciar({
  aoEntrar(user) {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#user').innerHTML = (user.foto ? `<img src="${esc(user.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((user.nome || '?')[0].toUpperCase())}</span>`)
      + `<span>${esc(user.nome)}</span>`;
    statusConexao();
    if (!iniciado) { window.addEventListener('hashchange', navegar); iniciado = true; }
    navegar();
  },
  aoSair(motivo) {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#login-msg').textContent = motivo || '';
  },
}).catch((e) => {
  console.error(e);
  $('#login').hidden = false;
  $('#login-msg').textContent = 'Sem conexão com o Firebase. Verifique a internet ou abra com ?demo para testar.';
});

export { toast };
