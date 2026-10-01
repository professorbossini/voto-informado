import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchRounded from '@mui/icons-material/SearchRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import { useSearchParams } from 'react-router';
import { BarList, StatTile } from '@/components/charts/charts';
import { SourceNote } from '@/components/election/SourceNote';
import { AvisosAlerts } from '@/components/gastos/AvisosAlerts';
import {
  ANO_PADRAO,
  CASA_NOME,
  isPassagem,
  LEGISLATURA,
  mediasPorCasaUf,
  valorNoPeriodo,
  type CasaFiltro,
} from '@/components/gastos/gastos';
import { RankingList, type Ordem, type RankingRow } from '@/components/gastos/RankingList';
import { data } from '@/data/api';
import { money, moneyCompact, normalize, number } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '../PageHeader';

const POR_PAGINA = 50;
const CASAS: CasaFiltro[] = ['todas', 'camara', 'senado'];
const ORDENS: Ordem[] = ['valor-desc', 'valor-asc', 'mensal-desc', 'mensal-asc', 'nome'];
const ORDEM_LABEL: Record<Ordem, string> = {
  'valor-desc': 'Maior valor primeiro',
  'valor-asc': 'Menor valor primeiro',
  'mensal-desc': 'Maior média por mês primeiro',
  'mensal-asc': 'Menor média por mês primeiro',
  nome: 'Nome (A–Z)',
};

function periodoLabel(periodo: string): string {
  if (periodo === LEGISLATURA) return 'toda a legislatura (desde fev/2023)';
  if (periodo === '2023') return '2023 (desde fevereiro, início da legislatura)';
  if (periodo === String(new Date().getFullYear())) return `${periodo} (ano em curso, parcial)`;
  return periodo;
}

const INTRO =
  'A cota parlamentar (CEAP, na Câmara dos Deputados; CEAPS, no Senado Federal) é uma verba prevista nas normas de cada Casa que reembolsa despesas ligadas ao exercício do mandato, como passagens, aluguel de escritório, combustível e divulgação da atividade parlamentar. Os valores abaixo são exatamente os publicados pelas duas Casas, organizados por parlamentar, ano e categoria de despesa.';

function GastosSkeleton() {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" height={64} />
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <Skeleton variant="rounded" height={104} />
          </Grid>
        ))}
      </Grid>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} variant="rounded" height={56} />
      ))}
    </Stack>
  );
}

