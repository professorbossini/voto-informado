import { ORIGINAL } from './idiomas';

/**
 * Tradutor da interface: troca, na tela, os textos em português por um dicionário do idioma
 * escolhido (src/i18n/locales/<id>.json, gerado a partir de src/i18n/fontes.json pelo script
 * scripts/extrair-textos.mjs). Funciona por cima do React: observa o DOM e traduz cada nó de
 * texto e os atributos visíveis; guarda o original para voltar ao português sem recarregar.
 * Textos que não estão no dicionário (nomes, dados oficiais) ficam como publicados.
 */

type Dic = Record<string, string>;
const carregadores = import.meta.glob<{ default: Dic }>('./locales/*.json');
const ATRIBUTOS = ['aria-label', 'placeholder', 'title', 'alt'] as const;
const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);

let exatos = new Map<string, string>();
let padroes: { re: RegExp; alvo: string }[] = [];
let ativo = ORIGINAL;
let observador: MutationObserver | null = null;

// Originais em português (recriados a cada vez que se sai do português: o React pode ter mudado tudo).
let textoOriginal = new WeakMap<Text, string>();
let attrOriginal = new WeakMap<Element, Map<string, string>>();
const tocados = new Set<WeakRef<Text | Element>>();
// Último valor escrito pelo tradutor: mudança igual a ele é nossa; diferente, foi o React.
const escritoTexto = new WeakMap<Text, string>();
const escritoAttr = new WeakMap<Element, Map<string, string>>();

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compilar(dic: Dic) {
  exatos = new Map();
  padroes = [];
  for (const [pt, tr] of Object.entries(dic)) {
    if (!tr || tr === pt) continue;
    if (/\{\d+\}/.test(pt)) {
      const ordem: number[] = [];
      // Padrão com pouco texto fixo (ex.: "{0}º turno") só aceita trechos curtos sem espaço no lugar do
      // marcador, para não "engolir" uma frase inteira que por acaso termina igual.
      const fixo = pt.replace(/\{\d+\}/g, '').trim().length;
      const captura = fixo < 12 ? '(\\S{1,12})' : '(.+?)';
      const re = new RegExp('^' + escapar(pt).replace(/\\\{(\d+)\\\}/g, (_, n: string) => (ordem.push(Number(n)), captura)) + '$');
      // alvo usa {n}; a captura i corresponde a ordem[i]
      padroes.push({ re, alvo: tr.replace(/\{(\d+)\}/g, (_, n: string) => `\uE000${ordem.indexOf(Number(n))}\uE000`) });
    } else exatos.set(pt, tr);
  }
}

/** Traduz um texto (preserva espaços nas bordas); devolve null se não houver tradução. */
export function traduzir(original: string): string | null {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(original);
  if (!m || !m[2]) return null;
  const nucleo = m[2].replace(/\s+/g, ' ');
  let tr = exatos.get(nucleo) ?? null;
  if (tr == null) {
    for (const p of padroes) {
      const r = p.re.exec(nucleo);
      if (r) {
        tr = p.alvo.replace(/\uE000(\d+)\uE000/g, (_, i: string) => r[Number(i) + 1] ?? '');
        break;
      }
    }
  }
  return tr == null ? null : m[1] + tr + m[3];
}

function ignorado(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (IGNORAR.has(e.tagName) || e.getAttribute('translate') === 'no' || e.classList.contains('notranslate')) return true;
  }
  return false;
}

function traduzirTexto(n: Text) {
  if (ignorado(n.parentElement)) return;
  const original = textoOriginal.get(n) ?? n.data;
  if (!textoOriginal.has(n)) textoOriginal.set(n, original);
  const alvo = ativo === ORIGINAL ? original : (traduzir(original) ?? original);
  if (n.data !== alvo) {
    escritoTexto.set(n, alvo);
    n.data = alvo;
    tocados.add(new WeakRef(n));
  }
}

function traduzirAtributos(el: Element) {
  if (ignorado(el)) return;
  for (const a of ATRIBUTOS) {
    if (!el.hasAttribute(a)) continue;
    let mapa = attrOriginal.get(el);
    if (!mapa) attrOriginal.set(el, (mapa = new Map()));
    const original = mapa.get(a) ?? el.getAttribute(a)!;
    if (!mapa.has(a)) mapa.set(a, original);
    const alvo = ativo === ORIGINAL ? original : (traduzir(original) ?? original);
    if (el.getAttribute(a) !== alvo) {
      let e = escritoAttr.get(el);
      if (!e) escritoAttr.set(el, (e = new Map()));
      e.set(a, alvo);
      el.setAttribute(a, alvo);
      tocados.add(new WeakRef(el));
    }
  }
}

function varrer(raiz: Node) {
  if (raiz.nodeType === Node.TEXT_NODE) return traduzirTexto(raiz as Text);
  if (raiz.nodeType !== Node.ELEMENT_NODE) return;
  const el = raiz as Element;
  if (IGNORAR.has(el.tagName)) return;
  traduzirAtributos(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) traduzirTexto(n as Text);
    else traduzirAtributos(n as Element);
  }
}

function observar() {
  if (observador) return;
  observador = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') {
        const n = m.target as Text;
        if (escritoTexto.get(n) === n.data) continue;
        textoOriginal.set(n, n.data); // o React escreveu um texto novo (em português)
        traduzirTexto(n);
      } else if (m.type === 'attributes') {
        const el = m.target as Element;
        if (escritoAttr.get(el)?.get(m.attributeName!) === el.getAttribute(m.attributeName!)) continue;
        attrOriginal.get(el)?.delete(m.attributeName!);
        traduzirAtributos(el);
      } else m.addedNodes.forEach(varrer);
    }
  });
  observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS] });
}

/** Aplica o idioma (carrega o dicionário sob demanda). "pt-BR" restaura o original. */
export async function aplicarIdioma(id: string, dicionario?: Dic): Promise<void> {
  const carregar = carregadores[`./locales/${id}.json`];
  if (id !== ORIGINAL && !carregar && !dicionario) id = ORIGINAL;
  if (id !== ORIGINAL) compilar(dicionario ?? (await carregar!()).default);
  if (ativo === ORIGINAL && id !== ORIGINAL) {
    textoOriginal = new WeakMap();
    attrOriginal = new WeakMap();
  }
  ativo = id;
  document.documentElement.lang = id;
  if (id === ORIGINAL) {
    // Restaura tudo o que foi traduzido e para de observar.
    observador?.disconnect();
    observador = null;
    for (const ref of tocados) {
      const n = ref.deref();
      if (!n) continue;
      if (n.nodeType === Node.TEXT_NODE) {
        const o = textoOriginal.get(n as Text);
        if (o != null) (n as Text).data = o;
      } else {
        for (const [a, o] of attrOriginal.get(n as Element) ?? []) (n as Element).setAttribute(a, o);
      }
    }
    tocados.clear();
    return;
  }
  varrer(document.body);
  observar();
}

export function idiomaAtivo(): string {
  return ativo;
}
