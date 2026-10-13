import { useEffect, useRef } from 'react';
import type { CartaoDados } from './dados';

/**
 * Cartão da página aberta, para o botão "compartilhar" do topo. Páginas com dados próprios
 * (candidatura, parlamentar, comparação) registram como montar o cartão delas; nas demais, o botão
 * monta uma capa a partir do que está na tela (título, chamada e resumo).
 */
export type MontarCartao = () => CartaoDados | Promise<CartaoDados>;

interface Registro {
  montar: MontarCartao;
  texto: () => string | undefined;
}

let registrado: Registro | null = null;

export function cartaoRegistrado(): Registro | null {
  return registrado;
}

/** Registra o cartão desta página enquanto ela estiver aberta (`ativo` = false não registra). */
export function useCartaoDaPagina(montar: MontarCartao, texto?: string, ativo = true) {
  const atual = useRef({ montar, texto });
  useEffect(() => {
    atual.current = { montar, texto };
  });
  useEffect(() => {
    if (!ativo) return;
    const r: Registro = { montar: () => atual.current.montar(), texto: () => atual.current.texto };
    registrado = r;
    return () => {
      if (registrado === r) registrado = null;
    };
  }, [ativo]);
}

const SITE = 'Tá na Urna';

/** Texto limpo de um elemento (sem espaços duplicados). */
const limpo = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Corta no fim de uma palavra, com reticências, sem passar de `max` caracteres. */
export function resumir(texto: string, max = 260): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max - 1);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:·–-]+$/, '')}…`;
}

/**
 * Capa da página aberta, lida da tela: o título (h1), a chamada logo acima dele (texto pequeno em
 * maiúsculas, quando a página tem) e o primeiro parágrafo de verdade depois do título.
 */
export function capaDaTela(url: string, raiz: ParentNode = document): CartaoDados {
  const main = raiz.querySelector('main') ?? raiz;
  const h1 = main.querySelector('h1');
  const titulo = limpo(h1) || SITE;
  let chamada: string | null = null;
  const sobre = main.querySelectorAll('.MuiTypography-overline');
  for (const el of Array.from(sobre)) {
    // só a que vem antes do título (as de dentro dos cartões não contam)
    if (h1 && el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING) chamada = limpo(el) || null;
  }
  let descricao: string | null = null;
  for (const p of Array.from(main.querySelectorAll('p'))) {
    if (h1 && !(h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const t = limpo(p);
    if (t.length >= 40) {
      descricao = resumir(t);
      break;
    }
  }
  return {
    titulo,
    chamada: chamada && chamada.length <= 60 ? chamada : null,
    descricao,
    pessoas: [],
    fatos: [],
    url,
    fonte: 'Fontes oficiais citadas na página (TSE, Câmara, Senado, STF)',
    dataDados: null,
  };
}
