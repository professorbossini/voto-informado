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

/** Main navigation. `mobile: true` items go to the bottom bar; the rest live in "Mais". */
export const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: HomeRounded, mobile: true },
  { to: '/eleicao', label: 'Candidatos', icon: HowToVoteRounded, mobile: true },
  { to: '/comparar', label: 'Comparar', icon: CompareArrowsRounded, mobile: true },
  { to: '/cola', label: 'Minha cola', short: 'Cola', icon: ListAltRounded, mobile: true },
  { to: '/pesquisas', label: 'Pesquisas', icon: PollRounded, mobile: false },
  { to: '/simulador', label: 'Simulador de urna', icon: TouchAppRounded, mobile: false },
  { to: '/segundo-turno', label: '2º turno', icon: SyncAltRounded, mobile: false },
  { to: '/gastos', label: 'Gastos de mandato', icon: ReceiptLongRounded, mobile: false },
  { to: '/numeros', label: 'Em números', icon: InsightsRounded, mobile: false },
  { to: '/sobre', label: 'Fontes e método', icon: InfoRounded, mobile: false },
] as const;

export function activeNavItem(pathname: string) {
  const alias: Record<string, string> = { '/candidato': '/eleicao', '/parlamentar': '/gastos' };
  const path = Object.entries(alias).reduce((p, [from, to]) => (p.startsWith(from) ? to : p), pathname);
  const match = [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.to === '/' ? path === '/' : path.startsWith(item.to)));
  return match?.to ?? false;
}
