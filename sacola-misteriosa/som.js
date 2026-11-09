/* Karen Cosméticos — identidade sonora original, sintetizada localmente.
   Sem arquivos de áudio, downloads ou música de terceiros. Opt-in por padrão. */
(() => {
  'use strict';
  const STORE = 'karen-sacolas-som-v1';
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const wrap = document.querySelector('header .wrap');
  const nav = wrap?.querySelector('nav');
  if (!wrap || !nav || !AudioEngine) return;

  let enabled = false;
  try { enabled = localStorage.getItem(STORE) === 'ligado'; } catch {}
  if (!enabled) try { enabled = sessionStorage.getItem(STORE) === 'ligado'; } catch {}
  if (!enabled) {
    try { enabled = document.cookie.split('; ').includes(STORE + '=ligado'); } catch {}
  }
  let ctx, master, timer, nextTime = 0, index = 0;
  let active = false;
  const beat = 60 / 98;
  const stepLength = beat / 2;
  const progressions = [
    { chord: [53, 57, 60, 64], bass: 41, melody: [72, 76, 79, 76, 72, 69, 72, 76] },
    { chord: [57, 60, 64, 69], bass: 45, melody: [76, 79, 81, 79, 76, 72, 69, 72] },
    { chord: [60, 64, 67, 71], bass: 48, melody: [79, 76, 72, 76, 79, 81, 79, 76] },
    { chord: [55, 59, 62, 67], bass: 43, melody: [74, 79, 81, 79, 74, 71, 74, 79] }
  ];
  const midi = (n) => 440 * 2 ** ((n - 69) / 12);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  button.innerHTML = '<span class="sound-toggle-icon" aria-hidden="true">♫</span><span class="sound-toggle-label"></span>';
  button.title = 'Trilha ambiente original e sons suaves de navegação. Você controla o áudio.';
  wrap.insertBefore(button, nav);

  function sync() {
    button.classList.toggle('is-on', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Desligar sons e trilha ambiente' : 'Ligar sons e trilha ambiente');
    button.querySelector('.sound-toggle-label').textContent = enabled ? 'Som ligado' : 'Ativar som';
  }
  function setup() {
    if (ctx) return;
    ctx = new AudioEngine();
    master = ctx.createGain();
    master.gain.value = 0.32;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.3;
    master.connect(filter);
    filter.connect(ctx.destination);
  }
  function tone(note, at, duration, vol = 0.07, waveform = 'sine') {
    if (!ctx || !master) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(midi(note), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.024);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function play(type = 'tap') {
    if (!enabled || document.hidden) return;
    setup();
    // Acionar somente após interação do visitante, conforme política dos navegadores.
    ctx.resume().catch(() => {});
    const at = ctx.currentTime + 0.008;
    if (type === 'surprise') {
      tone(76, at, 0.21, 0.105, 'sine');
      tone(79, at + 0.08, 0.28, 0.09, 'sine');
      tone(84, at + 0.17, 0.35, 0.075, 'triangle');
    } else if (type === 'navigate') {
      tone(72, at, 0.13, 0.072, 'sine');
      tone(79, at + 0.065, 0.21, 0.065, 'sine');
    } else {
      tone(79, at, 0.15, 0.045, 'sine');
    }
  }
  function scheduleStep(at, n) {
    const bar = Math.floor(n / 8) % progressions.length;
    const step = n % 8;
    const pattern = progressions[bar];
    if (step === 0) {
      // Acordes aveludados, sem batidas invasivas.
      pattern.chord.forEach((key) => tone(key, at, stepLength * 7.6, 0.013, 'sine'));
      tone(pattern.bass, at, 0.40, 0.07, 'sine');
    }
    if (step === 4) tone(pattern.bass + 7, at, 0.28, 0.04, 'sine');
    if ([0, 2, 3, 5, 6].includes(step)) {
      tone(pattern.melody[step], at + 0.03, stepLength * 0.68, 0.037, 'triangle');
    }
  }
  function scheduler() {
    if (!enabled || !active || !ctx || ctx.state !== 'running' || document.hidden) return;
    while (nextTime < ctx.currentTime + 0.22) {
      scheduleStep(nextTime, index);
      index = (index + 1) % 32;
      nextTime += stepLength;
    }
  }
  function start() {
    if (!enabled || document.hidden) return;
    setup();
    const attempt = ctx.resume();
    Promise.resolve(attempt).then(() => {
      if (!enabled || document.hidden || ctx.state !== 'running' || active) return;
      active = true;
      index = 0;
      nextTime = ctx.currentTime + 0.06;
      scheduler();
      timer = window.setInterval(scheduler, 110);
    }).catch(() => {});
  }
  function stop() {
    active = false;
    window.clearInterval(timer);
    timer = undefined;
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }
  function persist() {
    const state = enabled ? 'ligado' : 'desligado';
    try { localStorage.setItem(STORE, state); } catch {}
    try { sessionStorage.setItem(STORE, state); } catch {}
    try {
      document.cookie = STORE + '=' + state + '; path=/sacola-misteriosa; max-age=2592000; SameSite=Lax; Secure';
    } catch {}
  }
  button.addEventListener('click', () => {
    enabled = !enabled;
    persist();
    sync();
    if (enabled) {
      start();
      play('surprise');
    } else stop();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (enabled) start();
  });
  document.addEventListener('pointerdown', () => {
    // A configuração pode persistir, mas o navegador exige uma nova interação.
    if (enabled && !active) start();
  }, { capture: true });
  document.addEventListener('keydown', (event) => {
    if (enabled && !active && (event.key === 'Enter' || event.key === ' ')) start();
  }, { capture: true });
  document.addEventListener('click', (event) => {
    if (!enabled || event.defaultPrevented) return;
    const a = event.target.closest('a[href]');
    if (a) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
      const destination = new URL(a.href, location.href);
      if (destination.origin !== location.origin || !destination.pathname.startsWith('/sacola-misteriosa/')) return;
      if (destination.href === location.href) return;
      event.preventDefault();
      play('navigate');
      window.setTimeout(() => { location.assign(destination.href); }, 145);
      return;
    }
    if (event.target.closest('.card-art, .card .btn')) { play('surprise'); return; }
    if (event.target.closest('summary, select')) play('tap');
  }, { capture: true });
  window.KarenSound = { isEnabled: () => enabled, play };
  sync();
  // Se houve consentimento numa página anterior, retoma somente quando permitido.
  if (enabled) start();
})();
