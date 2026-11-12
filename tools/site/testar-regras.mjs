// Confere o trecho de regras da TI (firebase/regras-ti.rules).
// Ele é colado dentro das regras do projeto high-os (repo high-os-dev);
// uma colagem quebrada derruba o "Fale comigo", o Acompanhar OS e a loja.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const r = readFileSync(new URL('../../firebase/regras-ti.rules', import.meta.url), 'utf8');
const conta = re => (r.match(re) || []).length;
assert.equal(conta(/\{/g), conta(/\}/g), 'chaves desbalanceadas');
assert.equal(conta(/\(/g), conta(/\)/g), 'parênteses desbalanceados');
r.split('\n').forEach((linha, i) => {
  if (/matches\('/.test(linha)) assert.match(linha, /matches\('[^']*'\)/, `regex sem fechar na linha ${i + 1}`);
});
// Cada coleção que o site público usa precisa de bloco próprio.
for (const c of ['leads/{leadId}', 'metricasSite/{eventoId}', 'rastreio/{rastreioId}', 'vagas-bf/{vagaId}'])
  assert.ok(r.includes('match /ti/base/' + c), 'faltou o bloco ti/base/' + c);
assert.equal(conta(/match \/ti\/base\/rastreio\//g), 1, 'bloco do rastreio repetido');
console.log('OK: regras da TI íntegras e com leads, métricas, rastreio e vagas da Black Friday.');
