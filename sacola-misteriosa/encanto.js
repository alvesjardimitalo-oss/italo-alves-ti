// Interações da Sacola Misteriosa: sacudir a sacola, papel de seda,
// brilhos, prévia da sacola escolhida e comemoração do pedido.
// Tudo é decorativo: sem este arquivo o site continua funcionando.
(() => {
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = window.matchMedia('(hover: none)').matches;
  const som = (t) => { try { window.KarenSound?.play(t); } catch (_) {} };
  window.KarenEncanto = true;

  // Frases de brincadeira: nunca dizem o que tem dentro.
  const DICAS = [
    'Shhh… é segredo 🤫',
    'Escutei um barulhinho de surpresa…',
    'Quanto mais sacode, mais curiosa fica 😉',
    'Só abrindo pra descobrir 💝',
    'Tem mimo aqui dentro ✨',
    'Preparada com carinho pela Karen ♡',
  ];
  let ultimaDica = -1;
  const proximaDica = () => {
    let i;
    do { i = Math.floor(Math.random() * DICAS.length); } while (i === ultimaDica && DICAS.length > 1);
    ultimaDica = i;
    return DICAS[i];
  };

  // Coloca o "corpo" (para sacudir sem brigar com a flutuação) e o papel de seda.
  function preparar(bag) {
    if (bag.dataset.encanto) return;
    bag.dataset.encanto = '1';
    const corpo = document.createElement('span');
    corpo.className = 'paperbag__corpo';
    corpo.append(...bag.childNodes);
    const seda = document.createElement('span');
    seda.className = 'paperbag__seda';
    seda.setAttribute('aria-hidden', 'true');
    seda.innerHTML = '<i></i><i></i><i></i>';
    corpo.insertBefore(seda, corpo.querySelector('.paperbag__front'));
    bag.appendChild(corpo);
  }

  function brilhos(alvo, quantidade = 12) {
    if (calmo) return;
    const r = alvo.getBoundingClientRect();
    const cores = ['#d798a7', '#e9c58f', '#ffffff', '#9c4f72'];
    for (let i = 0; i < quantidade; i++) {
      const p = document.createElement('span');
      p.className = 'karen-brilho';
      p.textContent = i % 3 ? '✦' : '♡';
      const ang = (Math.PI * 2 * i) / quantidade + Math.random() * 0.5;
      const dist = 60 + Math.random() * 70;
      p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height * 0.3}px;` +
        `--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 40}px;color:${cores[i % cores.length]};` +
        `font-size:${10 + Math.random() * 12}px`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }

  function balao(ancora, texto) {
    let b = ancora.querySelector('.karen-balao');
    if (!b) {
      b = document.createElement('span');
      b.className = 'karen-balao';
      b.setAttribute('role', 'status');
      ancora.appendChild(b);
    }
    b.textContent = texto;
    b.classList.remove('mostra');
    void b.offsetWidth;
    b.classList.add('mostra');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.remove('mostra'), 2600);
  }

  function sacudir(bag, ancora) {
    preparar(bag);
    bag.classList.remove('sacudindo');
    void bag.offsetWidth;
    bag.classList.add('sacudindo');
    setTimeout(() => bag.classList.remove('sacudindo'), 900);
    som('bag');
    brilhos(bag);
    if (ancora) balao(ancora, proximaDica());
    if (navigator.vibrate && toque) { try { navigator.vibrate([18, 40, 18]); } catch (_) {} }
  }

  // Inclina a sacola acompanhando o mouse (só em computador).
  function inclinar(area, bag) {
    if (calmo || toque) return;
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      bag.style.setProperty('--ry', (x * 18).toFixed(1) + 'deg');
      bag.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg');
    });
    area.addEventListener('pointerleave', () => { bag.style.setProperty('--ry', '0deg'); bag.style.setProperty('--rx', '0deg'); });
  }

  // ---------- Página inicial: as três sacolas do topo ----------
  const cena = document.querySelector('.scene');
  if (cena) {
    const bags = [...cena.querySelectorAll('.paperbag')];
    bags.forEach(preparar);
    cena.classList.add('cena-viva');
    cena.setAttribute('role', 'group'); // a ilustração agora tem um botão dentro
    bags.forEach((b) => b.setAttribute('aria-hidden', 'true'));
    // Botão acessível por cima da ilustração.
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'cena-botao';
    botao.textContent = 'Sacuda as sacolas ✦';
    cena.appendChild(botao);
    const sacudirTodas = (alvo) => {
      const lista = alvo ? [alvo] : bags;
      lista.forEach((b, i) => setTimeout(() => sacudir(b, i === 0 ? cena : null), i * 110));
      cena.classList.add('ja-sacudiu');
    };
    botao.addEventListener('click', () => sacudirTodas(null));
    bags.forEach((b) => b.addEventListener('click', () => sacudirTodas(b)));
    if (!calmo && !toque) {
      cena.addEventListener('pointermove', (e) => {
        const r = cena.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        bags.forEach((b, i) => {
          const prof = [14, 22, 10][i] || 12;
          b.style.setProperty('--px', (x * prof).toFixed(1) + 'px');
          b.style.setProperty('--py', (y * prof).toFixed(1) + 'px');
          b.style.setProperty('--ry', (x * 14).toFixed(1) + 'deg');
          b.style.setProperty('--rx', (-y * 8).toFixed(1) + 'deg');
        });
      });
      cena.addEventListener('pointerleave', () => bags.forEach((b) => ['--px', '--py', '--ry', '--rx'].forEach((v) => b.style.removeProperty(v))));
    }
  }

  // ---------- Vitrine: tocar na sacola sacode ----------
  document.addEventListener('karen:vitrine', () => {
    document.querySelectorAll('.card-art').forEach((art) => {
      const bag = art.querySelector('.paperbag');
      if (!bag) return;
      preparar(bag);
      inclinar(art, bag);
      if (art.dataset.encanto) return;
      art.dataset.encanto = '1';
      art.addEventListener('click', () => { if (!art.disabled) sacudir(bag, art); });
    });
  });

  // ---------- Pedido: prévia da sacola escolhida ----------
  const formCard = document.querySelector('.form-card');
  const paletas = ['plum', 'rose', 'cream'];
  const arte = (cor) => '<div class="paperbag paperbag--' + cor + '"><span class="paperbag__handle"></span><span class="paperbag__side"></span>' +
    '<span class="paperbag__front"><span class="paperbag__motif">✦</span><span class="paperbag__monogram">KC</span>' +
    '<span class="paperbag__name">Karen</span><span class="paperbag__type">COSMÉTICOS</span><span class="paperbag__line"></span>' +
    '<span class="paperbag__glint">✧</span></span></div>';
  let previa = null;
  if (formCard) {
    previa = document.createElement('div');
    previa.className = 'escolhida vazia';
    previa.innerHTML = '<div class="escolhida__arte">' + arte('cream') + '</div>' +
      '<div class="escolhida__texto"><span class="escolhida__rotulo">Sua sacola</span>' +
      '<strong class="escolhida__titulo">Escolha uma sacola abaixo</strong><span class="escolhida__preco"></span></div>';
    formCard.insertBefore(previa, formCard.firstChild);
    preparar(previa.querySelector('.paperbag'));
  }
  document.addEventListener('karen:escolha', (e) => {
    if (!previa) return;
    const s = e.detail;
    previa.classList.toggle('vazia', !s);
    previa.querySelector('.escolhida__titulo').textContent = s ? s.titulo : 'Escolha uma sacola abaixo';
    previa.querySelector('.escolhida__preco').textContent = s ? s.preco : '';
    const cor = s ? paletas[s.indice % paletas.length] : 'cream';
    const antiga = previa.querySelector('.paperbag');
    if (!antiga.classList.contains('paperbag--' + cor)) {
      antiga.outerHTML = arte(cor);
      preparar(previa.querySelector('.paperbag'));
    }
    if (s) {
      const bag = previa.querySelector('.paperbag');
      previa.classList.remove('chegou'); void previa.offsetWidth; previa.classList.add('chegou');
      setTimeout(() => sacudir(bag, null), calmo ? 0 : 380);
    }
  });

  // ---------- Pedido enviado: a sacola se abre ----------
  function confete(dentro) {
    if (calmo) return;
    const cores = ['#733d59', '#d798a7', '#e8d5b7', '#e9c58f', '#ffffff'];
    const box = document.createElement('div');
    box.className = 'karen-confete';
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.cssText = `left:${Math.random() * 100}%;background:${cores[i % cores.length]};` +
        `--d:${(1.6 + Math.random() * 1.6).toFixed(2)}s;--atraso:${(Math.random() * 0.5).toFixed(2)}s;` +
        `--x:${(Math.random() * 160 - 80).toFixed(0)}px;--giro:${(Math.random() * 720 - 360).toFixed(0)}deg;` +
        `width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;border-radius:${i % 4 ? '2px' : '50%'}`;
      box.appendChild(c);
    }
    (dentro || document.body).appendChild(box); // dentro do diálogo fica acima do fundo escuro
    setTimeout(() => box.remove(), 3800);
  }
  document.addEventListener('karen:pedido-ok', (e) => {
    const { nome, sacola, waUrl } = e.detail || {};
    const d = document.createElement('dialog');
    d.className = 'karen-festa';
    const primeiro = String(nome || '').split(' ')[0];
    d.innerHTML = '<div class="karen-festa__arte">' + arte('plum') + '</div>' +
      '<h2>Pedido enviado' + (primeiro ? ', ' + primeiro.replace(/[<>&"]/g, '') : '') + '!</h2>' +
      '<p>A Karen recebeu sua escolha da <b></b> e vai te chamar no WhatsApp para combinar pagamento e entrega.</p>' +
      '<div class="karen-festa__acoes">' +
      (waUrl ? '<a class="btn" target="_blank" rel="noopener">Falar com a Karen no WhatsApp</a>' : '') +
      '<button type="button" class="btn secondary" data-fechar>Fechar</button></div>';
    d.querySelector('p b').textContent = sacola || 'sacola';
    if (waUrl) d.querySelector('a').href = waUrl;
    document.body.appendChild(d);
    preparar(d.querySelector('.paperbag'));
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-fechar]').addEventListener('click', () => d.close());
    d.addEventListener('click', (ev) => { if (ev.target === d) d.close(); });
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    som('bag');
    setTimeout(() => { d.classList.add('aberta'); confete(d); }, calmo ? 0 : 250);
  });
})();
