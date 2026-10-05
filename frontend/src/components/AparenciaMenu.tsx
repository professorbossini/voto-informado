import { useState } from 'react';
import { Box, IconButton, ListSubheader, Menu, MenuItem, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import BrightnessAutoRounded from '@mui/icons-material/BrightnessAutoRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import { useLocalState } from '@/data/localStore';
import { TEMA_PADRAO, TEMAS, type TemaInfo } from '@/theme/temas';

/** Aparência: modo (claro, escuro, sistema) e tema (5 Material, 5 Cupertino). */
export function AparenciaMenu() {
  const { mode, setMode } = useColorScheme();
  const [tema, setTema] = useLocalState<string>('vi:tema', TEMA_PADRAO);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const item = (t: TemaInfo) => (
    <MenuItem key={t.id} selected={t.id === tema} onClick={() => setTema(t.id)} sx={{ gap: 1.5 }}>
      <Box sx={{ width: 22, height: 22, borderRadius: t.estilo === 'cupertino' ? '7px' : '50%', bgcolor: t.cor, border: '2px solid', borderColor: 'background.paper', boxShadow: 1, flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {t.nome}
      </Typography>
      {t.id === tema && <CheckRounded fontSize="small" color="primary" />}
    </MenuItem>
  );

  return (
    <>
      <Tooltip title="Aparência: tema e modo claro/escuro">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Aparência: tema e modo claro ou escuro" aria-haspopup="menu">
          <PaletteRounded />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { minWidth: 250, maxHeight: '80vh' } } }}>
        <Box sx={{ px: 2, pt: 1, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 700, mb: 0.75 }}>
            Modo
          </Typography>
          <ToggleButtonGroup size="small" exclusive fullWidth value={mode ?? 'system'} onChange={(_, v) => v && setMode(v)} aria-label="Modo de cor">
            <ToggleButton value="light" aria-label="Claro">
              <LightModeRounded fontSize="small" sx={{ mr: 0.5 }} /> Claro
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Escuro">
              <DarkModeRounded fontSize="small" sx={{ mr: 0.5 }} /> Escuro
            </ToggleButton>
            <ToggleButton value="system" aria-label="Do sistema">
              <BrightnessAutoRounded fontSize="small" sx={{ mr: 0.5 }} /> Auto
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ListSubheader sx={{ lineHeight: '32px', fontWeight: 700 }}>Material</ListSubheader>
        {TEMAS.filter((t) => t.estilo === 'material').map(item)}
        <ListSubheader sx={{ lineHeight: '32px', fontWeight: 700 }}>Cupertino (iOS)</ListSubheader>
        {TEMAS.filter((t) => t.estilo === 'cupertino').map(item)}
      </Menu>
    </>
  );
}
