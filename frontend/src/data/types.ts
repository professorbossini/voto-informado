/** Shapes of the public election API (backend/app/queries.py). */

export type Cargo =
  | 'presidente'
  | 'vice-presidente'
  | 'governador'
  | 'vice-governador'
  | 'senador'
  | '1-suplente'
  | '2-suplente'
  | 'deputado-federal'
  | 'deputado-estadual'
  | 'deputado-distrital';

export type Fase = 'pre-1turno' | 'apuracao-1turno' | 'pre-2turno' | 'apuracao-2turno' | 'encerrada';

export interface Fonte {
  chave: string;
  nome: string;
  orgao: string;
  url: string;
  pagina: string | null;
  descricao: string;
  /** Generation timestamp written inside the file by the source (dd/mm/yyyy hh:mm:ss). */
  gerado_em: string | null;
  /** Last-Modified reported by the official server (ISO). */
  publicado_em: string | null;
  /** When this site downloaded the file (ISO). */
  coletado_em: string | null;
}

export interface UfInfo {
  uf: string;
  nome: string;
  vagas: Partial<Record<Cargo, number>>;
  candidatos: Partial<Record<Cargo, number>>;
}

export interface Meta {
  eleicao: { data_1turno: string; data_2turno: string; fase: Fase };
  atualizacao: {
    tse_gerado_em: string | null;
    tse_coletado_em: string | null;
    prestacao_gerada_em: string | null;
    parlamentares_coletado_em: string | null;
    resultados_consultado_em: string | null;
  };
  ufs: UfInfo[];
  totais: Partial<Record<Cargo, number>>;
  fontes: Fonte[];
}

export interface Companheiro {
  sq: string;
  cargo: Cargo;
  nome_urna: string;
  partido: string;
  situacao: string | null;
  na_urna: boolean;
  foto: string | null;
}

export interface Candidato {
  sq: string;
  uf: string;
  cargo: Cargo;
  numero: string;
  nome: string;
  nome_urna: string;
  nome_social: string | null;
  partido: string;
  partido_nome: string;
  federacao: string | null;
  federacao_nome: string | null;
  coligacao: string | null;
  coligacao_composicao: string | null;
  idade: number | null;
  genero: string | null;
  cor_raca: string | null;
  instrucao: string | null;
  ocupacao: string | null;
  estado_civil: string | null;
  naturalidade: string | null;
  situacao: string | null;
  na_urna: boolean;
  substituido: boolean;
  limite_gastos: number | null;
  declarou_bens: boolean;
  resultado: string | null;
  titular_sq: string | null;
  mandato_atual: string | null;
  eleito_ultima: string | null;
  parlamentar_id: string | null;
  bens_total: number;
  bens_2022: number | null;
  receitas: number | null;
  despesas: number | null;
  foto: string | null;
  proposta: string | null;
  criterio_debate: boolean;
  congresso_agremiacao: number | null;
  divulgacand: string;
  companheiros?: Companheiro[];
}

export interface HistoricoItem {
  ano: number;
  cargo: string;
  uf: string;
  ue: string;
  partido: string;
  numero: string;
  resultado: string | null;
  eleito: number;
  foi_2turno: number;
}

export interface CandidatoDetalhe extends Candidato {
  titular?: Pick<Candidato, 'sq' | 'nome_urna' | 'cargo' | 'partido' | 'foto'> | null;
  bens: { tipo: string; descricao: string | null; valor: number }[];
  bens_por_tipo: { tipo: string; valor: number; n: number }[];
  historico: HistoricoItem[];
  redes: string[];
  propostas: string[];
  financas: {
    receitas_por_origem: { origem: string; valor: number }[];
    receitas_por_fonte: { fonte: string; valor: number }[];
    maiores_doadores: { doador: string; tipo: string; origem: string; valor: number }[];
    despesas_por_categoria: { categoria: string; valor: number }[];
    maiores_fornecedores: { fornecedor: string; valor: number }[];
  };
  mandato: ParlamentarDetalhe | null;
  resultados: { turno: number; votos: number | null; pct: number | null; situacao: string | null; eleito: number }[];
  fontes: string[];
}

export interface ListaMajoritarios {
  uf: string;
  nome: string;
  vagas: Partial<Record<Cargo, number>>;
  governador: Candidato[];
  senador: Candidato[];
  fontes: string[];
}

