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
  vigencia: '2026-10-05',
  hospedagem: {
    nome: 'GitHub Pages, serviço da GitHub, Inc.',
    privacidade: 'https://docs.github.com/pt/site-policy/privacy-policies/github-general-privacy-statement',
  },
  repositorio: 'https://github.com/professorbossini/voto-informado',
} as const;

/** Data por extenso (2 de outubro de 2026), sem depender do fuso do aparelho. */
export function vigenciaPorExtenso(): string {
  const [ano, mes, dia] = LEGAL.vigencia.split('-').map(Number);
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dia} de ${meses[mes - 1]} de ${ano}`;
}
