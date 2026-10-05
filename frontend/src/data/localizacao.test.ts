import { describe, expect, it } from 'vitest';
import { municipioDoPonto, type MalhaMunicipal } from './localizacao';

// Malha publicada pelo etl.malhas_municipais (curadoria versionada no repositório).
const malhas = import.meta.glob<MalhaMunicipal>('../../../backend/curadoria/legislativos/malhas/{SP,RJ,MG}.json', { eager: true, import: 'default' });
const malha = (uf: string) => malhas[`../../../backend/curadoria/legislativos/malhas/${uf}.json`];

describe('municipioDoPonto', () => {
  it.each([
    ['SP', -23.5505, -46.6333, '71072'], // São Paulo (Sé)
    ['SP', -22.9056, -47.0608, '62910'], // Campinas
    ['RJ', -22.9068, -43.1729, '60011'], // Rio de Janeiro
    ['MG', -19.9167, -43.9345, '41238'], // Belo Horizonte
    ['SP', -23.9608, -46.3336, '70718'], // Santos (praia)
  ])('%s %f,%f → %s', (uf, lat, lon, cd) => {
    expect(municipioDoPonto(lat as number, lon as number, malha(uf as string))).toBe(cd);
  });

  it('fora da UF devolve null', () => {
    expect(municipioDoPonto(-3.119, -60.0217, malha('SP'))).toBeNull(); // Manaus na malha de SP
  });
});
