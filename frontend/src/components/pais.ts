/** Países com dados no site. Cada um tem a própria área (o Brasil na raiz, os EUA em /eua). */
export const PAISES = [
  { id: 'br', nome: 'Brasil', bandeira: '🇧🇷', inicio: '/' },
  { id: 'us', nome: 'Estados Unidos', bandeira: '🇺🇸', inicio: '/eua' },
] as const;

/** A rota é da área dos EUA? (Todo o resto do site é do Brasil e não muda.) */
export const naAreaEua = (pathname: string) => pathname === '/eua' || pathname.startsWith('/eua/');
