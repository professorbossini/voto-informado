import { useCallback, useMemo, useState, type FocusEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  GlobalStyles,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PrintRounded from '@mui/icons-material/PrintRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import TouchAppRounded from '@mui/icons-material/TouchAppRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import PhonelinkEraseRounded from '@mui/icons-material/PhonelinkEraseRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded';
import { Link as RouterLink } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CandidateSearch } from '@/components/election/CandidateSearch';
import { SourceNote } from '@/components/election/SourceNote';
import { useNotify } from '@/components/feedback/notificationsContext';
import {
  colaEntries,
  colaText,
  LEGENDA_PREFIX,
  officesFor,
  partiesFor,
  vagasLabel,
  type Ballot,
  type ColaEntry,
  type Office,
} from '@/components/urna/ballot';
import { canShare, copyText } from '@/components/urna/clipboard';
import { DigitBoxes } from '@/components/urna/DigitBoxes';
import { UfPicker } from '@/components/urna/UfPicker';
import { useBallot } from '@/components/urna/useBallot';
import { CARGO_LABEL, dateLong } from '@/data/format';
import { useCola } from '@/data/localStore';
import { useMeta } from '@/data/MetaContext';
import type { Cargo } from '@/data/types';
import { PageHeader } from '@/pages/PageHeader';

/* ------------------------------------------------------------------ print */

/** Printing shows only the cola sheet, in black and white, filling the page. */
function PrintStyles() {
  return (
    <GlobalStyles
      styles={{
        '@media print': {
          '@page': { margin: '12mm' },
          'html, body': { background: '#fff !important', color: '#000 !important' },
          'header, nav, footer, .MuiAppBar-root, .MuiBottomNavigation-root, .MuiAppBar-root + *, .vi-no-print': {
            display: 'none !important',
          },
          'body *': { visibility: 'hidden' },
          '.vi-cola-print, .vi-cola-print *': { visibility: 'visible', color: '#000 !important' },
          'main, .vi-print-col': {
            position: 'static !important',
            maxWidth: 'none !important',
            width: '100% !important',
            flexBasis: '100% !important',
            padding: '0 !important',
            margin: '0 !important',
            transform: 'none !important',
          },
          '.vi-cola-print': {
            position: 'static',
            width: '100%',
            margin: 0,
            boxShadow: 'none !important',
            border: '2px solid #000 !important',
            background: '#fff !important',
            breakInside: 'avoid',
          },
          '.vi-cola-print .vi-digit': {
            borderColor: '#000 !important',
            background: '#fff !important',
            width: '40px !important',
            height: '52px !important',
            fontSize: '1.75rem !important',
          },
          '.vi-cola-print img': { filter: 'grayscale(1)' },
          '.vi-cola-print .MuiTypography-body2': { fontSize: '1.05rem !important' },
          '.vi-cola-print .vi-row': { breakInside: 'avoid' },
          '.vi-cola-print .vi-print-hide': { display: 'none !important' },
        },
      }}
    />
  );
}

/* ------------------------------------------------------------------ office editor */

