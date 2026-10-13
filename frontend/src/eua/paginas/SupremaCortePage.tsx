import { useMemo, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Card,
  CardActionArea,
  CardContent,
  Chip,
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
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { ColumnChart, StatTile } from '@/components/charts/charts';
import { normalize } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import { eua, type Decisao, type Juiz, type SupremaCorte } from '../api';
import { LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota, FotoMembro } from '../componentes/comuns';
import { dataBr, dolar, dolarCompacto, idade, presidenteQueNomeou } from '../formato';

const cargo = (j: { cargo: string }) => (j.cargo === 'presidente' ? 'Presidente da Corte (Chief Justice)' : 'Juiz(a) associado(a)');
const sobrenome = (nome: string) => nome.replace(/,? Jr\.?$/, '').split(' ').slice(-1)[0];

/** Decisões de que o(a) juiz(a) foi autor(a) da opinião da Corte (pela sigla publicada). */
function decisoesDe(sc: SupremaCorte, j: Juiz): Decisao[] {
  const sob = sobrenome(j.nome);
  return sc.decisoes.filter((d) => d.autor_nome === sob);
}

function ListaDecisoes({ decisoes, limite: lim = 15 }: { decisoes: Decisao[]; limite?: number }) {
  const [limite, setLimite] = useState(lim);
  return (
    <Box>
      {decisoes.slice(0, limite).map((d) => (
        <Box key={d.pdf} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {dataBr(d.data)} · processo {d.processo}
            {d.citacao ? ` · ${d.citacao}` : ''} · autoria: {d.autor_nome ?? d.autor ?? 'não informada'}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <Link href={d.pdf} target="_blank" rel="noopener noreferrer" translate="no">
              {d.nome}
            </Link>
          </Typography>
          {d.resumo_en && (
            <Typography variant="body2" color="text.secondary" lang="en" sx={{ mt: 0.25 }}>
              <Chip label="resumo oficial, em inglês" size="small" variant="outlined" sx={{ mr: 0.75, height: 18, fontSize: '0.65rem' }} />
              {d.resumo_en}
            </Typography>
          )}
        </Box>
      ))}
      {decisoes.length > limite && (
        <Link component="button" variant="body2" onClick={() => setLimite((l) => l + 30)} sx={{ mt: 1 }}>
          Mostrar mais ({decisoes.length - limite})
        </Link>
      )}
      {!decisoes.length && (
        <Typography variant="body2" color="text.secondary">
          Nenhuma decisão publicada no período.
        </Typography>
      )}
    </Box>
  );
}

export function SupremaCortePage() {
  const r = useAsync(() => eua.supremaCorte(), []);
  const [autor, setAutor] = useState('');
  const [busca, setBusca] = useState('');
  const historico = useMemo(() => {
    const q = normalize(busca);
    return (r.data?.historico ?? []).filter((h) => !q || normalize(`${h.nome} ${h.nomeado_por} ${h.estado}`).includes(q));
  }, [r.data, busca]);
  if (r.error) return <Erro onRetry={r.reload} />;
  const sc = r.data;
  const sal = sc?.salarios.at(-1);
  const decisoes = (sc?.decisoes ?? []).filter((d) => !autor || d.autor === autor);
  const autores = [...new Set((sc?.decisoes ?? []).map((d) => d.autor).filter((a): a is string => !!a))].sort((a, b) => (sc!.autores[a] ?? a).localeCompare(sc!.autores[b] ?? b, 'pt-BR'));

  return (
    <>
      <PageHeader
        title="Suprema Corte dos EUA"
        subtitle="Nove juízes(as) com cargo vitalício, indicados(as) pelo Presidente e confirmados(as) pelo Senado (Constituição, art. II, seção 2). Dados da própria Corte."
      />
      <AvisoInformativo />
      {!sc ? (
        <Carregando />
      ) : (
        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Composição atual
              </Typography>
              <Grid container spacing={1.5}>
                {sc.juizes.map((j) => (
                  <Grid key={j.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined" sx={{ height: 1 }}>
                      <CardActionArea component={RouterLink} to={`/eua/suprema-corte/${j.id}`} sx={{ p: 1.5, height: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 1.5 }}>
                        <FotoMembro foto={j.foto} nome={j.nome} largura={64} />
                        <Box>
                          <Typography variant="subtitle2" translate="no">
                            {j.nome}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="p">
                            {cargo(j)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="p">
                            Indicação: {presidenteQueNomeou(j.nomeado_por)} · posse em {dataBr(j.juramento)}
                          </Typography>
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                Ordem oficial: a presidência da Corte e depois a antiguidade (data do juramento). Retratos: Collection of the Supreme Court of the United States.
              </Typography>
              <FonteNota chaves={['eua-scotus-membros']} sx={{ mt: 1 }} />
            </CardContent>
          </Card>

          {sal && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                  Salário anual (fixado em lei)
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label={`Presidente da Corte, ${sal.ano}`} value={dolarCompacto(sal.presidente)} foot={dolar(sal.presidente)} />
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <StatTile label={`Juiz(a) associado(a), ${sal.ano}`} value={dolarCompacto(sal.associado)} foot={dolar(sal.associado)} />
                  </Grid>
                </Grid>
                <ColumnChart data={sc.salarios.filter((s) => s.ano >= sal.ano - 20).map((s) => ({ label: String(s.ano), value: s.associado }))} format={dolarCompacto} />
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                  Salário de juiz(a) associado(a) ano a ano, sem correção pela inflação. Os juízes também entregam declaração anual de bens e
                  atividades (financial disclosure), publicada pelo Judiciário federal.
                </Typography>
                <FonteNota chaves={['eua-uscourts-salarios']} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          )}

          <Card variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1 }}>
                <Box>
                  <Typography variant="h6" component="h2">
                    Decisões publicadas
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Anos judiciários {sc.termo_atual - 1} e {sc.termo_atual} (cada um começa em outubro). Mais recentes primeiro, com o PDF oficial.
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="autor">Autoria</InputLabel>
                  <Select labelId="autor" label="Autoria" value={autor} onChange={(e) => setAutor(e.target.value)}>
                    <MenuItem value="">Todas</MenuItem>
                    {autores.map((a) => (
                      <MenuItem key={a} value={a}>
                        {sc.autores[a] ?? a}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <ListaDecisoes decisoes={decisoes} />
              <FonteNota chaves={['eua-scotus-decisoes']} sx={{ mt: 2 }} />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2">
                Todos os juízes desde 1789
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {sc.historico.length} registros na lista oficial da Corte (quem foi juiz associado e depois presidente aparece duas vezes).
              </Typography>
              <TextField size="small" label="Buscar (nome, presidente que indicou, estado)" value={busca} onChange={(e) => setBusca(e.target.value)} fullWidth sx={{ mb: 1.5 }} />
              <TableContainer sx={{ maxHeight: 480 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Cargo</TableCell>
                      <TableCell>Indicação</TableCell>
                      <TableCell>Estado</TableCell>
                      <TableCell>Período</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historico.map((h) => (
                      <TableRow key={`${h.nome_oficial}-${h.cargo}`}>
                        <TableCell translate="no">{h.nome}</TableCell>
                        <TableCell>{h.cargo === 'presidente' ? 'Presidente' : 'Associado(a)'}</TableCell>
                        <TableCell>{presidenteQueNomeou(h.nomeado_por)}</TableCell>
                        <TableCell>{h.estado}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {dataBr(h.juramento)} – {h.saida ? dataBr(h.saida) : 'hoje'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <FonteNota chaves={['eua-scotus-membros']} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Stack>
      )}
    </>
  );
}

export function JuizPage() {
  const { id = '' } = useParams();
  const r = useAsync(() => eua.supremaCorte(), []);
  if (r.error) return <Erro onRetry={r.reload} />;
  if (!r.data) return <Carregando />;
  const j = r.data.juizes.find((x) => x.id === id);
  if (!j) return <Erro />;
  const anos = idade(j.nascimento);
  const minhas = decisoesDe(r.data, j);
  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/eua">
          Estados Unidos
        </Link>
        <Link component={RouterLink} to="/eua/suprema-corte">
          Suprema Corte
        </Link>
        <Typography color="text.primary">{j.nome}</Typography>
      </Breadcrumbs>
      <AvisoInformativo />
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <FotoMembro foto={j.foto} nome={j.nome} largura={150} />
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {cargo(j)}
                </Typography>
                <Typography variant="h4" component="h1" translate="no">
                  {j.nome}
                </Typography>
                <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, mt: 1.5 }}>
                  {[
                    ['Indicado(a) por', presidenteQueNomeou(j.nomeado_por)],
                    ['Juramento (início do serviço)', dataBr(j.juramento)],
                    ['Estado de origem da indicação', j.estado ?? 'Não informado'],
                    ['Nascimento', j.nascimento ? `${dataBr(j.nascimento)}${anos != null ? ` (${anos} anos)` : ''}${j.naturalidade ? `, ${j.naturalidade}` : ''}` : 'Não informado'],
                  ].map(([k, v]) => (
                    <Box key={k} sx={{ display: 'contents' }}>
                      <Typography component="dt" variant="body2" color="text.secondary">
                        {k}
                      </Typography>
                      <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                        {v}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ mt: 1.5 }}>
                  <LinkExterno href="https://www.supremecourt.gov/about/biographies.aspx">Biografia oficial na Suprema Corte</LinkExterno>
                </Box>
              </Box>
            </Stack>
            <FonteNota chaves={['eua-scotus-membros']} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Biografia oficial (texto da Corte, em inglês)
            </Typography>
            <Typography variant="body2" lang="en" sx={{ whiteSpace: 'pre-line' }}>
              {j.biografia_en}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Opiniões da Corte escritas por {j.nome}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Decisões em que a Corte indicou {j.nome} como autor(a) da opinião majoritária, nos anos judiciários {r.data.termo_atual - 1} e {r.data.termo_atual}.
              Votos divergentes e concorrentes ficam dentro de cada PDF.
            </Typography>
            <ListaDecisoes decisoes={minhas} />
            <FonteNota chaves={['eua-scotus-decisoes']} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
