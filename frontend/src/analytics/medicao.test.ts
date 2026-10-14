import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// O módulo lê o ID ao ser importado: cada teste importa de novo, com o ambiente certo.
async function carregarModulo(id: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_GA_ID', id ?? '');
  return import('./medicao');
}

const scriptsDoGoogle = () => Array.from(document.querySelectorAll('script')).filter((s) => s.src.includes('googletagmanager.com'));

describe('medição de audiência', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    delete window.gtag;
    delete window.dataLayer;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sem consentimento, nada do Google é carregado e o aviso aparece', async () => {
    const m = await carregarModulo('G-TESTE123');
    expect(m.medicaoDisponivel).toBe(true);
    expect(m.escolhaSalva()).toBeNull();
    expect(scriptsDoGoogle()).toHaveLength(0);
    m.paginaVista('/plenario', 'Plenário');
    expect(window.dataLayer).toBeUndefined();
  });

  it('ao aceitar, carrega o gtag com anúncios e sinais do Google desligados e conta páginas', async () => {
    const m = await carregarModulo('G-TESTE123');
    m.escolher('aceito');
    expect(scriptsDoGoogle()).toHaveLength(1);
    const chamadas = (window.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));
    expect(chamadas).toContainEqual(['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    expect(chamadas).toContainEqual(['config', 'G-TESTE123', { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false }]);
    // A página em que a pessoa aceitou já foi contada.
    expect(chamadas.some((c) => c[0] === 'event' && c[1] === 'page_view')).toBe(true);
    m.paginaVista('/plenario', 'Plenário');
    const ultima = Array.from(window.dataLayer!.at(-1) as ArrayLike<unknown>);
    expect(ultima.slice(0, 2)).toEqual(['event', 'page_view']);
    expect(localStorage.getItem('vi:medicao')).toBe('aceito');
  });

  it('ao recusar, nada é carregado, a escolha fica salva e os cookies _ga são apagados', async () => {
    document.cookie = '_ga=GA1.1.123; path=/';
    const m = await carregarModulo('G-TESTE123');
    m.escolher('recusado');
    expect(scriptsDoGoogle()).toHaveLength(0);
    expect(m.escolhaSalva()).toBe('recusado');
    expect(document.cookie).not.toContain('_ga=');
  });

  it('sem ID configurado, não há medição nem aviso', async () => {
    const m = await carregarModulo(undefined);
    expect(m.medicaoDisponivel).toBe(false);
    m.escolher('aceito');
    expect(scriptsDoGoogle()).toHaveLength(0);
  });
});
