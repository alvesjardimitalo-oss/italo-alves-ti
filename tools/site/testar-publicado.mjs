// Smoke test do site PUBLICADO. Não cria registros no Firestore de produção.
import { chromium, devices } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.SITE_URL || 'https://italoinfotec.com.br/';
const results = [];
let failures = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function test(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    console.log('PASS [' + (Date.now() - started) + 'ms] ' + name + (result ? ' — ' + result : ''));
    results.push({ name, status: 'PASS', elapsed: Date.now() - started, detail: result || '' });
  } catch (err) {
    failures++;
    console.error('FAIL [' + (Date.now() - started) + 'ms] ' + name + ': ' + (err.stack || err.message));
    results.push({ name, status: 'FAIL', elapsed: Date.now() - started, detail: String(err.message).slice(0, 800) });
  }
}

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
const mobile = await browser.newContext({ ...devices['iPhone 13'], locale: 'pt-BR' });
const p = await desktop.newPage();
const m = await mobile.newPage();

await test('Páginas do sitemap respondem HTTP 200', async () => {
  const res = await p.request.get(BASE + 'sitemap.xml');
  assert(res.ok(), 'sitemap.xml retornou HTTP ' + res.status());
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((v) => v[1]);
  assert(urls.length >= 20, 'Sitemap inesperado, ' + urls.length + ' páginas');
  const bad = [];
  for (const url of urls) {
    const x = await p.request.get(url, { timeout: 20000 });
    if (!x.ok()) bad.push(url + ' ' + x.status());
  }
  assert(bad.length === 0, 'Links que falharam: ' + bad.join('; '));
  return urls.length + ' URLs verificadas';
});

await test('Homepage desktop, CTA e tempo aproximado', async () => {
  const res = await p.goto(BASE, { waitUntil: 'load', timeout: 45000 });
  assert(res?.status() === 200, 'status ' + res?.status());
  await p.locator('#chat-fab').waitFor({ timeout: 15000 });
  assert(await p.locator('h1').count() === 1, 'H1 ausente ou duplicado');
  assert(await p.locator('a[href*="checkup.html"]').count() >= 1, 'Link check-up ausente');
  assert(await p.locator('a[href*="wa.me"]').count() >= 1, 'WhatsApp direto ausente');
  const nav = await p.evaluate(() => {
    const t = performance.getEntriesByType('navigation')[0];
    return { dclMs: Math.round(t.domContentLoadedEventEnd), loadMs: Math.round(t.loadEventEnd) };
  });
  await p.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  return JSON.stringify(nav) + ' (medição do runner, não do aparelho do cliente)';
});

await test('Mobile: navegação, check-up e largura', async () => {
  const res = await m.goto(BASE, { waitUntil: 'load', timeout: 45000 });
  assert(res?.status() === 200, 'HTTP ' + res?.status());
  const size = await m.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(size.scrollWidth <= size.width + 2, 'Rolagem horizontal: ' + JSON.stringify(size));
  await m.locator('.menu-toggle').click();
  assert(await m.evaluate(() => document.body.classList.contains('menu-on')), 'Menu móvel não abriu');
  await m.locator('.menu-toggle').click();
  await m.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  const chk = await m.goto(BASE + 'ferramentas/checkup.html', { waitUntil: 'domcontentloaded', timeout: 40000 });
  assert(chk?.status() === 200, 'check-up HTTP ' + chk?.status());
  await m.waitForFunction(() => (document.querySelector('#app-ferramenta')?.textContent || '').trim().length > 30, null, { timeout: 20000 });
  const widthCheck = await m.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(widthCheck.scrollWidth <= widthCheck.width + 2, 'Rolagem horizontal no check-up ' + JSON.stringify(widthCheck));
  await m.screenshot({ path: 'test-results/checkup-mobile.png', fullPage: true });
  return 'Menu + check-up carregaram, largura ' + size.width + 'px';
});

await test('Pedido completo em modo demo e link WhatsApp', async () => {
  await p.goto(BASE + '?demo&utm_source=smoke-ci', { waitUntil: 'load' });
  await p.locator('#chat-fab').click();
  const option = async (name) => {
    const item = p.locator('#chat-msgs .opcoes button', { hasText: name }).last();
    await item.waitFor({ timeout: 18000 });
    await item.click();
  };
  const fill = async (text) => {
    await p.locator('#chat-in:enabled').waitFor({ timeout: 16000 });
    await p.locator('#chat-in').fill(text);
    await p.locator('#chat-env').click();
  };
  await option('Conserto / orçamento');
  await option('Notebook');
  await option('Está lento');
  await option('Pular');
  await option('Atendimento remoto (qualquer cidade)');
  await fill('Teste Navegador');
  await fill('Frei Inocêncio/MG');
  await fill('33999999999');
  await p.locator('#chat-msgs').getByText('Seu pedido foi registrado no sistema.', { exact: false }).waitFor({ timeout: 20000 });
  const lead = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('italoti-demo-v1') || '{}').leads || {})[0]);
  assert(lead?.nome === 'Teste Navegador', 'Lead não foi salvo no armazenamento DEMO');
  assert(lead?.utm === 'smoke-ci', 'Origem da campanha não gravada');
  const href = await p.locator('#chat-msgs a.btn-wa').getAttribute('href');
  assert(href?.startsWith('https://wa.me/5533998556503?text='), 'Link WhatsApp incorreto');
  assert(decodeURIComponent(href).includes('Teste Navegador'), 'Nome não consta na mensagem');
  await p.screenshot({ path: 'test-results/pedido-demo.png', fullPage: false });
  return 'Lead demo salvo + origem rastreada + link WhatsApp montado';
});

