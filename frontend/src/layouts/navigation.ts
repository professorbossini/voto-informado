import HomeRounded from '@mui/icons-material/HomeRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import TouchAppRounded from '@mui/icons-material/TouchAppRounded';
import InfoRounded from '@mui/icons-material/InfoRounded';
import SyncAltRounded from '@mui/icons-material/SyncAltRounded';
import PollRounded from '@mui/icons-material/PollRounded';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import LocationCityRounded from '@mui/icons-material/LocationCityRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import HistoryEduRounded from '@mui/icons-material/HistoryEduRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import Diversity3Rounded from '@mui/icons-material/Diversity3Rounded';
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded';
import { env } from '@/config/env';
import { usePeriodoEleitoral } from '@/data/usePeriodoEleitoral';

/**
 * Main navigation. `mobile: true` items go to the bottom bar; `topo: true` items stay in the
 * desktop top bar (os demais ficam em "Mais", para a barra não cortar rótulos).
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: HomeRounded, mobile: true },
  { to: '/eleicao', label: 'Candidatos', icon: HowToVoteRounded, mobile: true, topo: true },
  { to: '/resultados', label: 'Resultados', icon: BarChartRounded, mobile: false, topo: true },
  { to: '/mapa', label: 'Mapa do voto', icon: MapRounded, mobile: false },
  { to: '/comparar', label: 'Comparar', icon: CompareArrowsRounded, mobile: true, topo: true },
  { to: '/cola', label: 'Minha cola', short: 'Cola', icon: ListAltRounded, mobile: true, periodo: 'eleicao' },
  // Pesquisas: pendente (ver env.enablePesquisas).
  ...(env.enablePesquisas ? [{ to: '/pesquisas', label: 'Pesquisas', icon: PollRounded, mobile: false } as const] : []),
  { to: '/simulador', label: 'Simulador de urna', icon: TouchAppRounded, mobile: false, periodo: 'eleicao' },
  { to: '/segundo-turno', label: '2º turno', icon: SyncAltRounded, mobile: false, topo: true, periodo: 'segundo-turno' },
  { to: '/planos', label: 'Planos de governo', icon: ManageSearchRounded, mobile: false, periodo: 'segundo-turno' },
  { to: '/como-votar', label: 'Como votar', icon: HelpOutlineRounded, mobile: false, periodo: 'segundo-turno' },
  { to: '/minha-cidade', label: 'Minha cidade', icon: LocationCityRounded, mobile: false, topo: true },
  { to: '/plenario', label: 'Plenário', icon: AccountBalanceRounded, mobile: false, topo: true },
  { to: '/congresso-eleito', label: 'Congresso eleito', icon: Diversity3Rounded, mobile: false },
  { to: '/partidos', label: 'Partidos', icon: GroupsRounded, mobile: false },
  { to: '/presidentes', label: 'Presidentes', icon: HistoryEduRounded, mobile: false },
  { to: '/gastos', label: 'Gastos de mandato', icon: ReceiptLongRounded, mobile: false },
  { to: '/emendas', label: 'Emendas', icon: PaymentsRounded, mobile: false },
  { to: '/numeros', label: 'Em números', icon: InsightsRounded, mobile: false },
  { to: '/sobre', label: 'Fontes e método', icon: InfoRounded, mobile: false },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];
/** Item com `mobile` ajustável (distribui sobre a união para manter `short` etc.). */
type NavVisivel = NavItem extends infer T ? (T extends unknown ? Omit<T, 'mobile'> & { mobile: boolean } : never) : never;

/**
 * Itens visíveis agora: os marcados com `periodo` só aparecem no período eleitoral (simulador,
 * cola) ou entre a apuração do 1º turno e o fim da eleição (2º turno). Fora dele, Resultados
 * ocupa o lugar da Cola na barra inferior do celular.
 */
export function useNavItems(): NavVisivel[] {
  const p = usePeriodoEleitoral();
  const visivel = (i: NavItem) => !('periodo' in i) || (i.periodo === 'eleicao' ? p.eleicao : p.segundoTurno);
  return NAV_ITEMS.filter(visivel).map((i) => ({ ...i, mobile: i.mobile || (!p.eleicao && i.to === '/resultados') }) as NavVisivel);
}

export function activeNavItem(pathname: string) {
  const alias: Record<string, string> = { '/candidato': '/eleicao', '/parlamentar': '/gastos', '/partido/': '/partidos', '/stf/': '/plenario' };
  const path = Object.entries(alias).reduce((p, [from, to]) => (p.startsWith(from) ? to : p), pathname);
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.to === '/' ? path === '/' : path.startsWith(item.to)));
  return match?.to ?? false;
}
