import { afterEach, vi } from 'vitest';
import { prepararCodigos, urlApuracao } from './apuracao';

afterEach(() => vi.unstubAllGlobals());

describe('códigos do 2º turno sem a configuração do TSE', () => {
  it('mantém a regra (1º turno + 1) se o TSE ainda não publicou ou não respondeu', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await prepararCodigos();
    expect(urlApuracao(2, 'presidente', 'BR')).toContain('/6258/');
    expect(urlApuracao(2, 'governador', 'SP')).toContain('/6260/');
  });
});
