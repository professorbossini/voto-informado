import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import { opcoesBase } from './theme';

/**
 * Temas que a pessoa pode escolher (menu Aparência): 5 no estilo Material e 5 no estilo
 * Cupertino (iOS). Cores neutras e nunca ligadas a partidos; o padrão é o Faísca (violeta).
 * Contraste das cores principais conferido para texto branco (claro) e escuro (modo escuro).
 */

interface Tons {
  main: string;
  light: string;
  dark: string;
  container: string;
  onContainer: string;
  contrastText: string;
}

export interface TemaInfo {
  id: string;
  nome: string;
  estilo: 'material' | 'cupertino';
  /** Amostra para o menu. */
  cor: string;
  claro?: Tons;
  escuro?: Tons;
}

export const TEMAS: TemaInfo[] = [
  { id: 'faisca', nome: 'Violeta (padrão)', estilo: 'material', cor: '#5B2DB0' },
  {
    id: 'oceano', nome: 'Oceano', estilo: 'material', cor: '#00696E',
    claro: { main: '#00696E', light: '#1C8A8F', dark: '#004F53', container: '#C6EFF0', onContainer: '#002022', contrastText: '#FFFFFF' },
    escuro: { main: '#80D4D8', light: '#9CF1F5', dark: '#4FB7BC', container: '#004F53', onContainer: '#C6EFF0', contrastText: '#003739' },
  },
  {
    id: 'floresta', nome: 'Floresta', estilo: 'material', cor: '#3B6939',
    claro: { main: '#3B6939', light: '#538451', dark: '#235024', container: '#CDEDC6', onContainer: '#00210A', contrastText: '#FFFFFF' },
    escuro: { main: '#A1D39A', light: '#BCF0B4', dark: '#86B880', container: '#235024', onContainer: '#CDEDC6', contrastText: '#0A390F' },
  },
  {
    id: 'ambar', nome: 'Âmbar', estilo: 'material', cor: '#7B5800',
    claro: { main: '#7B5800', light: '#9A7000', dark: '#5D4200', container: '#FFDEA6', onContainer: '#261900', contrastText: '#FFFFFF' },
    escuro: { main: '#F9BC48', light: '#FFDEA6', dark: '#DCA12E', container: '#5D4200', onContainer: '#FFDEA6', contrastText: '#412D00' },
  },
  {
    id: 'grafite', nome: 'Grafite', estilo: 'material', cor: '#4A5568',
    claro: { main: '#4A5568', light: '#626D80', dark: '#333D4E', container: '#DCE2EC', onContainer: '#141B26', contrastText: '#FFFFFF' },
    escuro: { main: '#B9C3D2', light: '#D5DDEA', dark: '#9CA6B6', container: '#333D4E', onContainer: '#DCE2EC', contrastText: '#232C3A' },
  },
  {
    id: 'ios-azul', nome: 'Azul', estilo: 'cupertino', cor: '#007AFF',
    claro: { main: '#0066D6', light: '#007AFF', dark: '#004FA8', container: '#D6E8FF', onContainer: '#00214A', contrastText: '#FFFFFF' },
    escuro: { main: '#409CFF', light: '#64B0FF', dark: '#0A84FF', container: '#0B3A70', onContainer: '#D6E8FF', contrastText: '#001A3A' },
  },
  {
    id: 'ios-indigo', nome: 'Índigo', estilo: 'cupertino', cor: '#5856D6',
    claro: { main: '#5856D6', light: '#6E6CE0', dark: '#3E3CB4', container: '#E2E1FB', onContainer: '#14125A', contrastText: '#FFFFFF' },
    escuro: { main: '#8E8CF2', light: '#A9A8F6', dark: '#5E5CE6', container: '#2E2C8A', onContainer: '#E2E1FB', contrastText: '#12104A' },
  },
  {
    id: 'ios-menta', nome: 'Menta', estilo: 'cupertino', cor: '#00C7BE',
    claro: { main: '#007A74', light: '#00968F', dark: '#005C57', container: '#C2F2EF', onContainer: '#00201E', contrastText: '#FFFFFF' },
    escuro: { main: '#63E6E2', light: '#8AEEEB', dark: '#00C7BE', container: '#005C57', onContainer: '#C2F2EF', contrastText: '#00302D' },
  },
  {
    id: 'ios-laranja', nome: 'Laranja', estilo: 'cupertino', cor: '#FF9500',
    claro: { main: '#A85300', light: '#C76400', dark: '#7F3E00', container: '#FFE0C2', onContainer: '#2E1500', contrastText: '#FFFFFF' },
    escuro: { main: '#FFB45C', light: '#FFC985', dark: '#FF9F0A', container: '#6B3600', onContainer: '#FFE0C2', contrastText: '#3D1E00' },
  },
  {
    id: 'ios-grafite', nome: 'Grafite', estilo: 'cupertino', cor: '#8E8E93',
    claro: { main: '#555559', light: '#6C6C70', dark: '#3A3A3C', container: '#E5E5EA', onContainer: '#1C1C1E', contrastText: '#FFFFFF' },
    escuro: { main: '#C7C7CC', light: '#D1D1D6', dark: '#AEAEB2', container: '#3A3A3C', onContainer: '#E5E5EA', contrastText: '#1C1C1E' },
  },
];

