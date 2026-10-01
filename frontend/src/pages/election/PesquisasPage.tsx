import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Link,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink } from 'react-router';
import { BarList } from '@/components/charts/charts';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { data } from '@/data/api';
import { CARGO_LABEL, nomeProprio, normalize, number } from '@/data/format';
import type { Pesquisa } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dataBR = (iso: string) => new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dataCurta = (iso: string) => new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

type Grupo = { key: string; label: string; filtro: (p: Pesquisa) => boolean };

function FichaTecnica({ p }: { p: Pesquisa }) {
  const itens: [string, string][] = [
    ['Instituto', p.instituto],
    ['Contratante', p.contratante],
    ['Registro no TSE', p.registro_tse],
    ['Período de campo', `${dataBR(p.campo_inicio)} a ${dataBR(p.campo_fim)}`],
    ['Divulgação', dataBR(p.divulgacao)],
    ['Entrevistas', number(p.entrevistas)],
    ['Margem de erro', `${p.margem_erro_pp.toLocaleString('pt-BR')} ponto(s) percentual(is), para mais ou para menos`],
    ['Nível de confiança', `${p.confianca_pct.toLocaleString('pt-BR')}%`],
  ];
  if (p.metodologia) itens.push(['Metodologia', p.metodologia]);
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, columnGap: 2, rowGap: 0.5 }}>
      {itens.map(([k, v]) => [
        <Typography key={`${k}-k`} component="dt" variant="caption" color="text.secondary" sx={{ pt: { sm: 0.25 } }}>
          {k}
        </Typography>,
        <Typography key={`${k}-v`} component="dd" variant="body2" sx={{ m: 0, mb: { xs: 0.75, sm: 0 }, fontWeight: 500 }}>
          {v}
        </Typography>,
      ])}
    </Box>
  );
}

