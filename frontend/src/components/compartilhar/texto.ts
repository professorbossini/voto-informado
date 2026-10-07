/**
 * Ajuste de texto para os cartões (canvas): quebra em linhas e escolha do tamanho da fonte.
 * Funções puras: recebem a função que mede a largura, então rodam nos testes sem canvas.
 */

/** Largura do texto em px para um tamanho de fonte (ex.: ctx.measureText com ctx.font ajustado). */
export type Medidor = (texto: string, tamanho: number) => number;

/**
 * Quebra o texto em linhas que caibam na largura, entre palavras. Uma palavra sozinha maior que a
 * largura (ex.: um endereço) é cortada por caracteres, para nunca vazar do cartão.
 */
export function quebrarLinhas(texto: string, largura: number, tamanho: number, medir: Medidor): string[] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (medir(tentativa, tamanho) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    if (medir(p, tamanho) <= largura) {
      atual = p;
      continue;
    }
    // Palavra maior que a linha: corta onde couber.
    let resto = p;
    while (medir(resto, tamanho) > largura && resto.length > 1) {
      let n = resto.length - 1;
      while (n > 1 && medir(resto.slice(0, n), tamanho) > largura) n--;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    atual = resto;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Encurta a linha com "…" até caber na largura. */
export function reticencias(linha: string, largura: number, tamanho: number, medir: Medidor): string {
  if (medir(linha, tamanho) <= largura) return linha;
  let s = linha;
  while (s.length > 0 && medir(`${s}…`, tamanho) > largura) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

export interface Ajuste {
  tamanho: number;
  linhas: string[];
}

export interface OpcoesAjuste {
  largura: number;
  /** Tamanho preferido; diminui de 2 em 2 px até caber. */
  max: number;
  min: number;
  maxLinhas: number;
  /** Altura disponível (opcional): linhas × tamanho × entrelinha precisam caber nela. */
  altura?: number;
  entrelinha?: number;
}

/**
 * Maior tamanho de fonte (entre max e min) em que o texto cabe em até maxLinhas. Se nem o mínimo
 * couber, usa o mínimo e encurta a última linha com "…" (nomes muito longos não estouram o cartão).
 */
export function ajustarTexto(texto: string, opcoes: OpcoesAjuste, medir: Medidor): Ajuste {
  const { largura, max, min, maxLinhas, altura, entrelinha = 1.15 } = opcoes;
  const cabe = (linhas: string[], t: number) => linhas.length <= maxLinhas && (altura == null || linhas.length * t * entrelinha <= altura);
  for (let t = max; t >= min; t -= 2) {
    const linhas = quebrarLinhas(texto, largura, t, medir);
    if (cabe(linhas, t)) return { tamanho: t, linhas };
  }
  let linhas = quebrarLinhas(texto, largura, min, medir);
  const limite = Math.max(1, Math.min(maxLinhas, altura != null ? Math.floor(altura / (min * entrelinha)) : maxLinhas));
  if (linhas.length > limite) {
    const ultima = linhas.slice(limite - 1).join(' ');
    linhas = [...linhas.slice(0, limite - 1), reticencias(ultima, largura, min, medir)];
  }
  return { tamanho: min, linhas };
}

/**
 * Mesmo tamanho para vários textos (nomes lado a lado): o maior em que TODOS cabem, para nenhuma
 * candidatura aparecer com letra maior que outra. Com `piso`, o tamanho comum não desce abaixo dele
 * (só o texto que não couber diminui sozinho): serve para os quadros de fatos de uma mesma pessoa.
 */
export function ajustarJuntos(textos: string[], opcoes: OpcoesAjuste, medir: Medidor, piso = opcoes.min): Ajuste[] {
  const tamanho = Math.max(Math.min(piso, opcoes.max), Math.min(...textos.map((t) => ajustarTexto(t, opcoes, medir).tamanho), opcoes.max));
  return textos.map((t) => ajustarTexto(t, { ...opcoes, max: tamanho }, medir));
}

/** Endereço curto para imprimir no cartão: sem "https://" e sem "www.". */
export function urlCurta(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/** Nome de arquivo seguro: "tanaurna-fulano-de-tal.png". */
export function nomeArquivo(base: string): string {
  const slug = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `tanaurna-${slug || 'cartao'}.png`;
}
