import { ORDEM_FAIXA_ETARIA, ORDEM_INSTRUCAO } from '@/components/numeros/numeros';
import { alinhar, barrasPercentuais, contagemDe, escalaComum, fracao, pontosPercentuais, rotuloContagem } from './perfil';

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ');

describe('perfil do Congresso eleito', () => {
  it('alinha as categorias dos dois anos, com zero onde faltam', () => {
    const antes = [
      { nome: 'Branca', n: 366 },
      { nome: 'Parda', n: 113 },
      { nome: 'Não informado', n: 1 },
    ];
    const depois = [
      { nome: 'Amarela', n: 1 },
      { nome: 'Branca', n: 374 },
      { nome: 'Parda', n: 106 },
    ];
    expect(alinhar(antes, depois)).toEqual([
      { nome: 'Amarela', antes: 0, depois: 1 },
      { nome: 'Branca', antes: 366, depois: 374 },
      { nome: 'Parda', antes: 113, depois: 106 },
      { nome: 'Não informado', antes: 1, depois: 0 },
    ]);
  });

  it('mantém a ordem natural de faixa etária e instrução', () => {
    const faixas = alinhar([{ nome: '70+', n: 2 }, { nome: '18–29', n: 1 }], [{ nome: '40–49', n: 3 }], ORDEM_FAIXA_ETARIA);
    expect(faixas.map((f) => f.nome)).toEqual(['18–29', '40–49', '70+']);
    const instrucao = alinhar([{ nome: 'Superior completo', n: 9 }], [{ nome: 'Ensino médio completo', n: 1 }, { nome: 'Lê e escreve', n: 1 }], ORDEM_INSTRUCAO);
    expect(instrucao.map((f) => f.nome)).toEqual(['Lê e escreve', 'Ensino médio completo', 'Superior completo']);
  });

  it('compara anos de tamanhos diferentes em porcentagem, com o número absoluto no rótulo', () => {
    const a = barrasPercentuais([{ nome: 'Feminino', n: 4 }], 27);
    const b = barrasPercentuais([{ nome: 'Feminino', n: 12 }], 54);
    expect(a[0].value).toBeCloseTo(4 / 27);
    expect(nbsp(a[0].display!)).toBe('4 · 14,8%');
    expect(nbsp(b[0].display!)).toBe('12 · 22,2%');
    expect(escalaComum(a, b)).toBeCloseTo(12 / 54);
    expect(barrasPercentuais([{ nome: 'X', n: 0 }], 0)[0].value).toBe(0);
  });

  it('diferença em pontos percentuais, sem inventar base', () => {
    expect(pontosPercentuais(90 / 513, 109 / 513)).toBe('+3,7 p.p.');
    expect(pontosPercentuais(0.3, 0.25)).toBe('−5 p.p.');
    expect(pontosPercentuais(0.2, 0.2)).toBe('0 p.p.');
    expect(pontosPercentuais(null, 0.2)).toBeNull();
  });

  it('frações e contagens', () => {
    expect(fracao(1, 0)).toBeNull();
    expect(nbsp(rotuloContagem(90, 513))).toBe('90 · 17,5%');
    expect(contagemDe([{ nome: 'Feminino', n: 3 }], 'Feminino')).toBe(3);
    expect(contagemDe([], 'Feminino')).toBe(0);
  });
});
