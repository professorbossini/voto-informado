import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { BrandPulse } from '@/components/brand/BrandMark';

export function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ minHeight: '50dvh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
      <BrandPulse size={72} />
      <Typography variant="h2" component="h1">
        Página não encontrada
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        O endereço pode ter mudado ou estar incompleto. Você pode buscar uma candidatura pelo nome ou número no topo da
        página, ou voltar ao início.
      </Typography>
      <Stack direction="row" spacing={1.5}>
        <Button component={RouterLink} to="/" variant="contained" size="large">
          Ir para o início
        </Button>
        <Button component={RouterLink} to="/eleicao" variant="tonal" size="large">
          Ver candidaturas
        </Button>
      </Stack>
    </Stack>
  );
}
