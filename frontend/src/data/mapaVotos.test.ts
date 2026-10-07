import { describe, expect, it } from 'vitest';
import type { MalhaMunicipal } from './localizacao';
import {
  ESCALA_X,
  FAIXAS,
  caixaDe,
  decodificarAnel,
  faixa,
  formaBrasilia,
  formasDaMalha,
  municipioEm,
  oklab,
  pctNaLinha,
  rampa,
  resumoPorUf,
  votacaoDaLinha,
  type MapaVotos,
} from './mapaVotos';

// Malha publicada pelo etl.malhas_municipais (curadoria versionada no repositório).
const malhas = import.meta.glob<MalhaMunicipal>('../../../backend/curadoria/legislativos/malhas/{SP,RJ}.json', { eager: true, import: 'default' });
const malha = (uf: string) => malhas[`../../../backend/curadoria/legislativos/malhas/${uf}.json`];

/** Ponto (latitude, longitude) → coordenadas do mapa. */
const ponto = (lat: number, lon: number) => [lon * ESCALA_X, -lat] as const;

describe('decodificarAnel', () => {
  it('soma as diferenças e projeta (x = lon × cos 15°, y = −lat)', () => {
    const r = decodificarAnel([-466333, -235505, 10, -5, -20, 0]);
    expect(r).toHaveLength(6);
    expect(r[0]).toBeCloseTo(-46.6333 * ESCALA_X, 4);
    expect(r[1]).toBeCloseTo(23.5505, 4);
    expect(r[2]).toBeCloseTo(-46.6323 * ESCALA_X, 4);
    expect(r[3]).toBeCloseTo(23.551, 4);
    expect(r[4]).toBeCloseTo(-46.6343 * ESCALA_X, 4);
    expect(caixaDe([r])[2]).toBeCloseTo(-46.6323 * ESCALA_X, 4);
  });
});

describe('municipioEm', () => {
  const sp = formasDaMalha(malha('SP'));
  const rj = formasDaMalha(malha('RJ'));
  it.each([
    [sp, -23.5505, -46.6333, '71072'], // São Paulo (Sé)
    [sp, -22.9056, -47.0608, '62910'], // Campinas
    [rj, -22.9, -43.35, '60011'], // Rio de Janeiro (Jacarepaguá; o Centro fica no litoral simplificado)
  ])('%#: %f,%f → %s', (formas, lat, lon, cd) => {
    const [x, y] = ponto(lat as number, lon as number);
    expect(municipioEm(formas as typeof sp, x, y)?.cd).toBe(cd);
  });

  it('fora de todos os municípios: null', () => {
    const [x, y] = ponto(-3.119, -60.0217); // Manaus
    expect(municipioEm(sp, x, y)).toBeNull();
  });

  it('Brasília usa o contorno do DF', () => {
    const df = formaBrasilia();
    const [x, y] = ponto(-15.7939, -47.8828);
    expect(df && municipioEm([df], x, y)?.cd).toBe('97012');
  });
});

describe('faixa', () => {
  it('10 faixas de 10 pontos, iguais para qualquer candidatura', () => {
    expect(faixa(0)).toBe(0);
    expect(faixa(9.99)).toBe(0);
    expect(faixa(10)).toBe(1);
    expect(faixa(55)).toBe(5);
    expect(faixa(99.9)).toBe(9);
    expect(faixa(100)).toBe(9);
    expect(faixa(Number.NaN)).toBe(0);
  });
});

describe('rampa', () => {
  it.each(['light', 'dark'] as const)('%s: 10 cores, luminosidade em passos iguais e monótonos', (modo) => {
    const cores = rampa(modo);
    expect(cores).toHaveLength(FAIXAS);
    cores.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/));
    const L = cores.map((c) => oklab(c)[0]);
    const passos = L.slice(1).map((l, i) => l - L[i]);
    // claro → escuro no tema claro; escuro → claro no escuro
    passos.forEach((p) => expect(modo === 'light' ? p : -p).toBeLessThan(-0.05));
    const media = passos.reduce((a, b) => a + b) / passos.length;
    passos.forEach((p) => expect(Math.abs(p - media)).toBeLessThan(0.01));
  });

  it('extremos são as cores do tema', () => {
    expect(rampa('light')[0]).toBe('#ede7fa');
    expect(rampa('light')[FAIXAS - 1]).toBe('#2a1263');
  });
});

const MAPA: MapaVotos = {
  cargo: 'presidente',
  turno: 1,
  eleicao: '6257',
  ciclo: 'ele2026',
  fonte: { nome: 'TSE', url: '', config: '', pagina: '' },
  gerado_em: '',
  atualizado_tse: '',
  municipios_finais: 3,
  municipios_total: 4,
  candidatos: [
    { sq: '2', numero: '13', nome_urna: 'ANA', partido: 'PY' },
    { sq: '3', numero: '30', nome_urna: 'BETO', partido: 'PZ' },
    { sq: '1', numero: '22', nome_urna: 'ZÉ', partido: 'PX' },
  ],
  nomes: { SP: { '71072': 'SÃO PAULO', '62910': 'CAMPINAS' }, DF: { '97012': 'BRASÍLIA' }, ZZ: { '29254': 'ABIDJÃ' } },
  municipios: { SP: { '71072': [450, 300, 50, 100] }, DF: { '97012': [100, 40, 20, 40] }, ZZ: { '29254': [0, 0, 0, 0] } },
};

describe('resultados', () => {
  it('pctNaLinha: sobre os votos válidos; null sem válidos', () => {
    expect(pctNaLinha([450, 300, 50, 100], 0)).toBeCloseTo(66.667, 2);
    expect(pctNaLinha([450, 300, 50, 100], 2)).toBeCloseTo(22.222, 2);
    expect(pctNaLinha([0, 0, 0, 0], 1)).toBeNull();
  });

  it('votacaoDaLinha: mais votados primeiro, empate em ordem alfabética', () => {
    const v = votacaoDaLinha(MAPA, MAPA.municipios.DF['97012']);
    expect(v.map((x) => x.candidato.nome_urna)).toEqual(['ANA', 'ZÉ', 'BETO']);
    expect(v[0].pct).toBeCloseTo(40);
  });

  it('resumoPorUf: soma os municípios finais e conta os que faltam', () => {
    const r = resumoPorUf(MAPA);
    expect(r.map((x) => x.uf)).toEqual(['DF', 'SP', 'ZZ']);
    expect(r[1]).toEqual({ uf: 'SP', finais: 1, total: 2, linha: [450, 300, 50, 100] });
  });
});
