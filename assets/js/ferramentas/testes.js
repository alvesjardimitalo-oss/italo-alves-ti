// Testes de teclado, tela, som, microfone e câmera — tudo local, nada é gravado nem enviado.
import { enviarAoTecnico } from './comum.js';

const app = document.getElementById('app-ferramenta');
const ABAS = [['teclado', 'Teclado'], ['tela', 'Tela (pixels)'], ['som', 'Alto-falantes'], ['mic', 'Microfone'], ['cam', 'Câmera']];
let atual = location.hash.replace('#', '') || 'teclado';
let parar = () => {};

// layout ABNT2 simplificado: [code, rótulo, largura]
const TECLADO = [
  [['Escape', 'Esc'], ['F1', 'F1'], ['F2', 'F2'], ['F3', 'F3'], ['F4', 'F4'], ['F5', 'F5'], ['F6', 'F6'], ['F7', 'F7'], ['F8', 'F8'], ['F9', 'F9'], ['F10', 'F10'], ['F11', 'F11'], ['F12', 'F12'], ['Delete', 'Del']],
  [['Backquote', "'"], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '='], ['Backspace', '⌫', 2]],
  [['Tab', 'Tab', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '´'], ['BracketRight', '['], ['Enter', 'Enter', 1.5]],
  [['CapsLock', 'Caps', 1.8], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', 'Ç'], ['Quote', '~'], ['Backslash', ']']],
  [['ShiftLeft', 'Shift', 1.4], ['IntlBackslash', '\\'], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', ';'], ['IntlRo', '/'], ['ShiftRight', 'Shift', 1.8]],
  [['ControlLeft', 'Ctrl', 1.3], ['MetaLeft', 'Win'], ['AltLeft', 'Alt'], ['Space', 'Espaço', 6], ['AltRight', 'AltGr'], ['ContextMenu', 'Menu'], ['ControlRight', 'Ctrl', 1.3], ['ArrowLeft', '←'], ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowRight', '→']],
];

function abas() {
  return `<div class="abas">${ABAS.map(([k, t]) => `<button class="aba ${atual === k ? 'ativo' : ''}" data-a="${k}">${t}</button>`).join('')}</div><div id="painel"></div>`;
}

function render() {
  parar();
  parar = () => {};
  app.innerHTML = abas();
  app.querySelectorAll('.aba').forEach((b) => b.onclick = () => { atual = b.dataset.a; history.replaceState(null, '', '#' + atual); render(); });
  ({ teclado, tela, som, mic, cam })[atual]();
}

const painel = () => app.querySelector('#painel');
const rodapeAjuda = (servico, problema) => `<div class="ferr-nav"><span class="sub">Encontrou defeito?</span><button class="btn btn-pri" data-ajuda>Pedir orçamento</button></div>`;
function ligarAjuda(servico, problema, detalhe) {
  painel().querySelector('[data-ajuda]')?.addEventListener('click', () => enviarAoTecnico({ servico, problema, detalhe: typeof detalhe === 'function' ? detalhe() : detalhe }));
}

function teclado() {
  const testadas = new Set();
  painel().innerHTML = `<div class="card"><h2>Teste de teclado</h2><p class="sub" style="margin-top:-6px">Pressione cada tecla. A tecla acende enquanto está pressionada e fica verde depois de testada. Teclas que não acendem podem estar com defeito.</p>
    <div class="teclado">${TECLADO.map((l) => `<div class="linha">${l.map(([c, t, w]) => `<div class="tecla" data-c="${c}" style="flex:${w || 1}">${t}</div>`).join('')}</div>`).join('')}</div>
    <p style="margin:14px 0 0"><b id="cont">0</b> tecla(s) testada(s) · última: <span class="mono" id="ultima">—</span> <button class="btn btn-sm" id="zerar" style="margin-left:8px">Zerar</button></p>
    ${rodapeAjuda()}</div>`;
  const down = (e) => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return; // não atrapalha o "Fale comigo"
    if (e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
    const el = painel()?.querySelector(`[data-c="${e.code}"]`);
    testadas.add(e.code);
    if (el) el.classList.add('on', 'foi');
    painel().querySelector('#cont').textContent = testadas.size;
    painel().querySelector('#ultima').textContent = `${e.key} (${e.code})`;
  };
  const up = (e) => painel()?.querySelector(`[data-c="${e.code}"]`)?.classList.remove('on');
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  painel().querySelector('#zerar').onclick = () => { testadas.clear(); painel().querySelectorAll('.tecla').forEach((t) => t.classList.remove('foi')); painel().querySelector('#cont').textContent = '0'; };
  parar = () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  ligarAjuda('Conserto / orçamento', 'Teclado ou touchpad', () => {
    const faltam = [...painel().querySelectorAll('.tecla:not(.foi)')].map((t) => t.textContent);
    return `TESTE DE TECLADO — ${testadas.size} teclas responderam. Não testadas/sem resposta: ${faltam.join(' ')}`;
  });
}

function tela() {
  const CORES = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', 'linear-gradient(90deg,#000,#fff)', '#808080'];
  painel().innerHTML = `<div class="card"><h2>Teste de tela</h2><p class="sub" style="margin-top:-6px">A tela fica toda de uma cor. Procure pontos que não mudam (pixel morto ou travado), manchas e listras. Clique ou toque para trocar a cor. <b>Esc</b> para sair.</p>
    <button class="btn btn-pri" id="iniciar">Iniciar teste em tela cheia</button>${rodapeAjuda()}</div>`;
  painel().querySelector('#iniciar').onclick = async () => {
    let i = 0;
    const div = document.createElement('div');
    div.className = 'tela-cheia';
    div.innerHTML = '<span class="dica-tela">clique para trocar a cor · Esc para sair</span>';
    const pinta = () => { div.style.background = CORES[i]; };
    pinta();
    document.body.appendChild(div);
    try { await div.requestFullscreen?.(); } catch (e) { /* segue sem tela cheia */ }
    setTimeout(() => div.querySelector('.dica-tela')?.remove(), 2500);
    const sair = () => { div.remove(); document.removeEventListener('keydown', tecla); if (document.fullscreenElement) document.exitFullscreen(); };
    const tecla = (e) => { if (e.key === 'Escape') sair(); if (e.key === 'ArrowRight' || e.key === ' ') { i = (i + 1) % CORES.length; pinta(); } };
    div.onclick = () => { i++; if (i >= CORES.length) sair(); else pinta(); };
    document.addEventListener('keydown', tecla);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && div.isConnected) sair(); }, { once: true });
  };
  ligarAjuda('Conserto / orçamento', 'Tela / imagem', 'TESTE DE TELA — cliente encontrou defeito na tela (pixel, mancha ou listra).');
}

