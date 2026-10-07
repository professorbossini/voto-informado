import { useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { BarList, ColumnChart, StatTile } from '@/components/charts/charts';
import { FonteEmendasNota } from '@/components/emendas/FonteEmendasNota';
import { linkEmenda, rotaMunicipio, TIPO_AUTOR, TIPO_EMENDA, textoPublicado } from '@/components/emendas/emendas';
import { data, DataError } from '@/data/api';
import { money, moneyCompact, nomeProprio, normalize, number, percent } from '@/data/format';
import type { EmendasMunicipio, EmendasUf, ResumoEmendas, ValorEmenda } from '@/data/types';
import { MUN_BRASILIA, MUN_PADRAO, useMunicipioUsuario } from '@/data/useMunicipioUsuario';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '../PageHeader';

const UFS_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

/** Quais pagamentos somar: tudo o que foi pago a favorecidos do município, ou só à prefeitura. */
type Recorte = 'todos' | 'prefeitura';
type OrdemMunicipios = 'valor' | 'nome';

const val = (x: ValorEmenda, r: Recorte) => (r === 'prefeitura' ? x.prefeitura : x.valor);

function Explicacao() {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
          O que são emendas parlamentares
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            Emendas parlamentares são mudanças que deputados federais e senadores fazem no Orçamento da União para destinar recursos a uma
            finalidade ou a um lugar. Podem ser individuais (de cada parlamentar), de bancada (dos parlamentares de um estado), de comissão (de uma
            comissão da Câmara, do Senado ou do Congresso) ou de relator (do relator-geral do Orçamento). Nas transferências especiais, um tipo de
            emenda individual, o dinheiro vai direto para o caixa do município ou do estado, sem finalidade definida na emenda.
          </Typography>
          <Typography variant="body2">
            O gasto passa por estágios: <strong>empenhado</strong> (o governo reserva o valor e assume o compromisso), <strong>liquidado</strong>{' '}
            (confere que a obra, o bem ou o serviço foi entregue) e <strong>pago</strong> (o dinheiro sai do Tesouro). O que fica para pagar nos anos
            seguintes vira <strong>restos a pagar</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Os valores são os publicados pela Controladoria-Geral da União, em reais da época, sem correção pela inflação. Receber mais ou menos
            emendas não indica, por si só, nada sobre a qualidade do uso do dinheiro.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function AvisoCobertura({ resumo }: { resumo: ResumoEmendas | undefined }) {
  const anos = (resumo?.pagamentos_por_ano ?? []).filter((a) => a.total > 0 && a.sem_municipio / a.total > 0.2);
  return (
    <Alert severity="info">
      Aqui entram os pagamentos a favorecidos com sede no município (prefeitura e fundos municipais, empresas, entidades, órgãos federais e
      pessoas), pela data do pagamento. Uma empresa ou entidade pode ter sede aqui e executar a obra em outro lugar: use “Só prefeitura” para ver
      apenas o que foi pago à prefeitura e aos órgãos municipais. Pagamentos ao governo do estado contam só no estado.
      {anos.length > 0 && (
        <>
          {' '}
          Em {anos.map((a) => a.ano).join(', ')}, parte grande do valor pago no país ({anos.map((a) => `${a.ano}: ${percent(a.sem_municipio / a.total)}`).join('; ')})
          aparece no arquivo da CGU em nome de bancos que operam os repasses (sobretudo repasses fundo a fundo da saúde pelo Banco do Brasil), sem
          o município de destino: esses valores não aparecem nos municípios, e a comparação entre anos deve levar isso em conta.
        </>
      )}
    </Alert>
  );
}

function Municipio({ m, resumo, recorte }: { m: EmendasMunicipio; resumo: ResumoEmendas | undefined; recorte: Recorte }) {
  const [verTodosAutores, setVerTodosAutores] = useState(false);
  const [verTodasMaiores, setVerTodasMaiores] = useState(false);
  const r = m.recebido;
  const ate = resumo?.periodo.ate ?? new Date().getFullYear();
  const anos = useMemo(() => {
    const mapa = new Map(r.por_ano.map((a) => [a.ano, a]));
    const out = [];
    for (let a = m.periodo.desde; a <= ate; a++) {
      const v = mapa.get(a);
      const valor = v ? val(v, recorte) : 0;
      out.push({ label: String(a), value: valor, tooltip: `${a}: ${money(valor)}${a === ate ? ' (ano em curso)' : ''}` });
    }
    return out;
  }, [r.por_ano, m.periodo.desde, ate, recorte]);
  const funcoes = r.por_funcao
    .map((f) => ({ label: f.nome, value: val(f, recorte) }))
    .filter((f) => f.value > 0)
    .sort((a, b) => b.value - a.value);
  const tipos = r.por_tipo
    .map((t) => ({ label: TIPO_EMENDA[t.nome]?.curto ?? t.nome, value: val(t, recorte), hint: `${TIPO_EMENDA[t.nome]?.completo ?? t.nome}: ${money(val(t, recorte))}` }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value);
  const autores = r.por_autor.filter((a) => val(a, recorte) > 0).sort((a, b) => val(b, recorte) - val(a, recorte));
  const maiores = m.maiores.filter((e) => val(e, recorte) > 0).sort((a, b) => val(b, recorte) - val(a, recorte));
  const nome = nomeProprio(m.nome);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2">
          {nome} ({m.uf})
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pagamentos de emendas de {m.periodo.desde} até hoje{recorte === 'prefeitura' ? ', só à prefeitura e aos órgãos municipais' : ''}.
        </Typography>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile label="Pago a favorecidos do município" value={moneyCompact(r.total)} foot={money(r.total)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label={m.uf === 'DF' ? 'Só Governo do Distrito Federal' : 'Só prefeitura e órgãos municipais'}
            value={moneyCompact(r.prefeitura)}
            foot={r.total > 0 ? `${percent(r.prefeitura / r.total)} do total pago no município` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Emendas com pagamento aqui" value={number(r.emendas)} foot={`${number(autores.length)} autor(es)`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            label="Emendas com destino no município"
            value={moneyCompact(m.destinadas.total.empenhado)}
            foot={`empenhado em ${number(m.destinadas.total.emendas)} emenda(s) cuja localidade é o município`}
          />
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3">
            Pago por ano
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Soma dos pagamentos feitos em cada ano, inclusive de emendas de anos anteriores (restos a pagar). {ate} está em curso.
          </Typography>
          <ColumnChart data={anos} format={moneyCompact} height={200} />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
                Por área
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Função de governo da emenda, como classificada no Orçamento. “Encargos especiais” reúne as transferências especiais; “Múltiplo”, as
                emendas com mais de uma área.
              </Typography>
              <BarList data={funcoes} format={moneyCompact} limit={10} emptyText="Sem pagamentos neste recorte." />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
                Por tipo de emenda
              </Typography>
              <BarList data={tipos} format={moneyCompact} emptyText="Sem pagamentos neste recorte." />
              {recorte === 'todos' && (
                <>
                  <Typography variant="subtitle2" component="h4" sx={{ mt: 3, mb: 1 }}>
                    Quem recebeu (tipo de favorecido)
                  </Typography>
                  <BarList data={r.por_favorecido.map((f) => ({ label: f.nome, value: f.valor }))} format={moneyCompact} emptyText="Sem pagamentos." />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
            Por autor da emenda
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Quem indicou a emenda, com o nome como publicado pela CGU. Parlamentares em exercício têm link para a página deles no site. Bancadas,
            comissões e relator aparecem como publicados; “Sem informação” é o que o arquivo traz sem autor identificado.
          </Typography>
          {autores.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sem pagamentos neste recorte.
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: verTodosAutores ? 640 : undefined }}>
              <Table size="small" stickyHeader aria-label={`Autores das emendas pagas em ${nome}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Autor</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Pago</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(verTodosAutores ? autores : autores.slice(0, 15)).map((a) => (
                    <TableRow key={`${a.autor}-${a.autor_tipo}-${a.id ?? ''}`}>
                      <TableCell sx={{ maxWidth: 320 }}>
                        {a.id ? (
                          <Link component={RouterLink} to={`/parlamentar/${a.id}`} sx={{ fontWeight: 600 }}>
                            {a.nome ?? a.autor}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {a.autor}
                          </Typography>
                        )}
                        {a.id && (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {[a.partido, a.uf].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{TIPO_AUTOR[a.autor_tipo] ?? a.autor_tipo}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(val(a, recorte))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {autores.length > 15 && (
            <Button size="small" onClick={() => setVerTodosAutores((v) => !v)} sx={{ mt: 1 }}>
              {verTodosAutores ? 'Mostrar menos' : `Mostrar todos (${autores.length})`}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
            Emendas com maior valor pago aqui
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Valor pago a favorecidos do município em cada emenda (até {m.maiores.length} emendas). O código abre a emenda no Portal da Transparência,
            com todos os pagamentos e documentos.
          </Typography>
          {maiores.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sem pagamentos neste recorte.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" aria-label={`Emendas com maior valor pago em ${nome}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Emenda</TableCell>
                    <TableCell>Autor</TableCell>
                    <TableCell>Para quê</TableCell>
                    <TableCell align="right">Pago aqui</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(verTodasMaiores ? maiores : maiores.slice(0, 10)).map((e) => (
                    <TableRow key={e.codigo}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Link href={linkEmenda(m.fonte, e.codigo)} target="_blank" rel="noopener noreferrer" sx={{ fontFamily: 'monospace' }}>
                          {e.codigo} <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                        </Link>
                        <Typography variant="caption" color="text.secondary" component="div" title={TIPO_EMENDA[e.tipo]?.completo}>
                          {e.ano} · {TIPO_EMENDA[e.tipo]?.curto ?? e.tipo}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        {e.id ? (
                          <Link component={RouterLink} to={`/parlamentar/${e.id}`}>
                            {e.nome ?? e.autor}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {e.autor}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Typography variant="body2">{e.funcao}</Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {textoPublicado(e.acao)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(val(e, recorte))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {maiores.length > 10 && (
            <Button size="small" onClick={() => setVerTodasMaiores((v) => !v)} sx={{ mt: 1 }}>
              {verTodasMaiores ? 'Mostrar menos' : `Mostrar todas (${maiores.length})`}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ mb: 0.5 }}>
            Emendas com destino no município, por estágio
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Emendas cuja localidade de aplicação, no Orçamento, é o próprio município, pelo ano da emenda. Muitas emendas que acabam pagas aqui têm
            como localidade o estado, “Múltiplo” ou “Nacional”, por isso este quadro costuma ser menor que o de pagamentos.
          </Typography>
          {m.destinadas.por_ano.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma emenda com localidade neste município desde {m.periodo.desde}.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" aria-label="Estágios das emendas com destino no município">
                <TableHead>
                  <TableRow>
                    <TableCell>Ano da emenda</TableCell>
                    <TableCell align="right">Emendas</TableCell>
                    <TableCell align="right">Empenhado</TableCell>
                    <TableCell align="right">Liquidado</TableCell>
                    <TableCell align="right">Pago no ano</TableCell>
                    <TableCell align="right">Restos a pagar pagos</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...m.destinadas.por_ano].reverse().map((a) => (
                    <TableRow key={a.ano}>
                      <TableCell>{a.ano}</TableCell>
                      <TableCell align="right">{number(a.emendas)}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(a.empenhado)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(a.liquidado)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(a.pago)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {money(a.rp_pago)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function MunicipiosDaUf({ u, recorte, atual }: { u: EmendasUf; recorte: Recorte; atual: string | null }) {
  const [ordem, setOrdem] = useState<OrdemMunicipios>('valor');
  const [busca, setBusca] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const chave = recorte === 'prefeitura' ? 'prefeitura' : 'recebido';
  const lista = useMemo(() => {
    const q = normalize(busca);
    return u.municipios
      .filter((m) => !q || normalize(m.nome).includes(q))
      .sort((a, b) => (ordem === 'valor' ? b[chave] - a[chave] : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [u.municipios, busca, ordem, chave]);
  const max = Math.max(0, ...u.municipios.map((m) => m[chave]));
  const visiveis = verTodos || busca ? lista : lista.slice(0, 20);
  const totalUf = recorte === 'prefeitura' ? u.recebido_municipios.prefeitura : u.recebido_municipios.total;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
          Municípios de {u.nome}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Desde {u.periodo.desde}: {money(totalUf)} pagos a favorecidos em {number(u.municipios.filter((m) => m[chave] > 0).length)} município(s)
          {recorte === 'prefeitura' ? ' (só prefeituras e órgãos municipais)' : ''} e {money(u.governo_estadual.total)} ao governo do estado. A ordem
          por valor mostra quanto foi pago, não é avaliação; municípios maiores tendem a receber mais.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
          <TextField
            size="small"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar município"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Procurar município' },
            }}
            sx={{ flex: 1, maxWidth: { sm: 320 } }}
          />
          <ToggleButtonGroup size="small" exclusive value={ordem} onChange={(_, v: OrdemMunicipios | null) => v && setOrdem(v)} aria-label="Ordem dos municípios">
            <ToggleButton value="valor">Maior valor</ToggleButton>
            <ToggleButton value="nome">A–Z</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {visiveis.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum município encontrado.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" aria-label={`Valor pago em cada município de ${u.nome}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Município</TableCell>
                  <TableCell sx={{ width: '40%', display: { xs: 'none', sm: 'table-cell' } }} aria-hidden />
                  <TableCell align="right">Pago</TableCell>
                  <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    Emendas
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visiveis.map((m) => (
                  <TableRow key={m.cd} selected={m.cd === atual}>
                    <TableCell>
                      <Link component={RouterLink} to={rotaMunicipio(u.uf, m.cd)} sx={{ fontWeight: m.cd === atual ? 700 : 500 }}>
                        {nomeProprio(m.nome)}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }} aria-hidden>
                      <Box sx={{ height: 10, borderRadius: '0 4px 4px 0', bgcolor: 'primary.main', opacity: 0.7, width: `${max > 0 ? (m[chave] / max) * 100 : 0}%`, minWidth: m[chave] > 0 ? 2 : 0 }} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {moneyCompact(m[chave])}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'table-cell' } }}>
                      {number(m.emendas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!busca && lista.length > 20 && (
          <Button size="small" onClick={() => setVerTodos((v) => !v)} sx={{ mt: 1 }}>
            {verTodos ? 'Mostrar menos' : `Mostrar todos (${lista.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function EmendasPage() {
  const [params, setParams] = useSearchParams();
  const local = useMunicipioUsuario(true);
  const [recorte, setRecorte] = useState<Recorte>('todos');
  // Sem escolha na URL: o município da localização ou, sem ela, São Paulo (no DF, Brasília).
  const semEscolha = !params.get('uf') && !params.get('mun');
  const padrao = semEscolha ? (local.salvo ?? (local.status === 'df' ? MUN_BRASILIA : MUN_PADRAO)) : null;
  const uf = (padrao?.uf ?? params.get('uf') ?? '').toUpperCase() || null;
  const mun = padrao?.mun ?? params.get('mun');

  const resumo = useAsync(() => data.emendasResumo().catch(() => undefined), []);
  const ufDados = useAsync(() => (uf && UFS_NOMES[uf] ? data.emendasUf(uf) : Promise.resolve(null)), [uf]);
  const munDados = useAsync(
    () =>
      uf && mun
        ? data.emendasMunicipio(uf, mun).catch((e: unknown) => {
            if (e instanceof DataError && e.status === 404) return null;
            throw e;
          })
        : Promise.resolve(null),
    [uf, mun],
  );

  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v == null) p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true, preventScrollReset: true },
    );

  const municipios = useMemo(
    () => (ufDados.data?.municipios ?? []).map((m) => ({ codigo: m.cd, nome: nomeProprio(m.nome) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [ufDados.data],
  );
  const nomePadrao = padrao === MUN_BRASILIA ? 'Brasília' : 'São Paulo';
  const avisoLocal =
    local.status === 'buscando'
      ? 'Procurando o seu município…'
      : !padrao
        ? null
        : local.salvo
          ? 'Município pela sua localização, calculado no seu aparelho (a posição não sai dele).'
          : local.status === 'df'
            ? 'Você está no Distrito Federal: mostrando Brasília.'
            : local.status === 'negado'
              ? `Sem acesso à localização: mostrando ${nomePadrao}. Escolha o seu município na lista.`
              : local.status === 'fora'
                ? `Não identificamos um município brasileiro na sua localização: mostrando ${nomePadrao}.`
                : local.status === 'indisponivel'
                  ? `Localização indisponível agora: mostrando ${nomePadrao}.`
                  : `Mostrando ${nomePadrao}. Use a sua localização para ver o seu município.`;
  const fonte = munDados.data?.fonte ?? ufDados.data?.fonte;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Emendas no seu município"
        subtitle="Quanto dinheiro de emendas parlamentares foi pago no município, quem indicou e para quê. Dados oficiais do Portal da Transparência (CGU)."
      />
      <Explicacao />

      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="emendas-uf">Estado</InputLabel>
            <Select labelId="emendas-uf" label="Estado" value={uf ?? ''} onChange={(e) => set({ uf: e.target.value, mun: e.target.value === 'DF' ? MUN_BRASILIA.mun : null })}>
              {Object.entries(UFS_NOMES)
                .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
                .map(([sigla, nome]) => (
                  <MenuItem key={sigla} value={sigla}>
                    {nome} ({sigla})
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          {uf && (
            <Autocomplete
              size="small"
              sx={{ minWidth: 280, flex: 1, maxWidth: 420 }}
              options={municipios}
              loading={ufDados.loading}
              value={municipios.find((m) => m.codigo === mun) ?? null}
              onChange={(_, v) => set({ mun: v?.codigo ?? null, uf })}
              getOptionLabel={(o) => o.nome}
              isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
              renderInput={(p) => <TextField {...p} label="Município" placeholder="Digite o nome do município" />}
              noOptionsText="Nenhum município"
            />
          )}
          <Button
            size="small"
            startIcon={<MyLocationRounded />}
            disabled={local.status === 'buscando'}
            onClick={() => local.detectar(() => set({ uf: null, mun: null }))}
            sx={{ alignSelf: { sm: 'center' }, flexShrink: 0 }}
          >
            Usar minha localização
          </Button>
        </Stack>
        {avisoLocal && (
          <Typography variant="caption" color="text.secondary">
            {avisoLocal}
          </Typography>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={recorte}
          onChange={(_, v: Recorte | null) => v && setRecorte(v)}
          aria-label="Quais pagamentos somar"
          sx={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}
        >
          <ToggleButton value="todos">Todos os favorecidos do município</ToggleButton>
          <ToggleButton value="prefeitura">{uf === 'DF' ? 'Só Governo do Distrito Federal' : 'Só prefeitura e órgãos municipais'}</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <AvisoCobertura resumo={resumo.data} />

      {!uf ? (
        <Alert severity="info">Escolha um estado.</Alert>
      ) : munDados.loading || ufDados.loading ? (
        <Skeleton variant="rounded" height={480} />
      ) : munDados.error != null || ufDados.error != null ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                munDados.reload();
                ufDados.reload();
              }}
            >
              Tentar de novo
            </Button>
          }
        >
          {ufDados.error instanceof DataError && ufDados.error.status === 404
            ? 'Os dados de emendas ainda não foram publicados no site. Eles são atualizados automaticamente toda semana.'
            : 'Não foi possível carregar os dados agora. Tente novamente em instantes.'}
        </Alert>
      ) : !mun ? (
        <Alert severity="info">Escolha o município ({municipios.length} em {UFS_NOMES[uf]}).</Alert>
      ) : munDados.data ? (
        <Municipio m={munDados.data} resumo={resumo.data} recorte={recorte} />
      ) : (
        <Alert severity="info">
          Nenhum pagamento de emenda a favorecidos deste município e nenhuma emenda com destino nele desde {resumo.data?.periodo.desde ?? 2019} no
          arquivo da CGU.
        </Alert>
      )}

      {ufDados.data && <MunicipiosDaUf u={ufDados.data} recorte={recorte} atual={mun} />}

      <FonteEmendasNota fonte={fonte} />
    </Stack>
  );
}
