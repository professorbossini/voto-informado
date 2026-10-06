/**
 * Presidentes da República desde 1889, no mesmo formato para todos: como chegou ao cargo, como
 * saiu e marcos institucionais objetivos (Constituições, emendas, leis com número, moedas, obras,
 * guerras e fatos históricos registrados oficialmente). Nenhuma avaliação de governo.
 *
 * Datas de início e fim do exercício como na Galeria dos Presidentes da Biblioteca da Presidência
 * da República; leis e emendas citadas pelo número oficial.
 */

/** Resultado de um turno: quem venceu e quem ficou em 2º, com votos (e % dos votos válidos, quando há). */
export interface Turno {
  turno: 1 | 2;
  votos: number;
  pct?: number;
  segundo?: { nome: string; votos: number; pct?: number };
}

export interface Eleicao {
  ano: number;
  /** direta: voto popular; indireta: Congresso, Assembleia Constituinte ou Colégio Eleitoral. */
  tipo: 'direta' | 'indireta';
  /** Quem votou, nas indiretas. */
  colegio?: string;
  turnos: Turno[];
  nota?: string;
}

export interface Presidencia {
  id: string;
  /** Arquivo do retrato (public/presidentes/<foto>.jpg); juntas não têm. */
  foto: string | null;
  nome: string;
  /** Integrantes, quando o governo foi exercido por uma junta. */
  junta?: string[];
  inicio: string;
  /** null = em exercício. */
  fim: string | null;
  chegada: string;
  saida: string | null;
  marcos: string[];
  /** Observação (ex.: interinidade, eleito que não tomou posse). */
  nota?: string;
  /** Eleito que não chegou a exercer (Tancredo Neves). */
  naoExerceu?: boolean;
  /** Eleições para presidente vencidas (vazio: assumiu sem ser eleito presidente). */
  eleicoes?: Eleicao[];
}

export interface Era {
  id: string;
  nome: string;
  inicio: string;
  fim: string | null;
  resumo: string;
}

export const ERAS: Era[] = [
  {
    id: 'primeira-republica',
    nome: 'Primeira República',
    inicio: '1889-11-15',
    fim: '1930-10-24',
    resumo:
      'Da Proclamação da República à Revolução de 1930. Constituição de 1891, eleições diretas com voto aberto e restrito.',
  },
  {
    id: 'era-vargas',
    nome: 'Era Vargas',
    inicio: '1930-10-24',
    fim: '1945-10-29',
    resumo:
      'Governo Provisório, Constituição de 1934 e Estado Novo (Constituição de 1937), até a deposição de Getúlio Vargas.',
  },
  {
    id: 'republica-1946',
    nome: 'República de 1946',
    inicio: '1945-10-29',
    fim: '1964-04-01',
    resumo:
      'Constituição de 1946, eleições diretas para presidente e mudança da capital para Brasília.',
  },
  {
    id: 'governos-militares',
    nome: 'Governos militares',
    inicio: '1964-04-01',
    fim: '1985-03-15',
    resumo:
      'Presidentes eleitos de forma indireta, Atos Institucionais e Constituição de 1967, até a abertura política.',
  },
  {
    id: 'nova-republica',
    nome: 'Nova República',
    inicio: '1985-03-15',
    fim: null,
    resumo: 'Constituição de 1988 e eleições diretas para presidente desde 1989.',
  },
];

