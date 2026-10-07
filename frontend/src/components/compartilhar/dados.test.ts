import type { CandidatoDetalhe, Fonte, ParlamentarDetalhe, VotacoesParlamentar } from '@/data/types';
import { cartaoCandidato, cartaoLadoALado, cartaoParlamentar, dataDosDados, fatosCandidato, fatosLadoALado, resultadoTexto, textoFonte } from './dados';

function candidato(extra: Partial<CandidatoDetalhe> = {}): CandidatoDetalhe {
  return {
    sq: '1',
    uf: 'SP',
    cargo: 'deputado-federal',
    numero: '3030',
    nome: 'FULANA DE TAL',
    nome_urna: 'FULANA DE TAL',
    nome_social: null,
    partido: 'ABC',
    partido_nome: 'PARTIDO ABC',
    idade: 50,
    genero: 'Feminino',
    bens: [{ tipo: 'Casa', descricao: null, valor: 1_300_000 }],
    bens_total: 1_300_000,
    declarou_bens: true,
    receitas: 2_158_818,
    despesas: 1_250_000,
    historico: [],
    resultados: [],
    mandato: null,
    foto: '/fotos/1.jpg',
    contas_atualizadas_em: null,
    ...extra,
  } as CandidatoDetalhe;
}

const fonte = (chave: string, nome: string, orgao: string, coletado_em: string): Fonte => ({ chave, nome, orgao, url: '', pagina: null, descricao: '', gerado_em: null, publicado_em: null, coletado_em });
const FONTES = new Map(
  [
    fonte('tse_candidatos', 'Candidatos 2026', 'Tribunal Superior Eleitoral (TSE) · Portal de Dados Abertos', '2026-10-02T22:15:44-03:00'),
    fonte('tse_bens', 'Bens declarados pelos candidatos 2026', 'Tribunal Superior Eleitoral (TSE) · Portal de Dados Abertos', '2026-10-02T22:15:47-03:00'),
    fonte('tse_prestacao', 'Prestação de contas', 'Tribunal Superior Eleitoral (TSE) · Portal de Dados Abertos', '2026-10-06T23:37:40-03:00'),
    fonte('camara_ceap', 'Cota parlamentar (CEAP) dos deputados', 'Câmara dos Deputados · Dados Abertos', '2026-10-02T22:18:49-03:00'),
  ].map((f) => [f.chave, f]),
);

describe('fatos de candidatura', () => {
  it('antes da apuração: patrimônio, campanha, idade e histórico (até 6)', () => {
    const f = fatosCandidato(candidato());
    expect(f.map((x) => x.rotulo)).toEqual([
      'Patrimônio declarado (2026)',
      'Receitas de campanha (parcial)',
      'Despesas contratadas (parcial)',
      'Idade na eleição',
      'Candidaturas anteriores (desde 2004)',
    ]);
    expect(f[0].valores).toEqual(['R$ 1,3 mi']);
    expect(f[3].valores).toEqual(['50 anos']);
  });

  it('com resultado oficial e mandato: resultado e votos primeiro, cota no lugar do excedente', () => {
    const c = candidato({
      resultados: [{ turno: 1, votos: 69083, pct: 0.29, situacao: 'Eleito por média', eleito: 1 }],
      mandato: { total: 253_000, casa: 'camara' } as ParlamentarDetalhe,
    });
    const f = fatosCandidato(c);
    expect(f).toHaveLength(6);
    expect(f[0]).toEqual({ rotulo: 'Resultado (TSE)', valores: ['Eleita no 1º turno'] });
    expect(f[1]).toEqual({ rotulo: 'Votos no 1º turno', valores: ['0,29% · 69.083 votos'] });
    expect(f.map((x) => x.rotulo)).toContain('Cota parlamentar desde 2023');
    expect(f.map((x) => x.rotulo)).not.toContain('Idade na eleição');
  });

  it('resultado sem eleição usa a situação publicada pelo TSE, só com a caixa suavizada', () => {
    expect(resultadoTexto(candidato({ resultados: [{ turno: 1, votos: 10, pct: 0.01, situacao: 'SUPLENTE', eleito: 0 }] }))).toBe('Suplente');
    expect(resultadoTexto(candidato({ genero: null, resultados: [{ turno: 1, votos: 10, pct: 60, situacao: 'Eleito', eleito: 1 }] }))).toBe('Eleito(a) no 1º turno');
  });

  it('sem bens declarados diz isso, sem inventar valor', () => {
    expect(fatosCandidato(candidato({ bens: [], bens_total: 0, declarou_bens: false }))[0].valores).toEqual(['Nenhum bem declarado']);
  });

  it('cartão de candidatura traz cargo/UF, número, partido, fonte e data', () => {
    const d = cartaoCandidato(candidato(), 'https://www.tanaurna.com.br/candidato/1', FONTES);
    expect(d.titulo).toBe('Deputado(a) federal · SP');
    expect(d.pessoas).toEqual([{ nome: 'Fulana de Tal', foto: '/fotos/1.jpg', numero: '3030', detalhe: 'ABC · Partido Abc' }]);
    expect(d.fonte).toMatch(/^Fonte: TSE · Candidatos 2026, Bens declarados/);
    expect(d.dataDados).toBe('06/10/2026');
  });
});

