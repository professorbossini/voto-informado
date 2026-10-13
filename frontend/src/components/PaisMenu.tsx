import { useState } from 'react';
import { Box, Button, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { useLocation, useNavigate } from 'react-router';
import { PAISES, naAreaEua } from './pais';

/** Seletor de país no topo: troca de área sem mexer em nada da outra. */
export function PaisMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const atual = naAreaEua(pathname) ? PAISES[1] : PAISES[0];
  return (
    <>
      <Tooltip title={`País: ${atual.nome}`}>
        <Button
          color="inherit"
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={`País: ${atual.nome}. Trocar de país`}
          aria-haspopup="menu"
          endIcon={<ExpandMoreRounded />}
          sx={{ minWidth: 0, px: { xs: 0.75, sm: 1 }, textTransform: 'none', fontWeight: 700, '& .MuiButton-endIcon': { display: { xs: 'none', sm: 'inherit' } } }}
        >
          <Box component="span" aria-hidden sx={{ fontSize: 20, lineHeight: 1 }}>
            {atual.bandeira}
          </Box>
          <Typography component="span" variant="body2" sx={{ ml: 0.75, fontWeight: 700, display: { xs: 'none', sm: 'inline' } }}>
            {atual.id === 'br' ? 'BR' : 'EUA'}
          </Typography>
        </Button>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {PAISES.map((p) => (
          <MenuItem
            key={p.id}
            selected={p.id === atual.id}
            onClick={() => {
              setAnchor(null);
              if (p.id !== atual.id) void navigate(p.inicio);
            }}
          >
            <Box component="span" aria-hidden sx={{ fontSize: 20, mr: 1.5 }}>
              {p.bandeira}
            </Box>
            <ListItemText>{p.nome}</ListItemText>
            {p.id === atual.id && <CheckRounded fontSize="small" color="primary" sx={{ ml: 1 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