function som() {
  let ctx = null;
  painel().innerHTML = `<div class="card"><h2>Teste dos alto-falantes</h2><p class="sub" style="margin-top:-6px">Use um volume confortável. Cada botão toca um tom curto. Se o som sair do lado errado ou não sair, há problema no alto-falante, no fone ou no driver.</p>
    <div class="opcoes-grandes"><button class="opc" data-p="-1">◀ Esquerdo</button><button class="opc" data-p="0">Os dois</button><button class="opc" data-p="1">Direito ▶</button><button class="opc" data-v="1">Varredura grave → agudo<small>chiados indicam alto-falante danificado</small></button></div>${rodapeAjuda()}</div>`;
  const tocar = (pan, varredura) => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = 'sine';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(varredura ? 60 : 440, t);
    if (varredura) o.frequency.exponentialRampToValueAtTime(12000, t + 4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (varredura ? 4 : 1.2));
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(ctx.destination); } else o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + (varredura ? 4.1 : 1.3));
  };
  painel().querySelectorAll('[data-p]').forEach((b) => b.onclick = () => tocar(+b.dataset.p, false));
  painel().querySelector('[data-v]').onclick = () => tocar(0, true);
  parar = () => { ctx?.close(); };
  ligarAjuda('Conserto / orçamento', 'Outro', 'TESTE DE SOM — cliente encontrou problema nos alto-falantes/áudio.');
}

function mic() {
  let stream = null; let raf = 0; let ctx = null;
  painel().innerHTML = `<div class="card"><h2>Teste do microfone</h2><p class="sub" style="margin-top:-6px">O navegador vai pedir permissão. Fale normalmente: a barra deve se mexer. Nada é gravado.</p>
    <button class="btn btn-pri" id="ligar">Ligar microfone</button>
    <div class="nivel-mic" style="margin-top:16px"><span id="barra"></span></div><p class="sub" id="info" style="margin-top:8px"></p>${rodapeAjuda()}</div>`;
  painel().querySelector('#ligar').onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const dados = new Uint8Array(an.fftSize);
      painel().querySelector('#info').textContent = 'Microfone: ' + (stream.getAudioTracks()[0]?.label || 'padrão');
      const loop = () => {
        an.getByteTimeDomainData(dados);
        let pico = 0;
        for (const v of dados) pico = Math.max(pico, Math.abs(v - 128));
        const b = painel()?.querySelector('#barra');
        if (b) b.style.width = Math.min(100, (pico / 128) * 160) + '%';
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) {
      painel().querySelector('#info').textContent = 'Sem acesso ao microfone: permissão negada ou nenhum microfone encontrado.';
    }
  };
  parar = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
  ligarAjuda('Conserto / orçamento', 'Outro', 'TESTE DE MICROFONE — cliente encontrou problema no microfone.');
}

function cam() {
  let stream = null;
  painel().innerHTML = `<div class="card"><h2>Teste da câmera</h2><p class="sub" style="margin-top:-6px">O navegador vai pedir permissão. A imagem aparece só aqui, em espelho, e não é gravada.</p>
    <button class="btn btn-pri" id="ligar">Ligar câmera</button><div style="margin-top:14px"><video class="cam" id="video" autoplay playsinline muted hidden></video></div>
    <p class="sub" id="info"></p>${rodapeAjuda()}</div>`;
  painel().querySelector('#ligar').onclick = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const v = painel().querySelector('#video');
      v.srcObject = stream;
      v.hidden = false;
      const s = stream.getVideoTracks()[0];
      const st = s.getSettings ? s.getSettings() : {};
      painel().querySelector('#info').textContent = `${s.label || 'Câmera'}${st.width ? ` · ${st.width}×${st.height}` : ''}`;
    } catch (e) {
      painel().querySelector('#info').textContent = 'Sem acesso à câmera: permissão negada, câmera desativada (alguns notebooks têm tecla ou tampa) ou ausente.';
    }
  };
  parar = () => { stream?.getTracks().forEach((t) => t.stop()); };
  ligarAjuda('Conserto / orçamento', 'Outro', 'TESTE DE CÂMERA — cliente encontrou problema na câmera.');
}

window.addEventListener('pagehide', () => parar());
render();
