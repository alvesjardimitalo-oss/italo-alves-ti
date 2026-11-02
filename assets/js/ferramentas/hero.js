// Preenche o painel do topo da página inicial com dados REAIS do aparelho do visitante.
import { ambiente, ramTexto } from './comum.js';

ambiente().then((a) => {
  const set = (k, v, cls) => {
    const el = document.querySelector(`[data-hc="${k}"]`);
    if (!el) return;
    el.textContent = v;
    if (cls) el.className = cls;
  };
  const win10 = a.so === 'Windows' && a.soVersao === '10';
  set('so', a.soTexto, win10 ? 'warn' : 'ok');
  set('nav', a.navegador, 'ok');
  set('cpu', a.nucleos ? `${a.nucleos} núcleos (threads)` : 'não informado', a.nucleos && a.nucleos <= 2 ? 'warn' : 'ok');
  set('ram', ramTexto(a.ramGB), a.ramGB && a.ramGB <= 4 ? 'warn' : 'ok');
  set('tela', a.tela, 'ok');
});
