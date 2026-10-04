import { useEffect, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import IosShareRounded from '@mui/icons-material/IosShareRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { BarList } from '@/components/charts/charts';
import { useNotify } from '@/components/feedback/notificationsContext';
import { publicUrl, shareContent } from '@/native/platform';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CandidateSearch } from '@/components/election/CandidateSearch';
import { useFinalistas, useUfUsuario, type DisputaFinal } from '@/components/resultados/hooks';
import { SourceNote } from '@/components/election/SourceNote';
import { StatusChip } from '@/components/election/StatusChip';
import { data } from '@/data/api';
import { CARGO_LABEL, money, moneyCompact, nomeProprio, NAO_INFORMADO, percent, variation } from '@/data/format';
import { MAX_COMPARAR, useComparar } from '@/data/localStore';
import { useMeta } from '@/data/MetaContext';
import type { CandidatoDetalhe } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

function fefc(c: CandidatoDetalhe) {
  return c.financas.receitas_por_fonte.filter((f) => f.fonte.toUpperCase().includes('FUNDO')).reduce((s, f) => s + f.valor, 0);
}

interface Row {
  label: string;
  hint?: string;
  render: (c: CandidatoDetalhe) => ReactNode;
}

const ROWS: { group: string; rows: Row[] }[] = [
  {
    group: 'Candidatura',
    rows: [
      { label: 'Cargo', render: (c) => `${CARGO_LABEL[c.cargo]} · ${c.uf === 'BR' ? 'Brasil' : c.uf}` },
      { label: 'Partido', render: (c) => `${c.partido}${c.federacao_nome ? ` (${nomeProprio(c.federacao_nome)})` : ''}` },
      { label: 'Situação do registro', render: (c) => <StatusChip situacao={c.situacao} naUrna={c.na_urna} /> },
      { label: 'Vice / suplentes', render: (c) => (c.companheiros ?? []).filter((x) => x.na_urna === c.na_urna).map((x) => `${nomeProprio(x.nome_urna)} (${x.partido})`).join(', ') || '—' },
    ],
  },
  {
    group: 'Perfil',
    rows: [
      { label: 'Idade na eleição', render: (c) => (c.idade != null ? `${c.idade} anos` : NAO_INFORMADO) },
      { label: 'Gênero', render: (c) => c.genero ?? NAO_INFORMADO },
      { label: 'Cor/raça (autodeclarada)', render: (c) => c.cor_raca ?? NAO_INFORMADO },
      { label: 'Grau de instrução', render: (c) => c.instrucao ?? NAO_INFORMADO },
      { label: 'Ocupação declarada', render: (c) => c.ocupacao ?? NAO_INFORMADO },
      { label: 'Naturalidade', render: (c) => (c.naturalidade ? nomeProprio(c.naturalidade) : NAO_INFORMADO) },
    ],
  },
  {
    group: 'Trajetória',
    rows: [
      { label: 'Candidaturas anteriores (desde 2004)', render: (c) => String(c.historico.length) },
      {
        label: 'Eleições vencidas registradas (desde 2004)',
        hint: 'Segundo o histórico do TSE, que nem sempre traz o resultado de todos os turnos',
        render: (c) => String(c.historico.filter((h) => h.eleito).length),
      },
      { label: 'Mandato atual no Congresso', render: (c) => c.mandato_atual ?? '—' },
      { label: 'Última eleição vencida (desde 2018)', render: (c) => c.eleito_ultima ?? '—' },
    ],
  },
  {
    group: 'Patrimônio declarado',
    rows: [
      { label: 'Total em 2026', render: (c) => money(c.bens_total) },
      { label: 'Total em 2022', render: (c) => (c.bens_2022 != null ? money(c.bens_2022) : '—') },
      {
        label: 'Variação nominal',
        hint: 'Sem correção pela inflação',
        render: (c) => {
          const v = variation(c.bens_total, c.bens_2022);
          return v != null ? `${v > 0 ? '+' : ''}${percent(v)}` : '—';
        },
      },
    ],
  },
  {
    group: 'Campanha (dados parciais)',
    rows: [
      { label: 'Receitas declaradas', render: (c) => money(c.receitas) },
      { label: 'Despesas contratadas', render: (c) => money(c.despesas) },
      { label: 'Recursos de fundos públicos', hint: 'FEFC + Fundo Partidário', render: (c) => money(fefc(c)) },
      { label: 'Limite legal de gastos', render: (c) => (c.limite_gastos ? money(c.limite_gastos) : NAO_INFORMADO) },
    ],
  },
  {
    group: 'Mandato atual',
    rows: [{ label: 'Cota parlamentar desde 2023', render: (c) => (c.mandato ? money(c.mandato.total) : 'Não se aplica (sem mandato no Congresso)') }],
  },
];

