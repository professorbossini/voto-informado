import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Aplicativos Android e iOS do Voto Informado. A interface é a mesma do site (build `--mode app`,
 * ver .env.app) e os dados vêm do site público. Passo a passo de publicação em android/PUBLICAR.md.
 */
const config: CapacitorConfig = {
  // Identificador permanente nas lojas: não mude depois da primeira publicação.
  appId: 'dev.professorbossini.votoinformado',
  appName: 'Voto Informado',
  webDir: 'dist-app',
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#5B2DB0',
      showSpinner: false,
    },
    SystemBars: {
      // A interface desenha atrás das barras do sistema e se afasta delas com env(safe-area-inset-*).
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
