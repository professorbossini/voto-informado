import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardActionArea,
  CardContent,
  FormControl,
  Grid,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CasinoRounded from '@mui/icons-material/CasinoRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import PollRounded from '@mui/icons-material/PollRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import TouchAppRounded from '@mui/icons-material/TouchAppRounded';
import { Link as RouterLink, useNavigate } from 'react-router';
import { SERIES } from '@/components/charts/palette';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CandidateSearch } from '@/components/election/CandidateSearch';
import { SourceNote } from '@/components/election/SourceNote';
import { BrazilMap } from '@/components/election/UfTileMap';
import { data } from '@/data/api';
import { dateLong, DIGITOS, moneyCompact, nomeProprio, number } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { Candidato, CandidatoDetalhe, Cargo } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';

// ── Contagem regressiva ───────────────────────────────────────────────────────

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    done: diff === 0,
    dias: Math.floor(diff / 86_400_000),
    horas: Math.floor((diff % 86_400_000) / 3_600_000),
    minutos: Math.floor((diff % 3_600_000) / 60_000),
    segundos: Math.floor((diff % 60_000) / 1000),
  };
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <Box
      sx={(theme) => ({
        textAlign: 'center',
        minWidth: { xs: 64, sm: 78 },
        px: 1,
        py: 1.25,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: `1px solid ${theme.vars.palette.divider}`,
        boxShadow: `0 8px 24px -16px ${theme.alpha('#140E26', 0.4)}`,
      })}
    >
      <Typography
        sx={{ fontSize: { xs: '1.9rem', sm: '2.4rem' }, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', fontVariationSettings: "'ROND' 100" }}
        aria-hidden
      >
        {String(value).padStart(2, '0')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

// ── Duelo de dados ────────────────────────────────────────────────────────────

function sortearDupla(lista: Candidato[]): [string, string] | null {
  if (lista.length < 2) return null;
  const a = Math.floor(Math.random() * lista.length);
  let b = Math.floor(Math.random() * (lista.length - 1));
  if (b >= a) b += 1;
  return [lista[a].sq, lista[b].sq];
}

interface Metrica {
  label: string;
  hint?: string;
  value: (c: CandidatoDetalhe) => number | null;
  format: (v: number) => string;
}

const METRICAS: Metrica[] = [
  { label: 'Patrimônio declarado', hint: 'Soma dos bens declarados ao TSE em 2026 (autodeclarado)', value: (c) => (c.bens.length || c.declarou_bens ? c.bens_total : null), format: moneyCompact },
  { label: 'Arrecadação da campanha', hint: 'Receitas declaradas ao TSE até a data do arquivo (parcial)', value: (c) => c.receitas, format: moneyCompact },
  { label: 'Gastos contratados', hint: 'Despesas contratadas declaradas ao TSE (parcial)', value: (c) => c.despesas, format: moneyCompact },
  { label: 'Idade', value: (c) => c.idade, format: (v) => `${v} anos` },
  { label: 'Candidaturas anteriores', hint: 'Desde 2004, segundo o histórico do TSE', value: (c) => c.historico.length, format: (v) => number(v) },
];

/** One metric, two people: mirrored bars on a shared scale, value always written. Same color for both. */
function DuelRow({ m, a, b }: { m: Metrica; a: CandidatoDetalhe; b: CandidatoDetalhe }) {
  const va = m.value(a);
  const vb = m.value(b);
  const max = Math.max(va ?? 0, vb ?? 0, 1);
  const bar = (v: number | null, side: 'left' | 'right') => (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: side === 'left' ? 'row-reverse' : 'row', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box
        sx={(theme) => ({
          height: 12,
          width: `${((v ?? 0) / max) * 100}%`,
          minWidth: v ? 3 : 0,
          backgroundColor: SERIES.light,
          borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0',
          transition: 'width 600ms cubic-bezier(0.05, 0.7, 0.1, 1)',
          ...theme.applyStyles('dark', { backgroundColor: SERIES.dark }),
        })}
      />
      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {v == null ? 'Não informado' : m.format(v)}
      </Typography>
    </Box>
  );
  return (
    <Box sx={{ py: 1 }}>
      <Tooltip title={m.hint ?? ''} disableHoverListener={!m.hint}>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ textAlign: 'center', mb: 0.5, fontWeight: 600, letterSpacing: '0.02em' }}>
          {m.label}
        </Typography>
      </Tooltip>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        {bar(va, 'left')}
        <Box sx={{ width: 2, height: 18, bgcolor: 'divider', flexShrink: 0 }} />
        {bar(vb, 'right')}
      </Stack>
    </Box>
  );
}

function Lado({ c, lista, onChange, align }: { c: CandidatoDetalhe; lista: Candidato[]; onChange: (sq: string) => void; align: 'left' | 'right' }) {
  return (
    <Stack spacing={1} sx={{ alignItems: align === 'left' ? 'flex-start' : 'flex-end', textAlign: align, flex: 1, minWidth: 0 }}>
      <ButtonBase component={RouterLink} to={`/candidato/${c.sq}`} sx={{ borderRadius: 3 }} aria-label={`Ver perfil de ${nomeProprio(c.nome_urna)}`}>
        <CandidatePhoto src={c.foto} alt={`Foto de ${nomeProprio(c.nome_urna)}`} width={112} rounded={16} />
      </ButtonBase>
      <Box sx={{ minWidth: 0, maxWidth: '100%' }}>
        <Typography variant="h6" sx={{ lineHeight: 1.15 }}>
          {nomeProprio(c.nome_urna)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
            {c.numero}
          </Box>{' '}
          · {c.partido}
        </Typography>
      </Box>
      <FormControl size="small" sx={{ width: '100%', maxWidth: 220 }}>
        <Select value={c.sq} onChange={(e) => onChange(e.target.value)} inputProps={{ 'aria-label': `Trocar candidatura do lado ${align === 'left' ? 'esquerdo' : 'direito'}` }}>
          {lista.map((x) => (
            <MenuItem key={x.sq} value={x.sq}>
              {nomeProprio(x.nome_urna)} ({x.partido})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}

function DueloDeDados({ lista }: { lista: Candidato[] }) {
  const [par, setPar] = useState<[string, string] | null>(() => sortearDupla(lista));
  const key = par?.join(',') ?? '';
  const det = useAsync(() => (par ? Promise.all(par.map((sq) => data.candidato(sq))) : Promise.resolve(null)), [key]);
  const [a, b] = det.data ?? [];

  return (
    <Card
      sx={(theme) => ({
        borderRadius: 6,
        overflow: 'visible',
        background: `linear-gradient(180deg, ${theme.alpha(theme.vars.palette.primary.main, 0.06)}, transparent 40%), ${theme.vars.palette.background.paper}`,
      })}
    >
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="overline" color="primary">
              Duelo de dados · Presidência
            </Typography>
            <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '1.7rem', md: '2rem' } }}>
              Quem está na sua urna, lado a lado
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dupla sorteada ao acaso entre as {lista.length} candidaturas na urna. Troque os nomes como quiser.
            </Typography>
          </Box>
          <Button variant="tonal" startIcon={<CasinoRounded />} onClick={() => setPar(sortearDupla(lista))} sx={{ whiteSpace: 'nowrap', flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
            Sortear outra dupla
          </Button>
        </Stack>

        {!a || !b ? (
          <Skeleton variant="rounded" height={420} />
        ) : (
          <>
            <Stack direction="row" spacing={{ xs: 1, sm: 3 }} sx={{ alignItems: 'flex-start', mb: 2 }}>
              <Lado c={a} lista={lista.filter((x) => x.sq !== b.sq)} onChange={(sq) => setPar([sq, b.sq])} align="left" />
              <Typography sx={{ alignSelf: 'center', fontWeight: 800, fontSize: { xs: '1.2rem', sm: '1.6rem' }, color: 'text.disabled', px: { xs: 0, sm: 1 } }} aria-hidden>
                ×
              </Typography>
              <Lado c={b} lista={lista.filter((x) => x.sq !== a.sq)} onChange={(sq) => setPar([a.sq, sq])} align="right" />
            </Stack>
            <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
              {METRICAS.map((m) => (
                <DuelRow key={m.label} m={m} a={a} b={b} />
              ))}
              <Box sx={{ py: 1, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'start' }}>
                <Typography variant="body2" sx={{ textAlign: 'left' }}>
                  {a.mandato_atual ? `Mandato atual: ${a.mandato_atual}` : a.eleito_ultima ? `Eleito(a): ${a.eleito_ultima}` : 'Sem mandato no Congresso'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, pt: 0.25 }}>
                  Trajetória
                </Typography>
                <Typography variant="body2" sx={{ textAlign: 'right' }}>
                  {b.mandato_atual ? `Mandato atual: ${b.mandato_atual}` : b.eleito_ultima ? `Eleito(a): ${b.eleito_ultima}` : 'Sem mandato no Congresso'}
                </Typography>
              </Box>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1.5, mt: 2 }}>
              <SourceNote keys={['tse_candidatos', 'tse_bens', 'tse_prestacao', 'tse_historico']} note="valores de campanha parciais; patrimônio autodeclarado" />
              <Button component={RouterLink} to={`/comparar?c=${a.sq},${b.sq}`} variant="contained" endIcon={<CompareArrowsRounded />} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                Comparação completa
              </Button>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Todos os presidenciáveis num olhar ────────────────────────────────────────

type Ordem = 'nome' | 'bens' | 'receitas' | 'despesas';

const COLS: { key: Exclude<Ordem, 'nome'>; label: string; v: (c: Candidato) => number | null }[] = [
  { key: 'bens', label: 'Patrimônio', v: (c) => (c.declarou_bens || c.bens_total ? c.bens_total : null) },
  { key: 'receitas', label: 'Arrecadou', v: (c) => c.receitas },
  { key: 'despesas', label: 'Gastou', v: (c) => c.despesas },
];

function ColHeader({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={active}
      sx={{ justifyContent: 'flex-start', borderRadius: 1, px: 0.5, fontWeight: active ? 800 : 600, fontSize: '0.75rem', color: active ? 'primary.main' : 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}
    >
      {children}
    </ButtonBase>
  );
}

function VisaoGeral({ lista }: { lista: Candidato[] }) {
  const [ordem, setOrdem] = useState<Ordem>('nome');
  // No celular, uma métrica por vez (sem rolagem lateral).
  const compacto = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const [metricaCel, setMetricaCel] = useState<Exclude<Ordem, 'nome'>>('bens');
  const cols = compacto ? COLS.filter((c) => c.key === metricaCel) : COLS;
  const grid = compacto ? '1.6fr 1fr' : '2fr repeat(3, 1fr)';
  const max = Object.fromEntries(COLS.map((col) => [col.key, Math.max(1, ...lista.map((c) => col.v(c) ?? 0))]));
  const rows = useMemo(() => {
    const col = COLS.find((c) => c.key === ordem);
    return [...lista].sort((a, b) => (col ? (col.v(b) ?? -1) - (col.v(a) ?? -1) : 0) || a.nome_urna.localeCompare(b.nome_urna, 'pt-BR'));
  }, [lista, ordem]);

  return (
    <Card sx={{ borderRadius: 6 }}>
      <CardContent sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="overline" color="primary">
          Todos de uma vez
        </Typography>
        <Typography variant="h4" component="h2">
          As {lista.length} candidaturas à Presidência
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Em ordem alfabética. Toque no título de uma coluna para ordenar por ela; toque num nome para ver o perfil.
        </Typography>
        {compacto && (
          <ToggleButtonGroup exclusive size="small" value={metricaCel} onChange={(_, v) => v && setMetricaCel(v)} sx={{ mb: 1.5 }} aria-label="Métrica exibida">
            {COLS.map((c) => (
              <ToggleButton key={c.key} value={c.key}>
                {c.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <Box>
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: grid, gap: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
              <ColHeader active={ordem === 'nome'} onClick={() => setOrdem('nome')}>
                Candidatura {ordem === 'nome' ? '↓ A–Z' : ''}
              </ColHeader>
              {cols.map((c) => (
                <ColHeader key={c.key} active={ordem === c.key} onClick={() => setOrdem(c.key)}>
                  {c.label} {ordem === c.key ? '↓' : ''}
                </ColHeader>
              ))}
            </Box>
            {rows.map((c) => (
              <Box
                key={c.sq}
                component={RouterLink}
                to={`/candidato/${c.sq}`}
                sx={{ display: 'grid', gridTemplateColumns: grid, gap: 2, alignItems: 'center', py: 0.75, borderBottom: 1, borderColor: 'divider', textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <CandidatePhoto src={c.foto} alt="" width={34} rounded={8} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {nomeProprio(c.nome_urna)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.numero} · {c.partido}
                    </Typography>
                  </Box>
                </Stack>
                {cols.map((col) => {
                  const v = col.v(c);
                  return (
                    <Box key={col.key} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {v == null ? '—' : moneyCompact(v)}
                      </Typography>
                      <Box
                        sx={(theme) => ({
                          height: 6,
                          mt: 0.25,
                          width: `${((v ?? 0) / max[col.key]) * 100}%`,
                          minWidth: v ? 2 : 0,
                          borderRadius: '0 3px 3px 0',
                          backgroundColor: SERIES.light,
                          ...theme.applyStyles('dark', { backgroundColor: SERIES.dark }),
                        })}
                      />
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
        <SourceNote keys={['tse_candidatos', 'tse_bens', 'tse_prestacao', 'tse_fotos']} sx={{ mt: 2 }} note="“—” = não declarou ou sem registro" />
      </CardContent>
    </Card>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

const ATALHOS = [
  { to: '/pesquisas', icon: PollRounded, title: 'Pesquisas registradas', text: 'Resultados de pesquisas com registro no TSE.' },
  { to: '/cola', icon: ListAltRounded, title: 'Monte sua cola', text: 'Seus números na ordem da urna, para imprimir.' },
  { to: '/simulador', icon: TouchAppRounded, title: 'Treine na urna', text: 'Simulador com as fotos e números reais.' },
  { to: '/gastos', icon: ReceiptLongRounded, title: 'Gastos de mandato', text: 'Cota de deputados e senadores desde 2023.' },
];

const VOTOS: { cargo: Cargo; label: string }[] = [
  { cargo: 'deputado-federal', label: 'Dep. federal' },
  { cargo: 'deputado-estadual', label: 'Dep. estadual' },
  { cargo: 'senador', label: 'Senado 1' },
  { cargo: 'senador', label: 'Senado 2' },
  { cargo: 'governador', label: 'Governo' },
  { cargo: 'presidente', label: 'Presidência' },
];

export function HomePage() {
  const { meta } = useMeta();
  const navigate = useNavigate();
  const presidente = useAsync(() => data.presidente(), []);
  const segundo = meta?.eleicao.fase === 'pre-2turno' || meta?.eleicao.fase === 'apuracao-2turno';
  const alvo = new Date(`${segundo ? meta?.eleicao.data_2turno : '2026-10-04'}T08:00:00-03:00`);
  const cd = useCountdown(alvo);
  const naUrna = (presidente.data?.candidatos ?? []).filter((c) => c.na_urna);
  const names = Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome]));

  return (
    <Stack spacing={{ xs: 4, md: 6 }}>
      {/* Comparação primeiro; contagem, ordem dos votos e busca ao lado (telas grandes) ou abaixo */}
      <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          {presidente.loading ? <Skeleton variant="rounded" height={620} /> : naUrna.length >= 2 && <DueloDeDados lista={naUrna} />}
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Box
            sx={(theme) => ({
              borderRadius: 6,
              p: { xs: 2.5, md: 3 },
              border: `1px solid ${theme.vars.palette.divider}`,
              background: `radial-gradient(120% 120% at 0% 0%, ${theme.alpha(theme.vars.palette.lime.main, 0.24)} 0%, transparent 60%), radial-gradient(120% 120% at 100% 100%, ${theme.alpha('#7649CF', 0.2)} 0%, transparent 60%), ${theme.vars.palette.background.paper}`,
            })}
          >
            <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <Box>
                <Typography variant="overline" color="primary">
                  {segundo ? `2º turno · ${dateLong(meta!.eleicao.data_2turno)}` : 'Eleições 2026 · 1º turno em 4 de outubro'}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary">
                  {cd.done ? 'A votação já começou ou terminou' : 'Faltam para a abertura das urnas (8h de Brasília)'}
                </Typography>
              </Box>
              {!cd.done && (
                <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} role="timer" aria-label={`Faltam ${cd.dias} dias, ${cd.horas} horas e ${cd.minutos} minutos`}>
                  <CountUnit value={cd.dias} label={cd.dias === 1 ? 'dia' : 'dias'} />
                  <CountUnit value={cd.horas} label="horas" />
                  <CountUnit value={cd.minutos} label="min" />
                  <CountUnit value={cd.segundos} label="seg" />
                </Stack>
              )}
              <Box sx={{ width: '100%' }}>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.75, fontWeight: 600 }}>
                  A ordem dos 6 votos na urna
                </Typography>
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 0.75 }} aria-label="Ordem dos seis votos na urna">
                  {VOTOS.map((v, i) => (
                    <Box key={v.label} sx={{ px: 1, py: 0.5, borderRadius: 2, bgcolor: 'background.subtle', border: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {i + 1}. {v.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {' '}
                        · {DIGITOS[v.cargo]} díg.
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
                  Os dois votos para o Senado devem ir para pessoas diferentes.
                </Typography>
              </Box>
              <Box sx={{ width: '100%', textAlign: 'left' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'center' }}>
                  Patrimônio, campanha e trajetória de todas as candidaturas, com dados oficiais. Sem opinião e sem
                  recomendação de voto.
                </Typography>
                <CandidateSearch onPick={(sq) => void navigate(`/candidato/${sq}`)} placeholder="Busque por nome ou número" />
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>

      {/* Mapa */}
      <Card sx={{ borderRadius: 6 }}>
        <CardContent sx={{ p: { xs: 2, md: 4 } }}>
          <Grid container spacing={3} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="overline" color="primary">
                Governo, Senado e deputados
              </Typography>
              <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
                Toque no seu estado
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Veja todas as candidaturas a governador(a), às duas vagas do Senado e a deputado(a) federal e estadual de
                onde você vota.
              </Typography>
              {meta && (
                <Typography variant="body2" color="text.secondary">
                  {number(['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual', 'deputado-distrital'].reduce((s, k) => s + (meta.totais[k as Cargo] ?? 0), 0))}{' '}
                  candidaturas na urna em todo o país.
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <BrazilMap onSelect={(uf) => void navigate(`/eleicao/${uf}`)} names={names} width={540} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Visão geral */}
      {naUrna.length > 0 && <VisaoGeral lista={naUrna} />}

      {/* Atalhos */}
      <Grid container spacing={2}>
        {ATALHOS.map((f) => (
          <Grid key={f.to} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ height: '100%', borderRadius: 4, '&:hover': { borderColor: 'primary.light' } }}>
              <CardActionArea component={RouterLink} to={f.to} sx={{ height: '100%', alignItems: 'flex-start' }}>
                <CardContent>
                  <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'primary.container', color: 'primary.onContainer', mb: 1.5 }}>
                    <f.icon />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.text}
                  </Typography>
                  <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Abrir <ArrowForwardRounded fontSize="small" />
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
