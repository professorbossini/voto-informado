import {
  AppBar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
} from '@mui/material';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { NavLink, Outlet, useLocation } from 'react-router';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { PoweredByFaisca } from '@/components/brand/PoweredByFaisca';
import { ColorModeToggle } from '@/components/ColorModeToggle';
import { useNotify } from '@/components/feedback/notificationsContext';
import { PageTransition } from '@/components/PageTransition';
import { brand } from '@/config/brand';
import { AccountMenu } from './AccountMenu';
import { activeNavItem, NAV_ITEMS } from './navigation';

export function AppLayout() {
  const { pathname } = useLocation();
  const notify = useNotify();
  const current = activeNavItem(pathname);

  return (
    <Box sx={{ minHeight: '100dvh', pb: { xs: 11, md: 0 } }}>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 3, minHeight: { xs: 60, sm: 64 } }}>
          {brand.needsSetup ? (
            // Placeholder is itself a button (opens the brand guide), so no link around it.
            <BrandLogo size="small" />
          ) : (
            <NavLink
              to="/"
              style={{ textDecoration: 'none', color: 'inherit' }}
              aria-label="Início"
            >
              <BrandLogo size="small" />
            </NavLink>
          )}
          <Tabs
            value={current}
            component="nav"
            aria-label="Navegação principal"
            sx={{
              display: { xs: 'none', md: 'flex' },
              minHeight: 64,
              '& .MuiTab-root': { minHeight: 64 },
            }}
          >
            {NAV_ITEMS.map((item) => (
              <Tab
                key={item.to}
                value={item.to}
                label={item.label}
                component={NavLink}
                to={item.to}
              />
            ))}
          </Tabs>
          <Stack direction="row" spacing={0.5} sx={{ ml: 'auto', alignItems: 'center' }}>
            <Tooltip title="Buscar">
              <IconButton
                aria-label="Buscar"
                onClick={() => notify('A busca fica por sua conta 😉')}
              >
                <SearchRounded />
              </IconButton>
            </Tooltip>
            <Tooltip title="Notificações">
              <IconButton
                aria-label="Notificações"
                onClick={() => notify('Nenhuma notificação nova.')}
              >
                <Badge variant="dot" color="secondary" overlap="circular">
                  <NotificationsNoneRounded />
                </Badge>
              </IconButton>
            </Tooltip>
            <ColorModeToggle />
            <AccountMenu />
          </Stack>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, pb: 10 }}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Container>

      <Paper
        component="nav"
        aria-label="Navegação principal"
        sx={{
          display: { md: 'none' },
          position: 'fixed',
          insetInline: 0,
          bottom: 0,
          zIndex: 'appBar',
          borderRadius: 0,
        }}
      >
        <BottomNavigation value={current} showLabels>
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.to}
              value={item.to}
              label={item.label}
              icon={<item.icon />}
              component={NavLink}
              to={item.to}
            />
          ))}
        </BottomNavigation>
      </Paper>

      <PoweredByFaisca sx={{ bottom: { xs: 88, md: 16 } }} />
    </Box>
  );
}
