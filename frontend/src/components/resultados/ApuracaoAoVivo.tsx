import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import FilterListRounded from '@mui/icons-material/FilterListRounded';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import PublicRounded from '@mui/icons-material/PublicRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { CATEGORICAL, SERIES } from '@/components/charts/palette';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CandidateSearch, type OpcaoBusca } from '@/components/election/CandidateSearch';
import { BrazilMap } from '@/components/election/UfTileMap';
import {
  CARGO_APURACAO_LABEL,
  cargoEstadual,
  eleitosDe,
  finalistasDe,
  foiEleito,
  isCargoApuracao,
  isProporcional,
  temSegundoTurno,
  TSE_RESULTADOS,
  type Apuracao,
  type CandidatoApurado,
  type CargoApuracao,
  type Turno,
} from '@/data/apuracao';
import { inicioDivulgacao, TURNOS, turnoMaisRecente } from '@/data/calendario';
import { dateLong, nomeProprio, normalize } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import {
  INTERVALO_MS,
  useAcompanhar,
  useApuracaoDoTurno,
  useMapaApuracao,
  useUfUsuario,
  type Acompanhado,
  type StatusLocal,
} from './hooks';
import { CartaoEleitos } from './CartaoEleitos';

// ── Formatação ────────────────────────────────────────────────────────────────

const int = new Intl.NumberFormat('pt-BR');
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const votos = (n: number) => int.format(n);
const pct = (n: number) => `${pctFmt.format(n)}%`;

