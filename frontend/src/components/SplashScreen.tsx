import { Box, Fade } from '@mui/material';
import { BrandPulse } from './brand/BrandMark';

/** Shown while the auth adapter restores the session. */
export function SplashScreen() {
  return (
    <Fade in timeout={{ enter: 400 }} style={{ transitionDelay: '150ms' }}>
      <Box
        role="progressbar"
        aria-label="Carregando"
        sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}
      >
        <BrandPulse size={64} />
      </Box>
    </Fade>
  );
}
