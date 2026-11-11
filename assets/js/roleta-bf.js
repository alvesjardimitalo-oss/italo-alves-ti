// Roleta de descontos da Black Friday — Karen Cosméticos.
// Cada pessoa gira uma vez e ganha um cupom de 1% a 10%. O cupom é salvo
// como solicitação (coleção de leads) para a Karen conferir no painel.
import { FIREBASE_CONFIG } from './config.js';
import { iniciarAppCheck } from './app-check.js';
import { salvarLead } from './leads.js';
import { PERFUMES } from './perfumes-bf.js';
import { criarCarrinho } from './carrinho-bf.js';

// ---------------- Configuração da campanha ----------------
// Chance de cada desconto (soma 100). Descontos maiores são mais raros.
const CHANCES = { 1: 18, 2: 17, 3: 15, 4: 13, 5: 11, 6: 9, 7: 7, 8: 5, 9: 3, 10: 2 };
const FIM = new Date('2026-11-30T23:59:59-03:00'); // último dia para girar e usar o cupom
const VALIDADE_TEXTO = '30/11/2026';
// Ordem das fatias na roda (intercaladas para os maiores não ficarem juntos).
const FATIAS = [1, 6, 3, 8, 2, 10, 4, 7, 5, 9];
const CORES = ['#3a1a2c', '#7a3a5c', '#5a2843', '#c99a5b', '#3a1a2c', '#a74971', '#5a2843', '#7a3a5c', '#3a1a2c', '#c99a5b'];
const CHAVE = 'karen-bf-cupom-2026';

const DESCONTO_MAXIMO = 10;
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const comDesconto = (cheio, pct) => Math.round(cheio * (100 - Math.min(pct, DESCONTO_MAXIMO))) / 100;

const FB = 'https://www.gstatic.com/firebasejs/12.2.1/';
const $ = (s) => document.querySelector(s);
const roda = $('#roda');
const form = $('#form-roleta');
const botao = $('#girar');
const retorno = $('#retorno');
const premio = $('#premio');
const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let telefoneKaren = '';
let publico = { pix: null, estoque: {} }; // dados publicados pela Karen no painel
let carrinho = null;
let girando = false;
let pendente = null;
const params = new URLSearchParams(location.search);
const amiga = /^BF-[A-Z0-9]{5}$/.test(params.get('amiga') || '') ? params.get('amiga') : '';
const tokenGiro = /^[a-z0-9]{10,20}$/.test(params.get('giro') || '') ? params.get('giro') : '';
let giroExtraOk = false;      // link de giro extra conferido no banco
let fbDb = null, fbF = null;
const chaveCupom = () => tokenGiro ? CHAVE + '-giro-' + tokenGiro : CHAVE; // cupom sorteado que ainda não foi registrado (não sorteia de novo)

const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => { const d = digits(v); return (d.length === 10 || d.length === 11) ? '55' + d : d; };
const validoBR = (v) => /^55\d{10,11}$/.test(v);

// ---------------- Desenho da roda (SVG) ----------------
function desenharRoda() {
  const n = FATIAS.length, r = 160, c = 170, passo = 360 / n;
  const ponto = (ang, raio) => {
    const a = (ang - 90) * Math.PI / 180;
    return [c + raio * Math.cos(a), c + raio * Math.sin(a)];
  };
  let svg = '<svg viewBox="0 0 340 340" aria-hidden="true"><defs>' +
    '<radialGradient id="brilho-roda" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<g class="roda-giro">';
  FATIAS.forEach((pct, i) => {
    const a0 = i * passo, a1 = (i + 1) * passo;
    const [x0, y0] = ponto(a0, r), [x1, y1] = ponto(a1, r);
    svg += `<path d="M${c},${c} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z" fill="${CORES[i]}" stroke="#e9c58f" stroke-opacity=".55" stroke-width="1.5"/>`;
    const [tx, ty] = ponto(a0 + passo / 2, r * 0.7);
    const dourada = CORES[i] === '#c99a5b';
    svg += `<text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" transform="rotate(${(a0 + passo / 2).toFixed(1)} ${tx.toFixed(2)} ${ty.toFixed(2)})" ` +
      `text-anchor="middle" dominant-baseline="middle" class="roda-txt${dourada ? ' escuro' : ''}">${pct}%</text>`;
  });
  // pinos dourados na borda
  for (let i = 0; i < n; i++) {
    const [px, py] = ponto(i * passo, r + 1);
    svg += `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="4.2" class="roda-pino"/>`;
  }
  svg += `<circle cx="${c}" cy="${c}" r="${r}" fill="url(#brilho-roda)"/></g>` +
    `<circle cx="${c}" cy="${c}" r="${r + 7}" fill="none" stroke="#e9c58f" stroke-width="6"/>` +
    `<circle cx="${c}" cy="${c}" r="34" fill="#2a1220" stroke="#e9c58f" stroke-width="3"/>` +
    `<text x="${c}" y="${c + 1}" text-anchor="middle" dominant-baseline="middle" class="roda-centro">KC</text></svg>`;
  roda.innerHTML = svg + '<span class="roda-ponteiro" aria-hidden="true"></span>';
}

