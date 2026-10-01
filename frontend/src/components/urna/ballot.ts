import { CARGO_LABEL, DIGITOS, nomeProprio } from '@/data/format';
import type { Candidato, Cargo, DeputadoResumo, ListaDeputados, ListaMajoritarios, ListaPresidente, Partido } from '@/data/types';

/**
 * Ballot model shared by "Minha cola" and the voting-machine simulator. It only
 * mirrors the official TSE lists: the same rules apply to every candidacy, and
 * lists are always alphabetical by ballot name.
 */

export type OfficeKey =
  | 'deputado-federal'
  | 'deputado-estadual'
  | 'deputado-distrital'
  | 'senador-1'
  | 'senador-2'
  | 'governador'
  | 'presidente';

export interface Office {
  key: OfficeKey;
  cargo: Cargo;
  /** Sentence-case label, e.g. "Senador(a) · 1ª vaga". */
  label: string;
  /** Upper-case title as shown on the voting machine screen. */
  urnaLabel: string;
  digits: number;
  /** Seats for this office in the UF (senate: total seats in this election). */
  vagas: number | null;
  /** Deputies accept a party ("legenda") vote. */
  deputy: boolean;
}

export const LEGENDA_PREFIX = 'legenda:';

export function officesFor(uf: string, vagas: Partial<Record<Cargo, number>> = {}): Office[] {
  const estadual: Cargo = uf === 'DF' ? 'deputado-distrital' : 'deputado-estadual';
  const make = (key: OfficeKey, cargo: Cargo, label: string, urnaLabel: string, v: number | null): Office => ({
    key,
    cargo,
    label,
    urnaLabel,
    digits: DIGITOS[cargo] ?? 2,
    vagas: v,
    deputy: cargo.startsWith('deputado'),
  });
  return [
    make('deputado-federal', 'deputado-federal', CARGO_LABEL['deputado-federal'], 'DEPUTADO FEDERAL', vagas['deputado-federal'] ?? null),
    make(
      estadual as OfficeKey,
      estadual,
      CARGO_LABEL[estadual],
      estadual === 'deputado-distrital' ? 'DEPUTADO DISTRITAL' : 'DEPUTADO ESTADUAL',
      vagas[estadual] ?? null,
    ),
    make('senador-1', 'senador', 'Senador(a) · 1ª vaga', 'SENADOR · 1ª VAGA', vagas.senador ?? null),
    make('senador-2', 'senador', 'Senador(a) · 2ª vaga', 'SENADOR · 2ª VAGA', vagas.senador ?? null),
    make('governador', 'governador', CARGO_LABEL.governador, 'GOVERNADOR', vagas.governador ?? null),
    make('presidente', 'presidente', CARGO_LABEL.presidente, 'PRESIDENTE', 1),
  ];
}

export function vagasLabel(n: number | null): string | null {
  if (n == null) return null;
  return n === 1 ? '1 vaga' : `${n} vagas`;
}

export interface Party {
  numero: string;
  sigla: string;
  nome: string;
}

export interface Running {
  cargo: Cargo;
  nome: string;
  nomeUrna: string;
  foto: string | null;
}

export interface BallotCandidate {
  sq: string;
  cargo: Cargo;
  numero: string;
  /** Ballot name, softened case (for the site). */
  nome: string;
  /** Ballot name exactly as published (upper case, for the machine screen). */
  nomeUrna: string;
  party: Party;
  foto: string | null;
  naUrna: boolean;
  situacao: string | null;
  /** Vice or substitutes (suplentes) that run on the same ticket. */
  companheiros: Running[];
}

type ListCargo = 'presidente' | 'governador' | 'senador' | 'deputado-federal' | 'deputado-estadual' | 'deputado-distrital';

