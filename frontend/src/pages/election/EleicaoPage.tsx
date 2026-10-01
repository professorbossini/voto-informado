import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';
import { CandidateCard, CompareToggle } from '@/components/election/CandidateCard';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { StatusChip } from '@/components/election/StatusChip';
import { UfTileMap } from '@/components/election/UfTileMap';
import { data } from '@/data/api';
import { CARGO_LABEL, CARGO_PLURAL, moneyCompact, nomeProprio, normalize, number } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { Candidato, Cargo, DeputadoResumo } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

type TabKey = 'presidente' | 'governador' | 'senador' | 'deputado-federal' | 'deputado-estadual' | 'deputado-distrital';

const SORTS = {
  nome: { label: 'Nome (A–Z)', fn: (a: Candidato, b: Candidato) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR') },
  numero: { label: 'Número', fn: (a: Candidato, b: Candidato) => Number(a.numero) - Number(b.numero) },
  bens: { label: 'Bens declarados (maior primeiro)', fn: (a: Candidato, b: Candidato) => b.bens_total - a.bens_total },
  receitas: { label: 'Arrecadação (maior primeiro)', fn: (a: Candidato, b: Candidato) => (b.receitas ?? -1) - (a.receitas ?? -1) },
} as const;

function CriterioInfo() {
  return (
    <Tooltip
      title="Filtro opcional inspirado no art. 46 da Lei 9.504/97 (debates de rádio e TV): soma deputados e senadores em exercício de todos os partidos da chapa (partido, federação e coligação), com dados oficiais da Câmara e do Senado na data da coleta. A lei usa outra data de referência, então este recorte não é a lista oficial de convidados para debates. Não é pesquisa nem juízo de relevância."
    >
      <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} aria-label="Sobre o critério" />
    </Tooltip>
  );
}

function Majoritarios({ cargo, lista, vagas, fontes }: { cargo: TabKey; lista: Candidato[]; vagas?: number; fontes: string[] }) {
  const [params, setParams] = useSearchParams();
  // Padrão: todas as candidaturas na urna. O recorte por bancada é opcional (?criterio=congresso5).
  const modo = params.get('criterio') === 'congresso5' ? 'criterio' : 'todos';
  const foraUrna = params.get('fora') === '1';
  const sort = (params.get('ordem') as keyof typeof SORTS) || 'nome';
  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v == null) p.delete(k);
        else p.set(k, v);
        return p;
      },
      { replace: true },
    );

  const naUrna = lista.filter((c) => c.na_urna);
  const destaques = naUrna.filter((c) => c.criterio_debate);
  const base = modo === 'criterio' ? destaques : naUrna;
  const extra = foraUrna ? lista.filter((c) => !c.na_urna) : [];
  const visible = [...base].sort(SORTS[sort]?.fn ?? SORTS.nome.fn).concat(extra.sort(SORTS.nome.fn));

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup exclusive size="small" value={modo} onChange={(_, v) => v && set('criterio', v === 'criterio' ? 'congresso5' : null)} aria-label="Quais candidaturas mostrar">
            <ToggleButton value="todos">Todos na urna ({naUrna.length})</ToggleButton>
            <ToggleButton value="criterio">Chapas com 5+ parlamentares ({destaques.length})</ToggleButton>
          </ToggleButtonGroup>
          <CriterioInfo />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="ordem-label">Ordenar por</InputLabel>
            <Select labelId="ordem-label" label="Ordenar por" value={sort} onChange={(e) => set('ordem', e.target.value === 'nome' ? null : e.target.value)}>
              {Object.entries(SORTS).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={foraUrna} onChange={(e) => set('fora', e.target.checked ? '1' : null)} />}
            label={`Ver fora da urna (${lista.length - naUrna.length})`}
          />
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {vagas ? `${vagas} ${vagas === 1 ? 'vaga' : 'vagas'} em disputa. ` : ''}
        {modo === 'criterio'
          ? `Filtro aplicado: ${destaques.length} de ${naUrna.length} candidaturas na urna, de chapas que somam 5 ou mais parlamentares em exercício no Congresso. `
          : `Todas as ${naUrna.length} candidaturas na urna, em ordem alfabética. `}
        {modo === 'criterio' && (
          <Link component="button" variant="body2" onClick={() => set('criterio', null)} sx={{ verticalAlign: 'baseline' }}>
            Voltar a ver todas
          </Link>
        )}
      </Typography>
      {cargo === 'senador' && (
        <Alert severity="info">Em 2026 cada estado elege duas pessoas para o Senado: você vota duas vezes, em candidaturas diferentes.</Alert>
      )}
      <Grid container spacing={2}>
        {visible.map((c) => (
          <Grid key={c.sq} size={{ xs: 12, sm: 6, lg: 4 }}>
            <CandidateCard c={c} />
          </Grid>
        ))}
        {visible.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary">Nenhuma candidatura neste filtro.</Typography>
          </Grid>
        )}
      </Grid>
      <SourceNote keys={fontes} />
    </Stack>
  );
}