/** "04/10/2026 18:32:24" → "04/10 às 18:32". */
function horaTse(s: string) {
  const m = /^(\d{2})\/(\d{2})\/\d{4}\s+(\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}/${m[2]} às ${m[3]}:${m[4]}` : s;
}

const UF_NOME_FALLBACK: Record<string, string> = { BR: 'Brasil' };

/** Cargos na ordem da urna (de baixo para cima no papel; Presidente primeiro aqui, por padrão). */
const CARGOS: CargoApuracao[] = ['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual'];

const filtroBusca = (o: OpcaoBusca) => isCargoApuracao(o.cargo);

// ── Cores do mapa (paleta neutra validada; nada de cor de partido) ───────────

function useDark() {
  const { mode, systemMode } = useColorScheme();
  return (mode === 'system' ? systemMode : mode) === 'dark';
}

const NEUTRO = { light: '#DDD7EA', dark: '#3D3456' };
const VAZIO = { light: '#F0EDF6', dark: '#2A2340' };

interface Legenda {
  cor: string;
  rotulo: string;
  n: number;
}

function SituacaoChip({ c }: { c: CandidatoApurado }) {
  const chips: ReactNode[] = [];
  if (c.situacao) {
    const eleito = c.eleito || /^eleit/i.test(c.situacao);
    chips.push(
      <Chip
        key="st"
        size="small"
        label={c.situacao}
        color={eleito ? 'success' : /2º turno/i.test(c.situacao) ? 'warning' : 'default'}
        icon={eleito ? <VerifiedRounded /> : undefined}
        sx={{ height: 22, fontWeight: 700 }}
      />,
    );
  }
  if (c.destinacao && !/^válido/i.test(c.destinacao)) {
    chips.push(
      <Tooltip key="dv" title="Situação do registro na Justiça Eleitoral, como publicada pelo TSE. Votos sub judice podem ser validados ou anulados depois.">
        <Chip size="small" variant="outlined" label={c.destinacao} sx={{ height: 22 }} />
      </Tooltip>,
    );
  }
  return chips.length ? <>{chips}</> : null;
}

// ── Linhas de resultado ───────────────────────────────────────────────────────

function Barra({ valor }: { valor: number }) {
  return (
    <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'background.subtle', overflow: 'hidden' }}>
      <Box
        sx={(theme) => ({
          height: '100%',
          width: `${Math.min(100, Math.max(0, valor))}%`,
          minWidth: valor > 0 ? 3 : 0,
          borderRadius: 4,
          backgroundColor: SERIES.light,
          transition: 'width 700ms cubic-bezier(0.05, 0.7, 0.1, 1)',
          ...theme.applyStyles('dark', { backgroundColor: SERIES.dark }),
        })}
      />
    </Box>
  );
}

function Posicao({ n }: { n: number }) {
  return (
    <Box
      aria-label={`${n}º lugar`}
      sx={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: 'background.subtle', border: 1, borderColor: 'divider', fontWeight: 800, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}
    >
      {n || '–'}
    </Box>
  );
}

function LinhaMajoritaria({ c, destaque, seguindo, onSeguir }: { c: CandidatoApurado; destaque: boolean; seguindo: boolean; onSeguir: () => void }) {
  return (
    <Box
      id={`res-${c.sq}`}
      sx={(theme) => ({
        py: 1.25,
        px: { xs: 1, sm: 1.5 },
        borderBottom: 1,
        borderColor: 'divider',
        borderRadius: destaque ? 3 : 0,
        scrollMarginTop: 120,
        ...(foiEleito(c) && { boxShadow: `inset 4px 0 0 ${theme.vars.palette.success.main}`, bgcolor: theme.alpha(theme.vars.palette.success.main, 0.07) }),
        ...(destaque && { outline: `2px solid ${theme.vars.palette.primary.main}`, bgcolor: theme.alpha(theme.vars.palette.primary.main, 0.06), borderColor: 'transparent' }),
      })}
    >
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} sx={{ alignItems: 'center' }}>
        <Posicao n={c.posicao} />
        <Box component={RouterLink} to={`/candidato/${c.sq}`} sx={{ flexShrink: 0 }} aria-label={`Perfil de ${nomeProprio(c.nomeUrna)}`}>
          <CandidatePhoto src={`/fotos/${c.sq}.jpg`} alt="" width={44} rounded={10} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography component={RouterLink} to={`/candidato/${c.sq}`} variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {nomeProprio(c.nomeUrna)}
            </Typography>
            <SituacaoChip c={c} />
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
              {c.numero}
            </Box>{' '}
            · {c.partido}
            {c.vices.length ? ` · vice: ${c.vices.map(nomeProprio).join(', ')}` : ''}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.25rem' }, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{pct(c.pct)}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {votos(c.votos)} votos
          </Typography>
        </Box>
        <Tooltip title={seguindo ? 'Parar de acompanhar' : 'Acompanhar esta candidatura'}>
          <IconButton size="small" onClick={onSeguir} aria-pressed={seguindo} aria-label={seguindo ? `Parar de acompanhar ${nomeProprio(c.nomeUrna)}` : `Acompanhar ${nomeProprio(c.nomeUrna)}`} sx={{ ml: -0.5 }}>
            {seguindo ? <StarRounded color="primary" fontSize="small" /> : <StarBorderRounded fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ mt: 1, pl: { xs: 0, sm: '84px' } }}>
        <Barra valor={c.pct} />
      </Box>
    </Box>
  );
}

function LinhaProporcional({ c, destaque, seguindo, onSeguir }: { c: CandidatoApurado; destaque: boolean; seguindo: boolean; onSeguir: () => void }) {
  return (
    <Box
      id={`res-${c.sq}`}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.75,
        px: 1,
        borderBottom: 1,
        borderColor: 'divider',
        scrollMarginTop: 120,
        borderRadius: destaque ? 2 : 0,
        ...(foiEleito(c) && { boxShadow: `inset 4px 0 0 ${theme.vars.palette.success.main}`, bgcolor: theme.alpha(theme.vars.palette.success.main, 0.06) }),
        ...(destaque && { outline: `2px solid ${theme.vars.palette.primary.main}`, bgcolor: theme.alpha(theme.vars.palette.primary.main, 0.06) }),
      })}
    >
      <Typography variant="caption" sx={{ width: 34, textAlign: 'right', flexShrink: 0, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {c.posicao || '–'}º
      </Typography>
      <CandidatePhoto src={`/fotos/${c.sq}.jpg`} alt="" width={30} rounded={6} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography component={RouterLink} to={`/candidato/${c.sq}`} variant="body2" sx={{ fontWeight: 700, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            {nomeProprio(c.nomeUrna)}
          </Typography>
          <SituacaoChip c={c} />
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div" noWrap>
          <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
            {c.numero}
          </Box>{' '}
          · {c.partido}
          {c.agremiacao ? ` · ${c.agremiacao}` : ''}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {votos(c.votos)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {pct(c.pct)}
        </Typography>
      </Box>
      <IconButton size="small" onClick={onSeguir} aria-pressed={seguindo} aria-label={seguindo ? `Parar de acompanhar ${nomeProprio(c.nomeUrna)}` : `Acompanhar ${nomeProprio(c.nomeUrna)}`}>
        {seguindo ? <StarRounded color="primary" fontSize="small" /> : <StarBorderRounded fontSize="small" />}
      </IconButton>
    </Box>
  );
}

// ── Totais ────────────────────────────────────────────────────────────────────

function Totais({ ap }: { ap: Apuracao }) {
  const itens: [string, string][] = [
    ['Comparecimento', `${votos(ap.eleitorado.comparecimento)} (${pct(ap.eleitorado.pctComparecimento)})`],
    ['Abstenções', `${votos(ap.eleitorado.abstencao)} (${pct(ap.eleitorado.pctAbstencao)})`],
    ['Votos válidos', votos(ap.votos.validos)],
    ['Brancos', `${votos(ap.votos.brancos)} (${pct(ap.votos.pctBrancos)})`],
    ['Nulos', `${votos(ap.votos.nulos)} (${pct(ap.votos.pctNulos)})`],
    ['Eleitorado', votos(ap.eleitorado.total)],
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
      {itens.map(([k, v]) => (
        <Box key={k} sx={{ p: 1.25, borderRight: 1, borderBottom: 1, borderColor: 'divider', mr: '-1px', mb: '-1px' }}>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 600 }}>
            {k}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {v}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Acompanhando ──────────────────────────────────────────────────────────────

function CartaoAcompanhado({ a, turno, onAbrir, onRemover }: { a: Acompanhado; turno: Turno; onAbrir: () => void; onRemover: () => void }) {
  const r = useApuracaoDoTurno(turno, a.cargo, a.uf);
  const c = r.data?.candidatos.find((x) => x.sq === a.sq);
  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        minWidth: 210,
        maxWidth: 260,
        flexShrink: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        scrollSnapAlign: 'start',
        ...(c && foiEleito(c) && { border: `2px solid ${theme.vars.palette.success.main}`, bgcolor: theme.alpha(theme.vars.palette.success.main, 0.08) }),
      })}
    >
      <Box component="button" onClick={onAbrir} sx={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 1, p: 1.25, pr: 4, width: '100%', boxSizing: 'border-box', borderRadius: 3, '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main' } }}>
        <CandidatePhoto src={`/fotos/${a.sq}.jpg`} alt="" width={40} rounded={8} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
            {nomeProprio(a.nome)}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {CARGO_APURACAO_LABEL[a.cargo]} · {a.uf === 'BR' ? 'Brasil' : a.uf}
          </Typography>
          {r.loading ? (
            <Skeleton width={110} />
          ) : c ? (
            <Typography variant="caption" component="div" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {c.posicao}º · {pct(c.pct)} · {votos(c.votos)} votos
              {c.situacao ? (
                <Box component="span" sx={{ color: foiEleito(c) ? 'success.main' : 'inherit', fontWeight: 800 }}>
                  {' '}
                  · {foiEleito(c) ? '✓ ' : ''}
                  {c.situacao}
                </Box>
              ) : (
                ''
              )}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" component="div">
              Aguardando o TSE
            </Typography>
          )}
        </Box>
      </Box>
      <IconButton size="small" onClick={onRemover} aria-label={`Parar de acompanhar ${nomeProprio(a.nome)}`} sx={{ position: 'absolute', top: 4, right: 4 }}>
        <CloseRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}

// ── Localização ───────────────────────────────────────────────────────────────

const STATUS_TEXTO: Record<StatusLocal, string | null> = {
  ocioso: null,
  buscando: 'Descobrindo seu estado pela localização…',
  negado: 'A localização não foi permitida. Escolha seu estado na lista ou no mapa.',
  indisponivel: 'Não foi possível obter a localização deste aparelho. Escolha seu estado na lista ou no mapa.',
  fora: 'Você parece estar fora do Brasil (no exterior, vota-se só para Presidente). Escolha um estado para ver os demais cargos.',
};

function BarraLocal({ ufUsuario, nomes, onEscolher, onDetectar, status, origem }: { ufUsuario: string | null; nomes: Record<string, string>; onEscolher: (uf: string) => void; onDetectar: () => void; status: StatusLocal; origem: string | null }) {
  const ufs = Object.keys(nomes).filter((u) => u !== 'BR').sort((a, b) => nomes[a].localeCompare(nomes[b], 'pt-BR'));
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <PlaceRounded color="primary" fontSize="small" />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="uf-usuario">Seu estado</InputLabel>
          <Select labelId="uf-usuario" label="Seu estado" value={ufUsuario ?? ''} onChange={(e) => onEscolher(e.target.value)}>
            {ufs.map((u) => (
              <MenuItem key={u} value={u}>
                {nomes[u]} ({u})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button size="small" variant="text" onClick={onDetectar} startIcon={status === 'buscando' ? <CircularProgress size={16} /> : <MyLocationRounded />} disabled={status === 'buscando'}>
          Usar minha localização
        </Button>
      </Stack>
      {(STATUS_TEXTO[status] || origem === 'gps') && (
        <Typography variant="caption" color="text.secondary" aria-live="polite">
          {STATUS_TEXTO[status] ?? 'Estado detectado pela localização do aparelho. A posição é usada só aqui, no aparelho, e não é enviada a ninguém.'}
        </Typography>
      )}
    </Stack>
  );
}

// ── Painel ────────────────────────────────────────────────────────────────────

const PAGINA = 30;

/**
 * Apuração ao vivo (dados do TSE lidos no navegador): mapa interativo, os cinco cargos,
 * 1º e 2º turnos, estado do eleitor detectado pela localização e busca por candidatura.
 * Estado da tela na URL (?cargo=&uf=&local=&t=&c=), para compartilhar o link.
 */
export function ApuracaoAoVivo({ headingLevel = 'h2' }: { headingLevel?: 'h1' | 'h2' }) {
  const { meta } = useMeta();
  const [params, setParams] = useSearchParams();
  const local = useUfUsuario({ detectarSozinho: true });
  const acompanhar = useAcompanhar();
  const dark = useDark();
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const nomes = useMemo(() => ({ ...UF_NOME_FALLBACK, ...Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome])) }), [meta]);
  const nomeUf = (uf: string) => nomes[uf] ?? uf;

  // Estado da tela (URL)
  const pTurno = params.get('t');
  const turno: Turno = pTurno === '2' ? 2 : pTurno === '1' ? 1 : (turnoMaisRecente(agora) ?? 1);
  const pCargo = params.get('cargo');
  const cargoBase: CargoApuracao = isCargoApuracao(pCargo) ? (pCargo === 'deputado-distrital' ? 'deputado-estadual' : pCargo) : 'presidente';
  const ufVista = (params.get('uf') ?? local.uf ?? '').toUpperCase() || null;
  const localPres = (params.get('local') ?? 'BR').toUpperCase();
  const destaque = params.get('c');

  const cargo: CargoApuracao = cargoBase === 'deputado-estadual' ? cargoEstadual(ufVista ?? '') : cargoBase;
  const ufConsulta = cargo === 'presidente' ? localPres : ufVista;

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true, preventScrollReset: true },
    );

  const r = useApuracaoDoTurno(turno, cargo, ufConsulta);
  const ap = r.data;

  // Mapa
  const turnoMapa: Turno = temSegundoTurno(cargo) ? turno : 1;
  const mapa = useMapaApuracao(turnoMapa, cargoBase, true);
  const { fills, labels, legenda, values } = useMemo(() => {
    const fills: Record<string, string> = {};
    const labels: Record<string, string> = {};
    const values: Record<string, number> = {};
    const legenda: Legenda[] = [];
    const cat = dark ? CATEGORICAL.dark : CATEGORICAL.light;
    const neutro = dark ? NEUTRO.dark : NEUTRO.light;
    const vazio = dark ? VAZIO.dark : VAZIO.light;
    const entradas = Object.entries(mapa);
    if (cargoBase === 'presidente') {
      // Cor = quem lidera na UF. Ordem das cores: alfabética pelo nome na urna (neutra).
      const lideres = new Map<string, string>();
      for (const [, a] of entradas) {
        const l = a?.candidatos[0];
        if (l && l.votos > 0) lideres.set(l.sq, l.nomeUrna);
      }
      const ordem = [...lideres.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
      const corDe = new Map(ordem.map(([sq], i) => [sq, cat[i] ?? neutro]));
      const conta = new Map<string, number>();
      for (const [uf, a] of entradas) {
        const l = a?.candidatos[0];
        if (!a || !l || l.votos <= 0) {
          fills[uf] = vazio;
          labels[uf] = `${nomeUf(uf)}: aguardando o TSE`;
          continue;
        }
        fills[uf] = corDe.get(l.sq) ?? neutro;
        conta.set(l.sq, (conta.get(l.sq) ?? 0) + 1);
        labels[uf] = `${nomeUf(uf)}: ${nomeProprio(l.nomeUrna)} lidera com ${pct(l.pct)} · ${pct(a.secoes.pct)} das seções apuradas`;
      }
      ordem.forEach(([sq, nome], i) => legenda.push({ cor: cat[i] ?? neutro, rotulo: i < cat.length ? nomeProprio(nome) : 'Outras candidaturas', n: conta.get(sq) ?? 0 }));
      // agrupa "outras" numa linha só
      const outras = legenda.filter((l) => l.rotulo === 'Outras candidaturas');
      if (outras.length > 1) {
        legenda.splice(cat.length);
        legenda.push({ cor: neutro, rotulo: 'Outras candidaturas', n: outras.reduce((s, l) => s + l.n, 0) });
      }
    } else if (cargoBase === 'governador') {
      // Cor = situação da disputa (eleito, 2º turno, em apuração); líder no texto.
      const cats = [
        { k: 'eleito', cor: cat[2], rotulo: turnoMapa === 2 ? 'Eleito(a) no 2º turno' : 'Eleito(a) no 1º turno' },
        { k: '2t', cor: cat[1], rotulo: 'Vai ao 2º turno' },
        // Parcial, só no 1º turno: a regra do 2º turno é objetiva (mais de 50% dos válidos).
        { k: 'mais50', cor: dark ? '#1D5E47' : '#A6DEC6', rotulo: 'Parcial: líder com mais de 50% dos válidos' },
        { k: 'menos50', cor: dark ? '#7A3A1F' : '#F7BFA5', rotulo: 'Parcial: ninguém com mais de 50%' },
        { k: 'apur', cor: neutro, rotulo: 'Em apuração' },
        { k: 'sem', cor: vazio, rotulo: turnoMapa === 2 ? 'Sem 2º turno' : 'Aguardando o TSE' },
      ];
      const conta: Record<string, number> = {};
      for (const [uf, a] of entradas) {
        const l = a?.candidatos[0];
        const k =
          !a || !l
            ? 'sem'
            : a.candidatos.some((c) => c.eleito)
              ? 'eleito'
              : a.candidatos.some((c) => /2º turno/i.test(c.situacao ?? ''))
                ? '2t'
                : turnoMapa === 1 && l.votos > 0
                  ? l.pct > 50
                    ? 'mais50'
                    : 'menos50'
                  : 'apur';
        conta[k] = (conta[k] ?? 0) + 1;
        fills[uf] = cats.find((c) => c.k === k)!.cor;
        labels[uf] = !a || !l ? `${nomeUf(uf)}: ${turnoMapa === 2 ? 'sem 2º turno ou aguardando o TSE' : 'aguardando o TSE'}` : `${nomeUf(uf)}: ${nomeProprio(l.nomeUrna)} (${l.partido}) à frente com ${pct(l.pct)} · ${pct(a.secoes.pct)} das seções`;
      }
      for (const c of cats) if (conta[c.k]) legenda.push({ cor: c.cor, rotulo: c.rotulo, n: conta[c.k] });
    } else {
      // Senado e deputados: intensidade = % das seções apuradas.
      for (const [uf, a] of entradas) {
        if (!a) continue;
        values[uf] = a.secoes.pct;
        const l = a.candidatos[0];
        labels[uf] = `${nomeUf(uf)}: ${pct(a.secoes.pct)} das seções apuradas${l ? ` · mais votado(a): ${nomeProprio(l.nomeUrna)}` : ''}`;
      }
    }
    return { fills, labels, legenda, values };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, cargoBase, dark, turnoMapa, nomes]);

  // Lista
  const [ordem, setOrdem] = useState<'oficial' | 'az'>('oficial');
  const [filtro, setFiltro] = useState('');
  const [soEleitos, setSoEleitos] = useState(false);
  const [limite, setLimite] = useState(PAGINA);
  const prop = isProporcional(cargo);
  const lista = useMemo(() => {
    let l = ap?.candidatos ?? [];
    const q = normalize(filtro);
    if (q) l = l.filter((c) => normalize(`${c.nomeUrna} ${c.nome} ${c.numero} ${c.partido}`).includes(q));
    if (soEleitos) l = l.filter((c) => c.eleito || /^eleit/i.test(c.situacao ?? ''));
    if (ordem === 'az') l = [...l].sort((a, b) => a.nomeUrna.localeCompare(b.nomeUrna, 'pt-BR'));
    return l;
  }, [ap, filtro, soEleitos, ordem]);
  const idxDestaque = destaque ? lista.findIndex((c) => c.sq === destaque) : -1;
  const visiveis = prop ? lista.slice(0, Math.max(limite, idxDestaque + 1)) : lista;
  const candDestaque = destaque ? ap?.candidatos.find((c) => c.sq === destaque) : undefined;

  // Rola até a candidatura escolhida na busca, uma vez por escolha.
  const rolou = useRef<string | null>(null);
  useEffect(() => {
    if (!destaque || rolou.current === destaque || !candDestaque) return;
    rolou.current = destaque;
    requestAnimationFrame(() => document.getElementById(`res-${destaque}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [destaque, candDestaque]);

  const trocarCargo = (c: CargoApuracao) => {
    setFiltro('');
    setSoEleitos(false);
    setLimite(PAGINA);
    set({ cargo: c === 'presidente' ? null : c, c: null });
  };

  const escolherBusca = (sq: string, o: OpcaoBusca) => {
    if (!isCargoApuracao(o.cargo)) return;
    const c = o.cargo;
    setFiltro('');
    setSoEleitos(false);
    rolou.current = null;
    acompanhar.adicionar({ sq, cargo: c, uf: o.uf, nome: o.nomeUrna, numero: o.numero, partido: o.partido });
    set({ cargo: c === 'presidente' ? null : c, uf: c === 'presidente' ? (params.get('uf') ?? null) : o.uf, local: c === 'presidente' ? null : params.get('local'), c: sq });
  };

  const abrirAcompanhado = (a: Acompanhado) => {
    rolou.current = null;
    set({ cargo: a.cargo === 'presidente' ? null : a.cargo, uf: a.cargo === 'presidente' ? (params.get('uf') ?? null) : a.uf, local: a.cargo === 'presidente' ? null : params.get('local'), c: a.sq });
  };

  const seguir = (c: CandidatoApurado) =>
    acompanhar.tem(c.sq)
      ? acompanhar.remover(c.sq)
      : acompanhar.adicionar({ sq: c.sq, cargo, uf: cargo === 'presidente' ? 'BR' : (ufConsulta ?? ''), nome: c.nomeUrna, numero: c.numero, partido: c.partido });

  const clicarMapa = (uf: string) => {
    if (cargo === 'presidente') set({ local: localPres === uf ? null : uf, c: null });
    else set({ uf, c: null });
    setLimite(PAGINA);
  };

  const H = headingLevel;
  const t2liberado = agora >= inicioDivulgacao(2);
  const antesDaDivulgacao = agora < inicioDivulgacao(turno);
  const ufDoCargo = cargo === 'presidente' ? localPres : ufVista;
  const tituloDisputa = `${CARGO_APURACAO_LABEL[cargo]}${ufDoCargo ? ` · ${ufDoCargo === 'BR' ? 'Brasil' : nomeUf(ufDoCargo)}` : ''}`;

  let aviso: ReactNode = null;
  if (r.caiuPara1 && ap) {
    if (!temSegundoTurno(cargo)) aviso = 'Senado e deputados são decididos sempre no 1º turno. Abaixo, o resultado do 1º turno.';
    else if (!t2liberado) aviso = `A divulgação do 2º turno começa às 17h (Brasília) de ${dateLong(TURNOS[1].data)}. Abaixo, o resultado do 1º turno.`;
    else if (ap.candidatos.some((c) => /2º turno/i.test(c.situacao ?? ''))) aviso = 'O TSE ainda não publicou o 2º turno desta disputa. A página consulta de novo a cada minuto. Abaixo, o 1º turno.';
    else aviso = `Não há 2º turno para ${CARGO_APURACAO_LABEL[cargo]} ${ufDoCargo === 'BR' ? 'no Brasil' : `em ${nomeUf(ufDoCargo ?? '')}`} (ou o TSE ainda não publicou). Abaixo, o 1º turno.`;
  }

  return (
    <Card sx={{ borderRadius: 6 }}>
      <CardContent sx={{ p: { xs: 2, md: 3.5 } }}>
        {/* Cabeçalho */}
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { md: 'flex-end' }, gap: 2, mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {ap && !ap.final && (
                <Box
                  aria-hidden
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    '@keyframes pulsa': { '0%': { boxShadow: '0 0 0 0 rgba(220,38,38,.55)' }, '100%': { boxShadow: '0 0 0 10px rgba(220,38,38,0)' } },
                    animation: 'pulsa 1.6s infinite',
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  }}
                />
              )}
              <Typography variant="overline" color="primary">
                {ap?.final ? 'Resultado final · TSE' : 'Apuração ao vivo · dados oficiais do TSE'}
              </Typography>
            </Stack>
            <Typography variant="h3" component={H} sx={{ fontSize: { xs: '1.7rem', md: '2.1rem' } }}>
              Resultados das Eleições 2026
            </Typography>
          </Box>
          <ToggleButtonGroup exclusive value={turno} onChange={(_, v: Turno | null) => v && set({ t: String(v), c: null })} aria-label="Turno" color="primary" sx={{ alignSelf: { xs: 'stretch', md: 'auto' } }}>
            {TURNOS.map((t) => (
              <ToggleButton key={t.turno} value={t.turno} sx={{ flex: { xs: 1, md: 'none' }, px: 2.5, fontWeight: 700 }}>
                {t.turno}º turno
                <Typography component="span" variant="caption" sx={{ ml: 0.75, opacity: 0.7, display: { xs: 'none', sm: 'inline' } }}>
                  {t.data.slice(8, 10)}/{t.data.slice(5, 7)}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {/* Seu estado + busca */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <BarraLocal ufUsuario={local.uf} nomes={nomes} onEscolher={(uf) => { local.escolher(uf); set({ uf: null, c: null }); }} onDetectar={() => { local.detectar(); set({ uf: null }); }} status={local.status} origem={local.origem} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <CandidateSearch onPick={escolherBusca} filter={filtroBusca} size="small" placeholder="Ache sua candidatura: nome ou número" />
            <Typography variant="caption" color="text.secondary">
              Qualquer cargo e estado. A candidatura fica marcada com ★ para você acompanhar.
            </Typography>
          </Grid>
        </Grid>

        {/* Acompanhando */}
        {acompanhar.lista.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 700, mb: 0.75 }}>
              ★ Acompanhando (fica só neste aparelho)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, scrollSnapType: 'x mandatory' }}>
              {acompanhar.lista.map((a) => (
                <CartaoAcompanhado key={a.sq} a={a} turno={turno} onAbrir={() => abrirAcompanhado(a)} onRemover={() => acompanhar.remover(a.sq)} />
              ))}
            </Stack>
          </Box>
        )}

        {/* Cargos */}
        <Tabs value={cargoBase} onChange={(_, v: CargoApuracao) => trocarCargo(v)} variant="scrollable" allowScrollButtonsMobile aria-label="Cargo" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
          {CARGOS.map((c) => {
            const real = c === 'deputado-estadual' ? cargoEstadual(ufVista ?? '') : c;
            return <Tab key={c} value={c} label={`${CARGO_APURACAO_LABEL[real]}${c !== 'presidente' && ufVista ? ` · ${ufVista}` : ''}`} sx={{ fontWeight: 700 }} />;
          })}
        </Tabs>

        <Grid container spacing={3}>
          {/* Resultado */}
          <Grid size={{ xs: 12, md: 7 }} sx={{ order: { xs: 1, md: 2 } }}>
            <Stack spacing={2}>
              <Stack direction="row" useFlexGap sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" component={H === 'h1' ? 'h2' : 'h3'}>
                  {tituloDisputa}
                  {ap && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {r.turnoExibido}º turno{ap.vagas > 1 ? ` · ${ap.vagas} vagas` : ''}
                    </Typography>
                  )}
                </Typography>
                {cargo === 'presidente' && (
                  <ToggleButtonGroup size="small" exclusive value={localPres === 'BR' ? 'BR' : 'UF'} aria-label="Abrangência" onChange={(_, v) => v && set({ local: v === 'BR' ? null : (ufVista ?? null), c: null })}>
                    <ToggleButton value="BR" sx={{ px: 1.5 }}>
                      <PublicRounded fontSize="small" sx={{ mr: 0.5 }} /> Brasil
                    </ToggleButton>
                    <ToggleButton value="UF" disabled={!ufVista && localPres === 'BR'} sx={{ px: 1.5 }}>
                      <PlaceRounded fontSize="small" sx={{ mr: 0.5 }} /> {localPres !== 'BR' ? localPres : (ufVista ?? 'Seu estado')}
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}
              </Stack>

              {!ufConsulta && (
                <Alert severity="info" icon={<PlaceRounded />}>
                  Escolha seu estado (na lista acima ou tocando no mapa) ou permita o uso da localização para ver {CARGO_APURACAO_LABEL[cargo].toLowerCase()}.
                </Alert>
              )}

              {ufConsulta && r.loading && <Skeleton variant="rounded" height={360} />}

              {ufConsulta && !r.loading && !ap && (r.naoPublicado || !r.error) && (
                <Alert severity="info">
                  {antesDaDivulgacao
                    ? `A divulgação dos resultados do ${turno}º turno começa às 17h (Brasília) de ${dateLong(TURNOS[turno - 1].data)}, quando fecham as últimas seções. Esta página se atualiza sozinha.`
                    : 'O TSE ainda não publicou este resultado. A página consulta de novo a cada minuto.'}
                </Alert>
              )}

              {r.error && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={r.atualizar}>
                      Tentar de novo
                    </Button>
                  }
                >
                  {r.error} {ap ? 'Mostrando o último dado recebido.' : ''} Você também pode ver em{' '}
                  <Link href={`${TSE_RESULTADOS}/`} target="_blank" rel="noopener noreferrer" color="inherit">
                    resultados.tse.jus.br
                  </Link>
                  .
                </Alert>
              )}

              {aviso && <Alert severity="info">{aviso}</Alert>}

              {ap && (
                <>
                  {/* Andamento */}
                  <Box>
                    <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {pct(ap.secoes.pct)} das seções totalizadas
                      </Typography>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          TSE: {horaTse(ap.atualizado)}
                          {!ap.final && ` · atualiza a cada ${INTERVALO_MS / 60_000} min`}
                        </Typography>
                        <Tooltip title="Consultar o TSE agora">
                          <IconButton size="small" onClick={r.atualizar} aria-label="Consultar o TSE agora">
                            <RefreshRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                    <LinearProgress variant="determinate" value={ap.secoes.pct} sx={{ height: 8, borderRadius: 4 }} aria-label="Seções totalizadas" />
                  </Box>

                  {/* Quem o TSE já declarou eleito */}
                  {!prop && (
                    <CartaoEleitos eleitos={eleitosDe(ap)} cargo={cargo} turno={r.turnoExibido} local={cargo === 'presidente' ? (ap.uf === 'BR' ? null : `voto em ${nomeUf(ap.uf)}`) : nomeUf(ap.uf)} />
                  )}
                  {prop && eleitosDe(ap).length > 0 && (
                    <Alert
                      severity="success"
                      icon={<VerifiedRounded />}
                      action={
                        !soEleitos && (
                          <Button color="inherit" size="small" onClick={() => setSoEleitos(true)} sx={{ whiteSpace: 'nowrap' }}>
                            Ver só os eleitos
                          </Button>
                        )
                      }
                    >
                      <b>
                        {eleitosDe(ap).length} de {ap.vagas} vagas
                      </b>{' '}
                      já com eleitos(as) declarados pelo TSE{ap.final ? ' (totalização final)' : ''}. Eleitos aparecem com a faixa verde na lista.
                    </Alert>
                  )}

                  {(() => {
                    // Finalistas: confirmados pelo TSE no 1º turno, ou os dois do próprio 2º turno.
                    const fins = r.turnoExibido === 1 ? finalistasDe(ap) : temSegundoTurno(cargo) ? [...ap.candidatos].sort((a, b) => a.nomeUrna.localeCompare(b.nomeUrna, 'pt-BR')) : [];
                    if (fins.length < 2 || (r.turnoExibido === 2 && eleitosDe(ap).length)) return null;
                    const nomes = fins.map((c) => `${nomeProprio(c.nomeUrna)} (${c.numero})`);
                    return (
                      <Alert
                        severity="warning"
                        icon={<CompareArrowsRounded />}
                        action={
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5}>
                            <Button component={RouterLink} to={`/comparar?c=${fins.map((c) => c.sq).join(',')}`} color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }}>
                              Comparar
                            </Button>
                            <Button component={RouterLink} to={`/segundo-turno#st-${ap.uf}-${cargo}`} color="inherit" size="small" sx={{ whiteSpace: 'nowrap' }}>
                              Ver o 2º turno
                            </Button>
                          </Stack>
                        }
                      >
                        {r.turnoExibido === 1 ? (
                          <>
                            <b>Vão ao 2º turno</b> (confirmado pelo TSE): {nomes.join(' e ')}.
                          </>
                        ) : (
                          <>
                            <b>2º turno</b>: {nomes.join(' × ')}.
                          </>
                        )}
                      </Alert>
                    );
                  })()}

                  {candDestaque && (
                    <Typography variant="body2" sx={{ fontWeight: 600 }} aria-live="polite">
                      {nomeProprio(candDestaque.nomeUrna)} ({candDestaque.numero}) está em {candDestaque.posicao}º lugar, com {pct(candDestaque.pct)} dos votos válidos ({votos(candDestaque.votos)} votos)
                      {candDestaque.situacao ? ` · ${candDestaque.situacao}` : ''}.
                    </Typography>
                  )}

                  {/* Vagas por partido (proporcionais) */}
                  {prop && ap.bancadas.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ fontWeight: 700, mb: 0.75 }}>
                        Divisão das {ap.vagas} vagas por partido ou federação {ap.final ? '' : '(com os votos apurados até agora; muda até o fim)'}
                      </Typography>
                      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                        {ap.bancadas.map((b) => (
                          <Chip key={b.nome} size="small" variant="outlined" label={<><b>{b.vagas}</b> · {b.nome}</>} />
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Ferramentas da lista */}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                    {prop && (
                      <TextField
                        size="small"
                        value={filtro}
                        onChange={(e) => {
                          setFiltro(e.target.value);
                          setLimite(PAGINA);
                        }}
                        placeholder="Filtrar esta lista: nome, número ou partido"
                        sx={{ flex: 1 }}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><FilterListRounded fontSize="small" /></InputAdornment> } }}
                      />
                    )}
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: { sm: prop ? 0 : 'auto' } }}>
                      {prop && (
                        <Chip label="Só eleitos(as)" variant={soEleitos ? 'filled' : 'outlined'} color={soEleitos ? 'primary' : 'default'} onClick={() => setSoEleitos((v) => !v)} aria-pressed={soEleitos} />
                      )}
                      <ToggleButtonGroup size="small" exclusive value={ordem} onChange={(_, v) => v && setOrdem(v)} aria-label="Ordem">
                        <ToggleButton value="oficial" sx={{ px: 1.25 }}>
                          Mais votos
                        </ToggleButton>
                        <ToggleButton value="az" sx={{ px: 1.25 }}>
                          A–Z
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                  </Stack>

                  {/* Lista */}
                  <Box>
                    {visiveis.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        {soEleitos ? 'Ninguém com eleição confirmada pelo TSE ainda.' : 'Nenhuma candidatura encontrada com esse filtro.'}
                      </Typography>
                    )}
                    {visiveis.map((c) =>
                      prop ? (
                        <LinhaProporcional key={c.sq} c={c} destaque={c.sq === destaque} seguindo={acompanhar.tem(c.sq)} onSeguir={() => seguir(c)} />
                      ) : (
                        <LinhaMajoritaria key={c.sq} c={c} destaque={c.sq === destaque} seguindo={acompanhar.tem(c.sq)} onSeguir={() => seguir(c)} />
                      ),
                    )}
                    {prop && visiveis.length < lista.length && (
                      <Button fullWidth onClick={() => setLimite((l) => l + PAGINA * 2)} sx={{ mt: 1 }}>
                        Mostrar mais ({lista.length - visiveis.length} restantes)
                      </Button>
                    )}
                  </Box>

                  <Totais ap={ap} />
                </>
              )}
            </Stack>
          </Grid>

          {/* Mapa */}
          <Grid size={{ xs: 12, md: 5 }} sx={{ order: { xs: 2, md: 1 } }}>
            <Box sx={{ position: { md: 'sticky' }, top: { md: 88 }, border: 1, borderColor: 'divider', borderRadius: 4, p: { xs: 1.5, sm: 2 } }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {cargoBase === 'presidente'
                    ? 'Quem lidera em cada estado'
                    : cargoBase === 'governador'
                      ? 'Situação em cada estado'
                      : 'Seções apuradas por estado'}
                </Typography>
                {cargo === 'presidente' && localPres !== 'BR' && (
                  <Button size="small" variant="tonal" startIcon={<PublicRounded />} onClick={() => set({ local: null, c: null })}>
                    Brasil
                  </Button>
                )}
              </Stack>
              <BrazilMap
                selected={cargo === 'presidente' ? (localPres === 'BR' ? null : localPres) : ufVista}
                onSelect={clicarMapa}
                names={nomes}
                fills={Object.keys(fills).length ? fills : undefined}
                values={Object.keys(values).length ? values : undefined}
                format={(v) => pct(v)}
                labels={labels}
                hint={cargo === 'presidente' ? 'Toque num estado para ver o resultado dele' : 'Toque num estado para ver a disputa de lá'}
                compact
              />
              {legenda.length > 0 && (
                <Stack spacing={0.5} sx={{ mt: 1.5 }} aria-label="Legenda do mapa">
                  {legenda.map((l) => (
                    <Stack key={l.rotulo} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: l.cor, flexShrink: 0, border: 1, borderColor: 'divider' }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {l.rotulo}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.n} {l.n === 1 ? 'estado' : 'estados'}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, mb: 0, fontSize: '0.7rem' }}>
                {cargoBase === 'presidente'
                  ? 'Cores atribuídas em ordem alfabética, sem relação com partidos. Voto no exterior entra no total do Brasil.'
                  : cargoBase === 'governador'
                    ? 'A cor mostra a situação publicada pelo TSE ou, enquanto a apuração é parcial, se quem lidera passa de 50% dos votos válidos (regra do 2º turno). Toque num estado para ver quem está à frente.'
                    : 'Quanto mais escuro, mais seções já totalizadas.'}{' '}
                Contornos: malha oficial do IBGE.
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Fonte */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider', alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
            <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
            <span>
              Fonte oficial: TSE · Divulgação de Resultados. Os números vêm direto do servidor do TSE para o seu aparelho, sem passar por este site. Percentuais sobre
              os votos válidos; ordem pelos votos apurados (ou alfabética, se você escolher).
              {r.consultadoEm && ` Última consulta: ${r.consultadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`}
            </span>
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexShrink: 0 }}>
            {ap && (
              <Link href={ap.url} target="_blank" rel="noopener noreferrer" variant="caption">
                Arquivo oficial <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
              </Link>
            )}
            <Link href={`${TSE_RESULTADOS}/`} target="_blank" rel="noopener noreferrer" variant="caption">
              resultados.tse.jus.br <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
