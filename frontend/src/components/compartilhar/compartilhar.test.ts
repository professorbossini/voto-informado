import { compartilharImagem, podeCompartilharArquivo } from './compartilhar';

const arquivo = new File([new Uint8Array([137, 80, 78, 71])], 'tanaurna-fulana.png', { type: 'image/png' });
const opcoes = { titulo: 'Fulana', texto: 'Fulana · dados oficiais', url: 'https://www.tanaurna.com.br/candidato/1' };

function toque(sim: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: sim && q.includes('coarse') }) as MediaQueryList);
}

describe('compartilharImagem (site)', () => {
  let clique: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    clique.mockRestore();
  });

  it('no celular com Web Share de arquivos, envia a imagem com o link no texto', async () => {
    toque(true);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share, canShare: () => true });
    expect(podeCompartilharArquivo(arquivo)).toBe(true);
    await expect(compartilharImagem(arquivo, opcoes)).resolves.toBe('compartilhado');
    expect(share).toHaveBeenCalledWith({ files: [arquivo], title: 'Fulana', text: 'Fulana · dados oficiais\nhttps://www.tanaurna.com.br/candidato/1' });
    expect(clique).not.toHaveBeenCalled();
  });

  it('cancelar a folha de compartilhamento não baixa nada', async () => {
    toque(true);
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), canShare: () => true });
    await expect(compartilharImagem(arquivo, opcoes)).resolves.toBe('cancelado');
    expect(clique).not.toHaveBeenCalled();
  });

  it('no computador (ou sem suporte a arquivos), baixa a imagem e copia o link', async () => {
    toque(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(), canShare: () => true, clipboard: { writeText } });
    expect(podeCompartilharArquivo(arquivo)).toBe(false);
    await expect(compartilharImagem(arquivo, opcoes)).resolves.toBe('baixado-e-copiado');
    expect(clique).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(opcoes.url);
  });

  it('se o app de destino recusar o arquivo, cai para baixar', async () => {
    toque(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')), canShare: () => true, clipboard: { writeText } });
    await expect(compartilharImagem(arquivo, opcoes)).resolves.toBe('baixado-e-copiado');
    expect(clique).toHaveBeenCalledTimes(1);
  });
});
