import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import IosShareRounded from '@mui/icons-material/IosShareRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { BarList, ColumnChart, Meter, StatTile } from '@/components/charts/charts';
import { useNotify } from '@/components/feedback/notificationsContext';
import { publicUrl, shareContent } from '@/native/platform';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { DesfechoDaCandidatura } from '@/components/election/DesfechoChip';
import { StatusChip } from '@/components/election/StatusChip';
import { assetUrl, data, DataError } from '@/data/api';
import { CARGO_LABEL, money, moneyCompact, nomeProprio, NAO_INFORMADO, percent, variation } from '@/data/format';
import { useComparar, useCola } from '@/data/localStore';
import type { CandidatoDetalhe } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';

/** Chips with long labels wrap instead of being cut. */
const WRAP_CHIP = { height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } } as const;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function Section({ title, subtitle, children, fontes, note }: { title: string; subtitle?: ReactNode; children: ReactNode; fontes: string[]; note?: string }) {
  return (
    <Card component="section">
      <CardContent sx={{ p: { xs: 2.5, md: 3 }, '&:last-child': { pb: { xs: 2.5, md: 3 } } }}>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ mt: 2.5 }}>{children}</Box>
        <SourceNote keys={fontes} note={note} sx={{ mt: 2.5 }} />
      </CardContent>
    </Card>
  );
}

function Dado({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="dt">
        {label}
      </Typography>
      <Typography variant="body2" component="dd" sx={{ m: 0, fontWeight: 500 }}>
        {value || NAO_INFORMADO}
      </Typography>
    </Box>
  );
}

function rotuloRede(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '');
    const label = `${u.hostname.replace(/^www\./, '')}${path}`;
    return label.length > 48 ? `${label.slice(0, 47)}…` : label;
  } catch {
    return url;
  }
}

function Redes({ redes }: { redes: string[] }) {
  const [todas, setTodas] = useState(false);
  if (redes.length === 0) return <Typography color="text.secondary">Nenhum endereço informado.</Typography>;
  return (
    <Stack spacing={0.75}>
      {(todas ? redes : redes.slice(0, 10)).map((r) => (
        <Link key={r} href={r} target="_blank" rel="noopener noreferrer nofollow" sx={{ wordBreak: 'break-all' }}>
          {rotuloRede(r)} <OpenInNewRounded sx={{ fontSize: 14, verticalAlign: 'middle' }} />
        </Link>
      ))}
      {redes.length > 10 && (
        <Button size="small" onClick={() => setTodas((t) => !t)} sx={{ alignSelf: 'flex-start' }}>
          {todas ? 'Mostrar menos' : `Mostrar todos os ${redes.length} endereços`}
        </Button>
      )}
    </Stack>
  );
}

