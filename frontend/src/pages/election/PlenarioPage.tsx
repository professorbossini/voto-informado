import { useMemo, useState, type ReactElement } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link as RouterLink, useHref, useNavigate, useSearchParams } from 'react-router';
import { SourceNote } from '@/components/election/SourceNote';
import { gruposPorAssento, hemiciclo } from '@/components/plenario/hemiciclo';
import { data, dataFileUrl } from '@/data/api';
import type { CasaPlenario, MembroPlenario, Plenario } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

type CasaKey = 'camara' | 'senado';

const CASAS: Record<CasaKey, { nome: string; aba: string; presidencia: string; membro: string; fonte: string }> = {
  camara: { nome: 'Câmara dos Deputados', aba: 'Câmara', presidencia: 'Presidente da Câmara dos Deputados', membro: 'deputados', fonte: 'camara_plenario' },
  senado: { nome: 'Senado Federal', aba: 'Senado', presidencia: 'Presidente do Senado Federal', membro: 'senadores', fonte: 'senado_plenario' },
};

const SEM_PARTIDO = 'S/Partido';
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Ordem neutra: sigla em ordem alfabética, "sem partido" por último. */
function ordemPartidos(a: string, b: string) {
  return Number(a === SEM_PARTIDO) - Number(b === SEM_PARTIDO) || a.localeCompare(b, 'pt-BR');
}

function nomePartido(sigla: string, partidos: Plenario['partidos']) {
  return sigla === SEM_PARTIDO ? 'Sem partido' : (partidos[sigla]?.nome ?? sigla);
}

function idPadrao(sigla: string) {
  return `logo-${sigla.normalize('NFKD').replace(/[^A-Za-z0-9]/g, '')}`;
}

/** "2025-02-01" → "01/02/2025". */
function dia(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/** "desde 01/02/2025" ou "de 01/02/2025 a 31/01/2027", com o que a Casa publicou. */
function vigencia(p: { desde: string | null; ate?: string | null }) {
  const d = dia(p.desde);
  const a = dia(p.ate);
  return d && a ? `de ${d} a ${a}` : d ? `desde ${d}` : a ? `até ${a}` : null;
}

function quando(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

/** Símbolo do partido (arquivo oficial publicado pela Câmara), ou a sigla quando não há. */
function Simbolo({ sigla, partidos, size = 36 }: { sigla: string; partidos: Plenario['partidos']; size?: number }) {
  const logo = partidos[sigla]?.logo;
  return (
    <Box
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: '#fff',
        border: `1px solid ${theme.vars.palette.divider}`,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
      })}
    >
      {logo ? (
        <Box component="img" src={dataFileUrl(logo)} alt={`Símbolo do ${sigla}`} loading="lazy" sx={{ width: '80%', height: '80%', objectFit: 'contain' }} />
      ) : (
        <Typography component="span" sx={{ fontSize: size * 0.24, fontWeight: 800, color: '#333', lineHeight: 1 }}>
          {sigla === SEM_PARTIDO ? 'S/P' : sigla.slice(0, 4)}
        </Typography>
      )}
    </Box>
  );
}

interface Grupo {
  sigla: string;
  /** Cadeiras no plenário (todas, presidência incluída). */
  total: number;
  membros: MembroPlenario[];
}

