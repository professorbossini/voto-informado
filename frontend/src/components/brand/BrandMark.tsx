import { useState } from 'react';
import { Box } from '@mui/material';
import { brand } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { LogoPlaceholder } from './BrandPlaceholder';
import { FaiscaMark } from './FaiscaMark';

/** Your app's logo (from src/brand/ or VITE_APP_LOGO_URL), or a placeholder. */
export function BrandMark({ size = 40 }: { size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!brand.logoUrl || failed) return <LogoPlaceholder size={size} />;

  return (
    <Box
      component="img"
      src={brand.logoUrl}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => {
        console.warn(`[brand] Could not load logo from ${brand.logoUrl}; showing placeholder.`);
        setFailed(true);
      }}
      sx={{
        display: 'block',
        flexShrink: 0,
        objectFit: 'contain',
        borderRadius: `${Math.round(size * 0.27)}px`,
      }}
    />
  );
}

/**
 * Animated mark for splash and 404 screens: your logo pulsing once configured,
 * otherwise the Faísca spark.
 */
export function BrandPulse({ size = 64 }: { size?: number }) {
  if (!brand.logoUrl) return <FaiscaMark size={size} animated />;
  return (
    <Box
      sx={{
        animation: `brand-pulse ${duration.long4 * 3}ms ${easing.standard} infinite`,
        '@keyframes brand-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(0.9)', opacity: 0.75 },
        },
      }}
    >
      <BrandMark size={size} />
    </Box>
  );
}
