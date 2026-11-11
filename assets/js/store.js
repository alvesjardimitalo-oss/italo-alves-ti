// Camada de dados. Dois "motores":
//  - firebase: Firestore do projeto high-os (dados em ti/base/...), login Google
//  - demo: localStorage do navegador (abre com ?demo na URL) — para testar sem mexer nos dados reais
import { FIREBASE_CONFIG, EMAILS_AUTORIZADOS } from './config.js';
import { iniciarAppCheck } from './app-check.js';

export const COLECOES = ['clientes', 'catalogo', 'os', 'orcamentos', 'pagamentos', 'notas', 'leads', 'metricasSite', 'sacolas', 'produtos'];
const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';

const estado = {
  dados: Object.fromEntries(COLECOES.map((c) => [c, new Map()])),
  config: {},
  contadores: {},
  usuario: null,
  modo: null,
  online: navigator.onLine,
};
const ouvintes = new Set();
const gatilhos = {};
function disparar(col, id) { (gatilhos[col] || []).forEach((fn) => Promise.resolve().then(() => fn(id)).catch((e) => console.warn('gatilho', col, e))); }
let motor = null;
let prontoResolver;
const pronto = new Promise((r) => (prontoResolver = r));

export const store = {
  get modo() { return estado.modo; },
  get usuario() { return estado.usuario; },
  get config() { return estado.config; },
  get contadores() { return estado.contadores || {}; },
  get online() { return estado.online; },
  pronto,

  /** Inicia o motor. Chama aoEntrar(usuario) / aoSair(motivo). */
  async iniciar({ aoEntrar, aoSair }) {
    const demo = new URLSearchParams(location.search).has('demo');
    estado.modo = demo ? 'demo' : 'firebase';
    motor = demo ? motorDemo() : await motorFirebase();
    motor.observarLogin(async (user) => {
      if (!user) { estado.usuario = null; aoSair(); return; }
      estado.usuario = user;
      try {
        await motor.assinar();
        aoEntrar(user);
      } catch (e) {
        console.error(e);
        aoSair(e.code === 'permission-denied' ? 'Este e-mail não tem permissão para acessar o sistema.' : 'Erro ao carregar os dados: ' + (e.message || e));
        motor.sair();
      }
    });
  },
  entrar: () => motor.entrar(),
  sair: () => motor.sair(),

  on(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },

  lista(col) { return [...estado.dados[col].values()]; },
  get(col, id) { return id ? estado.dados[col].get(id) || null : null; },

  /** Cria documento. Se `contador` for informado, grava `numero` sequencial (atômico). */
  async criar(col, dados, contador, extra) {
    const base = { ...limpar(dados), criadoEm: new Date().toISOString(), criadoPor: estado.usuario?.email || '' };
    const r = await motor.criar(col, base, contador, extra);
    disparar(col, r.id);
    return r;
  },
  async atualizar(col, id, dados, { semGatilho = false } = {}) {
    const r = await motor.atualizar(col, id, { ...limpar(dados), atualizadoEm: new Date().toISOString(), atualizadoPor: estado.usuario?.email || '' });
    if (!semGatilho) disparar(col, id);
    return r;
  },
  /**
   * Lê documentos e grava alterações numa única transação (tudo ou nada).
   * leituras = [{col, id}]; calcular(docs) recebe os documentos atuais (ou null)
   * e devolve [{col, id, dados}]. Lançar erro em calcular() cancela tudo.
   */
  async transacao(leituras, calcular) {
    const carimbo = { atualizadoEm: new Date().toISOString(), atualizadoPor: estado.usuario?.email || '' };
    const preparar = (docs) => (calcular(docs) || []).map((a) => ({ ...a, dados: { ...limpar(a.dados), ...carimbo } }));
    const feitas = await motor.transacao(leituras, preparar);
    feitas.forEach((a) => disparar(a.col, a.id));
    return feitas;
  },
  /** Grava um documento com ID definido (fora das coleções carregadas, ex.: rastreio público). */
  async definir(col, id, dados) { return motor.definir(col, id, limpar(dados)); },
  /** Lê uma coleção que não fica carregada em tempo real (ex.: vagas da Black Friday). */
  async buscar(col) { return motor.buscar(col); },
  async apagarDoc(col, id) { return motor.remover(col, id); },
  /** Executa fn(id) depois de criar/atualizar documentos da coleção. */
  aposGravar(col, fn) { (gatilhos[col] = gatilhos[col] || []).push(fn); },
  async remover(col, id) { return motor.remover(col, id); },
  async salvarConfig(dados) { return motor.salvarConfig(limpar(dados)); },
  /** Importação em lote (migração do sistema antigo). itens = [{col, id, dados}] */
  async importar(itens, contadores) { return motor.importar(itens, contadores); },
  exportar() {
    const out = { versao: 1, exportadoEm: new Date().toISOString(), config: estado.config, contadores: estado.contadores };
    COLECOES.forEach((c) => { out[c] = store.lista(c); });
    return out;
  },
};

