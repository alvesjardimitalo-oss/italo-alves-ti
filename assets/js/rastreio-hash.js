// Identificador público da OS: SHA-256 de "CÓDIGO:últimos 8 dígitos do telefone".
// Sem o telefone certo não dá para achar o documento, e a página pública não lista nada.
export function normalizarCodigo(c) { return String(c || '').toUpperCase().replace(/\s+/g, ''); }
export function ultimos8(t) { return String(t || '').replace(/\D/g, '').slice(-8); }
export async function idRastreio(codigo, telefone) {
  const tel = ultimos8(telefone);
  const cod = normalizarCodigo(codigo);
  if (!cod || tel.length < 8) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${cod}:${tel}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
