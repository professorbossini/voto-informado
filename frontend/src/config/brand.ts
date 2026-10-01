import { env } from './env';

/** Where the template lives, for the "feito com Faísca" badge. */
export const FAISCA_REPO_URL = 'https://github.com/professorbossini/faisca-auth-starter';

/** Accepted logo files in src/brand/, in order of preference. */
export const LOGO_EXTENSIONS = ['svg', 'png', 'webp', 'avif', 'jpg', 'jpeg'] as const;

/**
 * Any `logo.<ext>` dropped into src/brand/ is picked up at build time
 * (no config needed). Vite fingerprints it like any other asset.
 */
const folderLogos = import.meta.glob<string>('/src/brand/logo.{svg,png,webp,avif,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type LogoSource = 'url' | 'folder' | null;

export interface Brand {
  name: string | null;
  logoUrl: string | null;
  logoSource: LogoSource;
  showPoweredBy: boolean;
  /** True while the name or the logo is still the template placeholder. */
  needsSetup: boolean;
}

interface BrandInput {
  name: string | null;
  logoUrlFromEnv: string | null;
  folderLogos: Record<string, string>;
  showPoweredBy: boolean;
}

/** Priority: VITE_APP_LOGO_URL → src/brand/logo.* → placeholder. */
export function resolveBrand(input: BrandInput): Brand {
  const entries = Object.entries(input.folderLogos);
  const folderLogo =
    LOGO_EXTENSIONS.map((ext) => entries.find(([path]) => path.endsWith(`.${ext}`))?.[1]).find(
      Boolean,
    ) ?? null;

  const logoUrl = input.logoUrlFromEnv ?? folderLogo;
  const logoSource: LogoSource = input.logoUrlFromEnv ? 'url' : folderLogo ? 'folder' : null;

  return {
    name: input.name,
    logoUrl,
    logoSource,
    showPoweredBy: input.showPoweredBy,
    needsSetup: !input.name || !logoUrl,
  };
}

export const brand: Brand = resolveBrand({
  name: env.appName,
  logoUrlFromEnv: env.appLogoUrl,
  folderLogos,
  showPoweredBy: env.showPoweredBy,
});
