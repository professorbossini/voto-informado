import { describe, expect, it } from 'vitest';
import { buscarPaginas, dobrar, linkPagina, prepararTermo, trecho } from './busca';

const destaques = (partes: ReturnType<typeof trecho>) => (partes ?? []).filter((p) => p.destaque).map((p) => p.texto);
const junto = (partes: ReturnType<typeof trecho>) => (partes ?? []).map((p) => p.texto).join('');

describe('busca nos planos de governo', () => {
  it('ignora acento, maiúsculas e espaços a mais', () => {
    expect(prepararTermo('  Educação ')).toBe('educacao');
    expect(prepararTermo('MEIO   Ambiente')).toBe('meio ambiente');
    expect(prepararTermo('“saúde”')).toBe('saude');
    expect(dobrar('Ação SAÚDE')).toBe('acao saude');
  });

  it('acha o termo no começo de palavras, com plural, sem pegar pedaços do meio', () => {
    const paginas = [['Escolas e escola técnica.', 'Parte da arte'], ['Nada aqui']].map((d) => d.map(dobrar));
    expect(buscarPaginas(paginas, 'escola')).toEqual([{ documento: 0, pagina: 1, ocorrencias: 2 }]);
    expect(buscarPaginas(paginas, 'arte')).toEqual([{ documento: 0, pagina: 2, ocorrencias: 1 }]);
    expect(buscarPaginas(paginas, 'ar')).toEqual([]); // curto demais
  });

  it('numera páginas a partir de 1 em cada documento', () => {
    const paginas = [['capa', 'Saúde'], ['SAÚDE da família', '', 'saude']].map((d) => d.map(dobrar));
    expect(buscarPaginas(paginas, 'saude').map((p) => [p.documento, p.pagina])).toEqual([
      [0, 2],
      [1, 1],
      [1, 3],
    ]);
  });

  it('destaca o trecho original, com acento, mesmo buscando sem acento', () => {
    const partes = trecho('Programa de Educação Integral e educação no campo.', 'educacao');
    expect(destaques(partes)).toEqual(['Educação', 'educação']);
    expect(junto(partes)).toBe('Programa de Educação Integral e educação no campo.');
  });

  it('acerta o destaque quando o acento vem como marca separada', () => {
    const texto = 'Mais saúde para todos';
    expect(destaques(trecho(texto, 'saude'))).toEqual(['saúde']);
  });

  it('corta textos longos em volta da primeira ocorrência, sem partir palavras', () => {
    const antes = 'palavra '.repeat(40);
    const depois = ' outra'.repeat(40);
    const partes = trecho(`${antes}Moradia popular${depois}`, 'moradia', 30)!;
    const texto = junto(partes);
    expect(texto.startsWith('… ')).toBe(true);
    expect(texto.endsWith(' …')).toBe(true);
    expect(texto).toContain('Moradia popular');
    expect(texto.replace(/^… | …$/g, '').split(' ').every((w) => ['palavra', 'Moradia', 'popular', 'outra'].includes(w))).toBe(true);
    expect(texto.length).toBeLessThan(120);
  });

  it('não devolve trecho quando o termo não aparece', () => {
    expect(trecho('Segurança pública', 'saude')).toBeNull();
    expect(trecho('qualquer', '')).toBeNull();
  });

  it('leva o PDF oficial direto à página', () => {
    expect(linkPagina('https://www.tanaurna.com.br/propostas/1_01.pdf', 12)).toBe('https://www.tanaurna.com.br/propostas/1_01.pdf#page=12');
    expect(linkPagina('/propostas/1_01.pdf#page=3', 4)).toBe('/propostas/1_01.pdf#page=4');
  });
});
