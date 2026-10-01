import { dateTime, money, moneyCompact, NAO_INFORMADO, nomeProprio, normalize, percent, variation } from './format';

const nbsp = (s: string) => s.replace(/\u00a0/g, ' ');

describe('format', () => {
  it('formats money exactly as published, in BRL', () => {
    expect(nbsp(money(1234.5))).toBe('R$ 1.234,50');
    expect(money(null)).toBe(NAO_INFORMADO);
  });

  it('compacts big values without changing magnitude', () => {
    expect(moneyCompact(4_200_000)).toBe('R$ 4,2 mi');
    expect(moneyCompact(950_000)).toBe('R$ 950 mil');
    expect(moneyCompact(1_500_000_000)).toBe('R$ 1,5 bi');
    expect(nbsp(moneyCompact(800))).toBe('R$ 800');
  });

  it('never invents a variation without a baseline', () => {
    expect(variation(150, 100)).toBeCloseTo(0.5);
    expect(variation(100, null)).toBeNull();
    expect(variation(100, 0)).toBeNull();
    expect(percent(null)).toBe(NAO_INFORMADO);
  });

  it('softens official capitalized names without changing spelling', () => {
    expect(nomeProprio('LUIZ INÁCIO LULA DA SILVA')).toBe('Luiz Inácio Lula da Silva');
    expect(nomeProprio('JOÃO DOS SANTOS-PEREIRA')).toBe('João dos Santos-Pereira');
  });

  it('reads both TSE and ISO timestamps', () => {
    expect(dateTime('30/09/2026 19:30:35')).toBe('30/09/2026, 19:30');
    expect(dateTime(null)).toBe(NAO_INFORMADO);
  });

  it('normalizes accents for search', () => {
    expect(normalize('  Fábio Ação ')).toBe('fabio acao');
  });
});
