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
  /** Data (ISO, UTC) do arquivo de prestação de contas do TSE usado nas finanças. Ausente em JSON antigos. */
  contas_atualizadas_em?: string | null;
  /** Só para quem foi eleito em 2026 e declarou receitas: receitas ÷ votos do turno que elegeu. */
  custo_por_voto?: CustoPorVoto | null;
}

export interface CustoPorVoto {
  /** R$ por voto, arredondado a centavos. */
  valor: number;
  receitas: number;
  votos: number;
  turno: number;
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
  /** Página do site para esta cadeira, quando não é a de gastos (ex.: candidatura de quem foi eleito). */
  link?: string | null;
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
  /** Hora da fonte incerta (Bing): mostrar só o dia. */
  so_dia?: boolean;
}

export interface FeedNoticiasDados {
  consulta: string;
  atualizado_em: string;
  fonte: string;
  itens: Noticia[];
}

/** Uma votação nominal do Plenário (catálogo api/votacoes/<casa>.json). */
export interface VotacaoNominal {
  /** AAAA-MM-DD */
  data: string;
  proposicao: string | null;
  ementa: string | null;
  descricao: string | null;
  resultado: string | null;
  placar: string | null;
  url: string | null;
  url_sessao: string | null;
  secreta?: boolean;
}

export interface VotacoesParlamentar {
  id: string;
  casa: 'camara' | 'senado';
  nome: string | null;
  /** Início da legislatura (AAAA-MM-DD). */
  inicio: string;
  resumo: {
    /** Votações nominais enquanto estava no cargo; null = sem base oficial para o total. */
    total: number | null;
    /** Registrou voto ou presidia a sessão. */
    participou: number;
    votou: number;
    presidiu: number;
    percentual: number | null;
    votos: Record<string, number>;
  };
  por_ano: { ano: number; total: number | null; participou: number }[];
  /** Descrição oficial dos códigos (Senado). */
  legenda: Record<string, string>;
  /** Câmara: períodos de exercício [início, fim] pelo histórico oficial. */
  exercicio: [string, string | null][] | null;
  /** true = Câmara sem histórico de exercício: total desconhecido. */
  sem_periodo: boolean;
  /** Mais recentes primeiro; os dados de cada votação estão no catálogo da Casa. Voto como publicado:
   * "Sim", "Não", "Abstenção", "Obstrução", "Artigo 17", "Votou" (secreta), códigos do Senado (AP, LS,
   * MIS, P-NRV...) ou "Sem registro" (Câmara: em exercício, mas fora da lista de votos). */
  itens: { id: string; voto: string }[];
  atualizado_em: string;
}

/** Catálogo das votações de uma Casa (api/votacoes/<casa>.json): dados de cada votação, critério e fonte. */
export interface VotacoesCatalogo {
  casa: 'camara' | 'senado';
  inicio: string;
  criterio: string;
  fonte: { nome: string; url: string; pagina: string };
  votacoes: Record<string, VotacaoNominal>;
  atualizado_em: string;
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
  municipios: Record<
    string,
    {
      nome: string;
      membros: EleitoLegislativo[];
      /** Prefeito(a) e vice eleitos em 2024 (turno = em que turno se decidiu). */
      executivo?: { prefeito?: EleitoLegislativo & { sq: string; turno: string }; vice?: EleitoLegislativo & { sq: string; turno: string } };
    }
  >;
}

/* ------------------------------------------------------------------ STF (api/stf.json) */

export interface MinistroStf {
  id: string;
  nome: string;
  nome_completo: string;
  /** "Ministro" ou "Ministra", como o STF identifica na pasta. */
  tratamento?: 'Ministro' | 'Ministra';
  cargo: 'Presidente' | 'Vice-Presidente' | null;
  /** 0 = quem preside; depois, do mais antigo ao mais novo na Corte. */
  antiguidade: number;
  nascimento: string | null;
  naturalidade: string | null;
  datas: { indicacao?: string; nomeacao?: string; posse?: string; posse_vice?: string; posse_presidencia?: string };
  /** Presidente da República que assinou a nomeação (chave de `presidentes`). */
  nomeado_por: string | null;
  pasta: string;
  foto: string | null;
  remuneracao: { ref: string; bruto: number | null; liquido: number | null; subsidio: number | null; funcao: string | null } | null;
  viagens: {
    anos: Record<string, ResumoViagensAno>;
    passagens: number;
    diarias: number;
  };
}

