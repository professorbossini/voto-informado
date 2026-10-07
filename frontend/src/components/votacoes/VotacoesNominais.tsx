import { useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Link, Skeleton, Stack, Typography } from '@mui/material';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { StatTile } from '@/components/charts/charts';
import { data } from '@/data/api';
import { dateTime, number, percent } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import type { VotacaoNominal } from '@/data/types';
import { dataCurta, rotuloVoto } from './votacoes';

const PLENARIO_DE = { camara: 'da Câmara dos Deputados', senado: 'do Senado Federal' } as const;
const PASSO = 20;

function Fonte({ nome, url, atualizado }: { nome: string; url: string; atualizado?: string }) {
  return (
    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2, mb: 0 }}>
      Fonte oficial:{' '}
      <Link href={url} target="_blank" rel="noopener noreferrer" color="inherit">
        {nome} <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
      </Link>
      {atualizado ? ` · dados atualizados em ${dateTime(atualizado)}` : ''}
    </Typography>
  );
}

function Item({ v, voto, legenda }: { v: VotacaoNominal | undefined; voto: string; legenda: Record<string, string> }) {
  if (!v) return null;
  return (
    <Box component="li" sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0, pb: 0 } }}>
      <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {dataCurta(v.data)}
        </Typography>
        {v.proposicao &&
          (v.url ? (
            <Link href={v.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {v.proposicao} <OpenInNewRounded sx={{ fontSize: 13, verticalAlign: 'middle', color: 'text.secondary' }} />
            </Link>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {v.proposicao}
            </Typography>
          ))}
        {v.secreta && <Chip size="small" variant="outlined" label="Votação secreta" />}
      </Stack>
      {v.ementa && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {v.ementa}
        </Typography>
      )}
      {v.descricao && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25, mb: 0 }}>
          {v.descricao}
        </Typography>
      )}
      <Stack direction="row" useFlexGap spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.75 }}>
        <Typography variant="body2" component="span">
          Registro:
        </Typography>
        <Chip size="small" label={<span translate="no">{rotuloVoto(voto, legenda)}</span>} sx={{ fontWeight: 600 }} />
        {v.resultado && (
          <Typography variant="body2" color="text.secondary" component="span">
            Resultado: {v.resultado}
          </Typography>
        )}
        {v.placar && !(v.descricao ?? '').includes('Sim:') && (
          <Typography variant="caption" color="text.secondary" component="span">
            ({v.placar})
          </Typography>
        )}
        {v.url_sessao && (
          <Link href={v.url_sessao} target="_blank" rel="noopener noreferrer" variant="caption">
            Sessão no site oficial <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
          </Link>
        )}
      </Stack>
    </Box>
  );
}

/**
 * Votações nominais do Plenário (Câmara ou Senado): participação no período em que o parlamentar
 * estava no cargo, contagem por tipo de registro (como publicado) e a lista das mais recentes, cada
 * uma com link oficial. Sem adjetivos, sem comparação com colegas.
 */
