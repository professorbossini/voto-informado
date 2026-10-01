import { useState, type FormEvent } from 'react';
import { Box, Button, CircularProgress, Link, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { useAuth } from '@/auth';
import { FormField } from '@/components/form/FormField';
import { PasswordField } from '@/components/form/PasswordField';
import { AuthHeader } from './AuthHeader';
import { FormError } from './FormError';
import { GoogleButton } from './GoogleButton';
import { OrDivider } from './OrDivider';
import { useAuthAction } from './useAuthAction';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { capabilities, signInWithGoogle, signInWithEmail } = useAuth();
  const { pending, error, run } = useAuthAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = touched && !EMAIL_RE.test(email) ? 'Digite um e-mail válido.' : undefined;
  const passwordError = touched && !password ? 'Digite sua senha.' : undefined;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!EMAIL_RE.test(email) || !password) return;
    void run('email', () => signInWithEmail(email.trim(), password));
  };

  return (
    <>
      <AuthHeader
        title="Entrar"
        subtitle={
          capabilities.signUp && (
            <>
              Não tem conta?{' '}
              <Link component={RouterLink} to="/signup">
                Criar conta
              </Link>
            </>
          )
        }
      />
      <FormError message={error} />
      <GoogleButton
        loading={pending === 'google'}
        disabled={Boolean(pending)}
        onClick={() => void run('google', signInWithGoogle)}
      />

      {capabilities.emailPassword && (
        <>
          <OrDivider />
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
              />
              <Stack spacing={1}>
                <PasswordField
                  label="Senha"
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={Boolean(passwordError)}
                  helperText={passwordError}
                />
                {capabilities.passwordReset && (
                  <Link
                    component={RouterLink}
                    to="/forgot-password"
                    state={{ email }}
                    variant="body2"
                    sx={{ alignSelf: 'flex-end', fontWeight: 500 }}
                  >
                    Esqueci minha senha
                  </Link>
                )}
              </Stack>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={Boolean(pending)}
                sx={{ mt: 1 }}
              >
                {pending === 'email' ? <CircularProgress size={22} color="inherit" /> : 'Entrar'}
              </Button>
            </Stack>
          </Box>
        </>
      )}
    </>
  );
}