export interface ResumoViagensAno {
  passagens: number;
  passagens_valor: number;
  diarias: number;
  diarias_brl: number;
  diarias_usd: number;
}

export interface PresidenteRepublica {
  nome: string;
  mandatos: { inicio: string; fim: string }[];
  foto: string | null;
  foto_credito?: string | null;
  foto_licenca?: string | null;
  foto_pagina?: string | null;
}

export interface FonteStf {
  nome: string;
  orgao: string;
  url: string;
}

export interface Stf {
  cadeiras: number;
  desde: string | null;
  /** Observação oficial da composição (ex.: aposentadoria que abriu a vaga). */
  nota: string | null;
  pgr: { nome: string; desde: string | null } | null;
  fonte_composicao: string | null;
  ministros: MinistroStf[];
  presidentes: Record<string, PresidenteRepublica>;
  remuneracao_ok: boolean;
  viagens_atualizado_em: string | null;
  fontes: Record<'composicao' | 'pastas' | 'remuneracao' | 'viagens' | 'nomeacao', FonteStf>;
  coletado_em: string | null;
}

export interface FolhaStf {
  ref: string;
  folha: string;
  funcao: string | null;
  bruto: number | null;
  liquido: number | null;
  /** Parcelas (A) a (S) da Resolução CNJ 215/2015, como o STF publica. */
  parcelas: Record<string, number>;
}

export interface PassagemStf {
  id: string;
  motivo: string | null;
  ida: string | null;
  volta: string | null;
  tipo: string;
  trecho: string | null;
  bilhete: number | null;
  reembolso: number | null;
  custo: number | null;
  mes: string | null;
}

export interface DiariaStf {
  id: string;
  motivo: string | null;
  tipo: string;
  moeda: 'BRL' | 'USD';
  ida: string | null;
  volta: string | null;
  destino: string | null;
  valor: number | null;
  quantidade: number | null;
  mes: string | null;
}

export interface MinistroStfDetalhe {
  id: string;
  remuneracao: FolhaStf[];
  viagens: { passagens: PassagemStf[]; diarias: DiariaStf[] };
  resumo_viagens: Record<string, ResumoViagensAno>;
}

/* ------------------------------------------------------------------ eleitos (api/eleitos.json) */

export interface MembroEleito {
  id: string;
  sq?: string;
  nome: string;
  partido: string;
  uf: string | null;
  numero?: string;
  situacao: string;
  votos?: number | null;
  foto: string | null;
  /** Senador eleito antes, com mandato até o fim da próxima legislatura. */
  continua?: boolean;
}

export interface Eleitos {
  eleicao: number;
  /** Posse da nova legislatura (AAAA-MM-DD). */
  posse: string;
  mandato: string;
  camara: { membros: MembroEleito[]; completo: boolean };
  senado: { membros: MembroEleito[]; completo: boolean; continuam: number };
  assembleias: Record<string, { nome: string; membros: MembroEleito[]; completo: boolean }>;
  partidos: Record<string, string>;
  fontes: { tse: string; senado: string };
  gerado_em: string;
}

/* ------------------------------------------------------------------ emendas parlamentares (CGU) */

/** Tipo de emenda, em chave curta (o resumo traz o texto publicado pela CGU). */
export type TipoEmenda = 'individual' | 'especial' | 'bancada' | 'comissao' | 'relator' | 'outro';
/** Quem indicou: parlamentar (emenda individual), bancada estadual, comissão ou relator-geral. */
export type TipoAutorEmenda = 'parlamentar' | 'bancada' | 'comissao' | 'relator' | 'outro';

export interface FonteEmendas {
  nome: string;
  orgao: string;
  /** Página do conjunto de dados no Portal da Transparência. */
  url: string;
  /** Data do arquivo publicado pela CGU (Last-Modified do servidor). */
  arquivo_atualizado_em: string | null;
  /** Endereço de uma emenda no Portal da Transparência: troque {codigo} pelo código. */
  link_emenda: string;
}

/** Valores em reais, como publicados: `valor` é tudo; `prefeitura`, só prefeitura e órgãos municipais. */
export interface ValorEmenda {
  valor: number;
  prefeitura: number;
}

