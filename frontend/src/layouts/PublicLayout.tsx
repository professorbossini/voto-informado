import { useState } from 'react';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Container,
  Dialog,
  GlobalStyles,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import LoginRounded from '@mui/icons-material/LoginRounded';
import { Link as RouterLink, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/auth';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BossiniMark } from '@/components/brand/BossiniMark';
import { FaiscaMark } from '@/components/brand/FaiscaMark';
import { PoweredByFaisca } from '@/components/brand/PoweredByFaisca';
import { FAISCA_REPO_URL } from '@/config/brand';
import { ColorModeToggle } from '@/components/ColorModeToggle';
import { CandidateSearch } from '@/components/election/CandidateSearch';
import { PageTransition } from '@/components/PageTransition';
import { env } from '@/config/env';
import { useMeta } from '@/data/MetaContext';
import { dateTime } from '@/data/format';
import { AccountMenu } from './AccountMenu';
import { activeNavItem, NAV_ITEMS } from './navigation';

function TrustBar() {
  const { meta } = useMeta();
  return (
    <Box className="vi-chrome" sx={(theme) => ({ bgcolor: 'primary.container', color: 'primary.onContainer', borderBottom: `1px solid ${theme.vars.palette.divider}` })}>
      <Container maxWidth="lg" sx={{ py: 0.75, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          <VerifiedRounded sx={{ fontSize: 15, verticalAlign: 'text-bottom', mr: 0.5 }} />
          {env.enablePesquisas
            ? 'Dados oficiais (TSE, Câmara e Senado) e pesquisas registradas no TSE · sem opinião, sem recomendação de voto'
            : 'Somente dados oficiais (TSE, Câmara e Senado) · sem opinião, sem recomendação de voto'}
        </Typography>
        {meta?.atualizacao.tse_gerado_em && (
          <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            · base do TSE gerada em {dateTime(meta.atualizacao.tse_gerado_em)}
          </Typography>
        )}
        <Link component={RouterLink} to="/sobre" variant="caption" sx={{ color: 'inherit', ml: 'auto' }}>
          Ver fontes e método
        </Link>
      </Container>
    </Box>
  );
}

function Footer() {
  return (
    <Box component="footer" className="vi-chrome" sx={{ borderTop: 1, borderColor: 'divider', mt: 6, py: 4, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ justifyContent: 'space-between' }}>
          <Stack spacing={1} sx={{ maxWidth: 560 }}>
            <BrandLogo size="small" />
            <Typography variant="body2" color="text.secondary">
              Este site apenas reúne e organiza dados públicos publicados por órgãos oficiais. Não produz opinião, não
              apoia candidatos ou partidos e não recomenda votos.{env.enablePesquisas ? ' Pesquisas aparecem só quando registradas no TSE, com a fonte.' : ''} Todos os candidatos são
              apresentados com os mesmos campos, na mesma ordem (alfabética) e com o mesmo destaque.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Encontrou divergência com a fonte oficial? A fonte oficial sempre prevalece. Cada bloco de dados indica o
              arquivo de origem e a data da coleta.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Serviço não oficial:</strong> o Voto Informado não tem vínculo com o TSE, a Justiça Eleitoral, a
              Câmara, o Senado ou qualquer órgão de governo, partido ou candidatura.
            </Typography>
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="subtitle2">Fontes oficiais</Typography>
            <Link href="https://dadosabertos.tse.jus.br/" target="_blank" rel="noopener noreferrer" variant="body2">
              Portal de Dados Abertos do TSE
            </Link>
            <Link href="https://divulgacandcontas.tse.jus.br/" target="_blank" rel="noopener noreferrer" variant="body2">
              DivulgaCandContas (TSE)
            </Link>
            <Link href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noopener noreferrer" variant="body2">
              Dados Abertos da Câmara dos Deputados
            </Link>
            <Link href="https://www12.senado.leg.br/dados-abertos" target="_blank" rel="noopener noreferrer" variant="body2">
              Dados Abertos do Senado Federal
            </Link>
            <Link component={RouterLink} to="/sobre" variant="body2">
              Metodologia completa
            </Link>
            <Link href="https://github.com/professorbossini/voto-informado/issues/new" target="_blank" rel="noopener noreferrer" variant="body2">
              Reportar erro ou divergência
            </Link>
            <Link component={RouterLink} to="/privacidade" variant="body2">
              Política de Privacidade
            </Link>
            <Link component={RouterLink} to="/termos" variant="body2">
              Termos de Uso
            </Link>
          </Stack>
        </Stack>
        <Link
          href={FAISCA_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ mt: 3, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'text.secondary', fontWeight: 500 }}
          aria-label="Interface feita com Faísca, de Rodrigo Bossini (abre o repositório no GitHub)"
        >
          <FaiscaMark size={22} />
          <Typography variant="caption" component="span">
            Interface feita com <strong>Faísca</strong>, template de Rodrigo Bossini
          </Typography>
          <BossiniMark size={18} />
        </Link>
      </Container>
    </Box>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status } = useAuth();
  const current = activeNavItem(pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const mobileItems = NAV_ITEMS.filter((i) => i.mobile);
  const moreItems = NAV_ITEMS.filter((i) => !i.mobile);
  const mobileValue = mobileItems.some((i) => i.to === current) ? current : 'mais';
  const wide = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'));
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'));

  return (
    // env(safe-area-inset-*): status bar, notch and gesture bar in the Android/iOS apps (0 on most browsers).
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 0 } }}>
      <GlobalStyles styles={{ '@media print': { '.vi-chrome, .MuiAppBar-root, .MuiBottomNavigation-root': { display: 'none !important' } } }} />
      <AppBar position="sticky" sx={{ pt: 'env(safe-area-inset-top)' }}>
        <Toolbar sx={{ gap: 2, minHeight: { xs: 60, sm: 64 } }}>
          <NavLink to="/" style={{ textDecoration: 'none', color: 'inherit' }} aria-label="Início">
            <BrandLogo size="small" />
          </NavLink>
          <Tabs
            value={wide || mobileItems.some((i) => i.to === current) ? current : 'mais'}
            component="nav"
            aria-label="Navegação principal"
            variant="scrollable"
            scrollButtons={false}
            sx={{ display: { xs: 'none', md: 'flex' }, minHeight: 64, flex: 1, '& .MuiTab-root': { minHeight: 64 } }}
          >
            {(wide ? NAV_ITEMS : mobileItems).map((item) => (
              <Tab key={item.to} value={item.to} label={item.label} component={NavLink} to={item.to} />
            ))}
            {!wide && <Tab value="mais" label="Mais" icon={<MoreHorizRounded />} iconPosition="end" onClick={(e) => setMoreAnchor(e.currentTarget)} />}
          </Tabs>
          <Stack direction="row" spacing={0.5} sx={{ ml: 'auto', alignItems: 'center' }}>
            <Tooltip title="Buscar candidato">
              <IconButton aria-label="Buscar candidato" onClick={() => setSearchOpen(true)}>
                <SearchRounded />
              </IconButton>
            </Tooltip>
            <ColorModeToggle />
            {env.enableLogin &&
              (status === 'authenticated' ? (
                <AccountMenu />
              ) : (
                <Button component={RouterLink} to="/login" startIcon={<LoginRounded />} variant="tonal" size="small">
                  Entrar
                </Button>
              ))}
          </Stack>
        </Toolbar>
      </AppBar>
      <TrustBar />

      <Container component="main" maxWidth="lg" sx={{ pt: { xs: 3, md: 4 }, pb: 6, flex: 1 }}>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Container>

      <Footer />

      <Paper
        component="nav"
        aria-label="Navegação principal"
        sx={{ display: { md: 'none' }, position: 'fixed', insetInline: 0, bottom: 0, zIndex: 'appBar', borderRadius: 0, pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }}
      >
        <BottomNavigation value={mobileValue} showLabels sx={{ '& .MuiBottomNavigationAction-root': { minWidth: 0, px: 0.25 } }}>
          {mobileItems.map((item) => (
            <BottomNavigationAction key={item.to} value={item.to} label={'short' in item ? item.short : item.label} icon={<item.icon />} component={NavLink} to={item.to} />
          ))}
          <BottomNavigationAction value="mais" label="Mais" icon={<MoreHorizRounded />} onClick={(e) => setMoreAnchor(e.currentTarget)} />
        </BottomNavigation>
      </Paper>
      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: desktop ? 'bottom' : 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: desktop ? 'top' : 'bottom', horizontal: 'right' }}
      >
        {moreItems.map((item) => (
          <MenuItem
            key={item.to}
            selected={current === item.to}
            onClick={() => {
              setMoreAnchor(null);
              void navigate(item.to);
            }}
          >
            <ListItemIcon>
              <item.icon fontSize="small" />
            </ListItemIcon>
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Buscar candidatura</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Todas as candidaturas que estão na urna em 2026, segundo o TSE.
          </Typography>
          <CandidateSearch
            autoFocus
            onPick={(sq) => {
              setSearchOpen(false);
              void navigate(`/candidato/${sq}`);
            }}
          />
        </DialogContent>
      </Dialog>

      <PoweredByFaisca sx={{ bottom: { xs: 88, md: 16 } }} />
    </Box>
  );
}
