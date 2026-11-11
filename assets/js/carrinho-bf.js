// Carrinho da Black Friday (Karen Cosméticos): perfumes + 1 cupom da roleta + Pix.
// Regras: 1 cupom por compra (a % da roleta vale para o carrinho todo, limitada a 10%);
// a cliente tem 10 minutos para pagar o Pix; sem pagamento, o pedido é cancelado e o
// cupom é perdido. Quem confirma o pagamento é a Karen, no painel.
// Estoque: cada frasco é uma vaga numerada (ti/base/vagas-bf/{foto}-{n}, sem dados pessoais).
// A Karen informa o total à venda (n = 1..total). Reservar = gravar as vagas num lote só:
// as regras do Firebase recusam vaga ocupada, então duas clientes nunca pegam o mesmo frasco.
// Vaga ocupada = paga, ou reservada há menos de 10 min e não cancelada.
import { salvarLead } from './leads.js';

const PRAZO_MIN = 10;
const MAX_POR_ITEM = 5;
const K_CARRINHO = 'karen-bf-carrinho';
const K_USO = 'karen-bf-cupons-usados';   // cupons já colocados em pedido neste aparelho
const K_PEDIDO = 'karen-bf-pedido';        // pedido aguardando Pix
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? padrao; } catch (_) { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const digits = (v) => String(v || '').replace(/\D/g, '');
const normalizeWhatsApp = (v) => { const d = digits(v); return (d.length === 10 || d.length === 11) ? '55' + d : d; };
const centavos = (n) => Math.round(n * 100) / 100;
async function sha256(t) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function segredoNovo() {
  const n = new Uint8Array(18); crypto.getRandomValues(n);
  return [...n].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function criarCarrinho({ perfumes, chaveCupom, contato, firebase }) {
  const porFoto = Object.fromEntries(perfumes.map((p) => [p.foto, p]));
  let itens = ler(K_CARRINHO, {});
  let timer = null;
  const digitado = { nome: '', tel: '' }; // mantém o que a cliente digitou quando o carrinho é redesenhado
  let disponivel = {};   // foto -> unidades disponíveis (ausente = estoque não controlado)

  // ---------- Estoque ----------
  let livres = {};       // foto -> números de vaga livres
  async function carregarDisponivel() {
    const base = contato().estoque || {};
    const ocupadas = {};
    const fb = firebase();
    if (fb) {
      const { F, db } = fb;
      const snap = await F.getDocs(F.query(F.collection(db, 'ti', 'base', 'vagas-bf'), F.limit(500)));
      snap.forEach((d) => {
        const m = /^(.+)-(\d+)$/.exec(d.id);
        if (!m) return;
        const r = d.data();
        const criado = r.criadoEm && r.criadoEm.toMillis ? r.criadoEm.toMillis() : 0;
        const paga = r.pagoEm && r.pagoEm !== '';
        const cancelada = r.canceladoEm && r.canceladoEm !== '';
        if (paga || (!cancelada && criado + PRAZO_MIN * 60000 > Date.now())) (ocupadas[m[1]] = ocupadas[m[1]] || new Set()).add(Number(m[2]));
      });
    }
    disponivel = {}; livres = {};
    perfumes.forEach((p) => {
      if (base[p.foto] === undefined || base[p.foto] === null || base[p.foto] === '') return;
      const total = Math.max(0, Math.floor(Number(base[p.foto]) || 0));
      const occ = ocupadas[p.foto] || new Set();
      livres[p.foto] = [];
      for (let n = 1; n <= total; n++) if (!occ.has(n)) livres[p.foto].push(n);
      disponivel[p.foto] = livres[p.foto].length;
    });
    document.dispatchEvent(new CustomEvent('karen:estoque', { detail: { ...disponivel } }));
    return disponivel;
  }

  // Reserva as vagas num lote atômico; se outra cliente pegou alguma antes, tenta de novo.
  async function reservarVagas(codigo, linhas, trava) {
    const { F, db } = firebase();
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      await carregarDisponivel();
      const escolhidas = [];
      for (const l of linhas) {
        if (livres[l.p.foto] === undefined) continue; // perfume sem controle de estoque
        const opcoes = livres[l.p.foto].slice().sort(() => Math.random() - 0.5);
        if (opcoes.length < l.q) return { faltando: [l] };
        opcoes.slice(0, l.q).forEach((n) => escolhidas.push(l.p.foto + '-' + n));
      }
      if (!escolhidas.length) return { vagas: [] };
      try {
        const lote = F.writeBatch(db);
        escolhidas.forEach((id) => lote.set(F.doc(db, 'ti', 'base', 'vagas-bf', id), { trava, criadoEm: F.serverTimestamp() }));
        await lote.commit();
        return { vagas: escolhidas };
      } catch (e) {
        console.warn('Vaga disputada, tentando de novo:', e);
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
      }
    }
    return { erro: true };
  }
  const limite = (foto) => Math.min(MAX_POR_ITEM, disponivel[foto] ?? MAX_POR_ITEM);

  // ---------- Elementos ----------
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'carrinho-fab';
  fab.hidden = true;
  document.body.appendChild(fab);
  const dlg = document.createElement('dialog');
  dlg.className = 'carrinho';
  dlg.setAttribute('aria-label', 'Carrinho');
  document.body.appendChild(dlg);
  fab.addEventListener('click', () => abrir());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { clearInterval(timer); clearInterval(vigia); });

  const quantidade = () => Object.values(itens).reduce((a, b) => a + b, 0);
  const salvarItens = () => { gravar(K_CARRINHO, itens); atualizarFab(); };
  function atualizarFab() {
    const q = quantidade();
    fab.hidden = q === 0 && !ler(K_PEDIDO, null);
    fab.innerHTML = ler(K_PEDIDO, null) && prazoRestante(ler(K_PEDIDO, null)) > 0
      ? '<span>Pix pendente</span><b>pagar</b>' : '<span>Carrinho</span><b>' + q + '</b>';
    fab.classList.remove('pulo'); void fab.offsetWidth; fab.classList.add('pulo');
  }

  // Cupons ganhos neste aparelho (giro normal e giros extras) que ainda não foram usados.
  function cuponsDisponiveis() {
    const usados = ler(K_USO, {});
    const lista = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(chaveCupom)) continue;
      const c = ler(k, null);
      if (c && c.codigo && !usados[c.codigo]) lista.push(c);
    }
    return lista.sort((a, b) => b.pct - a.pct);
  }
  const cuponsPerdidos = () => Object.entries(ler(K_USO, {})).filter(([, u]) => u.estado === 'perdido').map(([c]) => c);

  function totais(cupom) {
    const linhas = Object.entries(itens).filter(([f, q]) => porFoto[f] && q > 0).map(([f, q]) => ({ p: porFoto[f], q, valor: centavos(porFoto[f].cheio * q) }));
    const subtotal = centavos(linhas.reduce((a, l) => a + l.valor, 0));
    const pct = cupom ? Math.min(Number(cupom.pct) || 0, 10) : 0;
    const desconto = centavos(subtotal * pct / 100);
    return { linhas, subtotal, pct, desconto, total: centavos(subtotal - desconto) };
  }

  // ---------- API usada pela página ----------
  function adicionar(foto) {
    if (!porFoto[foto]) return false;
    if ((itens[foto] || 0) >= limite(foto)) return false;
    itens[foto] = (itens[foto] || 0) + 1;
    salvarItens();
    return true;
  }

  function abrir() {
    carregarDisponivel().then(() => { if (dlg.open && !ler(K_PEDIDO, null)) telaItens(); }).catch(() => {});
    const pedido = ler(K_PEDIDO, null);
    if (pedido && prazoRestante(pedido) > 0) telaPix(pedido);
    else { if (pedido) expirar(pedido, false); telaItens(); }
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Tela 1: itens, cupom e dados ----------
  function telaItens(recado) {
    const cupons = cuponsDisponiveis();
    const ultimo = cupons[0] || null;
    const { linhas } = totais(null);
    const perdidos = cuponsPerdidos();
    if (!linhas.length) {
      dlg.innerHTML = '<div class="carrinho-topo"><h2>Seu carrinho</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
        '<p class="carrinho-vazio">Seu carrinho está vazio. Toque em "Adicionar ao carrinho" em um perfume.</p>';
      dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
      return;
    }
    const contatoSalvo = { nome: digitado.nome || (ultimo && ultimo.nome) || '', whatsapp: digitado.tel || (ultimo && ultimo.whatsapp ? ultimo.whatsapp.replace(/^55/, '') : '') };
    dlg.innerHTML = '<div class="carrinho-topo"><h2>Seu carrinho</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
      (recado ? '<p class="carrinho-recado">' + esc(recado) + '</p>' : '') +
      '<ul class="carrinho-itens">' + linhas.map((l) => '<li><img src="/karen/perfumes/' + esc(l.p.foto) + '.webp" alt="" width="56" height="70">' +
        '<div><strong>' + esc(l.p.nome) + '</strong><span>' + esc(l.p.marca) + ' · ' + brl(l.p.cheio) + ' cada</span></div>' +
        '<div class="carrinho-qtd"><button type="button" data-menos="' + esc(l.p.foto) + '" aria-label="Diminuir">−</button><b>' + l.q + '</b>' +
        '<button type="button" data-mais="' + esc(l.p.foto) + '" aria-label="Aumentar">+</button>' +
        '<button type="button" class="carrinho-remover" data-remover="' + esc(l.p.foto) + '">Remover</button></div></li>').join('') + '</ul>' +
      '<button type="button" class="carrinho-esvaziar" data-esvaziar>Esvaziar carrinho</button>' +
      '<div class="carrinho-cupom">' + (cupons.length
        ? '<label for="carrinho-cupom">Cupom (1 por compra)</label><select id="carrinho-cupom">' +
          cupons.map((c) => '<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + ' · ' + c.pct + '% de desconto</option>').join('') +
          '<option value="">Comprar sem cupom</option></select>'
        : '<p>' + (perdidos.length ? 'Seu cupom foi perdido porque o pedido foi cancelado ou o Pix não foi pago em ' + PRAZO_MIN + ' minutos.' : 'Você ainda não tem cupom. <a href="#roda" data-girar>Gire a roleta</a> para ganhar de 1% a 10%.') +
          ' Use o mesmo celular em que girou a roleta.</p>') + '</div>' +
      '<dl class="carrinho-total"></dl>' +
      '<form class="carrinho-dados"><div class="bf-campos"><div class="field"><label for="c-nome">Seu nome</label><input id="c-nome" required minlength="2" maxlength="80" autocomplete="name" value="' + esc(contatoSalvo.nome || '') + '"></div>' +
      '<div class="field"><label for="c-tel">Seu WhatsApp</label><input id="c-tel" type="tel" inputmode="tel" required maxlength="20" autocomplete="tel" value="' + esc(contatoSalvo.whatsapp) + '"></div></div>' +
      '<p class="carrinho-aviso">Ao gerar o Pix você tem <b>' + PRAZO_MIN + ' minutos</b> para pagar. Sem pagamento, o pedido é cancelado' + (cupons.length ? ' e o cupom é perdido' : '') + '. A entrega é combinada com a Karen pelo WhatsApp.</p>' +
      '<button class="btn bf-girar" type="submit"></button><p class="carrinho-erro" role="status" hidden></p></form>';
    dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
    dlg.querySelectorAll('[data-girar]').forEach((a) => a.onclick = () => dlg.close());
    dlg.querySelectorAll('[data-mais]').forEach((b) => {
      b.disabled = itens[b.dataset.mais] >= limite(b.dataset.mais);
      b.onclick = () => { if (itens[b.dataset.mais] < limite(b.dataset.mais)) { itens[b.dataset.mais]++; salvarItens(); } telaItens(); };
    });
    dlg.querySelectorAll('[data-remover]').forEach((b) => b.onclick = () => { delete itens[b.dataset.remover]; salvarItens(); telaItens(); });
    dlg.querySelector('[data-esvaziar]').onclick = () => { itens = {}; salvarItens(); telaItens(); };
    dlg.querySelectorAll('[data-menos]').forEach((b) => b.onclick = () => { itens[b.dataset.menos]--; if (itens[b.dataset.menos] <= 0) delete itens[b.dataset.menos]; salvarItens(); telaItens(); });
    const sel = dlg.querySelector('#carrinho-cupom');
    const botao = dlg.querySelector('.carrinho-dados button[type=submit]');
    const cupomEscolhido = () => (sel && sel.value ? cupons.find((c) => c.codigo === sel.value) : null);
    const recalcular = () => {
      const t = totais(cupomEscolhido());
      dlg.querySelector('.carrinho-total').innerHTML = '<dt>Subtotal (preço cheio)</dt><dd>' + brl(t.subtotal) + '</dd>' +
        (t.pct ? '<dt>Cupom ' + t.pct + '%</dt><dd>−' + brl(t.desconto) + '</dd>' : '') + '<dt class="t">Total no Pix</dt><dd class="t">' + brl(t.total) + '</dd>';
      botao.textContent = 'Gerar Pix de ' + brl(t.total);
    };
    if (sel) sel.onchange = recalcular;
    dlg.querySelector('#c-nome').oninput = (e) => { digitado.nome = e.target.value; };
    dlg.querySelector('#c-tel').oninput = (e) => { digitado.tel = e.target.value; };
    recalcular();
    const pix = contato().pix;
    if (!pix || !pix.chave) {
      botao.disabled = true;
      const e = dlg.querySelector('.carrinho-erro'); e.hidden = false;
      e.textContent = 'O pagamento por Pix ainda está sendo configurado. Fale com a Karen pelo WhatsApp para comprar.';
    }
    dlg.querySelector('.carrinho-dados').onsubmit = (ev) => { ev.preventDefault(); finalizar(cupomEscolhido(), botao); };
  }

  async function finalizar(cupom, botao) {
    const erro = dlg.querySelector('.carrinho-erro');
    const nome = dlg.querySelector('#c-nome').value.trim();
    const whatsapp = normalizeWhatsApp(dlg.querySelector('#c-tel').value);
    const mostrarErro = (t) => { erro.hidden = false; erro.textContent = t; };
    if (nome.length < 2) return mostrarErro('Informe seu nome.');
    if (!/^55\d{10,11}$/.test(whatsapp)) return mostrarErro('Informe um WhatsApp com DDD.');
    const t = totais(cupom);
    if (!t.linhas.length || t.total <= 0) return mostrarErro('Seu carrinho está vazio.');
    const pix = contato().pix;
    if (!pix || !pix.chave) return mostrarErro('Pix indisponível no momento.');
    botao.disabled = true; botao.textContent = 'Reservando seus perfumes…';
    const fb = firebase();
    if (!fb) { botao.disabled = false; botao.textContent = 'Tentar de novo'; return mostrarErro('Sem conexão com a loja. Verifique a internet e tente de novo.'); }
    try { await carregarDisponivel(); } catch (e) { console.warn(e); }
    const faltando = t.linhas.filter((l) => disponivel[l.p.foto] !== undefined && l.q > disponivel[l.p.foto]);
    if (faltando.length) {
      faltando.forEach((l) => { if (disponivel[l.p.foto] <= 0) delete itens[l.p.foto]; else itens[l.p.foto] = disponivel[l.p.foto]; });
      salvarItens(); telaItens();
      const e2 = dlg.querySelector('.carrinho-erro'); e2.hidden = false;
      e2.textContent = 'Acabou de esgotar: ' + faltando.map((l) => l.p.nome).join(', ') + '. Ajustamos seu carrinho.';
      return;
    }
    const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const n = new Uint32Array(6); crypto.getRandomValues(n);
    const codigo = 'P' + [...n].map((v) => letras[v % letras.length]).join('');
    const prazo = new Date(Date.now() + PRAZO_MIN * 60000).toISOString();
    const resumoItens = t.linhas.map((l) => l.q + 'x ' + l.p.nome + ' (' + brl(l.valor) + ')').join('; ');
    const tag = `[pedido:${codigo};cupom:${cupom ? cupom.codigo : ''};pct:${t.pct};sub:${t.subtotal.toFixed(2)};total:${t.total.toFixed(2)};` +
      `itens:${t.linhas.map((l) => l.p.foto + '*' + l.q).join(',')};vagas:VAGAS;segredo:SEGREDO]`;
    const detalhe0 = `Pedido ${codigo}: ${resumoItens}. Subtotal ${brl(t.subtotal)}` + (cupom ? `, cupom ${cupom.codigo} (${t.pct}%) −${brl(t.desconto)}` : '') +
      `. Total no Pix ${brl(t.total)}. ${tag}`;
    let detalhe = '';
    // 1) Reserva as vagas (o pedido só existe se a reserva for aceita).
    let vagas = [];
    const segredo = segredoNovo();
    const trava = await sha256(segredo);
    try {
      const r = await reservarVagas(codigo, t.linhas, trava);
      if (r.faltando) {
        await carregarDisponivel().catch(() => {});
        r.faltando.forEach((l) => { const d = disponivel[l.p.foto] || 0; if (d <= 0) delete itens[l.p.foto]; else itens[l.p.foto] = d; });
        salvarItens(); telaItens();
        const e2 = dlg.querySelector('.carrinho-erro'); e2.hidden = false;
        e2.textContent = 'Acabou de esgotar: ' + r.faltando.map((l) => l.p.nome).join(', ') + '. Ajustamos seu carrinho.';
        return;
      }
      if (r.erro) throw new Error('vagas indisponíveis');
      vagas = r.vagas;
    } catch (e) {
      console.warn('Reserva recusada:', e);
      botao.disabled = false; botao.textContent = 'Tentar de novo';
      return mostrarErro('Não foi possível reservar os perfumes agora. Tente de novo em instantes ou fale com a Karen pelo WhatsApp.');
    }
    // 2) Registra o pedido para a Karen (dados de contato ficam só no painel).
    detalhe = detalhe0.replace('VAGAS', vagas.join(',')).replace('SEGREDO', segredo);
    const ok = await salvarLead({
      nome, whatsapp, cidade: '', equipamento: codigo, problema: 'Pedido Black Friday', detalhe,
      atendimento: 'Pix', servico: 'Pedido Black Friday', origem: 'black-friday-pedido', utm: 'black-friday',
      indicacao: cupom ? 'cupom:' + cupom.codigo : '',
    });
    if (!ok) { botao.disabled = false; botao.textContent = 'Tentar de novo'; return mostrarErro('Os perfumes ficaram reservados, mas o pedido não foi registrado. Tente de novo; a reserva anterior expira sozinha em 10 minutos.'); }
    const { pixPayload } = await import('./pix.js');
    const payload = pixPayload({ chave: pix.chave, nome: pix.nome || 'Karen', cidade: pix.cidade || 'Brasil', valor: t.total, txid: codigo });
    const pedido = { codigo, total: t.total, prazo, payload, cupom: cupom ? cupom.codigo : '', pct: t.pct, nome, resumo: resumoItens,
      vagas, segredo, itens: Object.fromEntries(t.linhas.map((l) => [l.p.foto, l.q])) };
    if (cupom) { const u = ler(K_USO, {}); u[cupom.codigo] = { pedido: codigo, prazo, estado: 'reservado' }; gravar(K_USO, u); }
    gravar(K_PEDIDO, pedido);
    itens = {}; salvarItens();
    document.dispatchEvent(new CustomEvent('karen:cupons'));
    telaPix(pedido);
  }

  // ---------- Tela 2: Pix com prazo ----------
  const prazoRestante = (p) => new Date(p.prazo).getTime() - Date.now();
  async function telaPix(p) {
    const { qrSvg } = await import('../vendor/qrcode.js');
    const tel = contato().whatsapp;
    const msg = `Olá, Karen! Fiz o Pix do pedido ${p.codigo} no valor de ${brl(p.total)}` + (p.cupom ? ` (cupom ${p.cupom}, ${p.pct}%)` : '') +
      `. Itens: ${p.resumo}. Segue o comprovante.`;
    dlg.innerHTML = '<div class="carrinho-topo"><h2>Compra registrada!</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
      '<p class="pix-ok">Seus perfumes estão reservados. Pague o Pix para garantir a compra.</p>' +
      '<div class="pix-tempo" role="timer" aria-live="off"><span>Tempo para pagar</span><b id="pix-relogio">10:00</b></div>' +
      '<p class="pix-valor">Pedido <b>' + esc(p.codigo) + '</b> · <b>' + brl(p.total) + '</b></p>' +
      '<div class="pix-qr">' + qrSvg(p.payload, { tamanho: 220 }) + '</div>' +
      '<label class="pix-rotulo" for="pix-copia">Pix copia e cola</label><textarea id="pix-copia" readonly rows="3">' + esc(p.payload) + '</textarea>' +
      '<div class="premio-acoes"><button type="button" class="btn" id="pix-copiar">Copiar código Pix</button>' +
      (tel ? '<a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/' + esc(tel) + '?text=' + encodeURIComponent(msg) + '">Já paguei: enviar comprovante</a>' : '') + '</div>' +
      '<button type="button" class="carrinho-cancelar" id="pix-cancelar">Cancelar pedido</button>' +
      '<p class="carrinho-aviso">Pague em até ' + PRAZO_MIN + ' minutos. Sem pagamento, o pedido é cancelado' + (p.cupom ? ' e o cupom ' + esc(p.cupom) + ' é perdido' : '') +
      '. Depois de pagar, envie o comprovante: a Karen confirma e combina a entrega.</p>';
    dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
    dlg.querySelector('#pix-copiar').onclick = async (e) => {
      try { await navigator.clipboard.writeText(p.payload); e.currentTarget.textContent = 'Código copiado ✓'; }
      catch (_) { dlg.querySelector('#pix-copia').select(); }
    };
    const btCancelar = dlg.querySelector('#pix-cancelar');
    btCancelar.onclick = async () => {
      if (!btCancelar.dataset.certeza) {
        btCancelar.dataset.certeza = '1';
        btCancelar.textContent = 'Toque de novo para cancelar (os perfumes voltam ao carrinho)';
        return;
      }
      btCancelar.disabled = true; btCancelar.textContent = 'Cancelando…';
      const ok = await cancelarPelaCliente(p);
      if (!ok) { btCancelar.disabled = false; btCancelar.textContent = 'Não foi possível cancelar. Tentar de novo'; delete btCancelar.dataset.certeza; }
    };
    const relogio = dlg.querySelector('#pix-relogio');
    clearInterval(timer);
    const tic = () => {
      const ms = prazoRestante(p);
      if (ms <= 0) { clearInterval(timer); expirar(p, true); return; }
      const s = Math.ceil(ms / 1000);
      relogio.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      relogio.parentElement.classList.toggle('urgente', s <= 120);
    };
    tic(); timer = setInterval(tic, 1000);
    vigiarPedido(p);
    atualizarFab();
  }


  // A cliente desiste antes de pagar: libera as vagas (com o segredo da trava),
  // devolve os perfumes ao carrinho e mantém o cupom.
  async function cancelarPelaCliente(p) {
    const fb = firebase();
    if (p.vagas && p.vagas.length) {
      if (!fb) return false;
      try {
        const { F, db } = fb;
        const lote = F.writeBatch(db);
        p.vagas.forEach((id) => lote.update(F.doc(db, 'ti', 'base', 'vagas-bf', id), { canceladoEm: F.serverTimestamp(), segredo: p.segredo }));
        await lote.commit();
      } catch (e) { console.warn('Cancelamento recusado:', e); return false; }
    }
    clearInterval(timer); clearInterval(vigia);
    localStorage.removeItem(K_PEDIDO);
    if (p.cupom) { const u = ler(K_USO, {}); delete u[p.cupom]; gravar(K_USO, u); }
    itens = { ...(p.itens || {}) }; salvarItens();
    document.dispatchEvent(new CustomEvent('karen:cupons'));
    await carregarDisponivel().catch(() => {});
    telaItens('Pedido ' + p.codigo + ' cancelado. Seus perfumes voltaram ao carrinho' + (p.cupom ? ' e o cupom continua com você' : '') + '.');
    return true;
  }

  // Enquanto o Pix está aberto, confere se a Karen confirmou ou cancelou o pedido.
  let vigia = null;
  function vigiarPedido(p) {
    clearInterval(vigia);
    const fb = firebase();
    if (!fb || !p.vagas || !p.vagas.length) return;
    const { F, db } = fb;
    vigia = setInterval(async () => {
      if (!dlg.open || document.hidden) return;
      try {
        const d = await F.getDoc(F.doc(db, 'ti', 'base', 'vagas-bf', p.vagas[0]));
        const v = d.exists() ? d.data() : null;
        if (!v) return;
        if (v.pagoEm) {
          clearInterval(vigia); clearInterval(timer);
          localStorage.removeItem(K_PEDIDO); atualizarFab();
          if (p.cupom) { const u = ler(K_USO, {}); u[p.cupom] = { ...(u[p.cupom] || {}), estado: 'usado' }; gravar(K_USO, u); }
          dlg.innerHTML = '<div class="carrinho-topo"><h2>Pagamento confirmado!</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
            '<p class="pix-ok">A Karen recebeu seu Pix do pedido ' + esc(p.codigo) + ' 💝 Ela vai combinar a entrega com você pelo WhatsApp.</p>';
          dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
        } else if (v.canceladoEm && !v.segredo) {
          clearInterval(vigia); clearInterval(timer);
          localStorage.removeItem(K_PEDIDO);
          if (p.cupom) { const u = ler(K_USO, {}); u[p.cupom] = { ...(u[p.cupom] || {}), estado: 'perdido' }; gravar(K_USO, u); }
          atualizarFab(); carregarDisponivel().catch(() => {});
          dlg.innerHTML = '<div class="carrinho-topo"><h2>Pedido cancelado</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
            '<p class="carrinho-vazio">O pedido ' + esc(p.codigo) + ' foi cancelado pela loja. Se você já pagou, fale com a Karen pelo WhatsApp.</p>';
          dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
        }
      } catch (_) {}
    }, 15000);
  }

  function expirar(p, mostrar) {
    localStorage.removeItem(K_PEDIDO);
    if (p.cupom) { const u = ler(K_USO, {}); u[p.cupom] = { ...(u[p.cupom] || {}), estado: 'perdido' }; gravar(K_USO, u); }
    atualizarFab();
    document.dispatchEvent(new CustomEvent('karen:cupons'));
    carregarDisponivel().catch(() => {});
    if (!mostrar) return;
    dlg.innerHTML = '<div class="carrinho-topo"><h2>Tempo esgotado</h2><button type="button" class="carrinho-x" aria-label="Fechar">×</button></div>' +
      '<p class="carrinho-vazio">O Pix do pedido <b>' + esc(p.codigo) + '</b> não foi pago em ' + PRAZO_MIN + ' minutos. A compra foi cancelada e os perfumes voltaram para o estoque.' +
      (p.cupom ? ' O cupom <b>' + esc(p.cupom) + '</b> foi perdido.' : '') + '</p>' +
      '<p class="carrinho-aviso">Se você pagou dentro do prazo, envie o comprovante para a Karen pelo WhatsApp.</p>';
    dlg.querySelector('.carrinho-x').onclick = () => dlg.close();
  }

  // Pedido pendente de outra visita: avisa pelo botão flutuante.
  const pendente = ler(K_PEDIDO, null);
  if (pendente && prazoRestante(pendente) <= 0) expirar(pendente, false);
  atualizarFab();
  // Estoque atualizado a cada 30 s (reservas vencidas voltam sozinhas).
  setInterval(() => { if (!document.hidden) carregarDisponivel().catch(() => {}); }, 30000);
  return { adicionar, abrir, carregarDisponivel, disponivel: () => disponivel, noCarrinho: (f) => itens[f] || 0 };
}