export interface EstagiosEmenda {
  empenhado: number;
  liquidado: number;
  pago: number;
  /** Restos a pagar pagos: pagos em anos seguintes ao da emenda. */
  rp_pago: number;
  emendas: number;
}

export interface AutorEmenda {
  /** Nome do autor exatamente como publicado pela CGU. */
  autor: string;
  autor_tipo: TipoAutorEmenda;
  /** Presentes quando o autor é um parlamentar em exercício com página no site. */
  id?: string;
  nome?: string;
  partido?: string | null;
  uf?: string | null;
}

export interface EmendaMunicipio extends AutorEmenda, ValorEmenda {
  codigo: string;
  ano: number;
  tipo: TipoEmenda;
  funcao: string;
  acao: string;
  localidade: string;
}

export interface EmendasMunicipio {
  uf: string;
  /** Código do município no TSE. */
  cd: string;
  ibge: string;
  nome: string;
  periodo: { desde: number };
  /** Pagamentos a favorecidos sediados no município, pela data do pagamento. */
  recebido: {
    total: number;
    prefeitura: number;
    emendas: number;
    por_ano: ({ ano: number } & ValorEmenda)[];
    por_autor: (AutorEmenda & ValorEmenda)[];
    por_funcao: ({ nome: string } & ValorEmenda)[];
    por_favorecido: { nome: string; valor: number }[];
    por_tipo: ({ nome: TipoEmenda } & ValorEmenda)[];
  };
  /** Emendas cuja localidade de aplicação é o próprio município, pelo ano da emenda. */
  destinadas: { total: EstagiosEmenda; por_ano: ({ ano: number } & EstagiosEmenda)[] };
  maiores: EmendaMunicipio[];
  fonte: FonteEmendas;
}

export interface EmendasUf {
  uf: string;
  nome: string;
  periodo: { desde: number };
  recebido_municipios: { total: number; prefeitura: number; por_ano: ({ ano: number } & ValorEmenda)[] };
  governo_estadual: { total: number; por_ano: { ano: number; valor: number }[] };
  destinadas: { total: EstagiosEmenda; por_ano: ({ ano: number } & EstagiosEmenda)[] };
  /** Todos os municípios da UF (código TSE), do maior valor recebido para o menor. */
  municipios: { cd: string; nome: string; recebido: number; prefeitura: number; emendas: number }[];
  fonte: FonteEmendas;
}

export interface EmendaParlamentar {
  codigo: string;
  ano: number;
  tipo: TipoEmenda;
  numero: string;
  localidade: string;
  funcao: string;
  acao: string;
  empenhado: number;
  liquidado: number;
  pago: number;
  rp_pago: number;
}

export interface EmendasParlamentar {
  id: string;
  nome: string;
  partido: string | null;
  uf: string | null;
  /** Nome(s) do autor como publicados pela CGU. */
  autor_cgu: string[];
  periodo: { desde: number };
  total: EstagiosEmenda;
  por_ano: ({ ano: number } & EstagiosEmenda)[];
  pagamentos: { total: number; por_ano: { ano: number; valor: number }[]; sem_municipio: number };
  destinos_uf: { uf: string; nome: string; valor: number }[];
  destinos_municipio: { uf: string; cd: string; nome: string; valor: number }[];
  emendas: EmendaParlamentar[];
  fonte: FonteEmendas;
}

export interface ResumoEmendas {
  fonte: {
    nome: string;
    orgao: string;
    url: string;
    pagina: string;
    dicionario: string;
    arquivo_atualizado_em: string | null;
    gerado_em: string | null;
    coletado_em: string;
  };
  periodo: { desde: number; ate: number };
  tipos: Record<string, string>;
  link_emenda: string;
  valores: string;
  emendas_por_ano: ({ ano: number } & EstagiosEmenda)[];
  emendas_por_tipo: ({ tipo: TipoEmenda; nome: string } & EstagiosEmenda)[];
  /** Pagamentos de cada ano: a favorecidos em municípios, ao governo do estado e sem município identificado. */
  pagamentos_por_ano: { ano: number; total: number; municipios: number; governo_estadual: number; sem_municipio: number }[];
  sem_municipio_por_motivo: { motivo: string; valor: number }[];
  ufs: { uf: string; nome: string; recebido_municipios: number; prefeitura: number; governo_estadual: number; municipios_com_pagamento: number; municipios: number }[];
}
