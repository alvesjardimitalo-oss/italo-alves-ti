// PIX "copia e cola" (BR Code estático) no padrão do Banco Central, com CRC16 válido.
const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;

function texto(t, max) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, max);
}

export function crc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload({ chave, nome, cidade, valor = 0, txid = '***' }) {
  chave = String(chave || '').trim();
  if (!chave) return null;
  txid = String(txid).replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const p = campo('00', '01')
    + campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave))
    + campo('52', '0000') + campo('53', '986')
    + (valor > 0 ? campo('54', Number(valor).toFixed(2)) : '')
    + campo('58', 'BR') + campo('59', texto(nome, 25) || 'RECEBEDOR') + campo('60', texto(cidade, 15) || 'BRASIL')
    + campo('62', campo('05', txid)) + '6304';
  return p + crc16(p);
}
