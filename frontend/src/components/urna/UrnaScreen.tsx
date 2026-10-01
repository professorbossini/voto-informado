import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CARGO_LABEL } from '@/data/format';
import type { BallotCandidate, Office, Resolution } from './ballot';
import { DigitBoxes } from './DigitBoxes';

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const FONT = 'Arial, Helvetica, "Liberation Sans", sans-serif';

/** Fixed light "LCD" look, independent of the site theme, like the real device. */
const screenSx = {
  bgcolor: '#f3f3ef',
  color: '#000',
  fontFamily: FONT,
  borderRadius: '6px',
  border: '10px solid #2b2b2d',
  boxShadow: 'inset 0 0 0 1px #bbb, 0 1px 0 rgba(255,255,255,0.4)',
  minHeight: { xs: 330, sm: 360 },
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
} as const;

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Typography
      component="div"
      sx={{ fontFamily: FONT, fontSize: { xs: '0.875rem', sm: '1rem' }, lineHeight: 1.35, display: 'flex', columnGap: 0.75, flexWrap: 'wrap' }}
    >
      <Box component="span" sx={{ minWidth: { xs: 64, sm: 76 }, flexShrink: 0 }}>
        {label}
      </Box>
      <Box component="span" sx={{ fontWeight: 700, minWidth: 0 }}>
        {children}
      </Box>
    </Typography>
  );
}

function Big({ children, blink = false }: { children: ReactNode; blink?: boolean }) {
  return (
    <Typography
      component="div"
      sx={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: { xs: '1.75rem', sm: '2.25rem' },
        textAlign: 'center',
        letterSpacing: '0.02em',
        my: 1.5,
        ...(blink && { animation: `${pulse} 1.4s ease-in-out infinite` }),
      }}
    >
      {children}
    </Typography>
  );
}

const photoSx = { border: '1px solid #777', bgcolor: '#e2e2de', color: '#888' };

function Photos({ candidate, office }: { candidate: BallotCandidate; office: Office }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Box sx={{ width: { xs: 76, sm: 104 } }}>
          <CandidatePhoto src={candidate.foto} alt={`Foto de ${candidate.nome}`} width="100%" rounded={2} sx={photoSx} />
        </Box>
        <Typography sx={{ fontFamily: FONT, fontSize: '0.6875rem', mt: 0.25 }}>
          {CARGO_LABEL[candidate.cargo].replace('(a)', '')}
        </Typography>
      </Box>
      {candidate.companheiros.map((c, i) => (
        <Box key={`${c.cargo}-${i}`} sx={{ textAlign: 'center', display: { xs: office.cargo === 'senador' ? 'none' : 'block', sm: 'block' } }}>
          <Box sx={{ width: { xs: 52, sm: 68 }, mx: 'auto' }}>
            <CandidatePhoto src={c.foto} alt={`Foto de ${c.nome}`} width="100%" rounded={2} sx={photoSx} />
          </Box>
          <Typography sx={{ fontFamily: FONT, fontSize: '0.625rem', mt: 0.25 }}>
            {CARGO_LABEL[c.cargo].replace('(a)', '')}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Screen of the simulated voting machine. Pure presentation: the page decides
 * what each key does.
 */
export function UrnaScreen({
  office,
  digits,
  resolution,
  notice,
  fim = false,
}: {
  office: Office | null;
  digits: string;
  resolution: Resolution;
  notice: string | null;
  fim?: boolean;
}) {
  if (fim || !office) {
    return (
      <Box sx={{ ...screenSx, alignItems: 'center', justifyContent: 'center' }} role="region" aria-label="Tela da urna">
        <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: { xs: '5rem', sm: '7rem' }, letterSpacing: '0.04em', lineHeight: 1 }}>
          FIM
        </Typography>
      </Box>
    );
  }

  const r = resolution;
  const showNumber = r.kind !== 'branco';
  const complete = r.kind === 'candidato' || r.kind === 'nulo' || r.kind === 'legenda' || r.kind === 'branco';
  const legendaReady = r.kind === 'digitando' && office.deputy && digits.length === 2 && r.party != null;
  const party = r.kind === 'digitando' || r.kind === 'legenda' ? r.party : null;

  return (
    <Box sx={screenSx} role="region" aria-label="Tela da urna">
      <Box sx={{ flex: 1, display: 'flex', gap: 1.5, p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography sx={{ fontFamily: FONT, fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 700 }}>
            SEU VOTO PARA
          </Typography>
          <Typography
            sx={{ fontFamily: FONT, fontSize: { xs: '1.125rem', sm: '1.5rem' }, fontWeight: 700, textAlign: 'center', my: { xs: 0.5, sm: 1 } }}
          >
            {office.urnaLabel}
          </Typography>

          {showNumber && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: FONT, fontSize: { xs: '0.875rem', sm: '1rem' } }}>Número:</Typography>
              <DigitBoxes
                count={office.digits}
                value={digits}
                tone="urna"
                size={office.digits >= 5 ? 'sm' : 'md'}
                cursor={digits.length < office.digits}
              />
            </Box>
          )}

          {r.kind === 'candidato' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, minWidth: 0, wordBreak: 'break-word' }}>
              <Line label="Nome:">{r.candidate.nomeUrna}</Line>
              <Line label="Partido:">
                {r.candidate.party.sigla}
                <Box component="span" sx={{ fontWeight: 400, display: 'block', fontSize: '0.8125rem' }}>
                  {r.candidate.party.nome}
                </Box>
              </Line>
              {r.candidate.companheiros.map((c, i) => (
                <Line key={`${c.cargo}-${i}`} label={`${CARGO_LABEL[c.cargo].replace('(a)', '')}:`}>
                  {c.nomeUrna}
                </Line>
              ))}
            </Box>
          )}

          {party && (
            <Box sx={{ mt: 1 }}>
              {r.kind === 'legenda' && <Big>NÚMERO ERRADO</Big>}
              <Line label="Partido:">
                {party.sigla}
                <Box component="span" sx={{ fontWeight: 400, display: 'block', fontSize: '0.8125rem' }}>
                  {party.nome}
                </Box>
              </Line>
              {r.kind === 'legenda' && <Big blink>VOTO DE LEGENDA</Big>}
            </Box>
          )}

          {r.kind === 'nulo' && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontFamily: FONT, fontWeight: 700, fontSize: { xs: '1rem', sm: '1.25rem' } }}>NÚMERO ERRADO</Typography>
              <Big blink>VOTO NULO</Big>
            </Box>
          )}

          {r.kind === 'branco' && (
            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
              <Big blink>VOTO EM BRANCO</Big>
            </Box>
          )}

          {notice && (
            <Box
              role="alert"
              sx={{ mt: 'auto', border: '2px solid #000', p: 1, fontFamily: FONT, fontSize: { xs: '0.8125rem', sm: '0.875rem' }, fontWeight: 700, bgcolor: '#fff' }}
            >
              {notice}
            </Box>
          )}
        </Box>

        {r.kind === 'candidato' && <Photos candidate={r.candidate} office={office} />}
      </Box>

      {(complete || legendaReady) && (
        <Box sx={{ borderTop: '2px solid #000', px: { xs: 1.5, sm: 2 }, py: 1, fontFamily: FONT, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
          <Box sx={{ fontWeight: 700 }}>Aperte a tecla:</Box>
          <Box>
            <b>CONFIRMA</b> para {legendaReady ? 'VOTAR NA LEGENDA' : 'CONFIRMAR este voto'}
          </Box>
          <Box>
            <b>CORRIGE</b> para REINICIAR este voto
          </Box>
        </Box>
      )}
    </Box>
  );
}
