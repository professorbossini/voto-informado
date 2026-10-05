import type { ReactNode } from 'react';
import { Box, Button, Card, CardContent, Typography } from '@mui/material';
import EventAvailableRounded from '@mui/icons-material/EventAvailableRounded';
import { Link as RouterLink } from 'react-router';
import { usePeriodoEleitoral } from '@/data/usePeriodoEleitoral';

/**
 * Páginas que só fazem sentido durante a eleição (simulador, cola, 2º turno). Fora do período,
 * mostram um aviso; voltam sozinhas quando o site recebe a próxima eleição.
 */
export function SomenteNoPeriodo({ periodo, nome, children }: { periodo: 'eleicao' | 'segundo-turno'; nome: string; children: ReactNode }) {
  const p = usePeriodoEleitoral();
  if (periodo === 'eleicao' ? p.eleicao : p.segundoTurno) return <>{children}</>;
  return (
    <Card sx={{ maxWidth: 640, mx: 'auto', mt: { xs: 2, md: 6 }, borderRadius: 6 }}>
      <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 4, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', bgcolor: 'primary.container', color: 'primary.onContainer' }}>
          <EventAvailableRounded />
        </Box>
        <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
          {nome} volta no próximo período eleitoral
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {periodo === 'segundo-turno'
            ? 'A página do 2º turno fica disponível entre a apuração do 1º turno e o fim da eleição.'
            : 'Esta ferramenta só fica disponível durante a eleição, da campanha até o último turno. Ela reaparece sozinha na próxima eleição.'}
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          Ir para o início
        </Button>
      </CardContent>
    </Card>
  );
}
