import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router';
import { duration, easing } from '@/theme/motion';

/**
 * Material 3 "fade through" style entrance for route changes.
 * Keyed by pathname so every navigation replays the animation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <Box
      key={pathname}
      sx={{
        animation: `faisca-page-enter ${duration.long1}ms ${easing.emphasizedDecelerate} both`,
        '@keyframes faisca-page-enter': {
          from: { opacity: 0, transform: 'translateY(12px) scale(0.995)' },
          to: { opacity: 1, transform: 'none' },
        },
      }}
    >
      {children}
    </Box>
  );
}
