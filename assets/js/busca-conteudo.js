// Busca local de sintomas e artigos. O que o visitante digita não sai do aparelho.
// Sem dependência do Firebase nem de serviço externo.
export function normalizarBusca(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function combinaBusca(texto, consulta) {
  const termos = normalizarBusca(consulta).split(' ').filter(Boolean);
  if (!termos.length) return true;
  const valor = normalizarBusca(texto);
  return termos.every((termo) => valor.includes(termo));
}

export function iniciarBuscaConteudo(doc = document) {
  const campo = doc.querySelector('[data-busca-conteudo]');
  const grade = doc.querySelector('[data-lista-conteudo]');
  if (!campo || !grade) return false;
  const itens = Array.from(grade.querySelectorAll('[data-item-busca]'));
  const grupos = Array.from(grade.querySelectorAll('[data-grupo-busca]'));
  const contador = doc.querySelector('[data-busca-contagem]');
  const vazio = doc.querySelector('[data-busca-vazio]');
  const limpar = doc.querySelector('[data-busca-limpar]');

  function atualizar() {
    const consulta = campo.value.slice(0, 100);
    let visiveis = 0;
    for (const item of itens) {
      const encontrou = combinaBusca(item.getAttribute('data-item-busca'), consulta);
      item.hidden = !encontrou;
      if (encontrou) visiveis++;
    }
    for (const grupo of grupos) {
      grupo.hidden = !Array.from(grupo.querySelectorAll('[data-item-busca]')).some((x) => !x.hidden);
    }
    if (contador) contador.textContent = visiveis === 1 ? '1 resultado encontrado' : visiveis + ' resultados encontrados';
    if (vazio) vazio.hidden = visiveis > 0;
    if (limpar) limpar.hidden = !consulta.length;
    return visiveis;
  }
  campo.addEventListener('input', atualizar);
  campo.addEventListener('search', atualizar);
  limpar?.addEventListener('click', () => { campo.value = ''; atualizar(); campo.focus(); });
  atualizar();
  return true;
}

if (typeof document !== 'undefined') iniciarBuscaConteudo();
