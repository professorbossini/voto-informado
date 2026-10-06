import { useMemo } from 'react';
import { Alert, Avatar, Box, Card, CardContent, Chip, Link, Stack, Tooltip, Typography } from '@mui/material';
import LoginRounded from '@mui/icons-material/LoginRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import { PageHeader } from '@/pages/PageHeader';
import { CREDITOS_FOTO } from './creditos';
import { ERAS, PRESIDENCIAS, type Eleicao, type Era, type Presidencia } from './presidentes';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const fotoUrl = (id: string) => `${BASE}/img/presidentes/${id}.jpg`;

/** "1889-11-15" → "15/11/1889". */
function dia(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

/**
 * Tempo no cargo como frase inteira ("2 anos no cargo", "3 anos e 9 meses no cargo"), para o
 * tradutor não confundir com idade ("68 anos").
 */
function duracao(inicio: string, fim: string | null): string {
  const a = new Date(`${inicio}T12:00:00`);
  const b = new Date(`${fim ?? hojeIso()}T12:00:00`);
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  if (meses < 1) {
    const d = Math.round((b.getTime() - a.getTime()) / 86_400_000);
    return d === 1 ? '1 dia no cargo' : `${d} dias no cargo`;
  }
  const an = Math.floor(meses / 12);
  const m = meses % 12;
  if (!an) return m === 1 ? '1 mês no cargo' : `${m} meses no cargo`;
  if (!m) return an === 1 ? '1 ano no cargo' : `${an} anos no cargo`;
  if (an === 1) return m === 1 ? '1 ano e 1 mês no cargo' : `1 ano e ${m} meses no cargo`;
  return m === 1 ? `${an} anos e 1 mês no cargo` : `${an} anos e ${m} meses no cargo`;
}

const anoFrac = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return a + (m - 1) / 12 + (d - 1) / 365;
};

const ANO0 = 1889;
const ANO1 = 2027;
const PX_ANO = 16;

function eraDe(p: Presidencia): Era {
  return [...ERAS].reverse().find((e) => p.inicio >= e.inicio) ?? ERAS[0];
}

/* ------------------------------------------------------------------ rota (faixa do tempo) */

