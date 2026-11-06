// Testa inicialização App Check sem rede, sem credenciais e sem tocar no Firebase real.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../../assets/js/app-check.js', import.meta.url), 'utf8');
const testavel = fonte.replace(
  "import { APP_CHECK_SITE_KEY } from './config.js';",
  "const APP_CHECK_SITE_KEY = '';",
);
assert.notEqual(fonte, testavel, 'O import de configuração precisa permanecer testável');
const { iniciarAppCheck } = await import('data:text/javascript;base64,' + Buffer.from(testavel).toString('base64'));

let imports = 0;
const carregar = async () => {
  imports++;
  return {
    ReCaptchaEnterpriseProvider: class {
      constructor(chave) { this.siteKey = chave; }
    },
    initializeAppCheck(app, opcoes) { chamadas.push({ app, opcoes }); },
  };
};
const chamadas = [];
const app = { name: 'aplicativo-teste' };
assert.equal(await iniciarAppCheck(app, { chave: '', carregarSdk: carregar }), false, 'Sem chave deve permanecer desativado');
assert.equal(imports, 0, 'Não deve carregar reCAPTCHA sem chave');
assert.equal(await iniciarAppCheck(app, { chave: '  teste-chave-publica  ', carregarSdk: carregar }), true);
assert.equal(imports, 1);
assert.equal(chamadas.length, 1);
assert.equal(chamadas[0].app, app);
assert.equal(chamadas[0].opcoes.provider.siteKey, 'teste-chave-publica');
assert.equal(chamadas[0].opcoes.isTokenAutoRefreshEnabled, true);

const warn = console.warn;
console.warn = () => {};
try {
  const resp = await iniciarAppCheck(app, { chave: 'chave', carregarSdk: async () => { throw Error('sem rede'); } });
  assert.equal(resp, false, 'Falha de atestado não deve derrubar o formulário durante observação');
} finally { console.warn = warn; }

for (const [arquivo, marca] of [
  ['leads.js', 'F.getFirestore(app)'],
  ['ferramentas/rastreio.js', 'F.getFirestore(app)'],
  ['store.js', 'A.getAuth(app)'],
]) {
  const texto = readFileSync(new URL('../../assets/js/' + arquivo, import.meta.url), 'utf8');
  const inicio = texto.indexOf('await iniciarAppCheck(app)');
  const firebase = texto.indexOf(marca, inicio);
  assert(inicio >= 0 && firebase > inicio, 'App Check deve inicializar antes de ' + marca + ' em ' + arquivo);
}
console.log('OK: sem chave segue inativo; com chave usa reCAPTCHA Enterprise e refresh; falha segura; integração antes do Firebase.');
