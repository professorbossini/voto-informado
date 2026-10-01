import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { api, ApiError } from '@/api';
import { useAuth } from '@/auth';
import { env } from '@/config/env';
import { useNotify } from '@/components/feedback/notificationsContext';
import { UserAvatar } from '@/components/UserAvatar';
import { PageHeader } from './PageHeader';

const PROVIDER_LABEL = {
  mock: 'Mock (demo)',
  firebase: 'Firebase Auth',
  backend: 'Backend próprio',
} as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 2 }} sx={{ py: 1.25 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 180 }, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ minWidth: 0, wordBreak: 'break-all' }}>{children}</Box>
    </Stack>
  );
}

/** Developer-friendly session inspector: handy while wiring a new backend. */
export function AccountPage() {
  const { user, providerId, getAccessToken, signOut } = useAuth();
  const notify = useNotify();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [apiResult, setApiResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [calling, setCalling] = useState(false);

  const revealToken = async () => setToken(await getAccessToken());

  const copyToken = async () => {
    const value = token ?? (await getAccessToken());
    if (!value) return notify('Sem token: a sessão usa cookie ou não há usuário.', 'info');
    await navigator.clipboard.writeText(value);
    notify('Token copiado para a área de transferência.', 'success');
  };

  const callApi = async () => {
    setCalling(true);
    try {
      const data = await api.get<unknown>('/me');
      setApiResult({ ok: true, text: JSON.stringify(data, null, 2) });
    } catch (error) {
      const text =
        error instanceof ApiError ? `${error.status || 'rede'}: ${error.message}` : String(error);
      setApiResult({ ok: false, text });
    } finally {
      setCalling(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Minha conta"
        subtitle="Dados da sessão atual e ferramentas para testar sua API."
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <UserAvatar
                user={user}
                sx={{ width: 88, height: 88, mx: 'auto', fontSize: '2rem', mb: 2 }}
              />
              <Typography variant="h5">{user?.name ?? 'Sem nome'}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {user?.email}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'center', flexWrap: 'wrap' }}
              >
                <Chip size="small" variant="soft" color="info" label={PROVIDER_LABEL[providerId]} />
                {user?.emailVerified && (
                  <Chip
                    size="small"
                    variant="soft"
                    color="lime"
                    icon={<VerifiedRounded />}
                    label="E-mail verificado"
                  />
                )}
              </Stack>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutRounded />}
                sx={{ mt: 3 }}
                onClick={() => void signOut()}
              >
                Sair
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Sessão
              </Typography>
              <Row label="ID do usuário">
                <code>{user?.id}</code>
              </Row>
              <Divider />
              <Row label="Método de login">
                {user?.signInMethod === 'google'
                  ? 'Google'
                  : user?.signInMethod === 'password'
                    ? 'E-mail e senha'
                    : '—'}
              </Row>
              <Divider />
              <Row label="API (VITE_API_URL)">
                {env.apiUrl ? (
                  <code>{env.apiUrl}</code>
                ) : (
                  'Não configurada: usando dados de demonstração'
                )}
              </Row>
              <Divider />
              <Row label="Access token">
                {token === undefined ? (
                  <Button size="small" onClick={() => void revealToken()}>
                    Mostrar token
                  </Button>
                ) : token ? (
                  <Typography
                    component="code"
                    variant="caption"
                    sx={{ display: 'block', maxHeight: 96, overflow: 'auto' }}
                  >
                    {token}
                  </Typography>
                ) : (
                  'Nenhum (sessão via cookie)'
                )}
              </Row>
              <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1.5 }}>
                <Button
                  variant="tonal"
                  startIcon={<ContentCopyRounded />}
                  onClick={() => void copyToken()}
                >
                  Copiar token
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SendRounded />}
                  disabled={!env.apiUrl || calling}
                  onClick={() => void callApi()}
                >
                  Testar GET /me
                </Button>
              </Stack>
              {apiResult && (
                <Alert severity={apiResult.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
                  <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: '0.8125rem' }}>
                    {apiResult.text}
                  </Box>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