// ---------------- Sorteio ----------------
function sortear() {
  const total = Object.values(CHANCES).reduce((a, b) => a + b, 0);
  const n = new Uint32Array(1); crypto.getRandomValues(n);
  let x = (n[0] / 2 ** 32) * total;
  for (const [pct, peso] of Object.entries(CHANCES)) { if ((x -= peso) < 0) return Number(pct); }
  return 1;
}
function gerarCodigo() {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const n = new Uint32Array(5); crypto.getRandomValues(n);
  return 'BF-' + [...n].map((v) => letras[v % letras.length]).join('');
}

let anguloAtual = 0;
function girarAte(pct) {
  return new Promise((ok) => {
    const giro = roda.querySelector('.roda-giro');
    const passo = 360 / FATIAS.length;
    const indices = FATIAS.map((p, i) => (p === pct ? i : -1)).filter((i) => i >= 0);
    const i = indices[0];
    const folga = (Math.random() - 0.5) * passo * 0.6;
    const alvo = 360 - (i * passo + passo / 2) + folga; // fatia sob o ponteiro (topo)
    const voltas = calmo ? 0 : 360 * 6;
    anguloAtual = anguloAtual - (anguloAtual % 360) + voltas + alvo;
    giro.style.transition = calmo ? 'none' : 'transform 5.4s cubic-bezier(.12,.66,.1,1)';
    giro.style.transform = `rotate(${anguloAtual}deg)`;
    roda.classList.add('girando');
    setTimeout(() => { roda.classList.remove('girando'); ok(); }, calmo ? 50 : 5500);
  });
}

// ---------------- Cupom ----------------
function mostrarPremio(c, repetido) {
  cupomAtual = c;
  prepararIndicacao(c);
  atualizarCombo();
  desenharPerfumes();
  premio.hidden = false;
  premio.querySelector('.premio-pct').textContent = c.pct + '%';
  premio.querySelector('.premio-codigo').textContent = c.codigo;
  premio.querySelector('.premio-titulo').textContent = repetido ? (tokenGiro ? 'Você já usou este giro extra' : 'Este é o seu cupom') : (c.nome.split(' ')[0] + ', você ganhou!');
  premio.querySelector('.premio-aviso').textContent = repetido
    ? 'A roleta é uma vez por pessoa, e você já girou neste aparelho.'
    : (tokenGiro ? 'Este é o seu giro extra por indicar uma amiga. ' : '') + 'O cupom entra sozinho no carrinho deste celular. Um cupom por compra.';
  const wa = premio.querySelector('#usar-cupom');
  wa.href = '#perfumes-bf'; wa.removeAttribute('target'); wa.textContent = 'Escolher meus perfumes'; wa.hidden = false;
  form.hidden = true;
  premio.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'center' });
}
$('#copiar-cupom')?.addEventListener('click', async (e) => {
  const codigo = premio.querySelector('.premio-codigo').textContent;
  try { await navigator.clipboard.writeText(codigo); e.currentTarget.textContent = 'Código copiado ✓'; }
  catch (_) { e.currentTarget.textContent = codigo; }
});