describe('lado a lado', () => {
  const a = candidato({ sq: 'a', nome_urna: 'ANA', mandato: { total: 100_000, casa: 'camara' } as ParlamentarDetalhe });
  const b = candidato({ sq: 'b', nome_urna: 'BIA', idade: null });

  it('mesmas linhas para todos, na ordem recebida; quem não tem o dado aparece neutro', () => {
    const f = fatosLadoALado([a, b]);
    const cota = f.find((x) => x.rotulo === 'Cota parlamentar desde 2023');
    expect(cota?.valores).toEqual(['R$ 100 mil', 'Não se aplica']);
    expect(f.find((x) => x.rotulo === 'Idade na eleição')?.valores).toEqual(['50 anos', '—']);
    expect(f.every((x) => x.valores.length === 2)).toBe(true);
    expect(f.length).toBeLessThanOrEqual(6);
  });

  it('2º turno: linhas da disputa primeiro e sem as linhas de resultado do perfil', () => {
    const r = [{ turno: 1, votos: 10, pct: 50, situacao: '2º TURNO', eleito: 0 }];
    const f = fatosLadoALado([candidato({ resultados: r }), candidato({ resultados: r })], {
      antes: [{ rotulo: 'Votos no 1º turno', valores: ['50,00% (10 votos)', '40,00% (8 votos)'] }],
      semResultado: true,
    });
    expect(f[0].rotulo).toBe('Votos no 1º turno');
    expect(f.filter((x) => x.rotulo.startsWith('Votos'))).toHaveLength(1);
    expect(f.map((x) => x.rotulo)).not.toContain('Resultado (TSE)');
  });

  it('cartão lado a lado mantém a ordem das pessoas e cita as fontes extras', () => {
    const d = cartaoLadoALado([b, a], { titulo: 'Comparação', url: 'u', fontes: FONTES, chavesExtras: ['tse_resultados'] });
    expect(d.pessoas.map((p) => p.nome)).toEqual(['Bia', 'Ana']);
    expect(d.fonte).toContain('Câmara dos Deputados · Cota parlamentar (CEAP) dos deputados');
  });
});

describe('fonte e data', () => {
  it('agrupa por órgão e, sem o registro carregado, cita ao menos o órgão', () => {
    expect(textoFonte(['tse_candidatos', 'camara_ceap'], FONTES)).toBe('Fonte: TSE · Candidatos 2026; Câmara dos Deputados · Cota parlamentar (CEAP) dos deputados');
    expect(textoFonte(['tse_x', 'senado_y'], new Map())).toBe('Fonte: TSE; Senado Federal');
    expect(textoFonte([], new Map(), [{ orgao: 'Senado Federal', nome: 'Votações' }])).toBe('Fonte: Senado Federal · Votações');
  });

  it('data dos dados é a coleta mais recente entre as fontes usadas', () => {
    expect(dataDosDados(['tse_candidatos', 'camara_ceap'], FONTES)).toBe('02/10/2026');
    expect(dataDosDados(['tse_candidatos'], FONTES, ['2026-10-07T10:00:00-03:00', null])).toBe('07/10/2026');
    expect(dataDosDados(['nada'], FONTES)).toBeNull();
  });
});

describe('parlamentar', () => {
  const p = {
    id: 'camara-1',
    casa: 'camara',
    nome: 'Fulana',
    partido: 'ABC',
    uf: 'SP',
    foto_url: 'https://www.camara.leg.br/foto.jpg',
    em_exercicio: true,
    total: 253_000,
    por_ano: [
      { ano: 2025, valor: 100_000, meses: 12, media_mensal: 8_333 },
      { ano: 2026, valor: 38_000, meses: 7, media_mensal: 5_500 },
    ],
    fontes: ['camara_ceap', 'camara_deputados'],
    candidato: { cargo: 'deputado-federal', numero: '3030', foto: '/fotos/9.jpg' },
  } as unknown as ParlamentarDetalhe;
  const votos = { resumo: { total: 1125, participou: 1040, percentual: 0.924, votou: 0, presidiu: 0, votos: {} }, atualizado_em: '2026-10-06T23:15:29-03:00' } as unknown as VotacoesParlamentar;

  it('totais da cota, participação nas votações nominais e foto oficial servida pelo site', () => {
    const d = cartaoParlamentar(p, 'u', FONTES, votos);
    expect(d.titulo).toBe('Deputado(a) federal · SP · mandato atual');
    expect(d.fatos.map((f) => f.valores[0])).toEqual(['R$ 253 mil', 'R$ 38 mil', '92,4% · 1.040 de 1.125', 'R$ 5,5 mil', 'Em exercício', 'Deputado(a) federal · nº 3030']);
    expect(d.pessoas[0].foto).toBe('/fotos/9.jpg');
    expect(d.fonte).toContain('Votações nominais do Plenário');
    expect(d.dataDados).toBe('06/10/2026');
  });

  it('sem as votações, o cartão sai só com os gastos de mandato', () => {
    const d = cartaoParlamentar(p, 'u', FONTES, null);
    expect(d.fatos.map((f) => f.rotulo)).not.toContain('Participação em votações nominais');
    expect(d.fonte).not.toContain('Votações');
  });
});
