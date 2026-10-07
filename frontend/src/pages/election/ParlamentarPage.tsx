import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { Link as RouterLink, useParams } from 'react-router';
import { FeedNoticias } from '@/components/noticias/FeedNoticias';
import { BotaoSeguir } from '@/components/avisos/BotaoSeguir';
import { BarList, ColumnChart, StatTile } from '@/components/charts/charts';
import { CandidateCard } from '@/components/election/CandidateCard';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { useDesfechos } from '@/components/resultados/hooks';
import { cargoDaBusca } from '@/data/apuracao';
import { SourceNote } from '@/components/election/SourceNote';
import { AvisosAlerts } from '@/components/gastos/AvisosAlerts';
import {
  ANO_PADRAO,
  CASA_NOME,
  isLacuna,
  isPassagem,
  mesCurto,
  mesesTexto,
  mesLongo,
  percentSigned,
} from '@/components/gastos/gastos';
import { data, DataError } from '@/data/api';
import { money, moneyCompact, NAO_INFORMADO, nomeProprio, number } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';

function ParlamentarSkeleton() {
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2}>
        <Skeleton variant="rounded" width={112} height={150} />
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Skeleton width="60%" height={40} />
          <Skeleton width="40%" />
          <Skeleton width="30%" />
        </Stack>
      </Stack>
      <Grid container spacing={2}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Grid key={i} size={{ xs: 6, sm: 4, lg: 2 }}>
            <Skeleton variant="rounded" height={104} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={240} />
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

