import { Alert, AlertTitle, Box, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import type { ConfigError } from '@/config/env';
import { FaiscaMark } from './brand/FaiscaMark';

/** Friendly screen for misconfigured forks: tells exactly which variables are missing. */
export function ConfigErrorScreen({ error }: { error: ConfigError }) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 560, width: '100%' }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <FaiscaMark size={44} />
            <Typography variant="h4">Falta configurar o ambiente</Typography>
            <Alert severity="warning">
              <AlertTitle>{error.message}</AlertTitle>
              {error.missing.length > 0 && (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {error.missing.map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
            <Typography color="text.secondary">
              Copie o <code>.env.example</code> para <code>.env</code>, preencha os valores e
              reinicie o <code>npm run dev</code>. Para testar sem credenciais, use{' '}
              <code>VITE_AUTH_PROVIDER=mock</code>.
            </Typography>
            <Link
              href="https://github.com/professorbossini/faisca-auth-starter#configuração"
              target="_blank"
              rel="noreferrer"
            >
              Ver o guia de configuração
            </Link>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
