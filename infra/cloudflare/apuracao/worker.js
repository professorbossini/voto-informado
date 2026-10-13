/**
 * Histórico da apuração (Cloudflare Worker "tanaurna-apuracao", cron a cada minuto só na noite do
 * 2º turno, 25/10/2026 das 17h até a manhã seguinte, horário de Brasília).
 *
 * O site lê a apuração direto do TSE no navegador, mas o TSE publica só o retrato do momento. Para
 * mostrar como a contagem andou ("ao longo da apuração") e quando cada disputa foi definida, este
 * Worker lê os mesmos arquivos oficiais a cada minuto e grava um ponto quando o TSE atualiza:
 *   R2 (binding SITE, bucket tanaurna-site) → api/apuracao/serie-2t.json
 *
 * Disputas: Presidente (Brasil) e Governador nas UFs com 2º turno (as demais dão 404 no TSE).
 * Nada de dado pessoal: só números públicos do TSE. GET /teste (somente leitura) mostra o que
 * seria gravado agora, para conferir o acesso ao TSE sem esperar a noite da eleição.
 */

const TSE = 'https://resultados.tse.jus.br';
const CICLO = 'ele2026';
const TURNO = 2;
const CHAVE = `api/apuracao/serie-${TURNO}t.json`;
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
// Códigos do 2º turno (ele-c.json do TSE: cdt2 do federal e do estadual); conferidos a cada execução.
const PADRAO = { federal: '6258', estadual: '6260' };

