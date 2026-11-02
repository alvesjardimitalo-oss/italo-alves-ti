// Leitura do aparelho pelo navegador (só o que o navegador permite) + utilitários das ferramentas.
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function navegador(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Navegador';
}

function gpu() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(r || '').replace(/^ANGLE \(|\)$/g, '').replace(/Direct3D.*$/i, '').replace(/\s*\(0x[0-9A-F]+\)/ig, '').replace(/,\s*$/, '').trim();
  } catch (e) { return ''; }
}

/** Retorna os dados do aparelho. Campos que o navegador não informa ficam vazios. */
export async function ambiente() {
  const ua = navigator.userAgent;
  let so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Desconhecido';
  let soVersao = '';
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      const h = await navigator.userAgentData.getHighEntropyValues(['platformVersion', 'architecture', 'bitness', 'model']);
      if (so === 'Windows' && h.platformVersion) {
        const maior = parseInt(h.platformVersion.split('.')[0], 10);
        soVersao = maior >= 13 ? '11' : maior > 0 ? '10' : '7/8';
      }
      if (so === 'Android' && h.platformVersion) soVersao = h.platformVersion.split('.')[0];
    }
  } catch (e) { /* sem dados extras */ }
  if (so === 'Windows' && !soVersao && /Windows NT 10/.test(ua)) soVersao = '10 ou 11';
  if (so === 'Windows' && /Windows NT 6\./.test(ua)) soVersao = '7/8';
  const movel = /Android|iPhone|iPad|Mobile/.test(ua);
  let armazenamento = '';
  try { const est = await navigator.storage?.estimate?.(); if (est?.quota) armazenamento = (est.quota / 1e9).toFixed(0) + ' GB livres p/ o navegador (aprox.)'; } catch (e) { /* ignora */ }
  let bateria = null;
  try { if (navigator.getBattery) { const b = await navigator.getBattery(); bateria = { nivel: Math.round(b.level * 100), carregando: b.charging }; } } catch (e) { /* ignora */ }
  const con = navigator.connection || {};
  return {
    so, soVersao, soTexto: so + (soVersao ? ' ' + soVersao : ''),
    navegador: navegador(ua),
    movel,
    nucleos: navigator.hardwareConcurrency || 0,
    ramGB: navigator.deviceMemory || 0, // Chrome/Edge informam até 8 (8 = "8 GB ou mais")
    gpu: gpu(),
    tela: `${screen.width}×${screen.height}` + (devicePixelRatio > 1 ? ` (escala ${Math.round(devicePixelRatio * 100)}%)` : ''),
    toque: navigator.maxTouchPoints > 0,
    conexao: con.effectiveType ? `${con.effectiveType.toUpperCase()}${con.downlink ? ' · ~' + con.downlink + ' Mbps' : ''}` : '',
    armazenamento,
    bateria,
  };
}

export const ramTexto = (gb) => (!gb ? 'não informado pelo navegador' : gb >= 8 ? '8 GB ou mais' : `~${gb} GB`);

/** Abre o "Fale comigo" já com o resultado da ferramenta anexado. */
export function enviarAoTecnico(dados) {
  if (window.FaleComigo) window.FaleComigo.abrir(dados);
  else location.hash = 'fale-comigo';
}

export async function copiar(texto, botao) {
  try {
    await navigator.clipboard.writeText(texto);
    if (botao) { const t = botao.textContent; botao.textContent = 'Copiado!'; setTimeout(() => { botao.textContent = t; }, 1600); }
  } catch (e) { prompt('Copie o texto:', texto); }
}
