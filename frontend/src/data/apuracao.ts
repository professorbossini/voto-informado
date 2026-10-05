import type { Cargo } from './types';

/**
 * Apuração ao vivo, lida direto do servidor oficial de divulgação do TSE
 * (https://resultados.tse.jus.br), no navegador de quem visita. O TSE libera CORS
 * para qualquer origem; assim o site estático mostra o número que o TSE acabou de
 * publicar, sem passar por nenhum servidor nosso.
 *
 * Arquivo "unificado" (o mesmo que o app Resultados do TSE usa):
 *   oficial/ele2026/<eleicao>/dados/<uf>/<uf>-c<cargo:4>-e<eleicao:6>-u.json
 */

export const TSE_RESULTADOS = 'https://resultados.tse.jus.br';
const BASE = `${TSE_RESULTADOS}/oficial/ele2026`;

export type Turno = 1 | 2;

/** Os cinco cargos em disputa em 2026 (distrital no lugar de estadual no DF). */
export type CargoApuracao = 'presidente' | 'governador' | 'senador' | 'deputado-federal' | 'deputado-estadual' | 'deputado-distrital';

/** Códigos de eleição do TSE (ele-c.json): federal = Presidente; estadual = os demais. */
const ELEICAO: Record<Turno, { federal: string; estadual: string }> = {
  1: { federal: '6257', estadual: '6259' },
  2: { federal: '6258', estadual: '6260' },
};

const CODIGO_CARGO: Record<CargoApuracao, number> = {
  presidente: 1,
  governador: 3,
  senador: 5,
  'deputado-federal': 6,
  'deputado-estadual': 7,
  'deputado-distrital': 8,
};

/** Só Presidente e Governador podem ter 2º turno; Senado e deputados são decididos no 1º. */
export function temSegundoTurno(cargo: CargoApuracao): boolean {
  return cargo === 'presidente' || cargo === 'governador';
}

export function isProporcional(cargo: CargoApuracao): boolean {
  return cargo.startsWith('deputado');
}

/** Cargo de deputado(a) da Assembleia/Câmara Legislativa de cada UF. */
export function cargoEstadual(uf: string): CargoApuracao {
  return uf.toUpperCase() === 'DF' ? 'deputado-distrital' : 'deputado-estadual';
}

/**
 * Endereço do arquivo oficial. `uf` = "BR" para o total nacional de Presidente;
 * uma UF para os demais cargos (ou para ver o voto para Presidente naquele estado).
 */
export function urlApuracao(turno: Turno, cargo: CargoApuracao, uf: string): string {
  const eleicao = cargo === 'presidente' ? ELEICAO[turno].federal : ELEICAO[turno].estadual;
  const u = uf.toLowerCase();
  const c = String(CODIGO_CARGO[cargo]).padStart(4, '0');
  return `${BASE}/${eleicao}/dados/${u}/${u}-c${c}-e${eleicao.padStart(6, '0')}-u.json`;
}

// ── Formato bruto publicado pelo TSE (só os campos que usamos) ────────────────

interface RawCand {
  n: string;
  sqcand: string;
  nm: string;
  nmu: string;
  dvt?: string;
  seq?: string;
  e?: string;
  st?: string;
  vap?: string;
  pvap?: string;
  vs?: { tp: string; nmu: string; sgp?: string }[];
}

interface RawPartido {
  n: string;
  sg: string;
  nm: string;
  cand?: RawCand[];
}

interface RawAgremiacao {
  n: string;
  nm: string;
  tp: string;
  com: string;
  vag?: string;
  par: RawPartido[];
}

export interface RawUnificado {
  ele: string;
  t: string;
  cdabr: string;
  dg: string;
  hg: string;
  dt?: string;
  ht?: string;
  tf?: string;
  s: { ts: string; st: string; pst: string; pstn?: string };
  e: { te: string; c: string; pc: string; a: string; pa: string };
  v: { tv: string; vv: string; vb: string; pvb: string; tvn: string; ptvn: string; van?: string; vansj?: string };
  carg: { cd: string; nmn: string; nv: string; qe?: string; agr: RawAgremiacao[] }[];
}

// ── Formato que a interface usa ───────────────────────────────────────────────

export interface CandidatoApurado {
  sq: string;
  numero: string;
  nomeUrna: string;
  nome: string;
  partido: string;
  /** Coligação ou federação (composição publicada pelo TSE), quando não é partido isolado. */
  agremiacao: string | null;
  votos: number;
  /** % dos votos válidos, como publicado pelo TSE. */
  pct: number;
  /** Posição pelos votos apurados (1 = mais votado). */
  posicao: number;
  eleito: boolean;
  /** "Eleito", "2º turno", "Eleito por QP", "Suplente"... vazio enquanto não há definição. */
  situacao: string | null;
  /** "Válido", "Anulado sub judice"... */
  destinacao: string;
  vices: string[];
}

