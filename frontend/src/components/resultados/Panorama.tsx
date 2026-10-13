import { Box, Stack, Typography } from '@mui/material';
import type { CargoApuracao } from '@/data/apuracao';
import { nomeProprio } from '@/data/format';

import type { Disputa, LinhaRegiao } from './disputas';

const int = new Intl.NumberFormat('pt-BR');
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number) => `${pctFmt.format(n)}%`;

// ── Componentes ───────────────────────────────────────────────────────────────

function Secao({ titulo, nota, children }: { titulo: string; nota: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 4, p: { xs: 1.5, sm: 2 }, height: '100%' }}>
      <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 800, mb: 1 }}>
        {titulo}
      </Typography>
      {children}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, mb: 0, fontSize: '0.7rem' }}>
        {nota}
      </Typography>
    </Box>
  );
}

export function PorRegiao({ linhas }: { linhas: LinhaRegiao[] }) {
  if (!linhas.length) return null;
  return (
    <Secao titulo="Por região" nota="Soma dos arquivos oficiais de cada estado da região (o exterior à parte). Percentuais sobre os votos válidos da região.">
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {linhas.map((l) => (
          <Box component="li" key={l.nome} sx={{ py: 0.9, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {l.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {pct(l.secoes)} das seções
              </Typography>
            </Stack>
            {l.primeiros.length ? (
              <Typography variant="caption" component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {l.primeiros.map((p, i) => (
                  <span key={p.c.sq}>
                    {i > 0 && <Box component="span" sx={{ color: 'text.secondary' }}>{' · '}</Box>}
                    <b>{nomeProprio(p.c.nomeUrna)}</b> {pct(p.pct)}
                  </span>
                ))}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary" component="div">
                Aguardando os primeiros votos
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Secao>
  );
}

const ROTULO_CARGO: Partial<Record<CargoApuracao, string>> = { presidente: 'Presidente, por estado', governador: 'Governador', senador: 'Senado' };

export function DisputasApertadas({ disputas, cargo, nomeUf, onAbrir, max = 6 }: { disputas: Disputa[]; cargo: CargoApuracao; nomeUf: (uf: string) => string; onAbrir: (uf: string) => void; max?: number }) {
  if (!disputas.length) return null;
  const vagas2 = cargo === 'senador';
  return (
    <Secao
      titulo={`Disputas mais apertadas · ${ROTULO_CARGO[cargo] ?? ''}`}
      nota={
        vagas2
          ? 'Diferença entre quem ocupa a última vaga e quem vem logo atrás, em pontos dos votos válidos. Toque para abrir o estado.'
          : 'Diferença entre o 1º e o 2º colocados, em pontos dos votos válidos. Toque para abrir o estado.'
      }
    >
      <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {disputas.slice(0, max).map((d) => (
          <Box component="li" key={d.uf} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Box
              component="button"
              onClick={() => onAbrir(d.uf)}
              sx={{ all: 'unset', boxSizing: 'border-box', display: 'block', width: '100%', cursor: 'pointer', py: 0.9, px: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main' } }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {nomeUf(d.uf)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {pctFmt.format(d.pontos)} {d.pontos === 1 ? 'ponto' : 'pontos'}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {nomeProprio(d.dentro.nomeUrna)} × {nomeProprio(d.fora.nomeUrna)} · {int.format(d.votos)} votos de diferença · {d.definida ? 'definida' : `${pct(d.secoes)} das seções`}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Secao>
  );
}