export const PRESIDENCIAS: Presidencia[] = [
  {
    id: 'deodoro',
    foto: 'deodoro',
    nome: 'Deodoro da Fonseca',
    inicio: '1889-11-15',
    fim: '1891-11-23',
    chegada:
      'Chefe do Governo Provisório após a Proclamação da República; eleito pelo Congresso Constituinte em 25/02/1891.',
    saida: 'Renúncia, depois de decretar a dissolução do Congresso.',
    marcos: [
      'Proclamação da República (15/11/1889)',
      'Separação entre Igreja e Estado (Decreto 119-A, de 1890)',
      'Primeira Constituição da República (24/02/1891)',
    ],

    eleicoes: [
      {
        ano: 1891,
        tipo: 'indireta',
        colegio: 'Congresso Constituinte',
        turnos: [{ turno: 1, votos: 129, segundo: { nome: 'Prudente de Morais', votos: 97 } }],
      },
    ],
  },
  {
    id: 'floriano',
    foto: 'floriano',
    nome: 'Floriano Peixoto',
    inicio: '1891-11-23',
    fim: '1894-11-15',
    chegada: 'Vice-presidente; assumiu com a renúncia de Deodoro da Fonseca.',
    saida: 'Fim do mandato.',
    marcos: ['Revolta da Armada (1893–1894)', 'Revolução Federalista, no Sul (1893–1895)'],
  },
  {
    id: 'prudente',
    foto: 'prudente',
    nome: 'Prudente de Morais',
    inicio: '1894-11-15',
    fim: '1898-11-15',
    chegada: 'Eleição direta; primeiro presidente civil.',
    saida: 'Fim do mandato.',
    marcos: ['Guerra de Canudos (1896–1897)'],
    nota: 'Afastado por doença de novembro de 1896 a março de 1897; o vice, Manuel Vitorino, exerceu a Presidência.',

    eleicoes: [
      {
        ano: 1894,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 276583, segundo: { nome: 'Afonso Pena', votos: 38291 } }],
      },
    ],
  },
  {
    id: 'campos-sales',
    foto: 'campos-sales',
    nome: 'Campos Sales',
    inicio: '1898-11-15',
    fim: '1902-11-15',
    chegada: 'Eleição direta.',
    saida: 'Fim do mandato.',
    marcos: [
      'Renegociação da dívida externa (funding loan), acertada em 1898',
      '“Política dos governadores”, acordo entre o governo federal e os governos estaduais',
    ],

    eleicoes: [
      {
        ano: 1898,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 420286, segundo: { nome: 'Lauro Sodré', votos: 38929 } }],
      },
    ],
  },
  {
    id: 'rodrigues-alves',
    foto: 'rodrigues-alves',
    nome: 'Rodrigues Alves',
    inicio: '1902-11-15',
    fim: '1906-11-15',
    chegada: 'Eleição direta.',
    saida: 'Fim do mandato.',
    marcos: [
      'Tratado de Petrópolis (1903): o Acre passa a integrar o Brasil',
      'Reforma urbana e vacinação obrigatória no Rio de Janeiro; Revolta da Vacina (1904)',
    ],
    nota: 'Eleito de novo em 1918, com 386.467 votos (2º: Nilo Peçanha, 1.258), morreu em janeiro de 1919 sem tomar posse.',

    eleicoes: [
      {
        ano: 1902,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 592039, segundo: { nome: 'Quintino Bocaiúva', votos: 42542 } }],
      },
    ],
  },
  {
    id: 'afonso-pena',
    foto: 'afonso-pena',
    nome: 'Afonso Pena',
    inicio: '1906-11-15',
    fim: '1909-06-14',
    chegada: 'Eleição direta.',
    saida: 'Morte no cargo.',
    marcos: [
      'Comissão Rondon: linhas telegráficas de Mato Grosso ao Amazonas (a partir de 1907)',
      'Incentivo à imigração e expansão das ferrovias',
    ],

    eleicoes: [
      {
        ano: 1906,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 288285, segundo: { nome: 'Lauro Sodré', votos: 4865 } }],
      },
    ],
  },
  {
    id: 'nilo-pecanha',
    foto: 'nilo-pecanha',
    nome: 'Nilo Peçanha',
    inicio: '1909-06-14',
    fim: '1910-11-15',
    chegada: 'Vice-presidente; assumiu com a morte de Afonso Pena.',
    saida: 'Fim do mandato.',
    marcos: [
      'Escolas de Aprendizes Artífices (Decreto 7.566, de 1909), origem da rede federal de ensino técnico',
      'Criação do Serviço de Proteção aos Índios (1910)',
    ],
  },
  {
    id: 'hermes',
    foto: 'hermes',
    nome: 'Hermes da Fonseca',
    inicio: '1910-11-15',
    fim: '1914-11-15',
    chegada: 'Eleição direta.',
    saida: 'Fim do mandato.',
    marcos: ['Revolta da Chibata (1910)', 'Guerra do Contestado (1912–1916)'],

    eleicoes: [
      {
        ano: 1910,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 403867, segundo: { nome: 'Rui Barbosa', votos: 222822 } }],
      },
    ],
  },
  {
    id: 'venceslau',
    foto: 'venceslau',
    nome: 'Venceslau Brás',
    inicio: '1914-11-15',
    fim: '1918-11-15',
    chegada: 'Eleição direta.',
    saida: 'Fim do mandato.',
    marcos: [
      'Código Civil (Lei 3.071, de 1916)',
      'Greve geral de 1917',
      'Entrada do Brasil na Primeira Guerra Mundial (1917)',
    ],

    eleicoes: [
      {
        ano: 1914,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 532107, segundo: { nome: 'Rui Barbosa', votos: 47782 } }],
      },
    ],
  },
  {
    id: 'delfim',
    foto: 'delfim',
    nome: 'Delfim Moreira',
    inicio: '1918-11-15',
    fim: '1919-07-28',
    chegada:
      'Vice-presidente; assumiu porque o presidente eleito, Rodrigues Alves, adoeceu e morreu sem tomar posse.',
    saida: 'Posse do presidente escolhido em nova eleição (1919).',
    marcos: ['Nova eleição presidencial (abril de 1919)'],
  },
  {
    id: 'epitacio',
    foto: 'epitacio',
    nome: 'Epitácio Pessoa',
    inicio: '1919-07-28',
    fim: '1922-11-15',
    chegada: 'Eleição direta (eleição de 1919).',
    saida: 'Fim do mandato.',
    marcos: [
      'Centenário da Independência (1922) e primeira transmissão pública de rádio no país',
      'Revolta dos 18 do Forte de Copacabana (1922)',
    ],

    eleicoes: [
      {
        ano: 1919,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 286373, segundo: { nome: 'Rui Barbosa', votos: 116414 } }],
      },
    ],
  },
  {
    id: 'bernardes',
    foto: 'bernardes',
    nome: 'Artur Bernardes',
    inicio: '1922-11-15',
    fim: '1926-11-15',
    chegada: 'Eleição direta.',
    saida: 'Fim do mandato.',
    marcos: [
      'Estado de sítio durante a maior parte do mandato',
      'Revolta de 1924 em São Paulo e Coluna Prestes (1925–1927)',
      'Reforma da Constituição de 1891 (1926)',
    ],

    eleicoes: [
      {
        ano: 1922,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 466877, segundo: { nome: 'Nilo Peçanha', votos: 317714 } }],
      },
    ],
  },
  {
    id: 'washington-luis',
    foto: 'washington-luis',
    nome: 'Washington Luís',
    inicio: '1926-11-15',
    fim: '1930-10-24',
    chegada: 'Eleição direta.',
    saida:
      'Deposto pela Revolução de 1930; o eleito em março de 1930, Júlio Prestes (1.091.709 votos, contra 742.794 de Getúlio Vargas), não tomou posse.',
    marcos: [
      'Rodovias Rio–São Paulo e Rio–Petrópolis (1928)',
      'Crise econômica mundial de 1929 e queda do preço do café',
    ],

    eleicoes: [
      {
        ano: 1926,
        tipo: 'direta',
        turnos: [{ turno: 1, votos: 688528, segundo: { nome: 'Assis Brasil', votos: 1116 } }],
      },
    ],
  },
  {
    id: 'junta-1930',
    foto: null,
    nome: 'Junta Governativa Provisória de 1930',
    junta: [
      'General Augusto Tasso Fragoso',
      'General João de Deus Mena Barreto',
      'Almirante José Isaías de Noronha',
    ],
    inicio: '1930-10-24',
    fim: '1930-11-03',
    chegada: 'Assumiu com a deposição de Washington Luís.',
    saida: 'Entregou o governo a Getúlio Vargas.',
    marcos: [],
  },
  {
    id: 'vargas-1930',
    foto: 'vargas',
    nome: 'Getúlio Vargas',
    inicio: '1930-11-03',
    fim: '1945-10-29',
    chegada:
      'Chefe do Governo Provisório após a Revolução de 1930; eleito pela Assembleia Constituinte em 1934; a partir de 1937, no Estado Novo.',
    saida: 'Deposto pelos militares.',
    marcos: [
      'Código Eleitoral de 1932: voto secreto, voto feminino e criação da Justiça Eleitoral',
      'Revolução Constitucionalista (1932), Constituição de 1934 e Constituição de 1937 (Estado Novo)',
      'Consolidação das Leis do Trabalho (1943) e participação na Segunda Guerra Mundial (1942–1945)',
    ],

    eleicoes: [
      {
        ano: 1934,
        tipo: 'indireta',
        colegio: 'Assembleia Nacional Constituinte',
        turnos: [{ turno: 1, votos: 175, segundo: { nome: 'Borges de Medeiros', votos: 59 } }],
      },
    ],
  },
  {
    id: 'linhares',
    foto: 'linhares',
    nome: 'José Linhares',
    inicio: '1945-10-29',
    fim: '1946-01-31',
    chegada: 'Presidente do Supremo Tribunal Federal; assumiu com a deposição de Getúlio Vargas.',
    saida: 'Posse do presidente eleito.',
    marcos: ['Eleições de 2 de dezembro de 1945, para presidente e para a Assembleia Constituinte'],
  },
  {
    id: 'dutra',
    foto: 'dutra',
    nome: 'Eurico Gaspar Dutra',
    inicio: '1946-01-31',
    fim: '1951-01-31',
    chegada: 'Eleição direta (1945).',
    saida: 'Fim do mandato.',
    marcos: [
      'Constituição de 1946 (18/09/1946)',
      'Proibição dos jogos de azar (Decreto-Lei 9.215, de 1946)',
    ],

    eleicoes: [
      {
        ano: 1945,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 3251377,
            pct: 55.38,
            segundo: { nome: 'Eduardo Gomes', votos: 2039337, pct: 34.74 },
          },
        ],
      },
    ],
  },
  {
    id: 'vargas-1951',
    foto: 'vargas',
    nome: 'Getúlio Vargas',
    inicio: '1951-01-31',
    fim: '1954-08-24',
    chegada: 'Eleição direta (1950).',
    saida: 'Morte no cargo (suicídio).',
    marcos: ['Criação do BNDE, atual BNDES (1952)', 'Criação da Petrobras (Lei 2.004, de 1953)'],

    eleicoes: [
      {
        ano: 1950,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 3849040,
            pct: 48.73,
            segundo: { nome: 'Eduardo Gomes', votos: 2342384, pct: 29.66 },
          },
        ],
      },
    ],
  },
  {
    id: 'cafe-filho',
    foto: 'cafe-filho',
    nome: 'Café Filho',
    inicio: '1954-08-24',
    fim: '1955-11-08',
    chegada: 'Vice-presidente; assumiu com a morte de Getúlio Vargas.',
    saida: 'Afastou-se por motivo de saúde e foi impedido pelo Congresso de reassumir.',
    marcos: ['Eleição presidencial de outubro de 1955'],
  },
  {
    id: 'carlos-luz',
    foto: 'carlos-luz',
    nome: 'Carlos Luz',
    inicio: '1955-11-08',
    fim: '1955-11-11',
    chegada: 'Presidente da Câmara dos Deputados; assumiu com o afastamento de Café Filho.',
    saida:
      'Deposto no movimento militar de 11 de novembro de 1955, que assegurou a posse do presidente eleito.',
    marcos: [],
  },
  {
    id: 'nereu',
    foto: 'nereu',
    nome: 'Nereu Ramos',
    inicio: '1955-11-11',
    fim: '1956-01-31',
    chegada: 'Vice-presidente do Senado; assumiu por decisão do Congresso Nacional.',
    saida: 'Posse do presidente eleito.',
    marcos: ['Estado de sítio até a posse do presidente eleito'],
  },
  {
    id: 'jk',
    foto: 'jk',
    nome: 'Juscelino Kubitschek',
    inicio: '1956-01-31',
    fim: '1961-01-31',
    chegada: 'Eleição direta (1955).',
    saida: 'Fim do mandato.',
    marcos: [
      'Plano de Metas',
      'Criação da Sudene (1959)',
      'Inauguração de Brasília, nova capital (21/04/1960)',
    ],

    eleicoes: [
      {
        ano: 1955,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 3077411,
            pct: 35.68,
            segundo: { nome: 'Juarez Távora', votos: 2610462, pct: 30.27 },
          },
        ],
      },
    ],
  },
  {
    id: 'janio',
    foto: 'janio',
    nome: 'Jânio Quadros',
    inicio: '1961-01-31',
    fim: '1961-08-25',
    chegada: 'Eleição direta (1960).',
    saida: 'Renúncia.',
    marcos: [],

    eleicoes: [
      {
        ano: 1960,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 5636623,
            pct: 48.26,
            segundo: { nome: 'Henrique Lott', votos: 3846825, pct: 32.94 },
          },
        ],
      },
    ],
  },
  {
    id: 'mazzilli-1961',
    foto: 'mazzilli',
    nome: 'Ranieri Mazzilli',
    inicio: '1961-08-25',
    fim: '1961-09-07',
    chegada:
      'Presidente da Câmara dos Deputados; assumiu interinamente com a renúncia de Jânio Quadros.',
    saida: 'Posse do vice-presidente, João Goulart.',
    marcos: ['Adoção do parlamentarismo (Emenda Constitucional 4, de 1961)'],
  },
  {
    id: 'jango',
    foto: 'jango',
    nome: 'João Goulart',
    inicio: '1961-09-07',
    fim: '1964-04-01',
    chegada: 'Vice-presidente; assumiu após a renúncia de Jânio Quadros, sob o parlamentarismo.',
    saida:
      'Deposto pelo golpe militar de 1964; em 02/04/1964 o Congresso declarou vaga a Presidência.',
    marcos: [
      '13º salário (Lei 4.090, de 1962)',
      'Plebiscito de 1963: volta do presidencialismo',
      'Estatuto do Trabalhador Rural (1963)',
    ],
  },
  {
    id: 'mazzilli-1964',
    foto: 'mazzilli',
    nome: 'Ranieri Mazzilli',
    inicio: '1964-04-02',
    fim: '1964-04-15',
    chegada:
      'Presidente da Câmara dos Deputados; assumiu interinamente quando o Congresso declarou vaga a Presidência.',
    saida: 'Posse do presidente eleito indiretamente pelo Congresso.',
    marcos: ['Ato Institucional nº 1 (09/04/1964)'],
  },
  {
    id: 'castelo',
    foto: 'castelo',
    nome: 'Castelo Branco',
    inicio: '1964-04-15',
    fim: '1967-03-15',
    chegada: 'Eleição indireta, pelo Congresso Nacional.',
    saida: 'Fim do mandato.',
    marcos: [
      'Criação do Banco Central (Lei 4.595, de 1964)',
      'Ato Institucional nº 2 (1965): extinção dos partidos e bipartidarismo',
      'Cruzeiro novo, nova moeda, e Constituição de 1967',
    ],

    eleicoes: [
      {
        ano: 1964,
        tipo: 'indireta',
        colegio: 'Congresso Nacional',
        turnos: [{ turno: 1, votos: 361 }],
      },
    ],
  },
  {
    id: 'costa-e-silva',
    foto: 'costa-e-silva',
    nome: 'Costa e Silva',
    inicio: '1967-03-15',
    fim: '1969-08-31',
    chegada: 'Eleição indireta, pelo Congresso Nacional.',
    saida: 'Afastado por doença; morreu em dezembro de 1969.',
    marcos: [
      'Ato Institucional nº 5 (13/12/1968): recesso do Congresso e suspensão de garantias',
      'Criação da Embraer (1969)',
    ],

    eleicoes: [
      {
        ano: 1966,
        tipo: 'indireta',
        colegio: 'Congresso Nacional',
        turnos: [{ turno: 1, votos: 294 }],
        nota: 'Candidato único; a oposição se absteve.',
      },
    ],
  },
  {
    id: 'junta-1969',
    foto: null,
    nome: 'Junta Militar de 1969',
    junta: [
      'General Aurélio de Lyra Tavares',
      'Almirante Augusto Rademaker',
      'Brigadeiro Márcio de Souza e Mello',
    ],
    inicio: '1969-08-31',
    fim: '1969-10-30',
    chegada:
      'Ministros militares; assumiram com o afastamento de Costa e Silva, sem a posse do vice-presidente, Pedro Aleixo.',
    saida: 'Posse do presidente eleito indiretamente pelo Congresso.',
    marcos: ['Emenda Constitucional 1, de 1969'],
  },
  {
    id: 'medici',
    foto: 'medici',
    nome: 'Emílio Garrastazu Médici',
    inicio: '1969-10-30',
    fim: '1974-03-15',
    chegada: 'Eleição indireta, pelo Congresso Nacional.',
    saida: 'Fim do mandato.',
    marcos: [
      'Período de alto crescimento econômico (1968–1973)',
      'Criação do Incra (1970)',
      'Rodovia Transamazônica (1972) e Ponte Rio–Niterói (1974)',
    ],

    eleicoes: [
      {
        ano: 1969,
        tipo: 'indireta',
        colegio: 'Congresso Nacional',
        turnos: [{ turno: 1, votos: 293 }],
        nota: 'Candidato único; 75 abstenções.',
      },
    ],
  },
  {
    id: 'geisel',
    foto: 'geisel',
    nome: 'Ernesto Geisel',
    inicio: '1974-03-15',
    fim: '1979-03-15',
    chegada: 'Eleição indireta, pelo Colégio Eleitoral.',
    saida: 'Fim do mandato.',
    marcos: [
      'Início da abertura política',
      'Lei do Divórcio (Lei 6.515, de 1977)',
      'Fim do AI-5 (Emenda Constitucional 11, de 1978, em vigor em 01/01/1979)',
    ],

    eleicoes: [
      {
        ano: 1974,
        tipo: 'indireta',
        colegio: 'Colégio Eleitoral',
        turnos: [{ turno: 1, votos: 400, segundo: { nome: 'Ulysses Guimarães', votos: 76 } }],
      },
    ],
  },
  {
    id: 'figueiredo',
    foto: 'figueiredo',
    nome: 'João Figueiredo',
    inicio: '1979-03-15',
    fim: '1985-03-15',
    chegada: 'Eleição indireta, pelo Colégio Eleitoral.',
    saida: 'Fim do mandato.',
    marcos: [
      'Lei da Anistia (Lei 6.683, de 1979) e volta do pluripartidarismo (1979)',
      'Eleições diretas para governador (1982)',
      'Campanha Diretas Já (1984)',
    ],

    eleicoes: [
      {
        ano: 1978,
        tipo: 'indireta',
        colegio: 'Colégio Eleitoral',
        turnos: [{ turno: 1, votos: 355, segundo: { nome: 'Euler Bentes Monteiro', votos: 226 } }],
      },
    ],
  },
  {
    id: 'tancredo',
    foto: 'tancredo',
    nome: 'Tancredo Neves',
    inicio: '1985-03-15',
    fim: '1985-04-21',
    chegada: 'Eleito presidente pelo Colégio Eleitoral em 15/01/1985.',
    saida: 'Adoeceu na véspera da posse e morreu em 21/04/1985, sem assumir.',
    marcos: [],
    naoExerceu: true,
    nota: 'Incluído na galeria dos Presidentes da República pela Lei 7.465, de 1986.',

    eleicoes: [
      {
        ano: 1985,
        tipo: 'indireta',
        colegio: 'Colégio Eleitoral',
        turnos: [{ turno: 1, votos: 480, segundo: { nome: 'Paulo Maluf', votos: 180 } }],
      },
    ],
  },
  {
    id: 'sarney',
    foto: 'sarney',
    nome: 'José Sarney',
    inicio: '1985-03-15',
    fim: '1990-03-15',
    chegada:
      'Vice-presidente eleito; assumiu interinamente em 15/03/1985 e, com a morte de Tancredo Neves, em definitivo.',
    saida: 'Fim do mandato.',
    marcos: [
      'Plano Cruzado (1986)',
      'Constituição de 1988 (05/10/1988)',
      'Eleição direta para presidente (1989), a primeira desde 1960',
    ],
  },
  {
    id: 'collor',
    foto: 'collor',
    nome: 'Fernando Collor',
    inicio: '1990-03-15',
    fim: '1992-12-29',
    chegada: 'Eleição direta (1989).',
    saida:
      'Afastado pela abertura do processo de impeachment (02/10/1992); renunciou em 29/12/1992, e o Senado o declarou inelegível por oito anos.',
    marcos: [
      'Plano Collor (1990)',
      'Código de Defesa do Consumidor (Lei 8.078, de 1990)',
      'Conferência da ONU sobre Meio Ambiente, a Rio-92 (1992)',
    ],

    eleicoes: [
      {
        ano: 1989,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 20611030,
            pct: 30.48,
            segundo: { nome: 'Luiz Inácio Lula da Silva', votos: 11622321, pct: 17.19 },
          },
          {
            turno: 2,
            votos: 35090206,
            pct: 53.03,
            segundo: { nome: 'Luiz Inácio Lula da Silva', votos: 31075803, pct: 46.97 },
          },
        ],
      },
    ],
  },
  {
    id: 'itamar',
    foto: 'itamar',
    nome: 'Itamar Franco',
    inicio: '1992-12-29',
    fim: '1995-01-01',
    chegada:
      'Vice-presidente; exerceu a Presidência desde 02/10/1992 e assumiu em definitivo com a renúncia de Fernando Collor.',
    saida: 'Fim do mandato.',
    marcos: [
      'Plebiscito de 1993: república e presidencialismo',
      'Plano Real e nova moeda, o real (1994)',
    ],
  },
  {
    id: 'fhc',
    foto: 'fhc',
    nome: 'Fernando Henrique Cardoso',
    inicio: '1995-01-01',
    fim: '2003-01-01',
    chegada: 'Eleição direta (1994); reeleito em 1998.',
    saida: 'Fim do mandato.',
    marcos: [
      'Emenda da reeleição (Emenda Constitucional 16, de 1997)',
      'Lei de Responsabilidade Fiscal (Lei Complementar 101, de 2000)',
      'Privatizações e criação das agências reguladoras',
    ],

    eleicoes: [
      {
        ano: 1994,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 34350217,
            pct: 54.28,
            segundo: { nome: 'Luiz Inácio Lula da Silva', votos: 17112255, pct: 27.04 },
          },
        ],
      },
      {
        ano: 1998,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 35936382,
            pct: 53.06,
            segundo: { nome: 'Luiz Inácio Lula da Silva', votos: 21475211, pct: 31.71 },
          },
        ],
      },
    ],
  },
  {
    id: 'lula-2003',
    foto: 'lula',
    nome: 'Luiz Inácio Lula da Silva',
    inicio: '2003-01-01',
    fim: '2011-01-01',
    chegada: 'Eleição direta (2002); reeleito em 2006.',
    saida: 'Fim do mandato.',
    marcos: [
      'Reforma da Previdência dos servidores (Emenda Constitucional 41, de 2003)',
      'Programa Bolsa Família (Lei 10.836, de 2004)',
      'Lei da Ficha Limpa (Lei Complementar 135, de 2010)',
    ],

    eleicoes: [
      {
        ano: 2002,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 39455233,
            pct: 46.44,
            segundo: { nome: 'José Serra', votos: 19705445, pct: 23.2 },
          },
          {
            turno: 2,
            votos: 52793364,
            pct: 61.27,
            segundo: { nome: 'José Serra', votos: 33370739, pct: 38.73 },
          },
        ],
      },
      {
        ano: 2006,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 46662365,
            pct: 48.61,
            segundo: { nome: 'Geraldo Alckmin', votos: 39968369, pct: 41.64 },
          },
          {
            turno: 2,
            votos: 58295042,
            pct: 60.83,
            segundo: { nome: 'Geraldo Alckmin', votos: 37543178, pct: 39.17 },
          },
        ],
      },
    ],
  },
  {
    id: 'dilma',
    foto: 'dilma',
    nome: 'Dilma Rousseff',
    inicio: '2011-01-01',
    fim: '2016-08-31',
    chegada: 'Eleição direta (2010), primeira mulher na Presidência; reeleita em 2014.',
    saida:
      'Afastada com a abertura do processo de impeachment no Senado (12/05/2016) e destituída pelo Senado em 31/08/2016.',
    marcos: [
      'Lei de Acesso à Informação (Lei 12.527, de 2011)',
      'Comissão Nacional da Verdade (2012–2014)',
      'Marco Civil da Internet (Lei 12.965, de 2014)',
    ],

    eleicoes: [
      {
        ano: 2010,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 47651434,
            pct: 46.91,
            segundo: { nome: 'José Serra', votos: 33132283, pct: 32.61 },
          },
          {
            turno: 2,
            votos: 55752529,
            pct: 56.05,
            segundo: { nome: 'José Serra', votos: 43711388, pct: 43.95 },
          },
        ],
      },
      {
        ano: 2014,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 43267668,
            pct: 41.59,
            segundo: { nome: 'Aécio Neves', votos: 34897211, pct: 33.55 },
          },
          {
            turno: 2,
            votos: 54501118,
            pct: 51.64,
            segundo: { nome: 'Aécio Neves', votos: 51041155, pct: 48.36 },
          },
        ],
      },
    ],
  },
  {
    id: 'temer',
    foto: 'temer',
    nome: 'Michel Temer',
    inicio: '2016-08-31',
    fim: '2019-01-01',
    chegada:
      'Vice-presidente; exerceu a Presidência interinamente desde 12/05/2016 e assumiu em definitivo com a destituição de Dilma Rousseff.',
    saida: 'Fim do mandato.',
    marcos: [
      'Teto de gastos (Emenda Constitucional 95, de 2016)',
      'Reforma trabalhista (Lei 13.467, de 2017)',
      'Intervenção federal na segurança pública do Rio de Janeiro (2018)',
    ],
  },
  {
    id: 'bolsonaro',
    foto: 'bolsonaro',
    nome: 'Jair Bolsonaro',
    inicio: '2019-01-01',
    fim: '2023-01-01',
    chegada: 'Eleição direta (2018).',
    saida: 'Fim do mandato.',
    marcos: [
      'Reforma da Previdência (Emenda Constitucional 103, de 2019)',
      'Pandemia de covid-19 e Auxílio Emergencial (Lei 13.982, de 2020)',
      'Autonomia do Banco Central (Lei Complementar 179, de 2021)',
    ],

    eleicoes: [
      {
        ano: 2018,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 49277010,
            pct: 46.03,
            segundo: { nome: 'Fernando Haddad', votos: 31342051, pct: 29.28 },
          },
          {
            turno: 2,
            votos: 57797847,
            pct: 55.13,
            segundo: { nome: 'Fernando Haddad', votos: 47040906, pct: 44.87 },
          },
        ],
      },
    ],
  },
  {
    id: 'lula-2023',
    foto: 'lula',
    nome: 'Luiz Inácio Lula da Silva',
    inicio: '2023-01-01',
    fim: null,
    chegada: 'Eleição direta (2022).',
    saida: null,
    marcos: [
      'Novo arcabouço fiscal (Lei Complementar 200, de 2023)',
      'Reforma tributária sobre o consumo (Emenda Constitucional 132, de 2023)',
    ],
    nota: 'Mandato até 05/01/2027: a Emenda Constitucional 111, de 2021, passou a posse presidencial para 5 de janeiro.',

    eleicoes: [
      {
        ano: 2022,
        tipo: 'direta',
        turnos: [
          {
            turno: 1,
            votos: 57259504,
            pct: 48.43,
            segundo: { nome: 'Jair Bolsonaro', votos: 51072345, pct: 43.2 },
          },
          {
            turno: 2,
            votos: 60345999,
            pct: 50.9,
            segundo: { nome: 'Jair Bolsonaro', votos: 58206354, pct: 49.1 },
          },
        ],
      },
    ],
  },
];
