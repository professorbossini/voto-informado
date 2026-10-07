import { assetUrl } from '@/data/api';
import { desfechoDe } from '@/data/apuracao';
import { CARGO_LABEL, dateShort, moneyCompact, nomeProprio, number, percent } from '@/data/format';
import type { CandidatoDetalhe, Fonte, ParlamentarDetalhe, VotacoesParlamentar } from '@/data/types';
import { orgaoCurto } from '@/components/election/orgao';

/**
 * O que vai num cartão para compartilhar. Mesmo modelo para qualquer candidatura ou parlamentar:
 * só muda o dado oficial. Com várias pessoas (comparação, 2º turno), cada linha de fatos tem um
 * valor por pessoa, na ordem em que a página já mostra.
 */
export interface PessoaCartao {
  nome: string;
  /** Foto oficial (servida pelo site, com CORS aberto); null = silhueta neutra. */
  foto: string | null;
  /** Número na urna, quando houver. */
  numero?: string | null;
  /** Partido e complemento, ex.: "PT · Partido dos Trabalhadores". */
  detalhe?: string | null;
}

export interface LinhaFato {
  rotulo: string;
  /** Um valor por pessoa, na mesma ordem de `pessoas`. */
  valores: string[];
}

export interface CartaoDados {
  /** Linha de cima: cargo e UF, ou o assunto ("Comparação de candidaturas"). */
  titulo: string;
  pessoas: PessoaCartao[];
  fatos: LinhaFato[];
  /** Endereço completo da página (impresso curto no cartão). */
  url: string;
  /** "Fonte: TSE · ..." */
  fonte: string;
  /** Data dos dados (dd/mm/aaaa), ou null se desconhecida. */
  dataDados: string | null;
}

export const MAX_FATOS = 6;

const pctBr = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** "Eleita" / "Eleito" pelo gênero do registro oficial; "Eleito(a)" quando não informado (como no DesfechoChip). */
function eleitoPor(genero: string | null | undefined): string {
  const g = (genero ?? '').toUpperCase();
  return g.startsWith('FEM') ? 'Eleita' : g.startsWith('MASC') ? 'Eleito' : 'Eleito(a)';
}