function OfficeHeader({ index, office, status }: { index: number; office: Office; status: string }) {
  const vagas = vagasLabel(office.vagas);
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
      <Box
        aria-hidden
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: 'primary.container',
          color: 'primary.onContainer',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" component="h3" sx={{ lineHeight: 1.25 }}>
          {office.label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {[vagas, `${office.digits} dígitos`].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Chip size="small" variant="soft" label={status} />
    </Stack>
  );
}

function OfficeEditor({
  index,
  office,
  entry,
  ballot,
  otherSenateSq,
  error,
  onPick,
  onLegenda,
  onClear,
}: {
  index: number;
  office: Office;
  entry: ColaEntry;
  ballot: Ballot;
  /** SQ chosen for the other senate seat (cannot be repeated). */
  otherSenateSq: string | null;
  error: string | null;
  onPick: (sq: string) => void;
  onLegenda: (partyNumber: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showList, setShowList] = useState(false);
  const searchUf = office.cargo === 'presidente' ? 'BR' : ballot.uf;
  const filter = useCallback(
    (o: { uf: string; cargo: Cargo }) => o.uf === searchUf && o.cargo === office.cargo,
    [searchUf, office.cargo],
  );
  const hasPick = entry.kind === 'candidato' || entry.kind === 'legenda';
  const parties = office.deputy ? partiesFor(ballot, office.cargo) : [];
  const list = office.deputy ? [] : (ballot.lists[office.cargo as 'governador' | 'senador' | 'presidente'] ?? []);

  const pick = (sq: string) => {
    onPick(sq);
    setEditing(false);
    setShowList(false);
  };

  const status = entry.kind === 'candidato' ? 'Escolhido' : entry.kind === 'legenda' ? 'Legenda' : 'Não escolhido';

  return (
    <Card component="section" aria-label={office.label}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <OfficeHeader index={index} office={office} status={status} />

        {office.cargo === 'senador' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Em 2026 são duas vagas no Senado: você vota duas vezes, em duas pessoas diferentes. Se repetir o mesmo
            nome, o segundo voto é anulado (regra do TSE).
          </Typography>
        )}

        {hasPick && !editing ? (
          <Stack spacing={2}>
            {entry.kind === 'candidato' && (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <CandidatePhoto src={entry.candidate.foto} alt={`Foto de ${entry.candidate.nome}`} width={64} rounded={10} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                    {entry.candidate.nome}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.candidate.party.sigla} · {entry.candidate.party.nome}
                  </Typography>
                  {entry.candidate.companheiros.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {entry.candidate.companheiros.map((c) => `${CARGO_LABEL[c.cargo]}: ${c.nome}`).join(' · ')}
                    </Typography>
                  )}
                </Box>
              </Stack>
            )}
            {entry.kind === 'legenda' && (
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 64,
                    aspectRatio: '3 / 4',
                    borderRadius: '10px',
                    bgcolor: 'background.subtle',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'text.secondary',
                    flexShrink: 0,
                  }}
                >
                  <FlagRounded />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Voto na legenda {entry.party.sigla}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {entry.party.nome}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    O voto conta para o partido, não para uma pessoa específica.
                  </Typography>
                </Box>
              </Stack>
            )}
            <Box sx={{ overflowX: 'auto' }}>
              <DigitBoxes
                size="lg"
                count={entry.kind === 'legenda' ? 2 : office.digits}
                value={entry.numero}
              />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="tonal" startIcon={<SwapHorizRounded />} onClick={() => setEditing(true)}>
                Trocar
              </Button>
              <Button size="small" variant="text" color="inherit" startIcon={<CloseRounded />} onClick={onClear}>
                Remover
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {entry.kind === 'invalido' && (
              <Alert severity="warning">
                A escolha salva antes não está mais na urna, segundo os dados do TSE. Escolha de novo, se quiser.
              </Alert>
            )}
            <CandidateSearch
              filter={filter}
              onPick={pick}
              placeholder={`Busque por nome ou número`}
              size="small"
            />
            {list.length > 0 && (
              <Box>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowList((v) => !v)}
                  aria-expanded={showList}
                  endIcon={<ExpandMoreRounded sx={{ transform: showList ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />}
                >
                  Ver todas as {list.length} candidaturas (ordem alfabética)
                </Button>
                <Collapse in={showList} unmountOnExit>
                  <Box
                    role="list"
                    sx={(theme) => ({
                      mt: 1,
                      border: `1px solid ${theme.vars.palette.divider}`,
                      borderRadius: 2,
                      maxHeight: 320,
                      overflowY: 'auto',
                    })}
                  >
                    {list.map((c) => {
                      const taken = otherSenateSq === c.sq;
                      return (
                        <ButtonBase
                          key={c.sq}
                          role="listitem"
                          disabled={taken}
                          onClick={() => pick(c.sq)}
                          sx={(theme) => ({
                            width: '100%',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            gap: 1.5,
                            px: 1.5,
                            py: 1,
                            borderBottom: `1px solid ${theme.vars.palette.divider}`,
                            '&:last-of-type': { borderBottom: 0 },
                            '&:hover': { bgcolor: 'action.hover' },
                            '&.Mui-disabled': { opacity: 0.55 },
                          })}
                        >
                          <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 40 }}>{c.numero}</Typography>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {c.nome}{' '}
                              <Typography component="span" variant="caption" color="text.secondary">
                                ({c.party.sigla})
                              </Typography>
                            </Typography>
                            {taken && (
                              <Typography variant="caption" color="text.secondary">
                                Já escolhido(a) na outra vaga do Senado
                              </Typography>
                            )}
                          </Box>
                        </ButtonBase>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            )}
            {office.deputy && parties.length > 0 && (
              <TextField
                select
                size="small"
                label="Ou vote só no partido (legenda)"
                value=""
                onChange={(e) => {
                  onLegenda(e.target.value);
                  setEditing(false);
                }}
                helperText="Lista dos partidos com candidaturas para este cargo no seu estado."
              >
                {parties.map((p) => (
                  <MenuItem key={p.numero} value={p.numero}>
                    <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, mr: 1.5 }}>
                      {p.numero}
                    </Box>
                    {p.sigla}
                    <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontSize: '0.8125rem' }}>
                      {p.nome}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            )}
            {error && <Alert severity="warning">{error}</Alert>}
            {hasPick && editing && (
              <Box>
                <Button size="small" variant="text" color="inherit" onClick={() => setEditing(false)}>
                  Cancelar troca
                </Button>
              </Box>
            )}
            {!hasPick && (
              <Typography variant="caption" color="text.secondary">
                Se preferir, deixe este cargo sem escolha: ele aparece como “Não escolhido” na cola.
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ sheet */

function ColaSheet({ entries, ufNome, dataEleicao }: { entries: ColaEntry[]; ufNome: string; dataEleicao: string | null }) {
  return (
    <Card className="vi-cola-print" sx={(theme) => ({ border: `2px solid ${theme.vars.palette.text.primary}` })}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography variant="overline" color="text.secondary">
          Eleições 2026 · 1º turno{dataEleicao ? ` · ${dataEleicao}` : ''}
        </Typography>
        <Typography variant="h5" component="h2" sx={{ lineHeight: 1.2 }}>
          Minha cola
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {ufNome} · na ordem da urna
        </Typography>
        <Stack divider={<Divider flexItem />} spacing={1.5}>
          {entries.map((e) => {
            const numero = e.kind === 'candidato' || e.kind === 'legenda' ? e.numero : '';
            return (
              <Box key={e.office.key} className="vi-row" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: 'space-between' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                    {e.office.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {e.kind === 'candidato' && `${e.candidate.nome} (${e.candidate.party.sigla})`}
                    {e.kind === 'legenda' && `Legenda ${e.party.sigla}`}
                    {(e.kind === 'vazio' || e.kind === 'invalido') && (
                      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                        Não escolhido
                      </Box>
                    )}
                  </Typography>
                </Box>
                <DigitBoxes size={e.office.digits >= 5 ? 'sm' : 'md'} count={e.kind === 'legenda' ? 2 : e.office.digits} value={numero} />
              </Box>
            );
          })}
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0 }}>
          Na cabine, digite o número, confira nome e foto na tela e aperte CONFIRMA. Celular não entra na cabine.
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5 }}>
          Números conforme os dados oficiais do TSE.
        </Typography>
      </CardContent>
    </Card>
  );
}

function SheetSkeleton() {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={150} />
          ))}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Skeleton variant="rounded" height={420} />
      </Grid>
    </Grid>
  );
}