export interface Apuracao {
  turno: Turno;
  cargo: CargoApuracao;
  /** "BR" ou a UF, em maiúsculas. */
  uf: string;
  url: string;
  /** Data/hora da última totalização (horário de Brasília), "04/10/2026 19:02:11". */
  atualizado: string;
  /** Totalização final concluída. */
  final: boolean;
  vagas: number;
  secoes: { total: number; totalizadas: number; pct: number };
  eleitorado: { total: number; comparecimento: number; pctComparecimento: number; abstencao: number; pctAbstencao: number };
  votos: { total: number; validos: number; brancos: number; pctBrancos: number; nulos: number; pctNulos: number };
  /** Ordem oficial (mais votados primeiro). */
  candidatos: CandidatoApurado[];
  /** Vagas obtidas por partido/federação (só proporcionais), na ordem de vagas. */
  bancadas: { nome: string; vagas: number }[];
}

/** "50,74" → 50.74; "18644760" → 18644760. */
export function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
}

export function parseApuracao(raw: RawUnificado, cargo: CargoApuracao, url: string): Apuracao {
  const carg = raw.carg?.[0];
  const candidatos: CandidatoApurado[] = [];
  const bancadas: { nome: string; vagas: number }[] = [];
  for (const agr of carg?.agr ?? []) {
    const isolado = agr.tp === 'i';
    if (agr.vag != null && num(agr.vag) > 0) bancadas.push({ nome: agr.com || agr.nm, vagas: num(agr.vag) });
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        candidatos.push({
          sq: String(c.sqcand),
          numero: String(c.n),
          nomeUrna: c.nmu || c.nm,
          nome: c.nm,
          partido: par.sg,
          agremiacao: isolado ? null : agr.com || agr.nm,
          votos: num(c.vap),
          pct: num(c.pvap),
          posicao: num(c.seq),
          eleito: String(c.e ?? '').toLowerCase() === 's',
          situacao: c.st?.trim() || null,
          destinacao: c.dvt ?? 'Válido',
          vices: (c.vs ?? []).map((v) => `${v.nmu}${v.sgp ? ` (${v.sgp})` : ''}`),
        });
      }
    }
  }
  // Ordem pelos votos. O campo `seq` do TSE NÃO serve de posição: nos arquivos por UF ele
  // repete a ordem nacional (ex.: Presidente na BA). Empate: mantém a ordem do TSE.
  candidatos.sort((a, b) => b.votos - a.votos || (a.posicao || 1e9) - (b.posicao || 1e9));
  candidatos.forEach((c, i) => (c.posicao = i + 1));
  bancadas.sort((a, b) => b.vagas - a.vagas || a.nome.localeCompare(b.nome, 'pt-BR'));
  // dg/hg = geração do arquivo em horário de Brasília. (dt/ht vêm no fuso local de cada UF:
  // no Acre aparecem 2h a menos; por isso não servem para "atualizado às".)
  const dia = raw.dg || raw.dt;
  const hora = raw.hg || raw.ht;
  return {
    turno: num(raw.t) === 2 ? 2 : 1,
    cargo,
    uf: (raw.cdabr || '').toUpperCase(),
    url,
    atualizado: `${dia} ${hora}`.trim(),
    final: String(raw.tf ?? '').toLowerCase() === 's',
    vagas: num(carg?.nv) || 1,
    secoes: { total: num(raw.s?.ts), totalizadas: num(raw.s?.st), pct: num(raw.s?.pstn ?? raw.s?.pst) },
    eleitorado: {
      total: num(raw.e?.te),
      comparecimento: num(raw.e?.c),
      pctComparecimento: num(raw.e?.pc),
      abstencao: num(raw.e?.a),
      pctAbstencao: num(raw.e?.pa),
    },
    votos: {
      total: num(raw.v?.tv),
      validos: num(raw.v?.vv),
      brancos: num(raw.v?.vb),
      pctBrancos: num(raw.v?.pvb),
      nulos: num(raw.v?.tvn),
      pctNulos: num(raw.v?.ptvn),
    },
    candidatos,
    bancadas,
  };
}

/**
 * Busca a apuração. `null` = o TSE ainda não publicou esse arquivo (404), o que é
 * normal antes das 17h do dia da votação e, no 2º turno, onde não houver disputa.
 */
export async function buscarApuracao(turno: Turno, cargo: CargoApuracao, uf: string, signal?: AbortSignal): Promise<Apuracao | null> {
  const url = urlApuracao(turno, cargo, uf);
  // no-cache: revalida com o servidor (ETag) a cada consulta; o CDN do TSE segura ~1 min.
  const res = await fetch(url, { cache: 'no-cache', signal, headers: { Accept: 'application/json' } });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`O TSE respondeu ${res.status}`);
  return parseApuracao((await res.json()) as RawUnificado, cargo, url);
}

