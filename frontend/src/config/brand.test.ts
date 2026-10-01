import { describe, expect, it } from 'vitest';
import { resolveBrand } from './brand';

const base = { name: null, logoUrlFromEnv: null, folderLogos: {}, showPoweredBy: true };

describe('resolveBrand', () => {
  it('shows placeholders when nothing is configured', () => {
    expect(resolveBrand(base)).toMatchObject({
      name: null,
      logoUrl: null,
      logoSource: null,
      needsSetup: true,
    });
  });

  it('picks the logo from src/brand/, preferring svg', () => {
    const brand = resolveBrand({
      ...base,
      name: 'Acme',
      folderLogos: {
        '/src/brand/logo.png': '/assets/logo.png',
        '/src/brand/logo.svg': '/assets/logo.svg',
      },
    });
    expect(brand).toMatchObject({
      logoUrl: '/assets/logo.svg',
      logoSource: 'folder',
      needsSetup: false,
    });
  });

  it('gives VITE_APP_LOGO_URL priority over the folder', () => {
    const brand = resolveBrand({
      ...base,
      name: 'Acme',
      logoUrlFromEnv: 'https://cdn.test/logo.svg',
      folderLogos: { '/src/brand/logo.svg': '/assets/logo.svg' },
    });
    expect(brand).toMatchObject({ logoUrl: 'https://cdn.test/logo.svg', logoSource: 'url' });
  });

  it('still needs setup while the name is missing', () => {
    const brand = resolveBrand({ ...base, logoUrlFromEnv: '/logo.svg' });
    expect(brand.needsSetup).toBe(true);
  });
});
