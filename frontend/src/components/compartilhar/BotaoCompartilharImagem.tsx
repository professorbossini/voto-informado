import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type ButtonProps,
} from '@mui/material';
import ImageRounded from '@mui/icons-material/ImageRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import { useNotify } from '@/components/feedback/notificationsContext';
import { isNativeApp } from '@/native/platform';
import type { CartaoDados } from './dados';
import type { Formato } from './desenho';
import { baixarArquivo, compartilharImagem, podeCompartilharArquivo } from './compartilhar';
import { nomeArquivo } from './texto';

interface Gerada {
  arquivo: File;
  src: string;
}

/** Texto que acompanha a imagem: quem aparece e o assunto, sem nenhum juízo. */
function textoPadrao(d: CartaoDados): string {
  return `${d.pessoas.map((p) => p.nome).join(', ')} · ${d.titulo}: dados oficiais no Tá na Urna`;
}

/**
 * Botão "Compartilhar imagem": gera no próprio aparelho um cartão (PNG) com os dados oficiais que a
 * página já carregou, mostra a prévia e então compartilha (celular), baixa e copia o link
 * (computador) ou usa o compartilhamento nativo (app). `montar` só roda quando a pessoa abre a prévia.
 */
export function BotaoCompartilharImagem({
  montar,
  texto,
  rotulo = 'Compartilhar imagem',
  ...botao
}: {
  montar: () => CartaoDados | Promise<CartaoDados>;
  /** Texto enviado junto com a imagem; o padrão cita os nomes e o assunto do cartão. */
  texto?: string;
  rotulo?: string;
} & Omit<ButtonProps, 'onClick' | 'children'>) {
  const notify = useNotify();
  const [aberto, setAberto] = useState(false);
  const [formato, setFormato] = useState<Formato>('retrato');
  const [dados, setDados] = useState<CartaoDados | null>(null);
  const [geradas, setGeradas] = useState<Partial<Record<Formato, Gerada | 'erro'>>>({});
  const [enviando, setEnviando] = useState(false);
  const atual = geradas[formato];

  useEffect(() => {
    if (!aberto || atual) return;
    let cancelado = false;
    Promise.resolve(montar())
      .then(async (d) => {
        const { gerarCartao } = await import('./desenho');
        const blob = await gerarCartao(d, formato);
        const base = d.pessoas.length === 1 ? d.pessoas[0].nome : d.titulo;
        const arquivo = new File([blob], nomeArquivo(formato === 'paisagem' ? `${base} paisagem` : base), { type: 'image/png' });
        return { d, gerada: { arquivo, src: URL.createObjectURL(blob) } };
      })
      .then(
        ({ d, gerada }) => {
          if (cancelado) return URL.revokeObjectURL(gerada.src);
          setDados(d);
          setGeradas((g) => ({ ...g, [formato]: gerada }));
        },
        () => !cancelado && setGeradas((g) => ({ ...g, [formato]: 'erro' })),
      );
    return () => {
      cancelado = true;
    };
    // montar muda a cada render da página; a imagem só é refeita ao abrir de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, formato, atual]);

  const fechar = () => {
    setAberto(false);
    for (const g of Object.values(geradas)) if (g && g !== 'erro') URL.revokeObjectURL(g.src);
    setGeradas({});
    setDados(null);
  };

  const pronta = atual && atual !== 'erro' ? atual : null;
  const nativo = isNativeApp;
  const compartilhaArquivo = pronta ? podeCompartilharArquivo(pronta.arquivo) : false;

  const enviar = async () => {
    if (!nativo && !pronta) return;
    setEnviando(true);
    const d = dados ?? (await montar());
    const r = await compartilharImagem(pronta?.arquivo ?? null, { titulo: d.titulo, texto: texto ?? textoPadrao(d), url: d.url });
    setEnviando(false);
    if (r === 'cancelado') return;
    if (r === 'falhou') return notify('Não foi possível compartilhar agora.', 'error');
    if (r === 'baixado-e-copiado') notify('Imagem baixada e link da página copiado.');
    else if (r === 'baixado') notify('Imagem baixada.');
    else if (r === 'link-copiado') notify('Link copiado.');
    fechar();
  };

  const { w, h } = formato === 'retrato' ? { w: 1080, h: 1350 } : { w: 1200, h: 630 };

  return (
    <>
      <Button variant="outlined" startIcon={<ImageRounded />} {...botao} onClick={() => setAberto(true)}>
        {rotulo}
      </Button>
      <Dialog open={aberto} onClose={fechar} fullWidth maxWidth="sm" aria-labelledby="titulo-compartilhar-imagem">
        <DialogTitle id="titulo-compartilhar-imagem">Imagem para compartilhar</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={formato}
              onChange={(_, v: Formato | null) => v && setFormato(v)}
              aria-label="Formato da imagem"
            >
              <ToggleButton value="retrato">Retrato · 1080×1350</ToggleButton>
              <ToggleButton value="paisagem">Paisagem · 1200×630</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ width: '100%', display: 'grid', placeItems: 'center' }}>
              {pronta ? (
                <Box
                  component="img"
                  src={pronta.src}
                  alt="Prévia da imagem com os dados oficiais desta página"
                  sx={{ display: 'block', maxWidth: '100%', maxHeight: '58vh', aspectRatio: `${w} / ${h}`, borderRadius: 2, boxShadow: 3 }}
                />
              ) : atual === 'erro' ? (
                <Alert severity="error" sx={{ width: '100%' }}>
                  Não foi possível gerar a imagem neste aparelho. O link da página continua disponível no botão de compartilhar.
                </Alert>
              ) : (
                <Skeleton variant="rounded" aria-label="Gerando a imagem" sx={{ width: formato === 'retrato' ? 'min(100%, calc(58vh * 0.8))' : '100%', height: 'auto', aspectRatio: `${w} / ${h}` }} />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              A imagem é gerada no seu aparelho, só com os dados oficiais já mostrados nesta página, a fonte e o link para conferir.
            </Typography>
            {nativo && (
              <Alert severity="info" sx={{ width: '100%' }}>
                No aplicativo, o compartilhamento envia o link desta página, que abre com a prévia própria.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={fechar}>Cancelar</Button>
          {!nativo && compartilhaArquivo && (
            <Button startIcon={<DownloadRounded />} disabled={!pronta} onClick={() => pronta && (baixarArquivo(pronta.arquivo), notify('Imagem baixada.'))}>
              Baixar
            </Button>
          )}
          <Button variant="contained" startIcon={nativo || compartilhaArquivo ? <ShareRounded /> : <DownloadRounded />} disabled={(!nativo && !pronta) || enviando} onClick={() => void enviar()}>
            {nativo ? 'Compartilhar link' : compartilhaArquivo ? 'Compartilhar' : 'Baixar imagem e copiar link'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
