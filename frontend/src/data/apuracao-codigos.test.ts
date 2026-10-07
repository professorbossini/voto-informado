import { afterEach, vi } from 'vitest';
import { prepararCodigos, urlApuracao } from './apuracao';

afterEach(() => vi.unstubAllGlobals());

describe('códigos do 2º turno', () => {
  it('usa os códigos publicados pelo TSE na configuração oficial, se forem outros', async () => {
    const cfg = {
      pl: [
        {
          c: 'ele2026',
          e: [
            { cd: '6257', tp: '8', t: '1', nm: 'Eleição Ordinária Federal - 2026 1º Turno' },
            { cd: '6259', tp: '1', t: '1', nm: 'Eleição Ordinária Estadual - 2026 1º Turno' },
            { cd: '6263', tp: '8', t: '2', nm: 'Eleição Ordinária Federal - 2026 2º Turno' },
            { cd: '6265', tp: '1', t: '2', nm: 'Eleição Ordinária Estadual - 2026 2º Turno' },
          ],
        },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(cfg)));
    vi.stubGlobal('fetch', fetchMock);
    await prepararCodigos();
    await prepararCodigos();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urlApuracao(2, 'presidente', 'BR')).toContain('/6263/dados/br/br-c0001-e006263-u.json');
    expect(urlApuracao(2, 'governador', 'MG')).toContain('/6265/dados/mg/mg-c0003-e006265-u.json');
    expect(urlApuracao(1, 'presidente', 'BR')).toContain('/6257/');
  });
});
