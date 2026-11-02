import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, dataBR, formatFone, whatsapp, toast, vazio } from '../util.js';
import { lembretesManutencao, empresa } from '../negocio.js';

const meses = (iso) => {
  if (!iso) return 0;
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  const h = new Date();
  return (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
};

export function lista(el) {
  el.innerHTML = `
    <div class="page-head"><div><div class="crumb">${icon('clock', 14)} gestão</div><h1>Lembretes de manutenção</h1>
      <p>Clientes cuja última OS foi entregue há 11 meses ou mais. Um lembrete gentil traz o cliente de volta para a limpeza preventiva.</p></div></div>
    <div class="card flush"><div class="tabela-wrap" id="tab"></div></div>`;
  const render = () => {
    const itens = lembretesManutencao();
    const emp = empresa();
    el.querySelector('#tab').innerHTML = itens.length ? `<table class="tabela"><thead><tr><th>Cliente</th><th>Último serviço</th><th class="r">Há</th><th></th></tr></thead><tbody>
      ${itens.map((o) => {
        const m = meses(o.saida || o.entrada);
        const primeiro = (o.clienteNome || '').split(' ')[0];
        const msg = `Olá, ${primeiro}! Aqui é da ${emp.nome}. Já faz cerca de ${m} meses da última manutenção do seu ${(o.equipamento || 'equipamento').toLowerCase()}${o.marca ? ' ' + o.marca : ''}. 🔧\nA limpeza preventiva evita superaquecimento, travamentos e prolonga a vida útil. Quer agendar?`;
        const wa = whatsapp(o.clienteTelefone, msg);
        return `<tr><td><div class="forte"><a href="#/clientes/${o.clienteId}">${esc(o.clienteNome)}</a></div><div class="sub">${esc(formatFone(o.clienteTelefone))}</div></td>
          <td><span class="cod">${esc(o.codigo)}</span> ${esc(o.equipamento)} <span class="sub">${esc(o.marca || '')}</span><div class="sub">entregue em ${dataBR(o.saida || o.entrada)}${o.lembreteEm ? ' · último lembrete ' + dataBR(o.lembreteEm) : ''}</div></td>
          <td class="r num">${m} meses</td>
          <td><div class="acoes">${wa ? `<a class="btn btn-sm btn-ok" target="_blank" rel="noopener" href="${esc(wa)}" data-lembrar="${o.id}">${icon('whatsapp', 15)} Lembrar</a>` : ''}
            <button class="btn btn-sm" data-ok="${o.id}" title="Marcar como lembrado sem enviar">${icon('check', 15)}</button></div></td></tr>`;
      }).join('')}</tbody></table>` : vazio('Nenhum cliente para lembrar agora.', 'check');
    const marcar = async (id) => { await store.atualizar('os', id, { lembreteEm: new Date().toISOString() }, { semGatilho: true }); toast('Marcado como lembrado.'); };
    el.querySelectorAll('[data-lembrar]').forEach((a) => a.addEventListener('click', () => marcar(a.dataset.lembrar)));
    el.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => marcar(b.dataset.ok)));
  };
  render();
  return { live: true, render };
}
