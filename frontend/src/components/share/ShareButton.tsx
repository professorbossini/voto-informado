import { useState } from 'react';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import ShareRounded from '@mui/icons-material/ShareRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import FacebookIcon from '@mui/icons-material/Facebook';
import XIcon from '@mui/icons-material/X';
import TelegramIcon from '@mui/icons-material/Telegram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import EmailRounded from '@mui/icons-material/EmailRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import { useLocation } from 'react-router';
import { useNotify } from '@/components/feedback/notificationsContext';
import { copyText } from '@/components/urna/clipboard';
import { isNativeApp, publicUrl, shareContent } from '@/native/platform';
import { useShareOverride } from './shareOverride';

const SITE = 'Tá na Urna';

/** Título da página aberta: o primeiro h1 do conteúdo, com o nome do site. */
function tituloDaPagina(): string {
  const h1 = document.querySelector('main h1')?.textContent?.trim();
  return h1 && h1 !== SITE ? `${h1} · ${SITE}` : `${SITE} · Eleições 2026 com dados oficiais`;
}

function redes(url: string, texto: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(texto);
  return [
    { nome: 'WhatsApp', icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}` },
    { nome: 'Facebook', icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { nome: 'X (Twitter)', icon: XIcon, href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { nome: 'Telegram', icon: TelegramIcon, href: `https://t.me/share/url?url=${u}&text=${t}` },
    { nome: 'LinkedIn', icon: LinkedInIcon, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { nome: 'E-mail', icon: EmailRounded, href: `mailto:?subject=${t}&body=${encodeURIComponent(`${texto}\n\n${url}`)}` },
  ];
}

/**
 * Botão "compartilhar" (ícone clássico) presente em todas as páginas: compartilha o endereço
 * desta página (com filtros e estado), que abre com prévia própria nas redes sociais.
 * No celular e no app usa a folha de compartilhamento do sistema; no computador, um menu de redes.
 */
export function ShareButton() {
  const { pathname, search } = useLocation();
  const ov = useShareOverride();
  const notify = useNotify();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const url = publicUrl(ov ?? `${pathname}${search}`);

  const abrir = async (e: React.MouseEvent<HTMLElement>) => {
    const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (isNativeApp || (toque && typeof navigator.share === 'function')) {
      const r = await shareContent({ title: tituloDaPagina(), text: tituloDaPagina(), url });
      if (r === 'copied') notify('Link copiado.');
      return;
    }
    setAnchor(e.currentTarget);
  };

  const texto = anchor ? tituloDaPagina() : '';
  return (
    <>
      <Tooltip title="Compartilhar esta página">
        <IconButton aria-label="Compartilhar esta página" aria-haspopup="menu" onClick={(e) => void abrir(e)}>
          <ShareRounded />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { minWidth: 220 } } }}>
        {anchor &&
          redes(url, texto).map((r) => (
            <MenuItem key={r.nome} component="a" href={r.href} target="_blank" rel="noopener noreferrer" onClick={() => setAnchor(null)}>
              <ListItemIcon>
                <r.icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{r.nome}</ListItemText>
            </MenuItem>
          ))}
        <Divider />
        <MenuItem
          onClick={async () => {
            setAnchor(null);
            notify((await copyText(url)) ? 'Link desta página copiado.' : 'Não foi possível copiar o link.');
          }}
        >
          <ListItemIcon>
            <LinkRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copiar link</ListItemText>
        </MenuItem>
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <MenuItem
            onClick={async () => {
              setAnchor(null);
              await shareContent({ title: texto, text: texto, url });
            }}
          >
            <ListItemIcon>
              <MoreHorizRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mais opções…</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