export interface Ballot {
  uf: string;
  nomeUf: string;
  vagas: Partial<Record<Cargo, number>>;
  /** Only candidacies on the machine, keyed by number. */
  byNumber: Partial<Record<Cargo, Map<string, BallotCandidate>>>;
  /** On-ballot candidacies, alphabetical. */
  lists: Partial<Record<ListCargo, BallotCandidate[]>>;
  /** Every candidacy (on the machine or not), by SQ. */
  bySq: Map<string, BallotCandidate>;
  /** Deputies only: party number → party, for parties with on-ballot candidates. */
  parties: Partial<Record<Cargo, Map<string, Party>>>;
}

const ENCERRADA = /^(renúncia|cancelado|falecimento|cassado|indeferido$)/i;
const COMPANHEIRO_ORDEM: Cargo[] = ['vice-presidente', 'vice-governador', '1-suplente', '2-suplente'];

const byName = (a: BallotCandidate, b: BallotCandidate) => a.nome.localeCompare(b.nome, 'pt-BR');

function fromCandidato(c: Candidato): BallotCandidate {
  const comp = (c.companheiros ?? []).filter((x) => x.na_urna === c.na_urna);
  return {
    sq: c.sq,
    cargo: c.cargo,
    numero: c.numero,
    nome: nomeProprio(c.nome_urna),
    nomeUrna: c.nome_urna,
    party: { numero: c.numero.slice(0, 2), sigla: c.partido, nome: c.partido_nome },
    foto: c.foto,
    naUrna: c.na_urna,
    situacao: c.situacao,
    companheiros: comp
      .map((x) => ({ cargo: x.cargo, nome: nomeProprio(x.nome_urna), nomeUrna: x.nome_urna, foto: x.foto }))
      .sort((a, b) => COMPANHEIRO_ORDEM.indexOf(a.cargo) - COMPANHEIRO_ORDEM.indexOf(b.cargo)),
  };
}

function fromDeputado(d: DeputadoResumo, partidos: Map<string, Partido>): BallotCandidate {
  const p = partidos.get(d.partido);
  return {
    sq: d.sq,
    cargo: d.cargo,
    numero: d.numero,
    nome: nomeProprio(d.nome_urna),
    nomeUrna: d.nome_urna,
    party: { numero: d.numero.slice(0, 2), sigla: d.partido, nome: p?.partido_nome ?? d.partido },
    foto: d.foto,
    naUrna: d.na_urna,
    situacao: d.situacao,
    companheiros: [],
  };
}

export function buildBallot(
  presidente: ListaPresidente,
  majoritarios: ListaMajoritarios,
  deputados: ListaDeputados,
  partidos: Partido[],
): Ballot {
  const partidosBySigla = new Map(partidos.map((p) => [p.partido, p]));
  const partidosByNumero = new Map(partidos.map((p) => [p.partido_numero, p]));
  const ballot: Ballot = {
    uf: majoritarios.uf,
    nomeUf: majoritarios.nome,
    vagas: { ...majoritarios.vagas, presidente: 1 },
    byNumber: {},
    lists: {},
    bySq: new Map(),
    parties: {},
  };

  const add = (c: BallotCandidate) => {
    ballot.bySq.set(c.sq, c);
    if (!c.naUrna) return;
    const map = (ballot.byNumber[c.cargo] ??= new Map());
    const prev = map.get(c.numero);
    // The official file may briefly list a replaced candidacy next to its substitute
    // with the same number; the active registration is the one shown on the machine.
    if (!prev || (ENCERRADA.test(prev.situacao ?? '') && !ENCERRADA.test(c.situacao ?? ''))) map.set(c.numero, c);
    const list = (ballot.lists[c.cargo as ListCargo] ??= []);
    list.push(c);
    if (c.cargo.startsWith('deputado')) {
      const parties = (ballot.parties[c.cargo] ??= new Map());
      if (!parties.has(c.party.numero)) {
        const p = partidosByNumero.get(c.party.numero);
        parties.set(c.party.numero, p ? { numero: p.partido_numero, sigla: p.partido, nome: p.partido_nome } : c.party);
      }
    }
  };

  presidente.candidatos.forEach((c) => add(fromCandidato(c)));
  majoritarios.governador.forEach((c) => add(fromCandidato(c)));
  majoritarios.senador.forEach((c) => add(fromCandidato(c)));
  deputados.candidatos.forEach((d) => add(fromDeputado(d, partidosBySigla)));
  Object.values(ballot.lists).forEach((l) => l?.sort(byName));
  return ballot;
}