const WRAP_CHIP = { height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } } as const;

const DEP_SORTS = {
  nome: { label: 'Nome (A–Z)', fn: (a: DeputadoResumo, b: DeputadoResumo) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR') },
  numero: { label: 'Número', fn: (a: DeputadoResumo, b: DeputadoResumo) => Number(a.numero) - Number(b.numero) },
  bens: { label: 'Bens declarados (maior primeiro)', fn: (a: DeputadoResumo, b: DeputadoResumo) => b.bens_total - a.bens_total },
  receitas: { label: 'Arrecadação (maior primeiro)', fn: (a: DeputadoResumo, b: DeputadoResumo) => (b.receitas ?? -1) - (a.receitas ?? -1) },
  despesas: { label: 'Gastos contratados (maior primeiro)', fn: (a: DeputadoResumo, b: DeputadoResumo) => (b.despesas ?? -1) - (a.despesas ?? -1) },
  idade: { label: 'Idade (mais jovem primeiro)', fn: (a: DeputadoResumo, b: DeputadoResumo) => (a.idade ?? 999) - (b.idade ?? 999) },
} as const;

function DeputadoRow({ d }: { d: DeputadoResumo }) {
  const nome = nomeProprio(d.nome_urna);
  return (
    <Card sx={{ '&:hover': { borderColor: 'primary.light' } }}>
      <Stack direction="row" spacing={2} sx={{ p: 1.5, alignItems: 'center' }}>
        <CandidatePhoto src={d.foto} alt={`Foto de ${nome}`} width={52} rounded={8} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.06em' }}>{d.numero}</Typography>
            <Link component={RouterLink} to={`/candidato/${d.sq}`} sx={{ fontWeight: 600, color: 'text.primary' }}>
              {nome}
            </Link>
            <Typography variant="body2" color="text.secondary">
              {d.partido}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {[d.idade != null ? `${d.idade} anos` : null, d.genero, d.instrucao, d.ocupacao].filter(Boolean).join(' · ')}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.75 }}>
            <StatusChip situacao={d.situacao} naUrna={d.na_urna} />
            {d.mandato_atual && <Chip size="small" variant="outlined" sx={WRAP_CHIP} label={`Mandato atual no Congresso: ${d.mandato_atual}`} />}
            {d.eleito_ultima && <Chip size="small" variant="outlined" sx={WRAP_CHIP} label={`Eleito(a): ${d.eleito_ultima}`} />}
          </Stack>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'repeat(3, 110px)', gap: 1, textAlign: 'right' }}>
          {[
            ['Bens', moneyCompact(d.bens_total)],
            ['Arrecadou', d.receitas != null ? moneyCompact(d.receitas) : '—'],
            ['Gastou', d.despesas != null ? moneyCompact(d.despesas) : '—'],
          ].map(([k, v]) => (
            <Box key={k}>
              <Typography variant="caption" color="text.secondary" component="div">
                {k}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {v}
              </Typography>
            </Box>
          ))}
        </Box>
        <CompareToggle sq={d.sq} nome={nome} />
      </Stack>
    </Card>
  );
}

