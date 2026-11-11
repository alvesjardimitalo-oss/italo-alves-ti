// Testes de mensagens de login sem credenciais, sem popup real e sem Firebase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orientacaoLogin, URL_PAINEL } from '../../assets/js/login-ajuda.js';

assert.equal(URL_PAINEL, 'https://italoinfotec.com.br/sistema.html');
const bloqueado = orientacaoLogin('auth/popup-blocked');
assert.equal(bloqueado.mostrarAjuda, true);
assert.match(bloqueado.mensagem, /Safari|Chrome/);
assert(!/firebase: error|auth\//i.test(bloqueado.mensagem), 'Não mostrar erro técnico ao visitante');
for(const codigo of ['auth/operation-not-supported-in-this-environment','auth/web-storage-unsupported']) {
  assert(orientacaoLogin(codigo).mostrarAjuda, 'Exibir ajuda para ' + codigo);
}
for(const codigo of ['auth/popup-closed-by-user','auth/cancelled-popup-request']) {
  assert.equal(orientacaoLogin(codigo).mensagem, '', 'Cancelamento não é falha técnica');
}
assert.match(orientacaoLogin('auth/network-request-failed').mensagem,/internet/);
assert.equal(orientacaoLogin('auth/unauthorized-domain').mostrarAjuda,false);
assert(!orientacaoLogin('auth/unknown').mensagem.includes('auth/unknown'), 'Não revelar códigos técnicos');

const html=readFileSync(new URL('../../sistema.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../../assets/js/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../../assets/css/app.css',import.meta.url),'utf8');
assert(html.includes('id="login-ajuda"') && html.includes('id="copiar-login-url"'));
assert(html.includes('id="login-url"') && html.includes('Ajust')===false);
assert(js.includes("orientacaoLogin(e?.code)") && js.includes("$('#login-ajuda').hidden = !mostrarAjuda"));
assert(js.includes("navigator.clipboard.writeText(URL_PAINEL)"));
// A versão dos arquivos no sistema.html acompanha a VERSAO do painel (cache de recursos muda a cada versão).
const versao=(readFileSync(new URL('../../assets/js/util.js',import.meta.url),'utf8').match(/VERSAO = '([^']+)'/)||[])[1];
assert(versao && html.includes('app.js?v='+versao) && html.includes('app.css?v='+versao), 'Cache de recursos deve mudar');
assert(css.includes('.login-ajuda[hidden]'), 'Ajuda do login deve poder se ocultar');
console.log('OK: login bloqueado tratado com orientação de Safari/Chrome, link copiável e sem alterar credenciais.');
