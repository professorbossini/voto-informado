// Extrai os textos de interface (português) do código para a tradução (src/i18n/fontes.json).
// Pega: texto JSX (cada trecho vira um nó de texto no DOM), strings e templates em atributos
// visíveis (aria-label, placeholder, title, label, alt, helperText...) e strings em geral que
// parecem frase em português. Templates com ${...} viram padrões com {0}, {1}...
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const RAIZ = path.resolve(import.meta.dirname, '../src');
const IGNORAR = /(\.test\.|__fixtures__|\/i18n\/|\/auth\/|\/pages\/auth\/|ComponentsPage|AccountPage|brand\/BrandSetupDialog)/;
const textos = new Map(); // texto → {tipo, arquivos}

const pareceTexto = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(s) && !/^[a-z0-9_.:/#?=&@-]+$/i.test(s.trim()) && !/^(https?:|\/|#|vi:|mui-|[A-Z_]+$)/.test(s.trim()) && /\s|[À-ÿ]/.test(s.trim());
// Palavra solta de interface: "Resultados", "Sair", "cadeiras", e conectivos "para", "de", "por"...
const palavra = (s) => /^[A-Za-zÀ-ÿ][a-zà-ÿ]+[.:]?$/.test(s.trim()) || /^[A-Za-zÀ-ÿ]{1,3}$/.test(s.trim());
const add = (texto, tipo, arq, jsx = false) => {
  const t = texto.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 2000) return;
  if (!pareceTexto(t) && !(jsx && /[A-Za-zÀ-ÿ]/.test(t)) && !palavra(t)) return;
  const e = textos.get(t) ?? { tipo, arquivos: new Set() };
  e.arquivos.add(arq);
  textos.set(t, e);
};

function visitar(no, arq, src) {
  if (ts.isJsxText(no)) add(no.getText(src), 'exato', arq, true);
  else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
    const pai = no.parent;
    const ehImport = pai && (ts.isImportDeclaration(pai) || ts.isExportDeclaration(pai) || ts.isExternalModuleReference(pai));
    const ehChave = pai && ts.isPropertyAssignment(pai) && pai.name === no;
    const ehTipo = pai && ts.isLiteralTypeNode(pai);
    const ehSx = (() => { let p = no.parent; for (let i = 0; i < 6 && p; i++, p = p.parent) if (ts.isJsxAttribute(p) && ['sx', 'className', 'variant', 'component', 'color', 'size', 'href', 'to', 'id', 'key'].includes(p.name.getText(src))) return true; return false; })();
    const ehChamada = pai && ts.isCallExpression(pai) && /^(import|require|get|getItem|setItem|querySelector|getElementById|matchMedia|useLocalState|replace|split|startsWith|endsWith|includes|test|localeCompare|toLocaleString|padStart|join|set|has|delete|setParams|navigate)$/.test(pai.expression.getText(src).split('.').pop());
    if (!ehImport && !ehChave && !ehTipo && !ehSx && !ehChamada) add(no.text, 'exato', arq);
  } else if (ts.isTemplateExpression(no)) {
    let n = 0;
    let s = no.head.text;
    for (const span of no.templateSpans) s += `{${n++}}` + span.literal.text;
    if (/[A-Za-zÀ-ÿ]{3,}/.test(s.replace(/\{\d+\}/g, ''))) add(s, 'padrao', arq);
  }
  ts.forEachChild(no, (f) => visitar(f, arq, src));
}

function andar(dir) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) andar(p);
    else if (/\.(tsx?|ts)$/.test(nome) && !IGNORAR.test(p)) {
      const src = ts.createSourceFile(p, fs.readFileSync(p, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      visitar(src, path.relative(RAIZ, p), src);
    }
  }
}
andar(RAIZ);
const lista = [...textos.entries()].map(([texto, e]) => ({ texto, tipo: e.tipo, arquivos: [...e.arquivos].sort() })).sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR'));
fs.mkdirSync(path.join(RAIZ, 'i18n'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'i18n/fontes.json'), JSON.stringify(lista, null, 1) + '\n');
const chars = lista.reduce((s, x) => s + x.texto.length, 0);
console.log(`${lista.length} textos (${lista.filter((x) => x.tipo === 'padrao').length} padrões), ${chars} caracteres`);
