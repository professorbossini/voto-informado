import { useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, Navigate } from 'react-router';
import { useAuth } from '@/auth';
import { FormField } from '@/components/form/FormField';
import { PasswordField } from '@/components/form/PasswordField';
import { AuthHeader } from './AuthHeader';
import { FormError } from './FormError';
import { GoogleButton } from './GoogleButton';
import { OrDivider } from './OrDivider';
import { useAuthAction } from './useAuthAction';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Excelente'];
  return {
    value: (score / 5) * 100,
    label: labels[score]!,
    color: score >= 3 ? 'lime' : score >= 2 ? 'primary' : 'error',
  } as const;
}

export function SignUpPage() {
  const { capabilities, signInWithGoogle, signUpWithEmail } = useAuth();
  const { pending, error, run } = useAuthAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  if (!capabilities.signUp) return <Navigate to="/login" replace />;

  const errors = {
    name: touched && !name.trim() ? 'Como podemos te chamar?' : undefined,
    email: touched && !EMAIL_RE.test(email) ? 'Digite um e-mail válido.' : undefined,
    password: touched && password.length < 8 ? 'Use pelo menos 8 caracteres.' : undefined,
  };
  const strength = passwordStrength(password);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || !EMAIL_RE.test(email) || password.length < 8) return;
    void run('email', () => signUpWithEmail({ name: name.trim(), email: email.trim(), password }));
  };

  return (
    <>
      <AuthHeader
        title="Criar conta"
        subtitle={
          <>
            Já tem conta?{' '}
            <Link component={RouterLink} to="/login">
              Entrar
            </Link>
          </>
        }
      />
      <FormError message={error} />
      <GoogleButton
        label="Continuar com Google"
        loading={pending === 'google'}
        disabled={Boolean(pending)}
        onClick={() => void run('google', signInWithGoogle)}
      />
      <OrDivider />
      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Stack spacing={2.5}>
          <FormField
            label="Nome"
            autoComplete="name"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
          />
          <FormField
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(errors.email)}
            helperText={errors.email}
          />
          <Stack spacing={1}>
            <PasswordField
              label="Senha"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={Boolean(errors.password)}
              helperText={errors.password}
            />
            {password && (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <LinearProgress
                  variant="determinate"
                  value={strength.value}
                  color={strength.color}
                  sx={{ flex: 1, height: 4 }}
                  aria-label="Força da senha"
                />
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72 }}>
                  {strength.label}
                </Typography>
              </Stack>
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
            {pending === 'email' ? <CircularProgress size={22} color="inherit" /> : 'Criar conta'}
          </Button>
        </Stack>
      </Box>
    </>
  );
}
