import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import { matrizQr } from '@/components/compartilhar/qr';
import { PIX, codigoPix } from './pix';

const CODIGO = codigoPix(PIX);

/** QR em SVG (módulos escuros num fundo branco, com a margem de 4 módulos), legível também no tema escuro. */
function QrPix({ lado, sx }: { lado: number; sx?: object }) {
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
      sx={{ width: lado, height: lado, display: 'block', mx: 'auto', borderRadius: 2, bgcolor: '#FFFFFF', flexShrink: 0, ...sx }}
    >
      <path d={caminho.d} fill="#2A1263" />
    </Box>
  );
}

function useCopiaPix() {
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
  return { copia, copiar };
}

function BotaoCopiar({ copia, copiar, size, sx }: ReturnType<typeof useCopiaPix> & { size?: 'small'; sx?: object }) {
  return (
    <Button
      variant="outlined"
      size={size}
      onClick={() => void copiar()}
      startIcon={copia === 'feita' ? <CheckRounded /> : <ContentCopyRounded />}
      sx={{ whiteSpace: 'nowrap', ...sx }}
    >
      {copia === 'feita' ? 'Código copiado!' : 'Copiar código Pix'}
    </Button>
  );
}

const legenda = (copia: string) =>
  copia === 'falhou' ? `Chave aleatória: ${PIX.chave}` : 'Pix para a Faísca, que mantém o Tá na Urna.';

/**
 * Cartão "Apoie o Tá na Urna": QR Code e botão de copiar o Pix (de qualquer valor) para ajudar a
 * pagar os servidores. Só no site (o PublicLayout não o mostra no aplicativo). `faixa` é a versão
 * baixa, em linha, do alto das páginas: no celular sem o QR (ninguém escaneia a própria tela), só o
 * botão de copiar.
 */
export function ApoioPix({ faixa = false, sx }: { faixa?: boolean; sx?: object }) {
  const pix = useCopiaPix();

  if (faixa)
    return (
      <Box
        component="aside"
        aria-labelledby="apoio-pix-titulo"
        className="vi-chrome"
        sx={{
          display: 'flex',
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          alignItems: 'center',
          gap: { xs: 1, sm: 2 },
          px: 2,
          py: 1.25,
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          ...sx,
        }}
      >
        <QrPix lado={64} sx={{ display: { xs: 'none', sm: 'block' }, mx: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="apoio-pix-titulo" variant="subtitle2" component="h2" sx={{ fontWeight: 700 }}>
            Apoie o Tá na Urna
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gratuito e sem cadastro. Um Pix de qualquer valor ajuda a manter os servidores no ar.
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ display: { xs: pix.copia === 'falhou' ? 'block' : 'none', md: 'block' } }}>
            {legenda(pix.copia)}
          </Typography>
        </Box>
        <BotaoCopiar {...pix} size="small" sx={{ width: { xs: '100%', sm: 'auto' } }} />
      </Box>
    );

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
      <BotaoCopiar {...pix} sx={{ mt: 1.5, width: '100%' }} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {legenda(pix.copia)}
      </Typography>
    </Box>
  );
}
