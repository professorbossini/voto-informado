import { foiEleito, type Apuracao, type CandidatoApurado } from '@/data/apuracao';
import { REGIOES } from '@/data/regioes';

export { REGIOES };

/**
 * Panorama da apuração, calculado no aparelho a partir dos arquivos oficiais do TSE que o painel
 * já baixa (um por UF): quem lidera em cada região e as disputas com a menor diferença. Sem cor de
 * partido e sem previsão: só a soma e a diferença dos votos publicados.
 */

export interface LinhaRegiao {
  nome: string;
  /** Os dois mais votados na região, pela soma dos votos das UFs. */
  primeiros: { c: CandidatoApurado; votos: number; pct: number }[];
  /** % das seções totalizadas (soma das UFs). */
  secoes: number;
  validos: number;
}

/** Soma os arquivos das UFs de cada região (e o exterior, se vier) para Presidente. */
export function somarRegioes(porUf: Record<string, Apuracao | null | undefined>, exterior?: Apuracao | null): LinhaRegiao[] {
  const linha = (nome: string, aps: Apuracao[]): LinhaRegiao | null => {
    if (!aps.length) return null;
    const votos = new Map<string, { c: CandidatoApurado; votos: number }>();
    let validos = 0;
    let total = 0;
    let totalizadas = 0;
    for (const a of aps) {
      validos += a.votos.validos;
      total += a.secoes.total;
      totalizadas += a.secoes.totalizadas;
      for (const c of a.candidatos) {
        const v = votos.get(c.sq);
        votos.set(c.sq, { c: v?.c ?? c, votos: (v?.votos ?? 0) + c.votos });
      }
    }
    const ordem = [...votos.values()].sort((a, b) => b.votos - a.votos);
    if (!ordem.length || ordem[0].votos <= 0) return { nome, primeiros: [], secoes: total ? (100 * totalizadas) / total : 0, validos };
    return {
      nome,
      primeiros: ordem.slice(0, 2).map((x) => ({ ...x, pct: validos ? (100 * x.votos) / validos : 0 })),
      secoes: total ? (100 * totalizadas) / total : 0,
      validos,
    };
  };
  const out: LinhaRegiao[] = [];
  for (const r of REGIOES) {
    const l = linha(r.nome, r.ufs.map((uf) => porUf[uf]).filter((a): a is Apuracao => Boolean(a)));
    if (l) out.push(l);
  }
  const ext = exterior ? linha('Exterior', [exterior]) : null;
  if (ext) out.push(ext);
  return out;
}

export interface Disputa {
  uf: string;
  /** Quem está na última vaga e quem vem logo atrás (na ordem dos votos). */
  dentro: CandidatoApurado;
  fora: CandidatoApurado;
  /** Diferença em pontos percentuais dos votos válidos e em votos. */
  pontos: number;
  votos: number;
  secoes: number;
  definida: boolean;
}

/**
 * Disputas da menor para a maior diferença entre a última vaga e a seguinte (Senado: 2ª × 3ª
 * quando há duas vagas; demais: 1ª × 2ª). Só disputas com votos apurados.
 */
export function disputasApertadas(porUf: Record<string, Apuracao | null | undefined>): Disputa[] {
  const out: Disputa[] = [];
  for (const [uf, a] of Object.entries(porUf)) {
    if (!a) continue;
    const vagas = Math.max(1, a.vagas);
    const dentro = a.candidatos[vagas - 1];
    const fora = a.candidatos[vagas];
    if (!dentro || !fora || dentro.votos <= 0) continue;
    out.push({
      uf,
      dentro,
      fora,
      pontos: dentro.pct - fora.pct,
      votos: dentro.votos - fora.votos,
      secoes: a.secoes.pct,
      definida: a.final || a.candidatos.some((c) => foiEleito(c) || /2º turno/i.test(c.situacao ?? '')),
    });
  }
  return out.sort((a, b) => a.pontos - b.pontos || a.uf.localeCompare(b.uf));
}
