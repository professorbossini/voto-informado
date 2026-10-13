import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { StatTile } from '@/components/charts/charts';
import { normalize } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import { eua, ou404, type Casa, type MembroResumo } from '../api';
import { ChipVoto, LinhaVotacao, LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota } from '../componentes/comuns';
import { dataHoraBrasilia, nomeEstado, nomePartido, ordemPartidos, resultadoPt, rotuloVoto } from '../formato';

export function VotacoesEuaPage() {
  const [params, setParams] = useSearchParams();
  const casa = (params.get('casa') === 'senado' ? 'senado' : 'camara') as Casa;
  const cat = useAsync(() => eua.votacoes(casa), [casa]);
  const [busca, setBusca] = useState('');
  const [resultado, setResultado] = useState('');
  const [limite, setLimite] = useState(50);

  const lista = useMemo(() => {
    const q = normalize(busca);
    return (cat.data?.votacoes ?? []).filter(
      (v) => (!resultado || v.resultado === resultado) && (!q || normalize(`${v.descricao ?? ''} ${v.pergunta ?? ''} ${v.proposicao ?? ''}`).includes(q)),
    );
  }, [cat.data, busca, resultado]);
  const resultados = [...new Set((cat.data?.votacoes ?? []).map((v) => v.resultado).filter((r): r is string => !!r))].sort();

  return (
    <>
      <PageHeader
        title="Votações nominais"
        subtitle="Todas as votações nominais (roll call votes) do Plenário da Câmara e do Senado dos EUA no Congresso atual, com o voto de cada parlamentar, como publicadas."
      />
      <AvisoInformativo />
      <Tabs value={casa} onChange={(_, v: Casa) => setParams(v === 'camara' ? {} : { casa: v }, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="camara" label="Câmara" />
        <Tab value="senado" label="Senado" />
      </Tabs>
      {cat.error ? (
        <Erro onRetry={cat.reload} />
      ) : !cat.data ? (
        <Carregando />
      ) : (
        <Card variant="outlined">
          <CardContent>
            {cat.data.situacao === 'indisponivel' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                A última consulta ao site oficial não respondeu; a lista abaixo é a da coleta anterior e será completada na próxima passada.
              </Alert>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField size="small" label="Buscar (tema, proposição, ex.: H R 1)" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="f-res">Resultado</InputLabel>
                <Select labelId="f-res" label="Resultado" value={resultado} onChange={(e) => setResultado(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {resultados.map((r) => (
                    <MenuItem key={r} value={r}>
                      {resultadoPt(r)}
                      {resultadoPt(r) !== r ? ` (${r})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {lista.length} de {cat.data.total} votações, da mais recente para a mais antiga. Toque numa votação para ver como cada parlamentar votou.
            </Typography>
            <Box sx={{ mt: 1 }}>
              {lista.slice(0, limite).map((v) => (
                <LinhaVotacao key={v.id} v={v} />
              ))}
            </Box>
            {lista.length > limite && (
              <Link component="button" variant="body2" onClick={() => setLimite((l) => l + 100)} sx={{ mt: 1.5 }}>
                Mostrar mais ({lista.length - limite})
              </Link>
            )}
            <FonteNota chaves={[casa === 'senado' ? 'eua-votos-senado' : 'eua-votos-camara']} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

const ORDEM_VOTO = ['S', 'N', 'P', 'A'];

export function VotacaoEuaPage() {
  const { id = '' } = useParams();
  const v = useAsync(() => eua.votacao(id), [id]);
  const cong = useAsync(() => eua.congresso(), []);
  const nomes = useAsync(() => ou404(eua.nomesVotacoes()), []);
  const casa: Casa = id.startsWith('s') ? 'senado' : 'camara';

  const pessoas = useMemo(() => {
    const m = new Map<string, MembroResumo>();
    for (const x of [...(cong.data?.camara.membros ?? []), ...(cong.data?.senado.membros ?? [])]) m.set(x.id, x);
    return m;
  }, [cong.data]);

  if (v.error) return <Erro onRetry={v.reload} />;
  if (!v.data) return <Carregando />;
  const d = v.data;
  const porVoto = new Map<string, string[]>();
  for (const [bio, voto] of Object.entries(d.votos)) {
    const k = voto.startsWith('O:') ? voto : voto;
    porVoto.set(k, [...(porVoto.get(k) ?? []), bio]);
  }
  const chaves = [...porVoto.keys()].sort((a, b) => (ORDEM_VOTO.indexOf(a) + 1 || 9) - (ORDEM_VOTO.indexOf(b) + 1 || 9) || a.localeCompare(b));
  // Por partido (de quem está em exercício hoje; quem saiu aparece como "fora do cargo").
  const partidos = [...new Set(Object.keys(d.votos).map((b) => pessoas.get(b)?.partido ?? '–'))].sort(ordemPartidos);
  const nome = (b: string) => pessoas.get(b)?.nome ?? nomes.data?.[b] ?? b;

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/eua">
          Estados Unidos
        </Link>
        <Link component={RouterLink} to={`/eua/votacoes${casa === 'senado' ? '?casa=senado' : ''}`}>
          Votações
        </Link>
        <Typography color="text.primary">Nº {d.n}</Typography>
      </Breadcrumbs>
      <PageHeader title={d.descricao || d.pergunta || `Votação nº ${d.n}`} subtitle={casa === 'senado' ? `Senado dos EUA · ${dataHoraBrasilia(d.data)} (horário de Brasília)` : `Câmara dos EUA · ${dataHoraBrasilia(d.data)} (horário de Brasília)`} />
      <AvisoInformativo />
      <Stack spacing={3}>
        <Card variant="outlined">
          <CardContent>
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <StatTile label="Resultado" value={resultadoPt(d.resultado)} foot={d.resultado ?? undefined} />
              </Grid>
              {ORDEM_VOTO.filter((k) => d.placar[k as 'S']).map((k) => (
                <Grid key={k} size={{ xs: 6, md: 2 }}>
                  <StatTile label={rotuloVoto(k)} value={d.placar[k as 'S']} />
                </Grid>
              ))}
            </Grid>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, m: 0 }}>
              {[
                ['Pergunta votada', d.pergunta],
                ['Proposição', d.proposicao],
                ['Tipo de votação / maioria exigida', d.tipo],
              ]
                .filter(([, x]) => x)
                .map(([k, x]) => (
                  <Box key={k} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      {k}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                      {x}
                    </Typography>
                  </Box>
                ))}
            </Box>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              <LinkExterno href={d.url}>Votação no site oficial</LinkExterno>
              <LinkExterno href={d.url_xml}>Arquivo XML oficial</LinkExterno>
              {d.url_proposicao && <LinkExterno href={d.url_proposicao}>Proposição no Congress.gov</LinkExterno>}
            </Stack>
            <FonteNota chaves={[casa === 'senado' ? 'eua-votos-senado' : 'eua-votos-camara']} sx={{ mt: 2 }} />
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              Votos por partido
            </Typography>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { py: 0.75, px: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }, '& th:first-of-type, & td:first-of-type': { textAlign: 'left' } }}>
              <thead>
                <tr>
                  <th>Partido</th>
                  {chaves.map((k) => (
                    <th key={k}>{rotuloVoto(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partidos.map((p) => (
                  <tr key={p}>
                    <td>{p === '–' ? 'Fora do cargo hoje' : nomePartido(p)}</td>
                    {chaves.map((k) => (
                      <td key={k}>{(porVoto.get(k) ?? []).filter((b) => (pessoas.get(b)?.partido ?? '–') === p).length}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              Partido de cada parlamentar segundo a composição atual.
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Como cada parlamentar votou
            </Typography>
            <Stack spacing={2.5}>
              {chaves.map((k) => (
                <Box key={k}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                    <ChipVoto c={k} />
                    <Typography variant="body2" color="text.secondary">
                      {porVoto.get(k)!.length}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ lineHeight: 1.9 }}>
                    {porVoto
                      .get(k)!
                      .sort((a, b) => (pessoas.get(a)?.sobrenome ?? nome(a)).localeCompare(pessoas.get(b)?.sobrenome ?? nome(b), 'pt-BR'))
                      .map((b, i) => (
                        <span key={b}>
                          {i > 0 && ' · '}
                          {pessoas.get(b) ? (
                            <Link component={RouterLink} to={`/eua/membro/${b}`} translate="no">
                              {nome(b)}
                            </Link>
                          ) : (
                            <span translate="no">{nome(b)} (fora do cargo hoje)</span>
                          )}
                          {pessoas.get(b) && (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              ({pessoas.get(b)!.partido}-{pessoas.get(b)!.uf})
                            </Typography>
                          )}
                        </span>
                      ))}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              Ordem alfabética do sobrenome em cada grupo. Sigla e estado como na composição atual ({nomeEstado('DC')} e territórios incluídos).
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
