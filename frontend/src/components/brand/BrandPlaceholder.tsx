import { Box, Typography } from '@mui/material';
import AddPhotoAlternateOutlined from '@mui/icons-material/AddPhotoAlternateOutlined';

const dashed = {
  border: '1.5px dashed',
  borderColor: 'text.disabled',
  bgcolor: 'transparent',
  transition: 'border-color 200ms, color 200ms, background-color 200ms',
} as const;

/** Transparent, dashed stand-in for the app logo until one is configured. */
export function LogoPlaceholder({ size }: { size: number }) {
  return (
    <Box
      className="brand-placeholder"
      sx={{
        ...dashed,
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: `${Math.round(size * 0.27)}px`,
        display: 'grid',
        placeItems: 'center',
        color: 'text.disabled',
      }}
    >
      <AddPhotoAlternateOutlined sx={{ fontSize: size * 0.48 }} />
    </Box>
  );
}

/** Transparent, dashed stand-in for the app name until VITE_APP_NAME is set. */
export function NamePlaceholder({ fontSize }: { fontSize: string }) {
  return (
    <Typography
      component="span"
      className="brand-placeholder"
      sx={{
        ...dashed,
        fontSize,
        fontWeight: 500,
        color: 'text.disabled',
        borderRadius: 2,
        px: 1,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      Seu app
    </Typography>
  );
}
