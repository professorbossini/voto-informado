/**
 * Dados públicos oficiais dos EUA, gravados pela automação .github/workflows/eua.yml em api/eua/.
 * Mesmo formato do resto do site: GET simples, sem query string, com cache por sessão.
 * Módulo separado do Brasil: nada aqui é usado pelas páginas brasileiras.
 */
import { dataFileUrl, DataError } from '@/data/api';

const cache = new Map<string, Promise<unknown>>();

function get<T>(path: string): Promise<T> {
  const url = dataFileUrl(`eua/${path}`);
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url, { headers: { Accept: 'application/json' } }).then(async (r) => {
      if (!r.ok) throw new DataError(r.status, r.status === 404 ? 'Não encontrado' : `Erro ${r.status} ao carregar dados`);
      return (await r.json()) as T;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** URL de arquivo publicado (retratos), a partir do caminho relativo a api/. */
export const arquivoEua = (caminho: string | null | undefined) => (caminho ? dataFileUrl(caminho) : null);

// ── tipos ────────────────────────────────────────────────────────────────────

export type Casa = 'camara' | 'senado';
export type Partido = 'R' | 'D' | 'I' | string;

export interface FonteEua {
  chave: string;
  nome: string;
  orgao: string;
  url: string;
  pagina: string | null;
  descricao: string;
  licenca: string | null;
  gerado_em: string | null;
  publicado_em: string | null;
  coletado_em: string;
}

export interface MembroResumo {
  id: string;
  casa: Casa;
  nome: string;
  sobrenome: string | null;
  partido: Partido | null;
  bancada?: Partido | null;
  uf: string;
  distrito: number | null;
  classe?: number | null;
  delegado: boolean;
  genero: 'M' | 'F' | null;
  nascimento: string | null;
  desde: string | null;
  posse: string | null;
  mandato_fim: string | null;
  proxima_eleicao: number | null;
  foto: string | null;
}

export interface Congresso {
  congresso: number;
  publicado_clerk: string | null;
  camara: { cadeiras: number; delegados: number; membros: MembroResumo[]; vagas: { uf: string; distrito: number; nota: string | null }[] };
  senado: { cadeiras: number; membros: MembroResumo[] };
  coletado_em: string;
}

export interface Comissao {
  codigo: string;
  nome: string;
  cargo: string | null;
  sub: boolean;
}

export interface MembroPerfil extends MembroResumo {
  telefone: string | null;
  gabinete: string | null;
  site: string | null;
  comissoes: Comissao[];
  redes: Record<string, string>;
  fec: string[];
  lis: string | null;
  mandatos: { casa: Casa; inicio: string; fim: string; uf: string; distrito: number | null; partido: string }[];
  links: { bioguide: string; congress_gov: string };
}

/** S = Sim, N = Não, P = Presente, A = Não votou, O:<texto> = outro (nome, na eleição do Presidente da Câmara). */
export type CodigoVoto = string;

export interface VotacaoResumo {
  id: string;
  n: number;
  data: string | null;
  pergunta: string | null;
  tipo: string | null;
  resultado: string | null;
  proposicao: string | null;
  descricao: string | null;
  url: string;
  url_proposicao: string | null;
  placar: Partial<Record<'S' | 'N' | 'P' | 'A' | 'O', number>>;
}

export interface CatalogoVotacoes {
  congresso: number;
  casa: Casa;
  situacao: 'ok' | 'indisponivel';
  total: number;
  votacoes: VotacaoResumo[];
  coletado_em: string;
}

export interface VotacaoDetalhe extends VotacaoResumo {
  votos: Record<string, CodigoVoto>;
  url_xml: string;
}

export interface VotosMembro {
  casa: Casa;
  id: string;
  total: number;
  participou: number;
  pct_participou: number | null;
  contagem: Record<'S' | 'N' | 'P' | 'A' | 'O', number>;
  itens: { id: string; voto: CodigoVoto }[];
}

export interface Financas {
  receitas: number | null;
  despesas: number | null;
  caixa: number | null;
  dividas: number | null;
  pessoas_fisicas: number | null;
  outros_comites: number | null;
  partido: number | null;
  proprio: number | null;
  emprestimos_proprios: number | null;
  ate: string | null;
}

export interface CandidaturaFec {
  fec: string;
  nome: string;
  nome_fec: string;
  partido: string | null;
  situacao: 'I' | 'C' | 'O' | null;
  status: string | null;
  bioguide: string | null;
  financas: Financas | null;
  url: string;
}

export interface CandidatosEstado {
  uf: string;
  ciclo: number;
  senado: CandidaturaFec[];
  camara: Record<string, CandidaturaFec[]>;
  coletado_em: string;
}

export interface ResumoCandidatos {
  ciclo: number;
  estados: Record<string, { senado: number; camara: number; com_movimentacao: number; receitas: number }>;
  partidos: Record<string, string>;
  coletado_em: string;
  fonte_publicada_em: string | null;
}

export interface FecMembro {
  id: string;
  ciclo: number;
  candidaturas: { fec: string; cargo: string; uf: string | null; financas: Financas | null; url: string }[];
}

export type Categorias = Record<string, number>;

export interface GastosMembro {
  id: string;
  anos: Record<string, { total: number; categorias: Categorias }>;
  trimestres: { trimestre: string; total: number; categorias: Categorias }[];
}

/** Uma linha do ranking: id do parlamentar, total e cada categoria. */
export interface LinhaGasto {
  id: string;
  total: number;
  [categoria: string]: string | number;
}

export interface GastosCamara {
  trimestres: { chave: string; url: string; publicado_em: string | null }[];
  ultimo: string | null;
  categorias: string[];
  anos: Record<string, LinhaGasto[]>;
  sem_vinculo: string[];
  senado: { formato: string; url: string };
  coletado_em: string;
}

export interface GastoFederal {
  anos: string[];
  ano_corrente: string;
  ano_distritos: string;
  estados: Record<string, { nome: string; anos: Record<string, { valor: number; per_capita: number | null; populacao: number | null }> }>;
  distritos: Record<string, { valor: number; per_capita: number | null; populacao: number | null }>;
  coletado_em: string;
}

export interface CandidatoPresidente {
  nome: string;
  partido: string | null;
  votos: number;
  pct: number | null;
  eleitores: number | null;
  eleitores_por_estado: Record<string, number> | null;
}

export interface EleicaoPresidente {
  total: number;
  candidatos: CandidatoPresidente[];
  estados: Record<string, { total: number; votos: number[]; outros: number }>;
  colegio_total: number | null;
  url_colegio: string;
}

export interface Presidente {
  anos: number[];
  por_ano: Record<string, EleicaoPresidente>;
  versao_medsl: string;
  coletado_em: string;
}

export interface DisputaSenado {
  uf: string;
  especial: boolean;
  total: number;
  candidatos: { nome: string; partido: string | null; votos: number; pct: number | null }[];
  outros: number | null;
}

export interface EleicoesSenado {
  anos: string[];
  por_ano: Record<string, DisputaSenado[]>;
  versao_medsl: string;
}

export interface Calendario {
  proxima: string;
  ano: number;
  tipo: string;
  em_disputa: { presidente: boolean; camara: number; delegados: number; senado: number; senado_estados: [string, number][]; senado_especiais: string[] };
  datas: { data: string; o_que: string; base: string }[];
  leis: Record<string, string>;
}

export interface Escritorios {
  escritorios: Record<string, { url: string; nome: string }>;
  url: string;
}

export interface Juiz {
  id: string;
  nome: string;
  cargo: 'presidente' | 'associado';
  nascimento: string | null;
  naturalidade: string | null;
  nomeado_por: string | null;
  estado: string | null;
  juramento: string | null;
  foto: string | null;
  biografia_en: string;
}

export interface Decisao {
  r: string | null;
  data: string | null;
  processo: string;
  nome: string;
  resumo_en: string | null;
  autor: string | null;
  autor_nome: string | null;
  citacao: string | null;
  pdf: string;
  termo: number;
}

export interface SupremaCorte {
  cadeiras: number;
  juizes: Juiz[];
  historico: { nome: string; nome_oficial: string; cargo: 'presidente' | 'associado'; estado: string; nomeado_por: string; juramento: string | null; saida: string | null }[];
  salarios: { ano: number; associado: number; presidente: number }[];
  termo_atual: number;
  decisoes: Decisao[];
  autores: Record<string, string>;
  coletado_em: string;
}

export interface MetaEua {
  partes: Record<string, { ok: boolean; em?: string; erro?: string; tentativa?: string; detalhe?: Record<string, string> }>;
  atualizado_em: string | null;
}

// ── chamadas ─────────────────────────────────────────────────────────────────

export const eua = {
  meta: () => get<MetaEua>('meta.json'),
  fontes: () => get<{ fontes: FonteEua[]; coletado_em: string }>('fontes.json'),
  congresso: () => get<Congresso>('congresso.json'),
  membro: (id: string) => get<MembroPerfil>(`membro/${encodeURIComponent(id)}.json`),
  votacoes: (casa: Casa) => get<CatalogoVotacoes>(`votacoes/${casa}.json`),
  votacao: (id: string) => get<VotacaoDetalhe>(`votacoes/votacao/${encodeURIComponent(id)}.json`),
  /** Nome de cada parlamentar como publicado nas votações ("Adams (D-NC)"), inclusive quem já saiu do cargo. */
  nomesVotacoes: () => get<Record<string, string>>('votacoes/nomes.json'),
  votosMembro: (id: string) => get<VotosMembro>(`votacoes/membro/${encodeURIComponent(id)}.json`),
  candidatos: (uf: string) => get<CandidatosEstado>(`candidatos/${uf.toUpperCase()}.json`),
  resumoCandidatos: () => get<ResumoCandidatos>('candidatos/resumo.json'),
  fecMembro: (id: string) => get<FecMembro>(`fec/membro/${encodeURIComponent(id)}.json`),
  gastosCamara: () => get<GastosCamara>('gastos/camara.json'),
  gastosMembro: (id: string) => get<GastosMembro>(`gastos/membro/${encodeURIComponent(id)}.json`),
  gastoFederal: () => get<GastoFederal>('gastos/federal.json'),
  presidente: () => get<Presidente>('eleicoes/presidente.json'),
  senadoEleicoes: () => get<EleicoesSenado>('eleicoes/senado.json'),
  calendario: () => get<Calendario>('eleicoes/calendario.json'),
  escritorios: () => get<Escritorios>('eleicoes/escritorios.json'),
  supremaCorte: () => get<SupremaCorte>('suprema-corte.json'),
};

/** 404 vira null (dado que ainda não existe, ex.: parlamentar sem gastos publicados). */
export const ou404 = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((e: unknown) => {
    if (e instanceof DataError && e.status === 404) return null;
    throw e;
  });
