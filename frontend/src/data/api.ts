import { env } from '@/config/env';
import type { MalhaMunicipal } from '@/data/localizacao';
import type {
  Eleitos,
  Stf,
  MinistroStfDetalhe,
  BuscaItem,
  CandidatoDetalhe,
  Estatisticas,
  Executivos,
  FeedNoticiasDados,
  LegislativosEstaduais,
  VereadoresUf,
  ListaDeputados,
  ListaMajoritarios,
  ListaParlamentares,
  ListaPesquisas,
  ListaPresidente,
  Meta,
  ParlamentarDetalhe,
  Partido,
  Plenario,
  Resultados,
  SegundoTurno,
} from './types';

/**
 * Public, read-only election data. Every path is a plain GET with no query string,
 * so it works both against the FastAPI backend and as static files on any host.
 * Responses are cached for the session: the data only changes once a day.
 */
const cache = new Map<string, Promise<unknown>>();

/** Absolute URL for data assets (photos, PDFs) returned by the API as `/fotos/...`. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${env.assetsUrl}${path}`;
}

/** URL de um arquivo publicado junto com os dados (dentro de api/). */
export function dataFileUrl(path: string): string {
  return `${env.dataUrl}/api/${path}`;
}

export class DataError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DataError';
    this.status = status;
  }
}

function get<T>(path: string): Promise<T> {
  const url = `${env.dataUrl}/api/${path}`;
  let pending = cache.get(url) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(url, { headers: { Accept: 'application/json' } }).then(async (res) => {
      if (!res.ok) {
        throw new DataError(res.status, res.status === 404 ? 'Não encontrado' : `Erro ${res.status} ao carregar dados`);
      }
      return (await res.json()) as T;
    });
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

export const data = {
  meta: () => get<Meta>('meta.json'),
  presidente: () => get<ListaPresidente>('presidente.json'),
  majoritarios: (uf: string) => get<ListaMajoritarios>(`uf/${uf.toUpperCase()}.json`),
  deputados: (uf: string) => get<ListaDeputados>(`uf/${uf.toUpperCase()}/deputados.json`),
  candidato: (sq: string) => get<CandidatoDetalhe>(`candidato/${encodeURIComponent(sq)}.json`),
  busca: () => get<BuscaItem[]>('busca.json'),
  partidos: () => get<Partido[]>('partidos.json'),
  plenario: () => get<Plenario>('plenario.json'),
  executivos: () => get<Executivos>('executivos.json'),
  estaduais: () => get<LegislativosEstaduais>('legislativos/estaduais.json'),
  vereadores: (uf: string) => get<VereadoresUf>(`legislativos/vereadores/${uf.toUpperCase()}.json`),
  stf: () => get<Stf>('stf.json'),
  eleitos: () => get<Eleitos>('eleitos.json'),
  ministroStf: (id: string) => get<MinistroStfDetalhe>(`stf/ministro/${encodeURIComponent(id)}.json`),
  malhaMunicipal: (uf: string) => get<MalhaMunicipal>(`legislativos/malhas/${uf.toUpperCase()}.json`),
  noticias: (tipo: 'parlamentar' | 'partido' | 'ministro', id: string) => get<FeedNoticiasDados>(`noticias/${tipo}/${encodeURIComponent(id)}.json`),
  estatisticas: () => get<Estatisticas>('estatisticas.json'),
  parlamentares: () => get<ListaParlamentares>('parlamentares.json'),
  parlamentar: (id: string) => get<ParlamentarDetalhe>(`parlamentar/${encodeURIComponent(id)}.json`),
  resultados: () => get<Resultados>('resultados.json'),
  pesquisas: () => get<ListaPesquisas>('pesquisas.json'),
  segundoTurno: () => get<SegundoTurno>('segundo-turno.json'),
};
