/**
 * Google AdSense (só no site; o aplicativo não tem anúncios). Ids públicos por natureza: o mesmo
 * editor também aparece em public/ads.txt e na meta google-adsense-account do index.html.
 * Bloco vazio = nenhum anúncio.
 */
export const ADSENSE = {
  cliente: 'ca-pub-5385535548377883',
  /** Bloco de display responsivo. */
  bloco: '8473186611',
} as const;