const num = (v) => {
  if (v == null || v === '') return 0;
  const n = Number(String(v).includes(',') ? String(v).replace(/\./g, '').replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
};
const vaiAo2Turno = (st) => /^\s*2\s*[º°o]?\s*turno\s*$/i.test(st ?? '');
const eleito = (c) => !vaiAo2Turno(c.st) && (String(c.e ?? '').toLowerCase() === 's' || /^eleit[oa]/i.test(c.st ?? ''));

async function codigos() {
  try {
    const r = await fetch(`${TSE}/oficial/comum/config/ele-c.json`, { cf: { cacheTtl: 300 } });
    const cfg = await r.json();
    const eleicoes = cfg?.pl?.find((p) => p.c === CICLO)?.e ?? [];
    const fed = eleicoes.find((e) => e.t === '1' && e.tp === '8' && /ordin/i.test(e.nm ?? ''))?.cdt2;
    const est = eleicoes.find((e) => e.t === '1' && e.tp === '1' && /ordin/i.test(e.nm ?? ''))?.cdt2;
    return { federal: fed || PADRAO.federal, estadual: est || PADRAO.estadual };
  } catch {
    return PADRAO;
  }
}

function url(cod, cargo, uf) {
  const eleicao = cargo === 'presidente' ? cod.federal : cod.estadual;
  const c = cargo === 'presidente' ? '0001' : '0003';
  const u = uf.toLowerCase();
  return `${TSE}/oficial/${CICLO}/${eleicao}/dados/${u}/${u}-c${c}-e${eleicao.padStart(6, '0')}-u.json`;
}

/** Retrato de uma disputa no arquivo oficial, ou null (ainda não publicado / sem 2º turno). */
async function retrato(cod, cargo, uf) {
  const r = await fetch(url(cod, cargo, uf), { headers: { accept: 'application/json' }, cf: { cacheTtl: 0 } });
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new Error(`TSE ${r.status} em ${uf}/${cargo}`);
  const d = await r.json();
  const cands = [];
  for (const agr of d.carg?.[0]?.agr ?? []) for (const p of agr.par ?? []) for (const c of p.cand ?? []) cands.push({ sq: String(c.sqcand), nome: c.nmu || c.nm, numero: String(c.n), partido: p.sg, votos: num(c.vap), eleito: eleito(c) });
  return {
    t: `${d.dg || d.dt} ${d.hg || d.ht}`.trim(),
    secoes: num(d.s?.pstn ?? d.s?.pst),
    validos: num(d.v?.vv),
    final: String(d.tf ?? '').toLowerCase() === 's',
    cands,
  };
}

async function coletar() {
  const cod = await codigos();
  const alvos = [['presidente', 'BR'], ...UFS.map((uf) => ['governador', uf])];
  const res = await Promise.all(alvos.map(([cargo, uf]) => retrato(cod, cargo, uf).then((r) => [cargo, uf, r], () => [cargo, uf, undefined])));
  return res;
}

/** Junta os retratos de agora à série gravada: um ponto por disputa a cada atualização do TSE. */
export function juntar(serie, retratos, agora) {
  serie.disputas ??= {};
  serie.eventos ??= [];
  for (const [cargo, uf, r] of retratos) {
    if (!r) continue; // sem 2º turno, ainda não publicado, ou erro (fica o último ponto bom)
    const id = `${uf}-${cargo}`;
    const disp = (serie.disputas[id] ??= { uf, cargo, candidatos: r.cands.map(({ sq, nome, numero, partido }) => ({ sq, nome, numero, partido })), pontos: [], final: false });
    const ordem = disp.candidatos.map((c) => c.sq);
    for (const c of r.cands) if (!ordem.includes(c.sq)) (disp.candidatos.push({ sq: c.sq, nome: c.nome, numero: c.numero, partido: c.partido }), ordem.push(c.sq));
    const ultimo = disp.pontos.at(-1);
    if (!ultimo || ultimo.t !== r.t) {
      const votos = Object.fromEntries(r.cands.map((c) => [c.sq, c.votos]));
      disp.pontos.push({ t: r.t, s: r.secoes, vv: r.validos, v: ordem.map((sq) => votos[sq] ?? 0) });
    }
    // Eventos: primeira vez que o TSE marca alguém eleito; apuração concluída.
    for (const c of r.cands) {
      if (c.eleito && !serie.eventos.some((e) => e.tipo === 'eleito' && e.sq === c.sq)) serie.eventos.push({ tipo: 'eleito', t: r.t, uf, cargo, sq: c.sq, nome: c.nome, numero: c.numero, partido: c.partido });
    }
    if ((r.final || r.secoes >= 100) && !serie.eventos.some((e) => e.tipo === 'concluida' && e.uf === uf && e.cargo === cargo)) serie.eventos.push({ tipo: 'concluida', t: r.t, uf, cargo });
    disp.final = r.final;
  }
  serie.turno = TURNO;
  serie.atualizado = agora;
  serie.fonte = { nome: 'TSE · Divulgação de Resultados', url: `${TSE}/` };
  return serie;
}

async function rodar(env) {
  const atual = await env.SITE.get(CHAVE);
  const serie = atual ? await atual.json() : {};
  const disputas = Object.values(serie.disputas ?? {});
  // Tudo com totalização final: nada mais a fazer nesta noite.
  if (disputas.length && disputas.every((d) => d.final)) return;
  const novo = juntar(serie, await coletar(), new Date().toISOString());
  if (!Object.keys(novo.disputas).length) return; // TSE ainda não publicou nada (antes das 17h)
  await env.SITE.put(CHAVE, JSON.stringify(novo), { httpMetadata: { contentType: 'application/json' } });
}

export default {
  async scheduled(evento, env, ctx) {
    // Os crons valem para 25-26/10 de qualquer ano: só 2026 interessa.
    if (new Date(evento.scheduledTime).getUTCFullYear() !== 2026) return;
    ctx.waitUntil(rodar(env));
  },
  async fetch(req) {
    const u = new URL(req.url);
    if (u.pathname !== '/teste') return new Response('Não encontrado', { status: 404 });
    // Somente leitura: o retrato do 1º turno (Presidente, Brasil), para conferir o acesso ao TSE.
    const cod = await codigos();
    const r = await retrato({ federal: '6257', estadual: '6259' }, 'presidente', 'BR').catch((e) => ({ erro: String(e) }));
    return Response.json({ codigos2t: cod, retrato1t: r && { ...r, cands: r.cands?.slice(0, 3) } });
  },
};
