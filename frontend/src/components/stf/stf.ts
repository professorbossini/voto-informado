import { dataFileUrl } from '@/data/api';
import type { MinistroStf, Stf } from '@/data/types';

/** "2015-06-16" → "16/06/2015". */
export function diaBr(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-08" → "agosto de 2026". */
export function mesRef(ref: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(ref ?? '');
  return m ? `${MESES[Number(m[2]) - 1]} de ${m[1]}` : (ref ?? '');
}

/** "2026-08" → "ago/26". */
export function mesCurtoRef(ref: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(ref);
  return m ? `${MESES[Number(m[2]) - 1].slice(0, 3)}/${m[1].slice(2)}` : ref;
}

export const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

/** Foto publicada pelo site (caminho dentro de api/). */
export function fotoStf(caminho: string | null | undefined): string | null {
  return caminho ? dataFileUrl(caminho) : null;
}

/** Cargo como o STF publica: Presidente, Vice-Presidente, ou Ministro/Ministra (tratamento da pasta oficial). */
export function cargoStf(m: Pick<MinistroStf, 'cargo' | 'tratamento'>): string {
  if (m.cargo === 'Presidente') return 'Presidente do STF';
  if (m.cargo === 'Vice-Presidente') return 'Vice-Presidente do STF';
  return `${m.tratamento ?? 'Ministro(a)'} do STF`;
}

/** Idade (anos completos) numa data. */
export function idade(nascimento: string | null, em = new Date()): number | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  let anos = em.getFullYear() - a;
  if (em.getMonth() + 1 < m || (em.getMonth() + 1 === m && em.getDate() < d)) anos--;
  return anos;
}

/** Data em que completa 75 anos (aposentadoria compulsória: CF, art. 40, § 1º, II). */
export function aos75(nascimento: string | null): string | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split('-');
  return `${Number(a) + 75}-${m}-${d}`;
}

/** Quem preside primeiro; depois por antiguidade (a ordem oficial do STF). */
export function porAntiguidade(stf: Stf): MinistroStf[] {
  return [...stf.ministros].sort((a, b) => a.antiguidade - b.antiguidade);
}

/** Ordem alfabética (para tabelas: nenhum destaque implícito). */
export function porNome(lista: MinistroStf[]): MinistroStf[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Parcelas da folha (Resolução CNJ 215/2015), com a explicação oficial publicada pelo STF. */
export const PARCELAS: { k: string; nome: string; grupo: 'remuneratoria' | 'desconto' | 'eventual'; legenda: string }[] = [
  { k: 'A', grupo: 'remuneratoria', nome: 'Subsídio', legenda: 'Subsídio dos membros (vencimento do cargo), como publicado pelo STF.' },
  { k: 'B', grupo: 'remuneratoria', nome: 'Vantagens pessoais', legenda: 'Adicionais, vantagem pessoal nominalmente identificada, adicional por tempo de serviço, pagamentos por decisão judicial ou extensões administrativas.' },
  { k: 'C', grupo: 'remuneratoria', nome: 'Vantagens eventuais', legenda: 'Serviço extraordinário, substituição, adicionais e gratificações de natureza periódica ou eventual.' },
  { k: 'D', grupo: 'remuneratoria', nome: 'Cargo em comissão / função', legenda: 'Retribuição pelo cargo ou função exercida.' },
  { k: 'E', grupo: 'remuneratoria', nome: 'Bruto antes do teto', legenda: 'Remuneração mensal sem aplicar o teto constitucional.' },
  { k: 'F', grupo: 'remuneratoria', nome: 'Bruto após o teto', legenda: 'Remuneração mensal após aplicar o teto constitucional.' },
  { k: 'G', grupo: 'remuneratoria', nome: 'Abono de permanência', legenda: 'Pago a quem já poderia se aposentar e continua em atividade; no máximo, o valor da contribuição previdenciária.' },
  { k: 'H', grupo: 'desconto', nome: 'Contribuição previdenciária', legenda: 'Contribuição social do servidor público.' },
  { k: 'I', grupo: 'desconto', nome: 'Imposto de renda', legenda: 'Imposto sobre a renda retido na fonte.' },
  { k: 'J', grupo: 'desconto', nome: 'Descontos obrigatórios (total)', legenda: 'Soma da contribuição previdenciária e do imposto de renda.' },
  { k: 'K', grupo: 'desconto', nome: 'Abate-teto', legenda: 'Corte do que passar do teto remuneratório (CF, art. 37, XI).' },
  { k: 'L', grupo: 'desconto', nome: 'Descontos diversos', legenda: 'Descontos de diversas naturezas.' },
  { k: 'M', grupo: 'desconto', nome: 'Total de descontos', legenda: 'Inclui parcelas pessoais, como pensão alimentícia, consignações, plano de saúde e reposições.' },
  { k: 'N', grupo: 'eventual', nome: 'Férias', legenda: 'Adicional de 1/3 de férias e adiantamentos.' },
  { k: 'O', grupo: 'eventual', nome: '13º salário', legenda: 'Gratificação natalina ou sua antecipação.' },
  { k: 'P', grupo: 'eventual', nome: 'Auxílios e benefícios', legenda: 'Auxílios como alimentação, pré-escolar, natalidade e transporte.' },
  { k: 'Q', grupo: 'eventual', nome: 'Indenizações', legenda: 'Indenizações de férias, de transporte e outras previstas em lei.' },
  { k: 'R', grupo: 'eventual', nome: 'Exercícios anteriores', legenda: 'Pagamentos de exercícios anteriores e licença-prêmio convertida em dinheiro.' },
  { k: 'S', grupo: 'eventual', nome: 'Auxílio-moradia', legenda: 'Pagamento de auxílio-moradia.' },
];
