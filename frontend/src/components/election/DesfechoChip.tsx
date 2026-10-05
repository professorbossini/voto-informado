import type { ReactNode } from 'react';
import { Chip, Tooltip } from '@mui/material';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import { useDesfechos } from '@/components/resultados/hooks';
import { cargoDaBusca, desfechoDe, type Desfecho } from '@/data/apuracao';
import type { Cargo } from '@/data/types';

/** "Eleita" / "Eleito" pelo gênero do registro oficial; "Eleito(a)" quando não informado. */
function eleitoPor(genero: string | null | undefined): string {
  const g = (genero ?? '').toUpperCase();
  return g.startsWith('FEM') ? 'Eleita' : g.startsWith('MASC') ? 'Eleito' : 'Eleito(a)';
}

/**
 * Rótulo do resultado oficial (TSE): "Eleito(a)" ou "Vai ao 2º turno". Mesma cor e mesmo
 * formato para qualquer candidatura (verde de sucesso / azul informativo, nunca cor de partido).
 */
export function DesfechoChip({ d, genero, size = 'small' }: { d: Desfecho | null | undefined; genero?: string | null; size?: 'small' | 'medium' }) {
  if (!d) return null;
  const eleito = d.tipo === 'eleito';
  const label = eleito
    ? `${eleitoPor(genero)}${d.turno === 2 ? ' no 2º turno' : ''}`
    : d.encerrado
      ? 'Disputou o 2º turno'
      : 'Vai ao 2º turno';
  const explica = eleito
    ? `Declarado(a) eleito(a) pelo TSE na apuração do ${d.turno}º turno.`
    : d.encerrado
      ? 'Foi ao 2º turno, conforme a apuração do 1º turno, e não foi eleito(a) no 2º turno.'
      : 'Classificado(a) para o 2º turno (25/10) segundo a apuração do 1º turno.';
  return (
    <Tooltip title={`${explica} (Fonte: TSE)`}>
      <Chip
        size={size}
        variant={eleito ? 'filled' : 'soft'}
        color={eleito ? 'success' : d.encerrado ? 'default' : 'info'}
        icon={eleito ? <VerifiedRounded /> : <HowToVoteRounded />}
        label={label}
        sx={{ height: 'auto', maxWidth: '100%', fontWeight: 700, '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
      />
    </Tooltip>
  );
}

/**
 * Rótulo de uma candidatura isolada (perfil, comparação): consulta o TSE ao vivo e, se não
 * houver nada lá, usa o resultado final já publicado no perfil.
 */
export function DesfechoDaCandidatura({
  c,
  size,
  vazio = null,
}: {
  c: { sq: string; cargo: Cargo; uf: string; genero: string | null; resultados?: { turno: number; situacao: string | null; eleito: number }[] };
  size?: 'small' | 'medium';
  /** O que mostrar enquanto o TSE não definiu nada. */
  vazio?: ReactNode;
}) {
  const vivo = useDesfechos(cargoDaBusca(c.cargo), c.uf);
  const d = vivo.get(c.sq) ?? desfechoDe(c.resultados);
  return d ? <DesfechoChip d={d} genero={c.genero} size={size} /> : vazio;
}
