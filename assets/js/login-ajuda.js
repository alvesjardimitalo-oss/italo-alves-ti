// Mensagens seguras de autenticação. O login permanece protegido pelo Google/Firebase.
// Em GitHub Pages, usar signInWithRedirect sem proxy/mesma origem pode falhar em Safari/iOS;
// por isso explicamos como abrir o navegador externo ao invés de prometer um fallback frágil.
export const URL_PAINEL = 'https://italoinfotec.com.br/sistema.html';

export function orientacaoLogin(codigo) {
  if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') {
    return { mensagem: '', mostrarAjuda: false };
  }
  if (codigo === 'auth/popup-blocked' ||
      codigo === 'auth/operation-not-supported-in-this-environment' ||
      codigo === 'auth/web-storage-unsupported') {
    return {
      mensagem: 'Este navegador bloqueou a janela de acesso do Google. Abra o painel diretamente no Safari ou Chrome.',
      mostrarAjuda: true,
    };
  }
  if (codigo === 'auth/unauthorized-domain') {
    return {
      mensagem: 'O domínio do painel não está autorizado no Firebase Authentication. Entre em contato com o suporte técnico.',
      mostrarAjuda: false,
    };
  }
  if (codigo === 'auth/network-request-failed') {
    return {
      mensagem: 'Não foi possível conectar ao Google. Confira sua internet e tente novamente.',
      mostrarAjuda: false,
    };
  }
  return {
    mensagem: 'Não foi possível entrar agora. Tente novamente ou abra o painel no Safari ou Chrome.',
    mostrarAjuda: false,
  };
}
