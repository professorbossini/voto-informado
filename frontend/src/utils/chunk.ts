/**
 * Depois de uma publicação, uma aba aberta (ou um index.html em cache) pode pedir um pedaço da
 * interface que mudou de nome: o import falha com "Failed to fetch dynamically imported module".
 * Recarregar a página resolve (vem o index.html novo). Para não entrar em laço se o arquivo
 * realmente sumiu, recarrega no máximo uma vez a cada minuto.
 */
const CHAVE = 'tanaurna:recarga-chunk';

export function recarregarUmaVez(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
    if (Date.now() - ultima < 60_000) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Envolve um import dinâmico: se falhar, recarrega a página (uma vez) em vez de mostrar o erro. */
export async function importarComRecarga<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (erro) {
    // Enquanto a página recarrega, nada de tela de erro.
    if (recarregarUmaVez()) return new Promise<T>(() => {});
    throw erro;
  }
}
