/** "2025-02-12" → "12/02/2025" */
export function dataCurta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Rótulo de um voto como publicado; códigos do Senado ganham a descrição oficial. */
export function rotuloVoto(voto: string, legenda: Record<string, string>): string {
  const desc = legenda[voto];
  return desc && desc !== voto ? `${voto} · ${desc}` : voto;
}
