import { copyText } from '@/components/urna/clipboard';
import { isNativeApp, shareContent } from '@/native/platform';

export type ResultadoImagem = 'compartilhado' | 'baixado' | 'baixado-e-copiado' | 'link' | 'link-copiado' | 'cancelado' | 'falhou';

/** Celular/tablet com Web Share nível 2 (aceita arquivos): a imagem vai direto para o WhatsApp, Instagram etc. */
export function podeCompartilharArquivo(arquivo: File): boolean {
  if (isNativeApp || typeof navigator === 'undefined') return false;
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return toque && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [arquivo] });
}

/** Salva a imagem no aparelho (download do navegador). */
export function baixarArquivo(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Compartilha o cartão: no celular, a imagem e o link pela folha do sistema; sem esse recurso,
 * baixa a imagem e copia o link. No app usa o compartilhamento nativo já existente (o link da
 * página, que abre com prévia própria): o plugin nativo só envia arquivos gravados no aparelho.
 */
export async function compartilharImagem(arquivo: File | null, opcoes: { titulo: string; texto: string; url: string }): Promise<ResultadoImagem> {
  const { titulo, texto, url } = opcoes;
  if (isNativeApp) {
    const r = await shareContent({ title: titulo, text: texto, url });
    return r === 'shared' ? 'link' : r === 'copied' ? 'link-copiado' : r === 'cancelled' ? 'cancelado' : 'falhou';
  }
  if (!arquivo) return 'falhou';
  if (podeCompartilharArquivo(arquivo)) {
    try {
      // O link vai no texto: com arquivo anexado, alguns apps ignoram o campo "url".
      await navigator.share({ files: [arquivo], title: titulo, text: `${texto}\n${url}` });
      return 'compartilhado';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado';
      // Outro erro (ex.: app de destino recusou o arquivo): cai para baixar.
    }
  }
  baixarArquivo(arquivo);
  return (await copyText(url)) ? 'baixado-e-copiado' : 'baixado';
}