/** Rótulos curtos usados nas abas de cargo. */
export const CARGO_APURACAO_LABEL: Record<CargoApuracao, string> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senado',
  'deputado-federal': 'Dep. federal',
  'deputado-estadual': 'Dep. estadual',
  'deputado-distrital': 'Dep. distrital',
};

export function isCargoApuracao(c: string | null | undefined): c is CargoApuracao {
  return c != null && c in CODIGO_CARGO;
}

/** Converte o cargo do índice de busca (types.Cargo) no cargo da apuração. */
export function cargoDaBusca(c: Cargo): CargoApuracao | null {
  return isCargoApuracao(c) ? c : null;
}

/** Situação publicada pelo TSE para quem vai ao 2º turno ("2º turno"; aceita variações de grafia). */
export function vaiAo2Turno(situacao: string | null | undefined): boolean {
  return /^\s*2\s*[º°o]?\s*turno\s*$/i.test(situacao ?? '');
}

/**
 * Finalistas do 2º turno numa disputa do 1º turno, em ordem alfabética do nome na urna (neutra).
 * 1º: a marcação oficial do TSE (situação "2º turno"). 2º: sem a marcação, mas com 100% das seções
 * totalizadas e ninguém acima de 50% dos votos válidos, os dois mais votados vão ao 2º turno
 * (Constituição, art. 77, § 3º, e art. 28). Vazio enquanto não se sabe.
 */
export function finalistasDe(ap: Apuracao | null | undefined): CandidatoApurado[] {
  return finalistasComOrigem(ap).candidatos;
}

export function finalistasComOrigem(ap: Apuracao | null | undefined): { candidatos: CandidatoApurado[]; oficial: boolean } {
  const vazio = { candidatos: [], oficial: false };
  if (!ap || ap.turno !== 1 || !temSegundoTurno(ap.cargo)) return vazio;
  const alfa = (l: CandidatoApurado[]) => [...l].sort((a, b) => a.nomeUrna.localeCompare(b.nomeUrna, 'pt-BR'));
  const marcados = ap.candidatos.filter((c) => vaiAo2Turno(c.situacao));
  if (marcados.length >= 2) return { candidatos: alfa(marcados), oficial: true };
  const validos = ap.candidatos.filter((c) => /^válido/i.test(c.destinacao) && c.votos > 0);
  const totalizado = ap.final || ap.secoes.pct >= 100;
  if (totalizado && validos.length >= 2 && !ap.candidatos.some((c) => c.eleito || /^eleit/i.test(c.situacao ?? '')) && validos[0].pct <= 50) {
    return { candidatos: alfa(validos.slice(0, 2)), oficial: false };
  }
  return vazio;
}

/**
 * Eleito(a) segundo o TSE: marca "e" = s ou situação "Eleito", "Eleito por QP", "Eleito por média".
 * ("Não eleito" e "Suplente" não contam. Atenção: o TSE também marca "e" = s em quem vai ao
 * 2º turno, então a situação "2º turno" prevalece sobre a marca.)
 */
export function foiEleito(c: Pick<CandidatoApurado, 'eleito' | 'situacao'>): boolean {
  if (vaiAo2Turno(c.situacao)) return false;
  return c.eleito || /^eleit[oa]/i.test(c.situacao ?? '');
}

/** Quem já foi declarado eleito nesta disputa, na ordem dos votos. */
export function eleitosDe(ap: Apuracao | null | undefined): CandidatoApurado[] {
  return ap ? ap.candidatos.filter(foiEleito) : [];
}

/** Como a candidatura terminou (ou vai terminando) na apuração, segundo a situação publicada pelo TSE. */
export interface Desfecho {
  tipo: 'eleito' | 'segundo-turno';
  /** Turno em que foi eleito(a); para 2º turno, sempre 1 (turno em que se classificou). */
  turno: Turno;
  /** Foi ao 2º turno e o TSE já declarou o resultado dele sem esta candidatura eleita. */
  encerrado?: boolean;
}

/**
 * Desfecho a partir das situações oficiais de cada turno (do arquivo do TSE ao vivo ou do
 * campo "resultados" publicado no perfil). `null` enquanto o TSE não definiu nada.
 */
export function desfechoDe(rs: { turno: number; situacao: string | null; eleito: boolean | number }[] | null | undefined): Desfecho | null {
  const t1 = rs?.find((r) => r.turno === 1);
  const t2 = rs?.find((r) => r.turno === 2);
  const eleito = (r: typeof t1) => Boolean(r && foiEleito({ eleito: Boolean(r.eleito), situacao: r.situacao }));
  if (eleito(t2)) return { tipo: 'eleito', turno: 2 };
  if (eleito(t1)) return { tipo: 'eleito', turno: 1 };
  if (t1 && vaiAo2Turno(t1.situacao)) return { tipo: 'segundo-turno', turno: 1, encerrado: Boolean(t2?.situacao?.trim()) };
  return null;
}
