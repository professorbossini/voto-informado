/** Rótulos e formatos da parte dos EUA (valores em dólar, estados, partidos, votos). */

export const ESTADOS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alasca', AZ: 'Arizona', AR: 'Arkansas', CA: 'Califórnia', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'Distrito de Colúmbia', FL: 'Flórida', GA: 'Geórgia', HI: 'Havaí', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Luisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'Nova Hampshire', NJ: 'Nova Jersey',
  NM: 'Novo México', NY: 'Nova York', NC: 'Carolina do Norte', ND: 'Dakota do Norte', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pensilvânia', RI: 'Rhode Island', SC: 'Carolina do Sul', SD: 'Dakota do Sul', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virgínia', WA: 'Washington', WV: 'Virgínia Ocidental', WI: 'Wisconsin', WY: 'Wyoming',
};
export const TERRITORIOS: Record<string, string> = {
  AS: 'Samoa Americana', GU: 'Guam', MP: 'Ilhas Marianas do Norte', PR: 'Porto Rico', VI: 'Ilhas Virgens Americanas',
};
export const nomeEstado = (uf: string) => ESTADOS[uf] ?? TERRITORIOS[uf] ?? uf;
/** Estados (e DC) em ordem alfabética do nome em português. */
export const UFS_POR_NOME = Object.keys(ESTADOS).sort((a, b) => ESTADOS[a].localeCompare(ESTADOS[b], 'pt-BR'));
export const TERRITORIOS_POR_NOME = Object.keys(TERRITORIOS).sort((a, b) => TERRITORIOS[a].localeCompare(TERRITORIOS[b], 'pt-BR'));

/** Partidos no Congresso (código do Clerk/compilação). */
export const PARTIDOS: Record<string, string> = { D: 'Democrata', R: 'Republicano', I: 'Independente', L: 'Libertário' };
export const nomePartido = (p: string | null | undefined) => (p ? (PARTIDOS[p] ?? p) : 'Não informado');
/** Ordem neutra: alfabética pelo nome em português. */
export const ordemPartidos = (a: string, b: string) => nomePartido(a).localeCompare(nomePartido(b), 'pt-BR');

/** Nome do partido como vem nos resultados do MEDSL (party_simplified). */
const PARTIDO_RESULTADO: Record<string, string> = {
  DEMOCRAT: 'Democrata', REPUBLICAN: 'Republicano', LIBERTARIAN: 'Libertário', GREEN: 'Verde', OTHER: 'Outro', INDEPENDENT: 'Independente',
};
export const partidoResultado = (p: string | null | undefined) => (p ? (PARTIDO_RESULTADO[p] ?? p.charAt(0) + p.slice(1).toLowerCase()) : '');

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
const usd0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('pt-BR');

/** US$ 1.234,56 (valor exato, como publicado). */
export const dolar = (v: number | null | undefined) => (v == null ? 'Não informado' : usd.format(v).replace('USD', 'US$'));
export const dolar0 = (v: number | null | undefined) => (v == null ? 'Não informado' : usd0.format(v).replace('USD', 'US$'));
/** US$ 4,2 mi / US$ 1,3 bi (compacto, para gráficos e destaques). */
export function dolarCompacto(v: number | null | undefined): string {
  if (v == null) return 'Não informado';
  const a = Math.abs(v);
  const f = (n: number, u: string) => `US$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${u}`;
  if (a >= 1e12) return f(v / 1e12, 'tri');
  if (a >= 1e9) return f(v / 1e9, 'bi');
  if (a >= 1e6) return f(v / 1e6, 'mi');
  if (a >= 1e3) return f(v / 1e3, 'mil');
  return dolar0(v);
}
export const inteiro = (v: number | null | undefined) => (v == null ? 'Não informado' : int.format(v));
export const pct = (v: number | null | undefined, casas = 1) =>
  v == null || !Number.isFinite(v) ? '–' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

/** "2025-01-03" → "03/01/2025" (sem converter fuso: é uma data, não um instante). */
export function dataBr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : 'Não informado';
}
/** Instante oficial (com fuso de Washington) → data e hora de Brasília. */
export function dataHoraBrasilia(iso: string | null | undefined): string {
  if (!iso) return 'Não informado';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}
export function idade(nascimento: string | null | undefined, hoje = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento ?? '');
  if (!m) return null;
  let a = hoje.getFullYear() - Number(m[1]);
  if (hoje.getMonth() + 1 < Number(m[2]) || (hoje.getMonth() + 1 === Number(m[2]) && hoje.getDate() < Number(m[3]))) a--;
  return a;
}

