// Página pública "Acompanhar OS": busca o status pelo código + telefone.
import { FIREBASE_CONFIG } from '../config.js';
import { iniciarAppCheck } from '../app-check.js';
import { idRastreio } from '../rastreio-hash.js';
import { esc } from './comum.js';

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
const form = document.getElementById('form-rastreio');
const saida = document.getElementById('resultado-rastreio');
const ETAPAS = ['Recebido', 'Em análise', 'Aguardando aprovação', 'Em manutenção', 'Pronto para retirada', 'Entregue'];
const EXPLICA = {
  'Recebido': 'Seu equipamento chegou e está na fila para análise.',
  'Em análise': 'O técnico está diagnosticando o problema.',
  'Aguardando aprovação': 'O orçamento está pronto e aguarda a sua aprovação.',
  'Em manutenção': 'O serviço foi aprovado e está sendo feito.',
  'Aguardando peça': 'O serviço depende de uma peça que está a caminho.',
  'Pronto para retirada': 'Tudo pronto! Pode combinar a retirada.',
  'Entregue': 'Equipamento entregue. Guarde a nota de serviço: ela traz a garantia.',
  'Sem conserto': 'Infelizmente o reparo não é viável. Fale com o técnico para combinar a devolução.',
};
const dataBR = (iso) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '-');
const money = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

async function buscar(id) {
  if (new URLSearchParams(location.search).has('demo')) {
    const db = JSON.parse(localStorage.getItem('italoti-demo-v1') || '{}');
    return (db.rastreio || {})[id] || null;
  }
  const [{ initializeApp }, F] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore-lite.js')]);
  const app = initializeApp(FIREBASE_CONFIG, 'site-rastreio');
  await iniciarAppCheck(app);
  const db = F.getFirestore(app);
  const s = await F.getDoc(F.doc(db, 'ti', 'base', 'rastreio', id));
  return s.exists() ? s.data() : null;
}

function mostrar(r) {
  const idx = r.status === 'Aguardando peça' ? 3 : ETAPAS.indexOf(r.status);
  const trilha = r.status === 'Sem conserto' ? '' : `<div class="trilha">${ETAPAS.map((e, k) => `<div class="${k <= idx ? 'feito' : ''}">${e}</div>`).join('')}</div>`;
  const o = r.orcamento;
  saida.innerHTML = `<div class="card status-os">
    <span class="kicker">${esc(r.codigo)}</span>
    <h2 style="margin:6px 0 4px">${esc(r.status)}</h2>
    <p style="color:var(--text-2);margin:0">${esc(EXPLICA[r.status] || '')}</p>
    ${trilha}
    <dl class="kv-pub">
      <dt>Equipamento</dt><dd>${esc(r.equipamento)}</dd>
      <dt>Entrada</dt><dd>${dataBR(r.entrada)}</dd>
      ${r.saida ? `<dt>Saída</dt><dd>${dataBR(r.saida)}</dd>` : ''}
      ${o ? `<dt>Orçamento</dt><dd>nº ${esc(o.numero)} · ${esc(o.status)} · ${money(o.total)}</dd>` : ''}
      <dt>Atualizado</dt><dd>${dataBR(r.atualizadoEm)}</dd>
    </dl>
    ${r.recado ? `<div class="callout" style="margin-top:14px"><b>Recado do técnico:</b> ${esc(r.recado)}</div>` : ''}
    <div class="ferr-nav"><span></span><a class="btn btn-pri" href="#fale-comigo" data-falar>Falar com o técnico</a></div></div>`;
  saida.querySelector('[data-falar]').onclick = (e) => { e.preventDefault(); window.FaleComigo?.abrir({ servico: 'Dúvida sobre OS ' + r.codigo }); };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const cod = form.codigo.value;
  const tel = form.telefone.value;
  saida.innerHTML = '<p class="sub">Consultando…</p>';
  try {
    const id = await idRastreio(cod, tel);
    if (!id) { saida.innerHTML = '<div class="callout alerta">Confira o código da OS e o telefone com DDD.</div>'; return; }
    const r = await buscar(id);
    if (!r) { saida.innerHTML = '<div class="callout alerta">Não encontramos uma OS com esse código e telefone. Confira os dados do comprovante de entrada, ou fale comigo.</div>'; return; }
    mostrar(r);
  } catch (err) {
    saida.innerHTML = '<div class="callout alerta">Não foi possível consultar agora. Verifique a internet e tente de novo.</div>';
  }
});
const q = new URLSearchParams(location.search);
if (q.get('os')) form.codigo.value = q.get('os');