export interface ListaPresidente {
  uf: 'BR';
  cargo: 'presidente';
  candidatos: Candidato[];
  fontes: string[];
}

export interface DeputadoResumo {
  sq: string;
  cargo: Cargo;
  numero: string;
  nome_urna: string;
  partido: string;
  federacao: string | null;
  situacao: string | null;
  na_urna: boolean;
  genero: string | null;
  cor_raca: string | null;
  idade: number | null;
  instrucao: string | null;
  ocupacao: string | null;
  mandato_atual: string | null;
  eleito_ultima: string | null;
  resultado: string | null;
  bens_total: number;
  receitas: number | null;
  despesas: number | null;
  foto: string | null;
}

export interface ListaDeputados {
  uf: string;
  nome: string;
  vagas: Partial<Record<Cargo, number>>;
  candidatos: DeputadoResumo[];
  fontes: string[];
}

/** [sq, nome_urna, nome, numero, uf, cargo, partido] */
export type BuscaItem = [string, string, string, string, string, Cargo, string];

export interface Partido {
  partido: string;
  partido_nome: string;
  partido_numero: string;
  federacao: string | null;
  federacao_nome: string | null;
  deputados: number;
  senadores: number;
  congresso: number;
  congresso_agremiacao: number;
  criterio_debate: number;
}

export type PorCargo<T> = Partial<Record<Cargo, T>>;

export interface Estatisticas {
  genero: PorCargo<Record<string, number>>;
  cor_raca: PorCargo<Record<string, number>>;
  instrucao: PorCargo<Record<string, number>>;
  faixa_etaria: PorCargo<Record<string, number>>;
  ocupacoes: PorCargo<{ ocupacao: string; n: number }[]>;
  bens: PorCargo<{ mediana: number; zero: number; acima_1mi: number; n: number }>;
  receitas_por_fonte: PorCargo<Record<string, number>>;
  situacao_registro: PorCargo<Record<string, number>>;
  concorrencia: { uf: string; cargo: Cargo; vagas: number; candidatos: number; por_vaga: number }[];
  por_partido: { partido: string; cargo: Cargo; n: number }[];
  fontes: string[];
}

export interface ParlamentarResumo {
  id: string;
  casa: 'camara' | 'senado';
  nome: string;
  partido: string | null;
  uf: string | null;
  foto_url: string | null;
  pagina_oficial: string | null;
  em_exercicio: boolean;
  candidato_sq: string | null;
  candidato_cargo: Cargo | null;
  candidato_uf: string | null;
  candidato_na_urna: boolean | null;
  /** Per year: total, months with records, airfare subtotal and total ÷ months. */
  por_ano: Record<string, { valor: number; meses: number; passagens: number; media_mensal: number | null }>;
  por_categoria: Record<string, number>;
  total: number;
}

export interface AvisoGastos {
  casa: 'camara' | 'senado' | 'ambas';
  /** Years affected (empty = all). */
  anos: number[];
  texto: string;
}

export interface LimiteMensal {
  valor_mensal: number;
  vigencia: string | null;
  fonte_url: string;
}

export interface ListaParlamentares {
  parlamentares: ParlamentarResumo[];
  anos: number[];
  limites: ({ casa: string; uf: string } & LimiteMensal)[];
  avisos: AvisoGastos[];
  fontes: string[];
}

export interface ParlamentarDetalhe {
  id: string;
  casa: 'camara' | 'senado';
  id_casa: string;
  nome: string;
  nome_civil: string | null;
  partido: string | null;
  uf: string | null;
  foto_url: string | null;
  pagina_oficial: string | null;
  em_exercicio: boolean;
  mensal: { ano: number; mes: number; valor: number }[];
  por_categoria: { ano: number; categoria: string; valor: number; n: number }[];
  fornecedores: { ano: number; fornecedor: string; cnpj_cpf: string | null; valor: number; n_documentos: number }[];
  total: number;
  por_ano: { ano: number; valor: number; meses: number; media_mensal: number }[];
  /** Mean of colleagues' monthly averages (same casa + UF, same year). */
  media_uf_por_ano: { ano: number; media_mensal: number; n: number }[];
  limite_mensal: LimiteMensal | null;
  avisos: AvisoGastos[];
  candidato?: Candidato | null;
  fontes: string[];
}

