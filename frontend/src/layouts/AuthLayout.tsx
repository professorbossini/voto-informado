import { Box, Card, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router';
import { AuroraBackground } from '@/components/AuroraBackground';
import { ColorModeToggle } from '@/components/ColorModeToggle';
import { PageTransition } from '@/components/PageTransition';
import { PoweredByFaisca } from '@/components/brand/PoweredByFaisca';
import { brand } from '@/config/brand';

export function AuthLayout() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AuroraBackground />
      <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 1.5 }}>
        <ColorModeToggle />
      </Stack>
      <Box
        component="main"
        sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pb: { xs: 3, sm: 6 } }}
      >
        <PageTransition>
          <Card
            sx={(theme) => ({
              width: '100%',
              maxWidth: 440,
              p: { xs: 3, sm: 4 },
              borderRadius: 6,
              boxShadow: `0 24px 64px -24px ${theme.alpha('#2A1263', 0.25)}`,
              ...theme.applyStyles('dark', {
                boxShadow: `0 24px 64px -24px ${theme.alpha('#000', 0.6)}`,
              }),
            })}
          >
            <Outlet />
          </Card>
        </PageTransition>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pb: 2 }}>
        © {new Date().getFullYear()}
        {brand.name ? ` ${brand.name}` : ''}
      </Typography>
      <PoweredByFaisca />
    </Box>
  );
}
