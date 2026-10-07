import { ajustarJuntos, ajustarTexto, nomeArquivo, quebrarLinhas, reticencias, urlCurta, type Medidor } from './texto';

// Medidor previsível: cada caractere ocupa metade do tamanho da fonte.
const medir: Medidor = (t, tamanho) => t.length * tamanho * 0.5;

describe('quebrarLinhas', () => {
  it('quebra entre palavras sem passar da largura', () => {
    // 20px → 10 px por caractere; largura 100 = 10 caracteres
    expect(quebrarLinhas('Andréa Viegart Coletivo Animal', 100, 20, medir)).toEqual(['Andréa', 'Viegart', 'Coletivo', 'Animal']);
    expect(quebrarLinhas('Ana de Souza', 100, 20, medir)).toEqual(['Ana de', 'Souza']);
  });

  it('corta uma palavra maior que a linha (ex.: endereço)', () => {
    const linhas = quebrarLinhas('tanaurna.com.br/comparar?c=1,2,3', 100, 20, medir);
    expect(linhas.every((l) => medir(l, 20) <= 100)).toBe(true);
    expect(linhas.join('')).toBe('tanaurna.com.br/comparar?c=1,2,3');
  });

  it('texto vazio não gera linhas', () => {
    expect(quebrarLinhas('   ', 100, 20, medir)).toEqual([]);
  });
});

describe('ajustarTexto', () => {
  it('usa o maior tamanho em que cabe', () => {
    expect(ajustarTexto('Lula', { largura: 400, max: 76, min: 40, maxLinhas: 2 }, medir)).toEqual({ tamanho: 76, linhas: ['Lula'] });
  });

  it('diminui a fonte para nomes longos caberem no limite de linhas', () => {
    const a = ajustarTexto('Andréa Viegart Coletivo Animal', { largura: 300, max: 76, min: 30, maxLinhas: 2 }, medir);
    expect(a.linhas.length).toBeLessThanOrEqual(2);
    expect(a.tamanho).toBeLessThan(76);
    expect(a.linhas.every((l) => medir(l, a.tamanho) <= 300)).toBe(true);
  });

  it('respeita a altura disponível', () => {
    const a = ajustarTexto('um dois três quatro', { largura: 100, max: 40, min: 10, maxLinhas: 3, altura: 30, entrelinha: 1 }, medir);
    expect(a.linhas.length * a.tamanho).toBeLessThanOrEqual(30);
  });

  it('no mínimo e ainda sem caber, encurta a última linha com reticências', () => {
    const a = ajustarTexto('palavra '.repeat(20).trim(), { largura: 100, max: 20, min: 20, maxLinhas: 2 }, medir);
    expect(a).toMatchObject({ tamanho: 20 });
    expect(a.linhas).toHaveLength(2);
    expect(a.linhas[1].endsWith('…')).toBe(true);
    expect(medir(a.linhas[1], 20)).toBeLessThanOrEqual(100);
  });
});

describe('ajustarJuntos', () => {
  it('dá o mesmo tamanho a todos os nomes (o maior em que todos cabem)', () => {
    const r = ajustarJuntos(['Lula', 'Flavio Bolsonaro'], { largura: 200, max: 46, min: 20, maxLinhas: 1 }, medir);
    expect(r[0].tamanho).toBe(r[1].tamanho);
    expect(medir(r[1].linhas[0], r[1].tamanho)).toBeLessThanOrEqual(200);
  });

  it('com piso, só o texto que não cabe diminui sozinho', () => {
    const r = ajustarJuntos(['R$ 1 mi', 'Deputado(a) federal · nº 3030'], { largura: 200, max: 40, min: 10, maxLinhas: 1 }, medir, 32);
    expect(r[0].tamanho).toBe(32);
    expect(r[1].tamanho).toBeLessThan(32);
  });
});

describe('utilitários', () => {
  it('reticencias mantém o texto que já cabe', () => {
    expect(reticencias('curto', 100, 20, medir)).toBe('curto');
  });

  it('urlCurta tira protocolo e www', () => {
    expect(urlCurta('https://www.tanaurna.com.br/candidato/123')).toBe('tanaurna.com.br/candidato/123');
    expect(urlCurta('http://localhost:5173/')).toBe('localhost:5173');
  });

  it('nomeArquivo gera nome sem acentos nem espaços', () => {
    expect(nomeArquivo('Andréa Viegart Coletivo Animal')).toBe('tanaurna-andrea-viegart-coletivo-animal.png');
    expect(nomeArquivo('2º turno · Governador(a) · São Paulo')).toBe('tanaurna-2o-turno-governador-a-sao-paulo.png');
    expect(nomeArquivo('***')).toBe('tanaurna-cartao.png');
  });
});
