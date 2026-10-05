import { useEffect, useState } from 'react';
import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import TranslateRounded from '@mui/icons-material/TranslateRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { useIdioma } from '@/i18n/useIdioma';
import { IDIOMAS, ORIGINAL } from '@/i18n/idiomas';
import { aplicarIdioma } from '@/i18n/tradutor';

/** Aplica o idioma salvo em toda a página (montado uma vez no layout). */
export function AplicarIdioma() {
  const [idioma] = useIdioma();
  useEffect(() => {
    void aplicarIdioma(idioma);
  }, [idioma]);
  return null;
}

/** Canto superior direito: escolha entre o português original e 20 idiomas. */
export function IdiomaMenu() {
  const [idioma, setIdioma] = useIdioma();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const atual = IDIOMAS.find((i) => i.id === idioma) ?? IDIOMAS[0];
  return (
    <>
      {/* translate="no": o nome dos idiomas fica sempre no próprio idioma */}
      <Tooltip title={`Idioma / Language: ${atual.nome}`}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label={`Idioma / Language: ${atual.nome}`} aria-haspopup="menu" translate="no">
          <TranslateRounded />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} translate="no" slotProps={{ paper: { sx: { maxHeight: '75vh', minWidth: 220 } } }}>
        {IDIOMAS.map((i) => (
          <MenuItem
            key={i.id}
            lang={i.id}
            selected={i.id === atual.id}
            onClick={() => {
              setIdioma(i.id);
              setAnchor(null);
            }}
          >
            <ListItemText>{i.nome}</ListItemText>
            {i.id === atual.id && <CheckRounded fontSize="small" color="primary" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Rodapé: aviso de que é tradução (no próprio idioma) e de que vale o texto em português. */
export function AvisoTraducao() {
  const [idioma] = useIdioma();
  const i = IDIOMAS.find((x) => x.id === idioma);
  if (!i || i.id === ORIGINAL) return null;
  return (
    <p translate="no" lang={i.id} style={{ margin: '12px 0 0', fontSize: '0.75rem', opacity: 0.75, textAlign: 'center' }}>
      {i.aviso}
    </p>
  );
}
