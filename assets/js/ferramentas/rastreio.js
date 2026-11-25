// Página pública "Acompanhar OS": busca o status pelo código + telefone.
import { FIREBASE_CONFIG } from '../config.js';
import { iniciarAppCheck } from '../app-check.js';
import { idRastreio } from '../rastreio-hash.js';
import { esc } from './comum.js';
import { qrSvg } from '../../vendor/qrcode.js';

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
    ${blocoDocumentos(r)}
    <div class="ferr-nav"><span></span><a class="btn btn-pri" href="#fale-comigo" data-falar>Falar com o técnico</a></div></div>`;
  ligarDocumentos(r);
  saida.querySelector('[data-falar]').onclick = (e) => { e.preventDefault(); window.FaleComigo?.abrir({ servico: 'Dúvida sobre OS ' + r.codigo }); };
}

/* ---------------- Documentos da OS ----------------
   Comprovante de entrada, orçamentos, notas de serviço e recibos, publicados
   pelo sistema junto com o status. Sem nome, CPF, telefone ou endereço. */
const numDoc = (n) => String(n ?? '').padStart(5, '0');
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

function listaDocs(r) {
  const d = r.documentos;
  if (!d) return [];
  const docs = [];
  if (d.entrada) docs.push({ chave: 'entrada', titulo: 'Comprovante de entrada', sub: `${d.entrada.codigo} · ${dataBR(d.entrada.data)}`, ico: '📥' });
  (d.orcamentos || []).forEach((o, i) => docs.push({ chave: 'orc' + i, titulo: `Orçamento nº ${numDoc(o.numero)}`, sub: `${o.status} · ${money(o.total)}${o.saldo > 0.004 && o.status === 'Aprovado' ? ' · saldo ' + money(o.saldo) : ''}`, ico: '🧾', destaque: o.status === 'Aguardando aprovação' || o.status === 'Pendente' }));
  (d.notas || []).forEach((n, i) => docs.push({ chave: 'nota' + i, titulo: `Nota de serviço nº ${numDoc(n.numero)}`, sub: n.cancelada ? 'cancelada' : `${dataBR(n.emitidaEm)} · ${money(n.total)}${n.garantiaAte ? ' · garantia até ' + dataBR(n.garantiaAte) : ''}`, ico: '📄' }));
  (d.recibos || []).forEach((p, i) => docs.push({ chave: 'rec' + i, titulo: `Recibo nº ${numDoc(p.numero)}`, sub: `${dataBR(p.data)} · ${esc(p.forma)} · ${money(p.valor)}`, ico: '✅' }));
  return docs;
}

function blocoDocumentos(r) {
  const docs = listaDocs(r);
  if (!docs.length) return '';
  return `<section class="docs-os">
    <h3>Documentos da sua OS</h3>
    <p class="sub">Veja, imprima ou salve em PDF.</p>
    <div class="docs-lista">${docs.map((x) => `
      <div class="doc-item${x.destaque ? ' doc-destaque' : ''}">
        <span class="doc-ico" aria-hidden="true">${x.ico}</span>
        <div class="doc-txt"><b>${esc(x.titulo)}</b><small>${esc(x.sub)}</small></div>
        <div class="doc-acoes">
          <button type="button" class="btn btn-sm" data-ver="${x.chave}" aria-expanded="false">Ver</button>
          <button type="button" class="btn btn-sm" data-imprimir="${x.chave}">Imprimir / PDF</button>
        </div>
        <div class="doc-corpo" data-corpo="${x.chave}" hidden></div>
      </div>`).join('')}</div></section>`;
}

const tabelaItens = (itens = []) => itens.length ? `<table class="doc-tab"><thead><tr><th>Descrição</th><th class="c">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead>
  <tbody>${itens.map((i) => `<tr><td>${esc(i.descricao)}${i.tipo ? `<small>${esc(i.tipo)}</small>` : ''}</td><td class="c">${i.qtd}</td><td class="r">${money(i.valor)}</td><td class="r">${money(i.qtd * i.valor)}</td></tr>`).join('')}</tbody></table>` : '';
const totais = (linhas) => `<div class="doc-totais">${linhas.filter(Boolean).map(([k, v, cls]) => `<div class="${cls || ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`;
const kv = (linhas) => `<dl class="doc-kv">${linhas.filter(Boolean).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v || '-')}</dd>`).join('')}</dl>`;
const caixa = (titulo, t) => (t ? `<h4>${esc(titulo)}</h4><div class="doc-caixa">${esc(t)}</div>` : '');
function blocoPix(payload, valor) {
  if (!payload) return '';
  return `<div class="doc-pix"><div class="doc-qr">${qrSvg(payload, { tamanho: 150 })}</div>
    <div><b>Pague com PIX · ${money(valor)}</b><p>Leia o QR Code no app do banco ou use o "copia e cola":</p>
    <code class="doc-copia">${esc(payload)}</code><button type="button" class="btn btn-sm" data-copiar="${esc(payload)}">Copiar código PIX</button></div></div>`;
}

function htmlDocumento(r, chave) {
  const d = r.documentos || {};
  const e = d.empresa || {};
  const cab = (titulo, numero, data) => `<header class="doc-cab"><div><div class="doc-emp">${esc(e.nome || 'Ítalo InfoTec')}</div>
    <small>${esc([e.endereco, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · '))}</small>
    <small>${esc([e.telefone, e.email].filter(Boolean).join(' · '))}${e.documento ? ' · CNPJ/CPF ' + esc(e.documento) : ''}</small></div>
    <div class="doc-num"><b>${esc(titulo)}</b><span>${esc(numero)}</span><small>${esc(data || '')}</small></div></header>`;
  if (chave === 'entrada') {
    const x = d.entrada;
    return cab('Comprovante de entrada', x.codigo, 'Entrada em ' + dataBR(x.data))
      + kv([['Equipamento', x.equipamento], x.serie && ['Nº de série', x.serie], x.acessorios && ['Acessórios', x.acessorios], ['Situação atual', r.status]])
      + caixa('Defeito relatado', x.defeito);
  }
  if (chave.startsWith('orc')) {
    const o = d.orcamentos[+chave.slice(3)];
    return cab('Orçamento', 'Nº ' + numDoc(o.numero), 'Emitido em ' + dataBR(o.data))
      + kv([['OS', r.codigo], ['Equipamento', r.equipamento], ['Situação', o.status], o.validade && ['Válido até', dataBR(o.validade)]])
      + caixa('Diagnóstico', o.diagnostico)
      + tabelaItens(o.itens)
      + totais([o.desconto > 0 && ['Subtotal', money(o.subtotal)], o.desconto > 0 && ['Desconto', '- ' + money(o.desconto)], ['TOTAL', money(o.total), 'tot'],
        o.pago > 0 && ['Já pago', money(o.pago)], o.pago > 0 && ['Saldo', o.saldo > 0.004 ? money(o.saldo) : 'QUITADO', 'forte']])
      + caixa('Observações', o.obs)
      + blocoPix(o.pix, o.saldo);
  }
  if (chave.startsWith('nota')) {
    const n = d.notas[+chave.slice(4)];
    return cab('Nota de serviço', 'Nº ' + numDoc(n.numero), 'Emitida em ' + dataHora(n.emitidaEm))
      + (n.cancelada ? `<div class="doc-cancelada">NOTA CANCELADA${n.motivoCancelamento ? ' — ' + esc(n.motivoCancelamento) : ''}</div>` : '')
      + '<div class="doc-aviso">Documento sem valor fiscal</div>'
      + kv([['OS', r.codigo], ['Equipamento', r.equipamento], n.orcamentoNumero && ['Orçamento', 'Nº ' + numDoc(n.orcamentoNumero)], n.conclusao && ['Conclusão', dataBR(n.conclusao)]])
      + caixa('Serviço executado', n.servico)
      + tabelaItens(n.itens)
      + totais([n.desconto > 0 && ['Subtotal', money(n.subtotal)], n.desconto > 0 && ['Desconto', '- ' + money(n.desconto)], ['TOTAL', money(n.total), 'tot'],
        ...(n.pagamentos || []).map((p) => [`${dataBR(p.data)} · ${p.forma}`, money(p.valor)]),
        ['Pago', money(n.pago), 'forte'], n.saldo > 0.004 && ['Saldo a pagar', money(n.saldo), 'forte']])
      + `<h4>Garantia</h4><p class="doc-just">${n.garantiaDias ? `Garantia de <b>${n.garantiaDias} dias</b> para os serviços executados, válida até <b>${dataBR(n.garantiaAte)}</b>, mediante apresentação desta nota. Não cobre mau uso, quedas, líquidos, surtos elétricos ou violação por terceiros.` : 'Serviço sem garantia.'}</p>`
      + blocoPix(n.pix, n.saldo);
  }
  if (chave.startsWith('rec')) {
    const p = d.recibos[+chave.slice(3)];
    return cab('Recibo', 'Nº ' + numDoc(p.numero), 'Pago em ' + dataBR(p.data))
      + `<div class="doc-valor">${money(p.valor)}</div>`
      + `<p class="doc-just">Recebemos a importância de <b>${money(p.valor)}</b>, via <b>${esc(p.forma)}</b>, referente ao orçamento nº ${numDoc(p.orcamentoNumero)} (${esc(r.codigo)} · ${esc(r.equipamento)}).</p>`
      + `<p class="doc-just"><small>${esc(e.cidade || '')}, ${dataBR(p.data)}.</small></p>`;
  }
  return '';
}

const CSS_IMPRESSAO = `body{font:13px/1.45 Inter,Arial,sans-serif;color:#111;margin:0;padding:24px}
.doc-cab{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
.doc-cab small{display:block;color:#444}.doc-emp{font-size:18px;font-weight:800}
.doc-num{text-align:right}.doc-num b{display:block;font-size:16px;text-transform:uppercase}.doc-num span{display:block;font-size:15px;font-weight:700}
.doc-kv{display:grid;grid-template-columns:140px 1fr;gap:4px 10px;margin:10px 0}.doc-kv dt{color:#555}.doc-kv dd{margin:0;font-weight:600}
h4{margin:14px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#333}
.doc-caixa{border:1px solid #ccc;border-radius:6px;padding:8px 10px;white-space:pre-wrap}
.doc-tab{width:100%;border-collapse:collapse;margin:12px 0}.doc-tab th,.doc-tab td{border-bottom:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}
.doc-tab small{display:block;color:#666}.doc-tab .c{text-align:center}.doc-tab .r{text-align:right;white-space:nowrap}
.doc-totais{margin-left:auto;max-width:320px}.doc-totais div{display:flex;justify-content:space-between;padding:3px 0}.doc-totais .tot{font-size:16px;font-weight:800;border-top:2px solid #111;margin-top:4px;padding-top:6px}.doc-totais .forte{font-weight:700}
.doc-pix{display:flex;gap:14px;align-items:center;border:1px solid #ccc;border-radius:8px;padding:10px;margin-top:14px}.doc-pix button{display:none}
.doc-copia{display:block;word-break:break-all;font-size:10px;color:#333;margin-top:4px}
.doc-aviso{text-align:center;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#555;margin-bottom:6px}
.doc-cancelada{text-align:center;font-weight:800;color:#b00;border:2px solid #b00;padding:6px;margin-bottom:8px}
.doc-valor{font-size:26px;font-weight:800;text-align:center;margin:14px 0}.doc-just{text-align:justify}
@page{size:A4;margin:12mm}`;

function imprimir(r, chave) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita as janelas (pop-ups) deste site para imprimir.'); return; }
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.codigo)} · documento</title><style>${CSS_IMPRESSAO}</style></head><body>${htmlDocumento(r, chave)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function ligarDocumentos(r) {
  saida.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const corpo = saida.querySelector(`[data-corpo="${b.dataset.ver}"]`);
    const abrir = corpo.hidden;
    if (abrir && !corpo.innerHTML) corpo.innerHTML = htmlDocumento(r, b.dataset.ver);
    corpo.hidden = !abrir;
    b.textContent = abrir ? 'Fechar' : 'Ver';
    b.setAttribute('aria-expanded', String(abrir));
  }));
  saida.querySelectorAll('[data-imprimir]').forEach((b) => b.addEventListener('click', () => imprimir(r, b.dataset.imprimir)));
  saida.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-copiar]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = 'Código copiado!'; } catch { b.textContent = 'Selecione e copie o código acima'; }
  });
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
