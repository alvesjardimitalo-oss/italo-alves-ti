import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, dataBR, diasDesde, badge, STATUS_OS, hojeISO, mesNome, vazio } from '../util.js';
import { osAbertas, aReceber, saldoDo, lembretesManutencao } from '../negocio.js';
import { leadsTI } from '../loja-comum.js';

export function lista(el) {
  const render = () => {
    const hoje = hojeISO();
    const mes = hoje.slice(0, 7);
    const pagamentos = store.lista('pagamentos');
    const recebidoMes = pagamentos.filter((p) => (p.data || '').startsWith(mes)).reduce((s, p) => s + (+p.valor || 0), 0);
    const recebidoHoje = pagamentos.filter((p) => p.data === hoje).reduce((s, p) => s + (+p.valor || 0), 0);
    const receber = aReceber();
    const totalReceber = receber.reduce((s, o) => s + saldoDo(o), 0);
    const pendentes = store.lista('orcamentos').filter((o) => o.status === 'Pendente');
    const abertas = osAbertas().sort((a, b) => (a.entrada || '').localeCompare(b.entrada || ''));
    const prontas = abertas.filter((o) => o.status === 'Pronto para retirada').length;
    const ultimos = [...pagamentos].sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.numero || 0) - (a.numero || 0)).slice(0, 6);
    const lembretes = lembretesManutencao().length;
    const novosLeads = leadsTI().filter((l) => (l.status || 'Novo') === 'Novo').length;
    const saud = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite';
    const primeiroNome = (store.usuario?.nome || '').split(' ')[0];

    el.innerHTML = `
      <div class="page-head">
        <div><div class="crumb">${icon('cpu', 14)} painel</div><h1>${saud}${primeiroNome ? ', ' + esc(primeiroNome) : ''}</h1>
          <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div class="acoes">
          <a class="btn" href="#/clientes/novo">${icon('users', 16)} Novo cliente</a>
          <a class="btn btn-primary" href="#/os/nova">${icon('plus', 16)} Nova OS</a>
        </div>
      </div>

      <div class="kpis">
        <a class="kpi" href="#/os"><div class="kpi-top">Na bancada ${icon('wrench', 16)}</div>
          <div class="kpi-val">${abertas.length}</div><div class="kpi-sub">${prontas} pronta(s) para retirada</div></a>
        <a class="kpi" href="#/orcamentos?status=Pendente"><div class="kpi-top">Orçamentos pendentes ${icon('clock', 16)}</div>
          <div class="kpi-val">${pendentes.length}</div><div class="kpi-sub">${money(pendentes.reduce((s, o) => s + (+o.total || 0), 0))} aguardando aprovação</div></a>
        <a class="kpi" href="#/financeiro"><div class="kpi-top">Recebido em ${mesNome(new Date().getMonth())} ${icon('trend', 16)}</div>
          <div class="kpi-val">${money(recebidoMes)}</div><div class="kpi-sub">hoje: ${money(recebidoHoje)}</div></a>
        <a class="kpi" href="#/leads"><div class="kpi-top">Pedidos do site ${icon('chat', 16)}</div>
          <div class="kpi-val">${novosLeads}</div><div class="kpi-sub">novo(s) aguardando contato</div></a>
        ${lembretes ? `<a class="kpi" href="#/lembretes"><div class="kpi-top">Lembretes de manutenção ${icon('clock', 16)}</div>
          <div class="kpi-val">${lembretes}</div><div class="kpi-sub">cliente(s) para chamar para a preventiva</div></a>` : ''}
        <a class="kpi" href="#/financeiro"><div class="kpi-top">A receber ${icon('financeiro', 16)}</div>
          <div class="kpi-val">${money(totalReceber)}</div><div class="kpi-sub">${receber.length} orçamento(s) aprovado(s) com saldo</div></a>
      </div>

      <div class="grid g-21">
        <div class="card flush">
          <div class="card-head"><h2>${icon('wrench')} Bancada</h2><a class="btn btn-sm" href="#/os">Ver todas</a></div>
          <div class="tabela-wrap">
            ${abertas.length ? `<table class="tabela"><thead><tr><th>OS</th><th>Equipamento</th><th>Status</th><th class="r">Dias</th></tr></thead><tbody>
              ${abertas.slice(0, 10).map((o) => {
                const d = diasDesde(o.entrada);
                return `<tr class="clicavel" data-href="#/os/${o.id}">
                  <td class="nowrap"><span class="cod">${esc(o.codigo)}</span></td>
                  <td>${esc(o.equipamento)} <span class="sub">${esc([o.marca, o.modelo].filter(Boolean).join(' '))}</span><div class="sub">${esc(o.clienteNome)}</div></td>
                  <td>${badge(o.status, STATUS_OS)}</td>
                  <td class="r num" style="${d > 15 ? 'color:var(--danger);font-weight:600' : ''}">${d}</td></tr>`;
              }).join('')}</tbody></table>` : vazio('Nenhum equipamento na bancada.', 'check')}
          </div>
        </div>
        <div class="card flush">
          <div class="card-head"><h2>${icon('trend')} Últimos recebimentos</h2></div>
          <div class="tabela-wrap">
            ${ultimos.length ? `<table class="tabela"><tbody>${ultimos.map((p) => `
              <tr class="clicavel" data-href="#/orcamentos/${p.orcamentoId}">
                <td><div>${esc(p.clienteNome || '')}</div><div class="sub">${dataBR(p.data)} · ${esc(p.forma)}</div></td>
                <td class="r num nowrap">${money(p.valor)}</td></tr>`).join('')}</tbody></table>` : vazio('Nenhum pagamento ainda.', 'financeiro')}
          </div>
        </div>
      </div>`;
    el.querySelectorAll('[data-href]').forEach((tr) => tr.addEventListener('click', () => { location.hash = tr.dataset.href; }));
  };
  render();
  return { live: true, render };
}