function Deputados({ uf, cargo }: { uf: string; cargo: Cargo }) {
  const res = useAsync(() => data.deputados(uf), [uf]);
  const [busca, setBusca] = useState('');
  const [partido, setPartido] = useState('');
  const [genero, setGenero] = useState('');
  const [mandato, setMandato] = useState(false);
  const [foraUrna, setForaUrna] = useState(false);
  const [sort, setSort] = useState<keyof typeof DEP_SORTS>('nome');
  const [limit, setLimit] = useState(40);

  const doCargo = useMemo(() => (res.data?.candidatos ?? []).filter((d) => d.cargo === cargo), [res.data, cargo]);
  const partidos = useMemo(() => [...new Set(doCargo.map((d) => d.partido))].sort(), [doCargo]);
  const filtrados = useMemo(() => {
    const q = normalize(busca);
    return doCargo
      .filter((d) => (foraUrna ? true : d.na_urna))
      .filter((d) => !partido || d.partido === partido)
      .filter((d) => !genero || d.genero === genero)
      .filter((d) => !mandato || d.mandato_atual || d.eleito_ultima)
      .filter((d) => !q || normalize(`${d.nome_urna} ${d.numero}`).includes(q))
      .sort(DEP_SORTS[sort].fn);
  }, [doCargo, busca, partido, genero, mandato, foraUrna, sort]);

  if (res.loading) return <Stack spacing={1}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" height={92} />)}</Stack>;
  if (res.error) return <Alert severity="error">Não foi possível carregar a lista. Tente novamente.</Alert>;

  const vagas = res.data?.vagas[cargo];
  const naUrna = doCargo.filter((d) => d.na_urna).length;
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {number(naUrna)} candidaturas na urna para {vagas} {vagas === 1 ? 'vaga' : 'vagas'} ({(naUrna / (vagas || 1)).toFixed(1).replace('.', ',')} por vaga). A
        eleição de deputados é proporcional: os votos de cada partido ou federação definem quantas cadeiras ele ocupa, e
        os mais votados dentro dele ficam com as vagas.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Nome ou número"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setLimit(40);
          }}
          sx={{ minWidth: 220, flex: 1 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="partido-label">Partido</InputLabel>
          <Select labelId="partido-label" label="Partido" value={partido} onChange={(e) => setPartido(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {partidos.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="genero-label">Gênero</InputLabel>
          <Select labelId="genero-label" label="Gênero" value={genero} onChange={(e) => setGenero(e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="Feminino">Feminino</MenuItem>
            <MenuItem value="Masculino">Masculino</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 230 }}>
          <InputLabel id="dep-ordem">Ordenar por</InputLabel>
          <Select labelId="dep-ordem" label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof DEP_SORTS)}>
            {Object.entries(DEP_SORTS).map(([k, v]) => (
              <MenuItem key={k} value={k}>
                {v.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <FormControlLabel control={<Switch checked={mandato} onChange={(e) => setMandato(e.target.checked)} />} label="Com mandato atual ou eleito(a) desde 2018" />
        <FormControlLabel control={<Switch checked={foraUrna} onChange={(e) => setForaUrna(e.target.checked)} />} label="Incluir fora da urna" />
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {number(filtrados.length)} {filtrados.length === 1 ? 'resultado' : 'resultados'}
      </Typography>
      <Stack spacing={1}>
        {filtrados.slice(0, limit).map((d) => (
          <DeputadoRow key={d.sq} d={d} />
        ))}
      </Stack>
      {filtrados.length > limit && (
        <Button variant="tonal" onClick={() => setLimit((l) => l + 60)} sx={{ alignSelf: 'center' }}>
          Carregar mais ({number(filtrados.length - limit)} restantes)
        </Button>
      )}
      <SourceNote keys={res.data?.fontes ?? []} />
    </Stack>
  );
}

export function EleicaoPage() {
  const { uf: ufParam, cargo: cargoParam } = useParams();
  const navigate = useNavigate();
  const { meta } = useMeta();
  const uf = ufParam?.toUpperCase() ?? null;
  const isBR = uf === 'BR';
  const estadual: TabKey = uf === 'DF' ? 'deputado-distrital' : 'deputado-estadual';
  const tabs: TabKey[] = isBR || !uf ? ['presidente'] : ['presidente', 'governador', 'senador', 'deputado-federal', estadual];
  let cargo = (cargoParam as TabKey) || (isBR || !uf ? 'presidente' : 'governador');
  if (cargo === 'deputado-estadual' || cargo === 'deputado-distrital') cargo = estadual;

  const presidente = useAsync(() => (cargo === 'presidente' ? data.presidente() : Promise.resolve(null)), [cargo]);
  const maj = useAsync(() => (uf && !isBR && (cargo === 'governador' || cargo === 'senador') ? data.majoritarios(uf) : Promise.resolve(null)), [uf, cargo]);
  const ufInfo = meta?.ufs.find((u) => u.uf === uf);

  const go = (nextUf: string | null, nextCargo: TabKey) => {
    if (nextCargo === 'presidente' && !nextUf) return void navigate('/eleicao/BR/presidente');
    void navigate(`/eleicao/${nextUf ?? 'BR'}/${nextCargo}`);
  };

  return (
    <>
      <PageHeader
        title={uf && !isBR ? `Candidaturas · ${ufInfo?.nome ?? uf}` : 'Candidaturas 2026'}
        subtitle="Todas as candidaturas registradas no TSE, com os mesmos campos para todos. Clique em um nome para ver o perfil completo."
        actions={
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="uf-label">Estado</InputLabel>
            <Select
              labelId="uf-label"
              label="Estado"
              value={uf && !isBR && meta ? uf : ''}
              onChange={(e) => go(e.target.value, cargo === 'presidente' ? 'governador' : cargo)}
            >
              {(meta?.ufs ?? [])
                .filter((u) => u.uf !== 'BR')
                .map((u) => (
                  <MenuItem key={u.uf} value={u.uf}>
                    {u.nome}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        }
      />

      {(!uf || isBR) && (
        <Card sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="h6">Escolha um estado para ver governador(a), Senado e deputados</Typography>
              <Typography variant="body2" color="text.secondary">
                A Presidência é igual para todo o país e aparece abaixo.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }} sx={{ overflowX: 'auto' }}>
              <UfTileMap onSelect={(u) => go(u, 'governador')} names={Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome]))} size={40} />
            </Grid>
          </Grid>
        </Card>
      )}

      <Tabs
        value={cargo}
        onChange={(_, v: TabKey) => go(v === 'presidente' ? (uf && !isBR ? uf : null) : uf, v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {tabs.map((t) => (
          <Tab key={t} value={t} label={`${CARGO_PLURAL[t]}${ufInfo?.candidatos[t] && t !== 'presidente' ? ` (${ufInfo.candidatos[t]})` : ''}`} />
        ))}
      </Tabs>

      {cargo === 'presidente' &&
        (presidente.loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }, (_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Skeleton variant="rounded" height={260} />
              </Grid>
            ))}
          </Grid>
        ) : presidente.data ? (
          <Majoritarios cargo="presidente" lista={presidente.data.candidatos} vagas={1} fontes={presidente.data.fontes} />
        ) : (
          <Alert severity="error">Não foi possível carregar os dados.</Alert>
        ))}

      {(cargo === 'governador' || cargo === 'senador') &&
        uf &&
        (maj.loading ? (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }, (_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Skeleton variant="rounded" height={260} />
              </Grid>
            ))}
          </Grid>
        ) : maj.data ? (
          <Majoritarios cargo={cargo} lista={maj.data[cargo]} vagas={maj.data.vagas[cargo]} fontes={maj.data.fontes} />
        ) : (
          <Alert severity="error">Não foi possível carregar os dados.</Alert>
        ))}

      {(cargo === 'deputado-federal' || cargo === 'deputado-estadual' || cargo === 'deputado-distrital') && uf && <Deputados uf={uf} cargo={cargo} />}

      {cargo !== 'presidente' && !uf && (
        <Typography color="text.secondary">Escolha um estado para ver {CARGO_LABEL[cargo].toLowerCase()}.</Typography>
      )}
    </>
  );
}
