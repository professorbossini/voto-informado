import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { BarList } from '@/components/charts/charts';
import { normalize } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';
import { eua, type MembroResumo } from '../api';
import { LegendaEscala, MapaEua, faixasPorPosicao } from '../componentes/MapaEua';
import { LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota } from '../componentes/comuns';
import { CATEGORIAS_GASTO, dolar, dolar0, dolarCompacto, nomeEstado, nomePartido, trimestre, UFS_POR_NOME } from '../formato';

function GastoFederal() {
  const navigate = useNavigate();
  const r = useAsync(() => eua.gastoFederal(), []);
  const [medida, setMedida] = useState<'per_capita' | 'valor'>('per_capita');
  const [anoSel, setAnoSel] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<'nome' | 'valor'>('nome');
  const d = r.data;
  const ano = anoSel ?? d?.ano_distritos ?? '';
  const valores = useMemo(
    () => Object.fromEntries(Object.entries(d?.estados ?? {}).map(([uf, e]) => [uf, medida === 'valor' ? e.anos[ano]?.valor : e.anos[ano]?.per_capita])),
    [d, ano, medida],
  );
  if (r.error) return <Erro onRetry={r.reload} />;
  if (!d) return <Carregando />;
  const nums = Object.values(valores).filter((v): v is number => v != null);
  const fmt = medida === 'valor' ? dolarCompacto : dolar0;
  const linhas = UFS_POR_NOME.filter((uf) => valores[uf] != null).sort((a, b) => (ordem === 'nome' ? 0 : (valores[b] ?? 0) - (valores[a] ?? 0)));

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2">
          Dinheiro federal em cada estado
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Contratos, convênios, empréstimos e outros repasses do governo federal pelo local onde são executados (USAspending.gov, do Tesouro dos
          EUA). Por habitante, a comparação entre estados de tamanhos diferentes é mais justa.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <ToggleButtonGroup size="small" exclusive value={medida} onChange={(_, v) => v && setMedida(v)}>
            <ToggleButton value="per_capita">Por habitante</ToggleButton>
            <ToggleButton value="valor">Total</ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="af">Ano fiscal</InputLabel>
            <Select labelId="af" label="Ano fiscal" value={ano} onChange={(e) => setAnoSel(e.target.value)}>
              {[...d.anos].reverse().map((a) => (
                <MenuItem key={a} value={a}>
                  {a} {a === d.ano_corrente ? '(em andamento)' : `(out/${Number(a) - 1} a set/${a})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <MapaEua
              faixas={faixasPorPosicao(valores)}
              rotulos={Object.fromEntries(Object.entries(valores).map(([uf, v]) => [uf, `${nomeEstado(uf)}: ${v != null ? fmt(v) : 'sem dado'}${medida === 'per_capita' ? ' por habitante' : ''}`]))}
              onSelect={(uf) => navigate(`/eua/estado/${uf}`)}
            />
            {nums.length > 0 && <LegendaEscala min={fmt(Math.min(...nums))} max={fmt(Math.max(...nums))} titulo={`${medida === 'valor' ? 'Total' : 'Valor por habitante'} no ano fiscal: estados em 10 grupos do mesmo tamanho, do menor ao maior valor`} />}
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <TableContainer sx={{ maxHeight: 460 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel active={ordem === 'nome'} direction="asc" onClick={() => setOrdem('nome')}>
                        Estado
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">
                      <TableSortLabel active={ordem === 'valor'} direction="desc" onClick={() => setOrdem('valor')}>
                        {medida === 'valor' ? 'Total' : 'Por habitante'}
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhas.map((uf) => (
                    <TableRow key={uf} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/eua/estado/${uf}`}>
                          {nomeEstado(uf)}
                        </Link>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(valores[uf] ?? null)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">
              Ordem alfabética; toque no cabeçalho para ordenar pelo valor.
            </Typography>
          </Grid>
        </Grid>
        <FonteNota chaves={['eua-usaspending']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

function GastosGabinetes() {
  const r = useAsync(() => eua.gastosCamara(), []);
  const cong = useAsync(() => eua.congresso(), []);
  const [anoSel, setAnoSel] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<string>('nome');
  const [busca, setBusca] = useState('');
  const membros = useMemo(() => new Map<string, MembroResumo>((cong.data?.camara.membros ?? []).map((m) => [m.id, m])), [cong.data]);
  if (r.error) return <Erro onRetry={r.reload} />;
  if (!r.data || !cong.data) return <Carregando />;
  const d = r.data;
  const anos = Object.keys(d.anos).sort();
  const ano = anoSel ?? anos[anos.length - 1];
  const q = normalize(busca);
  const linhas = (d.anos[ano] ?? [])
    .filter((x) => membros.has(x.id) && (!q || normalize(membros.get(x.id)!.nome).includes(q)))
    .sort((a, b) =>
      ordem === 'nome'
        ? (membros.get(a.id)!.sobrenome ?? '').localeCompare(membros.get(b.id)!.sobrenome ?? '', 'pt-BR')
        : Number(b[ordem] ?? 0) - Number(a[ordem] ?? 0),
    );
  const totalCat = d.categorias
    .map((c) => ({ label: CATEGORIAS_GASTO[c] ?? c, value: (d.anos[ano] ?? []).reduce((s, x) => s + Number(x[c] ?? 0), 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const colunas = ['total', 'pessoal', 'viagens', 'aluguel_comunicacao', 'servicos'];

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2">
          Gastos dos gabinetes da Câmara
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cada gabinete recebe uma verba anual de representação (Members' Representational Allowance), que paga equipe, escritórios no estado,
          viagens, correspondência e serviços. A Câmara publica os gastos a cada trimestre (Statement of Disbursements); último trimestre
          disponível: {d.ultimo ? trimestre(d.ultimo) : '–'}. O Senado só publica em PDF:{' '}
          <LinkExterno href={d.senado.url}>relatórios do Senado</LinkExterno>.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <ToggleButtonGroup size="small" exclusive value={ano} onChange={(_, v) => v && setAnoSel(v)}>
            {anos.map((a) => (
              <ToggleButton key={a} value={a}>
                {a}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <TextField size="small" label="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
        </Stack>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Toda a Câmara em {ano}, por categoria
            </Typography>
            <BarList data={totalCat} format={dolarCompacto} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel active={ordem === 'nome'} direction="asc" onClick={() => setOrdem('nome')}>
                        Gabinete
                      </TableSortLabel>
                    </TableCell>
                    {colunas.map((c) => (
                      <TableCell key={c} align="right">
                        <TableSortLabel active={ordem === c} direction="desc" onClick={() => setOrdem(c)}>
                          {c === 'total' ? 'Total' : (CATEGORIAS_GASTO[c] ?? c).split(' (')[0].split(',')[0]}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhas.map((x) => {
                    const m = membros.get(x.id)!;
                    return (
                      <TableRow key={x.id} hover>
                        <TableCell>
                          <Link component={RouterLink} to={`/eua/membro/${x.id}`} translate="no">
                            {m.nome}
                          </Link>
                          <Typography variant="caption" color="text.secondary" component="p">
                            {nomePartido(m.partido)} · {m.uf}
                            {m.distrito ? `-${m.distrito}` : ''}
                          </Typography>
                        </TableCell>
                        {colunas.map((c) => (
                          <TableCell key={c} align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: c === 'total' ? 700 : 400 }}>
                            {dolar0(Number(x[c] ?? 0))}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              {linhas.length} gabinetes em exercício, em ordem alfabética (toque num cabeçalho para ordenar pelo valor). Quem assumiu no meio do ano
              tem menos meses de gasto. Valores acumulados no ano, como publicados; total de todas as categorias: {dolar(linhas.reduce((s, x) => s + x.total, 0))}.
            </Typography>
          </Grid>
        </Grid>
        <FonteNota chaves={['eua-sod']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

export function GastosEuaPage() {
  return (
    <>
      <PageHeader title="Gastos públicos" subtitle="O dinheiro federal que chega a cada estado e os gastos dos gabinetes da Câmara dos EUA, como publicados pelos órgãos oficiais." />
      <AvisoInformativo />
      <Stack spacing={3}>
        <GastoFederal />
        <GastosGabinetes />
        <Box />
      </Stack>
    </>
  );
}
