import { useMemo } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import { Link as RouterLink, useHref, useNavigate } from 'react-router';
import { data } from '@/data/api';
import { dateTime, money } from '@/data/format';
import type { MinistroStf, PresidenteRepublica, Stf } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { cargoStf, diaBr, fotoStf, mesRef, porAntiguidade, porNome, usd } from './stf';

/* ------------------------------------------------------------------ fontes e aviso */

/** Fontes oficiais do STF usadas na página, com link. */
export function FontesStf({ stf, chaves }: { stf: Stf; chaves?: (keyof Stf['fontes'])[] }) {
  const lista = (chaves ?? (Object.keys(stf.fontes) as (keyof Stf['fontes'])[])).map((k) => stf.fontes[k]).filter(Boolean);
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
        <strong>{lista.length > 1 ? 'Fontes (dados públicos):' : 'Fonte (dados públicos):'}</strong>{' '}
        {lista.map((f, i) => (
          <span key={f.url}>
            {i > 0 && ' · '}
            <Link href={f.url} target="_blank" rel="noopener noreferrer">
              {f.orgao} — {f.nome}
              <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle', ml: 0.25 }} />
            </Link>
          </span>
        ))}
        {stf.coletado_em ? `. Coletado pelo Tá na Urna em ${dateTime(stf.coletado_em)}.` : '.'}
      </Typography>
    </Box>
  );
}

/** Aviso de que tudo aqui é público e publicado pelo próprio STF. */
export function AvisoDadosPublicosStf() {
  return (
    <Alert severity="info" icon={<GavelRounded />}>
      Tudo nesta seção são <strong>dados públicos</strong>, publicados pelo próprio Supremo Tribunal Federal em seus portais de transparência, como
      exigem a Lei de Acesso à Informação (Lei 12.527/2011) e a Resolução CNJ 215/2015. O STF decidiu que divulgar nome e remuneração de agentes
      públicos é legítimo (ARE 652.777, Tema 483). O Tá na Urna só reúne e organiza, sem opinião, e não publica CPF nem dado de servidores. Cada
      bloco indica a fonte oficial; se houver divergência, vale a fonte.
    </Alert>
  );
}

/* ------------------------------------------------------------------ desenho do plenário */

interface Assento {
  x: number;
  y: number;
  r: number;
  m: MinistroStf | null;
  /** -1: à direita do Presidente (esquerda na tela); 1: à esquerda dele; 0: centro. */
  lado: number;
  /** Distância do centro, em cadeiras. */
  desloc: number;
}

/**
 * Bancada do STF vista do público: Presidente ao centro, ao fundo; à sua direita (esquerda de quem
 * olha) o mais antigo, à sua esquerda o segundo mais antigo, e assim por diante, alternando, como o
 * STF descreve a disposição no Plenário. Cadeira vaga, se houver, fica na posição do mais novo.
 */
function posicoes(stf: Stf): Assento[] {
  const ordem = porAntiguidade(stf);
  // Elipse larga: a bancada se abre dos lados, como no Plenário.
  const cx = 500;
  const cy = 470;
  const rx = 440;
  const ry = 360;
  const passo = 180 / (stf.cadeiras - 1); // graus entre cadeiras
  const out: Assento[] = [];
  for (let i = 0; i < stf.cadeiras; i++) {
    const m = ordem[i] ?? null;
    // i = 0 → centro; ímpares à direita do Presidente (esquerda na tela); pares à esquerda dele.
    const lado = i === 0 ? 0 : i % 2 === 1 ? -1 : 1;
    const desloc = Math.ceil(i / 2);
    const ang = ((-90 + lado * desloc * passo) * Math.PI) / 180;
    out.push({ x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang), r: i === 0 ? 54 : 42, m, lado, desloc });
  }
  return out;
}

/** Nome em até duas linhas ("Alexandre" / "de Moraes"), para caber entre as cadeiras. */
function linhasNome(nome: string): string[] {
  const p = nome.split(' ');
  return p.length < 2 ? [nome] : [p[0], p.slice(1).join(' ')];
}

