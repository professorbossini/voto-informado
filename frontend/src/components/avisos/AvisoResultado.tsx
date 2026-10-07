import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';
import NotificationsActiveRounded from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsOffRounded from '@mui/icons-material/NotificationsOffRounded';
import { Link as RouterLink } from 'react-router';
import { useUfUsuario } from '@/components/resultados/hooks';
import { data } from '@/data/api';
import { useLocalState } from '@/data/localStore';
import { useAsync } from '@/hooks/useAsync';
import { inscricaoAtual, inscricaoPush, postar, pushSuportado as suportado } from './push';

const NOMES_UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

/**
 * "Avisar o resultado": notificação do navegador quando o TSE declarar o resultado da Presidência
 * e, se houver 2º turno no estado da pessoa, do governo do estado. Guarda no servidor só o endereço
 * de entrega do navegador e os estados escolhidos (nada pessoal).
 */
export function AvisoResultado() {
  const [inscrito, setInscrito] = useLocalState<{ ufs: string[] } | null>('vi:avisos', null);
  const [estado, setEstado] = useState<'ocioso' | 'pedindo' | 'negado' | 'erro'>(() => (suportado() && Notification.permission === 'denied' ? 'negado' : 'ocioso'));
  const { uf } = useUfUsuario({ detectarSozinho: false });
  const st = useAsync(() => data.segundoTurno().catch(() => null), []);
  const governo = uf && (st.data?.disputas ?? []).some((d) => d.cargo === 'governador' && d.uf === uf) ? uf : null;
  const [presidencia, setPresidencia] = useState(true);
  const [meuGoverno, setMeuGoverno] = useState(true);

  if (!suportado()) {
    return null;
  }

  const ligar = async () => {
    const ufs = [presidencia ? 'BR' : null, governo && meuGoverno ? governo : null].filter((x): x is string => x != null);
    if (!ufs.length) return;
    setEstado('pedindo');
    try {
      const sub = await inscricaoPush();
      if (!sub) {
        setEstado(Notification.permission === 'denied' ? 'negado' : 'ocioso');
        return;
      }
      const r = await postar('/inscrever', { ...sub.toJSON(), ufs });
      if (!r.ok) throw new Error(String(r.status));
      setInscrito({ ufs });
      setEstado('ocioso');
    } catch {
      setEstado('erro');
    }
  };

  const desligar = async () => {
    try {
      const sub = await inscricaoAtual();
      // Só os avisos de resultado: quem acompanha políticos continua inscrito.
      if (sub) await postar('/cancelar', { endpoint: sub.endpoint, so: 'resultados' });
    } finally {
      setInscrito(null);
    }
  };

  const descricao = (ufs: string[]) => ufs.map((u) => (u === 'BR' ? 'Presidência' : `governo de ${NOMES_UF[u] ?? u}`)).join(' e ');

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1 }}>
          <NotificationsActiveRounded color="primary" />
          <Typography variant="h6" component="h2">
            Avisar o resultado
          </Typography>
        </Stack>
        {inscrito ? (
          <>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Avisos ligados neste aparelho: {descricao(inscrito.ufs)}. A notificação chega quando o TSE declarar o resultado.
            </Typography>
            <Button startIcon={<NotificationsOffRounded />} onClick={() => void desligar()} size="small">
              Desligar os avisos
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Receba uma notificação neste aparelho quando o TSE declarar o resultado, mesmo com o site fechado.
            </Typography>
            <Box>
              <FormControlLabel control={<Checkbox checked={presidencia} onChange={(e) => setPresidencia(e.target.checked)} />} label="Presidência da República" />
              {governo && (
                <FormControlLabel control={<Checkbox checked={meuGoverno} onChange={(e) => setMeuGoverno(e.target.checked)} />} label={`Governo de ${NOMES_UF[governo]}`} />
              )}
            </Box>
            {estado === 'negado' && (
              <Alert severity="info" sx={{ my: 1 }}>
                As notificações estão bloqueadas para este site no navegador. Para receber o aviso, libere-as nas configurações do navegador.
              </Alert>
            )}
            {estado === 'erro' && (
              <Alert severity="warning" sx={{ my: 1 }}>
                Não foi possível ligar os avisos agora. Tente de novo em instantes.
              </Alert>
            )}
            <Button variant="contained" onClick={() => void ligar()} disabled={estado === 'pedindo' || estado === 'negado' || (!presidencia && !(governo && meuGoverno))} sx={{ mt: 1 }}>
              {estado === 'pedindo' ? 'Ligando…' : 'Ligar os avisos'}
            </Button>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              Guardamos só o endereço de entrega do seu navegador e os resultados escolhidos, sem nome, e-mail ou CPF. Os avisos podem ser desligados a
              qualquer momento. Detalhes na{' '}
              <Box component={RouterLink} to="/privacidade" sx={{ color: 'inherit' }}>
                Política de Privacidade
              </Box>
              .
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
