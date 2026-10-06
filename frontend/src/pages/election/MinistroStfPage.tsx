import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
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
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import { FeedNoticias } from '@/components/noticias/FeedNoticias';
import { AvisoDadosPublicosStf, CreditoFoto, FontesStf } from '@/components/stf/PlenarioStf';
import { PARCELAS, aos75, cargoStf, diaBr, fotoStf, idade, mesCurtoRef, mesRef, usd } from '@/components/stf/stf';
import { data } from '@/data/api';
import { money } from '@/data/format';
import type { FolhaStf, MinistroStf, MinistroStfDetalhe, Stf } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';

/** "PRESIDENTE DO STF" → "Presidente do STF" (siglas e preposições como na língua). */
function tituloFolha(t: string) {
  return t
    .toLowerCase()
    .split(' ')
    .map((w, i) => (w === 'stf' ? 'STF' : i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  if (!valor) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '260px 1fr' }, gap: { sm: 2 }, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {valor}
      </Typography>
    </Box>
  );
}

function Cabecalho({ m }: { m: MinistroStf }) {
  const anos = idade(m.nascimento);
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { sm: 'center' }, mb: 3 }}>
      <Box
        component="img"
        src={fotoStf(m.foto) ?? undefined}
        alt={`Foto oficial de ${m.nome}`}
        sx={{ width: 150, height: 200, objectFit: 'cover', objectPosition: 'top', borderRadius: 4, bgcolor: 'action.hover', boxShadow: 2 }}
      />
      <Box>
        <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
          {m.nome}
        </Typography>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
          {cargoStf(m)}
        </Typography>
        <Typography color="text.secondary">
          {m.nome_completo}
          {anos != null ? ` · ${anos} anos` : ''}
          {m.naturalidade ? ` · natural de ${m.naturalidade}` : ''}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          {m.datas.posse && <Chip size="small" label={`No STF desde ${diaBr(m.datas.posse)}`} />}
          <Chip size="small" label={`${m.antiguidade === 0 ? 'Preside a Corte' : `${m.antiguidade}º em antiguidade`}`} />
          <Chip
            size="small"
            component="a"
            clickable
            href={m.pasta}
            target="_blank"
            rel="noopener noreferrer"
            icon={<OpenInNewRounded sx={{ fontSize: 14 }} />}
            label="Pasta oficial no STF"
          />
        </Stack>
      </Box>
    </Stack>
  );
}

