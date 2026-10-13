import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importarComRecarga } from './chunk';

describe('importarComRecarga', () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    vi.stubGlobal('location', { ...window.location, reload });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('devolve o módulo quando o import funciona', async () => {
    await expect(importarComRecarga(async () => ({ ok: 1 }))).resolves.toEqual({ ok: 1 });
    expect(reload).not.toHaveBeenCalled();
  });

  it('recarrega a página uma vez quando o chunk sumiu e depois mostra o erro', async () => {
    const falha = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
    void importarComRecarga(falha);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);

    await expect(importarComRecarga(falha)).rejects.toThrow('Failed to fetch');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
