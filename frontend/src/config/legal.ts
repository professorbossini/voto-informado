/**
 * Dados que aparecem na Política de Privacidade e nos Termos de Uso (site e apps).
 * Para trocar o contato ou registrar uma nova versão dos textos, mude só aqui.
 * As lojas (Google Play / App Store) apontam para /privacidade e /termos no site público.
 */
export const LEGAL = {
  projeto: 'Tá na Urna',
  responsavel: 'Rodrigo Bossini',
  email: 'professorbossini@gmail.com',
  /** Data da versão vigente dos dois textos (AAAA-MM-DD). */
  vigencia: '2026-11-23',
  hospedagem: {
    nome: 'Cloudflare (Workers, R2), serviço da Cloudflare, Inc.',
    privacidade: 'https://www.cloudflare.com/pt-br/privacypolicy/',
  },
  repositorio: 'https://github.com/professorbossini/voto-informado',
} as const;

/**
 * O registro de visitas em uma frase (resumo da política e aviso de medição). Os prazos são os de
 * RETENCAO em infra/cloudflare/visitas/worker.js: mudou lá, mude aqui e no item 7 da política.
 */
export const VISITAS_RESUMO =
  'O próprio site também registra as páginas vistas, sem cookies e sem ligar à sua conta: o IP fica 7 meses e, depois de 12, sobra só estatística anônima.';

/** Data por extenso (2 de outubro de 2026), sem depender do fuso do aparelho. */
export function vigenciaPorExtenso(): string {
  const [ano, mes, dia] = LEGAL.vigencia.split('-').map(Number);
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dia} de ${meses[mes - 1]} de ${ano}`;
}
