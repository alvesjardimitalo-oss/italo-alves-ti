/* Apresentação visual original do Alvesinho: sem vídeo externo, rastreamento ou áudio. */
(() => {
  const root = document.querySelector('[data-alves-apresentacao]');
  if (!root) return;
  const slides = [
    {category:'DESEMPENHO', title:'Seu computador está muito lento?',summary:'Demora para iniciar e os programas ficam travando?',tip:'Um SSD ou mais memória podem ajudar. Antes de comprar peças, é importante descobrir a causa.',url:'dicas/computador-lento.html',visual:'<div class="ani-visual ani-lento"><div class="ani-window"><div class="ani-dots"><i></i><i></i><i></i></div><div class="ani-progress"><i></i></div><span>Iniciando...</span></div></div>'},
    {category:'TEMPERATURA',title:'Notebook esquentando demais?',summary:'Ventoinha barulhenta ou desligamentos inesperados?',tip:'Evite bloquear as saídas de ar. Se o aquecimento persistir, uma revisão interna pode ser necessária.',url:'dicas/notebook-esquentando.html',visual:'<div class="ani-visual ani-calor"><div class="ani-fan"><span>✣</span></div><div class="ani-thermo"><i></i></div></div>'},
    {category:'IMAGEM',title:'O computador liga, mas não dá vídeo?',summary:'Luzes acendem e você só vê uma tela preta?',tip:'Confira primeiro conexões externas, quando existirem. O defeito pode estar na tela, memória ou placa.',url:'dicas/notebook-liga-sem-imagem.html',visual:'<div class="ani-visual ani-video"><div class="ani-monitor"><div class="ani-screen"><span>SEM SINAL</span></div><i></i></div></div>'}
  ];
  const el = (selector) => root.querySelector(selector);
  const buttons = [...document.querySelectorAll('[data-alves-slide]')];
  const tips = [...document.querySelectorAll('[data-alves-escolher]')];
  const pause = el('[data-alves-pausar]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let paused = reduceMotion.matches;
  let timer = null;
  function stop(){ if (timer) {clearInterval(timer);timer=null;} }
  function render(index) {
    current = (index + slides.length) % slides.length;
    const slide=slides[current];
    el('[data-alves-categoria]').textContent=slide.category;
    el('[data-alves-titulo]').textContent=slide.title;
    el('[data-alves-resumo]').textContent=slide.summary;
    el('[data-alves-dica]').textContent=slide.tip;
    el('[data-alves-contador]').textContent=String(current+1).padStart(2,'0')+' / 03';
    el('[data-alves-visual]').innerHTML=slide.visual;
    el('[data-alves-saiba]').setAttribute('href',slide.url);
    buttons.forEach((b,i)=>{b.classList.toggle('is-active',i===current);if(i===current)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');});
    tips.forEach((b,i)=>{b.classList.toggle('is-selected',i===current);b.setAttribute('aria-pressed',String(i===current));});
  }
  function updatePause(){pause.innerHTML=paused?'▶ <span>Reproduzir</span>':'Ⅱ <span>Pausar</span>';pause.setAttribute('aria-label',paused?'Reproduzir animação':'Pausar animação');pause.setAttribute('aria-pressed',String(paused));}
  function schedule(){stop();if(!paused && !document.hidden)timer=setInterval(()=>render(current+1),8500);}
  function choose(index){render(index);schedule();}
  el('[data-alves-anterior]').addEventListener('click',()=>choose(current-1));
  el('[data-alves-proximo]').addEventListener('click',()=>choose(current+1));
  buttons.forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.alvesSlide))));
  tips.forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.alvesEscolher))));
  pause.addEventListener('click',()=>{paused=!paused;updatePause();schedule();});
  document.addEventListener('visibilitychange',schedule);
  root.addEventListener('mouseenter',stop);
  root.addEventListener('mouseleave',schedule);
  root.addEventListener('focusin',stop);
  root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))schedule();});
  render(0);updatePause();schedule();
})();