function confete() {
  if (calmo) return;
  const cores = ['#e9c58f', '#d798a7', '#ffffff', '#a74971', '#f3dcae'];
  const box = document.createElement('div');
  box.className = 'karen-confete';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('i');
    c.style.cssText = `left:${Math.random() * 100}%;background:${cores[i % cores.length]};--d:${(1.8 + Math.random() * 1.6).toFixed(2)}s;` +
      `--atraso:${(Math.random() * .5).toFixed(2)}s;--x:${(Math.random() * 160 - 80).toFixed(0)}px;--giro:${(Math.random() * 720 - 360).toFixed(0)}deg;` +
      `width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;border-radius:${i % 4 ? '2px' : '50%'}`;
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}
const aviso = (t, erro) => { retorno.hidden = false; retorno.textContent = t; retorno.classList.toggle('erro', !!erro); };

// ---------------- Perfumes com o preço do cupom ----------------
let cupomAtual = null;
function desenharPerfumes() {
  const lista = document.getElementById('perfumes');
  if (!lista) return;
  const pct = cupomAtual ? cupomAtual.pct : null;
  lista.innerHTML = '';
  PERFUMES.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'perfume' + (pct ? ' com-cupom' : '');
    const preco = pct ? comDesconto(p.cheio, pct) : comDesconto(p.cheio, DESCONTO_MAXIMO);
    li.innerHTML = '<span class="perfume-foto"><img src="/sacola-misteriosa/perfumes/' + p.foto + '.webp" width="400" height="500" loading="lazy" decoding="async" alt=""></span>' +
      '<span class="perfume-marca"></span><strong class="perfume-nome"></strong>' +
      '<span class="perfume-cheio"></span><span class="perfume-preco"></span><span class="perfume-nota"></span>';
    li.querySelector('.perfume-marca').textContent = p.marca;
    li.querySelector('.perfume-nome').textContent = p.nome;
    li.querySelector('.perfume-foto img').alt = p.nome + ' (' + p.marca + ')';
    li.querySelector('.perfume-cheio').textContent = 'Preço cheio ' + brl(p.cheio);
    li.querySelector('.perfume-preco').innerHTML = '<small>' + (pct ? 'Com seu cupom' : 'A partir de') + '</small>' + brl(preco);
    li.querySelector('.perfume-nota').textContent = pct ? pct + '% de desconto (economia de ' + brl(p.cheio - preco) + ')' : 'com o cupom de 10%';
    const restam = carrinho ? carrinho.disponivel()[p.foto] : undefined;
    const esgotado = restam !== undefined && restam <= 0;
    const selo = document.createElement('span');
    selo.className = 'perfume-estoque' + (esgotado ? ' zero' : '');
    selo.textContent = restam === undefined ? '' : esgotado ? 'Esgotado' : restam <= 3 ? (restam === 1 ? 'Última unidade' : 'Restam ' + restam) : '';
    if (selo.textContent) li.querySelector('.perfume-foto').appendChild(selo);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn perfume-btn';
    const noCarrinho = carrinho ? carrinho.noCarrinho(p.foto) : 0;
    btn.textContent = esgotado ? 'Esgotado' : noCarrinho ? 'No carrinho (' + noCarrinho + ') · adicionar' : 'Adicionar ao carrinho';
    btn.disabled = esgotado || !carrinho;
    btn.addEventListener('click', () => {
      if (!carrinho) return;
      if (carrinho.adicionar(p.foto)) { desenharPerfumes(); carrinho.abrir(); }
      else { btn.textContent = 'Limite disponível no carrinho'; }
    });
    li.appendChild(btn);
    lista.appendChild(li);
  });
  const titulo = document.getElementById('perfumes-sub');
  if (titulo) titulo.textContent = pct
    ? 'Preços com o seu cupom de ' + pct + '%. O cupom é aplicado no carrinho; pagamento por Pix.'
    : 'O cupom é aplicado sobre o preço cheio. Com 10%, você paga o preço Black Friday.';
}

