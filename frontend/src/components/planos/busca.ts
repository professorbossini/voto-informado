/**
 * Busca nos planos de governo: sem diferença de acento nem de maiúsculas, a partir do início de
 * uma palavra ("escola" acha "Escolas", mas "arte" não acha "parte"). O texto de cada página vem de
 * api/planos/<disputa>.json, como extraído do PDF registrado no TSE.
 */

const MARCAS = /[̀-ͯ]/g;
const LETRA_OU_NUMERO = /[\p{L}\p{N}]/u;

/** Menor termo aceito (em letras, já sem espaços nas pontas). */
export const MIN_LETRAS = 3;

/** Texto para comparar: sem acentos e em minúsculas. */
export function dobrar(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS, '').toLowerCase();
}

/** Termo pronto para buscar: dobrado, com espaços simples e sem aspas nas pontas. */
export function prepararTermo(termo: string): string {
  return dobrar(termo)
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Posições (no texto dobrado) em que o termo começa no início de uma palavra. */
function ocorrencias(dobrado: string, termo: string): number[] {
  const out: number[] = [];
  if (!termo) return out;
  let p = dobrado.indexOf(termo);
  while (p !== -1) {
    if (p === 0 || !LETRA_OU_NUMERO.test(dobrado[p - 1])) out.push(p);
    p = dobrado.indexOf(termo, p + 1);
  }
  return out;
}

/** Dobra letra a letra guardando, para cada posição do texto dobrado, a posição no original. */
function dobrarComMapa(texto: string): { dobrado: string; origem: number[] } {
  let dobrado = '';
  const origem: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const d = dobrar(ch);
    for (let k = 0; k < d.length; k++) origem.push(i);
    dobrado += d;
    i += ch.length;
  }
  origem.push(texto.length);
  return { dobrado, origem };
}

/** Páginas onde o termo aparece, na ordem dos documentos e das páginas (página 1 = 1). */
export interface PaginaAchada {
  documento: number;
  pagina: number;
  ocorrencias: number;
}

/**
 * Procura o termo (já preparado) nas páginas já dobradas de um candidato: um item por página.
 * `dobradas[d][p]` é o texto dobrado da página p+1 do documento d.
 */
export function buscarPaginas(dobradas: string[][], termo: string): PaginaAchada[] {
  const out: PaginaAchada[] = [];
  if (termo.length < MIN_LETRAS) return out;
  dobradas.forEach((paginas, documento) =>
    paginas.forEach((texto, i) => {
      const n = ocorrencias(texto, termo).length;
      if (n) out.push({ documento, pagina: i + 1, ocorrencias: n });
    }),
  );
  return out;
}

export interface Parte {
  texto: string;
  destaque: boolean;
}

/**
 * Trecho curto em volta da primeira ocorrência do termo na página, com todas as ocorrências que
 * cabem nele destacadas e sem cortar palavras. null se o termo não está na página.
 */
export function trecho(texto: string, termo: string, raio = 120): Parte[] | null {
  if (!termo) return null;
  const { dobrado, origem } = dobrarComMapa(texto);
  // O fim aponta para a próxima letra do original: um acento escrito como marca separada fica no destaque.
  const faixas = ocorrencias(dobrado, termo).map((p) => [origem[p], origem[p + termo.length]] as const);
  if (!faixas.length) return null;
  const [a0, b0] = faixas[0];
  let ini = Math.max(0, a0 - raio);
  let fim = Math.min(texto.length, b0 + raio);
  if (ini > 0) {
    const espaco = texto.indexOf(' ', ini);
    if (espaco !== -1 && espaco < a0) ini = espaco + 1;
  }
  if (fim < texto.length) {
    const espaco = texto.lastIndexOf(' ', fim);
    if (espaco >= b0) fim = espaco;
  }
  const partes: Parte[] = [];
  const comum = (t: string) => t && partes.push({ texto: t, destaque: false });
  comum(ini > 0 ? '… ' : '');
  let cursor = ini;
  for (const [a, b] of faixas) {
    if (a < cursor || b > fim) continue;
    comum(texto.slice(cursor, a));
    partes.push({ texto: texto.slice(a, b), destaque: true });
    cursor = b;
  }
  comum(texto.slice(cursor, fim));
  comum(fim < texto.length ? ' …' : '');
  return partes;
}

/** Endereço do PDF aberto na página (os leitores de PDF dos navegadores entendem #page=N). */
export function linkPagina(urlPdf: string, pagina: number): string {
  return `${urlPdf.split('#')[0]}#page=${pagina}`;
}
