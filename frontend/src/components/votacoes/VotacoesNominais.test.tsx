import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/theme';
import type { VotacoesCatalogo, VotacoesParlamentar } from '@/data/types';
import { VotacoesNominais } from './VotacoesNominais';
import { dataCurta, rotuloVoto } from './votacoes';

const parlamentar: VotacoesParlamentar = {
  id: 'senado-1',
  casa: 'senado',
  nome: 'Fulana',
  inicio: '2023-02-01',
  resumo: { total: 3, participou: 2, votou: 2, presidiu: 0, percentual: 2 / 3, votos: { Sim: 1, Votou: 1, AP: 1 } },
  por_ano: [{ ano: 2025, total: 3, participou: 2 }],
  legenda: { AP: 'Atividade parlamentar' },
  exercicio: null,
  sem_periodo: false,
  itens: [
    { id: '3', voto: 'AP' },
    { id: '2', voto: 'Votou' },
    { id: '1', voto: 'Sim' },
  ],
  atualizado_em: '2026-10-06T04:40:00-03:00',
};

const catalogo: VotacoesCatalogo = {
  casa: 'senado',
  inicio: '2023-02-01',
  criterio: 'Critério do Senado.',
  fonte: { nome: 'Senado Federal · Dados Abertos', url: 'https://legis.senado.leg.br/dadosabertos/votacao', pagina: 'https://legis.senado.leg.br/dadosabertos/docs/' },
  atualizado_em: '2026-10-06T04:40:00-03:00',
  votacoes: Object.fromEntries(
    ['1', '2', '3'].map((n) => [
      n,
      {
        data: `2025-0${n}-10`,
        proposicao: `PL ${n}/2025`,
        ementa: `Ementa ${n}`,
        descricao: `Votação ${n}`,
        resultado: 'Aprovado',
        placar: 'Sim: 50 · Não: 10',
        url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${n}`,
        url_sessao: `https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/${n}`,
        ...(n === '2' ? { secreta: true } : {}),
      },
    ]),
  ),
};

function mockFetch(respostas: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const chave = Object.keys(respostas).find((k) => url.endsWith(k));
      return Promise.resolve(
        chave ? new Response(JSON.stringify(respostas[chave]), { status: 200 }) : new Response('', { status: 404 }),
      );
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('VotacoesNominais', () => {
  it('formata data e rótulo como publicado', () => {
    expect(dataCurta('2025-02-12')).toBe('12/02/2025');
    expect(rotuloVoto('AP', { AP: 'Atividade parlamentar' })).toBe('AP · Atividade parlamentar');
    expect(rotuloVoto('Sim', {})).toBe('Sim');
  });

  it('mostra participação, contagens e lista filtrável com links oficiais', async () => {
    mockFetch({ 'votacoes/parlamentar/senado-1.json': parlamentar, 'votacoes/senado.json': catalogo });
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={theme}>
        <VotacoesNominais id="senado-1" casa="senado" nome="Fulana" />
      </ThemeProvider>,
    );
    expect(await screen.findByText('66,7%')).toBeInTheDocument();
    expect(screen.getByText(/em 2 de 3 votações nominais/)).toBeInTheDocument();
    const lista = screen.getByRole('list');
    expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
    expect(within(lista).getByRole('link', { name: /PL 3\/2025/ })).toHaveAttribute('href', 'https://www25.senado.leg.br/web/atividade/materias/-/materia/3');
    expect(within(lista).getByText('Votação secreta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AP · Atividade parlamentar · 1' }));
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Critério do Senado.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Senado Federal · Dados Abertos/ })).toHaveAttribute('href', 'https://legis.senado.leg.br/dadosabertos/docs/');
  });

  it('avisa quando ainda não há coleta', async () => {
    mockFetch({});
    render(
      <ThemeProvider theme={theme}>
        <VotacoesNominais id="camara-9" casa="camara" nome="Beltrano" />
      </ThemeProvider>,
    );
    expect(await screen.findByText(/depois da próxima coleta diária/)).toBeInTheDocument();
  });
});
