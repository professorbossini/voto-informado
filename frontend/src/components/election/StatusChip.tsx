import { Chip, Tooltip } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import BlockRounded from '@mui/icons-material/BlockRounded';
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded';

/** Plain-language meaning of each registration status, as defined by the Justiça Eleitoral. */
const EXPLICA: Record<string, string> = {
  deferido: 'A Justiça Eleitoral aprovou o registro da candidatura.',
  indeferido: 'A Justiça Eleitoral negou o registro da candidatura.',
  'indeferido em prazo recursal ou com recurso':
    'O registro foi negado, mas ainda cabe ou há recurso. O nome pode aparecer na urna; os votos ficam condicionados à decisão final.',
  'deferido em prazo recursal ou com recurso': 'O registro foi aprovado, mas ainda cabe ou há recurso contra a decisão.',
  'pendente de julgamento': 'O pedido de registro ainda não foi julgado pela Justiça Eleitoral.',
  renúncia: 'A pessoa desistiu da candidatura.',
  cancelado: 'O registro foi cancelado.',
  falecimento: 'Candidatura encerrada por falecimento.',
  'pedido não conhecido': 'O pedido de registro não foi analisado no mérito pela Justiça Eleitoral.',
};

export function StatusChip({ situacao, naUrna, size = 'small' }: { situacao: string | null; naUrna?: boolean; size?: 'small' | 'medium' }) {
  const s = (situacao ?? '').toLowerCase();
  let color: 'success' | 'warning' | 'error' | 'default' = 'default';
  let Icon = RemoveCircleOutlineRounded;
  if (s.startsWith('deferido')) {
    color = s.includes('recurso') ? 'warning' : 'success';
    Icon = s.includes('recurso') ? HourglassTopRounded : CheckCircleRounded;
  } else if (s.startsWith('indeferido')) {
    color = s.includes('recurso') ? 'warning' : 'error';
    Icon = s.includes('recurso') ? HourglassTopRounded : BlockRounded;
  } else if (s.startsWith('pendente')) {
    color = 'warning';
    Icon = HourglassTopRounded;
  }
  const explica = EXPLICA[s] ?? 'Situação do registro conforme a Justiça Eleitoral.';
  // Nome que segue na urna (carregada antes da decisão) embora a candidatura esteja encerrada.
  const encerradaNaUrna = naUrna === true && /^(renúncia|indeferido$|falecimento|cancelado|pedido não conhecido$)/.test(s);
  const label = `${situacao ?? 'Situação não informada'}${naUrna === false ? ' · fora da urna' : encerradaNaUrna ? ' · nome na urna' : ''}`;
  const extra = naUrna === false
    ? ' Este nome não aparece na urna eletrônica.'
    : encerradaNaUrna
      ? ' O nome ainda aparece na urna porque ela foi preparada antes da decisão. A validade dos votos segue as regras da Justiça Eleitoral: consulte o TSE.'
      : '';
  return (
    <Tooltip title={`${explica}${extra} (Fonte: TSE)`}>
      <Chip size={size} variant="soft" color={color} icon={<Icon />} label={label} sx={{ height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }} />
    </Tooltip>
  );
}