function Patrimonio({ c }: { c: CandidatoDetalhe }) {
  const varia = variation(c.bens_total, c.bens_2022);
  const [todos, setTodos] = useState(false);
  return (
    <Section
      title="Patrimônio declarado"
      subtitle="Valores informados pela própria candidatura à Justiça Eleitoral no registro. O site reproduz os números como publicados, sem correções."
      fontes={['tse_bens', 'tse_bens_2022', 'tse_historico']}
    >
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Total declarado em 2026" value={c.bens.length || c.declarou_bens ? moneyCompact(c.bens_total) : '—'} foot={c.bens.length ? `${c.bens.length} ${c.bens.length === 1 ? 'item' : 'itens'} · ${money(c.bens_total)}` : 'Nenhum bem informado na declaração entregue ao TSE'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile label="Total declarado em 2022" value={c.bens_2022 != null ? moneyCompact(c.bens_2022) : '—'} foot={c.bens_2022 != null ? money(c.bens_2022) : 'Não foi candidato(a) em 2022 ou não declarou'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatTile
            label="Variação nominal 2022 → 2026"
            value={varia != null ? `${varia > 0 ? '+' : ''}${percent(varia)}` : '—'}
            foot="Sem correção pela inflação. Mudanças podem refletir compra, venda, herança ou critério de avaliação."
          />
        </Grid>
      </Grid>
      {c.bens_por_tipo.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Por tipo de bem
          </Typography>
          <BarList data={c.bens_por_tipo.map((b) => ({ label: b.tipo, value: b.valor, hint: `${b.tipo}: ${money(b.valor)} (${b.n} ${b.n === 1 ? 'item' : 'itens'})` }))} format={moneyCompact} limit={8} />
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Lista de bens (como declarada)
          </Typography>
          <Stack component="ul" divider={<Box component="li" aria-hidden sx={{ borderTop: 1, borderColor: 'divider', listStyle: 'none' }} />} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {(todos ? c.bens : c.bens.slice(0, 8)).map((b, i) => (
              <Box component="li" key={i} sx={{ py: 1 }}>
                <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {b.tipo}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {money(b.valor)}
                  </Typography>
                </Stack>
                {b.descricao && (
                  <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                    {b.descricao}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
          {c.bens.length > 8 && (
            <Button size="small" onClick={() => setTodos((t) => !t)} sx={{ mt: 1 }}>
              {todos ? 'Mostrar menos' : `Mostrar todos os ${c.bens.length} itens`}
            </Button>
          )}
        </>
      )}
    </Section>
  );
}

function Campanha({ c }: { c: CandidatoDetalhe }) {
  const f = c.financas;
  const temDados = (c.receitas ?? 0) > 0 || (c.despesas ?? 0) > 0;
  const ehVice = Boolean(c.titular_sq);
  return (
    <Section
      title="Financiamento da campanha"
      subtitle="Receitas e despesas contratadas declaradas à Justiça Eleitoral até a data do arquivo. Os dados são parciais: as campanhas continuam informando até a prestação de contas final."
      fontes={['tse_prestacao', 'tse_complementar']}
    >
      {!temDados ? (
        <Typography color="text.secondary">
          {ehVice
            ? 'Nas chapas, a movimentação financeira costuma ser declarada pela candidatura titular. Veja o perfil do titular.'
            : 'Nenhuma receita ou despesa declarada até a data do arquivo.'}
        </Typography>
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <StatTile label="Receitas declaradas" value={moneyCompact(c.receitas)} foot={money(c.receitas)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <StatTile label="Despesas contratadas" value={moneyCompact(c.despesas)} foot={money(c.despesas)} />
            </Grid>
          </Grid>
          {c.limite_gastos && c.despesas != null && (
            <Meter value={c.despesas} max={c.limite_gastos} label="Despesas em relação ao limite legal de gastos do cargo" format={moneyCompact} />
          )}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              De onde veio o dinheiro (fonte)
            </Typography>
            <BarList data={f.receitas_por_fonte.filter((r) => r.valor > 0).map((r) => ({ label: rotuloFonte(r.fonte), value: r.valor, display: `${moneyCompact(r.valor)} · ${percent(r.valor / (c.receitas || 1))}` }))} format={moneyCompact} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Fundo Especial (FEFC) e Fundo Partidário são recursos públicos repassados pelos partidos. "Outros recursos" incluem doações de pessoas físicas, recursos próprios e de outros candidatos.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Receitas por origem
              </Typography>
              <BarList data={f.receitas_por_origem.map((r) => ({ label: r.origem, value: r.valor }))} format={moneyCompact} limit={6} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Despesas por categoria
              </Typography>
              <BarList data={f.despesas_por_categoria.map((r) => ({ label: r.categoria, value: r.valor }))} format={moneyCompact} limit={6} />
            </Grid>
          </Grid>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Maiores doadores e repasses
              </Typography>
              <Table size="small">
                <TableBody>
                  {f.maiores_doadores.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ pl: 0 }}>
                        <Typography variant="body2">{d.doador}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.origem}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {money(d.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Maiores fornecedores contratados
              </Typography>
              <Table size="small">
                <TableBody>
                  {f.maiores_fornecedores.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ pl: 0 }}>{d.fornecedor}</TableCell>
                      <TableCell align="right" sx={{ pr: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {money(d.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Grid>
          </Grid>
        </Stack>
      )}
    </Section>
  );
}

function rotuloFonte(f: string) {
  const k = f.toUpperCase();
  if (k.includes('FUNDO ESPECIAL')) return 'Fundo Especial (FEFC)';
  if (k.includes('PARTIDARIO') || k.includes('PARTIDÁRIO')) return 'Fundo Partidário';
  if (k.includes('OUTROS')) return 'Outros recursos';
  return f;
}

function Trajetoria({ c }: { c: CandidatoDetalhe }) {
  return (
    <Section
      title="Trajetória eleitoral"
      subtitle="Candidaturas anteriores registradas pelo TSE desde 2004, com o resultado oficial de cada uma."
      fontes={['tse_historico']}
    >
      {c.historico.length === 0 ? (
        <Typography color="text.secondary">Nenhuma candidatura anterior encontrada no histórico do TSE (desde 2004).</Typography>
      ) : (
        <Stack component="ol" spacing={0} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {c.historico.map((h, i) => (
            <Stack component="li" key={`${h.ano}-${h.cargo}-${i}`} direction="row" spacing={2} sx={{ position: 'relative', pb: 2 }}>
              <Box sx={{ width: 52, flexShrink: 0, textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{h.ano}</Typography>
              </Box>
              <Box sx={{ position: 'relative', width: 12, flexShrink: 0 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', mt: 0.75, bgcolor: h.eleito ? 'primary.main' : 'background.paper', border: 2, borderColor: 'primary.main' }} />
                {i < c.historico.length - 1 && <Box sx={{ position: 'absolute', left: 5, top: 24, bottom: -6, width: 2, bgcolor: 'divider' }} />}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {h.cargo} · {nomeProprio(h.ue)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {h.partido} · nº {h.numero} · {h.resultado ?? 'Resultado não informado na base do TSE'}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Section>
  );
}

function Mandato({ c }: { c: CandidatoDetalhe }) {
  const m = c.mandato;
  if (!m) return null;
  const serie = m.mensal.map((x) => ({ label: `${MESES[x.mes - 1]}/${String(x.ano).slice(2)}`, value: x.valor }));
  return (
    <Section
      title={`Gastos de mandato: ${m.casa === 'camara' ? 'Câmara dos Deputados' : 'Senado Federal'}`}
      subtitle="Cota para o Exercício da Atividade Parlamentar desde fev/2023. É uma verba prevista em lei para custear o mandato; gastar mais ou menos não indica, por si só, irregularidade."
      fontes={m.fontes}
    >
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatTile label="Total reembolsado na legislatura" value={moneyCompact(m.total)} foot={money(m.total)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatTile label="Situação" value={m.em_exercicio ? 'Em exercício' : 'Fora do exercício'} foot={`${m.partido ?? ''} · ${m.uf ?? ''}`} />
        </Grid>
      </Grid>
      <ColumnChart data={serie} format={moneyCompact} />
      <Button component={RouterLink} to={`/parlamentar/${m.id}`} sx={{ mt: 2 }}>
        Ver detalhamento por categoria e fornecedor
      </Button>
    </Section>
  );
}

export function CandidatoPage() {
  const { sq = '' } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const { has, toggle } = useComparar();
  const { cola, setCola } = useCola();
  const res = useAsync(() => data.candidato(sq), [sq]);

  if (res.loading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={240} />
        <Skeleton variant="rounded" height={320} />
      </Stack>
    );
  }
  if (res.error || !res.data) {
    const notFound = res.error instanceof DataError && res.error.status === 404;
    return (
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Alert severity={notFound ? 'warning' : 'error'}>
          {notFound ? 'Candidatura não encontrada na base do TSE.' : 'Não foi possível carregar os dados agora. Tente novamente em instantes.'}
        </Alert>
        <Button component={RouterLink} to="/eleicao" startIcon={<ArrowBackRounded />}>
          Ver candidaturas
        </Button>
      </Stack>
    );
  }

  const c = res.data;
  const nome = nomeProprio(c.nome_urna);
  const colaKey = c.cargo === 'senador' ? (cola.escolhas['senador-1'] === c.sq ? 'senador-1' : cola.escolhas['senador-2'] === c.sq ? 'senador-2' : null) : c.cargo;
  const naCola = colaKey ? cola.escolhas[colaKey] === c.sq : false;
  const podeCola = c.na_urna && ['presidente', 'governador', 'senador', 'deputado-federal', 'deputado-estadual', 'deputado-distrital'].includes(c.cargo);

  const addCola = () => {
    if (naCola && colaKey) {
      setCola((prev) => {
        const escolhas = { ...prev.escolhas };
        delete escolhas[colaKey];
        return { ...prev, escolhas };
      });
      notify('Removido da sua cola.');
      return;
    }
    setCola((prev) => {
      const escolhas = { ...prev.escolhas };
      let key: string = c.cargo;
      if (c.cargo === 'senador') key = !escolhas['senador-1'] || escolhas['senador-1'] === c.sq ? 'senador-1' : 'senador-2';
      escolhas[key] = c.sq;
      const uf = c.uf === 'BR' ? prev.uf : c.uf;
      return { uf, escolhas };
    });
    notify(`${nome} foi para a sua cola.`);
  };

  const share = async () => {
    const url = publicUrl(`candidato/${c.sq}`);
    const text = `${nome} (${c.numero}, ${c.partido}) · ${CARGO_LABEL[c.cargo]}: dados oficiais do TSE`;
    if ((await shareContent({ title: nome, text, url })) === 'copied') notify('Link copiado.');
  };

  return (
    <Stack spacing={3}>
      <Button startIcon={<ArrowBackRounded />} onClick={() => void navigate(-1)} sx={{ alignSelf: 'flex-start' }}>
        Voltar
      </Button>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            <CandidatePhoto src={c.foto} alt={`Foto de ${nome}`} width={160} rounded={16} />
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary">
                {CARGO_LABEL[c.cargo]} · {c.uf === 'BR' ? 'Brasil' : c.uf}
              </Typography>
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '2rem', md: '2.5rem' } }}>
                {nome}
              </Typography>
              <Typography color="text.secondary">{nomeProprio(c.nome)}{c.nome_social ? ` · nome social: ${nomeProprio(c.nome_social)}` : ''}</Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5 }} aria-label={`Número na urna: ${c.numero}`}>
                  {c.numero.split('').map((d, i) => (
                    <Box key={i} sx={{ width: 36, height: 46, border: 2, borderColor: 'text.primary', borderRadius: 1.5, display: 'grid', placeItems: 'center', fontFamily: 'monospace', fontSize: '1.6rem', fontWeight: 700 }}>
                      {d}
                    </Box>
                  ))}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>
                    {c.partido} · {nomeProprio(c.partido_nome)}
                  </Typography>
                  {c.federacao_nome && (
                    <Typography variant="body2" color="text.secondary">
                      {nomeProprio(c.federacao_nome)}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
                <DesfechoDaCandidatura c={c} size="medium" />
                <StatusChip situacao={c.situacao} naUrna={c.na_urna} size="medium" />
                {c.mandato_atual && <Chip variant="outlined" sx={WRAP_CHIP} label={`Mandato atual no Congresso: ${c.mandato_atual}`} />}
                {c.eleito_ultima && <Chip variant="outlined" sx={WRAP_CHIP} label={`Eleito(a): ${c.eleito_ultima}`} />}
              </Stack>
              {c.coligacao && (
                <Typography variant="body2" color="text.secondary">
                  Coligação “{nomeProprio(c.coligacao)}”: {c.coligacao_composicao}
                </Typography>
              )}
              {c.titular && (
                <Typography variant="body2">
                  Compõe a chapa de{' '}
                  <Link component={RouterLink} to={`/candidato/${c.titular.sq}`}>
                    {nomeProprio(c.titular.nome_urna)} ({c.titular.partido})
                  </Link>
                </Typography>
              )}
              {(c.companheiros ?? []).length > 0 && (
                <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', gap: 2, pt: 0.5 }}>
                  {(c.companheiros ?? []).map((x) => (
                    <Stack key={x.sq} direction="row" spacing={1} component={RouterLink} to={`/candidato/${x.sq}`} sx={{ alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                      <CandidatePhoto src={x.foto} alt={`Foto de ${nomeProprio(x.nome_urna)}`} width={36} rounded={8} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {CARGO_LABEL[x.cargo]}
                          {!x.na_urna ? ' (fora da urna)' : ''}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {nomeProprio(x.nome_urna)} · {x.partido}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
            <Button variant={has(c.sq) ? 'contained' : 'tonal'} startIcon={<CompareArrowsRounded />} onClick={() => toggle(c.sq)}>
              {has(c.sq) ? 'Na comparação' : 'Comparar'}
            </Button>
            {podeCola && (
              <Button variant={naCola ? 'contained' : 'tonal'} startIcon={<ListAltRounded />} onClick={addCola}>
                {naCola ? 'Na minha cola' : 'Adicionar à minha cola'}
              </Button>
            )}
            <Button variant="outlined" startIcon={<IosShareRounded />} onClick={() => void share()}>
              Compartilhar
            </Button>
            <Button variant="text" endIcon={<OpenInNewRounded />} href={c.divulgacand} target="_blank" rel="noopener noreferrer">
              Ver no DivulgaCandContas (TSE)
            </Button>
          </Stack>
          {has(c.sq) && (
            <Button component={RouterLink} to="/comparar" size="small" sx={{ mt: 1 }}>
              Abrir comparação
            </Button>
          )}
          <SourceNote keys={['tse_candidatos', 'tse_complementar', 'tse_fotos']} sx={{ mt: 2 }} />
        </CardContent>
      </Card>

      {c.resultados.length > 0 && (
        <Section title="Resultado oficial da apuração" fontes={['tse_resultados']}>
          <Grid container spacing={2}>
            {c.resultados.map((r) => (
              <Grid key={r.turno} size={{ xs: 12, sm: 6 }}>
                <StatTile
                  label={`${r.turno}º turno`}
                  value={r.pct != null ? `${r.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}
                  foot={`${r.votos != null ? r.votos.toLocaleString('pt-BR') : '—'} votos · ${r.situacao ?? 'em apuração'}`}
                />
              </Grid>
            ))}
          </Grid>
        </Section>
      )}

      <Section title="Perfil" fontes={['tse_candidatos', 'tse_complementar']}>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Dado label="Idade na eleição" value={c.idade != null ? `${c.idade} anos` : null} />
          <Dado label="Gênero" value={c.genero} />
          <Dado label="Cor/raça (autodeclarada)" value={c.cor_raca} />
          <Dado label="Grau de instrução" value={c.instrucao} />
          <Dado label="Ocupação declarada" value={c.ocupacao} />
          <Dado label="Estado civil" value={c.estado_civil} />
          <Dado label="Naturalidade" value={c.naturalidade ? nomeProprio(c.naturalidade).replace(/ \/ (\w\w)$/i, (m) => m.toUpperCase()) : null} />
          <Dado label="Limite legal de gastos do cargo" value={c.limite_gastos ? money(c.limite_gastos) : null} />
        </Box>
      </Section>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Stack spacing={3}>
            <Patrimonio c={c} />
            <Campanha c={c} />
            <Mandato c={c} />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            <Trajetoria c={c} />
            {(c.propostas.length > 0 || c.cargo === 'presidente' || c.cargo === 'governador') && (
              <Section title="Plano de governo" subtitle="Documento entregue pela candidatura ao TSE, sem edição." fontes={['tse_propostas']}>
                <Stack spacing={1}>
                  {c.propostas.length === 0 && <Typography color="text.secondary">Nenhum documento disponível na base do TSE na data da coleta.</Typography>}
                  {c.propostas.map((p, i) => (
                    <Button key={p} variant="outlined" startIcon={<DescriptionRounded />} href={assetUrl(p) ?? p} target="_blank" rel="noopener noreferrer" sx={{ justifyContent: 'flex-start' }}>
                      Abrir proposta {c.propostas.length > 1 ? i + 1 : ''} (PDF)
                    </Button>
                  ))}
                </Stack>
              </Section>
            )}
            <Section title="Sites e redes sociais" subtitle="Endereços informados pela própria candidatura ao TSE." fontes={['tse_redes']}>
              <Redes redes={c.redes} />
            </Section>
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
