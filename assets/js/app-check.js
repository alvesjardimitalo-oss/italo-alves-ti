// Firebase App Check (reCAPTCHA Enterprise).
// A chave pública fica em config.js. Sem chave, nenhuma verificação é ativada.
// Não ativar enforcement no Firestore até que os demais aplicativos do projeto
// compartilhado high-os também enviem tokens válidos.
import { APP_CHECK_SITE_KEY } from './config.js';

const FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/12.2.1/';

export async function iniciarAppCheck(app, { chave = APP_CHECK_SITE_KEY, carregarSdk = () => import(FIREBASE_SDK + 'firebase-app-check.js') } = {}) {
  const siteKey = String(chave || '').trim();
  if (!siteKey) return false;

  try {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await carregarSdk();
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return true;
  } catch (erro) {
    // Não interrompe o orçamento enquanto App Check ainda está em observação.
    // Após enforcement, uma falha de atestado poderá impedir operações Firebase.
    console.warn('App Check não iniciou; confira a chave e o registro no Firebase Console.', erro);
    return false;
  }
}