await test('Sistema administrativo demo lê os pedidos do site', async () => {
  await p.goto(BASE + 'sistema.html?demo', { waitUntil: 'load', timeout: 45000 });
  await p.locator('#btn-login').waitFor({ state: 'visible', timeout: 15000 });
  await p.locator('#btn-login').click();
  await p.locator('#app').waitFor({ state: 'visible', timeout: 20000 });
  await p.locator('#nav a[href="#/leads"]').click();
  await p.locator('#tab').getByText('Teste Navegador').waitFor({ timeout: 20000 });
  await p.screenshot({ path: 'test-results/pedidos-painel-demo.png', fullPage: false });
  return 'Painel abriu e mostrou pedido do fluxo demo';
});

await test('Acompanhar OS no modo demo: status e dados', async () => {
  const code = 'OS999999';
  const phone = '3399887766';
  const id = createHash('sha256').update(code + ':' + phone.slice(-8)).digest('hex');
  await p.goto(BASE + 'acompanhar.html?demo', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.evaluate(({ id, code }) => {
    const key = 'italoti-demo-v1';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    data.rastreio = data.rastreio || {};
    data.rastreio[id] = {
      codigo: code, equipamento: 'Notebook teste', status: 'Em manutenção',
      entrada: '2026-11-06', saida: '', recado: 'Teste de acompanhamento',
      orcamento: { numero: 999999, status: 'Aprovado', total: 250 },
      atualizadoEm: '2026-11-06T12:00:00',
    };
    localStorage.setItem(key, JSON.stringify(data));
  }, { id, code });
  await p.locator('#r-cod').fill(code);
  await p.locator('#r-tel').fill(phone);
  await p.locator('#form-rastreio button[type="submit"]').click();
  await p.locator('#resultado-rastreio h2').getByText('Em manutenção').waitFor({ timeout: 20000 });
  assert((await p.locator('#resultado-rastreio').innerText()).includes('R$ 250,00'), 'Valor não apareceu');
  await p.screenshot({ path: 'test-results/rastreio-demo.png', fullPage: false });
  await p.locator('#r-cod').fill('OS999998');
  await p.locator('#form-rastreio button[type="submit"]').click();
  await p.locator('#resultado-rastreio').getByText('Não encontramos uma OS', { exact: false }).waitFor({ timeout: 15000 });
  return 'Consulta existente e não existente funcionando em demo';
});

await test('Login real não revela painel sem autenticação', async () => {
  const incognito = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  try {
    const page = await incognito.newPage();
    const response = await page.goto(BASE + 'sistema.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    assert(response?.status() === 200, 'Página do sistema não respondeu');
    await page.locator('#login').waitFor({ state: 'visible', timeout: 30000 });
    assert(await page.locator('#app').isHidden(), 'Painel visível sem login');
    return 'Tela Google visível; login de conta autorizada requer credenciais do proprietário';
  } finally {
    await incognito.close();
  }
});

await test('Leitura não autenticada do Firestore bloqueada', async () => {
  const security = await p.evaluate(async () => {
    const { FIREBASE_CONFIG } = await import('./assets/js/config.js');
    const [{ initializeApp }, F] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore-lite.js'),
    ]);
    const app = initializeApp(FIREBASE_CONFIG, 'auditoria-permissoes');
    const db = F.getFirestore(app);
    const checks = {};
    for (const col of ['clientes', 'leads', 'rastreio']) {
      try {
        await F.getDocs(F.collection(db, 'ti', 'base', col));
        checks[col] = 'LEITURA_PERMITIDA';
      } catch (err) {
        checks[col] = err.code || String(err);
      }
    }
    return checks;
  });
  assert(security.clientes === 'permission-denied', 'Leitura de clientes: ' + security.clientes);
  assert(security.leads === 'permission-denied', 'Leitura de leads: ' + security.leads);
  assert(security.rastreio === 'permission-denied', 'Listagem de rastreio: ' + security.rastreio);
  return 'Consultas/listagens anônimas negadas (Firestore real)';
});

await test('Acompanhamento real de OS inexistente mostra resposta segura', async () => {
  await p.goto(BASE + 'acompanhar.html', { waitUntil: 'domcontentloaded' });
  await p.locator('#r-cod').fill('OS999999TESTE');
  await p.locator('#r-tel').fill('33999999999');
  await p.locator('#form-rastreio button[type="submit"]').click();
  await p.locator('#resultado-rastreio').getByText('Não encontramos uma OS', { exact: false }).waitFor({ timeout: 25000 });
  return 'Resposta de OS inexistente confirmada sem criar/alterar documentos';
});

await browser.close();
console.log('RESUMO TESTES: ' + JSON.stringify({ total: results.length, passed: results.length - failures, failed: failures, results }));
if (failures) process.exitCode = 1;
