// Separação entre a assistência técnica do Ítalo e a Loja da Karen.
// Tudo o que chega do site da Karen (/karen/) é gravado na mesma coleção de pedidos
// do site, mas com origens próprias. As telas de TI usam leadsTI(); as da loja, leadsLoja().
import { store } from './store.js';

export const ORIGENS_LOJA = new Set(['sacola-misteriosa', 'black-friday', 'black-friday-pedido']);
export const ehDaLoja = (l) => Boolean(l) && (ORIGENS_LOJA.has(l.origem) || l.servico === 'Sacola Misteriosa');
export const leadsTI = () => store.lista('leads').filter((l) => !ehDaLoja(l));
export const leadsLoja = () => store.lista('leads').filter(ehDaLoja);