/** Situação como o TSE publica, só com a caixa suavizada ("NÃO ELEITO" → "Não eleito"). */
function situacaoTse(s: string): string {
  const t = s.trim().toLocaleLowerCase('pt-BR');
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

export function resultadoTexto(c: Pick<CandidatoDetalhe, 'resultados' | 'genero'>): string | null {
  if (!c.resultados?.length) return null;
  const d = desfechoDe(c.resultados);
  if (d?.tipo === 'eleito') return `${eleitoPor(c.genero)} no ${d.turno}º turno`;
  if (d) return d.encerrado ? 'Disputou o 2º turno' : 'Vai ao 2º turno';
  const ultimo = [...c.resultados].sort((a, b) => b.turno - a.turno).find((r) => r.situacao?.trim());
  return ultimo?.situacao ? situacaoTse(ultimo.situacao) : null;
}

export function votosTexto(c: Pick<CandidatoDetalhe, 'resultados'>, turno: number): string | null {
  const r = c.resultados?.find((x) => x.turno === turno);
  if (!r || (r.votos == null && r.pct == null)) return null;
  const votos = r.votos != null ? `${number(r.votos)} votos` : '';
  return r.pct != null ? `${pctBr(r.pct)}${votos ? ` · ${votos}` : ''}` : votos;
}

interface FatoCandidato {
  rotulo: string;
  /** null = não se aplica a esta candidatura. */
  valor: (c: CandidatoDetalhe) => string | null;
  /** Texto quando, lado a lado, só algumas pessoas têm o dado. */
  vazio?: string;
  /** Linhas de resultado: ficam de fora no 2º turno, que traz os votos da própria disputa. */
  resultado?: boolean;
}

/** Fatos de candidatura, em ordem de prioridade (os primeiros que existirem vão para o cartão). */
const FATOS_CANDIDATO: FatoCandidato[] = [
  { rotulo: 'Resultado (TSE)', valor: resultadoTexto, vazio: '—', resultado: true },
  { rotulo: 'Votos no 2º turno', valor: (c) => votosTexto(c, 2), vazio: '—', resultado: true },
  { rotulo: 'Votos no 1º turno', valor: (c) => votosTexto(c, 1), vazio: '—', resultado: true },
  {
    rotulo: 'Patrimônio declarado (2026)',
    valor: (c) => (c.bens.length || c.declarou_bens ? moneyCompact(c.bens_total) : 'Nenhum bem declarado'),
  },
  { rotulo: 'Receitas de campanha (parcial)', valor: (c) => moneyCompact(c.receitas) },
  { rotulo: 'Despesas contratadas (parcial)', valor: (c) => moneyCompact(c.despesas) },
  { rotulo: 'Cota parlamentar desde 2023', valor: (c) => (c.mandato ? moneyCompact(c.mandato.total) : null), vazio: 'Não se aplica' },
  { rotulo: 'Idade na eleição', valor: (c) => (c.idade != null ? `${c.idade} anos` : null), vazio: '—' },
  { rotulo: 'Candidaturas anteriores (desde 2004)', valor: (c) => String(c.historico.length) },
];

/** Chaves de fonte que sustentam os fatos de candidatura. */
export function fontesCandidatura(cs: CandidatoDetalhe[]): string[] {
  return [
    'tse_candidatos',
    'tse_bens',
    'tse_prestacao',
    'tse_historico',
    'tse_fotos',
    ...(cs.some((c) => c.resultados.length) ? ['tse_resultados'] : []),
    ...(cs.some((c) => c.mandato?.casa === 'camara') ? ['camara_ceap'] : []),
    ...(cs.some((c) => c.mandato?.casa === 'senado') ? ['senado_ceaps'] : []),
  ];
}

/**
 * "Fonte: TSE · Candidatos 2026, Bens declarados...; Câmara dos Deputados · ..." a partir do
 * registro oficial de fontes. Sem o registro carregado, cita ao menos o órgão pela chave.
 */
export function textoFonte(chaves: string[], fontes: Map<string, Fonte>, extras: { orgao: string; nome: string }[] = []): string {
  const grupos = new Map<string, string[]>();
  const juntar = (orgao: string, nome: string | null) => {
    const nomes = grupos.get(orgao) ?? [];
    if (nome && !nomes.includes(nome)) nomes.push(nome);
    grupos.set(orgao, nomes);
  };
  for (const k of chaves) {
    const f = fontes.get(k);
    const orgao = f ? orgaoCurto(f.orgao) : k.startsWith('tse_') ? 'TSE' : k.startsWith('camara_') ? 'Câmara dos Deputados' : k.startsWith('senado_') ? 'Senado Federal' : null;
    if (orgao) juntar(orgao, f?.nome ?? null);
  }
  for (const e of extras) juntar(e.orgao, e.nome);
  const partes = [...grupos].map(([orgao, nomes]) => (nomes.length ? `${orgao} · ${nomes.join(', ')}` : orgao));
  return `Fonte: ${partes.join('; ') || 'dados oficiais'}`;
}

/** Data mais recente de coleta entre as fontes usadas (e datas extras), em dd/mm/aaaa. */
export function dataDosDados(chaves: string[], fontes: Map<string, Fonte>, extras: (string | null | undefined)[] = []): string | null {
  const datas = [...chaves.map((k) => fontes.get(k)?.coletado_em), ...extras]
    .map((d) => (d ? new Date(d) : null))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()));
  if (!datas.length) return null;
  return dateShort(new Date(Math.max(...datas.map((d) => d.getTime()))).toISOString());
}

function pessoaDeCandidato(c: CandidatoDetalhe): PessoaCartao {
  return {
    nome: nomeProprio(c.nome_urna),
    foto: assetUrl(c.foto),
    numero: c.numero,
    detalhe: c.partido_nome ? `${c.partido} · ${nomeProprio(c.partido_nome)}` : c.partido,
  };
}

const CASA = { camara: 'Câmara dos Deputados', senado: 'Senado Federal' } as const;
const local = (uf: string) => (uf === 'BR' ? 'Brasil' : uf);

/** Até `max` fatos que existem para esta candidatura, na ordem de prioridade. */
export function fatosCandidato(c: CandidatoDetalhe, max = MAX_FATOS): LinhaFato[] {
  return FATOS_CANDIDATO.map((f) => ({ rotulo: f.rotulo, valor: f.valor(c) }))
    .filter((f): f is { rotulo: string; valor: string } => f.valor != null)
    .slice(0, max)
    .map((f) => ({ rotulo: f.rotulo, valores: [f.valor] }));
}

export function cartaoCandidato(c: CandidatoDetalhe, url: string, fontes: Map<string, Fonte>): CartaoDados {
  const chaves = fontesCandidatura([c]);
  return {
    titulo: `${CARGO_LABEL[c.cargo]} · ${local(c.uf)}`,
    pessoas: [pessoaDeCandidato(c)],
    fatos: fatosCandidato(c),
    url,
    fonte: textoFonte(chaves, fontes),
    dataDados: dataDosDados(chaves, fontes, [c.contas_atualizadas_em]),
  };
}

