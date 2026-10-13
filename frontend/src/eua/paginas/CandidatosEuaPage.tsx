import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { eua, type CandidaturaFec } from '../api';
import { LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota } from '../componentes/comuns';
import { MapaEua } from '../componentes/MapaEua';
import { dataBr, distrito, dolarCompacto, nomeEstado, SITUACAO_FEC, TERRITORIOS_POR_NOME, UFS_POR_NOME } from '../formato';

function Candidatura({ c, partidos }: { c: CandidaturaFec; partidos: Record<string, string> }) {
  const f = c.financas;
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }} translate="no">
            {c.bioguide ? (
              <Link component={RouterLink} to={`/eua/membro/${c.bioguide}`}>
                {c.nome}
              </Link>
            ) : (
              c.nome
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {c.partido ? (partidos[c.partido] ?? c.partido) : 'Partido não informado'}
            {c.situacao ? ` · ${SITUACAO_FEC[c.situacao]}` : ''} · registro {c.fec} · <LinkExterno href={c.url}>FEC</LinkExterno>
          </Typography>
        </Box>
        <Box sx={{ textAlign: { sm: 'right' }, flexShrink: 0 }}>
          {f && (f.receitas || f.despesas) ? (
            <Typography variant="caption" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              Receitas {dolarCompacto(f.receitas)} · Despesas {dolarCompacto(f.despesas)} · Caixa {dolarCompacto(f.caixa)}
              <br />
              <Typography component="span" variant="caption" color="text.secondary">
                declarado até {dataBr(f.ate)}
              </Typography>
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Sem movimentação declarada no ciclo
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export function CandidatosEuaPage() {
  const [params, setParams] = useSearchParams();
  const uf = (params.get('uf') ?? '').toUpperCase();
  const resumo = useAsync(() => eua.resumoCandidatos(), []);
  const cal = useAsync(() => eua.calendario(), []);
  const dados = useAsync(() => (uf ? eua.candidatos(uf) : Promise.resolve(null)), [uf]);
  const [soComDinheiro, setSoComDinheiro] = useState(false);
  const partidos = resumo.data?.partidos ?? {};
  const senadoEmDisputa = new Set((cal.data?.em_disputa.senado_estados ?? []).map(([u]) => u));
  const filtro = (l: CandidaturaFec[]) => (soComDinheiro ? l.filter((c) => (c.financas?.receitas ?? 0) > 0) : l);
  const distritos = useMemo(() => Object.entries(dados.data?.camara ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])), [dados.data]);

  return (
    <>
      <PageHeader
        title={`Candidaturas ${resumo.data?.ciclo ?? 2026}`}
        subtitle="Quem se registrou na Comissão Eleitoral Federal (FEC) para disputar a Câmara e o Senado em cada estado, com o dinheiro declarado pela campanha."
      />
      <AvisoInformativo />
      <Alert severity="warning" variant="outlined" sx={{ mb: 3 }}>
        A FEC registra quem se declara candidato(a) a cargo federal e movimenta recursos; ela não diz quem está na cédula de novembro. Isso depende
        das primárias e das regras de cada estado, publicadas pelo órgão eleitoral estadual. Por isso a lista inclui quem perdeu primárias ou
        desistiu. Para a cédula oficial, consulte o órgão eleitoral do estado (lista na página{' '}
        <Link component={RouterLink} to="/eua/eleicoes">
          Eleições
        </Link>
        ).
      </Alert>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card data-figura variant="outlined">
            <CardContent>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="uf">Estado</InputLabel>
                <Select labelId="uf" label="Estado" value={uf} onChange={(e) => setParams(e.target.value ? { uf: e.target.value } : {}, { replace: true })}>
                  {[...UFS_POR_NOME, ...TERRITORIOS_POR_NOME].map((u) => (
                    <MenuItem key={u} value={u}>
                      {nomeEstado(u)}
                      {resumo.data?.estados[u] ? ` (${resumo.data.estados[u].senado + resumo.data.estados[u].camara})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <MapaEua selecionado={uf || null} onSelect={(u) => setParams({ uf: u }, { replace: true })} marcados={senadoEmDisputa} dica="Em destaque, os estados com eleição para o Senado. Escolha um estado." />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          {!uf ? (
            <Alert severity="info">Escolha um estado no mapa ou na lista para ver as candidaturas.</Alert>
          ) : dados.error ? (
            <Erro onRetry={dados.reload} />
          ) : !dados.data ? (
            <Carregando />
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 1 }}>
                  <Typography variant="h6" component="h2">
                    {nomeEstado(uf)}
                  </Typography>
                  <FormControlLabel
                    control={<Switch checked={soComDinheiro} onChange={(e) => setSoComDinheiro(e.target.checked)} />}
                    label="Só com receitas declaradas"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
                  Em ordem alfabética do sobrenome, como no registro da FEC. O filtro é opcional e usa só o critério objetivo de ter declarado receita.
                </Typography>
                <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
                  Senado {senadoEmDisputa.has(uf) ? <Chip size="small" label="cadeira em disputa" sx={{ ml: 1 }} /> : null}
                </Typography>
                {filtro(dados.data.senado).length ? (
                  filtro(dados.data.senado).map((c) => <Candidatura key={c.fec} c={c} partidos={partidos} />)
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
                    {senadoEmDisputa.has(uf) ? 'Nenhuma candidatura com esse filtro.' : `Sem eleição para o Senado neste estado em ${dados.data.ciclo}.`}
                  </Typography>
                )}
                <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, mt: 3 }}>
                  Câmara
                </Typography>
                {distritos.map(([d, lista]) => (
                  <Box key={d} sx={{ mt: 1.5 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {distrito(Number(d))[0].toUpperCase() + distrito(Number(d)).slice(1)} ({filtro(lista).length})
                    </Typography>
                    {filtro(lista).map((c) => (
                      <Candidatura key={c.fec} c={c} partidos={partidos} />
                    ))}
                  </Box>
                ))}
                <FonteNota chaves={['eua-fec-candidatos', 'eua-fec-financas']} sx={{ mt: 2 }} />
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </>
  );
}