/* ------------------------------------------------------------------ page */

export function ColaPage() {
  const { meta } = useMeta();
  const { cola, setCola } = useCola();
  const notify = useNotify();
  // A pick saved from a presidential page could carry 'BR'; the cola needs a real state.
  const uf = cola.uf && cola.uf !== 'BR' ? cola.uf : null;
  const q = useBallot(uf);
  const ballot = q.data && q.data.uf === uf ? q.data : null;
  const [senateError, setSenateError] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [changingUf, setChangingUf] = useState(false);

  const ufInfo = meta?.ufs.find((u) => u.uf === uf);
  const offices = useMemo(() => (uf ? officesFor(uf, ufInfo?.vagas ?? ballot?.vagas) : []), [uf, ufInfo, ballot]);
  const entries = useMemo(() => (ballot ? colaEntries(ballot, offices, cola.escolhas) : []), [ballot, offices, cola.escolhas]);
  const dataEleicao = meta ? dateLong(meta.eleicao.data_1turno) : null;
  const ufNome = ballot?.nomeUf ?? ufInfo?.nome ?? uf ?? '';
  const text = ballot ? colaText(entries, ufNome, dataEleicao) : '';
  const chosen = entries.filter((e) => e.kind === 'candidato' || e.kind === 'legenda').length;

  const setPick = (key: string, value: string | null) => {
    setCola((prev) => {
      const escolhas = { ...prev.escolhas };
      if (value) escolhas[key] = value;
      else delete escolhas[key];
      return { ...prev, escolhas };
    });
  };

  const changeUf = (next: string) => {
    setChangingUf(false);
    if (next === cola.uf) return;
    const hadStatePicks = Object.keys(cola.escolhas).some((k) => k !== 'presidente');
    setCola((prev) => {
      const escolhas: Record<string, string> = {};
      if (prev.escolhas.presidente) escolhas.presidente = prev.escolhas.presidente;
      return { uf: next, escolhas };
    });
    setSenateError(null);
    if (hadStatePicks) notify('Estado alterado. As escolhas estaduais foram apagadas; Presidente foi mantido.', 'info');
  };

  const pickCandidate = (office: Office, sq: string) => {
    if (!ballot) return;
    const c = ballot.bySq.get(sq);
    if (!c || !c.naUrna || c.cargo !== office.cargo) {
      notify('Esta candidatura não está na urna deste cargo, segundo o TSE.', 'warning');
      return;
    }
    if (office.cargo === 'senador') {
      const other = office.key === 'senador-1' ? 'senador-2' : 'senador-1';
      if (cola.escolhas[other] === sq) {
        const msg = 'Escolha duas pessoas diferentes para as duas vagas.';
        setSenateError(`${office.key}|${msg}`);
        notify(msg, 'warning');
        return;
      }
    }
    setSenateError(null);
    setPick(office.key, sq);
  };

  const imprimir = () => window.print();

  const copiar = async () => {
    const ok = await copyText(text);
    if (ok) notify('Texto da cola copiado.');
    else setCopyFallback(text);
  };

  const compartilhar = async () => {
    try {
      await navigator.share({ title: 'Minha cola · Eleições 2026', text });
    } catch {
      /* user cancelled or share unavailable */
    }
  };

  const limpar = () => {
    if (!window.confirm('Apagar todas as escolhas desta cola?')) return;
    setCola((prev) => ({ ...prev, escolhas: {} }));
    setSenateError(null);
  };

  return (
    <Box>
      <PrintStyles />
      <Box className="vi-no-print">
        <PageHeader
          title="Minha cola"
          subtitle="Anote os números das suas escolhas, na ordem em que a urna pede, para levar no dia da votação."
        />

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Alert severity="success" icon={<LockRounded />} sx={{ height: '100%' }}>
              Sua cola fica salva só neste aparelho. Nada é enviado para nenhum lugar.
            </Alert>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Alert severity="warning" icon={<PhonelinkEraseRounded />} sx={{ height: '100%' }}>
              Celular não é permitido na cabine de votação. Imprima a cola ou copie os números à mão num papel.
            </Alert>
          </Grid>
        </Grid>

        {!uf || changingUf ? (
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Onde você vota?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Deputados, senado e governo dependem do estado do seu título de eleitor.
                {uf && ' Ao trocar de estado, as escolhas estaduais são apagadas (Presidente é mantido).'}
              </Typography>
              <UfPicker value={uf} onChange={changeUf} />
              {uf && (
                <Button sx={{ mt: 2 }} variant="text" onClick={() => setChangingUf(false)}>
                  Manter {ufNome}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2.5 }}>
            <Typography variant="body1">
              Estado: <b>{ufNome}</b>
            </Typography>
            <Button size="small" variant="text" onClick={() => setChangingUf(true)}>
              Trocar estado
            </Button>
          </Stack>
        )}
      </Box>

      {uf && !changingUf && (
        <>
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
            <SheetSkeleton />
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 7 }} className="vi-no-print">
                <Stack spacing={2}>
                  {offices.map((office, i) => {
                    const other = office.key === 'senador-1' ? 'senador-2' : office.key === 'senador-2' ? 'senador-1' : null;
                    const otherPick = other ? cola.escolhas[other] : undefined;
                    const [errKey, errMsg] = senateError?.split('|') ?? [];
                    return (
                      <OfficeEditor
                        key={`${uf}-${office.key}`}
                        index={i}
                        office={office}
                        entry={entries[i]}
                        ballot={ballot}
                        otherSenateSq={otherPick && !otherPick.startsWith(LEGENDA_PREFIX) ? otherPick : null}
                        error={errKey === office.key ? errMsg : null}
                        onPick={(sq) => pickCandidate(office, sq)}
                        onLegenda={(n) => setPick(office.key, `${LEGENDA_PREFIX}${n}`)}
                        onClear={() => setPick(office.key, null)}
                      />
                    );
                  })}
                  <SourceNote keys={['tse_candidatos', 'tse_complementar', 'tse_fotos', 'tse_vagas']} />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }} className="vi-print-col">
                <Box className="vi-print-col" sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
                  <ColaSheet entries={entries} ufNome={ufNome} dataEleicao={dataEleicao} />
                  <Stack spacing={1.25} sx={{ mt: 2 }} className="vi-no-print">
                    <Typography variant="caption" color="text.secondary">
                      {chosen} de {entries.length} cargos escolhidos
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      <Button variant="contained" startIcon={<PrintRounded />} onClick={imprimir}>
                        Imprimir
                      </Button>
                      <Button variant="tonal" startIcon={<ContentCopyRounded />} onClick={() => void copiar()}>
                        Copiar texto
                      </Button>
                      {canShare() && (
                        <Button variant="tonal" startIcon={<ShareRounded />} onClick={() => void compartilhar()}>
                          Compartilhar
                        </Button>
                      )}
                    </Stack>
                    <Button
                      variant="outlined"
                      component={RouterLink}
                      to="/simulador?cola=1"
                      startIcon={<TouchAppRounded />}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Treinar na urna com minha cola
                    </Button>
                    {chosen > 0 && (
                      <Button
                        size="small"
                        variant="text"
                        color="inherit"
                        startIcon={<DeleteSweepRounded />}
                        onClick={limpar}
                        sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
                      >
                        Limpar todas as escolhas
                      </Button>
                    )}
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          )}
        </>
      )}

      <Dialog open={copyFallback != null} onClose={() => setCopyFallback(null)} fullWidth maxWidth="sm">
        <DialogTitle>Copie o texto da cola</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Não foi possível copiar automaticamente. Selecione o texto abaixo e copie.
          </Typography>
          <TextField
            value={copyFallback ?? ''}
            multiline
            fullWidth
            minRows={8}
            slotProps={{ htmlInput: { readOnly: true, onFocus: (e: FocusEvent<HTMLTextAreaElement>) => e.target.select() } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyFallback(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
