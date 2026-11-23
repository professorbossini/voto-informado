import { describe, expect, it } from 'vitest';
import { caminhoLimpo } from './visitas';

describe('registro de visitas', () => {
  it('manda só o caminho, sem query nem fragmento', () => {
    expect(caminhoLimpo('/candidato/1?x=2#y')).toBe('/candidato/1');
    expect(caminhoLimpo('?x')).toBe('/');
  });
});
