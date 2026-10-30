/** Chave aleatória do Pix da Faísca, que recebe o apoio ao Tá na Urna. É pública por natureza. */
export const PIX = {
  chave: 'ef9d98c5-6205-4c09-8671-bb927ddce0a5',
  nome: 'FAISCA',
  cidade: 'SAO PAULO',
};

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

/** CRC-16/CCITT-FALSE (polinômio 0x1021, início 0xFFFF), como pede o BR Code do Banco Central. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(texto)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** "Pix copia e cola" estático e sem valor: quem paga escolhe quanto. */
export function codigoPix({ chave, nome, cidade }: typeof PIX): string {
  const payload =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('58', 'BR') +
    campo('59', nome) +
    campo('60', cidade) +
    campo('62', campo('05', '***')) +
    '6304';
  return payload + crc16(payload);
}