function Trajetoria({ m, stf }: { m: MinistroStf; stf: Stf }) {
  const p = m.nomeado_por ? stf.presidentes[m.nomeado_por] : undefined;
  const limite = aos75(m.nascimento);
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
          No Supremo
        </Typography>
        <Linha rotulo="Nascimento" valor={m.nascimento ? `${diaBr(m.nascimento)}${m.naturalidade ? `, ${m.naturalidade}` : ''}` : null} />
        <Linha rotulo="Indicação ao STF" valor={diaBr(m.datas.indicacao)} />
        <Linha rotulo="Nomeação (decreto)" valor={diaBr(m.datas.nomeacao)} />
        <Linha rotulo="Posse no STF" valor={diaBr(m.datas.posse)} />
        <Linha rotulo="Posse na Vice-Presidência" valor={diaBr(m.datas.posse_vice)} />
        <Linha rotulo="Posse na Presidência" valor={diaBr(m.datas.posse_presidencia)} />
        <Linha rotulo="Completa 75 anos (aposentadoria compulsória)" valor={limite ? diaBr(limite) : null} />
        {p && (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 2.5, p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
            <Avatar src={fotoStf(p.foto) ?? undefined} alt={`Retrato oficial de ${p.nome}`} sx={{ width: 72, height: 72, '& img': { objectPosition: 'top' } }} />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Nomeação assinada por
              </Typography>
              <Typography sx={{ fontWeight: 800 }}>{p.nome}</Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Presidente da República ({p.mandatos.map((x) => `${x.inicio.slice(0, 4)}–${x.fim.slice(0, 4)}`).join(', ')}), após aprovação do Senado
                (Constituição, art. 101)
              </Typography>
              <CreditoFoto p={p} />
            </Box>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
          A aposentadoria compulsória aos 75 anos está na Constituição (art. 40, § 1º, II, com a Emenda Constitucional 88/2015); a data acima é só a
          do aniversário de 75 anos.
        </Typography>
        <FontesStf stf={stf} chaves={['pastas', 'nomeacao']} />
      </CardContent>
    </Card>
  );
}

function Remuneracao({ det, stf }: { det: MinistroStfDetalhe; stf: Stf }) {
  const folhas = det.remuneracao;
  const [sel, setSel] = useState(0);
  const f: FolhaStf | undefined = folhas[sel];
  const max = Math.max(...folhas.map((x) => x.bruto ?? 0), 1);
  const cronologico = useMemo(() => [...folhas].reverse(), [folhas]);
  if (!folhas.length) {
    return (
      <Card id="remuneracao">
        <CardContent>
          <Typography variant="h5" component="h2">
            Remuneração
          </Typography>
          <Typography color="text.secondary">A folha deste ministro ainda não foi coletada.</Typography>
        </CardContent>
      </Card>
    );
  }
  const grupo = (g: (typeof PARCELAS)[number]['grupo'], titulo: string) => {
    const itens = PARCELAS.filter((p) => p.grupo === g);
    return (
      <Box>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>
          {titulo}
        </Typography>
        {itens.map((p) => {
          const v = f?.parcelas[p.k] ?? 0;
          const mostrar = g === 'desconto' ? Math.abs(v) : v;
          return (
            <Tooltip key={p.k} title={p.legenda} placement="top-start">
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5, borderBottom: 1, borderColor: 'divider', opacity: v ? 1 : 0.55 }}>
                <Typography variant="body2">
                  (<span translate="no">{p.k}</span>) {p.nome}
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: ['F', 'M'].includes(p.k) ? 800 : 500 }}>
                  {g === 'desconto' && v ? '− ' : ''}
                  {money(mostrar)}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    );
  };
  return (
    <Card id="remuneracao">
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
          <Typography variant="h5" component="h2">
            Remuneração
          </Typography>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="folha-mes">Mês da folha</InputLabel>
            <Select labelId="folha-mes" label="Mês da folha" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
              {folhas.map((x, i) => (
                <MenuItem key={`${x.ref}-${x.folha}`} value={i}>
                  {mesRef(x.ref)}
                  {folhas.filter((y) => y.ref === x.ref).length > 1 ? ` · ${x.folha}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        {f && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mt: 2 }}>
              {[
                ['Subsídio', f.parcelas.A],
                ['Bruto no mês', f.bruto],
                ['Líquido', f.liquido],
              ].map(([r, v]) => (
                <Box key={r as string} sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
                  <Typography variant="caption" color="text.secondary">
                    {r} · {mesRef(f.ref)}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {money(v as number | null)}
                  </Typography>
                </Box>
              ))}
            </Box>
            {f.funcao && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Lotação/função na folha: {tituloFolha(f.funcao)}
              </Typography>
            )}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
              {grupo('remuneratoria', 'Parcelas de natureza remuneratória')}
              {grupo('desconto', 'Descontos')}
              {grupo('eventual', 'Parcelas não permanentes, indenizações e benefícios')}
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
              Parcelas (A) a (S) do modelo da Resolução CNJ 215/2015, exatamente como o STF publica; passe o mouse ou toque numa linha para ver a
              explicação oficial.
            </Typography>
          </>
        )}

        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 700 }}>
          Mês a mês
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 140, overflowX: 'auto', pb: 0.5 }} role="img" aria-label="Remuneração bruta e líquida mês a mês">
          {cronologico.map((x) => {
            const i = folhas.indexOf(x);
            return (
              <Tooltip key={`${x.ref}-${x.folha}`} title={`${mesRef(x.ref)}: bruto ${money(x.bruto)}, líquido ${money(x.liquido)}`}>
                <Box
                  onClick={() => setSel(i)}
                  sx={{ flex: '1 0 18px', maxWidth: 34, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: 'pointer', position: 'relative' }}
                >
                  <Box sx={{ height: `${((x.bruto ?? 0) / max) * 100}%`, bgcolor: i === sel ? 'primary.main' : 'primary.light', opacity: i === sel ? 1 : 0.45, borderRadius: '4px 4px 0 0', position: 'relative' }}>
                    <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${((x.liquido ?? 0) / (x.bruto || 1)) * 100}%`, bgcolor: 'primary.dark', borderRadius: '4px 4px 0 0', opacity: 0.9 }} />
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">
            {cronologico[0] && mesCurtoRef(cronologico[0].ref)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            barra inteira = bruto · parte escura = líquido
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cronologico.at(-1) && mesCurtoRef(cronologico.at(-1)!.ref)}
          </Typography>
        </Stack>
        <TableContainer sx={{ mt: 2, maxHeight: 360 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Mês</TableCell>
                <TableCell align="right">Subsídio</TableCell>
                <TableCell align="right">Bruto</TableCell>
                <TableCell align="right">Descontos</TableCell>
                <TableCell align="right">Líquido</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {folhas.map((x, i) => (
                <TableRow key={`${x.ref}-${x.folha}`} hover selected={i === sel} onClick={() => setSel(i)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{mesRef(x.ref)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(x.parcelas.A)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(x.bruto)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(Math.abs(x.parcelas.M ?? 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {money(x.liquido)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <FontesStf stf={stf} chaves={['remuneracao']} />
      </CardContent>
    </Card>
  );
}

function Viagens({ det, stf }: { det: MinistroStfDetalhe; stf: Stf }) {
  const [verP, setVerP] = useState(10);
  const [verD, setVerD] = useState(10);
  const anos = Object.entries(det.resumo_viagens);
  const { passagens, diarias } = det.viagens;
  const periodo = (ida: string | null, volta: string | null, mes: string | null) =>
    ida ? `${diaBr(ida)}${volta && volta !== ida ? ` a ${diaBr(volta)}` : ''}` : mes ? mesRef(mes) : '—';
  return (
    <Card id="viagens">
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h5" component="h2">
          Diárias e passagens aéreas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Concedidas pelo STF em viagens a serviço, como o Tribunal publica: motivo, destino ou trecho, período e valor. Diárias no exterior são pagas
          em dólar (US$), sem conversão aqui. Quando o STF não informa trecho ou datas (por exemplo, nas passagens com motivo “Art. 14 da IN
          291/2024”), aparece só o mês.
        </Typography>
        {anos.length === 0 ? (
          <Typography color="text.secondary">Nenhuma diária ou passagem publicada para este ministro.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ano</TableCell>
                  <TableCell align="right">Passagens</TableCell>
                  <TableCell align="right">Custo das passagens</TableCell>
                  <TableCell align="right">Diárias</TableCell>
                  <TableCell align="right">Valor das diárias</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {anos.map(([ano, a]) => (
                  <TableRow key={ano} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{ano}</TableCell>
                    <TableCell align="right">{a.passagens || '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {a.passagens_valor ? money(a.passagens_valor) : '—'}
                    </TableCell>
                    <TableCell align="right">{a.diarias ? a.diarias.toLocaleString('pt-BR') : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {[a.diarias_brl ? money(a.diarias_brl) : null, a.diarias_usd ? usd.format(a.diarias_usd) : null].filter(Boolean).join(' + ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {diarias.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 700 }}>
              Diárias ({diarias.length})
            </Typography>
            <Stack spacing={1}>
              {diarias.slice(0, verD).map((d) => (
                <Box key={d.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 0.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {d.destino ?? 'Destino não informado'} <Chip size="small" label={d.tipo} sx={{ ml: 0.5, height: 20 }} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {periodo(d.ida, d.volta, d.mes)}
                      {d.motivo ? ` · ${d.motivo}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, textAlign: { sm: 'right' } }}>
                    {d.valor != null ? (d.moeda === 'USD' ? usd.format(d.valor) : money(d.valor)) : '—'}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
                      {d.quantidade == null ? '' : d.quantidade === 1 ? '1 diária' : `${d.quantidade.toLocaleString('pt-BR')} diárias`}
                    </Typography>
                  </Typography>
                </Box>
              ))}
            </Stack>
            {diarias.length > verD && (
              <Button onClick={() => setVerD((v) => v + 20)} sx={{ mt: 1 }}>
                Ver mais diárias
              </Button>
            )}
          </>
        )}

        {passagens.length > 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 700 }}>
              Passagens ({passagens.length})
            </Typography>
            <Stack spacing={1}>
              {passagens.slice(0, verP).map((p) => (
                <Box key={p.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 0.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {p.trecho ?? 'Trecho não informado'} <Chip size="small" label={p.tipo} sx={{ ml: 0.5, height: 20 }} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {periodo(p.ida, p.volta, p.mes)}
                      {p.motivo ? ` · ${p.motivo}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, textAlign: { sm: 'right' } }}>
                    {money(p.custo)}
                    {p.reembolso ? (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400 }}>
                        bilhete {money(p.bilhete)} − reembolso {money(p.reembolso)}
                      </Typography>
                    ) : null}
                  </Typography>
                </Box>
              ))}
            </Stack>
            {passagens.length > verP && (
              <Button onClick={() => setVerP((v) => v + 20)} sx={{ mt: 1 }}>
                Ver mais passagens
              </Button>
            )}
          </>
        )}
        <FontesStf stf={stf} chaves={['viagens']} />
      </CardContent>
    </Card>
  );
}

export function MinistroStfPage() {
  const { id = '' } = useParams();
  const { hash } = useLocation();
  const q = useAsync(() => data.stf(), []);
  const det = useAsync(() => data.ministroStf(id).catch(() => null), [id]);
  const m = q.data?.ministros.find((x) => x.id === id);

  useEffect(() => {
    if (!hash || det.loading) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, det.loading]);

  if (q.loading) return <Skeleton variant="rounded" height={420} />;
  if (!q.data || !m) {
    return (
      <Stack spacing={2}>
        <Alert severity="info">Não encontramos este ministro na composição atual do STF publicada no site.</Alert>
        <Button component={RouterLink} to="/plenario?casa=stf" startIcon={<ArrowBackRounded />} sx={{ alignSelf: 'flex-start' }}>
          Plenário do STF
        </Button>
      </Stack>
    );
  }
  const stf = q.data;
  return (
    <>
      <Button component={RouterLink} to="/plenario?casa=stf" startIcon={<ArrowBackRounded />} sx={{ mb: 2 }}>
        Plenário do STF
      </Button>
      <Cabecalho m={m} />
      <Stack spacing={3}>
        <Trajetoria m={m} stf={stf} />
        {det.loading ? (
          <Skeleton variant="rounded" height={320} />
        ) : det.data ? (
          <>
            <Remuneracao det={det.data} stf={stf} />
            <Viagens det={det.data} stf={stf} />
          </>
        ) : (
          <Alert severity="info">A remuneração e as viagens deste ministro aparecem aqui depois da próxima coleta automática.</Alert>
        )}
        <AvisoDadosPublicosStf />
      </Stack>
      <FeedNoticias tipo="ministro" id={m.id} nome={m.nome} />
    </>
  );
}
