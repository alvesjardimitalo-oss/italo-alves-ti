// Grava o pedido (lead) do site no Firestore, sem login.
// As regras só permitem CRIAR, com campos e tamanhos controlados (ver firebase/regras-ti.rules).
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
let dbPromise = null;

function conectar() {
  if (!dbPromise) {
    dbPromise = Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore-lite.js')])
      .then(async ([{ initializeApp }, F]) => {
        const app = initializeApp(FIREBASE_CONFIG, 'site-leads');
        await iniciarAppCheck(app);
        return { F, db: F.getFirestore(app) };
      });
  }
  return dbPromise;
}

const corta = (v, n) => String(v ?? '').trim().slice(0, n);

/** Salva o lead. No modo ?demo grava só no navegador. Retorna true/false (nunca lança). */
export async function salvarLead(lead) {
  const dados = {
    nome: corta(lead.nome, 80),
    whatsapp: String(lead.whatsapp || '').replace(/\D/g, '').slice(0, 13),
    cidade: corta(lead.cidade, 80),
    equipamento: corta(lead.equipamento, 40),
    problema: corta(lead.problema, 60),
    detalhe: corta(lead.detalhe, 1500),
    atendimento: corta(lead.atendimento, 40),
    servico: corta(lead.servico, 40),
    origem: corta(lead.origem, 120),
    utm: corta(lead.utm, 120),
    indicacao: corta(lead.indicacao, 60),
    status: 'Novo',
  };
  if (new URLSearchParams(location.search).has('demo')) {
    try {
      const k = 'italoti-demo-v1';
      const db = JSON.parse(localStorage.getItem(k) || '{}');
      db.leads = db.leads || {};
      db.leads['l' + Date.now().toString(36)] = { ...dados, criadoEm: new Date().toISOString() };
      localStorage.setItem(k, JSON.stringify(db));
      return true;
    } catch (e) { return false; }
  }
  try {
    const { F, db } = await conectar();
    await F.addDoc(F.collection(db, 'ti', 'base', 'leads'), { ...dados, criadoEm: F.serverTimestamp() });
    return true;
  } catch (e) {
    console.warn('Lead não gravado:', e);
    return false;
  }
}