function NotFound() {
  return (
    <Card variant="outlined" sx={{ maxWidth: 560, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Typography variant="h5" component="h1" gutterBottom>
          Parlamentar não encontrado
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Não há dados de cota parlamentar para este endereço. Ele pode ter sido digitado errado, ou a pessoa não exerceu mandato na legislatura
          atual.
        </Typography>
        <Button component={RouterLink} to="/gastos" variant="tonal" startIcon={<ArrowBackRounded />}>
          Ver todos os parlamentares
        </Button>
      </CardContent>
    </Card>
  );
}

export function ParlamentarPage() {
  const { id = '' } = useParams();
  const { data: d, error, loading, reload } = useAsync(() => data.parlamentar(id), [id]);
  const [anoTab, setAnoTab] = useState<number | null>(null);
  const desfechos = useDesfechos(d?.candidato ? cargoDaBusca(d.candidato.cargo) : null, d?.candidato?.uf ?? null);

  const anos = useMemo(() => {
    if (!d) return [];
    return [...new Set([...d.por_ano.map((a) => a.ano), ...d.mensal.map((m) => m.ano), ...d.por_categoria.map((c) => c.ano)])].sort((a, b) => a - b);
  }, [d]);

  const porAno = useMemo(() => {
    const out = new Map<number, { valor: number; meses: number; mediaMensal: number | null; passagens: number }>();
    for (const a of anos) out.set(a, { valor: 0, meses: 0, mediaMensal: null, passagens: 0 });
    // Official per-year totals from the API; the monthly series is only a fallback.
    const oficiais = new Set((d?.por_ano ?? []).map((a) => a.ano));
    for (const a of d?.por_ano ?? []) Object.assign(out.get(a.ano)!, { valor: a.valor, meses: a.meses, mediaMensal: a.media_mensal });
    for (const m of d?.mensal ?? []) {
      if (oficiais.has(m.ano)) continue;
      const cur = out.get(m.ano)!;
      cur.valor += m.valor;
      cur.meses += 1;
      cur.mediaMensal = cur.valor / cur.meses;
    }
    for (const c of d?.por_categoria ?? []) if (isPassagem(c.categoria)) out.get(c.ano)!.passagens += c.valor;
    return out;
  }, [d, anos]);

  /** Every month from the first to the last record; months without records appear as zero, labeled. */
  const serieMensal = useMemo(() => {
    const mensal = [...(d?.mensal ?? [])].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
    if (!mensal.length) return [];
    const map = new Map(mensal.map((m) => [m.ano * 12 + m.mes - 1, m.valor]));
    const first = mensal[0].ano * 12 + mensal[0].mes - 1;
    const last = mensal[mensal.length - 1].ano * 12 + mensal[mensal.length - 1].mes - 1;
    const out: { label: string; value: number; tooltip: string }[] = [];
    for (let k = first; k <= last; k++) {
      const ano = Math.floor(k / 12);
      const mes = (k % 12) + 1;
      const v = map.get(k);
      out.push({
        label: mesCurto(ano, mes),
        value: Math.max(0, v ?? 0),
        tooltip: v == null ? `${mesLongo(ano, mes)}: sem lançamentos` : `${mesLongo(ano, mes)}: ${money(v)}`,
      });
    }
    return out;
  }, [d]);

  if (loading) return <ParlamentarSkeleton />;
  if (error instanceof DataError && error.status === 404) return <NotFound />;
  if (error != null || !d) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={reload}>
            Tentar de novo
          </Button>
        }
      >
        Não foi possível carregar os dados deste parlamentar agora. Tente novamente em instantes.
      </Alert>
    );
  }

  const anoSel = anoTab != null && anos.includes(anoTab) ? anoTab : anos.includes(Number(ANO_PADRAO)) ? Number(ANO_PADRAO) : (anos[anos.length - 1] ?? null);
  const fontesGastos = d.fontes.filter((f) => f.endsWith('ceap') || f.endsWith('ceaps'));
  const fontesCadastro = d.fontes.filter((f) => !fontesGastos.includes(f));
  const lacunaAnos = new Set((d.avisos ?? []).filter((a) => isLacuna(a) && (a.casa === d.casa || a.casa === 'ambas')).flatMap((a) => a.anos));

  const categoriasAno = d.por_categoria
    .filter((c) => c.ano === anoSel)
    .sort((a, b) => b.valor - a.valor)
    .map((c) => ({ label: c.categoria, value: c.valor, hint: `${c.categoria}: ${money(c.valor)} · ${number(c.n)} documento(s)` }));
  const fornecedoresAno = d.fornecedores.filter((f) => f.ano === anoSel).sort((a, b) => b.valor - a.valor);
  const resumoAno = anoSel != null ? porAno.get(anoSel) : undefined;

  const comparacoes = [...d.media_uf_por_ano].sort((a, b) => a.ano - b.ano);
  const maxComparacao = Math.max(0, ...comparacoes.flatMap((m) => [m.media_mensal, porAno.get(m.ano)?.mediaMensal ?? 0]));
  const nomeCurto = d.nome;

  return (
    <Stack spacing={3}>
      <Box>
        <Button component={RouterLink} to="/gastos" size="small" startIcon={<ArrowBackRounded />} sx={{ mb: 1, ml: -1 }}>
          Gastos de mandato
        </Button>
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          <Grid size={{ xs: 12, md: d.candidato ? 7 : 12 }}>
            <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
              <CandidatePhoto src={d.foto_url} alt={`Foto oficial de ${d.nome}`} sx={{ width: { xs: 88, sm: 120 } }} />
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                  {d.casa === 'camara' ? 'Deputado(a) federal' : 'Senador(a)'} · cota parlamentar
                </Typography>
                <Typography variant="h4" component="h1" sx={{ lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                  {d.nome}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Nome civil: {d.nome_civil ? nomeProprio(d.nome_civil) : NAO_INFORMADO}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {d.partido ?? NAO_INFORMADO} · {d.uf ?? NAO_INFORMADO}
                </Typography>
                <Box>
                  <BotaoSeguir alvo={`parlamentar:${id}`} nome={d.nome} />
                </Box>
                <Stack direction="row" useFlexGap spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center', pt: 0.5 }}>
                  <Chip size="small" variant="outlined" label={CASA_NOME[d.casa]} />
                  <Chip size="small" variant="outlined" label={d.em_exercicio ? 'Em exercício' : 'Fora de exercício'} />
                  {d.pagina_oficial && (
                    <Button
                      size="small"
                      variant="tonal"
                      href={d.pagina_oficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNewRounded sx={{ fontSize: 14 }} />}
                    >
                      Página oficial
                    </Button>
                  )}
                </Stack>
                <SourceNote keys={fontesCadastro} />
              </Stack>
            </Stack>
          </Grid>
          {d.candidato && (
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
                Candidatura em 2026
              </Typography>
              <Box>
                <CandidateCard c={d.candidato} desfecho={desfechos.get(d.candidato.sq)} />
              </Box>
              <SourceNote keys={['tse_candidatos']} sx={{ mt: 1 }} />
            </Grid>
          )}
        </Grid>
      </Box>

      <AvisosAlerts avisos={d.avisos} casa={d.casa} anos={anos} />

      <Box>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          Totais da cota parlamentar
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
            <StatTile label="Total na legislatura" value={moneyCompact(d.total)} foot={`${money(d.total)} · desde fev/2023`} />
          </Grid>
          {anos.map((a) => {
            const r = porAno.get(a)!;
            return (
              <Grid key={a} size={{ xs: 6, sm: 4, lg: 2 }}>
                <StatTile label={`Total em ${a}`} value={moneyCompact(r.valor)} foot={`${mesesTexto(r.meses)} com lançamento${r.mediaMensal != null ? ` · ${moneyCompact(r.mediaMensal)}/mês` : ''}${lacunaAnos.has(a) ? ' · lacuna na fonte' : ''}`} />
              </Grid>
            );
          })}
          <Grid size={{ xs: 12, sm: 4, lg: 2 }}>
            {d.limite_mensal ? (
              <StatTile
                label={`Teto mensal · ${d.uf ?? ''}`}
                value={moneyCompact(d.limite_mensal.valor_mensal)}
                foot={
                  <>
                    {money(d.limite_mensal.valor_mensal)}
                    {d.limite_mensal.vigencia ? ` · ${d.limite_mensal.vigencia}` : ''} ·{' '}
                    <Link href={d.limite_mensal.fonte_url} target="_blank" rel="noopener noreferrer">
                      fonte <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
                    </Link>
                  </>
                }
              />
            ) : (
              <StatTile
                label="Teto mensal"
                value={<Typography variant="h6" component="span">{d.casa === 'senado' ? 'Não publicado' : NAO_INFORMADO}</Typography>}
                foot={d.casa === 'senado' ? 'O Senado não publica o teto por UF em formato aberto.' : undefined}
              />
            )}
          </Grid>
        </Grid>
        <SourceNote keys={fontesGastos} sx={{ mt: 1 }} />
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2">
            Valores por mês
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Soma dos lançamentos de cada mês, pela data do documento. Meses sem lançamento aparecem vazios. O saldo não usado da cota pode ser
            acumulado dentro do ano, por isso um mês isolado pode superar o teto mensal.
          </Typography>
          <ColumnChart data={serieMensal} format={moneyCompact} height={200} />
          <SourceNote keys={fontesGastos} sx={{ mt: 2 }} />
        </CardContent>
      </Card>

      {anoSel != null && (
        <Card variant="outlined">
          <Tabs
            value={anoSel}
            onChange={(_, v: number) => setAnoTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Ano"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
          >
            {anos.map((a) => (
              <Tab key={a} value={a} label={String(a)} />
            ))}
          </Tabs>
          <CardContent>
            <Stack spacing={2}>
              {resumoAno && (
                <Typography variant="body2">
                  Total em {anoSel}: <strong>{money(resumoAno.valor)}</strong> · {mesesTexto(resumoAno.meses)} com lançamento · sem as categorias de
                  passagens: {money(resumoAno.valor - resumoAno.passagens)}
                </Typography>
              )}
              {lacunaAnos.has(anoSel) && (
                <Alert severity="warning">Ano afetado pela lacuna na fonte oficial descrita no início da página (passagens aéreas ausentes).</Alert>
              )}
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5, fontWeight: 600 }}>
                    Por categoria de despesa
                  </Typography>
                  <BarList data={categoriasAno} format={moneyCompact} labelWidth={{ xs: '46%', sm: '44%' }} emptyText="Sem lançamentos neste ano." />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle1" component="h3" sx={{ mb: 1, fontWeight: 600 }}>
                    Maiores fornecedores
                  </Typography>
                  {fornecedoresAno.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Sem fornecedores registrados neste ano.
                    </Typography>
                  ) : (
                    <TableContainer sx={{ maxHeight: 420 }}>
                      <Table size="small" stickyHeader aria-label={`Maiores fornecedores em ${anoSel}`}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Fornecedor</TableCell>
                            <TableCell align="right">Valor</TableCell>
                            <TableCell align="right">Docs.</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fornecedoresAno.map((f) => (
                            <TableRow key={`${f.fornecedor}-${f.cnpj_cpf ?? ''}`}>
                              <TableCell sx={{ maxWidth: 260 }}>
                                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                                  {f.fornecedor}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                  {f.cnpj_cpf ?? 'CNPJ/CPF não informado'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                                {money(f.valor)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {number(f.n_documentos)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                    CNPJ/CPF exatamente como publicado pela fonte oficial. Lista limitada aos maiores fornecedores do ano.
                  </Typography>
                </Grid>
              </Grid>
              <SourceNote keys={fontesGastos} />
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2">
            Comparação com colegas
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Comparação por mês com lançamento: a média por mês deste parlamentar (total do ano ÷ meses com lançamento) e a média desse mesmo
            indicador entre os parlamentares da {CASA_NOME[d.casa]} por {d.uf ?? 'sua UF'} com lançamentos no ano (o teto da cota varia por UF).
            Gastar mais ou menos não indica, por si só, irregularidade.
          </Typography>
          {comparacoes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {NAO_INFORMADO}
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {comparacoes.map((m) => {
                const proprio = porAno.get(m.ano);
                const diff = proprio?.mediaMensal != null && m.media_mensal > 0 ? proprio.mediaMensal / m.media_mensal - 1 : null;
                const mediaLabel = `Média mensal dos colegas (${m.n})`;
                return (
                  <Grid key={m.ano} size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1, gap: 1 }}>
                      <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
                        {m.ano}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                        {percentSigned(diff) ? `${percentSigned(diff)} em relação à média mensal` : NAO_INFORMADO}
                      </Typography>
                    </Stack>
                    <BarList
                      max={maxComparacao}
                      format={moneyCompact}
                      labelWidth={{ xs: '46%', sm: '40%' }}
                      data={[
                        {
                          label: `${nomeCurto} (média mensal)`,
                          value: proprio?.mediaMensal ?? 0,
                          display: proprio?.mediaMensal != null ? moneyCompact(proprio.mediaMensal) : NAO_INFORMADO,
                          hint:
                            proprio?.mediaMensal != null
                              ? `${nomeCurto} em ${m.ano}: ${money(proprio.mediaMensal)} por mês (${money(proprio.valor)} em ${mesesTexto(proprio.meses)} com lançamento)`
                              : `${nomeCurto}: sem lançamentos em ${m.ano}`,
                        },
                        {
                          label: mediaLabel,
                          value: m.media_mensal,
                          hint: `Média das médias mensais de ${m.n} parlamentares da ${CASA_NOME[d.casa]} por ${d.uf ?? ''} em ${m.ano} (incluindo este): ${money(m.media_mensal)}`,
                        },
                      ]}
                    />
                    {lacunaAnos.has(m.ano) && (
                      <Typography variant="caption" color="text.secondary">
                        Ano afetado pela lacuna de passagens aéreas na fonte (vale para todos os deputados).
                      </Typography>
                    )}
                  </Grid>
                );
              })}
            </Grid>
          )}
          <SourceNote keys={fontesGastos} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
      <FeedNoticias tipo="parlamentar" id={id} nome={d.nome} />
    </Stack>
  );
}