export interface ResultadoCandidato {
  sq: string;
  numero: string;
  nome: string;
  nome_urna: string | null;
  partido: string | null;
  votos: number | null;
  pct: number | null;
  situacao: string | null;
  eleito: number;
  foto: string | null;
}

export interface Resultados {
  fase: Fase;
  disputas: {
    turno: number;
    uf: string;
    cargo: Cargo;
    pct_secoes: number | null;
    atualizado: string;
    url: string;
    candidatos: ResultadoCandidato[];
  }[];
  fontes: string[];
}

export interface Pesquisa {
  id: string;
  cargo: Cargo;
  turno: number;
  cenario: string;
  abrangencia: string;
  instituto: string;
  instituto_curto: string;
  contratante: string;
  registro_tse: string;
  campo_inicio: string;
  campo_fim: string;
  divulgacao: string;
  entrevistas: number;
  margem_erro_pp: number;
  confianca_pct: number;
  metodologia: string | null;
  observacoes: string | null;
  fontes: { titulo: string; url: string; tipo: string }[];
  outros: { rotulo: string; pct: number }[];
  resultados: { nome: string; partido: string | null; pct: number; sq: string | null; foto: string | null; na_urna: boolean }[];
}

export interface ListaPesquisas {
  pesquisas: Pesquisa[];
  fontes: string[];
}

export interface SegundoTurno {
  fase: Fase;
  disputas: { uf: string; nome_uf: string; cargo: Cargo; candidatos: CandidatoDetalhe[] }[];
  fontes: string[];
}

/** Composição atual de cada Casa e presidência (api/plenario.json, atualizado todo dia). */
export interface MembroPlenario {
  id: string;
  nome: string;
  partido: string;
  uf: string | null;
  foto: string | null;
  /** Há página de gastos de mandato deste parlamentar no site. */
  perfil: boolean;
}

export interface CasaPlenario {
  legislatura: number | null;
  membros: MembroPlenario[];
  /** desde/ate: vigência do mandato na presidência, como publicada pela Casa (ate só se publicado). */
  presidente: (MembroPlenario & { desde: string | null; ate?: string | null }) | null;
  coletado_em: string | null;
}

export interface Plenario {
  camara: CasaPlenario | null;
  senado: CasaPlenario | null;
  /** Sigla → nome e símbolo oficial (caminho dentro de api/). */
  /** fundo: cor atrás do logo (logos brancos); fonte_logo: site oficial de onde veio o logo. */
  partidos: Record<string, { nome: string | null; logo: string | null; fundo?: string | null; fonte_logo?: string | null }>;
}

/** Executivo com mandato 2023–2026 (eleitos em 2022), de api/executivos.json. */
export interface ExecutivoEleito {
  cargo: 'presidente' | 'vice-presidente' | 'governador' | 'vice-governador';
  /** "BR" para Presidente/Vice. */
  uf: string;
  nome_urna: string;
  partido_2022: string;
  partido_2026: string | null;
  /** Partido para agrupar (o de 2026, se concorre de novo; senão o de 2022). */
  partido: string;
  partido_origem: string;
  sq_2022: string;
  sq_2026: string | null;
  candidatura_2026: string | null;
  foto: string | null;
  /** Concorre a outro cargo em 2026: deixou o mandato (Constituição, art. 14, § 6º). */
  deixou_cargo: boolean;
}

export interface Executivos {
  mandato: string;
  fonte: string;
  aviso: string;
  gerado_em: string;
  eleitos: ExecutivoEleito[];
}

/** Notícias recentes na imprensa (api/noticias/...; coleta diária, não são dados oficiais). */
export interface Noticia {
  titulo: string;
  fonte: string | null;
  fonte_url: string | null;
  link: string;
  data: string;
}

export interface FeedNoticiasDados {
  consulta: string;
  atualizado_em: string;
  fonte: string;
  itens: Noticia[];
}

/** Eleitos para Assembleias (2022) e Câmaras Municipais (2024), de api/legislativos/ (TSE). */
export interface EleitoLegislativo {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  numero: string;
  situacao: string;
}
export interface LegislativosEstaduais {
  eleicao: number;
  mandato: string;
  fonte: string;
  casas: Record<string, { nome: string; membros: EleitoLegislativo[] }>;
}
export interface VereadoresUf {
  uf: string;
  eleicao: number;
  mandato: string;
  fonte: string;
  municipios: Record<string, { nome: string; membros: EleitoLegislativo[] }>;
}
