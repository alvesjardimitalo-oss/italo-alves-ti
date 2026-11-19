// Lê os grupos do consórcio publicados pelo painel (ti/base/rastreio/consorcio-grupos).
// Só código, valores e datas — sem nomes nem telefones. Devolve [] se não conseguir ler.
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
export async function carregarGrupos() {
  if (new URLSearchParams(location.search).has('demo')) return [];
  try {
    const [{ initializeApp }, F] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore-lite.js')]);
    const app = initializeApp(FIREBASE_CONFIG, 'karen-consorcio-grupos');
    await iniciarAppCheck(app);
    const snap = await F.getDoc(F.doc(F.getFirestore(app), 'ti', 'base', 'rastreio', 'consorcio-grupos'));
    const grupos = snap.exists() && Array.isArray(snap.data().grupos) ? snap.data().grupos : [];
    return grupos.filter((g) => g && typeof g.codigo === 'string' && /^[A-Z0-9-]{1,10}$/.test(g.codigo));
  } catch (e) {
    console.warn('Grupos do consórcio indisponíveis:', e);
    return [];
  }
}
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const mesLongo = (ym) => { const [a, m] = String(ym || '').split('-').map(Number); return a && m ? MESES[m - 1] + ' ' + a : ''; };
export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