export function VotacoesNominais({ id, casa, nome }: { id: string; casa: 'camara' | 'senado'; nome: string }) {
  const r = useAsync(
    () =>
      Promise.all([data.votacoes(id), data.votacoesCatalogo(casa)]).then(
        ([p, c]) => ({ p, c }),
        () => null,
      ),
    [id, casa],
  );
  const pl = useAsync(() => data.plenario().catch(() => null), []);
  const preside = pl.data?.[casa]?.presidente?.id === id;
  const [filtro, setFiltro] = useState<string | null>(null);
  const [limite, setLimite] = useState(10);
  const p = r.data?.p;
  const c = r.data?.c;
  const itens = useMemo(() => (p?.itens ?? []).filter((i) => filtro == null || i.voto === filtro), [p, filtro]);

  return (
    <Card sx={{ mt: 4, borderRadius: 4 }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <HowToVoteRounded color="primary" />
          <Typography variant="h5" component="h2">
            Votações nominais no Plenário
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0, mb: 2 }}>
          Como {nome} votou nas votações nominais (com registro individual de cada voto) do Plenário {PLENARIO_DE[casa]} desde o início da legislatura atual
          {p ? ` (${dataCurta(p.inicio)})` : ''}, exatamente como publicado pela própria Casa. Dados oficiais, atualizados todos os dias.
        </Typography>

        {r.loading && <Skeleton variant="rounded" height={220} />}
        {!r.loading && (!p || !c) && (
          <Typography color="text.secondary">
            As votações aparecem aqui para deputados federais e senadores em exercício, depois da próxima coleta diária nos dados oficiais da Câmara e do
            Senado.
          </Typography>
        )}

        {p && c && (
          <>
            {preside && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {nome} preside {casa === 'camara' ? 'a Câmara dos Deputados' : 'o Senado Federal'}. Pelo Regimento da Casa, quem preside a sessão em regra
                não vota nas votações abertas (só para desempatar ou nas secretas), e nem toda sessão conduzida aparece registrada nesta base: por isso a
                participação calculada aqui pode ficar abaixo da presença real em Plenário.
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                {p.resumo.total != null ? (
                  <StatTile
                    label="Participação"
                    value={p.resumo.total ? percent(p.resumo.percentual) : '—'}
                    foot={
                      p.resumo.total
                        ? `Votou ou presidia a sessão em ${number(p.resumo.participou)} de ${number(p.resumo.total)} votações nominais realizadas enquanto estava no cargo`
                        : 'Nenhuma votação nominal no Plenário desde que assumiu o cargo nesta legislatura.'
                    }
                  />
                ) : (
                  <StatTile
                    label="Votações com registro"
                    value={number(p.resumo.participou)}
                    foot="Sem o histórico oficial de exercício, não há total de votações para comparar."
                  />
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 8 }}>
                <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Registros por tipo, como publicados (toque para filtrar a lista)
                  </Typography>
                  <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap' }}>
                    <Chip
                      label={`Todas · ${number(p.resumo.total ?? p.itens.length)}`}
                      variant={filtro == null ? 'filled' : 'outlined'}
                      color={filtro == null ? 'primary' : 'default'}
                      onClick={() => {
                        setFiltro(null);
                        setLimite(10);
                      }}
                    />
                    {Object.entries(p.resumo.votos).map(([voto, n]) => (
                      <Chip
                        key={voto}
                        label={
                          <span>
                            <span translate="no">{rotuloVoto(voto, p.legenda)}</span> · {number(n)}
                          </span>
                        }
                        variant={filtro === voto ? 'filled' : 'outlined'}
                        color={filtro === voto ? 'primary' : 'default'}
                        onClick={() => {
                          setFiltro(filtro === voto ? null : voto);
                          setLimite(10);
                        }}
                      />
                    ))}
                  </Stack>
                  {p.por_ano.length > 0 && (
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, mb: 0 }}>
                      Por ano:{' '}
                      {p.por_ano
                        .map((a) => (a.total != null ? `${a.ano}: ${number(a.participou)} de ${number(a.total)}` : `${a.ano}: ${number(a.participou)}`))
                        .join(' · ')}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            {p.resumo.total != null && p.itens.length < p.resumo.total && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
                A lista mostra as {number(p.itens.length)} votações mais recentes; a contagem acima considera todas as {number(p.resumo.total)}.
                {filtro != null && ` Com o registro "${rotuloVoto(filtro, p.legenda)}", ${number(itens.length)} estão na lista.`}
              </Typography>
            )}
            {itens.length === 0 ? (
              <Typography color="text.secondary">Nenhuma votação nominal no período.</Typography>
            ) : (
              <Stack component="ol" spacing={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {itens.slice(0, limite).map((i) => (
                  <Item key={i.id} v={c.votacoes[i.id]} voto={i.voto} legenda={p.legenda} />
                ))}
              </Stack>
            )}
            {itens.length > limite && (
              <Button variant="tonal" size="small" sx={{ mt: 2 }} onClick={() => setLimite((l) => l + PASSO)}>
                Mostrar mais ({number(itens.length - limite)} restantes)
              </Button>
            )}

            <Typography variant="subtitle2" component="h3" sx={{ mt: 3, mb: 0.5 }}>
              Como contamos
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
              {c.criterio} &quot;Participação&quot; = votou (inclusive votação secreta) ou presidia a sessão.
            </Typography>
            {p.exercicio && p.exercicio.length > 0 && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5, mb: 0 }}>
                Períodos em exercício considerados (histórico oficial da Câmara):{' '}
                {p.exercicio.map(([ini, fim]) => `${dataCurta(ini < p.inicio ? p.inicio : ini)} a ${fim ? dataCurta(fim) : 'hoje'}`).join('; ')}.
              </Typography>
            )}
            <Fonte nome={c.fonte.nome} url={c.fonte.pagina} atualizado={p.atualizado_em} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