export function DesenhoStf({ stf }: { stf: Stf }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const base = useHref('/stf/');
  const compacto = useMediaQuery(theme.breakpoints.down('sm'));
  const assentos = useMemo(() => posicoes(stf), [stf]);
  const linha = theme.vars.palette.divider;
  const texto = theme.vars.palette.text.primary;
  const texto2 = theme.vars.palette.text.secondary;
  const pres = stf.ministros.find((m) => m.antiguidade === 0);
  const vagas = stf.cadeiras - stf.ministros.length;

  return (
    <Box
      component="svg"
      viewBox="0 0 1000 575"
      role="group"
      aria-label={`Plenário do Supremo Tribunal Federal: ${stf.ministros.length} ministros${vagas > 0 ? ` e ${vagas} cadeira vaga` : ''}. Presidência: ${pres?.nome ?? 'não informada'}.`}
      sx={{
        width: '100%',
        height: 'auto',
        display: 'block',
        userSelect: 'none',
        '& a': { outline: 'none' },
        '& a:focus-visible .anel, & a:hover .anel': { stroke: theme.vars.palette.primary.main, strokeWidth: 4 },
      }}
    >
      <defs>
        <clipPath id="stf-recorte" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        <linearGradient id="stf-madeira" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d6e63" />
          <stop offset="1" stopColor="#5d4037" />
        </linearGradient>
      </defs>
      {/* bancada em arco */}
      <path d="M 60 470 A 440 360 0 0 1 940 470" fill="none" stroke="url(#stf-madeira)" strokeWidth={26} strokeLinecap="round" opacity={0.85} />
      {/* brasão textual ao centro */}
      <text x={500} y={380} textAnchor="middle" fontSize={20} fontWeight={800} letterSpacing="0.2em" fill={texto2} opacity={0.5}>
        SUPREMO TRIBUNAL FEDERAL
      </text>
      <text x={500} y={406} textAnchor="middle" fontSize={15} fill={texto2} opacity={0.5}>
        {stf.ministros.length} de {stf.cadeiras} cadeiras ocupadas
      </text>

      {assentos.map((a, i) => {
        if (!a.m) {
          return (
            <g key={`vaga-${i}`}>
              <circle cx={a.x} cy={a.y} r={a.r} fill={theme.vars.palette.background.paper} stroke={texto2} strokeWidth={3} strokeDasharray="6 6">
                <title>{`Cadeira vaga${stf.nota ? ` (${stf.nota.replace(/\.$/, '')})` : ''}`}</title>
              </circle>
              <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={700} fill={texto2}>
                Vaga
              </text>
            </g>
          );
        }
        const m = a.m;
        const foto = fotoStf(m.foto);
        const destaque = m.cargo === 'Presidente';
        const nomeY = a.y + a.r + 22;
        return (
          <a
            key={m.id}
            href={`${base}${m.id}`}
            aria-label={`${m.nome}: ver página`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              void navigate(`/stf/${m.id}`);
            }}
          >
            <circle cx={a.x} cy={a.y} r={a.r} fill={theme.vars.palette.action.hover} />
            {foto && <image href={foto} x={a.x - a.r} y={a.y - a.r} width={a.r * 2} height={a.r * 2} preserveAspectRatio="xMidYMin slice" clipPath="url(#stf-recorte)" />}
            <circle className="anel" cx={a.x} cy={a.y} r={a.r} fill="transparent" stroke={destaque ? '#5d4037' : linha} strokeWidth={destaque ? 4 : 2} style={{ cursor: 'pointer' }}>
              <title>{`${m.nome} · ${cargoStf(m)}`}</title>
            </circle>
            {!compacto && (() => {
              // Nas cadeiras de baixo das laterais, o nome vai para dentro do arco (ao lado da cadeira).
              const aoLado = a.desloc >= 2;
              const linhas = destaque ? [m.nome] : linhasNome(m.nome);
              // Rótulo na direção do centro do arco, logo depois da cadeira.
              const dx = 500 - a.x;
              const dy = 470 - a.y;
              const d = Math.hypot(dx, dy) || 1;
              const px = a.x + (dx / d) * (a.r + 12);
              const py = a.y + (dy / d) * (a.r + 12);
              const tx = aoLado ? px : a.x;
              const ancora = aoLado ? (a.lado < 0 ? 'start' : 'end') : 'middle';
              const y0 = !aoLado ? nomeY : a.desloc === 2 ? py + 12 : py - (linhas.length - 1) * 9 + 5;
              return (
                <>
                  {linhas.map((l, k) => (
                    <text key={k} x={tx} y={y0 + k * 18} textAnchor={ancora} fontSize={destaque ? 20 : 16} fontWeight={800} fill={texto}>
                      {l}
                    </text>
                  ))}
                  {m.cargo && (
                    <text x={tx} y={y0 + (destaque ? 22 : linhas.length * 18 + 2)} textAnchor={ancora} fontSize={destaque ? 16 : 13} fontWeight={600} fill={theme.vars.palette.primary.main}>
                      {m.cargo}
                    </text>
                  )}
                </>
              );
            })()}
          </a>
        );
      })}
    </Box>
  );
}