// Combo: pedir perfume e sacola misteriosa juntos (o cupom vale para o perfume).
function atualizarCombo() {
  const a = document.getElementById('combo-whats');
  if (!a) return;
  if (!telefoneKaren) { a.hidden = true; return; }
  const c = cupomAtual;
  a.href = 'https://wa.me/' + telefoneKaren + '?text=' + encodeURIComponent('Olá, Karen! Quero um perfume da Black Friday e uma sacola misteriosa juntos.' +
    (c ? ` Meu cupom é ${c.codigo} (${c.pct}%).` : ''));
  a.hidden = false;
}

// ---------------- Fluxo ----------------
async function carregarContato() {
  try {
    const [{ initializeApp }, F] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-firestore-lite.js')]);
    const app = initializeApp(FIREBASE_CONFIG, 'karen-roleta-publico');
    await iniciarAppCheck(app);
    fbF = F; fbDb = F.getFirestore(app);
    const snap = await F.getDoc(F.doc(fbDb, 'ti', 'base', 'rastreio', 'sacolas-publicas'));
    const dados = snap.exists() ? snap.data() : {};
    publico = { pix: dados.pix || null, estoque: dados.perfumes || {} };
    const t = normalizeWhatsApp(dados.whatsapp);
    telefoneKaren = (t.length >= 12 && t.length <= 13) ? t : '';
  } catch (e) { console.warn('Contato da Karen indisponível:', e); }
}
const lerPublico = async (id) => {
  if (!fbDb) return null;
  try { const d = await fbF.getDoc(fbF.doc(fbDb, 'ti', 'base', 'rastreio', id)); return d.exists() ? d.data() : null; }
  catch (_) { return null; }
};

// Placar: quantos cupons já saíram (publicado pelo painel da Karen).
async function mostrarPlacar() {
  const p = await lerPublico('bf-placar');
  const el = document.getElementById('placar');
  if (!el || !p || !(Number(p.cupons) >= 10)) return;
  el.textContent = Number(p.cupons) + ' cupons já distribuídos' + (Number(p.usados) >= 5 ? ' · ' + Number(p.usados) + ' perfumes garantidos' : '');
  el.hidden = false;
}

