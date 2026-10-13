import { useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, FormControl, Grid, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { StatTile } from '@/components/charts/charts';
import { normalize } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import { eua, type Casa, type MembroResumo } from '../api';
import { PlenarioEua } from '../componentes/PlenarioEua';
import { AvisoInformativo, CartaoMembro, Carregando, Erro, FonteNota } from '../componentes/comuns';
import { distrito, idade, nomeEstado, nomePartido, ordemPartidos, pct, TERRITORIOS_POR_NOME, UFS_POR_NOME } from '../formato';

const ordemAlfabetica = (a: MembroResumo, b: MembroResumo) =>
  (a.sobrenome ?? a.nome).localeCompare(b.sobrenome ?? b.nome, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR');

function mediana(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

export function CongressoEuaPage() {
  const [params, setParams] = useSearchParams();
  const casa = (params.get('casa') === 'senado' ? 'senado' : 'camara') as Casa;
  const r = useAsync(() => eua.congresso(), []);
  const [uf, setUf] = useState('');
  const [partido, setPartido] = useState('');
  const [busca, setBusca] = useState('');

  const membros = useMemo(() => r.data?.[casa].membros ?? [], [r.data, casa]);
  const votantes = membros.filter((m) => !m.delegado);
  const partidos = [...new Set(membros.map((m) => m.partido ?? '?'))].sort(ordemPartidos);
  const lista = useMemo(() => {
    const q = normalize(busca);
    return membros
      .filter((m) => (!uf || m.uf === uf) && (!partido || m.partido === partido) && (!q || normalize(m.nome).includes(q)))
      .sort(ordemAlfabetica);
  }, [membros, uf, partido, busca]);

  if (r.error) return <Erro onRetry={r.reload} />;
  const d = r.data;
  const mulheres = votantes.filter((m) => m.genero === 'F').length;
  const idades = votantes.map((m) => idade(m.nascimento)).filter((x): x is number => x != null);
  const vagas = casa === 'camara' ? (d?.camara.vagas ?? []) : [];

  return (
    <>
      <PageHeader
        title="Congresso dos EUA"
        subtitle={d ? `${d.congresso}º Congresso (${2 * d.congresso + 1787}–${2 * d.congresso + 1789}). Composição atual, como publicada pelo Clerk da Câmara e pela compilação pública do Congresso.` : 'Composição atual'}
      />
      <AvisoInformativo />
      <Tabs value={casa} onChange={(_, v: Casa) => setParams(v === 'camara' ? {} : { casa: v }, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="camara" label="Câmara dos Representantes" />
        <Tab value="senado" label="Senado" />
      </Tabs>
      {!d ? (
        <Carregando />
      ) : (
        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, md: 7 }}>
                  <PlenarioEua membros={votantes} vagas={vagas.length} titulo={casa === 'camara' ? 'Câmara dos Representantes' : 'Senado'} />
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                      {casa === 'camara'
                        ? 'A Câmara tem 435 cadeiras com voto, divididas entre os estados pela população (Censo). Todos os mandatos são de 2 anos. Há ainda 6 delegados(as) sem voto no Plenário: Distrito de Colúmbia, Porto Rico e 4 territórios.'
                        : 'O Senado tem 100 cadeiras, 2 por estado, com mandatos de 6 anos; a cada 2 anos, cerca de um terço é renovado. O Vice-Presidente dos EUA preside o Senado e só vota para desempatar.'}
                    </Typography>
                    <Grid container spacing={1.5}>
                      <Grid size={6}>
                        <StatTile label="Em exercício" value={votantes.length} foot={vagas.length ? `${vagas.length} ${vagas.length === 1 ? 'vaga' : 'vagas'}` : 'sem vagas'} />
                      </Grid>
                      <Grid size={6}>
                        <StatTile label="Mulheres" value={pct((100 * mulheres) / Math.max(votantes.length, 1), 0)} foot={`${mulheres} de ${votantes.length}`} />
                      </Grid>
                      <Grid size={6}>
                        <StatTile label="Idade mediana" value={mediana(idades) != null ? `${mediana(idades)} anos` : '–'} foot="pela data de nascimento" />
                      </Grid>
                      <Grid size={6}>
                        <StatTile label="Partidos" value={partidos.length} foot={partidos.map(nomePartido).join(', ')} />
                      </Grid>
                    </Grid>
                  </Stack>
                </Grid>
              </Grid>
              <FonteNota chaves={['eua-clerk-membros', 'eua-legisladores', 'eua-bioguide']} sx={{ mt: 2 }} />
            </CardContent>
          </Card>

          {vagas.length > 0 && (
            <Alert severity="info" variant="outlined">
              Cadeiras vagas na Câmara (morte, renúncia ou posse em outro cargo; o estado convoca eleição especial):{' '}
              {vagas.map((v) => `${nomeEstado(v.uf)}, ${distrito(v.distrito)}`).join('; ')}.
            </Alert>
          )}

          <Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
              <TextField size="small" label="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="f-uf">Estado</InputLabel>
                <Select labelId="f-uf" label="Estado" value={uf} onChange={(e) => setUf(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {[...UFS_POR_NOME, ...(casa === 'camara' ? TERRITORIOS_POR_NOME : [])].map((u) => (
                    <MenuItem key={u} value={u}>
                      {nomeEstado(u)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="f-p">Partido</InputLabel>
                <Select labelId="f-p" label="Partido" value={partido} onChange={(e) => setPartido(e.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {partidos.map((p) => (
                    <MenuItem key={p} value={p}>
                      {nomePartido(p)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {lista.length} {lista.length === 1 ? 'parlamentar' : 'parlamentares'}, em ordem alfabética do sobrenome.
            </Typography>
            <Grid container spacing={1.5}>
              {lista.map((m) => (
                <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <CartaoMembro m={m} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Stack>
      )}
    </>
  );
}
