// Métricas próprias, sem dados pessoais. Coleta somente após consentimento.
// Não registra IP, identificador de usuário, telefone, texto digitado ou URLs com parâmetros.
// O navegador limita repetições na sessão; regras do Firestore validam o formato no servidor.
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
const CONSENT = 'italoti-metricas-consentimento-v1';
const SESSAO = 'italoti-metricas-sessao-v1';
const DEMO = new URLSearchParams(location.search).has('demo');
const TIPOS = new Set(['visita','chat_aberto','sintoma_selecionado','ferramenta_iniciada','ferramenta_concluida','whatsapp_aberto']);
const FERRAMENTAS = new Set(['checkup','upgrade','consertar-ou-trocar','monte-seu-pc','velocidade','testes']);
let dbPromise;

export function tipoPagina(path = location.pathname) {
  if (/(^|\/)ferramentas\//.test(path)) return 'ferramentas';
  if (/(^|\/)dicas\//.test(path)) return 'dicas';
  if (/(^|\/)atendimento\//.test(path)) return 'atendimento';
  if (/acompanhar\.html$/.test(path)) return 'acompanhar';
  if (/^\/$|\/index\.html$/.test(path)) return 'inicio';
  return 'institucional';
}

export function ferramentaAtual(path = location.pathname) {
  const match = path.match(/\/ferramentas\/([a-z0-9-]+)\.html$/);
  return match && FERRAMENTAS.has(match[1]) ? match[1] : '';
}

export function classificarCanal(search = location.search, referrer = document.referrer) {
  const q = new URLSearchParams(search);
  const utm = String(q.get('utm_source') || '').toLowerCase().slice(0, 40);
  const host = (() => { try { return new URL(referrer).hostname.toLowerCase(); } catch (_) { return ''; } })();
  const rotulo = utm || host;
  if (/instagram|ig\.|tiktok|facebook|fb\.|threads|youtube/.test(rotulo)) return 'social';
  if (/whatsapp|wa\.me|wpp/.test(rotulo)) return 'whatsapp';
  if (/google|bing|duckduckgo|yahoo|search/.test(rotulo)) return 'busca';
  if (/email|newsletter/.test(rotulo)) return 'email';
  if (utm || (host && !host.endsWith('italoinfotec.com.br'))) return 'referencia';
  return 'direto';
}

export function eventoSeguro(tipo, categoria = '', pagina = tipoPagina(), canal = classificarCanal()) {
  if (!TIPOS.has(tipo)) return null;
  const chave = String(categoria || '').toLowerCase();
  if (!/^[a-z0-9-]{0,36}$/.test(chave)) return null;
  if (!['inicio','ferramentas','dicas','atendimento','acompanhar','institucional'].includes(pagina)) return null;
  if (!['social','whatsapp','busca','email','referencia','direto'].includes(canal)) return null;
  return { tipo, categoria: chave, pagina, canal };
}

function podeColetar() {
  if (DEMO) return true;
  try { return localStorage.getItem(CONSENT) === 'sim'; } catch (_) { return false; }
}

function lembrarSessao(chave) {
  try {
    const anterior = JSON.parse(sessionStorage.getItem(SESSAO) || '[]');
    if (anterior.includes(chave)) return false;
    anterior.push(chave);
    sessionStorage.setItem(SESSAO, JSON.stringify(anterior.slice(-80)));
  } catch (_) { /* modo sem armazenamento: pode registrar repetição eventual */ }
  return true;
}

function registrarDemo(dados) {
  try {
    const chave = 'italoti-demo-v1';
    const db = JSON.parse(localStorage.getItem(chave) || '{}');
    db.metricasSite ||= {};
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    db.metricasSite[id] = { ...dados, criadoEm: new Date().toISOString() };
    localStorage.setItem(chave, JSON.stringify(db));
    return true;
  } catch (_) { return false; }
}

async function conectar() {
  if (!dbPromise) dbPromise = Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-firestore-lite.js'),
  ]).then(async ([{ initializeApp }, F]) => {
    const app = initializeApp(FIREBASE_CONFIG, 'site-metricas');
    await iniciarAppCheck(app);
    return { F, db: F.getFirestore(app) };
  }).catch((erro) => { dbPromise = null; throw erro; });
  return dbPromise;
}

/** Uma ocorrência por tipo/categoria e sessão de navegador; sem dados identificáveis. */
export async function registrarEvento(tipo, categoria = '') {
  if (!podeColetar()) return false;
  const evento = eventoSeguro(tipo, categoria);
  if (!evento) return false;
  const chave = tipo + ':' + categoria;
  if (!lembrarSessao(chave)) return false;
  if (DEMO) return registrarDemo(evento);
  try {
    const { F, db } = await conectar();
    await F.addDoc(F.collection(db, 'ti','base','metricasSite'), {
      ...evento,
      criadoEm: F.serverTimestamp(),
    });
    return true;
  } catch (erro) {
    // Nunca interromper orçamento, navegação ou consulta de OS por falha de métricas.
    console.warn('Métricas não registradas (confira regras do Firestore):', erro?.code || erro);
    return false;
  }
}

export function iniciarMetricas(raiz = './') {
  if (DEMO) {
    registrarEvento('visita');
  } else {
    const aviso = document.createElement('aside');
    aviso.className = 'metricas-aviso';
    aviso.id = 'metricas-aviso';
    aviso.setAttribute('aria-label', 'Preferências de métricas');
    aviso.innerHTML = `<div><b>Podemos melhorar nosso atendimento?</b><p>Com sua permissão, contamos visitas e uso do Alvesinho e das ferramentas, sem registrar nome, telefone ou o que você digita. <a href="${raiz}politica-de-privacidade.html">Saiba mais</a>.</p></div><div class="metricas-acoes"><button type="button" class="btn btn-pri btn-sm" data-metrica="sim">Permitir</button><button type="button" class="btn btn-sm" data-metrica="nao">Não permitir</button></div>`;
    document.body.append(aviso);
    function mostrarSeNecessario() {
      let escolha = null;
      try { escolha = localStorage.getItem(CONSENT); } catch (_) {}
      aviso.hidden = escolha === 'sim' || escolha === 'nao';
      if (escolha === 'sim') registrarEvento('visita');
    }
    aviso.querySelectorAll('[data-metrica]').forEach((botao) => botao.addEventListener('click', () => {
      try { localStorage.setItem(CONSENT, botao.dataset.metrica); } catch (_) {}
      aviso.hidden = true;
      if (botao.dataset.metrica === 'sim') {
        registrarEvento('visita');
        if (ferramentaAtual()) registrarEvento('ferramenta_iniciada', ferramentaAtual());
      }
    }));
    const rodape = document.querySelector('footer .rodape-base') || document.querySelector('footer');
    if (rodape) {
      const preferencia = document.createElement('button');
      preferencia.className = 'metricas-preferencias';
      preferencia.textContent = 'Preferências de métricas';
      preferencia.type = 'button';
      preferencia.onclick = () => { aviso.hidden = false; };
      rodape.append(preferencia);
    }
    mostrarSeNecessario();
  }
  if (ferramentaAtual()) registrarEvento('ferramenta_iniciada', ferramentaAtual());
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href*="wa.me/"]');
    if (link) registrarEvento('whatsapp_aberto');
  });
}

export const MetricasSite = { registrar: registrarEvento };
