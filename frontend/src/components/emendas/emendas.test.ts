import { describe, expect, it } from 'vitest';
import { linkEmenda, rotaMunicipio, textoPublicado } from './emendas';

describe('emendas', () => {
  it('monta o link da emenda no Portal da Transparência a partir do modelo publicado', () => {
    expect(linkEmenda({ link_emenda: 'https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda={codigo}' }, '202412340001')).toBe(
      'https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda=202412340001',
    );
    expect(linkEmenda(undefined, '202412340001')).toContain('codigoEmenda=202412340001');
  });

  it('suaviza só textos todo em maiúsculas, sem trocar as palavras', () => {
    expect(textoPublicado('ESTRUTURACAO DA REDE DE SERVICOS')).toBe('Estruturacao da rede de servicos');
    expect(textoPublicado('Saúde')).toBe('Saúde');
  });

  it('leva ao município na página de emendas', () => {
    expect(rotaMunicipio('SP', '71072')).toBe('/emendas?uf=SP&mun=71072');
  });
});
