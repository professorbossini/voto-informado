import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { BarList } from '@/components/charts/charts';
import { useAsync } from '@/hooks/useAsync';
import { eua, ou404 } from '../api';
import { LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, CartaoMembro, Carregando, FonteNota } from '../componentes/comuns';
import { dolar, dolarCompacto, inteiro, nomeEstado, partidoResultado, pct } from '../formato';

function Bloco({ titulo, children, fonte, nota }: { titulo: string; children: React.ReactNode; fonte: string[]; nota?: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {titulo}
        </Typography>
        {children}
        <FonteNota chaves={fonte} nota={nota} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

export function EstadoEuaPage() {
  const { uf: ufParam = '' } = useParams();
  const uf = ufParam.toUpperCase();
  const cong = useAsync(() => eua.congresso(), []);
  const pres = useAsync(() => ou404(eua.presidente()), []);
  const sen = useAsync(() => ou404(eua.senadoEleicoes()), []);
  const fed = useAsync(() => ou404(eua.gastoFederal()), []);
  const esc = useAsync(() => ou404(eua.escritorios()), []);
  const cal = useAsync(() => ou404(eua.calendario()), []);
  const res = useAsync(() => ou404(eua.resumoCandidatos()), []);

  const senadores = (cong.data?.senado.membros ?? []).filter((m) => m.uf === uf).sort((a, b) => (a.sobrenome ?? '').localeCompare(b.sobrenome ?? '', 'pt-BR'));
  const deputados = (cong.data?.camara.membros ?? []).filter((m) => m.uf === uf).sort((a, b) => (a.distrito ?? 0) - (b.distrito ?? 0));
  const vagas = (cong.data?.camara.vagas ?? []).filter((v) => v.uf === uf);
  const escritorio = esc.data?.escritorios[uf];
  const disputaSenado = (cal.data?.em_disputa.senado_estados ?? []).some(([u]) => u === uf);
  const r = res.data?.estados[uf];
  const fedEstado = fed.data?.estados[uf];

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/eua">
          Estados Unidos
        </Link>
        <Typography color="text.primary">{nomeEstado(uf)}</Typography>
      </Breadcrumbs>
      <PageHeader title={nomeEstado(uf)} subtitle="Representação no Congresso, candidaturas, resultados anteriores e dinheiro federal no estado. Dados oficiais." />
      <AvisoInformativo />
      {!cong.data ? (
        <Carregando />
      ) : (
        <Stack spacing={3}>
          {senadores.length > 0 && (
            <Bloco titulo="Senado" fonte={['eua-legisladores', 'eua-bioguide']}>
              <Grid container spacing={1.5}>
                {senadores.map((m) => (
                  <Grid key={m.id} size={{ xs: 12, sm: 6 }}>
                    <CartaoMembro
                      m={m}
                      comEstado={false}
                      extra={
                        <Typography variant="caption" color="text.secondary" component="p">
                          Cadeira em disputa em {m.proxima_eleicao ?? '–'}
                        </Typography>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </Bloco>
          )}
          <Bloco titulo={`Câmara (${deputados.length + vagas.length} ${deputados.length + vagas.length === 1 ? 'cadeira' : 'cadeiras'})`} fonte={['eua-clerk-membros', 'eua-bioguide']}>
            <Grid container spacing={1.5}>
              {deputados.map((m) => (
                <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <CartaoMembro m={m} comEstado={false} />
                </Grid>
              ))}
            </Grid>
            {vagas.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                Vaga: {vagas.map((v) => `${v.distrito}º distrito`).join(', ')}.
              </Typography>
            )}
          </Bloco>

          <Bloco titulo={`Eleição de ${cal.data?.ano ?? ''}`} fonte={['eua-fec-candidatos', 'eua-usagov-escritorios']}>
            <Typography variant="body2">
              Em disputa no estado: {deputados.filter((d) => !d.delegado).length + vagas.length > 0 ? `${deputados.filter((d) => !d.delegado).length + vagas.length} cadeira(s) da Câmara` : deputados.length ? 'a cadeira de delegado(a) na Câmara' : 'nenhuma cadeira federal'}
              {disputaSenado ? ' e 1 cadeira do Senado' : ''}.{r ? ` ${r.senado + r.camara} candidaturas registradas na FEC (${r.com_movimentacao} com dinheiro declarado).` : ''}
            </Typography>
            <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button component={RouterLink} to={`/eua/candidatos?uf=${uf}`} variant="contained" size="small">
                Ver candidaturas
              </Button>
              {escritorio && <LinkExterno href={escritorio.url}>Órgão eleitoral oficial do estado (cédula e resultado)</LinkExterno>}
            </Stack>
          </Bloco>

          {pres.data && (
            <Bloco titulo="Como o estado votou para Presidente" fonte={['eua-medsl-presidente', 'eua-nara-colegio']}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ano</TableCell>
                      <TableCell>Candidaturas no estado (votos e %)</TableCell>
                      <TableCell align="right">Colégio Eleitoral</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...pres.data.anos].reverse().map((a) => {
                      const e = pres.data!.por_ano[String(a)];
                      const x = e.estados[uf];
                      if (!x) return null;
                      const ord = e.candidatos.map((c, i) => ({ c, v: x.votos[i] })).sort((p, q) => q.v - p.v);
                      return (
                        <TableRow key={a}>
                          <TableCell sx={{ verticalAlign: 'top' }}>{a}</TableCell>
                          <TableCell>
                            {ord.map(({ c, v }) => (
                              <Typography key={c.nome} variant="body2">
                                <span translate="no">{c.nome}</span>{' '}
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {partidoResultado(c.partido)} · {inteiro(v)} ({pct(x.total ? (100 * v) / x.total : null)})
                                </Typography>
                              </Typography>
                            ))}
                          </TableCell>
                          <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                            {e.candidatos
                              .filter((c) => c.eleitores_por_estado?.[uf])
                              .map((c) => (
                                <Typography key={c.nome} variant="caption" component="p">
                                  {c.nome.split(' ').slice(-1)[0]}: {c.eleitores_por_estado![uf]}
                                </Typography>
                              ))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Em cada ano, do mais votado para o menos votado no estado.
              </Typography>
            </Bloco>
          )}

          {sen.data && (
            <Bloco titulo="Eleições para o Senado no estado" fonte={['eua-medsl-senado']}>
              <Stack spacing={1.5}>
                {[...sen.data.anos]
                  .reverse()
                  .flatMap((a) => (sen.data!.por_ano[a] ?? []).filter((d) => d.uf === uf).map((d) => ({ a, d })))
                  .slice(0, 12)
                  .map(({ a, d }) => (
                    <Box key={`${a}-${d.especial}`}>
                      <Typography variant="subtitle2">
                        {a}
                        {d.especial ? ' (eleição especial)' : ''}
                      </Typography>
                      {d.candidatos.map((c) => (
                        <Typography key={c.nome} variant="body2">
                          <span translate="no">{c.nome}</span>{' '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            {partidoResultado(c.partido)} · {inteiro(c.votos)} ({pct(c.pct)})
                          </Typography>
                        </Typography>
                      ))}
                    </Box>
                  ))}
              </Stack>
            </Bloco>
          )}

          {fedEstado && fed.data && (
            <Bloco titulo="Dinheiro federal no estado" fonte={['eua-usaspending']} nota="por ano fiscal (out–set)">
              <BarList
                data={fed.data.anos
                  .filter((a) => fedEstado.anos[a])
                  .map((a) => ({
                    label: a === fed.data!.ano_corrente ? `${a} (em andamento)` : a,
                    value: fedEstado.anos[a].valor,
                    hint: `${a}: ${dolar(fedEstado.anos[a].valor)}${fedEstado.anos[a].per_capita ? ` · ${dolar(fedEstado.anos[a].per_capita)} por habitante` : ''}`,
                  }))}
                format={dolarCompacto}
              />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Contratos, convênios, empréstimos e outros repasses do governo federal executados no estado.
              </Typography>
            </Bloco>
          )}
        </Stack>
      )}
    </>
  );
}
