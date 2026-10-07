import { Box } from '@mui/material';
import { AvisoResultado } from '@/components/avisos/AvisoResultado';
import { ApuracaoAoVivo } from '@/components/resultados/ApuracaoAoVivo';

/** Endereço direto da apuração (tanaurna.com.br/resultados), para compartilhar. */
export function ResultadosPage() {
  return (
    <>
      <ApuracaoAoVivo headingLevel="h1" />
      <Box sx={{ mt: 3 }}>
        <AvisoResultado />
      </Box>
    </>
  );
}