const CHARTS: { label: string; value: (c: CandidatoDetalhe) => number | null }[] = [
  { label: 'Patrimônio declarado em 2026', value: (c) => c.bens_total },
  { label: 'Receitas de campanha declaradas', value: (c) => c.receitas },
  { label: 'Despesas de campanha contratadas', value: (c) => c.despesas },
  { label: 'Cota parlamentar desde 2023', value: (c) => c.mandato?.total ?? null },
];

export function CompararPage() {
  const [params, setParams] = useSearchParams();
  const { lista, set, toggle } = useComparar();
  const notify = useNotify();
  const fromUrl = params.get('c');

  // A shared link (?c=sq1,sq2) replaces the local list once, then the URL is cleaned.
  useEffect(() => {
    if (fromUrl) {
      set(fromUrl.split(',').filter(Boolean).slice(0, MAX_COMPARAR));
      setParams({}, { replace: true });
    }
  }, [fromUrl, set, setParams]);

  // Atalhos do 2º turno: finalistas confirmados pelo TSE.
  const { meta } = useMeta();
  const fin = useFinalistas();
  const { uf: ufUsuario } = useUfUsuario({ detectarSozinho: false });
  const nomeUf = (uf: string) => meta?.ufs.find((u) => u.uf === uf)?.nome ?? uf;
  const atalhos = [fin.presidente, fin.governador(ufUsuario)].filter((d): d is DisputaFinal => Boolean(d && d.sqs.length >= 2));
  const mesmaLista = (sqs: string[]) => sqs.length === lista.length && sqs.every((sq) => lista.includes(sq));

  const key = lista.join(',');
  const res = useAsync(() => Promise.all(lista.map((sq) => data.candidato(sq).catch(() => null))), [key]);
  const cands = (res.data ?? []).filter((c): c is CandidatoDetalhe => Boolean(c));

  const share = async () => {
    const url = publicUrl(`comparar?c=${lista.join(',')}`);
    if ((await shareContent({ title: 'Comparação de candidaturas', url })) === 'copied') notify('Link da comparação copiado.');
  };

  return (
    <>
      <PageHeader
        title="Comparar candidaturas"
        subtitle={`Escolha até ${MAX_COMPARAR} nomes, de qualquer cargo. Os dados aparecem lado a lado, com os mesmos campos para todos.`}
        actions={
          lista.length > 0 && (
            <>
              <Button variant="outlined" startIcon={<IosShareRounded />} onClick={() => void share()}>
                Compartilhar
              </Button>
              <Button onClick={() => set([])}>Limpar</Button>
            </>
          )
        }
      />
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <CandidateSearch
            placeholder={lista.length >= MAX_COMPARAR ? `Limite de ${MAX_COMPARAR}: remova um para adicionar outro` : 'Adicionar candidatura: busque por nome ou número'}
            onPick={(sq) => {
              if (lista.includes(sq)) return notify('Essa candidatura já está na comparação.');
              if (lista.length >= MAX_COMPARAR) notify(`A comparação mostra até ${MAX_COMPARAR}. O mais antigo saiu da lista.`, 'info');
              toggle(sq);
            }}
          />
          {atalhos.length > 0 && (
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5, alignItems: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                2º turno:
              </Typography>
              {atalhos.map((d) => (
                <Button
                  key={`${d.uf}-${d.cargo}`}
                  size="small"
                  variant={mesmaLista(d.sqs) ? 'contained' : 'tonal'}
                  startIcon={<CompareArrowsRounded />}
                  onClick={() => set(d.sqs.slice(0, MAX_COMPARAR))}
                >
                  {d.cargo === 'presidente' ? 'Finalistas à Presidência' : `Finalistas ao Governo · ${nomeUf(d.uf)}`}
                </Button>
              ))}
              <Button component={RouterLink} to="/segundo-turno" size="small">
                Outros estados
              </Button>
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Dica: nas listas de candidatos, use o botão de comparar em cada cartão. Sua seleção fica salva só neste aparelho.
          </Typography>
        </CardContent>
      </Card>

      {lista.length === 0 && (
        <Alert severity="info">
          Nenhuma candidatura selecionada. Busque acima ou navegue pelas <RouterLink to="/eleicao">listas de candidatos</RouterLink>.
        </Alert>
      )}

      {res.loading && lista.length > 0 && <Skeleton variant="rounded" height={420} />}

      {cands.length > 0 && (
        <Stack spacing={3}>
          {cands.length > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none' } }}>
              Deslize a tabela para o lado para ver todas as candidaturas.
            </Typography>
          )}
          <Card sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: { xs: 112 + cands.length * 150, sm: 220 + cands.length * 200 }, tableLayout: 'fixed', '& td, & th': { wordBreak: 'break-word', px: { xs: 1, sm: 2 } } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: { xs: 112, sm: 200 }, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }} />
                  {cands.map((c) => (
                    <TableCell key={c.sq} sx={{ verticalAlign: 'top' }}>
                      <Stack spacing={1} sx={{ position: 'relative' }}>
                        <Tooltip title="Remover">
                          <IconButton size="small" onClick={() => toggle(c.sq)} sx={{ position: 'absolute', top: -4, right: -4 }} aria-label={`Remover ${nomeProprio(c.nome_urna)}`}>
                            <CloseRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <CandidatePhoto src={c.foto} alt={`Foto de ${nomeProprio(c.nome_urna)}`} width={88} />
                        <Box>
                          <Typography component={RouterLink} to={`/candidato/${c.sq}`} sx={{ fontWeight: 700, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                            {nomeProprio(c.nome_urna)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'text.primary' }}>
                              {c.numero}
                            </Box>{' '}
                            · {c.partido}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {ROWS.map((g) => [
                  <TableRow key={g.group}>
                    <TableCell colSpan={cands.length + 1} sx={{ bgcolor: 'background.subtle', py: 1 }}>
                      <Typography variant="overline">{g.group}</Typography>
                    </TableCell>
                  </TableRow>,
                  ...g.rows.map((r) => (
                    <TableRow key={`${g.group}-${r.label}`}>
                      <TableCell component="th" scope="row" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {r.label}
                        </Typography>
                        {r.hint && (
                          <Typography variant="caption" color="text.disabled">
                            {r.hint}
                          </Typography>
                        )}
                      </TableCell>
                      {cands.map((c) => (
                        <TableCell key={c.sq}>
                          <Typography variant="body2" component="div" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.render(c)}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  )),
                ])}
              </TableBody>
            </Table>
          </Card>

          <Grid container spacing={2}>
            {CHARTS.map((ch) => {
              const rows = cands.map((c) => ({ label: nomeProprio(c.nome_urna), value: ch.value(c) ?? 0, display: ch.value(c) == null ? 'Não se aplica' : moneyCompact(ch.value(c)) }));
              if (rows.every((r) => r.value === 0)) return null;
              return (
                <Grid key={ch.label} size={{ xs: 12, md: 6 }}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                        {ch.label}
                      </Typography>
                      <BarList data={rows} format={moneyCompact} />
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
          <Typography variant="caption" color="text.secondary">
            Cada barra usa a mesma cor e a mesma escala; a ordem é a da sua seleção. Valores de campanha são parciais e
            valores de patrimônio são autodeclarados. Cargos diferentes têm limites de gastos diferentes.
          </Typography>
          <SourceNote keys={['tse_candidatos', 'tse_complementar', 'tse_bens', 'tse_bens_2022', 'tse_prestacao', 'tse_historico', 'camara_ceap', 'senado_ceaps']} />
        </Stack>
      )}
    </>
  );
}
