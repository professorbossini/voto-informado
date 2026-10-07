import { Box, Button } from '@mui/material';
import MapRounded from '@mui/icons-material/MapRounded';
import { Link as RouterLink } from 'react-router';
import { AvisoResultado } from '@/components/avisos/AvisoResultado';
import { ApuracaoAoVivo } from '@/components/resultados/ApuracaoAoVivo';

/** Endereço direto da apuração (tanaurna.com.br/resultados), para compartilhar. */
export function ResultadosPage() {
  return (
    <>
      <ApuracaoAoVivo headingLevel="h1" />
      <Box sx={{ mt: 3 }}>
        <Button component={RouterLink} to="/mapa" variant="outlined" startIcon={<MapRounded />}>
          Mapa do voto para Presidente por município
        </Button>
      </Box>
      <Box sx={{ mt: 3 }}>
        <AvisoResultado />
      </Box>
    </>
  );
}
