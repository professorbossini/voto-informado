import { useEffect } from 'react';
import { Button, Link, Paper, Stack, Typography } from '@mui/material';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import { Link as RouterLink, useLocation } from 'react-router';
import { abrirPreferencias, escolher, medicaoDisponivel, paginaVista, useAvisoMedicao } from '@/analytics/medicao';

/**
 * Aviso de medição de audiência (Google Analytics, só com consentimento). Aparece na primeira
 * visita e quando reaberto pelo rodapé; "Recusar" tem o mesmo peso de "Aceitar" (LGPD).
 */
export function AvisoMedicao() {
  const aberto = useAvisoMedicao();
  if (!aberto) return null;
  return (
    <Paper
      role="region"
      aria-label="Medição de audiência"
      elevation={8}
      className="vi-chrome"
      sx={{ position: 'fixed', zIndex: 'snackbar', insetInline: { xs: 8, sm: 'auto' }, right: { sm: 16 }, bottom: { xs: 'calc(64px + env(safe-area-inset-bottom))', md: 16 }, maxWidth: { sm: 440 }, p: 2, borderRadius: 4 }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <InsightsRounded color="primary" fontSize="small" />
          <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 800 }}>
            Podemos contar a sua visita?
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Com a sua permissão, o Google Analytics conta visitas e páginas vistas, em números agregados, sem anúncios personalizados. Nada do que você consulta é ligado a você.{' '}
          <Link component={RouterLink} to="/privacidade">
            Política de Privacidade
          </Link>
          .
        </Typography>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => escolher('recusado')}>
            Recusar
          </Button>
          <Button variant="contained" onClick={() => escolher('aceito')}>
            Aceitar
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

/** Conta cada página vista (o site é de página única), depois que o título da página aparece. */
export function ContagemDePaginas() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!medicaoDisponivel) return;
    const t = setTimeout(() => {
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      paginaVista(`${pathname}${search}`, h1 ? `${h1} · Tá na Urna` : document.title);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, search]);
  return null;
}

/** Link do rodapé para mudar a escolha a qualquer momento. */
export function LinkPreferenciasMedicao() {
  if (!medicaoDisponivel) return null;
  return (
    <Link component="button" type="button" variant="body2" onClick={abrirPreferencias} sx={{ textAlign: 'left' }}>
      Preferências de medição
    </Link>
  );
}
