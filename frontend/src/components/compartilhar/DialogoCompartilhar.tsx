import { useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkRounded from '@mui/icons-material/LinkRounded';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import ShareRounded from '@mui/icons-material/ShareRounded';
import TelegramIcon from '@mui/icons-material/Telegram';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import XIcon from '@mui/icons-material/X';
import { evento } from '@/analytics/medicao';
import { useNotify } from '@/components/feedback/notificationsContext';
import { copyText } from '@/components/urna/clipboard';
import { isNativeApp } from '@/native/platform';
import type { MontarCartao } from './cartaoPagina';
import type { CartaoDados } from './dados';
import type { Formato } from './desenho';
import { baixarArquivo, compartilharImagem, podeCompartilharArquivo } from './compartilhar';
import { nomeArquivo } from './texto';

interface Gerada {
  arquivo: File;
  src: string;
}

/** Tamanhos em pixels (iguais aos de desenho.ts, repetidos aqui para não carregar o desenho antes da hora). */
const TAM: Record<Formato, { w: number; h: number }> = { retrato: { w: 1080, h: 1350 }, stories: { w: 1080, h: 1920 }, paisagem: { w: 1200, h: 630 } };

const FORMATOS: { f: Formato; rotulo: string; redes: string }[] = [
  { f: 'retrato', rotulo: 'Feed · 4:5', redes: 'Feed do Instagram e do Facebook (1080×1350)' },
  { f: 'stories', rotulo: 'Stories · 9:16', redes: 'Stories do Instagram, Status do WhatsApp e TikTok (1080×1920)' },
  { f: 'paisagem', rotulo: 'Post · 1,91:1', redes: 'X, LinkedIn, Facebook e WhatsApp (1200×630)' },
];

/** Texto que acompanha a imagem: quem aparece (ou o título da página) e o assunto, sem nenhum juízo. */
function textoPadrao(d: CartaoDados): string {
  if (!d.pessoas.length) return `${d.titulo} · dados oficiais no Tá na Urna`;
  return `${d.pessoas.map((p) => p.nome).join(', ')} · ${d.titulo}: dados oficiais no Tá na Urna`;
}

/** Redes para abrir no computador, depois de baixar a imagem (a imagem não viaja pelo link). */
function redes(url: string, texto: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(texto);
  return [
    { nome: 'Instagram', icon: InstagramIcon, href: null, formato: 'retrato' as Formato },
    { nome: 'WhatsApp', icon: WhatsAppIcon, href: `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, formato: 'retrato' as Formato },
    { nome: 'Facebook', icon: FacebookIcon, href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, formato: 'retrato' as Formato },
    { nome: 'X (Twitter)', icon: XIcon, href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, formato: 'paisagem' as Formato },
    { nome: 'LinkedIn', icon: LinkedInIcon, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, formato: 'paisagem' as Formato },
    { nome: 'Telegram', icon: TelegramIcon, href: `https://t.me/share/url?url=${u}&text=${t}`, formato: 'retrato' as Formato },
  ];
}

/**
 * Compartilhar com imagem: gera no próprio aparelho um cartão (PNG) da página, com o link e um QR
 * code dela, no formato de cada rede. No celular, a imagem vai pela folha de compartilhamento do
 * sistema (a pessoa escolhe a rede); no computador, a imagem é baixada, o link copiado e a rede
 * escolhida aberta, para anexar a imagem. No app, compartilha o link (o plugin nativo não envia arquivos).
 */
export function DialogoCompartilhar({ aberto, fechar: aoFechar, montar, texto, url }: { aberto: boolean; fechar: () => void; montar: MontarCartao; texto?: string; url?: string }) {
  const notify = useNotify();
  const [formato, setFormato] = useState<Formato>('retrato');
  const [dados, setDados] = useState<CartaoDados | null>(null);
  const [geradas, setGeradas] = useState<Partial<Record<Formato, Gerada | 'erro'>>>({});
  const [enviando, setEnviando] = useState(false);
  const atual = geradas[formato];

  useEffect(() => {
    if (!aberto || atual) return;
    let cancelado = false;
    Promise.resolve(dados ?? montar())
      .then(async (d) => {
        const { gerarCartao } = await import('./desenho');
        const blob = await gerarCartao(d, formato);
        const base = d.pessoas.length === 1 ? d.pessoas[0].nome : d.titulo;
        const arquivo = new File([blob], nomeArquivo(formato === 'retrato' ? base : `${base} ${formato}`), { type: 'image/png' });
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

  // Ao fechar: libera as imagens e esquece os dados (na próxima vez, a página pode ter mudado).
  const fechar = () => {
    for (const x of Object.values(geradas)) if (x && x !== 'erro') URL.revokeObjectURL(x.src);
    setGeradas({});
    setDados(null);
    aoFechar();
  };

  const pronta = atual && atual !== 'erro' ? atual : null;
  const nativo = isNativeApp;
  const compartilhaArquivo = pronta ? podeCompartilharArquivo(pronta.arquivo) : false;
  const link = dados?.url ?? url ?? '';
  const legenda = texto ?? (dados ? textoPadrao(dados) : '');

  const enviar = async () => {
    if (!nativo && !pronta) return;
    setEnviando(true);
    const d = dados ?? (await montar());
    const r = await compartilharImagem(pronta?.arquivo ?? null, { titulo: d.titulo, texto: texto ?? textoPadrao(d), url: d.url });
    setEnviando(false);
    if (r === 'cancelado') return;
    if (r !== 'falhou') registrar(nativo ? 'app' : 'folha do sistema');
    if (r === 'falhou') return notify('Não foi possível compartilhar agora.', 'error');
    if (r === 'baixado-e-copiado') notify('Imagem baixada e link da página copiado.');
    else if (r === 'baixado') notify('Imagem baixada.');
    else if (r === 'link-copiado') notify('Link copiado.');
    fechar();
  };

  /** Compartilhamento contado na medição (só o meio e o formato, nunca quem compartilhou). */
  const registrar = (meio: string) => evento('share', { method: meio, content_type: formato, item_id: new URL(link || location.href, location.href).pathname });

  /** Computador: abre a rede (antes de tudo, para o navegador não bloquear a janela), baixa a imagem e copia o link. */
  const abrirRede = async (rede: ReturnType<typeof redes>[number]) => {
    if (!pronta) return;
    registrar(rede.nome);
    if (rede.href) window.open(rede.href, '_blank', 'noopener,noreferrer');
    baixarArquivo(pronta.arquivo);
    const copiou = await copyText(link);
    if (!rede.href) notify(copiou ? 'Imagem baixada e link copiado: publique a imagem pelo app do Instagram (o QR code leva à página).' : 'Imagem baixada: publique a imagem pelo app do Instagram (o QR code leva à página).');
    else notify(copiou ? `Imagem baixada e link copiado: anexe a imagem na publicação do ${rede.nome}.` : `Imagem baixada: anexe a imagem na publicação do ${rede.nome}.`);
  };

  const { w, h } = TAM[formato];
  const info = FORMATOS.find((x) => x.f === formato)!;

  return (
    <Dialog open={aberto} onClose={fechar} fullWidth maxWidth="sm" aria-labelledby="titulo-compartilhar">
      <DialogTitle id="titulo-compartilhar">Compartilhar</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
          <ToggleButtonGroup exclusive size="small" value={formato} onChange={(_, v: Formato | null) => v && setFormato(v)} aria-label="Formato da imagem" sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {FORMATOS.map((x) => (
              <ToggleButton key={x.f} value={x.f} sx={{ px: 1.5 }}>
                {x.rotulo}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', mt: -0.5 }}>
            {info.redes}
          </Typography>
          <Box sx={{ width: '100%', display: 'grid', placeItems: 'center' }}>
            {pronta ? (
              <Box
                component="img"
                src={pronta.src}
                alt="Prévia da imagem desta página, com o link e o QR code"
                sx={{ display: 'block', maxWidth: '100%', maxHeight: '52vh', aspectRatio: `${w} / ${h}`, borderRadius: 2, boxShadow: 3 }}
              />
            ) : atual === 'erro' ? (
              <Alert severity="error" sx={{ width: '100%' }}>
                Não foi possível gerar a imagem neste aparelho. O link continua disponível abaixo.
              </Alert>
            ) : (
              <Skeleton variant="rounded" aria-label="Gerando a imagem" sx={{ width: `min(100%, calc(52vh * ${w / h}))`, height: 'auto', aspectRatio: `${w} / ${h}` }} />
            )}
          </Box>

          {!nativo && !compartilhaArquivo && (
            <Box sx={{ width: '100%' }}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'center', mb: 0.5 }}>
                Baixar a imagem e abrir:
              </Typography>
              <Stack direction="row" useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                {redes(link, legenda).map((r) => (
                  <Tooltip key={r.nome} title={r.formato !== formato ? `${r.nome} (dica: formato ${FORMATOS.find((x) => x.f === r.formato)?.rotulo})` : r.nome}>
                    <span>
                      <IconButton aria-label={`Baixar a imagem e abrir o ${r.nome}`} disabled={!pronta} onClick={() => void abrirRede(r)} sx={{ border: 1, borderColor: 'divider' }}>
                        <r.icon />
                      </IconButton>
                    </span>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            A imagem é gerada no seu aparelho, só com os dados oficiais desta página, a fonte, o link e um QR code para conferir.
          </Typography>
          {nativo && (
            <Alert severity="info" sx={{ width: '100%' }}>
              No aplicativo, o compartilhamento envia o link desta página, que abre com a prévia própria.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={fechar}>Fechar</Button>
        <Button startIcon={<LinkRounded />} disabled={!link} onClick={async () => (registrar('copiar link'), notify((await copyText(link)) ? 'Link desta página copiado.' : 'Não foi possível copiar o link.'))}>
          Copiar link
        </Button>
        {!nativo && (
          <Button startIcon={<DownloadRounded />} disabled={!pronta} onClick={() => pronta && (registrar('baixar'), baixarArquivo(pronta.arquivo), notify('Imagem baixada.'))}>
            Baixar
          </Button>
        )}
        {(nativo || compartilhaArquivo) && (
          <Button variant="contained" startIcon={<ShareRounded />} disabled={(!nativo && !pronta) || enviando} onClick={() => void enviar()}>
            {nativo ? 'Compartilhar link' : 'Compartilhar imagem'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
