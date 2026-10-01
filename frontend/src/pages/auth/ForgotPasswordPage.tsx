import { useState, type FormEvent } from 'react';
import { Alert, AlertTitle, Box, Button, CircularProgress, Link, Stack } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { Link as RouterLink, Navigate, useLocation } from 'react-router';
import { useAuth } from '@/auth';
import { FormField } from '@/components/form/FormField';
import { AuthHeader } from './AuthHeader';
import { FormError } from './FormError';
import { useAuthAction } from './useAuthAction';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const { capabilities, sendPasswordReset } = useAuth();
  const location = useLocation();
  const { pending, error, run } = useAuthAction();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!capabilities.passwordReset) return <Navigate to="/login" replace />;

  const emailError = touched && !EMAIL_RE.test(email) ? 'Digite um e-mail válido.' : undefined;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email)) return;
    const target = email.trim();
    const ok = await run('reset', async () => {
      await sendPasswordReset(target);
      return true;
    });
    if (ok) setSentTo(target);
  };

  return (
    <>
      <AuthHeader
        title="Recuperar senha"
        subtitle="Enviaremos um link para você criar uma nova senha."
      />
      <FormError message={error} />
      {sentTo ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Confira sua caixa de entrada</AlertTitle>
          Se existir uma conta para <strong>{sentTo}</strong>, você receberá o link em instantes.
        </Alert>
      ) : (
        <Box component="form" noValidate onSubmit={handleSubmit}>
          <Stack spacing={2.5}>
            <FormField
              label="E-mail"
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={Boolean(emailError)}
              helperText={emailError}
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={Boolean(pending)}
            >
              {pending ? <CircularProgress size={22} color="inherit" /> : 'Enviar link'}
            </Button>
          </Stack>
        </Box>
      )}
      <Link
        component={RouterLink}
        to="/login"
        variant="body2"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 3 }}
      >
        <ArrowBackRounded fontSize="small" /> Voltar para o login
      </Link>
    </>
  );
}