/** Parties with candidates for this deputy office, alphabetical by abbreviation. */
export function partiesFor(ballot: Ballot, cargo: Cargo): Party[] {
  return [...(ballot.parties[cargo]?.values() ?? [])].sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR'));
}

/* ---------------------------------------------------------------- urna logic */

export type Resolution =
  | { kind: 'vazio' }
  | { kind: 'branco' }
  /** Still typing. Deputies: party shown once the first two digits match one. */
  | { kind: 'digitando'; party: Party | null }
  | { kind: 'candidato'; candidate: BallotCandidate }
  /** Deputies: full number with no candidate, but valid party → counts for the party. */
  | { kind: 'legenda'; party: Party }
  | { kind: 'nulo' };

export function resolve(ballot: Ballot, office: Office, digits: string, branco: boolean): Resolution {
  if (branco) return { kind: 'branco' };
  if (!digits) return { kind: 'vazio' };
  const party = office.deputy && digits.length >= 2 ? (ballot.parties[office.cargo]?.get(digits.slice(0, 2)) ?? null) : null;
  if (digits.length < office.digits) return { kind: 'digitando', party };
  const candidate = ballot.byNumber[office.cargo]?.get(digits);
  if (candidate) return { kind: 'candidato', candidate };
  if (party) return { kind: 'legenda', party };
  return { kind: 'nulo' };
}

/* ---------------------------------------------------------------- cola */

export type ColaEntry =
  | { office: Office; kind: 'vazio' }
  | { office: Office; kind: 'candidato'; numero: string; candidate: BallotCandidate }
  | { office: Office; kind: 'legenda'; numero: string; party: Party }
  /** Saved pick no longer valid (left the ballot or belongs to another UF). */
  | { office: Office; kind: 'invalido'; candidate?: BallotCandidate };

export function colaEntries(ballot: Ballot, offices: Office[], escolhas: Record<string, string>): ColaEntry[] {
  return offices.map((office): ColaEntry => {
    const pick = escolhas[office.key];
    if (!pick) return { office, kind: 'vazio' };
    if (pick.startsWith(LEGENDA_PREFIX)) {
      const numero = pick.slice(LEGENDA_PREFIX.length);
      const party = office.deputy ? ballot.parties[office.cargo]?.get(numero) : undefined;
      return party ? { office, kind: 'legenda', numero, party } : { office, kind: 'invalido' };
    }
    const candidate = ballot.bySq.get(pick);
    if (!candidate || candidate.cargo !== office.cargo || !candidate.naUrna) return { office, kind: 'invalido', candidate };
    return { office, kind: 'candidato', numero: candidate.numero, candidate };
  });
}

export function colaText(entries: ColaEntry[], ufNome: string, dataEleicao: string | null): string {
  const lines = [`Minha cola · Eleições 2026, 1º turno${dataEleicao ? ` (${dataEleicao})` : ''}`, ufNome, ''];
  for (const e of entries) {
    let value = 'Não escolhido';
    if (e.kind === 'candidato') value = `${e.numero} · ${e.candidate.nome} (${e.candidate.party.sigla})`;
    if (e.kind === 'legenda') value = `${e.numero} · voto na legenda ${e.party.sigla}`;
    if (e.kind === 'invalido') value = 'Escolha não está mais na urna';
    lines.push(`${e.office.label}: ${value}`);
  }
  lines.push('', 'Celular não é permitido na cabine de votação: leve esta cola impressa ou escrita à mão.');
  return lines.join('\n');
}