export function GastosPage() {
  const { data: lista, error, loading, reload } = useAsync(() => data.parlamentares(), []);
  const { meta } = useMeta();
  const [sp, setSp] = useSearchParams();

  // ---- filters live in the URL (shareable links); defaults are omitted ----
  const casaParam = sp.get('casa') as CasaFiltro | null;
  const casa: CasaFiltro = casaParam && CASAS.includes(casaParam) ? casaParam : 'todas';
  const anos = useMemo(() => (lista?.anos ?? []).map(String), [lista]);
  const periodoParam = sp.get('periodo');
  const periodo = periodoParam && (periodoParam === LEGISLATURA || anos.includes(periodoParam) || !lista) ? periodoParam : ANO_PADRAO;
  const uf = sp.get('uf') ?? '';
  const partido = sp.get('partido') ?? '';
  const emExercicio = sp.get('exercicio') !== 'todos';
  const semPassagens = sp.get('passagens') === 'excluir';
  const q = sp.get('q') ?? '';
  const ordemParam = sp.get('ordem') as Ordem | null;
  // Ordem alfabética por padrão; ordenar por valor é escolha explícita de quem usa a página.
  const ordem: Ordem = ordemParam && ORDENS.includes(ordemParam) ? ordemParam : 'nome';

  const setParam = (key: string, value: string | null) => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value == null || value === '') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const filtrosAtivos = ['casa', 'periodo', 'uf', 'partido', 'exercicio', 'passagens', 'q'].some((k) => sp.has(k));

  const ufNomes = useMemo(() => new Map((meta?.ufs ?? []).map((u) => [u.uf, u.nome])), [meta]);
  const ufs = useMemo(() => [...new Set((lista?.parlamentares ?? []).map((p) => p.uf).filter((u): u is string => Boolean(u)))].sort(), [lista]);
  const partidos = useMemo(
    () => [...new Set((lista?.parlamentares ?? []).map((p) => p.partido).filter((u): u is string => Boolean(u)))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [lista],
  );

  const medias = useMemo(() => mediasPorCasaUf(lista?.parlamentares ?? [], periodo, semPassagens), [lista, periodo, semPassagens]);

  const { rows, semLancamento } = useMemo(() => {
    const termo = normalize(q);
    const filtrados = (lista?.parlamentares ?? []).filter(
      (p) =>
        (casa === 'todas' || p.casa === casa) &&
        (!uf || p.uf === uf) &&
        (!partido || p.partido === partido) &&
        (!emExercicio || p.em_exercicio) &&
        (!termo || normalize(p.nome).includes(termo)),
    );
    const base: Omit<RankingRow, 'posicao'>[] = [];
    for (const p of filtrados) {
      const v = valorNoPeriodo(p, periodo, semPassagens);
      if (!v) continue;
      const media = p.uf ? (medias.get(`${p.casa}:${p.uf}`) ?? null) : null;
      const diff = media && media.media > 0 && v.mediaMensal != null ? v.mediaMensal / media.media - 1 : null;
      base.push({ p, valor: v.valor, meses: v.meses, mediaMensal: v.mediaMensal, media, diff });
    }
    const porValor = [...base].sort((a, b) => b.valor - a.valor);
    const ranked: RankingRow[] = porValor.map((r, i) => ({ ...r, posicao: i + 1 }));
    return { rows: ranked, semLancamento: filtrados.length - base.length };
  }, [lista, casa, uf, partido, emExercicio, q, periodo, semPassagens, medias]);

  const ordenadas = useMemo(() => {
    if (ordem === 'valor-desc') return rows;
    if (ordem === 'valor-asc') return [...rows].reverse();
    if (ordem === 'mensal-desc' || ordem === 'mensal-asc') {
      const dir = ordem === 'mensal-desc' ? -1 : 1;
      return [...rows].sort((a, b) => dir * ((a.mediaMensal ?? 0) - (b.mediaMensal ?? 0)) || a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
    }
    return [...rows].sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  }, [rows, ordem]);

  // "Carregar mais" resets whenever the filtered set changes.
  const filtroKey = [casa, periodo, uf, partido, emExercicio, semPassagens, q, ordem].join('|');
  const [pagina, setPagina] = useState({ key: filtroKey, n: POR_PAGINA });
  const mostrados = pagina.key === filtroKey ? pagina.n : POR_PAGINA;

  const total = rows.reduce((s, r) => s + r.valor, 0);
  const maxValor = rows.length ? rows[0].valor : 0;

  const categorias = useMemo(() => {
    const acc = new Map<string, number>();
    for (const r of rows) {
      for (const [c, v] of Object.entries(r.p.por_categoria)) {
        if (semPassagens && isPassagem(c)) continue;
        acc.set(c, (acc.get(c) ?? 0) + v);
      }
    }
    return [...acc.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [rows, semPassagens]);

  const limitesCamara = (lista?.limites ?? []).filter((l) => l.casa === 'camara');
  const limiteUf = uf ? limitesCamara.find((l) => l.uf === uf) : undefined;
  const fontes = lista?.fontes ?? ['camara_ceap', 'senado_ceaps', 'camara_deputados', 'senado_senadores'];
  const fontesCasa = fontes.filter((f) => casa === 'todas' || (casa === 'camara' ? f.startsWith('camara') : f.startsWith('senado')));
  const anosAviso = periodo === LEGISLATURA ? (lista?.anos ?? []) : [Number(periodo)];

  const tetoTile = () => {
    if (casa === 'senado') {
      return <StatTile label="Teto mensal da cota (Senado)" value={<Typography variant="h6" component="span">Não publicado</Typography>} foot="O Senado não publica o teto por UF em formato aberto." />;
    }
    if (limiteUf) {
      return (
        <StatTile
          label={`Teto mensal na Câmara · ${uf}`}
          value={moneyCompact(limiteUf.valor_mensal)}
          foot={
            <>
              {money(limiteUf.valor_mensal)}
              {limiteUf.vigencia ? ` · ${limiteUf.vigencia}` : ''} ·{' '}
              <Link href={limiteUf.fonte_url} target="_blank" rel="noopener noreferrer">
                fonte <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
              </Link>
            </>
          }
        />
      );
    }
    if (limitesCamara.length) {
      const vals = limitesCamara.map((l) => l.valor_mensal);
      return (
        <StatTile
          label="Teto mensal na Câmara"
          value={<Typography variant="h6" component="span">{`${moneyCompact(Math.min(...vals))} a ${moneyCompact(Math.max(...vals))}`}</Typography>}
          foot={
            <>
              Varia por UF; escolha uma UF para ver o valor ·{' '}
              <Link href={limitesCamara[0].fonte_url} target="_blank" rel="noopener noreferrer">
                fonte <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
              </Link>
            </>
          }
        />
      );
    }
    return <StatTile label="Teto mensal da cota" value="Não informado" />;
  };

  return (
    <>
      <PageHeader title="Gastos de mandato (cota parlamentar)" subtitle="Deputados federais e senadores da legislatura atual · dados oficiais da Câmara e do Senado" />
      <Typography variant="body1" sx={{ maxWidth: 820, mb: 3 }}>
        {INTRO}
      </Typography>

      {/* ---- filters: one row, wraps on small screens ---- */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={casa}
              onChange={(_, v: CasaFiltro | null) => v && setParam('casa', v === 'todas' ? null : v)}
              aria-label="Casa legislativa"
            >
              <ToggleButton value="todas">Todas</ToggleButton>
              <ToggleButton value="camara">Câmara</ToggleButton>
              <ToggleButton value="senado">Senado</ToggleButton>
            </ToggleButtonGroup>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="f-periodo">Período</InputLabel>
              <Select labelId="f-periodo" label="Período" value={periodo} onChange={(e) => setParam('periodo', e.target.value === ANO_PADRAO ? null : e.target.value)}>
                {(anos.length ? anos : ['2023', '2024', '2025', '2026']).map((a) => (
                  <MenuItem key={a} value={a}>
                    {a}
                    {a === ANO_PADRAO ? ' (último ano completo sem lacuna na fonte)' : ''}
                  </MenuItem>
                ))}
                <MenuItem value={LEGISLATURA}>Toda a legislatura</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="f-uf">UF</InputLabel>
              <Select labelId="f-uf" label="UF" value={uf} onChange={(e) => setParam('uf', e.target.value)}>
                <MenuItem value="">Todas as UFs</MenuItem>
                {ufs.map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                    {ufNomes.get(u) ? ` · ${ufNomes.get(u)}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="f-partido">Partido</InputLabel>
              <Select labelId="f-partido" label="Partido" value={partido} onChange={(e) => setParam('partido', e.target.value)}>
                <MenuItem value="">Todos os partidos</MenuItem>
                {partidos.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Buscar por nome"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
              sx={{ flex: '1 1 200px', minWidth: 180 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <FormControlLabel
              control={<Switch checked={emExercicio} onChange={(_, c) => setParam('exercicio', c ? null : 'todos')} />}
              label="Somente em exercício"
            />
            <Tooltip title="Remove de todos os totais e médias as categorias cujo nome começa com “Passagens” (aéreas, terrestres e aquáticas), tornando anos e Casas comparáveis.">
              <FormControlLabel
                control={
                  <Switch
                    checked={semPassagens}
                    onChange={(_, c) => setParam('passagens', c ? 'excluir' : null)}
                  />
                }
                label="Excluir passagens"
              />
            </Tooltip>
            {filtrosAtivos && (
              <Button size="small" startIcon={<RestartAltRounded />} onClick={() => setSp(new URLSearchParams(), { replace: true })}>
                Limpar filtros
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {loading && <GastosSkeleton />}
      {!loading && error != null && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Tentar de novo
            </Button>
          }
        >
          Não foi possível carregar os dados de gastos. {error instanceof Error ? error.message : ''}
        </Alert>
      )}

      {!loading && lista && (
        <Stack spacing={3}>
          <AvisosAlerts avisos={lista.avisos} casa={casa} anos={anosAviso} lacunaNeutralizada={semPassagens} />

          <Box>
            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              Resumo · {periodoLabel(periodo)}
              {semPassagens ? ' · sem passagens' : ''}
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatTile label="Total no período" value={moneyCompact(total)} foot={money(total)} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatTile label="Média por parlamentar" value={rows.length ? moneyCompact(total / rows.length) : 'Não informado'} foot="Entre os exibidos com lançamentos" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatTile label="Parlamentares" value={number(rows.length)} foot={semLancamento > 0 ? `${number(semLancamento)} sem lançamentos no período não aparecem` : 'Com lançamentos no período'} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>{tetoTile()}</Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              O teto mensal varia por UF porque inclui o custo de deslocamento até Brasília. A Câmara publica esse valor por UF; o Senado Federal não
              publica, em formato aberto, o teto da cota por UF, por isso ele não é exibido para senadores.
            </Typography>
            <SourceNote keys={fontesCasa} sx={{ mt: 1 }} />
          </Box>

          <Card variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
                <Box>
                  <Typography variant="h6" component="h2">
                    Parlamentares e valores no período
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    A comparação é feita por mês com lançamento: a média por mês de cada parlamentar (valor ÷ meses com lançamento) diante da média
                    desse mesmo indicador entre os colegas da mesma casa e UF, no mesmo período.
                  </Typography>
                </Box>
                <FormControl size="small" sx={{ minWidth: 200, flexShrink: 0 }}>
                  <InputLabel id="f-ordem">Ordenar por</InputLabel>
                  <Select labelId="f-ordem" label="Ordenar por" value={ordem} onChange={(e) => setParam('ordem', e.target.value === 'nome' ? null : e.target.value)}>
                    {ORDENS.map((o) => (
                      <MenuItem key={o} value={o}>
                        {ORDEM_LABEL[o]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              {rows.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                  Nenhum parlamentar com lançamentos para os filtros escolhidos.
                </Typography>
              ) : (
                <>
                  <RankingList rows={ordenadas.slice(0, mostrados)} max={maxValor} ordem={ordem} onOrdem={(o) => setParam('ordem', o === 'nome' ? null : o)} />
                  {rows.some((r) => r.valor < 0) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Valores negativos aparecem quando estornos ou devoluções lançados pela Casa no período superam as
                      despesas, como publicado na fonte oficial.
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Exibindo {number(Math.min(mostrados, ordenadas.length))} de {number(ordenadas.length)}
                    </Typography>
                    {mostrados < ordenadas.length && (
                      <Button variant="tonal" onClick={() => setPagina({ key: filtroKey, n: mostrados + POR_PAGINA })}>
                        Carregar mais
                      </Button>
                    )}
                  </Stack>
                </>
              )}
              <SourceNote keys={fontesCasa} sx={{ mt: 2 }} note="valores por parlamentar e ano" />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2">
                Por categoria de despesa · toda a legislatura
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Soma dos parlamentares exibidos acima, desde fev/2023{semPassagens ? ', sem as categorias de passagens' : ''}. A lista oficial agregada
                traz as categorias para a legislatura inteira; o detalhamento por ano está na página de cada parlamentar. Câmara e Senado usam
                classificações diferentes, e os nomes são mantidos como publicados.
              </Typography>
              <BarList data={categorias} format={moneyCompact} limit={12} labelWidth={{ xs: '46%', sm: '40%' }} />
              <SourceNote keys={fontesCasa.filter((f) => f.endsWith('ceap') || f.endsWith('ceaps'))} sx={{ mt: 2 }} />
            </CardContent>
          </Card>

          {casa !== 'senado' && uf === '' && (
            <Typography variant="caption" color="text.secondary">
              {CASA_NOME.camara}: a cota de cada deputado tem teto mensal diferente conforme a UF. Para comparações mais justas, filtre por UF.
            </Typography>
          )}
        </Stack>
      )}
    </>
  );
}
