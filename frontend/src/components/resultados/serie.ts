import { useEffect, useState } from 'react';
import type { CargoApuracao, Turno } from '@/data/apuracao';
import { dataFileUrl } from '@/data/api';
import { INTERVALO_MS } from './hooks';

/**
 * Histórico da apuração: o TSE publica só o retrato do momento; o Worker "tanaurna-apuracao"
 * (infra/cloudflare/apuracao) lê os mesmos arquivos oficiais a cada minuto na noite do 2º turno e
 * grava um ponto a cada atualização em api/apuracao/serie-2t.json. Daqui saem o gráfico
 * "Ao longo da apuração" e as "Últimas atualizações".
 */

export interface PontoSerie {
  /** "25/10/2026 19:02:11" (horário de Brasília, como o TSE publica). */
  t: string;
  /** % das seções totalizadas. */
  s: number;
  /** Votos válidos. */
  vv: number;
  /** Votos de cada candidatura, na ordem de `candidatos`. */
  v: number[];
}

export interface DisputaSerie {
  uf: string;
  cargo: CargoApuracao;
  candidatos: { sq: string; nome: string; numero: string; partido: string }[];
  pontos: PontoSerie[];
  final: boolean;
}

export interface EventoSerie {
  tipo: 'eleito' | 'concluida';
  t: string;
  uf: string;
  cargo: CargoApuracao;
  sq?: string;
  nome?: string;
  numero?: string;
  partido?: string;
}

export interface Serie {
  turno: Turno;
  atualizado: string;
  disputas: Record<string, DisputaSerie>;
  eventos: EventoSerie[];
}

/** Lê o histórico do turno, de novo a cada minuto enquanto a aba está visível e algo segue em apuração. */
export function useSerieApuracao(turno: Turno, ligado: boolean): Serie | null {
  const [serie, setSerie] = useState<{ turno: Turno; s: Serie | null }>({ turno, s: null });
  const fim = serie.turno === turno && serie.s != null && Object.values(serie.s.disputas).length > 0 && Object.values(serie.s.disputas).every((d) => d.final);
  useEffect(() => {
    if (!ligado || turno !== 2) return;
    let vivo = true;
    const ler = () =>
      fetch(dataFileUrl(`apuracao/serie-${turno}t.json`), { cache: 'no-cache', headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? (r.json() as Promise<Serie>) : null))
        .then((s) => vivo && s && setSerie({ turno, s }))
        .catch(() => undefined); // sem histórico (ou sem internet): fica o último lido
    ler();
    if (fim) return () => void (vivo = false);
    const t = setInterval(() => document.visibilityState === 'visible' && ler(), INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [turno, ligado, fim]);
  return serie.turno === turno ? serie.s : null;
}

/** "25/10/2026 19:02:11" → Date (Brasília, UTC−3). */
export function dataTse(t: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/.exec(t);
  return m ? new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6] ?? '00'}-03:00`) : null;
}