// Contagem regressiva até o fim da campanha.
function contagem() {
  const el = document.getElementById('contagem');
  if (!el) return;
  const pad = (n) => String(n).padStart(2, '0');
  const tic = () => {
    const ms = FIM - Date.now();
    if (ms <= 0) { el.textContent = 'Promoção encerrada'; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, sg = Math.floor(ms / 1e3) % 60;
    el.innerHTML = '<span>Termina em</span>' + (d ? '<b>' + d + '</b>d ' : '') + '<b>' + pad(h) + '</b>h <b>' + pad(m) + '</b>m <b>' + pad(sg) + '</b>s';
    setTimeout(tic, 1000 - (Date.now() % 1000));
  };
  tic();
}

// Depois de ganhar: convite para indicar uma amiga.
function prepararIndicacao(c) {
  const box = document.getElementById('indicar');
  if (!box || !c) return;
  const link = location.origin + location.pathname + '?amiga=' + encodeURIComponent(c.codigo);
  const texto = 'Olha que legal: a Karen Cosméticos está com uma roleta de Black Friday e todo giro ganha desconto em perfumes! Gira aqui: ' + link;
  box.querySelector('#indicar-whats').href = 'https://wa.me/?text=' + encodeURIComponent(texto);
  box.querySelector('#indicar-copiar').onclick = async (e) => {
    try { await navigator.clipboard.writeText(link); e.currentTarget.textContent = 'Link copiado ✓'; } catch (_) { e.currentTarget.textContent = link; }
  };
  box.hidden = false;
}

function iniciar() {
  desenharRoda();
  desenharPerfumes();
  contagem();
  if (amiga) { const av = document.getElementById('aviso-amiga'); if (av) av.hidden = false; }
  carrinho = criarCarrinho({
    perfumes: PERFUMES,
    chaveCupom: CHAVE,
    contato: () => ({ pix: publico.pix, estoque: publico.estoque, whatsapp: telefoneKaren }),
    firebase: () => (fbDb ? { F: fbF, db: fbDb } : null),
  });
  document.addEventListener('karen:estoque', () => desenharPerfumes());
  document.addEventListener('karen:cupons', () => desenharPerfumes());
  carregarContato().then(async () => {
    carrinho.carregarDisponivel().catch((e) => console.warn('Estoque indisponível:', e));
    atualizarCombo();
    mostrarPlacar();
    if (tokenGiro) {
      giroExtraOk = Boolean(await lerPublico('bfgiro-' + tokenGiro));
      const av = document.getElementById('aviso-giro');
      if (av) { av.hidden = false; av.textContent = giroExtraOk ? 'Você ganhou um giro extra por indicar uma amiga! 🎁' : 'Este link de giro extra não é válido. Peça um novo para a Karen.'; av.classList.toggle('erro', !giroExtraOk); }
    }
    const salvo = (() => { try { return JSON.parse(localStorage.getItem(chaveCupom()) || 'null'); } catch (_) { return null; } })();
    if (salvo && salvo.codigo) mostrarPremio(salvo, true);
    else desenharPerfumes(); // agora com o WhatsApp da Karen carregado
  });
  if (new Date() > FIM) {
    form.querySelectorAll('input,button').forEach((el) => { el.disabled = true; });
    aviso('A roleta da Black Friday terminou. Obrigada por participar! 💝', false);
    return;
  }
  // clicar na roda também envia o formulário
  roda.addEventListener('click', () => { if (!girando) form.requestSubmit(); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (girando) return;
    retorno.hidden = true;
    let salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(chaveCupom()) || 'null'); } catch (_) {}
    if (salvo && salvo.codigo) { mostrarPremio(salvo, true); return; }
    if (tokenGiro && !giroExtraOk) { aviso('Este link de giro extra não é válido. Peça um novo para a Karen.', true); return; }
    const nome = $('#nome').value.trim();
    const whatsapp = normalizeWhatsApp($('#telefone').value);
    if (nome.length < 2) { aviso('Informe seu nome para girar.', true); $('#nome').focus(); return; }
    if (!validoBR(whatsapp)) { aviso('Informe um WhatsApp com DDD, por exemplo (33) 99999-9999.', true); $('#telefone').focus(); return; }
    if (!$('#aceite').checked) { aviso('Marque a autorização de contato para receber o cupom.', true); return; }

    girando = true; botao.disabled = true; botao.textContent = 'Girando…';
    // no celular a roda fica acima do formulário: mostra a roda antes de girar
    if (roda.getBoundingClientRect().bottom < 80 || roda.getBoundingClientRect().top > innerHeight - 80) {
      roda.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'center' });
      if (!calmo) await new Promise((r) => setTimeout(r, 450));
    }
    const cupom = pendente ? { ...pendente, nome, whatsapp } : { pct: sortear(), codigo: gerarCodigo(), nome, whatsapp, em: new Date().toISOString() };
    const { pct, codigo } = cupom;
    try { window.KarenSound?.play('bag'); } catch (_) {}
    const [gravou] = await Promise.all([
      salvarLead({
        nome, whatsapp, cidade: '', equipamento: '', problema: 'Cupom Black Friday',
        detalhe: `Cupom ${codigo}: ${pct}% de desconto, válido até ${VALIDADE_TEXTO} [cupom:${codigo}:${pct}]`,
        atendimento: 'WhatsApp', servico: 'Roleta Black Friday', origem: 'black-friday', utm: 'black-friday',
        indicacao: tokenGiro ? 'giro:' + tokenGiro : (amiga ? 'amiga:' + amiga : ''),
      }),
      pendente ? Promise.resolve() : girarAte(pct),
    ]);
    girando = false;
    if (!gravou) {
      pendente = cupom;
      botao.disabled = false; botao.textContent = 'Tentar de novo';
      aviso('A roleta parou, mas não conseguimos registrar seu cupom. Verifique a internet e toque em "Tentar de novo".', true);
      return;
    }
    pendente = null;
    try { localStorage.setItem(chaveCupom(), JSON.stringify(cupom)); } catch (_) {}
    confete();
    mostrarPremio(cupom, false);
  });
}
iniciar();
