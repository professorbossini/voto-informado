import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShareRounded from '@mui/icons-material/ShareRounded';
import { useLocation } from 'react-router';
import { useNotify } from '@/components/feedback/notificationsContext';
import { capaDaTela, cartaoRegistrado, type MontarCartao } from '@/components/compartilhar/cartaoPagina';
import { DialogoCompartilhar } from '@/components/compartilhar/DialogoCompartilhar';
import { capturarFigura } from '@/components/compartilhar/figura';
import { isNativeApp, publicUrl, shareContent } from '@/native/platform';
import { useShareOverride } from './shareOverride';

const SITE = 'Tá na Urna';

/** Título da página aberta: o primeiro h1 do conteúdo, com o nome do site. */
function tituloDaPagina(): string {
  const h1 = document.querySelector('main h1')?.textContent?.trim();
  return h1 && h1 !== SITE ? `${h1} · ${SITE}` : `${SITE} · Eleições 2026 com dados oficiais`;
}

/**
 * Botão "compartilhar" (ícone clássico) presente em todas as páginas. Abre o diálogo com uma
 * imagem da página pronta para cada rede (feed, stories, post com link), com o endereço desta
 * página (com filtros e estado) e um QR code dele. A página com dados próprios (candidatura,
 * comparação...) usa o cartão dela; as demais, uma capa com o título e o resumo da tela.
 * No app, compartilha direto o link (o plugin nativo não envia imagens).
 */
export function ShareButton() {
  const { pathname, search } = useLocation();
  const ov = useShareOverride();
  const notify = useNotify();
  const [aberto, setAberto] = useState<{ montar: MontarCartao; texto?: string } | null>(null);
  const url = publicUrl(ov ?? `${pathname}${search}`);

  const abrir = async () => {
    if (isNativeApp) {
      const r = await shareContent({ title: tituloDaPagina(), text: tituloDaPagina(), url });
      if (r === 'copied') notify('Link copiado.');
      return;
    }
    const reg = cartaoRegistrado();
    // A capa é lida da tela na hora do clique (o que está aberto agora), com a figura principal
    // da página (mapa, plenário, gráfico) fotografada antes de o diálogo cobrir a tela.
    const capa = capaDaTela(url);
    const figura = reg ? null : capturarFigura();
    setAberto(reg ? { montar: reg.montar, texto: reg.texto() } : { montar: async () => ({ ...capa, figura: await figura }), texto: tituloDaPagina() });
  };

  return (
    <>
      <Tooltip title="Compartilhar esta página">
        <IconButton aria-label="Compartilhar esta página" aria-haspopup="dialog" onClick={() => void abrir()}>
          <ShareRounded />
        </IconButton>
      </Tooltip>
      {aberto && <DialogoCompartilhar aberto fechar={() => setAberto(null)} montar={aberto.montar} texto={aberto.texto} url={url} />}
    </>
  );
}