function limpar(o) {
  const r = {};
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && k !== 'id') r[k] = v; });
  return r;
}
/** Converte Timestamp do Firestore em texto ISO (o resto do sistema trabalha com ISO). */
function normalizar(o) {
  const r = {};
  Object.entries(o).forEach(([k, v]) => { r[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v; });
  return r;
}
function avisar() { ouvintes.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

window.addEventListener('online', () => { estado.online = true; avisar(); });
window.addEventListener('offline', () => { estado.online = false; avisar(); });

/* =================================================================
 * Motor Firebase
 * ================================================================= */
async function motorFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'),
    import(FB + 'firebase-auth.js'),
    import(FB + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(FIREBASE_CONFIG, 'italo-alves-ti');
  await iniciarAppCheck(app);
  const auth = A.getAuth(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch (e) {
    db = F.getFirestore(app);
  }
  const base = F.doc(db, 'ti', 'base');
  const colRef = (c) => F.collection(base, c);
  const cfgRef = F.doc(base, 'meta', 'config');
  const cntRef = F.doc(base, 'meta', 'contadores');
  let cancelar = [];

  return {
    observarLogin(cb) {
      A.onAuthStateChanged(auth, (u) => {
        if (!u) return cb(null);
        const email = (u.email || '').toLowerCase();
        if (EMAILS_AUTORIZADOS.length && !EMAILS_AUTORIZADOS.includes(email)) {
          A.signOut(auth);
          return cb(null);
        }
        cb({ email, nome: u.displayName || email, foto: u.photoURL || '' });
      });
    },
    entrar: () => A.signInWithPopup(auth, provider),
    sair: () => { cancelar.forEach((f) => f()); cancelar = []; return A.signOut(auth); },

    assinar() {
      cancelar.forEach((f) => f());
      cancelar = [];
      const alvos = [...COLECOES, '__config', '__contadores'];
      let faltam = alvos.length;
      return new Promise((resolve, reject) => {
        const primeiro = () => { if (--faltam === 0) { prontoResolver(); resolve(); } };
        alvos.forEach((alvo) => {
          let jaVeio = false;
          const ok = (fn) => (snap) => { fn(snap); if (!jaVeio) { jaVeio = true; primeiro(); } else avisar(); };
          const erro = (e) => { if (!jaVeio) reject(e); else console.error(e); };
          if (alvo === '__config') {
            cancelar.push(F.onSnapshot(cfgRef, ok((s) => { estado.config = s.exists() ? s.data() : {}; }), erro));
          } else if (alvo === '__contadores') {
            cancelar.push(F.onSnapshot(cntRef, ok((s) => { estado.contadores = s.exists() ? s.data() : {}; }), erro));
          } else {
            cancelar.push(F.onSnapshot(colRef(alvo), ok((snap) => {
              const m = estado.dados[alvo];
              snap.docChanges().forEach((ch) => {
                if (ch.type === 'removed') m.delete(ch.doc.id);
                else m.set(ch.doc.id, { id: ch.doc.id, ...normalizar(ch.doc.data()) });
              });
            }), erro));
          }
        });
      });
    },

    async criar(col, dados, contador, extra) {
      const ref = F.doc(colRef(col));
      if (!contador) {
        await F.setDoc(ref, dados);
        return { id: ref.id, ...dados };
      }
      let numero;
      await F.runTransaction(db, async (tx) => {
        const s = await tx.get(cntRef);
        numero = ((s.exists() && s.data()[contador]) || 0) + 1;
        tx.set(cntRef, { [contador]: numero }, { merge: true });
        tx.set(ref, { ...dados, numero, ...(extra ? extra(numero) : {}) });
      });
      return { id: ref.id, ...dados, numero, ...(extra ? extra(numero) : {}) };
    },
    atualizar: (col, id, dados) => F.updateDoc(F.doc(colRef(col), id), dados),
    async transacao(leituras, preparar) {
      let feitas = [];
      await F.runTransaction(db, async (tx) => {
        const snaps = await Promise.all(leituras.map(({ col, id }) => tx.get(F.doc(colRef(col), id))));
        const docs = snaps.map((sn) => (sn.exists() ? { id: sn.id, ...normalizar(sn.data()) } : null));
        feitas = preparar(docs);
        feitas.forEach(({ col, id, dados }) => tx.update(F.doc(colRef(col), id), dados));
      });
      return feitas;
    },
    remover: (col, id) => F.deleteDoc(F.doc(colRef(col), id)),
    definir: (col, id, dados) => F.setDoc(F.doc(colRef(col), id), dados),
    async buscar(col) { const snap = await F.getDocs(colRef(col)); return snap.docs.map((d) => ({ id: d.id, ...normalizar(d.data()) })); },
    salvarConfig: (dados) => F.setDoc(cfgRef, dados, { merge: true }),
    async importar(itens, contadores) {
      for (let i = 0; i < itens.length; i += 400) {
        const lote = F.writeBatch(db);
        itens.slice(i, i + 400).forEach(({ col, id, dados }) => lote.set(F.doc(colRef(col), id), dados));
        await lote.commit();
      }
      if (contadores) await F.setDoc(cntRef, contadores, { merge: true });
    },
  };
}

/* =================================================================
 * Motor demo (localStorage)
 * ================================================================= */
function motorDemo() {
  const CHAVE = 'italoti-demo-v1';
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } };
  const db = Object.assign({ config: {}, contadores: {} }, ler());
  COLECOES.forEach((c) => { db[c] = db[c] || {}; });
  const gravar = () => localStorage.setItem(CHAVE, JSON.stringify(db));
  const carregar = () => {
    COLECOES.forEach((c) => {
      estado.dados[c] = new Map(Object.entries(db[c]).map(([id, d]) => [id, { id, ...d }]));
    });
    estado.config = db.config;
    estado.contadores = db.contadores;
  };
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  let logado = localStorage.getItem('italoti-demo-login') === '1';
  let cb = () => {};
  const mudou = () => { gravar(); carregar(); setTimeout(avisar, 0); };

  return {
    observarLogin(f) { cb = f; f(logado ? { email: 'demo@italoalves.ti', nome: 'Modo demonstração', foto: '' } : null); },
    entrar() { logado = true; localStorage.setItem('italoti-demo-login', '1'); cb({ email: 'demo@italoalves.ti', nome: 'Modo demonstração', foto: '' }); },
    sair() { logado = false; localStorage.removeItem('italoti-demo-login'); cb(null); },
    async assinar() { carregar(); prontoResolver(); },
    async criar(col, dados, contador, extra) {
      const novo = { ...dados };
      if (contador) { db.contadores[contador] = (db.contadores[contador] || 0) + 1; novo.numero = db.contadores[contador]; Object.assign(novo, extra ? extra(novo.numero) : {}); }
      const k = id();
      db[col][k] = novo;
      mudou();
      return { id: k, ...novo };
    },
    async atualizar(col, k, dados) { db[col][k] = { ...db[col][k], ...dados }; mudou(); },
    async transacao(leituras, preparar) {
      const docs = leituras.map(({ col, id: k }) => (db[col] && db[col][k] ? { id: k, ...db[col][k] } : null));
      const feitas = preparar(docs);
      feitas.forEach(({ col, id: k, dados }) => { db[col][k] = { ...db[col][k], ...dados }; });
      mudou();
      return feitas;
    },
    async remover(col, k) { if (db[col]) delete db[col][k]; mudou(); },
    async definir(col, k, dados) { db[col] = db[col] || {}; db[col][k] = dados; if (COLECOES.includes(col)) mudou(); else gravar(); },
    async buscar(col) { return Object.entries(db[col] || {}).map(([id, v]) => ({ id, ...v })); },
    async salvarConfig(dados) { db.config = { ...db.config, ...dados }; mudou(); },
    async importar(itens, contadores) {
      itens.forEach(({ col, id: k, dados }) => { db[col][k] = dados; });
      if (contadores) db.contadores = { ...db.contadores, ...contadores };
      mudou();
    },
  };
}
