/** Nome curto do órgão de uma fonte oficial ("Tribunal Superior Eleitoral (TSE) · ..." → "TSE"). */
export function orgaoCurto(orgao: string) {
  if (orgao.includes('TSE')) return 'TSE';
  if (orgao.includes('Câmara')) return 'Câmara dos Deputados';
  if (orgao.includes('Senado')) return 'Senado Federal';
  return orgao;
}
