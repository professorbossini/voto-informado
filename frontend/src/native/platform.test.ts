import { canPrint, canShare, isNativeApp, publicUrl, shareContent } from './platform';

describe('native/platform (no navegador)', () => {
  it('não se considera app nativo', () => {
    expect(isNativeApp).toBe(false);
  });

  it('monta links públicos a partir da origem da página', () => {
    expect(publicUrl('/candidato/123')).toBe(`${window.location.origin}/candidato/123`);
    expect(publicUrl('comparar?c=1,2')).toBe(`${window.location.origin}/comparar?c=1,2`);
  });

  it('imprime pelo navegador', () => {
    expect(canPrint()).toBe(true);
  });

  it('sem Web Share, copia o link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    expect(canShare()).toBe(false);
    await expect(shareContent({ title: 'x', url: 'https://exemplo/a' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://exemplo/a');
    vi.unstubAllGlobals();
  });

  it('com Web Share, usa a folha de compartilhamento; cancelar não copia', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    vi.stubGlobal('navigator', { ...navigator, share });
    expect(canShare()).toBe(true);
    await expect(shareContent({ title: 'x', url: 'https://exemplo/a' })).resolves.toBe('cancelled');
    vi.unstubAllGlobals();
  });
});
