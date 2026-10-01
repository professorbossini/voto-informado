import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRounded from '@mui/icons-material/VolumeOffRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import KeyboardRounded from '@mui/icons-material/KeyboardRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { SourceNote } from '@/components/election/SourceNote';
import {
  colaEntries,
  officesFor,
  resolve,
  type Ballot,
  type BallotCandidate,
  type ColaEntry,
  type Office,
  type Party,
} from '@/components/urna/ballot';
import { DigitBoxes } from '@/components/urna/DigitBoxes';
import { playConfirm, playFim, playKey } from '@/components/urna/sound';
import { UfPicker } from '@/components/urna/UfPicker';
import { useBallot } from '@/components/urna/useBallot';
import { UrnaKeypad, type UrnaKey } from '@/components/urna/UrnaKeypad';
import { UrnaScreen } from '@/components/urna/UrnaScreen';
import { useCola, useLocalState } from '@/data/localStore';
import { PageHeader } from '@/pages/PageHeader';

interface Voto {
  office: Office;
  kind: 'candidato' | 'legenda' | 'nulo' | 'branco';
  numero: string;
  candidate?: BallotCandidate;
  party?: Party;
}

const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

function votoTexto(v: Voto): string {
  if (v.kind === 'candidato' && v.candidate) return `${v.candidate.nome} (${v.candidate.party.sigla})`;
  if (v.kind === 'legenda' && v.party) return `Voto na legenda ${v.party.sigla}`;
  if (v.kind === 'branco') return 'Voto em branco';
  return 'Voto nulo';
}

function spell(digits: string) {
  return digits.split('').join(' ');
}

/* ------------------------------------------------------------------ pieces */

function Disclaimer() {
  return (
    <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3 }}>
      <b>Simulação educativa.</b> Não é uma ferramenta oficial do TSE e nenhum voto é registrado ou enviado. Os nomes,
      números e fotos vêm dos dados oficiais do TSE, só para você treinar a sequência da urna.
    </Alert>
  );
}

