import type { ReactNode } from 'react';
import { Alert, Card, CardContent, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { LEGAL, vigenciaPorExtenso } from '@/config/legal';
import { PageHeader } from '@/pages/PageHeader';

export function Secao({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Stack component="section" spacing={1} sx={{ '& ul': { m: 0, pl: 2.5 }, '& li': { mb: 0.75 } }}>
      <Typography variant="h6" component="h2">
        {n}. {title}
      </Typography>
      {children}
    </Stack>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body1" component="p">
      {children}
    </Typography>
  );
}

export function Contato() {
  return (
    <>
      <Link href={`mailto:${LEGAL.email}`}>{LEGAL.email}</Link> ou pelas{' '}
      <Link href={`${LEGAL.repositorio}/issues/new`} target="_blank" rel="noopener noreferrer">
        issues do repositório público
      </Link>
    </>
  );
}

export function LegalDoc({ title, resumo, outro, children }: { title: string; resumo: ReactNode; outro: { to: string; label: string }; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} subtitle={`${LEGAL.projeto} · site e aplicativos · versão de ${vigenciaPorExtenso()}`} />
      <Stack spacing={3} sx={{ maxWidth: 820 }}>
        <Alert severity="info" variant="outlined">
          {resumo}
        </Alert>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={3}>{children}</Stack>
          </CardContent>
        </Card>
        <Typography variant="body2" color="text.secondary">
          Veja também: <Link component={RouterLink} to={outro.to}>{outro.label}</Link> ·{' '}
          <Link component={RouterLink} to="/sobre">Fontes e método</Link>
        </Typography>
      </Stack>
    </>
  );
}
