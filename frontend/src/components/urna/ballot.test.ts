import { resolve, segundoTurno, type Ballot, type BallotCandidate } from './ballot';
import type { Cargo } from '@/data/types';

const cand = (sq: string, cargo: Cargo, numero: string): BallotCandidate => ({
  sq,
  cargo,
  numero,
  nome: sq,
  nomeUrna: sq.toUpperCase(),
  party: { numero: numero.slice(0, 2), sigla: 'P', nome: 'Partido' },
  foto: null,
  naUrna: true,
  situacao: 'Deferido',
  companheiros: [],
});

function urna(): Ballot {
  const todos = [cand('p1', 'presidente', '11'), cand('p2', 'presidente', '22'), cand('p3', 'presidente', '33'), cand('g1', 'governador', '44'), cand('g2', 'governador', '55'), cand('g3', 'governador', '66'), cand('s1', 'senador', '111'), cand('d1', 'deputado-federal', '1111')];
  const b: Ballot = { uf: 'SP', nomeUf: 'São Paulo', vagas: { presidente: 1, governador: 1, senador: 2 }, byNumber: {}, lists: {}, bySq: new Map(), parties: {} };
  for (const c of todos) {
    b.bySq.set(c.sq, c);
    (b.byNumber[c.cargo] ??= new Map()).set(c.numero, c);
    ((b.lists as Record<string, BallotCandidate[]>)[c.cargo] ??= []).push(c);
  }
  return b;
}

describe('urna do 2º turno', () => {
  it('só Governador e Presidente, nessa ordem, só com os finalistas', () => {
    const { ballot, offices } = segundoTurno(urna(), { governador: ['g1', 'g3'], presidente: ['p2', 'p3'] });
    expect(offices.map((o) => o.key)).toEqual(['governador', 'presidente']);
    expect(ballot.lists.presidente?.map((c) => c.sq)).toEqual(['p2', 'p3']);
    expect(resolve(ballot, offices[1], '22', false).kind).toBe('candidato');
    // Quem não foi ao 2º turno vira voto nulo, como na urna oficial.
    expect(resolve(ballot, offices[1], '11', false).kind).toBe('nulo');
    expect(resolve(ballot, offices[0], '55', false).kind).toBe('nulo');
    expect(ballot.byNumber.senador).toBeUndefined();
  });

  it('estado sem 2º turno para Governador: só Presidente; nada confirmado: urna vazia', () => {
    expect(segundoTurno(urna(), { governador: [], presidente: ['p1', 'p2'] }).offices.map((o) => o.key)).toEqual(['presidente']);
    expect(segundoTurno(urna(), { governador: [], presidente: [] }).offices).toEqual([]);
  });
});
