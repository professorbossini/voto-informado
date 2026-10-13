import { Box, Card, CardActionArea, CardContent, Grid, Stack, Typography } from '@mui/material';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import MapRounded from '@mui/icons-material/MapRounded';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import InfoRounded from '@mui/icons-material/InfoRounded';
import { Link as RouterLink, useNavigate } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { eua } from '../api';
import { MapaEua } from '../componentes/MapaEua';
import { AvisoInformativo, FonteNota } from '../componentes/comuns';
import { dataBr, nomeEstado } from '../formato';

const SECOES = [
  { to: '/eua/congresso', titulo: 'Congresso', texto: 'Quem está na Câmara e no Senado, com retrato oficial, partido, estado e distrito.', icone: AccountBalanceRounded },
  { to: '/eua/votacoes', titulo: 'Votações nominais', texto: 'Como cada deputado(a) e senador(a) votou no Plenário, votação por votação.', icone: HowToVoteRounded },
  { to: '/eua/eleicoes', titulo: 'Eleições e mapa', texto: 'Resultados por estado desde 1976, Colégio Eleitoral e a eleição de 2026.', icone: MapRounded },
  { to: '/eua/candidatos', titulo: 'Candidaturas 2026', texto: 'Quem se registrou na FEC para a Câmara e o Senado, com o dinheiro declarado.', icone: PeopleAltRounded },
  { to: '/eua/gastos', titulo: 'Gastos públicos', texto: 'Gastos dos gabinetes da Câmara e o dinheiro federal que chega a cada estado.', icone: ReceiptLongRounded },
  { to: '/eua/suprema-corte', titulo: 'Suprema Corte', texto: 'Os nove juízes, quem os indicou, salários, a história desde 1789 e as decisões.', icone: GavelRounded },
  { to: '/eua/sobre', titulo: 'Fontes e base legal', texto: 'De onde vem cada dado e por que ele pode ser usado livremente, dentro da lei.', icone: InfoRounded },
] as const;

function diasAte(iso: string) {
  const alvo = new Date(`${iso}T00:00:00-05:00`).getTime();
  return Math.ceil((alvo - Date.now()) / 86_400_000);
}

export function EuaInicioPage() {
  const navigate = useNavigate();
  const cal = useAsync(() => eua.calendario(), []);
  const c = cal.data;
  const dias = c ? diasAte(c.proxima) : null;
  const senado = new Set((c?.em_disputa.senado_estados ?? []).map(([uf]) => uf));

  return (
    <>
      <PageHeader
        title="Estados Unidos"
        subtitle="Congresso, eleições, votações, gastos e Suprema Corte, só com dados públicos oficiais. O mesmo método do Tá na Urna para o Brasil."
      />
      <AvisoInformativo />

      {c && (
        <Card variant="outlined" sx={{ mb: 3, bgcolor: 'primary.container', color: 'primary.onContainer', borderColor: 'transparent' }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: { md: 'center' } }}>
              <Box sx={{ textAlign: 'center', minWidth: 140 }}>
                {dias != null && dias > 0 ? (
                  <>
                    <Typography variant="h2" component="p" sx={{ fontWeight: 800, lineHeight: 1 }}>
                      {dias}
                    </Typography>
                    <Typography variant="body2">{dias === 1 ? 'dia para a eleição' : 'dias para a eleição'}</Typography>
                  </>
                ) : (
                  <Typography variant="h5" component="p" sx={{ fontWeight: 800 }}>
                    {dias === 0 ? 'Hoje é dia de eleição' : 'Eleição realizada'}
                  </Typography>
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="h2">
                  Eleição geral de {dataBr(c.proxima)} ({c.tipo})
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Em disputa: {c.em_disputa.presidente ? 'Presidência, ' : ''}todas as <strong>{c.em_disputa.camara}</strong> cadeiras da Câmara (e{' '}
                  {c.em_disputa.delegados} delegados sem voto no Plenário) e <strong>{c.em_disputa.senado}</strong> cadeiras do Senado
                  {c.em_disputa.senado_especiais.length ? `, ${c.em_disputa.senado_especiais.length} delas em eleição especial (${c.em_disputa.senado_especiais.map(nomeEstado).join(' e ')})` : ''}.
                  Governos estaduais e cargos locais também são eleitos, mas ficam fora deste site (cada estado publica os seus).
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Nos EUA não há um órgão nacional de apuração: cada estado conta e certifica os votos. Na noite da eleição, o resultado
                  oficial sai no site do órgão eleitoral de cada estado (lista na página{' '}
                  <Box component={RouterLink} to="/eua/eleicoes" sx={{ color: 'inherit', fontWeight: 700 }}>
                    Eleições
                  </Box>
                  ).
                </Typography>
                <FonteNota chaves={['eua-clerk-membros', 'eua-legisladores']} nota="data fixada em lei (2 U.S.C. § 7)" sx={{ mt: 1, color: 'inherit' }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2">
                Escolha um estado
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Senadores(as), deputados(as), candidaturas de {c?.ano ?? 2026}, resultados anteriores e o gasto federal no estado. Em destaque, os
                estados com eleição para o Senado em {c?.ano ?? 2026}.
              </Typography>
              <MapaEua
                onSelect={(uf) => navigate(`/eua/estado/${uf}`)}
                marcados={senado}
                rotulos={Object.fromEntries([...senado].map((uf) => [uf, `${nomeEstado(uf)}: eleição para o Senado em ${c?.ano ?? ''}`]))}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={1.5}>
            {SECOES.map((s) => (
              <Card key={s.to} variant="outlined">
                <CardActionArea component={RouterLink} to={s.to} sx={{ p: 1.75, display: 'flex', justifyContent: 'flex-start', gap: 1.5, alignItems: 'flex-start' }}>
                  <s.icone color="primary" />
                  <Box>
                    <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {s.titulo}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {s.texto}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
