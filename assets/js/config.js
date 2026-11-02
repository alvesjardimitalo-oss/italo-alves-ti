// Configuração pública do Firebase (projeto high-os — o mesmo do High OS).
// Estas chaves NÃO são segredo: quem protege os dados são as Regras do Firestore
// (veja firebase/regras-ti.rules) e a lista de e-mails autorizados.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBKtl3rCA9Id1RDMwGch-yi4hxAs83DraU',
  authDomain: 'high-os.firebaseapp.com',
  projectId: 'high-os',
  storageBucket: 'high-os.firebasestorage.app',
  messagingSenderId: '471862600170',
  appId: '1:471862600170:web:ff55af6f7e808ff393d293',
};

// Quem pode entrar. A mesma lista precisa estar nas regras do Firestore.
export const EMAILS_AUTORIZADOS = ['alvesjardim.italo@gmail.com'];