function grupos(casa: CasaPlenario): Grupo[] {
  const por = new Map<string, MembroPlenario[]>();
  for (const m of casa.membros) por.set(m.partido, [...(por.get(m.partido) ?? []), m]);
  return [...por.entries()]
    .sort(([a], [b]) => ordemPartidos(a, b))
    .map(([sigla, membros]) => ({ sigla, total: membros.length, membros: [...membros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
}

/* ------------------------------------------------------------------ desenho */

function Desenho({
  casa,
  info,
  partidos,
  lista,
  destaque,
  selecionado,
  onSelecionar,
}: {
  casa: CasaPlenario;
  info: (typeof CASAS)[CasaKey];
  partidos: Plenario['partidos'];
  lista: Grupo[];
  destaque: string | null;
  selecionado: MembroPlenario | null;
  onSelecionar: (m: MembroPlenario) => void;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const baseParlamentar = useHref('/parlamentar/');
  const pres = casa.presidente;
  const rotulo = (m: MembroPlenario) => `${m.nome} (${m.partido === SEM_PARTIDO ? 'sem partido' : m.partido}${m.uf ? `-${m.uf}` : ''})`;
  /** Cadeira com página no site vira link (clique, teclado e leitor de tela); sem página, só mostra quem é. */
  const cadeira = (m: MembroPlenario, circulo: ReactElement, extra = '') =>
    m.perfil ? (
      <a
        key={m.id}
        href={`${baseParlamentar}${m.id}`}
        aria-label={`${extra}${rotulo(m)}: ver página do parlamentar`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          void navigate(`/parlamentar/${m.id}`);
        }}
      >
        {circulo}
      </a>
    ) : (
      <g key={m.id} onClick={() => onSelecionar(m)} style={{ cursor: 'pointer' }}>
        {circulo}
      </g>
    );
  // Quem preside senta à mesa; as demais cadeiras formam o hemiciclo.
  const noPlenario = useMemo(() => lista.map((g) => ({ ...g, membros: g.membros.filter((m) => m.id !== pres?.id) })), [lista, pres]);
  const geo = useMemo(() => hemiciclo(noPlenario.reduce((s, g) => s + g.membros.length, 0), { raio: 480 }), [noPlenario]);
  const ocupantes = useMemo(() => {
    const idx = gruposPorAssento(geo.assentos, noPlenario.map((g) => g.membros.length));
    const contador = noPlenario.map(() => 0);
    return idx.map((g) => noPlenario[g].membros[contador[g]++]);
  }, [noPlenario, geo]);

  const siglas = [...new Set([...lista.map((g) => g.sigla), ...(pres ? [pres.partido] : [])])];
  // Sem símbolo publicado: dois cinzas neutros alternados entre partidos vizinhos (nunca cor de partido).
  const cinza = (s: string) => (siglas.indexOf(s) % 2 === 0 ? '#e3e3e3' : '#a8a8a8');
  const temLogo = (s: string) => Boolean(partidos[s]?.logo);
  /** Foto oficial: cópia publicada pelo site (api/...) ou o endereço original da Casa. */
  const fotoDe = (m: MembroPlenario) => (m.foto ? (/^https?:\/\//.test(m.foto) ? m.foto : dataFileUrl(m.foto)) : null);
  /**
   * Cadeira com foto: a foto recortada no círculo e, no canto inferior direito, um selo menor com o
   * símbolo do partido sobrepondo a foto. Sem foto, o círculo mostra o partido (como antes).
   */
  const assento = (m: MembroPlenario, x: number, y: number, r: number, borda: string, larguraBorda: number, titulo: string) => {
    const foto = fotoDe(m);
    const rb = Math.max(r * 0.44, 4);
    const bx = x + r * 0.74;
    const by = y + r * 0.64;
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill={`url(#${idPadrao(m.partido)})`} />
        {foto && (
          <image href={foto} x={x - r} y={y - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMin slice" clipPath="url(#recorte-cadeira)" />
        )}
        <circle className="anel" cx={x} cy={y} r={r} fill="transparent" stroke={borda} strokeWidth={larguraBorda} style={{ cursor: 'pointer' }}>
          <title>{titulo}</title>
        </circle>
        {foto && (
          <g pointerEvents="none">
            <circle cx={bx} cy={by} r={rb} fill={`url(#${idPadrao(m.partido)})`} stroke="#fff" strokeWidth={Math.max(rb * 0.16, 0.8)} />
            {!temLogo(m.partido) && rb >= 9 && (
              <text x={bx} y={by} textAnchor="middle" dominantBaseline="central" fontSize={rb * 0.62} fontWeight={800} fill="#222">
                {m.partido === SEM_PARTIDO ? 'S/P' : m.partido.slice(0, 4)}
              </text>
            )}
          </g>
        )}
      </g>
    );
  };
  const { cx, cy } = geo;
  // No celular o texto do SVG ficaria minúsculo: o nome vai para fora do desenho (PresidenciaTexto).
  const compacto = useMediaQuery(theme.breakpoints.down('sm'));
  const extra = compacto ? 8 : 92; // espaço para o nome de quem preside, abaixo da base
  const mesaL = 260;
  const r0 = geo.assentos[0]?.r ?? 10;
  const cadeiraR = Math.min(Math.max(24, r0 * 1.4), 42);
  const linha = theme.vars.palette.divider;
  const texto = theme.vars.palette.text.primary;
  const texto2 = theme.vars.palette.text.secondary;

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${geo.largura} ${geo.altura + extra}`}
      role="group"
      aria-label={`Plenário do ${info.nome}: ${casa.membros.length} cadeiras. ${lista.map((g) => `${g.sigla} ${g.total}`).join(', ')}.${pres ? ` Presidência: ${pres.nome} (${pres.partido}).` : ''}`}
      sx={{
        width: '100%',
        height: 'auto',
        display: 'block',
        userSelect: 'none',
        '& a': { outline: 'none' },
        '& a:focus-visible .anel, & a:hover .anel': { stroke: theme.vars.palette.primary.main, strokeWidth: 3 },
      }}
    >
      <defs>
        {siglas.map((s) => {
          const logo = partidos[s]?.logo;
          return (
            <pattern key={s} id={idPadrao(s)} patternContentUnits="objectBoundingBox" width="1" height="1">
              <rect width="1" height="1" fill={logo ? '#fff' : cinza(s)} />
              {logo && <image href={dataFileUrl(logo)} x="0.12" y="0.12" width="0.76" height="0.76" preserveAspectRatio="xMidYMid meet" />}
            </pattern>
          );
        })}
        {/* Recorte circular das fotos (um só, relativo à própria imagem). */}
        <clipPath id="recorte-cadeira" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        <linearGradient id="mesa-madeira" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a1887f" />
          <stop offset="1" stopColor="#6d4c41" />
        </linearGradient>
      </defs>

      {/* piso do plenário */}
      <path
        d={`M ${cx - geo.raioExterno - 8} ${cy} A ${geo.raioExterno + 8} ${geo.raioExterno + 8} 0 0 1 ${cx + geo.raioExterno + 8} ${cy} Z`}
        fill={theme.vars.palette.action.hover}
        stroke="none"
      />

      {geo.assentos.map((a, i) => {
        const m = ocupantes[i];
        if (!m) return null;
        const apagado = destaque != null && destaque !== m.partido;
        const sel = selecionado?.id === m.id;
        return cadeira(
          m,
          <g opacity={apagado ? 0.18 : 1} style={{ transition: 'opacity .2s' }}>
            {assento(m, a.x, a.y, a.r, sel ? theme.vars.palette.primary.main : linha, sel ? 3 : 1, rotulo(m))}
          </g>,
        );
      })}
      {/* sigla dentro da bolinha quando não há símbolo e ela é grande o bastante */}
      {r0 >= 16 &&
        geo.assentos.map((a, i) => {
          const m = ocupantes[i];
          if (!m || temLogo(m.partido) || fotoDe(m)) return null;
          return (
            <text key={`t-${m.id}`} x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={a.r * 0.5} fontWeight={800} fill="#222" pointerEvents="none" opacity={destaque != null && destaque !== m.partido ? 0.2 : 1}>
              {m.partido === SEM_PARTIDO ? 'S/P' : m.partido.slice(0, 5)}
            </text>
          );
        })}

      {/* Mesa da presidência */}
      <g opacity={destaque != null && pres && destaque !== pres.partido ? 0.35 : 1}>
        <rect x={cx - mesaL / 2 - 14} y={cy - 18} width={mesaL + 28} height={14} rx={4} fill="#5d4037" />
        <rect x={cx - mesaL / 2} y={cy - 70} width={mesaL} height={54} rx={8} fill="url(#mesa-madeira)" />
        <rect x={cx - mesaL / 2} y={cy - 70} width={mesaL} height={9} rx={4} fill="#bcaaa4" />
        <text x={cx} y={cy - 32} textAnchor="middle" fontSize={15} fontWeight={800} letterSpacing="0.14em" fill="#fff">
          PRESIDÊNCIA
        </text>
        {pres ? (
          cadeira(
            pres,
            assento(pres, cx, cy - 70 - cadeiraR - 6, cadeiraR, selecionado?.id === pres.id ? theme.vars.palette.primary.main : '#5d4037', 3, `${info.presidencia}: ${rotulo(pres)}`),
            `${info.presidencia}, `,
          )
        ) : (
          <circle cx={cx} cy={cy - 70 - cadeiraR - 6} r={cadeiraR} fill="none" stroke={linha} strokeWidth={2} strokeDasharray="4 4" />
        )}
      </g>
      {!compacto && (
        <>
          <text x={cx} y={cy + 36} textAnchor="middle" fontSize={26} fontWeight={800} fill={texto}>
            {pres ? `${pres.nome} (${pres.partido}${pres.uf ? `-${pres.uf}` : ''})` : 'Presidência: dado indisponível no momento'}
          </text>
          <text x={cx} y={cy + 66} textAnchor="middle" fontSize={18} fill={texto2}>
            {info.presidencia}
            {pres && vigencia(pres) ? ` · mandato ${vigencia(pres)}` : ''}
          </text>
        </>
      )}
    </Box>
  );
}

/* ------------------------------------------------------------------ partes */

/** Nome de quem preside, em texto normal logo abaixo da mesa (só no celular). */
function PresidenciaTexto({ casa, info, partidos }: { casa: CasaPlenario; info: (typeof CASAS)[CasaKey]; partidos: Plenario['partidos'] }) {
  const p = casa.presidente;
  return (
    <Stack direction="row" spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', justifyContent: 'center', textAlign: 'center', mt: 1 }}>
      {p && <Simbolo sigla={p.partido} partidos={partidos} size={36} />}
      <Box>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>
          {p ? (
            p.perfil ? (
              <Link component={RouterLink} to={`/parlamentar/${p.id}`} color="inherit">
                {p.nome} ({p.partido}
                {p.uf ? `-${p.uf}` : ''})
              </Link>
            ) : (
              `${p.nome} (${p.partido}${p.uf ? `-${p.uf}` : ''})`
            )
          ) : (
            'Presidência: dado indisponível no momento'
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {info.presidencia}
          {p && vigencia(p) ? ` · mandato ${vigencia(p)}` : ''}
        </Typography>
      </Box>
    </Stack>
  );
}

function Selecionado({ m, partidos, presidencia }: { m: MembroPlenario; partidos: Plenario['partidos']; /** Texto do cargo, se for quem preside. */ presidencia: string | null }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }} role="status">
      <Simbolo sigla={m.partido} partidos={partidos} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>{m.nome}</Typography>
        <Typography variant="body2" color="text.secondary">
          {presidencia ? `${presidencia} · ` : ''}
          {nomePartido(m.partido, partidos)} ({m.partido}){m.uf ? ` · ${m.uf}` : ''}
        </Typography>
      </Box>
      {m.perfil && (
        <Button component={RouterLink} to={`/parlamentar/${m.id}`} size="small" variant="tonal">
          Gastos de mandato
        </Button>
      )}
    </Stack>
  );
}

function TabelaPartidos({
  lista,
  total,
  partidos,
  destaque,
  onDestaque,
}: {
  lista: Grupo[];
  total: number;
  partidos: Plenario['partidos'];
  destaque: string | null;
  onDestaque: (s: string | null) => void;
}) {
  const [ordem, setOrdem] = useState<'alfa' | 'cadeiras'>('alfa');
  const linhas = ordem === 'alfa' ? lista : [...lista].sort((a, b) => b.total - a.total || ordemPartidos(a.sigla, b.sigla));
  const max = Math.max(...lista.map((g) => g.total), 1);
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
          <Box>
            <Typography variant="h5" component="h2">
              Cadeiras por partido
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Percentual sobre as {total} cadeiras. Toque num partido para destacá-lo no desenho.
            </Typography>
          </Box>
          <ToggleButtonGroup exclusive size="small" value={ordem} onChange={(_, v) => v && setOrdem(v)} aria-label="Ordem da tabela">
            <ToggleButton value="alfa">A–Z</ToggleButton>
            <ToggleButton value="cadeiras">Mais cadeiras</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack spacing={0.5}>
          {linhas.map((g) => {
            const ativo = destaque === g.sigla;
            return (
              <Box
                key={g.sigla}
                component="button"
                type="button"
                onClick={() => onDestaque(ativo ? null : g.sigla)}
                aria-pressed={ativo}
                sx={(theme) => ({
                  display: 'grid',
                  gridTemplateColumns: '40px minmax(0, 1fr) auto',
                  gap: 1.5,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                  border: `1px solid ${ativo ? theme.vars.palette.primary.main : 'transparent'}`,
                  bgcolor: ativo ? 'action.selected' : 'transparent',
                  borderRadius: 2,
                  p: 0.75,
                  '&:hover': { bgcolor: 'action.hover' },
                })}
              >
                <Simbolo sigla={g.sigla} partidos={partidos} size={40} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {g.sigla === SEM_PARTIDO ? 'Sem partido' : g.sigla}{' '}
                    <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                      {g.sigla !== SEM_PARTIDO && nomePartido(g.sigla, partidos) !== g.sigla ? nomePartido(g.sigla, partidos) : ''}
                    </Box>
                  </Typography>
                  <Box sx={{ mt: 0.5, height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box sx={{ width: `${(g.total / max) * 100}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 4 }} />
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 92 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {pctFmt.format((g.total / total) * 100)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {g.total} {g.total === 1 ? 'cadeira' : 'cadeiras'}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ListaNomes({ lista, partidos, info }: { lista: Grupo[]; partidos: Plenario['partidos']; info: (typeof CASAS)[CasaKey] }) {
  const [aberta, setAberta] = useState(false);
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" component="h2">
            Quem ocupa cada cadeira
          </Typography>
          <Button onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
            {aberta ? 'Esconder lista' : `Ver os ${info.membro} por partido`}
          </Button>
        </Stack>
        {aberta && (
          <Box sx={{ mt: 2, columnWidth: 260, columnGap: 3 }}>
            {lista.map((g) => (
              <Box key={g.sigla} sx={{ breakInside: 'avoid', mb: 2 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Simbolo sigla={g.sigla} partidos={partidos} size={24} />
                  <Typography variant="subtitle2">
                    {g.sigla === SEM_PARTIDO ? 'Sem partido' : g.sigla} ({g.total})
                  </Typography>
                </Stack>
                {g.membros.map((m) => (
                  <Typography key={m.id} variant="body2" sx={{ pl: 4 }}>
                    {m.perfil ? (
                      <Link component={RouterLink} to={`/parlamentar/${m.id}`}>
                        {m.nome}
                      </Link>
                    ) : (
                      m.nome
                    )}
                    {m.uf ? ` · ${m.uf}` : ''}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ página */

export function PlenarioPage() {
  const [params, setParams] = useSearchParams();
  const casaKey: CasaKey = params.get('casa') === 'senado' ? 'senado' : 'camara';
  const q = useAsync(() => data.plenario(), []);
  const [destaque, setDestaque] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<MembroPlenario | null>(null);

  const info = CASAS[casaKey];
  const casa = q.data?.[casaKey] ?? null;
  const partidos = q.data?.partidos ?? {};
  const lista = useMemo(() => (casa ? grupos(casa) : []), [casa]);

  const trocar = (c: CasaKey) => {
    setDestaque(null);
    setSelecionado(null);
    setParams(
      (p) => {
        if (c === 'camara') p.delete('casa');
        else p.set('casa', c);
        return p;
      },
      { replace: true },
    );
  };

  return (
    <>
      <PageHeader
        title="Plenário"
        subtitle="Quem ocupa hoje cada cadeira da Câmara dos Deputados e do Senado Federal, o símbolo do partido de cada parlamentar e quem preside cada Casa. Atualizado todos os dias com os dados oficiais."
      />
      <Tabs value={casaKey} onChange={(_, v: CasaKey) => trocar(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {(Object.keys(CASAS) as CasaKey[]).map((k) => (
          <Tab key={k} value={k} label={`${CASAS[k].aba}${q.data?.[k] ? ` (${q.data[k].membros.length})` : ''}`} />
        ))}
      </Tabs>

      {q.loading ? (
        <Skeleton variant="rounded" height={420} />
      ) : q.error || !casa ? (
        <Alert severity="info">A composição do {info.nome} ainda não foi publicada no site. Ela é atualizada automaticamente todos os dias.</Alert>
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: { xs: 1.5, md: 3 } }}>
              <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
                {info.nome}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {casa.membros.length} cadeiras, cada bolinha com o símbolo do partido de quem a ocupa. Partidos em ordem alfabética, da esquerda para a
                direita: a posição no desenho não indica orientação política. Toque numa cadeira para abrir a página do parlamentar.
              </Typography>
              <Desenho
                casa={casa}
                info={info}
                partidos={partidos}
                lista={lista}
                destaque={destaque}
                selecionado={selecionado}
                onSelecionar={setSelecionado}
              />
              <PresidenciaTexto casa={casa} info={info} partidos={partidos} />
              {selecionado && (
                <Box sx={{ mt: 2 }}>
                  <Selecionado
                    m={selecionado}
                    partidos={partidos}
                    presidencia={
                      casa.presidente && selecionado.id === casa.presidente.id
                        ? `${info.presidencia}${vigencia(casa.presidente) ? ` (mandato ${vigencia(casa.presidente)})` : ''}`
                        : null
                    }
                  />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
                {quando(casa.coletado_em) ? `Dados oficiais coletados em ${quando(casa.coletado_em)}.` : 'Dados oficiais da última coleta disponível.'} Quem
                preside a Casa senta à mesa e conta na bancada do seu partido. O mandato na presidência é de 2 anos (Constituição, art. 57, § 4º).
              </Typography>
            </CardContent>
          </Card>

          <TabelaPartidos lista={lista} total={casa.membros.length} partidos={partidos} destaque={destaque} onDestaque={setDestaque} />
          <ListaNomes lista={lista} partidos={partidos} info={info} />
          <SourceNote keys={[info.fonte]} note="símbolos dos partidos: cadastro oficial de partidos da Câmara dos Deputados" />
        </Stack>
      )}
    </>
  );
}