/** "12º distrito" / "distrito único" (estados com uma só cadeira na Câmara). */
export const distrito = (d: number | null | undefined) => (d == null ? '' : d === 0 ? 'distrito único' : `${d}º distrito`);

export function cargoMembro(m: { casa: string; delegado?: boolean; genero?: string | null; uf?: string }) {
  const f = m.genero === 'F';
  if (m.casa === 'senado') return f ? 'Senadora' : 'Senador';
  if (m.delegado) return m.uf === 'PR' ? (f ? 'Comissária residente' : 'Comissário residente') : f ? 'Delegada' : 'Delegado';
  return f ? 'Deputada' : 'Deputado';
}

/** Voto como publicado, em português. */
export function rotuloVoto(c: string): string {
  if (c === 'S') return 'Sim';
  if (c === 'N') return 'Não';
  if (c === 'P') return 'Presente';
  if (c === 'A') return 'Não votou';
  if (c.startsWith('O:')) return c.slice(2);
  return c;
}
export const ROTULO_PLACAR: Record<string, string> = { S: 'Sim', N: 'Não', P: 'Presente', A: 'Não votou', O: 'Outros' };

/** Resultado publicado (inglês) com a tradução ao lado, sem reinterpretar. */
const RESULTADOS: Record<string, string> = {
  Passed: 'Aprovado', Failed: 'Rejeitado', 'Agreed to': 'Aprovado', Rejected: 'Rejeitado', 'Motion Agreed to': 'Requerimento aprovado',
  'Motion Rejected': 'Requerimento rejeitado', 'Nomination Confirmed': 'Indicação confirmada', 'Cloture Motion Agreed to': 'Encerramento do debate aprovado',
  'Cloture Motion Rejected': 'Encerramento do debate rejeitado', 'Bill Passed': 'Projeto aprovado', 'Joint Resolution Passed': 'Resolução conjunta aprovada',
  'Amendment Agreed to': 'Emenda aprovada', 'Amendment Rejected': 'Emenda rejeitada', 'Resolution Agreed to': 'Resolução aprovada',
  'Motion to Table Agreed to': 'Arquivamento aprovado', 'Motion to Table Failed': 'Arquivamento rejeitado',
};
export const resultadoPt = (r: string | null | undefined) => (r ? (RESULTADOS[r] ?? r) : 'Não informado');
export const aprovado = (r: string | null | undefined) => !!r && /passed|agreed|confirmed|elected/i.test(r) && !/failed|rejected/i.test(r);

/** Categorias de gasto dos gabinetes da Câmara (Statement of Disbursements). */
export const CATEGORIAS_GASTO: Record<string, string> = {
  pessoal: 'Pessoal (salários da equipe)',
  beneficios: 'Benefícios de pessoal',
  viagens: 'Viagens',
  aluguel_comunicacao: 'Aluguel, comunicação e serviços públicos',
  impressao: 'Impressão e reprodução',
  servicos: 'Outros serviços',
  material: 'Material',
  equipamento: 'Equipamento',
  correspondencia: 'Correspondência oficial (franked mail)',
  transporte: 'Transporte de bens',
};

/** "2026T2" → "2º tri/2026". */
export const trimestre = (k: string) => `${k.slice(5)}º tri/${k.slice(0, 4)}`;

/** Situação da candidatura na FEC. */
export const SITUACAO_FEC: Record<string, string> = { I: 'Incumbente (ocupa a cadeira)', C: 'Desafiante', O: 'Vaga aberta (sem incumbente)' };

/** Presidente que nomeou (como publicado pela Suprema Corte: "Bush, G. W.") → "George W. Bush". */
const PRESIDENTES: Record<string, string> = {
  'Bush, G. W.': 'George W. Bush', 'Bush, G. H. W.': 'George H. W. Bush', Obama: 'Barack Obama', Trump: 'Donald Trump', Biden: 'Joe Biden',
  Clinton: 'Bill Clinton', Reagan: 'Ronald Reagan', Ford: 'Gerald Ford', Nixon: 'Richard Nixon', Johnson: 'Lyndon B. Johnson',
  Kennedy: 'John F. Kennedy', Eisenhower: 'Dwight D. Eisenhower', Truman: 'Harry S. Truman', 'Roosevelt, F.': 'Franklin D. Roosevelt',
};
export const presidenteQueNomeou = (p: string | null | undefined) => (p ? (PRESIDENTES[p] ?? p) : 'Não informado');
