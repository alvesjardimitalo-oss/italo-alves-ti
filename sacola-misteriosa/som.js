/* Karen Cosméticos — atmosfera original: lounge moderno / beleza premium.
   Sem melodia aguda repetitiva. Áudio sempre opcional e desligado por padrão. */
(() => {
  'use strict';
  const STORE = 'karen-sacolas-som-v2';
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const wrap = document.querySelector('header .wrap');
  const nav = wrap?.querySelector('nav');
  if (!wrap || !nav || !AudioEngine) return;

  let enabled = false;
  try { enabled = localStorage.getItem(STORE) === 'ligado'; } catch {}
  if (!enabled) try { enabled = sessionStorage.getItem(STORE) === 'ligado'; } catch {}
  // A versão anterior do áudio foi descartada. Não herdar sua preferência.
  let ctx, master, noiseBuffer, timer, active = false;
  let step = 0, nextTime = 0;
  const BPM = 88;
  const BEAT = 60 / BPM;
  const STEP = BEAT / 2;
  // Progressão original com acordes de jazz/soul, sem melodia em primeiro plano.
  const bars = [
    {bass: 38, chord:[53,57,60,64]}, // Dm9
    {bass: 34, chord:[50,53,57,60]}, // Bbmaj7
    {bass: 41, chord:[53,57,60,64]}, // Fmaj9
    {bass: 36, chord:[52,55,59,62]}  // Cmaj9
  ];
  const hz = (n) => 440 * (2 ** ((n-69)/12));

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  button.title = 'Ativar ou desligar a trilha lounge suave e os sons discretos da página';
  button.innerHTML = '<span class="sound-toggle-icon" aria-hidden="true">♫</span><span class="sound-toggle-label"></span>';
  wrap.insertBefore(button, nav);

  function sync() {
    button.classList.toggle('is-on', enabled);
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Desligar trilha ambiente' : 'Ligar trilha ambiente');
    button.querySelector('.sound-toggle-label').textContent = enabled ? 'Som ligado' : 'Ativar som';
  }
  function setup() {
    if (ctx) return;
    ctx = new AudioEngine();
    master = ctx.createGain();
    master.gain.value = 0.19;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 2;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    const length = Math.round(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i=0;i<length;i++) samples[i]=Math.random()*2-1;
  }
  function envelope(g, t, attack, hold, release, peak) {
    const q = Math.max(0.0001, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(q, t+attack);
    g.gain.setValueAtTime(q, t+attack+hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t+attack+hold+release);
  }
  function synth(frequency, time, duration, peak, kind='sine', cutoff=0, detune=0) {
    if (!ctx) return;
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type=kind;
    osc.frequency.setValueAtTime(frequency,time);
    osc.detune.value=detune;
    const attack=kind==='sawtooth'?0.22:0.012;
    const release=kind==='sawtooth'?0.4:0.1;
    envelope(gain,time,attack,Math.max(0,duration-attack-release),release,peak);
    if(cutoff) {
      const f=ctx.createBiquadFilter();
      f.type='lowpass';
      f.frequency.value=cutoff;
      f.Q.value=0.4;
      osc.connect(f);f.connect(gain);
      osc.onended=()=>{osc.disconnect();f.disconnect();gain.disconnect();};
    } else {
      osc.connect(gain);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
    gain.connect(master);
    osc.start(time);
    osc.stop(time+duration+0.08);
  }
  function pad(chord,time) {
    // Camada aveludada e discreta: sem sininhos, sem arpejos.
    chord.forEach((n,i)=>{
      synth(hz(n),time,BEAT*3.9,0.022,'sawtooth',360+(i*22),-3);
      synth(hz(n),time,BEAT*3.9,0.016,'sine',0,3);
    });
  }
  function kick(time, volume=0.13) {
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(130,time);
    osc.frequency.exponentialRampToValueAtTime(49,time+0.15);
    g.gain.setValueAtTime(0.0001,time);
    g.gain.linearRampToValueAtTime(volume,time+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,time+0.24);
    osc.connect(g);g.connect(master);
    osc.start(time);osc.stop(time+0.26);
    osc.onended=()=>{osc.disconnect();g.disconnect();};
  }
  function noise(time, seconds, level, cutoff, mode='highpass') {
    if(!noiseBuffer) return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=noiseBuffer;
    filter.type=mode;filter.frequency.value=cutoff;
    envelope(gain,time,0.004,0.001,Math.max(0.01,seconds-0.005),level);
    source.connect(filter);filter.connect(gain);gain.connect(master);
    source.start(time);source.stop(time+seconds+0.01);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  function bass(note,time,volume=0.05) {
    synth(hz(note),time,BEAT*0.72,volume,'sine');
  }
  function schedule(t,n) {
    const bar=bars[Math.floor(n/8)%bars.length], pos=n%8;
    if(pos===0) {
      pad(bar.chord,t);
      kick(t,0.13);
      bass(bar.bass,t,0.075);
    }
    if(pos===4) {
      kick(t,0.11);
      bass(bar.bass+7,t,0.052);
    }
    // Pulso eletrônico macio, aveludado. Sem melodia étnica ou aguda.
    if(pos===2 || pos===6) noise(t,0.09,0.018,1300,'highpass');
    if(pos===3 || pos===7) noise(t,0.038,0.008,6000);
  }
  function tick() {
    if(!enabled||!active||!ctx||ctx.state!=='running'||document.hidden) return;
    while(nextTime<ctx.currentTime+0.21) {
      schedule(nextTime,step);
      step=(step+1)%32;
      nextTime+=STEP;
    }
  }
  function clickSound(type='tap') {
    if(!enabled||document.hidden) return;
    setup();
    const t=ctx.currentTime+0.009;
    // Cliques curtos de UI, sem sinos/palhetadas ou sequências de notas.
    synth(type==='bag'?260:235,t,type==='bag'?0.10:0.07,type==='bag'?0.055:0.035,'sine');
    if(type==='bag') noise(t+0.03,0.11,0.025,1800);
  }
  function start() {
    if(!enabled||document.hidden) return;
    setup();
    Promise.resolve(ctx.resume()).then(()=>{
      if(!enabled||document.hidden||ctx.state!=='running'||active) return;
      active=true; step=0; nextTime=ctx.currentTime+0.04;
      tick();
      timer=setInterval(tick,120);
    }).catch(()=>{});
  }
  function stop() {
    active=false;
    clearInterval(timer);
    timer=undefined;
    if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{});
  }
  function persist() {
    const state=enabled?'ligado':'desligado';
    try{localStorage.setItem(STORE,state);}catch{}
    try{sessionStorage.setItem(STORE,state);}catch{}
  }
  button.addEventListener('click',()=>{
    enabled=!enabled;
    persist();
    sync();
    if(enabled){start();clickSound('tap');}
    else stop();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stop();else if(enabled)start();
  });
  document.addEventListener('pointerdown',()=>{if(enabled&&!active)start();},{capture:true});
  document.addEventListener('keydown',(e)=>{
    if(enabled&&!active&&(e.key==='Enter'||e.key===' '))start();
  },{capture:true});
  document.addEventListener('click',(e)=>{
    if(!enabled||e.defaultPrevented)return;
    const a=e.target.closest('a[href]');
    if(a){
      if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
      const url=new URL(a.href,location.href);
      if(url.origin!==location.origin||!url.pathname.startsWith('/sacola-misteriosa/')||url.href===location.href)return;
      e.preventDefault();
      clickSound('tap');
      setTimeout(()=>{location.assign(url.href);},110);
      return;
    }
    if(e.target.closest('.card-art, .card .btn'))clickSound('bag');
    else if(e.target.closest('summary, select'))clickSound('tap');
  },{capture:true});
  window.KarenSound={isEnabled:()=>enabled,play:clickSound};
  sync();
  if(enabled)start();
})();
