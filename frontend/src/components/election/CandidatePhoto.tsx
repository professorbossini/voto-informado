import { useState } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import PersonRounded from '@mui/icons-material/PersonRounded';
import { assetUrl } from '@/data/api';

/**
 * Official photo sent by the candidate to the TSE (or by the Câmara/Senado for
 * parliamentarians). Always 3:4, same treatment for everyone.
 */
export function CandidatePhoto({
  src,
  alt,
  width = 96,
  rounded = 12,
  sx,
}: {
  src: string | null | undefined;
  alt: string;
  width?: number | string;
  rounded?: number;
  sx?: SxProps<Theme>;
}) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  return (
    <Box
      sx={[
        {
          width,
          aspectRatio: '3 / 4',
          borderRadius: `${rounded}px`,
          overflow: 'hidden',
          flexShrink: 0,
          bgcolor: 'background.subtle',
          display: 'grid',
          placeItems: 'center',
          color: 'text.disabled',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {url && !failed ? (
        <Box
          component="img"
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <PersonRounded sx={{ fontSize: '2.5rem' }} aria-label={`${alt} (sem foto oficial)`} />
      )}
    </Box>
  );
}
