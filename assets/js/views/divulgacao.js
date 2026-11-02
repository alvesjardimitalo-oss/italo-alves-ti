import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, toast, whatsapp, lerForm, norm, vazio } from '../util.js';
import { empresa, clientesOrdenados } from '../negocio.js';
import { qrSvg } from '../../vendor/qrcode.js';

const ORIGENS = [
  ['instagram', 'Instagram (link da bio)'], ['whatsapp-status', 'Status do WhatsApp'], ['google-perfil', 'Perfil da Empresa no Google'],
  ['facebook', 'Facebook'], ['cartao', 'Cartão de visita (impresso)'], ['panfleto', 'Panfleto / cartaz'], ['adesivo', 'Adesivo no equipamento consertado'],
];

const siteBase = () => location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
const linkCampanha = (origem, pagina = '') => `${siteBase()}${pagina}?utm_source=${encodeURIComponent(origem)}`;
const nomeRef = (nome) => (nome || '').trim().split(/\s+/).slice(0, 2).join(' ');
const linkIndicacao = (nome) => `${siteBase()}?ref=${encodeURIComponent(nomeRef(nome))}`;

function baixarSvg(svg, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  a.download = nome + '.svg';
  a.click();
}

export function tela(el) {
  const emp = empresa();
  const beneficio = store.config.indicacaoBeneficio || '';
  el.innerHTML = `
    <div class="page-head"><div><div class="crumb">${icon('globe', 14)} gestão</div><h1>Divulgação e indicação</h1>
      <p>Links com etiqueta de origem e QR Codes para saber de onde vêm os pedidos, e links de indicação para os seus clientes.</p></div>
      <a class="btn" href="./" target="_blank" rel="noopener">${icon('globe', 16)} Abrir o site</a></div>

    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h2>${icon('trend')} Links de campanha</h2></div>
        <p class="sub" style="margin-top:0">Use um link diferente em cada lugar. Os pedidos que chegam por ele aparecem com essa origem em <a href="#/leads">Pedidos do site</a>.</p>
        <div class="form">
          <div class="campo c6"><label>Onde vai divulgar</label><select id="origem">${ORIGENS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}<option value="__outro">Outro…</option></select></div>
          <div class="campo c6"><label>Página</label><select id="pagina">
            <option value="">Início</option><option value="ferramentas/checkup.html">Check-up grátis</option><option value="acompanhar.html">Acompanhar OS</option>
            <option value="suporte-remoto.html">Suporte remoto</option><option value="empresas.html">Empresas</option><option value="ferramentas/">Ferramentas</option></select></div>
          <div class="campo c12" id="outro-wrap" hidden><label>Nome da origem (sem espaços)</label><input id="outro" placeholder="ex.: radio-cidade, igreja, grupo-bairro"></div>
        </div>
        <div id="campanha" style="margin-top:14px"></div>
      </div>

      <div class="card">
        <div class="card-head"><h2>${icon('users')} Indique um amigo</h2></div>
        <p class="sub" style="margin-top:0">Cada cliente tem o próprio link. Quem pedir orçamento por ele aparece como <b>indicação</b> do cliente nos pedidos.</p>
        <form id="f-benef" class="form">
          <div class="campo c9"><label>Benefício para quem indica (opcional, sai na mensagem)</label><input name="indicacaoBeneficio" maxlength="120" value="${esc(beneficio)}" placeholder="ex.: 10% de desconto na próxima manutenção"></div>
          <div class="campo c3" style="display:flex;align-items:flex-end"><button class="btn" style="width:100%">Salvar</button></div>
        </form>
        <div class="campo" style="margin-top:12px"><label>Cliente</label><select id="cli"><option value="">Escolha o cliente…</option>${clientesOrdenados().map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
        <div id="indic" style="margin-top:14px"></div>
      </div>
    </div>

    <div class="grid g2" style="margin-top:18px">
      <div class="card flush"><div class="card-head"><h2>${icon('chat')} De onde vêm os pedidos</h2></div><div class="tabela-wrap" id="origens"></div></div>
      <div class="card flush"><div class="card-head"><h2>${icon('users')} Quem mais indica</h2></div><div class="tabela-wrap" id="ranking"></div></div>
    </div>`;

  const desenharCampanha = () => {
    let origem = el.querySelector('#origem').value;
    el.querySelector('#outro-wrap').hidden = origem !== '__outro';
    if (origem === '__outro') origem = norm(el.querySelector('#outro').value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'outro';
    const url = linkCampanha(origem, el.querySelector('#pagina').value);
    const svg = qrSvg(url, { tamanho: 180 });
    el.querySelector('#campanha').innerHTML = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="background:#fff;padding:6px;border-radius:10px;line-height:0">${svg}</div>
      <div style="flex:1;min-width:200px"><div class="texto-bloco mono" style="font-size:.8rem;word-break:break-all">${esc(url)}</div>
        <div class="acoes" style="justify-content:flex-start;margin-top:10px"><button class="btn btn-sm" data-copiar>${icon('copy', 15)} Copiar link</button><button class="btn btn-sm" data-qr>${icon('download', 15)} Baixar QR (SVG)</button></div>
        <p class="sub" style="margin:8px 0 0">O QR em SVG não perde qualidade: serve para cartão, panfleto e adesivo.</p></div></div>`;
    el.querySelector('[data-copiar]').onclick = () => navigator.clipboard.writeText(url).then(() => toast('Link copiado.'));
    el.querySelector('[data-qr]').onclick = () => baixarSvg(qrSvg(url, { tamanho: 1000 }), 'qr-' + origem);
  };
  ['#origem', '#pagina'].forEach((s) => el.querySelector(s).addEventListener('change', desenharCampanha));
  el.querySelector('#outro').addEventListener('input', desenharCampanha);
  desenharCampanha();

  el.querySelector('#f-benef').addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.salvarConfig(lerForm(e.target));
    toast('Benefício salvo.');
    desenharIndic();
  });
  const desenharIndic = () => {
    const c = store.get('clientes', el.querySelector('#cli').value);
    const box = el.querySelector('#indic');
    if (!c) { box.innerHTML = ''; return; }
    const url = linkIndicacao(c.nome);
    const b = store.config.indicacaoBeneficio;
    const msg = `Olá, ${c.nome.split(' ')[0]}! Obrigado pela confiança na ${emp.nome}. 🙌\nSe algum amigo ou parente precisar de manutenção no computador ou notebook, é só mandar este link para ele:\n${url}${b ? `\n\nQuem indica ganha: ${b}.` : ''}`;
    const wa = whatsapp(c.telefone, msg);
    box.innerHTML = `<div class="texto-bloco mono" style="font-size:.8rem;word-break:break-all">${esc(url)}</div>
      <div class="acoes" style="justify-content:flex-start;margin-top:10px">
        ${wa ? `<a class="btn btn-sm btn-ok" target="_blank" rel="noopener" href="${esc(wa)}">${icon('whatsapp', 15)} Enviar para ${esc(c.nome.split(' ')[0])}</a>` : '<span class="sub">Cliente sem telefone.</span>'}
        <button class="btn btn-sm" data-copiar-i>${icon('copy', 15)} Copiar link</button></div>`;
    box.querySelector('[data-copiar-i]').onclick = () => navigator.clipboard.writeText(url).then(() => toast('Link copiado.'));
  };
  el.querySelector('#cli').addEventListener('change', desenharIndic);

  const render = () => {
    const leads = store.lista('leads');
    const porOrigem = {};
    leads.forEach((l) => {
      const k = l.utm || (l.indicacao ? 'indicação' : 'direto / sem etiqueta');
      porOrigem[k] = porOrigem[k] || { n: 0, conv: 0 };
      porOrigem[k].n++;
      if (l.status === 'Virou cliente') porOrigem[k].conv++;
    });
    const linhasO = Object.entries(porOrigem).sort((a, b) => b[1].n - a[1].n);
    el.querySelector('#origens').innerHTML = linhasO.length ? `<table class="tabela"><thead><tr><th>Origem</th><th class="r">Pedidos</th><th class="r">Viraram cliente</th></tr></thead><tbody>
      ${linhasO.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${v.n}</td><td class="r num">${v.conv}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhum pedido ainda.', 'chat');
    const porInd = {};
    leads.filter((l) => l.indicacao).forEach((l) => {
      porInd[l.indicacao] = porInd[l.indicacao] || { n: 0, conv: 0 };
      porInd[l.indicacao].n++;
      if (l.status === 'Virou cliente') porInd[l.indicacao].conv++;
    });
    const linhasI = Object.entries(porInd).sort((a, b) => b[1].conv - a[1].conv || b[1].n - a[1].n);
    el.querySelector('#ranking').innerHTML = linhasI.length ? `<table class="tabela"><thead><tr><th>Cliente</th><th class="r">Indicações</th><th class="r">Viraram cliente</th></tr></thead><tbody>
      ${linhasI.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${v.n}</td><td class="r num">${v.conv}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhuma indicação ainda.', 'users');
  };
  render();
  return { live: true, render };
}
