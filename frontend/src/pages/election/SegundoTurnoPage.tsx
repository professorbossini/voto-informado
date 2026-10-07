import { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded';
import { Link as RouterLink, useLocation } from 'react-router';
import { useFinalistas, useUfUsuario, type DisputaFinal } from '@/components/resultados/hooks';
import { CartaoEleitos } from '@/components/resultados/CartaoEleitos';
import { eleitosDe } from '@/data/apuracao';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { BarList } from '@/components/charts/charts';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { data } from '@/data/api';
import { CARGO_LABEL, dateLong, money, moneyCompact, nomeProprio, NAO_INFORMADO, percent, variation } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { CandidatoDetalhe } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';
import { AvisoResultado } from '@/components/avisos/AvisoResultado';
import { BotaoCompartilharImagem } from '@/components/compartilhar/BotaoCompartilharImagem';
import { cartaoLadoALado } from '@/components/compartilhar/dados';
import { publicUrl } from '@/native/platform';

const LINHAS: { label: string; value: (c: CandidatoDetalhe) => string }[] = [
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

const pctBr = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function SegundoTurnoPage() {
  const { meta, fontes } = useMeta();
  // Finalistas confirmados pelo TSE (ao vivo), mais os que o site já publicou.
  const fin = useFinalistas();
  const { uf: ufUsuario } = useUfUsuario({ detectarSozinho: false });
  const data2 = meta ? dateLong(meta.eleicao.data_2turno) : '25 de outubro de 2026';
  const nomes = Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome]));
  const nomeUf = (uf: string) => (uf === 'BR' ? 'Brasil' : (nomes[uf] ?? uf));

  // Presidente primeiro; depois os estados em ordem alfabética do nome.
  const disputas = [...fin.disputas].sort(
    (a, b) => Number(a.cargo !== 'presidente') - Number(b.cargo !== 'presidente') || nomeUf(a.uf).localeCompare(nomeUf(b.uf), 'pt-BR'),
  );
  const todos = disputas.flatMap((d) => d.sqs);
  const chave = todos.join(',');
  const cards = useAsync(() => Promise.all(todos.map((sq) => data.candidato(sq).catch(() => null))), [chave]);
  const porSq = new Map((cards.data ?? []).filter((c): c is CandidatoDetalhe => Boolean(c)).map((c) => [c.sq, c]));

  // Link com âncora (#st-SP-governador): rola até a disputa quando ela aparece.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash && porSq.size) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, porSq.size]);

  const votos1 = (d: DisputaFinal, c: CandidatoDetalhe) => {
    const v = d.votos1[c.sq];
    if (v) return `${pctBr(v.pct)} (${v.votos.toLocaleString('pt-BR')} votos)`;
    const r = c.resultados.find((x) => x.turno === 1);
    return r?.pct != null ? `${pctBr(r.pct)} (${(r.votos ?? 0).toLocaleString('pt-BR')} votos)` : 'Aguardando dados do TSE';
  };

  const votos2 = (d: DisputaFinal, c: CandidatoDetalhe) => {
    const v = d.turno2?.candidatos.find((x) => x.sq === c.sq);
    return v ? `${pctBr(v.pct)} (${v.votos.toLocaleString('pt-BR')} votos)` : '—';
  };

  return (
    <>
      <PageHeader
        title="2º turno"
        subtitle={`Marcado para ${data2}. As disputas e os finalistas aparecem aqui assim que o TSE os confirma na apuração do 1º turno.`}
      />

      <Stack spacing={4}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button component={RouterLink} to="/como-votar" variant="tonal">
            Como votar no 2º turno
          </Button>
          <Button component={RouterLink} to="/planos" variant="tonal" startIcon={<ManageSearchRounded />}>
            Buscar nos planos de governo
          </Button>
        </Stack>
        <AvisoResultado />
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

        <Card sx={(theme) => ({ borderColor: 'primary.light', background: `linear-gradient(135deg, ${theme.alpha(theme.vars.palette.primary.main, 0.08)}, transparent 60%), ${theme.vars.palette.background.paper}` })}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h5" component="h2">
                  Apuração ao vivo, 1º e 2º turnos
                </Typography>
                <Typography color="text.secondary">
                  Resultados lidos direto do TSE, com mapa por estado, todos os cargos e busca pela sua candidatura. A divulgação começa às 17h
                  (Brasília) do dia da votação.
                </Typography>
              </Box>
              <Button component={RouterLink} to="/resultados" variant="contained" endIcon={<BarChartRounded />} sx={{ flexShrink: 0 }}>
                Ver resultados
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {fin.carregando && <Skeleton variant="rounded" height={240} />}

        {!fin.carregando && disputas.length === 0 && (
          <Alert severity="info">
            Ainda não há finalistas confirmados. Assim que o TSE marcar as candidaturas que vão ao 2º turno na apuração do
            1º turno, as disputas aparecem aqui, com a comparação lado a lado. A página consulta o TSE a cada minuto.
          </Alert>
        )}

        {disputas.length > 0 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" component="h2">
                Disputas de 2º turno
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {disputas.some((d) => d.cargo === 'presidente') ? 'Presidente e ' : ''}
                {disputas.filter((d) => d.cargo === 'governador').length} {disputas.filter((d) => d.cargo === 'governador').length === 1 ? 'estado' : 'estados'} com
                2º turno para governador. Finalistas sempre em ordem alfabética.
              </Typography>
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1.5 }} component="nav" aria-label="Ir para a disputa">
                {disputas.map((d) => (
                  <Chip
                    key={`${d.uf}-${d.cargo}`}
                    size="small"
                    clickable
                    component="a"
                    href={`#st-${d.uf}-${d.cargo}`}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      document.getElementById(`st-${d.uf}-${d.cargo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    label={d.cargo === 'presidente' ? 'Presidente' : nomeUf(d.uf)}
                    color={d.uf === ufUsuario ? 'primary' : 'default'}
                    variant={d.cargo === 'presidente' || d.uf === ufUsuario ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            </Box>
            {cards.loading && <Skeleton variant="rounded" height={420} />}
            {disputas.map((d) => {
              const cs = d.sqs.map((sq) => porSq.get(sq)).filter((c): c is CandidatoDetalhe => Boolean(c));
              if (!cs.length) return null;
              const eleitos = eleitosDe(d.turno2);
              const linhas = [
                ...(d.turno2 ? [{ label: d.turno2.final ? 'Votos no 2º turno' : 'Votos no 2º turno (parcial)', value: (c: CandidatoDetalhe) => votos2(d, c) }] : []),
                { label: 'Votos no 1º turno', value: (c: CandidatoDetalhe) => votos1(d, c) },
                ...LINHAS,
              ];
              return (
                <Card key={`${d.uf}-${d.cargo}`} id={`st-${d.uf}-${d.cargo}`} sx={{ scrollMarginTop: 88 }}>
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2, gap: 1 }}>
                      <Box>
                        <Typography variant="h5" component="h3">
                          {CARGO_LABEL[d.cargo]} · {nomeUf(d.uf)}
                          {d.uf === ufUsuario && <Chip size="small" color="primary" label="Seu estado" sx={{ ml: 1, verticalAlign: 'middle' }} />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.origem !== 'tse' ? 'Finalistas conforme os dados oficiais publicados pelo site.' : d.oficial ? 'Finalistas confirmados pelo TSE na apuração do 1º turno.' : 'Finalistas: pela totalização de 100% das seções do 1º turno ninguém passou de 50% dos votos válidos, então os dois mais votados vão ao 2º turno (Constituição, art. 77); aguardando a proclamação oficial do TSE.'}
                        </Typography>
                      </Box>
                      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
                        <Button component={RouterLink} to={`/comparar?c=${d.sqs.join(',')}`} startIcon={<CompareArrowsRounded />} variant="tonal" size="small">
                          Comparação completa
                        </Button>
                        <Button component={RouterLink} to={`/planos?d=${d.uf.toLowerCase()}-${d.cargo}`} startIcon={<ManageSearchRounded />} variant="tonal" size="small">
                          Planos de governo
                        </Button>
                        {/* Finalistas na ordem da página (alfabética), com as mesmas linhas da tabela abaixo. */}
                        <BotaoCompartilharImagem
                          size="small"
                          montar={() =>
                            cartaoLadoALado(cs, {
                              titulo: `2º turno · ${CARGO_LABEL[d.cargo]} · ${nomeUf(d.uf)}`,
                              url: publicUrl(`segundo-turno#st-${d.uf}-${d.cargo}`),
                              fontes,
                              antes: linhas.slice(0, d.turno2 ? 2 : 1).map((l) => ({ rotulo: l.label, valores: cs.map((c) => l.value(c)) })),
                              semResultado: true,
                              chavesExtras: ['tse_resultados'],
                            })
                          }
                        />
                      </Stack>
                    </Stack>
                    {eleitos.length > 0 && <CartaoEleitos eleitos={eleitos} cargo={d.cargo} turno={2} local={d.cargo === 'presidente' ? null : nomeUf(d.uf)} compacto sx={{ mb: 2 }} />}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `220px repeat(${cs.length}, 1fr)` }, gap: 2, alignItems: 'start' }}>
                      <Box sx={{ display: { xs: 'none', md: 'block' } }} />
                      {cs.map((c) => (
                        <Stack key={c.sq} spacing={1} component={RouterLink} to={`/candidato/${c.sq}`} sx={{ textDecoration: 'none', color: 'inherit', alignItems: 'center', textAlign: 'center' }}>
                          <CandidatePhoto src={c.foto} alt={`Foto de ${nomeProprio(c.nome_urna)}`} width={110} />
                          <Typography variant="h6">{nomeProprio(c.nome_urna)}</Typography>
                          <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.4rem' }}>{c.numero}</Typography>
                          {eleitos.some((e) => e.sq === c.sq) && (
                            <Chip size="small" color="success" icon={<VerifiedRounded />} label={c.genero?.toUpperCase().startsWith('FEM') ? 'Eleita' : 'Eleito'} sx={{ fontWeight: 800 }} />
                          )}
                        </Stack>
                      ))}
                      {linhas.map((l) => [
                        <Typography key={`${l.label}-h`} variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                          {l.label}
                        </Typography>,
                        ...cs.map((c) => (
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
                      <BarList data={cs.map((c) => ({ label: nomeProprio(c.nome_urna), value: c.bens_total }))} format={moneyCompact} />
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
            <SourceNote keys={['tse_resultados', 'tse_candidatos', 'tse_bens', 'tse_prestacao', 'tse_historico']} note="finalistas: situação “2º turno” publicada pelo TSE" />
          </Stack>
        )}
      </Stack>
    </>
  );
}
