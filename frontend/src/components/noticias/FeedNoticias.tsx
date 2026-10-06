import { Box, Card, CardContent, Link, Skeleton, Stack, Typography } from '@mui/material';
import NewspaperRounded from '@mui/icons-material/NewspaperRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { data } from '@/data/api';
import { useAsync } from '@/hooks/useAsync';

const dataBr = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

/**
 * As 5 notícias mais recentes na imprensa sobre um parlamentar ou partido (coleta diária, ordem
 * por data). Sempre com o veículo e a data; não são dados oficiais, e o aviso diz isso.
 */
export function FeedNoticias({ tipo, id, nome }: { tipo: 'parlamentar' | 'partido' | 'ministro'; id: string; nome: string }) {
  const r = useAsync(() => data.noticias(tipo, id).catch(() => null), [tipo, id]);
  const itens = r.data?.itens ?? [];
  return (
    <Card sx={{ mt: 4, borderRadius: 4 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <NewspaperRounded color="primary" />
          <Typography variant="h5" component="h2">
            Notícias recentes
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0, mb: 2 }}>
          As 5 mais recentes dos últimos 30 dias que citam {nome}, por ordem de data. Seleção automática feita por busca pública de notícias (Google Notícias ou Bing Notícias) e atualizada todos os dias.
          Não são dados oficiais: o Tá na Urna não escolhe, edita nem endossa as notícias; cada uma é de responsabilidade do veículo indicado.
        </Typography>
        {r.loading && <Skeleton variant="rounded" height={160} />}
        {!r.loading && itens.length === 0 && (
          <Typography color="text.secondary">{r.data ? 'Nenhuma notícia encontrada nos últimos 30 dias.' : 'As notícias aparecem aqui depois da próxima coleta diária.'}</Typography>
        )}
        <Stack component="ol" spacing={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {itens.map((n) => (
            <Box component="li" key={n.link} sx={{ pb: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0, pb: 0 } }}>
              <Link href={n.link} target="_blank" rel="noopener noreferrer nofollow" underline="hover" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {n.titulo} <OpenInNewRounded sx={{ fontSize: 14, verticalAlign: 'middle', color: 'text.secondary' }} />
              </Link>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                Fonte:{' '}
                {n.fonte_url ? (
                  <Link href={n.fonte_url} target="_blank" rel="noopener noreferrer nofollow" color="inherit">
                    {n.fonte ?? n.fonte_url}
                  </Link>
                ) : (
                  (n.fonte ?? 'não informada')
                )}{' '}
                · {n.so_dia ? new Date(n.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : dataBr(n.data)}
              </Typography>
            </Box>
          ))}
        </Stack>
        {r.data && (
          <Typography variant="caption" color="text.disabled" component="p" sx={{ mt: 2, mb: 0 }}>
            Última coleta: {dataBr(r.data.atualizado_em)} · {r.data.fonte}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
