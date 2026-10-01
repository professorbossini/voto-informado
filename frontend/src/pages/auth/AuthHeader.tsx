import type { ReactNode } from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { useAuth } from '@/auth';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  const { providerId } = useAuth();
  return (
    <Stack spacing={3} sx={{ mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandLogo />
        {providerId === 'mock' && (
          <Chip
            size="small"
            variant="soft"
            color="lime"
            icon={<ScienceOutlined />}
            label="Modo demo"
            title="VITE_AUTH_PROVIDER=mock: qualquer e-mail e senha funcionam"
          />
        )}
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