function ColaGuide({ entries, current }: { entries: ColaEntry[] | null; current: number }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <ListAltRounded fontSize="small" color="primary" />
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
            Sua cola
          </Typography>
        </Stack>
        {!entries ? (
          <Typography variant="body2" color="text.secondary">
            Sua cola é de outro estado ou ainda está vazia.{' '}
            <RouterLink to="/cola">Montar minha cola</RouterLink>
          </Typography>
        ) : (
          <Stack spacing={1.25} divider={<Divider flexItem />}>
            {entries.map((e, i) => (
              <Box
                key={e.office.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  opacity: i < current ? 0.55 : 1,
                  ...(i === current && { fontWeight: 600 }),
                }}
                aria-current={i === current ? 'step' : undefined}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color={i === current ? 'text.primary' : 'text.secondary'} sx={{ display: 'block', fontWeight: i === current ? 700 : 500 }}>
                    {i < current && <CheckRounded sx={{ fontSize: 13, verticalAlign: '-2px', mr: 0.5 }} />}
                    {e.office.label}
                  </Typography>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {e.kind === 'candidato' && `${e.candidate.nome} (${e.candidate.party.sigla})`}
                    {e.kind === 'legenda' && `Legenda ${e.party.sigla}`}
                    {(e.kind === 'vazio' || e.kind === 'invalido') && (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        Não escolhido
                      </Box>
                    )}
                  </Typography>
                </Box>
                <DigitBoxes
                  size="sm"
                  count={e.kind === 'legenda' ? 2 : e.office.digits}
                  value={e.kind === 'candidato' || e.kind === 'legenda' ? e.numero : ''}
                />
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function UrnaSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.45fr 1fr' }, gap: 2, p: 2, borderRadius: 4, bgcolor: 'background.subtle' }}>
      <Skeleton variant="rounded" height={360} />
      <Skeleton variant="rounded" height={360} />
    </Box>
  );
}

function Resumo({ votos, ufNome, onRestart }: { votos: Voto[]; ufNome: string; onRestart: () => void }) {
  return (
    <Card sx={{ mt: 3 }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Você concluiu a simulação
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Este é só um resumo do treino ({ufNome}). Nada foi gravado nem enviado.
        </Typography>
        <Stack divider={<Divider flexItem />} spacing={1.25}>
          {votos.map((v) => (
            <Stack
              key={v.office.key}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.5, sm: 2 }}
              sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {v.office.label}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {votoTexto(v)}
                </Typography>
              </Box>
              {v.kind !== 'branco' && v.numero ? (
                <DigitBoxes size="sm" count={v.kind === 'legenda' ? v.numero.length : v.office.digits} value={v.numero} />
              ) : (
                <Chip size="small" variant="soft" label="Branco" />
              )}
            </Stack>
          ))}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
          <Button variant="contained" startIcon={<RestartAltRounded />} onClick={onRestart}>
            Recomeçar
          </Button>
          <Button variant="tonal" component={RouterLink} to="/cola" startIcon={<ListAltRounded />}>
            Montar minha cola
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ machine */

function Urna({
  ballot,
  offices,
  muted,
  colaEntriesList,
  showCola,
}: {
  ballot: Ballot;
  offices: Office[];
  muted: boolean;
  colaEntriesList: ColaEntry[] | null;
  showCola: boolean;
}) {
  const [step, setStep] = useState(0);
  const [digits, setDigits] = useState('');
  const [branco, setBranco] = useState(false);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [pressed, setPressed] = useState<UrnaKey | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const resumoRef = useRef<HTMLDivElement>(null);

  const done = step >= offices.length;
  const office = done ? null : offices[step];
  const resolution = office ? resolve(ballot, office, digits, branco) : ({ kind: 'vazio' } as const);

  const sound = (fn: () => void) => {
    if (!muted) fn();
  };

  const reset = () => {
    setDigits('');
    setBranco(false);
    setNotice(null);
  };

  const restart = () => {
    reset();
    setVotos([]);
    setStep(0);
    setAnnounce(`Simulação reiniciada. Seu voto para ${offices[0].label}.`);
  };

  const avisoRepetido = useRef<string | null>(null);

  const record = (voto: Voto) => {
    const next = step + 1;
    setVotos((prev) => [...prev, voto]);
    setStep(next);
    reset();
    if (next >= offices.length) {
      sound(playFim);
      setAnnounce(`Voto confirmado: ${votoTexto(voto)}. Fim. A simulação terminou.`);
      window.setTimeout(() => resumoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 900);
    } else {
      sound(playConfirm);
      setAnnounce(`Voto confirmado: ${votoTexto(voto)}. Agora, seu voto para ${offices[next].label}.`);
    }
  };

  const press = (key: UrnaKey) => {
    window.clearTimeout(pressTimer.current);
    setPressed(key);
    pressTimer.current = window.setTimeout(() => setPressed(null), 140);
    if (!office) return;

    if (/^\d$/.test(key)) {
      if (branco || digits.length >= office.digits) return;
      const next = digits + key;
      sound(playKey);
      setDigits(next);
      setNotice(null);
      const r = resolve(ballot, office, next, false);
      let msg = `Número digitado: ${spell(next)}.`;
      if (r.kind === 'digitando' && r.party && next.length === 2) msg += ` Partido ${r.party.sigla}, ${r.party.nome}.`;
      if (r.kind === 'candidato') msg += ` ${r.candidate.nome}, ${r.candidate.party.sigla}. Aperte CONFIRMA para confirmar ou CORRIGE para reiniciar.`;
      if (r.kind === 'legenda') msg += ` Número errado. Voto de legenda ${r.party.sigla}.`;
      if (r.kind === 'nulo') msg += ' Número errado. Voto nulo.';
      setAnnounce(msg);
      return;
    }

    if (key === 'corrige') {
      sound(playKey);
      reset();
      setAnnounce(`Voto reiniciado. Seu voto para ${office.label}.`);
      return;
    }

    if (key === 'branco') {
      sound(playKey);
      if (digits) {
        const msg = 'Para votar em branco, aperte CORRIGE antes para apagar o número.';
        setNotice(msg);
        setAnnounce(msg);
        return;
      }
      setBranco(true);
      setNotice(null);
      setAnnounce('Voto em branco. Aperte CONFIRMA para confirmar ou CORRIGE para reiniciar.');
      return;
    }

    // CONFIRMA
    const r = resolution;
    if (r.kind === 'vazio') {
      const msg = 'Digite o número da sua escolha ou aperte BRANCO.';
      setNotice(msg);
      setAnnounce(msg);
      return;
    }
    if (r.kind === 'digitando') {
      if (office.deputy && digits.length === 2 && r.party) {
        record({ office, kind: 'legenda', numero: digits, party: r.party });
        return;
      }
      const msg = `Digite os ${office.digits} números ou aperte CORRIGE.`;
      setNotice(msg);
      setAnnounce(msg);
      return;
    }
    if (r.kind === 'candidato') {
      if (office.key === 'senador-2') {
        const first = votos.find((v) => v.office.key === 'senador-1');
        if (first?.candidate?.sq === r.candidate.sq) {
          // Regra do TSE: repetir no 2º voto a pessoa do 1º faz o segundo voto ser nulo (a urna não recusa).
          if (avisoRepetido.current === digits) {
            avisoRepetido.current = null;
            record({ office, kind: 'nulo', numero: digits });
            return;
          }
          avisoRepetido.current = digits;
          const msg =
            'Você já votou nesta pessoa na 1ª vaga. Se confirmar, este 2º voto para o Senado será considerado NULO (regra do TSE). Aperte CONFIRMA para anular ou CORRIGE para escolher outra pessoa.';
          sound(playKey);
          setNotice(msg);
          setAnnounce(msg);
          return;
        }
      }
      record({ office, kind: 'candidato', numero: digits, candidate: r.candidate });
      return;
    }
    if (r.kind === 'legenda') {
      record({ office, kind: 'legenda', numero: digits, party: r.party });
      return;
    }
    if (r.kind === 'branco') {
      record({ office, kind: 'branco', numero: '' });
      return;
    }
    record({ office, kind: 'nulo', numero: digits });
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    let key: UrnaKey | null = null;
    if (/^[0-9]$/.test(e.key)) key = e.key as UrnaKey;
    else if (e.key === 'Backspace' || e.key === 'Delete') key = 'corrige';
    else if (e.key === 'Enter') key = 'confirma';
    else if (e.key === 'b' || e.key === 'B') key = 'branco';
    if (!key) return;
    e.preventDefault();
    press(key);
  });

  useEffect(() => {
    if (done) return;
    const handler = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [done]);

  useEffect(() => () => window.clearTimeout(pressTimer.current), []);

  return (
    <>
      <Box sx={srOnly} aria-live="polite" aria-atomic="true">
        {announce}
      </Box>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mb: 2 }} aria-label="Etapas da votação">
        {offices.map((o, i) => (
          <Chip
            key={o.key}
            size="small"
            variant={i === step ? 'filled' : 'soft'}
            color={i === step ? 'primary' : 'default'}
            icon={i < step ? <CheckRounded /> : undefined}
            label={`${i + 1}. ${o.label}`}
            aria-current={i === step ? 'step' : undefined}
            sx={{ opacity: i < step ? 0.7 : 1 }}
          />
        ))}
        <Chip size="small" variant={done ? 'filled' : 'soft'} color={done ? 'primary' : 'default'} label="Fim" />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: showCola ? 'minmax(0, 1fr) 300px' : 'minmax(0, 1fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        {/* The machine body */}
        <Box
          sx={{
            bgcolor: '#d9d6cc',
            backgroundImage: 'linear-gradient(180deg, #e4e1d8 0%, #cfccc2 100%)',
            borderRadius: { xs: '16px', sm: '22px' },
            p: { xs: 1.25, sm: 2.5 },
            boxShadow: '0 1px 0 #fff inset, 0 18px 40px -18px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.15)',
            border: '1px solid #b9b5aa',
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.45fr) minmax(260px, 1fr)' },
            gap: { xs: 1.5, sm: 2.5 },
            maxWidth: 920,
          }}
        >
          <UrnaScreen office={office} digits={digits} resolution={resolution} notice={notice} fim={done} />
          <UrnaKeypad onKey={press} pressed={pressed} disabled={done} />
        </Box>

        {showCola && (
          <Box sx={{ maxWidth: { xs: 920, lg: 'none' } }}>
            <ColaGuide entries={colaEntriesList} current={step} />
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, alignItems: 'center', color: 'text.secondary', display: { xs: 'none', sm: 'flex' } }}>
        <KeyboardRounded fontSize="small" />
        <Typography variant="caption">
          Teclado: números <kbd>0</kbd>–<kbd>9</kbd> · <kbd>Enter</kbd> confirma · <kbd>Backspace</kbd> corrige · <kbd>B</kbd> branco
        </Typography>
      </Stack>

      <Box ref={resumoRef} sx={{ scrollMarginTop: 96 }}>
        {done && <Resumo votos={votos} ufNome={ballot.nomeUf} onRestart={restart} />}
      </Box>
    </>
  );
}

/* ------------------------------------------------------------------ page */

export function SimuladorPage() {
  const [params] = useSearchParams();
  const colaMode = params.get('cola') === '1';
  const { cola } = useCola();
  const [uf, setUf] = useState<string | null>(() => (colaMode && cola.uf && cola.uf !== 'BR' ? cola.uf : null));
  const [muted, setMuted] = useLocalState<boolean>('vi:urna-mudo', false);
  const [run, setRun] = useState(0);
  const q = useBallot(uf);
  const ballot = q.data && q.data.uf === uf ? q.data : null;

  const offices = useMemo(() => (ballot ? officesFor(ballot.uf, ballot.vagas) : []), [ballot]);
  const entries = useMemo(() => {
    if (!ballot || !colaMode || cola.uf !== ballot.uf) return null;
    const list = colaEntries(ballot, offices, cola.escolhas);
    return list.some((e) => e.kind === 'candidato' || e.kind === 'legenda') ? list : null;
  }, [ballot, colaMode, cola, offices]);

  return (
    <Box>
      <PageHeader
        title="Simulador de urna"
        subtitle="Treine a ordem dos votos antes do dia 4 de outubro: deputados, senado (duas vagas), governo e Presidência."
        actions={
          <Tooltip title={muted ? 'Ativar sons' : 'Desativar sons'}>
            <IconButton
              onClick={() => setMuted((m) => !m)}
              aria-pressed={muted}
              aria-label={muted ? 'Ativar sons da urna' : 'Desativar sons da urna'}
              sx={(theme) => ({ border: `1px solid ${theme.vars.palette.divider}` })}
            >
              {muted ? <VolumeOffRounded /> : <VolumeUpRounded />}
            </IconButton>
          </Tooltip>
        }
      />
      <Disclaimer />

      {!uf ? (
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Primeiro, escolha o seu estado
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              A urna mostra as candidaturas do estado onde você vota.
            </Typography>
            <UfPicker value={uf} onChange={setUf} />
          </CardContent>
        </Card>
      ) : (
        <>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Urna de <b>{ballot?.nomeUf ?? uf}</b>
            </Typography>
            <Button size="small" variant="text" onClick={() => setUf(null)}>
              Trocar estado
            </Button>
            {ballot && (
              <Button size="small" variant="text" startIcon={<RestartAltRounded />} onClick={() => setRun((n) => n + 1)}>
                Recomeçar
              </Button>
            )}
          </Stack>

          {q.error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={q.reload}>
                  Tentar de novo
                </Button>
              }
            >
              Não foi possível carregar as candidaturas deste estado agora.
            </Alert>
          ) : !ballot ? (
            <UrnaSkeleton />
          ) : (
            <Urna
              key={`${ballot.uf}-${run}`}
              ballot={ballot}
              offices={offices}
              muted={muted}
              colaEntriesList={entries}
              showCola={colaMode}
            />
          )}

          <SourceNote keys={['tse_candidatos', 'tse_complementar', 'tse_fotos']} sx={{ mt: 2 }} />
        </>
      )}
    </Box>
  );
}
