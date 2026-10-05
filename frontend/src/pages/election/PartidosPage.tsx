import { useMemo, useState } from 'react';
import { Alert, Box, Card, CardActionArea, CardContent, Grid, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { SimboloPartido } from '@/components/partidos/SimboloPartido';
import { SEM_PARTIDO, usePartidos } from '@/components/partidos/partidos';
import { nomeProprio } from '@/data/format';
import { PageHeader } from '@/pages/PageHeader';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Todos os partidos com políticos em mandato, cada um levando à sua página. */
export function PartidosPage() {
  const { partidos, loading, error } = usePartidos();
  const [ordem, setOrdem] = useState<'az' | 'mandatos'>('az');
  const lista = useMemo(
    () => (ordem === 'az' ? partidos : [...partidos].sort((a, b) => b.total - a.total || a.sigla.localeCompare(b.sigla, 'pt-BR'))),
    [partidos, ordem],
  );

  return (
    <>
      <PageHeader
        title="Partidos"
        subtitle="Cada partido com os seus políticos em mandato: Presidência, governos estaduais, Senado e Câmara. Dados oficiais, atualizados todos os dias."
        actions={
          <ToggleButtonGroup size="small" exclusive value={ordem} onChange={(_, v) => v && setOrdem(v)} aria-label="Ordem">
            <ToggleButton value="az">A–Z</ToggleButton>
            <ToggleButton value="mandatos">Mais mandatos</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      {error != null && <Alert severity="warning">Não foi possível carregar os dados agora. Tente de novo em instantes.</Alert>}
      <Grid container spacing={2}>
        {loading &&
          Array.from({ length: 12 }, (_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rounded" height={128} />
            </Grid>
          ))}
        {lista.map((p) => (
          <Grid key={p.sigla} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card sx={{ height: '100%', borderRadius: 4, '&:hover': { borderColor: 'primary.light' } }}>
              <CardActionArea component={RouterLink} to={`/partido/${p.slug}`} sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.5 }}>
                    <SimboloPartido sigla={p.sigla} logo={p.logo} fundo={p.fundo} size={52} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                        {p.sigla === SEM_PARTIDO ? 'Sem partido' : p.sigla}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                        {p.nome ? nomeProprio(p.nome) : ' '}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {[
                      p.executivo.some((e) => e.cargo === 'presidente') && 'Presidência',
                      p.executivo.filter((e) => e.cargo === 'governador').length > 0 && plural(p.executivo.filter((e) => e.cargo === 'governador').length, 'governo', 'governos'),
                      p.senadores.length > 0 && plural(p.senadores.length, 'senador(a)', 'senadores'),
                      p.deputados.length > 0 && plural(p.deputados.length, 'deputado(a)', 'deputados'),
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem mandato federal ou estadual de Executivo'}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