function Rota() {
  const largura = (ANO1 - ANO0) * PX_ANO;
  const x = (iso: string) => (anoFrac(iso) - ANO0) * PX_ANO;
  const exercidos = PRESIDENCIAS.filter((p) => !p.naoExerceu);
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          A rota no tempo, de 1889 a hoje
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
          Cada retrato fica no ano em que a pessoa assumiu; o comprimento das faixas é proporcional ao tempo. Arraste para o lado e toque num retrato
          para ir até ele.
        </Typography>
        <Box sx={{ overflowX: 'auto', pb: 1 }} tabIndex={0} aria-label="Linha do tempo dos Presidentes, de 1889 a hoje">
          <Box sx={{ position: 'relative', width: largura + 40, height: 190, mx: 1 }}>
            {/* eras */}
            {ERAS.map((e, i) => (
              <Box
                key={e.id}
                component="a"
                href={`#era-${e.id}`}
                sx={{
                  position: 'absolute',
                  left: x(e.inicio),
                  width: x(e.fim ?? `${ANO1}-01-05`) - x(e.inicio),
                  top: 0,
                  height: 26,
                  borderRadius: 1.5,
                  bgcolor: i % 2 ? 'action.selected' : 'action.hover',
                  color: 'text.primary',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  px: 1,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  '&:hover': { bgcolor: 'primary.container' },
                }}
              >
                {e.nome}
              </Box>
            ))}
            {/* faixas de cada mandato */}
            {exercidos.map((p) => (
              <Tooltip key={`f-${p.id}`} title={`${p.nome}: ${dia(p.inicio)} – ${p.fim ? dia(p.fim) : 'hoje'}`}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: x(p.inicio),
                    width: Math.max(2, x(p.fim ?? hojeIso()) - x(p.inicio) - 1),
                    top: 32,
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'primary.main',
                    opacity: 0.75,
                  }}
                />
              </Tooltip>
            ))}
            {/* retratos, em três alturas para não se sobreporem */}
            {exercidos.map((p, i) => (
              <Tooltip key={p.id} title={`${p.nome} (${p.inicio.slice(0, 4)}${p.fim ? `–${p.fim.slice(0, 4)}` : ' – hoje'})`}>
                <Box
                  component="a"
                  href={`#p-${p.id}`}
                  aria-label={`${p.nome}, desde ${p.inicio.slice(0, 4)}`}
                  sx={{ position: 'absolute', left: x(p.inicio) - 4, top: 48 + (i % 3) * 40, display: 'block' }}
                >
                  <Box sx={{ position: 'absolute', left: 4, top: -(8 + (i % 3) * 40), width: '1px', height: 8 + (i % 3) * 40, bgcolor: 'divider' }} />
                  <Avatar
                    src={p.foto ? fotoUrl(p.foto) : undefined}
                    alt=""
                    sx={{ width: 34, height: 34, border: 2, borderColor: 'background.paper', boxShadow: 1, '& img': { objectPosition: 'top' }, '&:hover': { transform: 'scale(1.25)' }, transition: 'transform .15s' }}
                  >
                    <GroupsRounded fontSize="small" />
                  </Avatar>
                </Box>
              </Tooltip>
            ))}
            {/* anos */}
            {Array.from({ length: Math.floor((ANO1 - 1890) / 10) + 1 }, (_, k) => 1890 + k * 10).map((ano) => (
              <Typography key={ano} variant="caption" color="text.secondary" sx={{ position: 'absolute', left: (ano - ANO0) * PX_ANO - 14, top: 170 }}>
                {ano}
              </Typography>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

const int = new Intl.NumberFormat('pt-BR');
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v?: number) => (v == null ? '' : ` (${pctFmt.format(v)}%)`);

/** "Eleito no 2º turno", "Turno único", "Eleição indireta". */
function comoVenceu(e: Eleicao) {
  if (e.tipo === 'indireta') return `Eleição indireta · ${e.colegio}`;
  if (e.turnos.length === 2) return 'Vitória no 2º turno';
  return e.ano >= 1989 ? 'Vitória no 1º turno' : 'Turno único (maioria simples)';
}

function Eleicoes({ p }: { p: Presidencia }) {
  if (!p.eleicoes?.length) {
    if (p.junta) return null;
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <HowToVoteRounded fontSize="small" color="primary" sx={{ mt: 0.25 }} />
        <Typography variant="body2">
          <strong>Votos:</strong> sem eleição para presidente; assumiu pela linha de sucessão.
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <HowToVoteRounded fontSize="small" color="primary" sx={{ mt: 0.25 }} />
      <Box sx={{ minWidth: 0 }}>
        {p.eleicoes.map((e) => (
          <Box key={e.ano} sx={{ mb: 0.5 }}>
            <Typography variant="body2">
              <strong>Eleição de {e.ano}:</strong> {comoVenceu(e)}
            </Typography>
            {e.turnos.map((t) => (
              <Typography key={t.turno} variant="body2" color="text.secondary" sx={{ pl: 1.5 }}>
                {e.tipo === 'indireta' ? '' : e.turnos.length === 2 || e.ano >= 1989 ? `${t.turno}º turno: ` : ''}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {int.format(t.votos)} votos{pct(t.pct)}
                </Box>
                {t.segundo ? ` · 2º colocado: ${t.segundo.nome}, ${int.format(t.segundo.votos)}${pct(t.segundo.pct)}` : ''}
              </Typography>
            ))}
            {e.nota && (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>
                {e.nota}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

/* ------------------------------------------------------------------ linha do tempo */

function Item({ p }: { p: Presidencia }) {
  const credito = p.foto ? CREDITOS_FOTO[p.foto] : undefined;
  const atual = p.fim == null;
  return (
    <Box id={`p-${p.id}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '20px 1fr', sm: '84px 24px 1fr' }, columnGap: { xs: 1, sm: 1.5 }, scrollMarginTop: 96 }}>
      <Typography variant="h6" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', pt: 2, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {p.inicio.slice(0, 4)}
      </Typography>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 2, bgcolor: 'divider' }} />
        <Box sx={{ position: 'relative', mt: 2.75, width: 14, height: 14, borderRadius: '50%', bgcolor: atual ? 'primary.main' : 'background.paper', border: 3, borderColor: 'primary.main' }} />
      </Box>
      <Card sx={{ my: 1, borderRadius: 4, ...(atual ? { outline: 2, outlineColor: 'primary.main' } : {}) }}>
        <CardContent sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, p: { xs: 2, md: 2.5 } }}>
          {p.foto ? (
            <Box sx={{ flexShrink: 0 }}>
              <Box component="img" src={fotoUrl(p.foto)} alt={`Retrato de ${p.nome}`} loading="lazy" sx={{ width: 104, height: 138, objectFit: 'cover', objectPosition: 'top', borderRadius: 3, bgcolor: 'action.hover', display: 'block' }} />
              {credito && (
                <Link href={credito.pagina} target="_blank" rel="noopener noreferrer" variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 104, fontSize: 10, lineHeight: 1.3, mt: 0.5 }}>
                  Foto: {credito.credito} ({credito.licenca})
                </Link>
              )}
            </Box>
          ) : (
            <Avatar sx={{ width: 104, height: 104, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <GroupsRounded sx={{ fontSize: 48 }} />
            </Avatar>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h5" component="h3" sx={{ fontWeight: 800 }}>
                {p.nome}
              </Typography>
              {atual && <Chip size="small" color="primary" label="Em exercício" />}
              {p.naoExerceu && <Chip size="small" label="Eleito, não tomou posse" />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {p.naoExerceu ? (
                `Eleito em 15/01/1985 · morreu em ${dia(p.fim!)}`
              ) : (
                <>
                  <span>{`${dia(p.inicio)} – ${p.fim ? dia(p.fim) : ''}`}</span>
                  {!p.fim && <span>hoje</span>}
                  <span> · </span>
                  <span>{duracao(p.inicio, p.fim)}</span>
                </>
              )}
            </Typography>
            {p.junta && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Integrantes:</strong> {p.junta.join(', ')}
              </Typography>
            )}
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <LoginRounded fontSize="small" color="primary" sx={{ mt: 0.25 }} />
                <Typography variant="body2">
                  <strong>Como chegou:</strong> {p.chegada}
                </Typography>
              </Stack>
              <Eleicoes p={p} />
              {p.saida && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <LogoutRounded fontSize="small" color="primary" sx={{ mt: 0.25 }} />
                  <Typography variant="body2">
                    <strong>Como saiu:</strong> {p.saida}
                  </Typography>
                </Stack>
              )}
              {p.marcos.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <FlagRounded fontSize="small" color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Marcos do período
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                      {p.marcos.map((m) => (
                        <Typography key={m} component="li" variant="body2">
                          {m}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </Stack>
              )}
              {p.nota && (
                <Typography variant="caption" color="text.secondary">
                  {p.nota}
                </Typography>
              )}
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export function PresidentesPage() {
  const porEra = useMemo(() => ERAS.map((e) => ({ e, itens: PRESIDENCIAS.filter((p) => eraDe(p).id === e.id) })), []);
  const pessoas = new Set(PRESIDENCIAS.filter((p) => !p.junta && !p.naoExerceu).map((p) => p.nome)).size;

  return (
    <>
      <PageHeader
        title="Presidentes do Brasil"
        subtitle={`De Deodoro da Fonseca a hoje: ${pessoas} pessoas exerceram a Presidência da República, além de duas juntas. Retratos, datas, como cada um chegou e saiu do cargo e os marcos de cada período.`}
      />
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {ERAS.map((e) => (
          <Chip key={e.id} component="a" clickable href={`#era-${e.id}`} label={`${e.nome} · ${e.inicio.slice(0, 4)}–${e.fim ? e.fim.slice(0, 4) : 'hoje'}`} />
        ))}
      </Stack>
      <Rota />

      {porEra.map(({ e, itens }) => (
        <Box key={e.id} component="section" id={`era-${e.id}`} sx={{ mb: 4, scrollMarginTop: 88 }}>
          <Box sx={{ p: 2, borderRadius: 4, bgcolor: 'primary.container', color: 'primary.onContainer', mb: 1 }}>
            <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
              {e.nome}
            </Typography>
            <Typography variant="body2">
              {dia(e.inicio)} – {e.fim ? dia(e.fim) : 'hoje'} · {e.resumo}
            </Typography>
          </Box>
          {itens.map((p) => (
            <Item key={p.id} p={p} />
          ))}
        </Box>
      ))}

      <Alert severity="info" sx={{ mb: 2 }}>
        A eleição de 2026 escolhe quem toma posse em 05/01/2027 (Constituição, art. 82, com a Emenda Constitucional 111, de 2021).
      </Alert>
      <Card>
        <CardContent>
          <Typography variant="h6" component="h2">
            Critério e fontes
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Todos aparecem no mesmo formato: como chegou ao cargo, votos na eleição (com o 2º colocado de cada turno), como saiu e marcos institucionais objetivos do período (Constituições, emendas e
            leis pelo número oficial, moedas, obras e fatos históricos registrados oficialmente). Não há avaliação de governo nem de pessoas. A ordem é
            cronológica. Os nomes de períodos históricos seguem a historiografia usual.
          </Typography>
          <Typography variant="body2" component="div" sx={{ mt: 1 }}>
            <strong>Fontes (dados públicos):</strong>{' '}
            <Link href="https://www.gov.br/planalto/pt-br/conheca-a-presidencia/acervo/galeria-de-presidentes" target="_blank" rel="noopener noreferrer">
              Galeria dos Presidentes, Biblioteca da Presidência da República <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>{' '}
            (datas e forma de posse) ·{' '}
            <Link href="https://www4.planalto.gov.br/legislacao" target="_blank" rel="noopener noreferrer">
              Portal da Legislação do Planalto <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>{' '}
            (Constituições, emendas e leis citadas) ·{' '}
            <Link href="https://dadosabertos.tse.jus.br/" target="_blank" rel="noopener noreferrer">
              Dados Abertos do TSE <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>{' '}
            (votos de 1945 a 2022: soma da votação oficial por estado; nas eleições de 1945 a 1989, a soma do acervo digitalizado pelo TSE pode diferir
            em poucas centenas de votos do total proclamado na época; percentuais sobre os votos válidos) · Eleições de 1891 a 1934 e indiretas:
            resultados proclamados pelo Congresso Nacional, pela Assembleia Constituinte ou pelo Colégio Eleitoral, como registrados na
            historiografia eleitoral (antes de 1932 não havia Justiça Eleitoral) · Retratos: Wikimedia Commons, com autor e licença em cada foto (na maioria, acervo oficial da
            Presidência e da Agência Brasil).
          </Typography>
        </CardContent>
      </Card>
    </>
  );
}