/**
 * Mesmas linhas para todas as candidaturas (lado a lado): entra a linha que existir para ao
 * menos uma; quem não tem o dado aparece com "—" ou "Não se aplica". `antes` vem primeiro
 * (ex.: votos da disputa do 2º turno, já calculados pela página).
 */
export function fatosLadoALado(cs: CandidatoDetalhe[], opcoes: { antes?: LinhaFato[]; semResultado?: boolean; max?: number } = {}): LinhaFato[] {
  const { antes = [], semResultado = false, max = MAX_FATOS } = opcoes;
  const proprias = FATOS_CANDIDATO.filter((f) => !(semResultado && f.resultado))
    .map((f) => ({ f, valores: cs.map((c) => f.valor(c)) }))
    .filter(({ valores }) => valores.some((v) => v != null))
    .map(({ f, valores }) => ({ rotulo: f.rotulo, valores: valores.map((v) => v ?? f.vazio ?? '—') }));
  return [...antes, ...proprias].slice(0, max);
}

export function cartaoLadoALado(
  cs: CandidatoDetalhe[],
  opcoes: { titulo: string; url: string; fontes: Map<string, Fonte>; antes?: LinhaFato[]; semResultado?: boolean; chavesExtras?: string[] },
): CartaoDados {
  const chaves = [...new Set([...fontesCandidatura(cs), ...(opcoes.chavesExtras ?? [])])];
  return {
    titulo: opcoes.titulo,
    pessoas: cs.map(pessoaDeCandidato),
    fatos: fatosLadoALado(cs, opcoes),
    url: opcoes.url,
    fonte: textoFonte(chaves, opcoes.fontes),
    dataDados: dataDosDados(chaves, opcoes.fontes, cs.map((c) => c.contas_atualizadas_em)),
  };
}

/** Cartão de parlamentar: gastos de mandato (totais já na página) e, se houver, participação nas votações nominais. */
export function cartaoParlamentar(
  d: ParlamentarDetalhe,
  url: string,
  fontes: Map<string, Fonte>,
  votacoes?: VotacoesParlamentar | null,
): CartaoDados {
  const anos = [...d.por_ano].sort((a, b) => b.ano - a.ano);
  const ultimo = anos[0];
  const fatos: LinhaFato[] = [{ rotulo: 'Cota parlamentar desde fev/2023', valores: [moneyCompact(d.total)] }];
  if (ultimo) fatos.push({ rotulo: `Cota parlamentar em ${ultimo.ano}`, valores: [moneyCompact(ultimo.valor)] });
  const r = votacoes?.resumo;
  if (r && r.total != null) {
    fatos.push({
      rotulo: 'Participação em votações nominais',
      valores: [r.total ? `${percent(r.percentual)} · ${number(r.participou)} de ${number(r.total)}` : 'Nenhuma no período'],
    });
  } else if (r) {
    fatos.push({ rotulo: 'Votações nominais com registro', valores: [number(r.participou)] });
  }
  if (ultimo) fatos.push({ rotulo: `Média por mês com lançamento (${ultimo.ano})`, valores: [moneyCompact(ultimo.media_mensal)] });
  fatos.push({ rotulo: 'Situação', valores: [d.em_exercicio ? 'Em exercício' : 'Fora de exercício'] });
  if (d.candidato) fatos.push({ rotulo: 'Candidatura em 2026', valores: [`${CARGO_LABEL[d.candidato.cargo]} · nº ${d.candidato.numero}`] });

  const cargo = d.casa === 'camara' ? 'Deputado(a) federal' : 'Senador(a)';
  return {
    titulo: `${cargo}${d.uf ? ` · ${d.uf}` : ''} · mandato atual`,
    // A foto da Câmara/Senado vem de outro site, sem CORS (não entra no canvas): usa a foto oficial do TSE, servida
    // pelo próprio site, quando a pessoa é candidata; sem ela, o cartão mostra a silhueta neutra.
    pessoas: [{ nome: d.nome, foto: assetUrl(d.candidato?.foto) ?? assetUrl(d.foto_url), detalhe: [d.partido, d.uf].filter(Boolean).join(' · ') || null }],
    fatos: fatos.slice(0, MAX_FATOS),
    url,
    fonte: textoFonte([...d.fontes, ...(d.candidato?.foto ? ['tse_fotos'] : [])], fontes, votacoes ? [{ orgao: CASA[d.casa], nome: 'Votações nominais do Plenário' }] : []),
    dataDados: dataDosDados(d.fontes, fontes, [votacoes?.atualizado_em]),
  };
}
