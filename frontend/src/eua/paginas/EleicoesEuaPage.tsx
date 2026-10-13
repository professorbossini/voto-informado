import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { faixa } from '@/data/mapaVotos';
import { eua, type EleicaoPresidente } from '../api';
import { LegendaEscala, MapaEua } from '../componentes/MapaEua';
import { LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota } from '../componentes/comuns';
import { dataBr, inteiro, nomeEstado, partidoResultado, pct, UFS_POR_NOME } from '../formato';

function Proxima() {
  const cal = useAsync(() => eua.calendario(), []);
  const esc = useAsync(() => eua.escritorios(), []);
  const c = cal.data;
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2">
          {c ? `Eleição geral de ${dataBr(c.proxima)}` : 'Próxima eleição'}
        </Typography>
        {c && (
          <>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {c.em_disputa.presidente
                ? `Eleição presidencial. Em disputa: a Presidência e a Vice-Presidência, as ${c.em_disputa.camara} cadeiras da Câmara, ${c.em_disputa.delegados} delegados(as) sem voto e ${c.em_disputa.senado} cadeiras do Senado (${c.em_disputa.senado_estados.map(([uf]) => uf).join(', ')}).`
                : `Eleição de meio de mandato (midterm). Em disputa: as ${c.em_disputa.camara} cadeiras da Câmara, ${c.em_disputa.delegados} delegados(as) sem voto e ${c.em_disputa.senado} cadeiras do Senado (${c.em_disputa.senado_estados.map(([uf]) => uf).join(', ')}).`}
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, my: 1.5 }}>
              {c.datas.map((d) => (
                <Typography component="li" variant="body2" key={d.data}>
                  <strong>{dataBr(d.data)}</strong>: {d.o_que}{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    ({d.base})
                  </Typography>
                </Typography>
              ))}
            </Box>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {Object.entries(c.leis).map(([nome, url]) => (
                <LinkExterno key={nome} href={url}>
                  {nome}
                </LinkExterno>
              ))}
            </Stack>
          </>
        )}
        <Typography variant="subtitle1" component="h3" sx={{ mt: 3, fontWeight: 700 }}>
          Onde sai o resultado oficial
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Nos EUA não existe um órgão nacional de apuração como o TSE. Cada estado conta, divulga e certifica os próprios votos, e a apuração da noite
          da eleição é parcial e não oficial até a certificação (semanas depois). As projeções de vencedores feitas por emissoras e agências de
          notícias não são resultado oficial. O órgão eleitoral de cada estado, segundo o governo federal (USAGov):
        </Typography>
        {esc.data ? (
          <Grid container spacing={0.5}>
            {[...UFS_POR_NOME, ...Object.keys(esc.data.escritorios).filter((u) => !UFS_POR_NOME.includes(u))].map((uf) =>
              esc.data!.escritorios[uf] ? (
                <Grid key={uf} size={{ xs: 12, sm: 6, md: 4 }}>
                  <LinkExterno href={esc.data!.escritorios[uf].url}>{nomeEstado(uf)}</LinkExterno>
                </Grid>
              ) : null,
            )}
          </Grid>
        ) : (
          <Carregando linhas={1} />
        )}
        <FonteNota chaves={['eua-usagov-escritorios']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

function MapaPresidente() {
  const [params, setParams] = useSearchParams();
  const r = useAsync(() => eua.presidente(), []);
  const anos = r.data?.anos ?? [];
  const ano = String(params.get('ano') ?? anos[anos.length - 1] ?? '');
  const e: EleicaoPresidente | undefined = r.data?.por_ano[ano];
  const idx = Math.min(Number(params.get('c') ?? 0), (e?.candidatos.length ?? 1) - 1);
  const cand = e?.candidatos[idx];
  const [uf, setUf] = useState<string | null>(null);

  const faixas = useMemo(() => {
    if (!e) return {};
    return Object.fromEntries(Object.entries(e.estados).map(([u, x]) => [u, faixa(x.total ? (100 * x.votos[idx]) / x.total : 0)]));
  }, [e, idx]);
  const rotulos = useMemo(() => {
    if (!e || !cand) return {};
    return Object.fromEntries(
      Object.entries(e.estados).map(([u, x]) => {
        const el = cand.eleitores_por_estado?.[u];
        return [u, `${nomeEstado(u)}: ${cand.nome} ${pct(x.total ? (100 * x.votos[idx]) / x.total : null)} dos votos${el ? ` · ${el} no Colégio Eleitoral` : ''}`];
      }),
    );
  }, [e, cand, idx]);

  if (r.error) return <Erro onRetry={r.reload} />;
  if (!r.data || !e) return <Carregando />;
  const set = (k: string, v: string) => setParams((p) => {
    const n = new URLSearchParams(p);
    n.set(k, v);
    if (k === 'ano') n.delete('c');
    return n;
  }, { replace: true });
  const sel = uf ? e.estados[uf] : null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2">
          Eleição para Presidente: votos por estado
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Escolha o ano e a candidatura: o mapa mostra a porcentagem dos votos que ela teve em cada estado, na mesma escala neutra para todas. Quem
          escolhe o que ver é você; a ordem da lista é a do total de votos no país.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="ano">Ano</InputLabel>
            <Select labelId="ano" label="Ano" value={ano} onChange={(ev) => set('ano', ev.target.value)}>
              {[...anos].reverse().map((a) => (
                <MenuItem key={a} value={String(a)}>
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="cand">Candidatura</InputLabel>
            <Select labelId="cand" label="Candidatura" value={String(idx)} onChange={(ev) => set('c', ev.target.value)}>
              {e.candidatos.map((c, i) => (
                <MenuItem key={c.nome} value={String(i)}>
                  {c.nome} ({partidoResultado(c.partido)})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <MapaEua faixas={faixas} rotulos={rotulos} selecionado={uf} onSelect={(u) => setUf(u === uf ? null : u)} ariaLabel={`Votos de ${cand?.nome} por estado em ${ano}`} />
            <LegendaEscala min="0%" max="100%" titulo={`% dos votos de ${cand?.nome ?? ''} no estado (10 faixas de 10 pontos)`} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {sel && uf ? `${nomeEstado(uf)}, ${ano}` : `Todo o país, ${ano}`}
            </Typography>
            <Stack spacing={1}>
              {e.candidatos.map((c, i) => {
                const votos = sel ? sel.votos[i] : c.votos;
                const total = sel ? sel.total : e.total;
                const el = uf ? c.eleitores_por_estado?.[uf] : c.eleitores;
                return (
                  <Box key={c.nome} sx={{ p: 1, borderRadius: 1, bgcolor: i === idx ? 'action.selected' : undefined }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} translate="no">
                      {c.nome}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p">
                      {partidoResultado(c.partido)} · {inteiro(votos)} votos ({pct(total ? (100 * votos) / total : null)})
                      {el == null ? '' : el === 1 ? ' · 1 voto no Colégio Eleitoral' : ` · ${el} votos no Colégio Eleitoral`}
                    </Typography>
                  </Box>
                );
              })}
              <Typography variant="caption" color="text.secondary">
                Total de votos: {inteiro(sel ? sel.total : e.total)}
                {!sel && e.colegio_total ? ` · ${e.colegio_total} votos no Colégio Eleitoral (maioria: 270 de 538)` : ''}
              </Typography>
              <LinkExterno href={e.url_colegio}>Certificados do Colégio Eleitoral de {ano} (National Archives)</LinkExterno>
            </Stack>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Como funciona: o voto popular de cada estado escolhe os eleitores do Colégio Eleitoral (o número de eleitores de cada estado é igual ao de
          suas cadeiras na Câmara e no Senado; o Distrito de Colúmbia tem 3). Em 48 estados e no DC, quem vence no estado leva todos os eleitores;
          Maine e Nebraska dividem os seus por distrito. É eleito quem soma 270 dos 538 votos.
        </Typography>
        <FonteNota chaves={['eua-medsl-presidente', 'eua-nara-colegio']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

function ResultadosSenado() {
  const r = useAsync(() => eua.senadoEleicoes(), []);
  const anos = r.data?.anos ?? [];
  const [ano, setAno] = useState<string | null>(null);
  const a = ano ?? anos[anos.length - 1];
  if (r.error) return <Erro onRetry={r.reload} />;
  if (!r.data) return <Carregando linhas={1} />;
  const disputas = [...(r.data.por_ano[a] ?? [])].sort((x, y) => nomeEstado(x.uf).localeCompare(nomeEstado(y.uf), 'pt-BR'));
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
          <Box>
            <Typography variant="h6" component="h2">
              Eleições para o Senado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resultado certificado de cada disputa, estado por estado (as até 5 candidaturas mais votadas).
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="ano-s">Ano</InputLabel>
            <Select labelId="ano-s" label="Ano" value={a} onChange={(e) => setAno(e.target.value)}>
              {[...anos].reverse().map((x) => (
                <MenuItem key={x} value={x}>
                  {x}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Estado</TableCell>
                <TableCell>Candidaturas (votos e %)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {disputas.map((d) => (
                <TableRow key={`${d.uf}-${d.especial}`}>
                  <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    <Link component={RouterLink} to={`/eua/estado/${d.uf}`}>
                      {nomeEstado(d.uf)}
                    </Link>
                    {d.especial && (
                      <Typography variant="caption" color="text.secondary" component="p">
                        eleição especial
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.candidatos.map((c) => (
                      <Typography key={c.nome} variant="body2" component="p">
                        <span translate="no">{c.nome}</span>{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {partidoResultado(c.partido)} · {inteiro(c.votos)} ({pct(c.pct)})
                        </Typography>
                      </Typography>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <FonteNota chaves={['eua-medsl-senado']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

export function EleicoesEuaPage() {
  return (
    <>
      <PageHeader
        title="Eleições nos EUA"
        subtitle="Resultados certificados pelos estados desde 1976, Colégio Eleitoral, a próxima eleição e onde cada estado publica o resultado oficial."
      />
      <AvisoInformativo />
      <Stack spacing={3}>
        <Proxima />
        <MapaPresidente />
        <ResultadosSenado />
      </Stack>
    </>
  );
}
