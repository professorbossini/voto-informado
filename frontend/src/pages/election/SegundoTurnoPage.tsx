import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import { Link as RouterLink } from 'react-router';
import { BarList } from '@/components/charts/charts';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { data } from '@/data/api';
import { CARGO_LABEL, dateLong, money, moneyCompact, nomeProprio, NAO_INFORMADO, percent, variation } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { CandidatoDetalhe, Resultados } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

const LINHAS: { label: string; value: (c: CandidatoDetalhe) => string }[] = [
  { label: 'Votos no 1º turno', value: (c) => { const r = c.resultados.find((x) => x.turno === 1); return r?.pct != null ? `${r.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% (${(r.votos ?? 0).toLocaleString('pt-BR')} votos)` : 'Aguardando dados do TSE'; } },
  { label: 'Partido / federação', value: (c) => `${c.partido}${c.federacao_nome ? ` · ${nomeProprio(c.federacao_nome)}` : ''}` },
  { label: 'Vice', value: (c) => (c.companheiros ?? []).filter((x) => x.na_urna).map((x) => `${nomeProprio(x.nome_urna)} (${x.partido})`).join(', ') || '—' },
  { label: 'Idade', value: (c) => (c.idade != null ? `${c.idade} anos` : NAO_INFORMADO) },
  { label: 'Instrução', value: (c) => c.instrucao ?? NAO_INFORMADO },
  { label: 'Ocupação declarada', value: (c) => c.ocupacao ?? NAO_INFORMADO },
  { label: 'Patrimônio declarado (2026)', value: (c) => money(c.bens_total) },
  { label: 'Variação desde 2022 (nominal)', value: (c) => { const v = variation(c.bens_total, c.bens_2022); return v != null ? `${v > 0 ? '+' : ''}${percent(v)}` : '—'; } },
  { label: 'Receitas de campanha (parcial)', value: (c) => money(c.receitas) },
  { label: 'Candidaturas anteriores (histórico do TSE)', value: (c) => `${c.historico.length} (${c.historico.filter((h) => h.eleito).length} com vitória registrada)` },
];

function Apuracao({ res }: { res: Resultados }) {
  const t1 = res.disputas.filter((d) => d.turno === 1);
  if (!t1.length) return null;
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h2">
        Apuração oficial do 1º turno
      </Typography>
      <Grid container spacing={2}>
        {t1.map((d) => (
          <Grid key={`${d.uf}-${d.cargo}`} size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {CARGO_LABEL[d.cargo]} · {d.uf === 'BR' ? 'Brasil' : d.uf}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {d.pct_secoes != null ? `${d.pct_secoes.toLocaleString('pt-BR')}% das seções totalizadas` : ''} · atualizado em {d.atualizado}
                </Typography>
                <LinearProgress variant="determinate" value={d.pct_secoes ?? 0} sx={{ my: 1.5 }} />
                <BarList
                  data={d.candidatos.slice(0, 8).map((c) => ({ label: `${nomeProprio(c.nome_urna ?? c.nome)} (${c.partido ?? ''})`, value: c.pct ?? 0, display: `${(c.pct ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%${c.situacao ? ` · ${c.situacao}` : ''}` }))}
                  format={(v) => `${v}%`}
                  max={100}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      <SourceNote keys={res.fontes} note="percentuais sobre votos válidos, como publicados pelo TSE" />
    </Stack>
  );
}

export function SegundoTurnoPage() {
  const { meta } = useMeta();
  const st = useAsync(() => data.segundoTurno(), []);
  const res = useAsync(() => data.resultados(), []);
  const data2 = meta ? dateLong(meta.eleicao.data_2turno) : '25 de outubro de 2026';

  return (
    <>
      <PageHeader
        title="2º turno"
        subtitle={`Marcado para ${data2}. Esta página é preenchida automaticamente com os dados oficiais da apuração do TSE.`}
      />

      <Stack spacing={4}>
        <Card>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
              Quando há 2º turno
            </Typography>
            <Typography color="text.secondary">
              Para Presidente e Governador(a), vence no 1º turno quem obtiver mais da metade dos votos válidos (brancos e
              nulos não contam). Se ninguém alcançar isso, as duas candidaturas mais votadas disputam o 2º turno. Senado e
              deputados são decididos sempre no 1º turno.
            </Typography>
          </CardContent>
        </Card>

        {(st.loading || res.loading) && <Skeleton variant="rounded" height={240} />}

        {res.data && res.data.disputas.length === 0 && (
          <Alert severity="info">
            A apuração ainda não começou. O TSE divulga os resultados após o encerramento da votação, às 17h (horário de
            Brasília) de 4 de outubro. Assim que os arquivos oficiais forem publicados, os resultados e os finalistas
            aparecem aqui.
          </Alert>
        )}

        {res.data && <Apuracao res={res.data} />}

        {st.data && st.data.disputas.length > 0 && (
          <Stack spacing={3}>
            <Typography variant="h4" component="h2">
              Disputas de 2º turno
            </Typography>
            {st.data.disputas.map((d) => (
              <Card key={`${d.uf}-${d.cargo}`}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2, gap: 1 }}>
                    <Typography variant="h5" component="h3">
                      {CARGO_LABEL[d.cargo]} · {d.uf === 'BR' ? 'Brasil' : d.nome_uf}
                    </Typography>
                    <Button component={RouterLink} to={`/comparar?c=${d.candidatos.map((c) => c.sq).join(',')}`} startIcon={<CompareArrowsRounded />} variant="tonal" size="small">
                      Comparação completa
                    </Button>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `220px repeat(${d.candidatos.length}, 1fr)` }, gap: 2, alignItems: 'start' }}>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }} />
                    {[...d.candidatos].sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR')).map((c) => (
                      <Stack key={c.sq} spacing={1} component={RouterLink} to={`/candidato/${c.sq}`} sx={{ textDecoration: 'none', color: 'inherit', alignItems: 'center', textAlign: 'center' }}>
                        <CandidatePhoto src={c.foto} alt={`Foto de ${nomeProprio(c.nome_urna)}`} width={110} />
                        <Typography variant="h6">{nomeProprio(c.nome_urna)}</Typography>
                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.4rem' }}>{c.numero}</Typography>
                      </Stack>
                    ))}
                    {LINHAS.map((l) => [
                      <Typography key={`${l.label}-h`} variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                        {l.label}
                      </Typography>,
                      ...[...d.candidatos].sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR')).map((c) => (
                        <Typography key={`${l.label}-${c.sq}`} variant="body2" sx={{ textAlign: 'center', pt: { md: 1 }, borderTop: { md: 1 }, borderColor: { md: 'divider' }, fontWeight: 500 }}>
                          {l.value(c)}
                        </Typography>
                      )),
                    ])}
                  </Box>
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Patrimônio declarado
                    </Typography>
                    <BarList data={d.candidatos.map((c) => ({ label: nomeProprio(c.nome_urna), value: c.bens_total }))} format={moneyCompact} />
                  </Box>
                </CardContent>
              </Card>
            ))}
            <SourceNote keys={st.data.fontes} />
          </Stack>
        )}
      </Stack>
    </>
  );
}
