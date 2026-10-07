import type { FonteEmendas, TipoAutorEmenda, TipoEmenda } from '@/data/types';

/** Rótulos curtos dos tipos de emenda (o texto completo vai no `title`). */
export const TIPO_EMENDA: Record<TipoEmenda, { curto: string; completo: string }> = {
  individual: { curto: 'Individual', completo: 'Emenda individual: transferência com finalidade definida' },
  especial: { curto: 'Individual (transferência especial)', completo: 'Emenda individual: transferência especial, direto ao caixa do ente, sem finalidade definida na emenda' },
  bancada: { curto: 'Bancada', completo: 'Emenda de bancada estadual' },
  comissao: { curto: 'Comissão', completo: 'Emenda de comissão' },
  relator: { curto: 'Relator', completo: 'Emenda de relator-geral do Orçamento' },
  outro: { curto: 'Outro', completo: 'Outro tipo de emenda' },
};

export const TIPO_AUTOR: Record<TipoAutorEmenda, string> = {
  parlamentar: 'Parlamentar',
  bancada: 'Bancada estadual',
  comissao: 'Comissão',
  relator: 'Relator-geral',
  outro: 'Outro',
};

export const PAGINA_CGU = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares';

/** Endereço da emenda no Portal da Transparência. */
export function linkEmenda(fonte: Pick<FonteEmendas, 'link_emenda'> | undefined, codigo: string): string {
  const modelo = fonte?.link_emenda || 'https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda={codigo}';
  return modelo.replace('{codigo}', encodeURIComponent(codigo));
}

/**
 * Texto da CGU (ações orçamentárias vêm em maiúsculas e sem acento): só a primeira letra
 * maiúscula, para ler melhor. As palavras continuam as publicadas.
 */
export function textoPublicado(texto: string): string {
  if (!texto || texto !== texto.toLocaleUpperCase('pt-BR')) return texto;
  const t = texto.toLocaleLowerCase('pt-BR');
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

/** Endereço da página de emendas de um município. */
export function rotaMunicipio(uf: string, cd: string): string {
  return `/emendas?uf=${encodeURIComponent(uf)}&mun=${encodeURIComponent(cd)}`;
}