/* ------------------------------------------------------------------ partes */

function FotoPresidente({ p, size = 44 }: { p: PresidenteRepublica | undefined; size?: number }) {
  return (
    <Avatar src={fotoStf(p?.foto) ?? undefined} alt={p ? `Retrato oficial de ${p.nome}` : ''} sx={{ width: size, height: size, '& img': { objectPosition: 'top' } }}>
      {p?.nome.slice(0, 1)}
    </Avatar>
  );
}

export function CreditoFoto({ p }: { p: PresidenteRepublica }) {
  if (!p.foto_pagina) return null;
  return (
    <Link href={p.foto_pagina} target="_blank" rel="noopener noreferrer" variant="caption" color="text.secondary">
      Foto: {p.foto_credito ?? 'Wikimedia Commons'}
      {p.foto_licenca ? ` (${p.foto_licenca})` : ''}
    </Link>
  );
}

function CartaoMinistro({ m, stf }: { m: MinistroStf; stf: Stf }) {
  const p = m.nomeado_por ? stf.presidentes[m.nomeado_por] : undefined;
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea component={RouterLink} to={`/stf/${m.id}`} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ display: 'flex', gap: 1.5 }}>
          <Box
            component="img"
            src={fotoStf(m.foto) ?? undefined}
            alt={`Foto oficial de ${m.nome}`}
            loading="lazy"
            sx={{ width: 72, height: 96, objectFit: 'cover', objectPosition: 'top', borderRadius: 2, flexShrink: 0, bgcolor: 'action.hover' }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{m.nome}</Typography>
            <Typography variant="caption" color={m.cargo ? 'primary' : 'text.secondary'} sx={{ fontWeight: m.cargo ? 700 : 400 }} component="div">
              {cargoStf(m)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              No STF desde {diaBr(m.datas.posse) ?? '—'}
            </Typography>
            {p && (
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.75 }}>
                <FotoPresidente p={p} size={24} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                  Nomeação: {p.nome}
                </Typography>
              </Stack>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function QuemNomeou({ stf }: { stf: Stf }) {
  const grupos = useMemo(() => {
    const por = new Map<string, MinistroStf[]>();
    for (const m of stf.ministros) if (m.nomeado_por) por.set(m.nomeado_por, [...(por.get(m.nomeado_por) ?? []), m]);
    return [...por.entries()]
      .map(([pid, ms]) => ({ pid, p: stf.presidentes[pid], ms: [...ms].sort((a, b) => (a.datas.nomeacao ?? '').localeCompare(b.datas.nomeacao ?? '')) }))
      .filter((g) => g.p)
      .sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt-BR'));
  }, [stf]);
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2">
          Quem nomeou cada ministro
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Os ministros do STF são nomeados pelo Presidente da República depois de aprovados pela maioria absoluta do Senado (Constituição, art. 101).
          Abaixo, o Presidente que assinou cada nomeação, pela data do decreto publicada pelo STF. Presidentes em ordem alfabética.
        </Typography>
        <Stack spacing={2}>
          {grupos.map(({ pid, p, ms }) => (
            <Box key={pid} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '220px 1fr' }, gap: 2, alignItems: 'center', p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <FotoPresidente p={p} size={64} />
                <Box>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{p.nome}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Presidente da República · {p.mandatos.map((x) => `${x.inicio.slice(0, 4)}–${x.fim.slice(0, 4)}`).join(', ')}
                  </Typography>
                  <CreditoFoto p={p} />
                </Box>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                {ms.map((m) => (
                  <Stack key={m.id} component={RouterLink} to={`/stf/${m.id}`} direction="row" spacing={1} sx={{ alignItems: 'center', color: 'inherit', textDecoration: 'none', '&:hover .n': { textDecoration: 'underline' } }}>
                    <Avatar src={fotoStf(m.foto) ?? undefined} alt="" sx={{ width: 40, height: 40, '& img': { objectPosition: 'top' } }} />
                    <Box>
                      <Typography className="n" variant="body2" sx={{ fontWeight: 700 }}>
                        {m.nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        nomeação em {diaBr(m.datas.nomeacao)}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
        <FontesStf stf={stf} chaves={['pastas', 'nomeacao']} />
      </CardContent>
    </Card>
  );
}

function Remuneracoes({ stf }: { stf: Stf }) {
  const lista = porNome(stf.ministros).filter((m) => m.remuneracao);
  const ref = lista[0]?.remuneracao?.ref;
  if (!lista.length) return null;
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2">
          Remuneração em {mesRef(ref)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Valores da folha de pagamento publicada pelo STF. O subsídio de ministro do STF é o teto do funcionalismo (Constituição, art. 37, XI). O bruto
          inclui as demais verbas do mês (como vantagens pessoais, abono de permanência, férias e 13º); o líquido é o que sobra depois de impostos,
          previdência e descontos pessoais. Toque num nome para ver as parcelas e os últimos meses. Ordem alfabética.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ministro(a)</TableCell>
                <TableCell align="right">Subsídio</TableCell>
                <TableCell align="right">Bruto no mês</TableCell>
                <TableCell align="right">Líquido</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/stf/${m.id}#remuneracao`} sx={{ fontWeight: 700 }}>
                      {m.nome}
                    </Link>
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(m.remuneracao?.subsidio)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(m.remuneracao?.bruto)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {money(m.remuneracao?.liquido)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <FontesStf stf={stf} chaves={['remuneracao']} />
      </CardContent>
    </Card>
  );
}

function Viagens({ stf }: { stf: Stf }) {
  const lista = porNome(stf.ministros);
  const ano = String(new Date().getFullYear());
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2">
          Diárias e passagens aéreas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Passagens e diárias concedidas pelo STF a cada ministro em viagens a serviço, em {ano} e no total publicado (desde 2016). Diárias no
          exterior são pagas em dólar e aparecem em US$, sem conversão. Toque num nome para ver cada viagem, com motivo, destino e valor. Ordem
          alfabética.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ministro(a)</TableCell>
                <TableCell align="right">Passagens {ano}</TableCell>
                <TableCell align="right">Diárias {ano}</TableCell>
                <TableCell align="right">Passagens (total)</TableCell>
                <TableCell align="right">Diárias (total)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((m) => {
                const a = m.viagens.anos[ano];
                const tot = Object.values(m.viagens.anos).reduce(
                  (s, x) => ({ p: s.p + x.passagens_valor, brl: s.brl + x.diarias_brl, usd: s.usd + x.diarias_usd }),
                  { p: 0, brl: 0, usd: 0 },
                );
                const diarias = (brl: number, us: number) => [brl ? money(brl) : null, us ? usd.format(us) : null].filter(Boolean).join(' + ') || '—';
                return (
                  <TableRow key={m.id} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/stf/${m.id}#viagens`} sx={{ fontWeight: 700 }}>
                        {m.nome}
                      </Link>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {a?.passagens ? `${a.passagens} · ${money(a.passagens_valor)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {a ? diarias(a.diarias_brl, a.diarias_usd) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {m.viagens.passagens ? `${m.viagens.passagens} · ${money(tot.p)}` : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {diarias(tot.brl, tot.usd)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {stf.viagens_atualizado_em ? `Arquivo do STF atualizado em ${dateTime(stf.viagens_atualizado_em)}. ` : ''}Valores das passagens: custo efetivo
          publicado (bilhete menos reembolso).
        </Typography>
        <FontesStf stf={stf} chaves={['viagens']} />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ aba STF do plenário */

export function PlenarioStf() {
  const q = useAsync(() => data.stf(), []);
  if (q.loading) return <Skeleton variant="rounded" height={420} />;
  const stf = q.data;
  if (q.error || !stf) return <Alert severity="info">Os dados do STF ainda não foram publicados no site. Eles são atualizados automaticamente.</Alert>;
  const pres = stf.ministros.find((m) => m.cargo === 'Presidente');
  const vice = stf.ministros.find((m) => m.cargo === 'Vice-Presidente');
  const vagas = stf.cadeiras - stf.ministros.length;
  return (
    <Stack spacing={3}>
      <Card>
        <CardContent sx={{ p: { xs: 1.5, md: 3 } }}>
          <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
            Supremo Tribunal Federal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {stf.cadeiras} cadeiras (Constituição, art. 101). Como no Plenário do STF, quem preside fica ao centro e os demais ministros se sentam por
            ordem de antiguidade, alternando de um lado e de outro. A posição não indica orientação. Toque numa cadeira para abrir a página do ministro.
          </Typography>
          <DesenhoStf stf={stf} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'center', mt: 2, textAlign: 'center' }}>
            {pres && (
              <Box>
                <Typography sx={{ fontWeight: 800 }}>
                  <Link component={RouterLink} to={`/stf/${pres.id}`} color="inherit">
                    {pres.nome}
                  </Link>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Presidente do STF{pres.datas.posse_presidencia ? ` desde ${diaBr(pres.datas.posse_presidencia)}` : ''}
                </Typography>
              </Box>
            )}
            {vice && (
              <Box>
                <Typography sx={{ fontWeight: 800 }}>
                  <Link component={RouterLink} to={`/stf/${vice.id}`} color="inherit">
                    {vice.nome}
                  </Link>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vice-Presidente{vice.datas.posse_vice ? ` desde ${diaBr(vice.datas.posse_vice)}` : ''}
                </Typography>
              </Box>
            )}
          </Stack>
          {vagas > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {vagas === 1 ? 'Há 1 cadeira vaga' : `Há ${vagas} cadeiras vagas`} na composição publicada pelo STF
              {stf.desde ? ` (vigente desde ${diaBr(stf.desde)})` : ''}
              {stf.nota ? `: ${stf.nota.replace(/\.$/, '')}` : ''}. O site confere a composição a cada 6 horas enquanto houver vaga.
            </Alert>
          )}
          {stf.pgr && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              Procurador-Geral da República na composição: {stf.pgr.nome}
              {stf.pgr.desde ? ` (desde ${diaBr(stf.pgr.desde)})` : ''}.
            </Typography>
          )}
          <FontesStf stf={stf} chaves={['composicao', 'pastas']} />
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' }, gap: 1.5 }}>
        {porAntiguidade(stf).map((m) => (
          <CartaoMinistro key={m.id} m={m} stf={stf} />
        ))}
      </Box>

      <QuemNomeou stf={stf} />
      <Remuneracoes stf={stf} />
      <Viagens stf={stf} />
      <AvisoDadosPublicosStf />
    </Stack>
  );
}
