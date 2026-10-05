import { data, dataFileUrl } from '@/data/api';
import type { ExecutivoEleito, MembroPlenario, Plenario } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';

export const SEM_PARTIDO = 'S/Partido';

/** Endereço do partido no site: /partido/pt, /partido/uniao, /partido/pcdob, /partido/sem-partido. */
export function slugPartido(sigla: string): string {
  if (sigla === SEM_PARTIDO) return 'sem-partido';
  return sigla
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Foto de parlamentar: cópia publicada pelo site (api/...) ou endereço oficial da Casa. */
export function fotoParlamentar(foto: string | null): string | null {
  if (!foto) return null;
  return /^https?:\/\//.test(foto) || foto.startsWith('/') ? foto : dataFileUrl(foto);
}

export interface Partido {
  sigla: string;
  slug: string;
  nome: string | null;
  logo: string | null;
  fundo: string | null;
  fonteLogo: string | null;
  deputados: MembroPlenario[];
  senadores: MembroPlenario[];
  /** Presidente/Vice e governadores/vices eleitos em 2022 ainda no cargo. */
  executivo: ExecutivoEleito[];
  /** Eleitos em 2022 que deixaram o cargo para concorrer em 2026. */
  deixaram: ExecutivoEleito[];
  presideCamara: MembroPlenario | null;
  presideSenado: MembroPlenario | null;
  total: number;
}

const porNome = <T extends { nome?: string; nome_urna?: string }>(a: T, b: T) =>
  (a.nome ?? a.nome_urna ?? '').localeCompare(b.nome ?? b.nome_urna ?? '', 'pt-BR');

/** Todos os partidos com algum político com mandato, em ordem alfabética da sigla (neutra). */
export function montarPartidos(pl: Plenario | null | undefined, execs: ExecutivoEleito[]): Partido[] {
  const siglas = new Set<string>();
  for (const c of [pl?.camara, pl?.senado]) for (const m of c?.membros ?? []) siglas.add(m.partido);
  for (const e of execs) siglas.add(e.partido);
  return [...siglas]
    .map((sigla) => {
      const info = pl?.partidos?.[sigla];
      const deputados = (pl?.camara?.membros ?? []).filter((m) => m.partido === sigla).sort(porNome);
      const senadores = (pl?.senado?.membros ?? []).filter((m) => m.partido === sigla).sort(porNome);
      const doPartido = execs.filter((e) => e.partido === sigla);
      const executivo = doPartido.filter((e) => !e.deixou_cargo);
      return {
        sigla,
        slug: slugPartido(sigla),
        nome: info?.nome ?? null,
        logo: info?.logo ?? null,
        fundo: info?.fundo ?? null,
        fonteLogo: info?.fonte_logo ?? null,
        deputados,
        senadores,
        executivo,
        deixaram: doPartido.filter((e) => e.deixou_cargo),
        presideCamara: pl?.camara?.presidente?.partido === sigla ? pl.camara.presidente : null,
        presideSenado: pl?.senado?.presidente?.partido === sigla ? pl.senado.presidente : null,
        total: deputados.length + senadores.length + executivo.length,
      };
    })
    .sort((a, b) => (a.sigla === SEM_PARTIDO ? 1 : b.sigla === SEM_PARTIDO ? -1 : a.sigla.localeCompare(b.sigla, 'pt-BR')));
}

/** Plenário (Câmara/Senado, atualizado todo dia) + Executivo eleito em 2022. */
export function usePartidos() {
  const r = useAsync(() => Promise.all([data.plenario(), data.executivos().catch(() => null)]), []);
  const [pl, ex] = r.data ?? [];
  return { partidos: r.data ? montarPartidos(pl, ex?.eleitos ?? []) : [], executivos: ex ?? null, loading: r.loading, error: r.error };
}
