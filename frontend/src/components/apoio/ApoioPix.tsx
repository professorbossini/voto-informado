import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import { matrizQr } from '@/components/compartilhar/qr';
import { PIX, codigoPix } from './pix';

const CODIGO = codigoPix(PIX);

/** QR em SVG (módulos escuros num fundo branco, com a margem de 4 módulos), legível também no tema escuro. */
function QrPix({ lado }: { lado: number }) {
  const caminho = useMemo(() => {
    const m = matrizQr(CODIGO);
    let d = '';
    m.forEach((linha, r) => linha.forEach((escuro, c) => escuro && (d += `M${c + 4} ${r + 4}h1v1h-1z`)));
    return { d, n: m.length + 8 };
  }, []);
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${caminho.n} ${caminho.n}`}
      role="img"
      aria-label="QR Code do Pix para apoiar o Tá na Urna"
      shapeRendering="crispEdges"
      sx={{ width: lado, height: lado, display: 'block', mx: 'auto', borderRadius: 2, bgcolor: '#FFFFFF' }}
    >
      <path d={caminho.d} fill="#2A1263" />
    </Box>
  );
}

/**
 * Cartão "Apoie o Tá na Urna": QR Code e botão de copiar o Pix (de qualquer valor) para ajudar a
 * pagar os servidores. Só no site (o PublicLayout não o mostra no aplicativo).
 */
export function ApoioPix({ sx }: { sx?: object }) {
  const [copia, setCopia] = useState<'nada' | 'feita' | 'falhou'>('nada');

  useEffect(() => {
    if (copia !== 'feita') return;
    const t = setTimeout(() => setCopia('nada'), 2500);
    return () => clearTimeout(t);
  }, [copia]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(CODIGO);
      setCopia('feita');
    } catch {
      setCopia('falhou');
    }
  };

  return (
    <Box
      component="aside"
      aria-labelledby="apoio-pix-titulo"
      className="vi-chrome"
      sx={{ textAlign: 'center', p: 2, borderRadius: 4, border: 1, borderColor: 'divider', bgcolor: 'background.paper', ...sx }}
    >
      <Typography id="apoio-pix-titulo" variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
        Apoie o Tá na Urna
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Gratuito e sem cadastro. Um Pix de qualquer valor ajuda a manter os servidores no ar.
      </Typography>
      <QrPix lado={132} />
      <Button
        variant="outlined"
        fullWidth
        onClick={() => void copiar()}
        startIcon={copia === 'feita' ? <CheckRounded /> : <ContentCopyRounded />}
        sx={{ mt: 1.5 }}
      >
        {copia === 'feita' ? 'Código copiado!' : 'Copiar código Pix'}
      </Button>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {copia === 'falhou' ? `Chave aleatória: ${PIX.chave}` : 'Pix para a Faísca, que mantém o Tá na Urna.'}
      </Typography>
    </Box>
  );
}
