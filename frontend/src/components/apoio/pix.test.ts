import { PIX, codigoPix, crc16 } from './pix';

describe('Pix do apoio', () => {
  it('calcula o CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('monta um BR Code estático, sem valor', () => {
    const codigo = codigoPix(PIX);
    expect(codigo).toMatch(/^000201/);
    expect(codigo).toContain(`0136${PIX.chave}`);
    expect(codigo).toContain('5906FAISCA');
    expect(codigo).toContain('6009SAO PAULO');
    expect(codigo).not.toContain('5404');
    expect(codigo.slice(-8, -4)).toBe('6304');
    expect(codigo.slice(-4)).toBe(crc16(codigo.slice(0, -4)));
  });
});
