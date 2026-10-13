/** Regiões do IBGE e as UFs de cada uma. */
export const REGIOES: { nome: string; ufs: string[] }[] = [
  { nome: 'Norte', ufs: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'] },
  { nome: 'Nordeste', ufs: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'] },
  { nome: 'Centro-Oeste', ufs: ['DF', 'GO', 'MS', 'MT'] },
  { nome: 'Sudeste', ufs: ['ES', 'MG', 'RJ', 'SP'] },
  { nome: 'Sul', ufs: ['PR', 'RS', 'SC'] },
];

/** Região de cada UF. */
export const REGIAO_DA_UF: Record<string, string> = Object.fromEntries(REGIOES.flatMap((r) => r.ufs.map((uf) => [uf, r.nome])));