function CartaoPesquisa({ p }: { p: Pesquisa }) {
  const [ordem, setOrdem] = useState<'alfabetica' | 'divulgada'>('alfabetica');
  const rows = useMemo(() => {
    const base = p.resultados.map((r) => ({ label: `${nomeProprio(r.nome)}${r.partido ? ` (${r.partido})` : ''}${r.na_urna ? '' : ' · fora da urna'}`, value: r.pct, display: pct(r.pct), hint: `${nomeProprio(r.nome)}: ${pct(r.pct)} (margem ±${p.margem_erro_pp} p.p.)` }));
    return ordem === 'divulgada' ? [...base].sort((a, b) => b.value - a.value) : base;
  }, [p, ordem]);
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' }, gap: 1, mb: 1.5 }}>
          <Box>
            <Typography variant="h6" component="h3">
              {p.instituto_curto}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Campo {dataCurta(p.campo_inicio)}–{dataCurta(p.campo_fim)} · {number(p.entrevistas)} entrevistas · margem ±{p.margem_erro_pp.toLocaleString('pt-BR')} p.p. · registro {p.registro_tse}
            </Typography>
          </Box>
          <ToggleButtonGroup exclusive size="small" value={ordem} onChange={(_, v) => v && setOrdem(v)} aria-label="Ordem das barras">
            <ToggleButton value="alfabetica" sx={{ whiteSpace: 'nowrap' }}>
              A–Z
            </ToggleButton>
            <ToggleButton value="divulgada" sx={{ whiteSpace: 'nowrap' }}>
              Por %
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <BarList data={rows} format={pct} max={Math.max(...p.resultados.map((r) => r.pct), 1)} />
        {p.outros.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {p.outros.map((o) => `${o.rotulo}: ${pct(o.pct)}`).join(' · ')}
          </Typography>
        )}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="overline" color="text.secondary">
            Ficha técnica
          </Typography>
          <FichaTecnica p={p} />
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Fontes desta pesquisa:
            </Typography>
            {p.fontes.map((f) => (
              <Link key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-word' }}>
                {f.titulo} <OpenInNewRounded sx={{ fontSize: 13, verticalAlign: 'middle' }} />
              </Link>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Every poll of a group side by side (candidates alphabetical, polls newest first). Values only, no averages. */
function TabelaComparativa({ lista }: { lista: Pesquisa[] }) {
  const nomes = useMemo(() => {
    const map = new Map<string, { nome: string; partido: string | null; sq: string | null; foto: string | null }>();
    lista.forEach((p) => p.resultados.forEach((r) => map.set(normalize(r.nome), { nome: r.nome, partido: r.partido, sq: r.sq, foto: r.foto })));
    return [...map.values()].sort((a, b) => normalize(a.nome).localeCompare(normalize(b.nome)));
  }, [lista]);
  const valor = (p: Pesquisa, nome: string) => p.resultados.find((r) => normalize(r.nome) === normalize(nome))?.pct;
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" component="h2">
          Todas as pesquisas lado a lado
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Votos totais (cenário estimulado), como publicados. Candidaturas em ordem alfabética; pesquisas da mais recente
          para a mais antiga (fim do campo). “Não divulgado”: o instituto não publicou o valor individual (em geral,
          abaixo de 1%) ou não incluiu o nome. Cada instituto tem metodologia própria: compare dentro de cada coluna,
          considerando a margem de erro.
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ borderCollapse: 'collapse', minWidth: 200 + lista.length * 110, width: '100%', '& td, & th': { borderBottom: 1, borderColor: 'divider', py: 1, px: 1 } }}>
            <thead>
              <tr>
                <Box component="th" sx={{ textAlign: 'left', position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Candidatura
                  </Typography>
                </Box>
                {lista.map((p) => (
                  <Box component="th" key={p.id} sx={{ textAlign: 'right', verticalAlign: 'bottom' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                      {p.instituto_curto}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {dataCurta(p.campo_fim)} · ±{p.margem_erro_pp.toLocaleString('pt-BR')}
                    </Typography>
                  </Box>
                ))}
              </tr>
            </thead>
            <tbody>
              {nomes.map((n) => (
                <tr key={n.nome}>
                  <Box component="td" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <CandidatePhoto src={n.foto} alt="" width={26} rounded={6} />
                      {n.sq ? (
                        <Link component={RouterLink} to={`/candidato/${n.sq}`} variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                          {nomeProprio(n.nome)}
                        </Link>
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {nomeProprio(n.nome)}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {lista.map((p) => {
                    const v = valor(p, n.nome);
                    return (
                      <Box component="td" key={p.id} sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} color={v == null ? 'text.disabled' : 'text.primary'}>
                          {v == null ? 'não divulgado' : pct(v)}
                        </Typography>
                      </Box>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function PesquisasPage() {
  const res = useAsync(() => data.pesquisas(), []);
  const lista = useMemo(() => res.data?.pesquisas ?? [], [res.data]);
  const grupos: Grupo[] = useMemo(() => {
    const g: Grupo[] = [];
    if (lista.some((p) => p.cargo === 'presidente' && p.turno === 1)) g.push({ key: 'p1', label: 'Presidente · 1º turno', filtro: (p) => p.cargo === 'presidente' && p.turno === 1 });
    if (lista.some((p) => p.cargo === 'presidente' && p.turno === 2)) g.push({ key: 'p2', label: 'Presidente · cenários de 2º turno', filtro: (p) => p.cargo === 'presidente' && p.turno === 2 });
    [...new Set(lista.filter((p) => p.cargo !== 'presidente').map((p) => `${p.cargo}|${p.abrangencia}`))].sort().forEach((k) => {
      const [cargo, uf] = k.split('|');
      g.push({ key: k, label: `${CARGO_LABEL[cargo as Pesquisa['cargo']]} · ${uf}`, filtro: (p) => p.cargo === cargo && p.abrangencia === uf });
    });
    return g;
  }, [lista]);
  const [aba, setAba] = useState<string | null>(null);
  const atual = grupos.find((g) => g.key === aba) ?? grupos[0];
  const porCenario = useMemo(() => {
    const m = new Map<string, Pesquisa[]>();
    (atual ? lista.filter(atual.filtro) : []).forEach((p) => m.set(p.cenario, [...(m.get(p.cenario) ?? []), p]));
    return [...m.entries()];
  }, [lista, atual]);

  return (
    <>
      <PageHeader
        title="Pesquisas registradas no TSE"
        subtitle="Resultados como divulgados pelos institutos, com todas as informações exigidas por lei. Sem média, projeção ou interpretação."
      />
      <Stack spacing={3}>
        <Alert severity="info">
          Pesquisa é retrato de um momento, não previsão. Toda pesquisa eleitoral divulgada precisa estar registrada no TSE,
          mas o tribunal não a realiza nem garante seus resultados. Institutos usam métodos diferentes (presencial,
          telefone, internet), por isso os números podem variar entre eles. Considere sempre a margem de erro.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Critério deste site: só entram pesquisas com número de registro no TSE citado de forma idêntica em pelo menos
          duas fontes (ou na fonte do próprio instituto), com os seis dados de divulgação obrigatória (Res. TSE
          23.600/2019, art. 10). Pesquisas com valores incompletos ficam de fora. Pela mesma resolução (art. 11),
          pesquisas feitas antes do dia da eleição podem ser divulgadas até o próprio dia; levantamentos feitos no dia
          (boca de urna) só depois do encerramento da votação.
        </Typography>

        {res.loading && <Skeleton variant="rounded" height={420} />}
        {res.error != null && <Alert severity="error">Não foi possível carregar as pesquisas agora.</Alert>}
        {!res.loading && !res.error && lista.length === 0 && <Alert severity="warning">Nenhuma pesquisa disponível no momento.</Alert>}

        {grupos.length > 1 && (
          <Tabs value={atual?.key ?? false} onChange={(_, v: string) => setAba(v)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom: 1, borderColor: 'divider' }}>
            {grupos.map((g) => (
              <Tab key={g.key} value={g.key} label={g.label} />
            ))}
          </Tabs>
        )}

        {porCenario.map(([cenario, ps]) => (
          <Stack key={cenario} spacing={2}>
            {atual?.key !== 'p1' && (
              <Typography variant="h6" component="h2">
                {cenario}
              </Typography>
            )}
            {ps.length > 1 && <TabelaComparativa lista={ps} />}
            <Grid container spacing={2}>
              {ps.map((p) => (
                <Grid key={p.id} size={{ xs: 12, md: 6 }}>
                  <CartaoPesquisa p={p} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        ))}

        {lista.length > 0 && <SourceNote keys={res.data?.fontes ?? []} note="as fontes de cada pesquisa estão na própria ficha" />}
      </Stack>
    </>
  );
}
