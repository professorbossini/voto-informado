import { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { ADSENSE } from '@/config/anuncios';

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

let carregado = false;
function carregarAdSense() {
  if (carregado) return;
  carregado = true;
  // Anúncios não personalizados para todo mundo: nada do perfil ou do histórico de quem visita.
  window.adsbygoogle = window.adsbygoogle ?? [];
  window.adsbygoogle.requestNonPersonalizedAds = 1;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE.cliente)}`;
  document.head.appendChild(s);
}

/**
 * Um bloco de display do AdSense, identificado como "Publicidade" e separado dos dados. O espaço
 * fica reservado mesmo enquanto o AdSense não manda nada (site em análise, sem anúncio para a
 * visita): até ser preenchido, aparece como uma caixa tracejada vazia. `lateral` é a coluna fixa
 * vertical das telas bem largas.
 */
export function Anuncio({ lateral = false, sx }: { lateral?: boolean; sx?: object }) {
  const enviado = useRef(false);
  const insRef = useRef<HTMLModElement>(null);
  // O AdSense marca o <ins> com data-ad-status="filled" | "unfilled" quando decide.
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins) return;
    const observador = new MutationObserver(() => setStatus(ins.getAttribute('data-ad-status')));
    observador.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (enviado.current || !ADSENSE.bloco) return;
    enviado.current = true;
    carregarAdSense();
    try {
      window.adsbygoogle!.push({});
    } catch {
      // Bloqueador de anúncios ou falha do AdSense nunca podem quebrar a página.
    }
  }, []);

  if (!ADSENSE.bloco) return null;
  const altura = lateral ? 250 : 90;
  return (
    <Box component="aside" aria-label="Publicidade" className="vi-chrome" sx={{ textAlign: 'center', ...sx }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        Publicidade
      </Typography>
      <Box sx={{ minHeight: altura, borderRadius: 1, ...(status !== 'filled' && { border: 1, borderStyle: 'dashed', borderColor: 'divider' }) }}>
        {/* O AdSense esconde o <ins> não preenchido (display: none); a caixa acima guarda o espaço. */}
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block', minHeight: altura }}
          data-ad-client={ADSENSE.cliente}
          data-ad-slot={ADSENSE.bloco}
          data-ad-format={lateral ? 'vertical' : 'auto'}
          data-full-width-responsive={lateral ? 'false' : 'true'}
        />
      </Box>
    </Box>
  );
}
