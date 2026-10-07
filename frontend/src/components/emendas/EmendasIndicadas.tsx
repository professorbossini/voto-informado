import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink } from 'react-router';
import { BarList, StatTile } from '@/components/charts/charts';
import { data, DataError } from '@/data/api';
import { money, moneyCompact, nomeProprio, number } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import { FonteEmendasNota } from './FonteEmendasNota';
import { linkEmenda, rotaMunicipio, TIPO_EMENDA, textoPublicado } from './emendas';

const celulaValor = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

/** Bloco "Emendas indicadas" da página do parlamentar (Portal da Transparência/CGU). */
export function EmendasIndicadas({ id, nome }: { id: string; nome: string }) {
  const { data: d, loading, error } = useAsync(
    () =>
      data.emendasParlamentar(id).catch((e: unknown) => {
        if (e instanceof DataError && e.status === 404) return null;
        throw e;
      }),
    [id],
  );
  const [verEmendas, setVerEmendas] = useState(false);

  if (loading) return <Skeleton variant="rounded" height={240} />;
  if (error != null) return null; // falha de rede: o restante da página continua
  if (!d) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2">
            Emendas indicadas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Não encontramos emendas individuais com o nome deste parlamentar no arquivo de emendas do Portal da Transparência (CGU) desde 2019.
            Quem assumiu o mandato há pouco, ou esteve licenciado, pode não ter emendas; o nome também pode estar publicado de outra forma.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const pagoTotal = d.total.pago + d.total.rp_pago;
  const destinos = d.destinos_municipio.slice(0, 12);
  const emendas = verEmendas ? d.emendas : d.emendas.slice(0, 8);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <div>
            <Typography variant="h6" component="h2">
              Emendas indicadas
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Emendas individuais de {nome} no Orçamento da União desde {d.periodo.desde}, com o nome publicado pela CGU (
              {d.autor_cgu.join(', ')}). Empenhado é o valor reservado; pago inclui os restos a pagar pagos em anos seguintes. Emendas de bancada,
              comissão e relator não têm autor individual no arquivo e não entram aqui.
            </Typography>
          </div>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatTile label="Empenhado" value={moneyCompact(d.total.empenhado)} foot={`${money(d.total.empenhado)} · ${number(d.total.emendas)} emenda(s)`} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatTile label="Pago" value={moneyCompact(pagoTotal)} foot={`no ano: ${moneyCompact(d.total.pago)} · restos a pagar: ${moneyCompact(d.total.rp_pago)}`} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatTile label="Municípios com pagamento" value={number(d.destinos_municipio.length)} foot={`em ${number(d.destinos_uf.length)} UF(s)`} />
            </Grid>
          </Grid>

          <TableContainer>
            <Table size="small" aria-label="Emendas indicadas por ano">
              <TableHead>
                <TableRow>
                  <TableCell>Ano da emenda</TableCell>
                  <TableCell align="right">Emendas</TableCell>
                  <TableCell align="right">Empenhado</TableCell>
                  <TableCell align="right">Liquidado</TableCell>
                  <TableCell align="right">Pago no ano</TableCell>
                  <TableCell align="right">Restos a pagar pagos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...d.por_ano].reverse().map((a) => (
                  <TableRow key={a.ano}>
                    <TableCell>{a.ano}</TableCell>
                    <TableCell align="right">{number(a.emendas)}</TableCell>
                    <TableCell align="right" sx={celulaValor}>
                      {money(a.empenhado)}
                    </TableCell>
                    <TableCell align="right" sx={celulaValor}>
                      {money(a.liquidado)}
                    </TableCell>
                    <TableCell align="right" sx={celulaValor}>
                      {money(a.pago)}
                    </TableCell>
                    <TableCell align="right" sx={celulaValor}>
                      {money(a.rp_pago)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, mb: 0.5 }}>
                Para onde foi o dinheiro pago
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Município do favorecido (prefeitura, empresa ou entidade) de cada pagamento desde {d.periodo.desde}.
                {d.pagamentos.sem_municipio > 0 && ` ${money(d.pagamentos.sem_municipio)} foram pagos por meio de bancos operadores ou sem município identificado no arquivo.`}
              </Typography>
              {destinos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum pagamento a favorecido com município identificado.
                </Typography>
              ) : (
                <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {destinos.map((m) => (
                    <Stack component="li" key={`${m.uf}-${m.cd}`} direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                      <Link component={RouterLink} to={rotaMunicipio(m.uf, m.cd)}>
                        {nomeProprio(m.nome)} ({m.uf})
                      </Link>
                      <Typography variant="body2" sx={celulaValor}>
                        {money(m.valor)}
                      </Typography>
                    </Stack>
                  ))}
                  {d.destinos_municipio.length > destinos.length && (
                    <Typography component="li" variant="caption" color="text.secondary">
                      e mais {number(d.destinos_municipio.length - destinos.length)} município(s).
                    </Typography>
                  )}
                </Stack>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, mb: 1.5 }}>
                Por estado do favorecido
              </Typography>
              <BarList data={d.destinos_uf.map((u) => ({ label: u.nome, value: u.valor }))} format={moneyCompact} limit={8} emptyText="Sem pagamentos." />
            </Grid>
          </Grid>

          <div>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, mb: 1 }}>
              Emendas ({number(d.emendas.length)})
            </Typography>
            <TableContainer>
              <Table size="small" aria-label={`Emendas de ${nome}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Emenda</TableCell>
                    <TableCell>Para quê</TableCell>
                    <TableCell>Localidade</TableCell>
                    <TableCell align="right">Empenhado</TableCell>
                    <TableCell align="right">Pago</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emendas.map((e) => (
                    <TableRow key={e.codigo}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Link href={linkEmenda(d.fonte, e.codigo)} target="_blank" rel="noopener noreferrer" sx={{ fontFamily: 'monospace' }}>
                          {e.codigo} <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                        </Link>
                        <Typography variant="caption" color="text.secondary" component="div" title={TIPO_EMENDA[e.tipo]?.completo}>
                          {e.ano} · {TIPO_EMENDA[e.tipo]?.curto ?? e.tipo}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography variant="body2">{e.funcao}</Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {textoPublicado(e.acao)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{e.localidade || '—'}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={celulaValor}>
                        {money(e.empenhado)}
                      </TableCell>
                      <TableCell align="right" sx={celulaValor}>
                        {money(e.pago + e.rp_pago)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {d.emendas.length > 8 && (
              <Button size="small" onClick={() => setVerEmendas((v) => !v)} sx={{ mt: 1 }}>
                {verEmendas ? 'Mostrar menos' : `Mostrar todas (${d.emendas.length})`}
              </Button>
            )}
          </div>
          <FonteEmendasNota fonte={d.fonte} />
        </Stack>
      </CardContent>
    </Card>
  );
}