export const TEMA_PADRAO = 'faisca';

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Inter, system-ui, "Segoe UI", Roboto, sans-serif';

/** Estilo Cupertino: fonte do sistema, fundos agrupados do iOS, cantos de 12 px, superfícies planas. */
const cupertino: ThemeOptions = {
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: SF,
    h1: { fontVariationSettings: 'normal', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontVariationSettings: 'normal', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontVariationSettings: 'normal', fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontVariationSettings: 'normal', fontWeight: 700 },
    h5: { fontVariationSettings: 'normal', fontWeight: 600 },
    h6: { fontVariationSettings: 'normal', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
  },
  colorSchemes: {
    light: { palette: { background: { default: '#F2F2F7', paper: '#FFFFFF', subtle: '#E5E5EA' }, divider: 'rgba(60, 60, 67, 0.18)', text: { primary: '#000000', secondary: 'rgba(60, 60, 67, 0.72)', disabled: 'rgba(60, 60, 67, 0.36)' } } },
    dark: { palette: { background: { default: '#000000', paper: '#1C1C1E', subtle: '#2C2C2E' }, divider: 'rgba(84, 84, 88, 0.6)', text: { primary: '#FFFFFF', secondary: 'rgba(235, 235, 245, 0.68)', disabled: 'rgba(235, 235, 245, 0.32)' } } },
  },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: 14, boxShadow: 'none', border: 'none' } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 14 } } },
    MuiButton: { styleOverrides: { root: { borderRadius: 10, boxShadow: 'none', '&:hover': { boxShadow: 'none' } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backdropFilter: 'saturate(180%) blur(20px)',
          backgroundColor: 'rgba(249, 249, 249, 0.82)',
          boxShadow: `inset 0 -0.5px 0 ${theme.vars.palette.divider}`,
          ...theme.applyStyles('dark', { backgroundColor: 'rgba(29, 29, 31, 0.82)' }),
        }),
      },
    },
  },
};

const cache = new Map<string, Theme>();

/** Tema MUI pronto para o id escolhido (desconhecido → padrão). */
export function criarTema(id: string | null | undefined): Theme {
  const t = TEMAS.find((x) => x.id === id) ?? TEMAS[0];
  const pronto = cache.get(t.id);
  if (pronto) return pronto;
  let opcoes: ThemeOptions = opcoesBase;
  if (t.claro && t.escuro) {
    opcoes = deepmerge(opcoes, {
      colorSchemes: {
        light: { palette: { primary: t.claro } },
        dark: { palette: { primary: t.escuro } },
      },
    } as ThemeOptions);
  }
  if (t.estilo === 'cupertino') opcoes = deepmerge(opcoes, cupertino);
  const tema = createTheme(opcoes);
  cache.set(t.id, tema);
  return tema;
}
