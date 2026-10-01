import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Link,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import BalanceRounded from '@mui/icons-material/BalanceRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import PolicyRounded from '@mui/icons-material/PolicyRounded';
import ReceiptLongRounded from '@mui/icons-material/ReceiptLongRounded';
import SortByAlphaRounded from '@mui/icons-material/SortByAlphaRounded';
import SyncAltRounded from '@mui/icons-material/SyncAltRounded';
import TouchAppRounded from '@mui/icons-material/TouchAppRounded';
import { Link as RouterLink, useNavigate } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { UfTileMap } from '@/components/election/UfTileMap';
import { data } from '@/data/api';
import { CARGO_LABEL, dateLong, DIGITOS, nomeProprio, number } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { Cargo } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    done: diff === 0,
    dias: Math.floor(diff / 86_400_000),
    horas: Math.floor((diff % 86_400_000) / 3_600_000),
    minutos: Math.floor((diff % 3_600_000) / 60_000),
  };
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <Box sx={{ textAlign: 'center', minWidth: 64, px: 1.5, py: 1, borderRadius: 3, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

const PRINCIPIOS = [
  {
    icon: PolicyRounded,
    title: 'Só fontes oficiais',
    text: 'TSE, Câmara dos Deputados e Senado Federal. Cada número mostra de qual arquivo oficial veio e quando foi coletado.',
  },
  {
    icon: SortByAlphaRounded,
    title: 'Mesmo espaço para todos',
    text: 'Os mesmos campos, no mesmo formato e em ordem alfabética. Ninguém aparece com destaque por quem é ou pelo partido.',
  },
  {
    icon: BalanceRounded,
    title: 'Sem opinião',
    text: 'Não publicamos pesquisas, notas, rankings de "melhores" nem recomendações de voto. A decisão é sua.',
  },
];

const FERRAMENTAS = [
  { to: '/eleicao', icon: ListAltRounded, title: 'Candidatos por estado', text: 'Presidente, governador, Senado e deputados, com filtros.' },
  { to: '/comparar', icon: CompareArrowsRounded, title: 'Compare lado a lado', text: 'Até 4 candidaturas: perfil, patrimônio, campanha e trajetória.' },
  { to: '/cola', icon: ListAltRounded, title: 'Monte sua cola', text: 'Anote seus números na ordem da urna. Fica só no seu aparelho.' },
  { to: '/simulador', icon: TouchAppRounded, title: 'Simulador de urna', text: 'Treine a sequência de votos com fotos e números reais.' },
  { to: '/gastos', icon: ReceiptLongRounded, title: 'Gastos de mandato', text: 'Cota parlamentar de deputados federais e senadores desde 2023.' },
  { to: '/numeros', icon: InsightsRounded, title: 'A eleição em números', text: 'Quem são as candidaturas: gênero, idade, instrução, financiamento.' },
  { to: '/segundo-turno', icon: SyncAltRounded, title: '2º turno', text: 'Após a apuração, os finalistas comparados com dados oficiais.' },
];

const ORDEM_URNA: { cargo: Cargo; label: string }[] = [
  { cargo: 'deputado-federal', label: 'Deputado(a) federal' },
  { cargo: 'deputado-estadual', label: 'Deputado(a) estadual ou distrital' },
  { cargo: 'senador', label: 'Senador(a) · 1ª vaga' },
  { cargo: 'senador', label: 'Senador(a) · 2ª vaga' },
  { cargo: 'governador', label: 'Governador(a)' },
  { cargo: 'presidente', label: 'Presidente' },
];

export function HomePage() {
  const { meta } = useMeta();
  const navigate = useNavigate();
  const presidente = useAsync(() => data.presidente(), []);
  const segundo = meta?.eleicao.fase === 'pre-2turno' || meta?.eleicao.fase === 'apuracao-2turno';
  const alvo = new Date(`${segundo ? meta?.eleicao.data_2turno : '2026-10-04'}T08:00:00-03:00`);
  const cd = useCountdown(alvo);
  const naUrna = (presidente.data?.candidatos ?? []).filter((c) => c.na_urna);

  return (
    <Stack spacing={{ xs: 5, md: 7 }}>
      {/* Hero */}
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6,
          p: { xs: 3, md: 6 },
          border: `1px solid ${theme.vars.palette.divider}`,
          background: `radial-gradient(120% 140% at 0% 0%, ${theme.alpha(theme.vars.palette.lime.main, 0.22)} 0%, transparent 55%), radial-gradient(120% 140% at 100% 100%, ${theme.alpha('#7649CF', 0.18)} 0%, transparent 55%), ${theme.vars.palette.background.paper}`,
        })}
      >
        <Grid container spacing={4} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="overline" color="primary">
              Eleições gerais · {segundo ? `2º turno em ${dateLong(meta!.eleicao.data_2turno)}` : '1º turno em 4 de outubro de 2026'}
            </Typography>
            <Typography variant="h1" sx={{ fontSize: { xs: '2.1rem', md: '3.1rem' }, mt: 1, mb: 2 }}>
              Conheça quem está na sua urna antes de votar.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mb: 3 }}>
              Patrimônio declarado, financiamento de campanha, trajetória eleitoral e gastos de mandato de todas as
              candidaturas, organizados a partir de dados públicos oficiais. Sem opinião, sem pesquisas, sem
              recomendação de voto.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button component={RouterLink} to="/eleicao" variant="contained" size="large" endIcon={<ArrowForwardRounded />}>
                Ver candidatos do meu estado
              </Button>
              <Button component={RouterLink} to="/cola" variant="tonal" size="large">
                Montar minha cola
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5} sx={{ alignItems: { xs: 'flex-start', md: 'center' } }}>
              <Typography variant="subtitle2" color="text.secondary">
                {cd.done ? 'A votação já começou ou terminou' : 'Faltam para a abertura das urnas (8h, horário de Brasília)'}
              </Typography>
              {!cd.done && (
                <Stack direction="row" spacing={1}>
                  <CountUnit value={cd.dias} label={cd.dias === 1 ? 'dia' : 'dias'} />
                  <CountUnit value={cd.horas} label="horas" />
                  <CountUnit value={cd.minutos} label="min" />
                </Stack>
              )}
              {meta && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: { md: 'center' } }}>
                  {number(['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual', 'deputado-distrital'].reduce((s, k) => s + (meta.totais[k as Cargo] ?? 0), 0))} candidaturas na urna em todo o país (sem contar vices e suplentes).
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Box>

      {/* Escolha o estado */}
      <Grid container spacing={4} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="h3" component="h2" sx={{ mb: 1 }}>
            Escolha seu estado
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Você vota em quem disputa no estado onde tem título: governador(a), duas vagas ao Senado, deputados federais e
            estaduais (ou distritais, no DF), além da Presidência.
          </Typography>
          {meta && (
            <SourceNote keys={['tse_candidatos', 'tse_vagas']} />
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', justifyContent: { md: 'center' }, overflowX: 'auto' }}>
          <UfTileMap
            onSelect={(uf) => void navigate(`/eleicao/${uf}`)}
            names={Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome]))}
            size={46}
          />
        </Grid>
      </Grid>

      {/* Presidência */}
      <Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-end' }, mb: 2, gap: 1 }}>
          <Box>
            <Typography variant="h3" component="h2">
              Candidaturas à Presidência
            </Typography>
            <Typography color="text.secondary">
              {naUrna.length ? `${naUrna.length} nomes na urna, em ordem alfabética.` : 'Carregando…'}
            </Typography>
          </Box>
          <Button component={RouterLink} to="/eleicao/BR/presidente" endIcon={<ArrowForwardRounded />}>
            Ver perfis completos
          </Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(7, 1fr)' }, gap: 2 }}>
          {presidente.loading &&
            Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />)}
          {naUrna.map((c) => (
            <Box
              key={c.sq}
              component={RouterLink}
              to={`/candidato/${c.sq}`}
              sx={{ textDecoration: 'none', color: 'inherit', '&:hover img': { transform: 'scale(1.04)' }, '& img': { transition: 'transform 300ms' } }}
            >
              <CandidatePhoto src={c.foto} alt={`Foto de ${nomeProprio(c.nome_urna)}`} width="100%" />
              <Typography variant="subtitle2" sx={{ mt: 0.75, lineHeight: 1.25 }}>
                {nomeProprio(c.nome_urna)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.numero} · {c.partido}
              </Typography>
            </Box>
          ))}
        </Box>
        <SourceNote keys={['tse_candidatos', 'tse_complementar', 'tse_fotos']} sx={{ mt: 2 }} />
      </Box>

      {/* Princípios */}
      <Box>
        <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
          Como este site funciona
        </Typography>
        <Grid container spacing={2}>
          {PRINCIPIOS.map((p) => (
            <Grid key={p.title} size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'primary.container', color: 'primary.onContainer', mb: 1.5 }}>
                    <p.icon />
                  </Box>
                  <Typography variant="h6" component="h3">
                    {p.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {p.text}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Ferramentas */}
      <Box>
        <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
          O que você pode fazer aqui
        </Typography>
        <Grid container spacing={2}>
          {FERRAMENTAS.map((f) => (
            <Grid key={f.to} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%', '&:hover': { borderColor: 'primary.light' } }}>
                <CardActionArea component={RouterLink} to={f.to} sx={{ height: '100%', alignItems: 'flex-start' }}>
                  <CardContent>
                    <f.icon color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 1 }}>
                      {f.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {f.text}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Ordem da urna */}
      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
                A ordem dos votos na urna
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Em 2026 cada estado elege duas pessoas para o Senado, por isso são seis votos. Os dois votos para o Senado
                devem ir para pessoas diferentes: se o mesmo nome for escolhido duas vezes, o segundo voto é anulado (
                <Link href="https://www12.senado.leg.br/noticias/materias/2026/09/28/eleicoes-2026-veja-o-que-e-fato-sobre-o-voto-para-o-senado" target="_blank" rel="noopener noreferrer">
                  Agência Senado
                </Link>
                ).
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A votação vai das 8h às 17h, horário de Brasília. Leve um documento oficial com foto ou use o e-Título. O
                celular não pode entrar na cabine: anote seus números no papel.{' '}
                <Link href="https://www.tse.jus.br/" target="_blank" rel="noopener noreferrer">
                  Orientações oficiais no site do TSE
                </Link>
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack component="ol" spacing={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {ORDEM_URNA.map((o, i) => (
                  <Stack component="li" key={o.label} direction="row" spacing={2} sx={{ alignItems: 'center', p: 1.25, borderRadius: 3, bgcolor: 'background.subtle' }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', fontWeight: 700, flexShrink: 0 }}>
                      {i + 1}
                    </Box>
                    <Typography sx={{ flex: 1, fontWeight: 500 }}>{o.label}</Typography>
                    <Stack direction="row" spacing={0.5} aria-label={`${DIGITOS[o.cargo]} dígitos`}>
                      {Array.from({ length: DIGITOS[o.cargo] ?? 0 }, (_, d) => (
                        <Box key={d} sx={{ width: 18, height: 24, border: 1.5, borderColor: 'text.secondary', borderRadius: 0.75 }} />
                      ))}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Os quadrados indicam quantos dígitos tem o número de cada cargo ({CARGO_LABEL['deputado-federal']}: 4, estadual/distrital: 5, Senado: 3, governo e Presidência: 2).
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
}
