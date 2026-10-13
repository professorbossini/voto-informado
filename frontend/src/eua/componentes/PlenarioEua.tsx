import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { gruposPorAssento, hemiciclo } from '@/components/plenario/hemiciclo';
import type { MembroResumo } from '../api';
import { cargoMembro, nomeEstado, nomePartido, ordemPartidos } from '../formato';
import { useEscuro } from './MapaEua';

/**
 * Cores dos grupos no plenário: neutras e atribuídas pela ordem alfabética do nome do partido.
 * De propósito, nenhuma é o vermelho ou o azul usados pelos partidos americanos.
 */
const PALETA = {
  light: ['#5B2DB0', '#B07A00', '#0E8073', '#8A5A44'],
  dark: ['#9674E0', '#E0A92E', '#2BB3A5', '#C08B73'],
} as const;
const VAGA = { light: '#C9C9CF', dark: '#4A4A52' } as const;

export interface GrupoPlenario {
  partido: string;
  membros: MembroResumo[];
}

export function gruposDoPlenario(membros: MembroResumo[]): GrupoPlenario[] {
  const por = new Map<string, MembroResumo[]>();
  for (const m of membros) por.set(m.partido ?? '?', [...(por.get(m.partido ?? '?') ?? []), m]);
  return [...por.entries()]
    .sort(([a], [b]) => ordemPartidos(a, b))
    .map(([partido, ms]) => ({ partido, membros: ms.sort((x, y) => (x.sobrenome ?? x.nome).localeCompare(y.sobrenome ?? y.nome, 'pt-BR')) }));
}

/** Plenário em semicírculo: uma bolinha por cadeira, grupos em ordem alfabética, vagas em cinza. */
export function PlenarioEua({ membros, vagas = 0, titulo }: { membros: MembroResumo[]; vagas?: number; titulo: string }) {
  const escuro = useEscuro();
  const navigate = useNavigate();
  const [foco, setFoco] = useState<MembroResumo | null>(null);
  const grupos = useMemo(() => gruposDoPlenario(membros), [membros]);
  const total = membros.length + vagas;
  const geo = useMemo(() => hemiciclo(total, { raio: 300 }), [total]);
  const grupoDe = useMemo(() => gruposPorAssento(geo.assentos, [...grupos.map((g) => g.membros.length), vagas]), [geo, grupos, vagas]);
  const cores = PALETA[escuro ? 'dark' : 'light'];
  // Pessoa de cada cadeira: dentro do grupo, na ordem alfabética, da esquerda para a direita.
  const pessoas = useMemo(() => {
    const filas = grupos.map((g) => [...g.membros]);
    return geo.assentos.map((_, i) => {
      const g = grupoDe[i];
      return g < grupos.length ? (filas[g].shift() ?? null) : null;
    });
  }, [geo, grupoDe, grupos]);

  return (
    <Box>
      <Box component="svg" viewBox={`0 0 ${geo.largura} ${geo.altura}`} role="img" aria-label={`${titulo}: ${grupos.map((g) => `${nomePartido(g.partido)} ${g.membros.length}`).join(', ')}${vagas ? `, ${vagas} vagas` : ''}`} sx={{ width: '100%', maxWidth: 640, display: 'block', mx: 'auto' }}>
        {geo.assentos.map((a, i) => {
          const g = grupoDe[i];
          const p = pessoas[i];
          const cor = g < grupos.length ? cores[g % cores.length] : VAGA[escuro ? 'dark' : 'light'];
          return (
            <Box
              key={i}
              component="circle"
              cx={a.x}
              cy={a.y}
              r={a.r * (foco && p?.id === foco.id ? 1.5 : 1)}
              fill={cor}
              stroke={foco && p?.id === foco.id ? (escuro ? '#fff' : '#140E26') : 'none'}
              strokeWidth={1.5}
              sx={{ cursor: p ? 'pointer' : 'default', transition: 'r 120ms' }}
              onMouseEnter={() => setFoco(p)}
              onMouseLeave={() => setFoco(null)}
              onClick={() => p && navigate(`/eua/membro/${p.id}`)}
            >
              <title>{p ? `${p.nome} (${nomePartido(p.partido)}, ${nomeEstado(p.uf)})` : 'Cadeira vaga'}</title>
            </Box>
          );
        })}
        <text x={geo.cx} y={geo.cy - 18} textAnchor="middle" fontSize="44" fontWeight="800" fill="currentColor">
          {total}
        </text>
        <text x={geo.cx} y={geo.cy + 6} textAnchor="middle" fontSize="15" fill="currentColor" opacity="0.7">
          {foco ? `${foco.nome} · ${cargoMembro(foco)} (${foco.uf})` : 'cadeiras'}
        </text>
      </Box>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center', mt: 1.5 }}>
        {grupos.map((g, i) => (
          <Stack key={g.partido} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cores[i % cores.length] }} />
            <Typography variant="body2">
              {nomePartido(g.partido)}: <strong>{g.membros.length}</strong>
            </Typography>
          </Stack>
        ))}
        {vagas > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: VAGA[escuro ? 'dark' : 'light'] }} />
            <Typography variant="body2">
              Vagas: <strong>{vagas}</strong>
            </Typography>
          </Stack>
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'center', mt: 1 }}>
        Partidos em ordem alfabética, com cores neutras (nenhuma é cor de partido). Toque numa cadeira para ver o perfil.
      </Typography>
    </Box>
  );
}
