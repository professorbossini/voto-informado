import { useMemo } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
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
import { useColorScheme } from '@mui/material/styles';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { CATEGORICAL } from '@/components/charts/palette';
import { MapaCanvas } from '@/components/mapa/MapaCanvas';
import { data, DataError } from '@/data/api';
import { dateTime, nomeProprio, number, normalize } from '@/data/format';
import {
  FAIXAS,
  MUN_BRASILIA,
  SEM_DADO,
  faixa,
  tetoRelativo,
  formaBrasilia,
  formasDaMalha,
  indexarMunicipios,
  pctNaLinha,
  rampa,
  resumoPorUf,
  somarLinhas,
  ufsNoMapa,
  unirCaixas,
  votacaoDaLinha,
  type Caixa,
  type FormaMunicipio,
  type MapaVotos,
} from '@/data/mapaVotos';
import { DEGRAUS_VANTAGEM, liderDaLinha, linhasDoNivel, pintarLider, tonsDe, type Nivel } from '@/data/mapaLider';
import { useAsync } from '@/hooks/useAsync';
import { ink } from '@/theme/tokens';
import { PageHeader } from '../PageHeader';

const UFS_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};
const UFS_POR_NOME = Object.keys(UFS_NOMES).sort((a, b) => UFS_NOMES[a].localeCompare(UFS_NOMES[b], 'pt-BR'));
const nomeLocal = (uf: string) => (uf === 'ZZ' ? 'Exterior' : (UFS_NOMES[uf] ?? uf));

const pct1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtPct = (v: number | null) => (v == null ? '–' : `${pct1.format(v)}%`);

/** Malhas municipais das 26 UFs (o DF é um município só e usa o contorno do estado), lidas em paralelo e decodificadas uma vez. */
let formasCache: Promise<FormaMunicipio[]> | null = null;
function carregarFormas(): Promise<FormaMunicipio[]> {
  formasCache ??= Promise.all(
    Object.keys(UFS_NOMES)
      .filter((uf) => uf !== 'DF')
      .map((uf) => data.malhaMunicipal(uf).then(formasDaMalha)),
  ).then((porUf) => {
    const df = formaBrasilia();
    return [...porUf.flat(), ...(df ? [df] : [])];
  });
  formasCache.catch(() => (formasCache = null));
  return formasCache;
}

const semArquivo = (e: unknown) => {
  if (e instanceof DataError && e.status === 404) return null;
  throw e;
};

function useDark() {
  const { mode, systemMode } = useColorScheme();
  return (mode === 'system' ? systemMode : mode) === 'dark';
}

/** Arquivo oficial do TSE de um município (o modelo vem no próprio JSON publicado). */
function urlTse(mapa: MapaVotos, uf: string, cd: string) {
  return mapa.fonte.url.replaceAll('<uf>', uf.toLowerCase()).replace('<municipio>', cd);
}

const fmtTick = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function Legenda({ cores, dark, teto, relativa }: { cores: string[]; dark: boolean; teto: number; relativa: boolean }) {
  const sem = SEM_DADO[dark ? 'dark' : 'light'];
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={{ alignItems: { sm: 'flex-end' } }}>
      <Box sx={{ flex: 1, maxWidth: 520 }}>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
          {relativa
            ? `% dos válidos no município · escala de 0 a ${fmtTick(teto)}%, o teto desta candidatura`
            : '% dos votos válidos no município (mesma escala para todas as candidaturas)'}
        </Typography>
        <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }} aria-hidden>
          {cores.map((c) => (
            <Box key={c} sx={{ flex: 1, height: 14, bgcolor: c }} />
          ))}
        </Box>
        <Box sx={{ position: 'relative', height: 18 }} aria-hidden>
          {Array.from({ length: FAIXAS + 1 }, (_, i) => (
            <Typography
              key={i}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                left: `${(i * 100) / FAIXAS}%`,
                transform: i === 0 ? 'none' : i === FAIXAS ? 'translateX(-100%)' : 'translateX(-50%)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 11,
                display: { xs: i % 2 ? 'none' : 'block', sm: 'block' },
              }}
            >
              {fmtTick((i * teto) / FAIXAS)}
            </Typography>
          ))}
        </Box>
        <Typography variant="caption" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          Escala de 10 faixas iguais, de 0% (cor mais {dark ? 'escura' : 'clara'}) a {fmtTick(teto)}% ou mais (cor mais {dark ? 'clara' : 'escura'}).
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pb: { sm: 2.5 } }}>
        <Box
          aria-hidden
          sx={{
            width: 22,
            height: 14,
            borderRadius: 0.5,
            border: 1,
            borderColor: 'divider',
            background: `repeating-linear-gradient(135deg, ${sem.fundo} 0 3px, ${sem.traco} 3px 4px)`,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Sem resultado final do TSE
        </Typography>
      </Stack>
    </Stack>
  );
}

/** Cor neutra para quem lidera além das cores validadas (4ª candidatura em diante). */
const NEUTRA = { light: '#9D95B3', dark: '#6E6687' };

const UNIDADE: Record<Nivel, [string, string]> = { mun: ['município', 'municípios'], uf: ['estado', 'estados'], regiao: ['região', 'regiões'] };

function LegendaLider({ itens, fundo, nivel }: { itens: { nome: string; cor: string; n: number }[]; fundo: string; nivel: Nivel }) {
  return (
    <Stack spacing={1}>
      <Stack data-figura-legenda direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5 }} aria-label="Legenda do mapa">
        {itens.map((l) => (
          <Stack key={l.nome} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: l.cor, border: 1, borderColor: 'divider' }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }} translate="no">
              {l.nome}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {number(l.n)} {UNIDADE[nivel][l.n === 1 ? 0 : 1]}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Vantagem sobre o 2º:
        </Typography>
        <Box sx={{ display: 'flex', borderRadius: 0.5, overflow: 'hidden', border: 1, borderColor: 'divider' }} aria-hidden>
          {tonsDe(itens[0]?.cor ?? NEUTRA.light, fundo).map((c) => (
            <Box key={c} sx={{ width: 22, height: 12, bgcolor: c }} />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          até {DEGRAUS_VANTAGEM.join(' · ')} · mais pontos
        </Typography>
      </Stack>
    </Stack>
  );
}

/** Votação de todas as candidaturas num lugar, na ordem do TSE (mais votados primeiro). */
function Votacao({ mapa, linha, destaque }: { mapa: MapaVotos; linha: number[]; destaque: string | null }) {
  const lista = votacaoDaLinha(mapa, linha);
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {lista.map((v, i) => {
        const ativo = v.candidato.sq === destaque;
        return (
          <Box
            component="li"
            key={v.candidato.sq}
            sx={{ py: 0.5, px: 0.75, mx: -0.75, borderRadius: 1, bgcolor: ativo ? 'action.selected' : undefined }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography variant="body2" sx={{ width: 24, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {i + 1}º
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" component="span" translate="no" sx={{ fontWeight: ativo ? 800 : 600 }}>
                  {nomeProprio(v.candidato.nome_urna)}
                </Typography>{' '}
                <Typography variant="caption" component="span" color="text.secondary" translate="no">
                  {v.candidato.partido} · {v.candidato.numero}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                {number(v.votos)} · <strong>{fmtPct(v.pct)}</strong>
              </Typography>
            </Stack>
            <Box sx={{ ml: 4, mt: 0.25, height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }} aria-hidden>
              <Box sx={{ width: `${Math.min(100, v.pct)}%`, height: 1, bgcolor: 'primary.main', opacity: ativo ? 1 : 0.55 }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function MapaPage() {
  const [params, setParams] = useSearchParams();
  const dark = useDark();
  const t1 = useAsync(() => data.mapaVotos(1).catch(semArquivo), []);
  const t2 = useAsync(() => data.mapaVotos(2).catch(semArquivo), []);
  const formas = useAsync(carregarFormas, []);

  // O 2º turno aparece (e vira o padrão) só quando o arquivo dele existe.
  const tem2 = Boolean(t2.data);
  const turno: 1 | 2 = tem2 && params.get('turno') !== '1' ? 2 : 1;
  const mapa = turno === 2 ? t2.data : t1.data;
  const carregando = t1.loading || (t2.loading && !t1.data);
  const ufParam = (params.get('uf') ?? '').toUpperCase();
  const uf = UFS_NOMES[ufParam] ? ufParam : null;
  const mun = params.get('mun');
  // Escala relativa (padrão): destaca onde cada candidatura foi mais forte, mesmo com poucos votos.
  const relativa = params.get('escala') !== 'fixa';
  // Nível do mapa: cada município pintado pelo resultado dele, do estado ou da região.
  const nivelParam = params.get('nivel');
  const nivel: Nivel = nivelParam === 'uf' || nivelParam === 'regiao' ? nivelParam : 'mun';

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

  // Nenhuma candidatura pré-selecionada: quem colore o mapa é a escolha de quem visita.
  const candidatos = useMemo(
    () => [...(mapa?.candidatos ?? [])].sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR') || a.numero.localeCompare(b.numero)),
    [mapa],
  );
  const sq = params.get('c');
  const indice = mapa && sq ? mapa.candidatos.findIndex((c) => c.sq === sq) : -1;
  const escolhido = indice >= 0 ? mapa!.candidatos[indice] : null;

  const indexados = useMemo(() => (mapa ? indexarMunicipios(mapa) : new Map<string, { uf: string; linha: number[] }>()), [mapa]);
  const nomes = useMemo(() => {
    const out = new Map<string, { uf: string; nome: string }>();
    for (const [u, muns] of Object.entries(mapa?.nomes ?? {})) for (const [cd, nome] of Object.entries(muns)) out.set(cd, { uf: u, nome: nomeProprio(nome) });
    return out;
  }, [mapa]);

  const caixaBrasil = useMemo<Caixa>(() => unirCaixas(ufsNoMapa().map((u) => u.caixa))!, []);
  const foco = useMemo<Caixa>(() => (uf ? (ufsNoMapa().find((u) => u.uf === uf)?.caixa ?? caixaBrasil) : caixaBrasil), [uf, caixaBrasil]);

  const resumo = useMemo(() => (mapa ? resumoPorUf(mapa) : []), [mapa]);
  const tamanho = (mapa?.candidatos.length ?? 0) + 1;
  const totalBrasil = useMemo(() => somarLinhas(resumo.filter((r) => r.uf !== 'ZZ').map((r) => r.linha), tamanho), [resumo, tamanho]);
  const totalGeral = useMemo(() => somarLinhas(resumo.map((r) => r.linha), tamanho), [resumo, tamanho]);
  const exterior = resumo.find((r) => r.uf === 'ZZ');

  // Linha de votos que vale para cada município no nível escolhido.
  const niveis = useMemo(() => linhasDoNivel(indexados, resumo, nivel, tamanho), [indexados, resumo, nivel, tamanho]);
  const fundoMapa = dark ? ink[900] : ink[0];

  const teto = useMemo(() => {
    if (!escolhido || !relativa) return 100;
    const pcts: number[] = [];
    for (const { linha } of niveis.values()) {
      const p = pctNaLinha(linha, indice);
      if (p != null) pcts.push(p);
    }
    return tetoRelativo(pcts);
  }, [niveis, escolhido, indice, relativa]);

  // Sem candidatura escolhida: quem lidera (cores em ordem alfabética). Com candidatura: o % dela.
  const lider = useMemo(
    () => (mapa && !escolhido ? pintarLider(niveis, mapa.candidatos.map((c) => c.nome_urna), CATEGORICAL[dark ? 'dark' : 'light'], NEUTRA[dark ? 'dark' : 'light'], fundoMapa) : null),
    [mapa, escolhido, niveis, dark, fundoMapa],
  );

  const faixas = useMemo(() => {
    if (!mapa) return null;
    if (lider) return lider.faixas;
    const out = new Map<string, number>();
    for (const [cd, { linha }] of niveis) {
      const p = pctNaLinha(linha, indice);
      if (p != null) out.set(cd, faixa(p, teto));
    }
    return out;
  }, [mapa, lider, niveis, indice, teto]);

  const cores = useMemo(() => lider?.cores ?? rampa(dark ? 'dark' : 'light'), [lider, dark]);

  // Municípios com resultado mas sem contorno na malha do IBGE (ex.: criados depois dela).
  const semContorno = useMemo(() => {
    if (!formas.data) return [];
    const comForma = new Set(formas.data.map((f) => f.cd));
    return [...indexados.entries()].filter(([cd, m]) => m.uf !== 'ZZ' && !comForma.has(cd)).map(([cd, m]) => `${nomes.get(cd)?.nome ?? cd} (${m.uf})`);
  }, [formas.data, indexados, nomes]);

  const opcoesBusca = useMemo(
    () =>
      [...nomes.entries()]
        .map(([cd, m]) => ({ cd, uf: m.uf, nome: m.nome, rotulo: `${m.nome} · ${m.uf === 'ZZ' ? 'Exterior' : m.uf}` }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.uf.localeCompare(b.uf)),
    [nomes],
  );

  const sel = mun ? nomes.get(mun) : undefined;
  const selLinha = mun ? indexados.get(mun)?.linha : undefined;

  const rotulo = (cd: string) => {
    const n = nomes.get(cd);
    const linha = indexados.get(cd)?.linha;
    return (
      <>
        <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>
          {n ? `${n.nome} (${n.uf})` : cd}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {(() => {
            const ref = niveis.get(cd);
            if (!linha || !ref) return 'Sem resultado final do TSE';
            const nomeLocal = nivel === 'uf' ? (UFS_NOMES[ref.unidade] ?? ref.unidade) : ref.unidade;
            if (escolhido) {
              const p = `${nomeProprio(escolhido.nome_urna)}: ${fmtPct(pctNaLinha(ref.linha, indice))} dos válidos`;
              return nivel === 'mun' ? `${p} neste município` : nivel === 'uf' ? `${p} em ${nomeLocal}` : `${p} em todo o ${nomeLocal}`;
            }
            const l = liderDaLinha(ref.linha);
            if (!l || !mapa) return `${number(linha[0])} votos válidos`;
            const quem = nomeProprio(mapa.candidatos[l.indice]?.nome_urna);
            const pct = fmtPct(l.pct);
            const pts = fmtPct(l.vantagem).replace('%', '');
            if (nivel === 'mun') return `Lidera neste município: ${quem} com ${pct}, ${pts} pontos à frente do 2º`;
            if (nivel === 'uf') return `Lidera em ${nomeLocal}: ${quem} com ${pct}, ${pts} pontos à frente do 2º`;
            return `Lidera em todo o ${nomeLocal}: ${quem} com ${pct}, ${pts} pontos à frente do 2º`;
          })()}
        </Typography>
      </>
    );
  };

  const fundoCartao = dark ? ink[900] : ink[0]; // fundo do cartão (background.paper)

  return (
    <>
      <PageHeader
        title="Mapa do voto"
        subtitle="Votação para Presidente em cada município, estado e região: quem teve mais votos em cada lugar ou, escolhendo uma candidatura, a porcentagem dos votos válidos dela. Dados oficiais do TSE."
      />

      {carregando ? (
        <Skeleton variant="rounded" height={420} />
      ) : t1.error && !mapa ? (
        <Alert severity="error">Não foi possível carregar o mapa agora. Tente de novo em instantes.</Alert>
      ) : !mapa ? (
        <Alert severity="info">
          O mapa aparece depois que o TSE concluir a totalização dos municípios. Enquanto isso, acompanhe a apuração em{' '}
          <Link component={RouterLink} to="/resultados">
            Resultados
          </Link>
          .
        </Alert>
      ) : (
        <Stack spacing={3}>
          {/* Controles */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
            {tem2 && (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={turno}
                onChange={(_, t: 1 | 2 | null) => t && set({ turno: t === 2 ? null : '1' })}
                aria-label="Turno"
              >
                <ToggleButton value={1}>1º turno</ToggleButton>
                <ToggleButton value={2}>2º turno</ToggleButton>
              </ToggleButtonGroup>
            )}
            <FormControl size="small" sx={{ minWidth: 260, flex: { md: 1 } }}>
              <InputLabel id="mapa-candidatura">Colorir por</InputLabel>
              <Select
                labelId="mapa-candidatura"
                label="Colorir por"
                value={escolhido?.sq ?? ''}
                displayEmpty
                onChange={(e) => set({ c: e.target.value || null })}
                renderValue={() =>
                  escolhido ? (
                    <span translate="no">
                      {nomeProprio(escolhido.nome_urna)} · {escolhido.partido} · {escolhido.numero}
                    </span>
                  ) : (
                    'Quem teve mais votos em cada lugar'
                  )
                }
              >
                <MenuItem value="">
                  Quem teve mais votos em cada lugar
                </MenuItem>
                {candidatos.map((c) => (
                  <MenuItem key={c.sq} value={c.sq}>
                    <span translate="no">
                      {nomeProprio(c.nome_urna)} · {c.partido} · {c.numero}
                    </span>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="mapa-uf">Ver no mapa</InputLabel>
              <Select labelId="mapa-uf" label="Ver no mapa" value={uf ?? ''} onChange={(e) => set({ uf: e.target.value || null })}>
                <MenuItem value="">Brasil inteiro</MenuItem>
                {UFS_POR_NOME.map((u) => (
                  <MenuItem key={u} value={u}>
                    {UFS_NOMES[u]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              sx={{ minWidth: 240, flex: { md: 1 } }}
              options={opcoesBusca}
              value={opcoesBusca.find((o) => o.cd === mun) ?? null}
              onChange={(_, o) => set({ mun: o?.cd ?? null })}
              getOptionLabel={(o) => o.rotulo}
              isOptionEqualToValue={(a, b) => a.cd === b.cd}
              filterOptions={(opts, { inputValue }) => {
                const q = normalize(inputValue);
                return (q ? opts.filter((o) => normalize(o.rotulo).includes(q)) : opts).slice(0, 80);
              }}
              renderInput={(p) => <TextField {...p} label="Buscar município" />}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <ToggleButtonGroup exclusive size="small" value={nivel} onChange={(_, v: Nivel | null) => v && set({ nivel: v === 'mun' ? null : v })} aria-label="Pintar o mapa por">
              <ToggleButton value="mun">Municípios</ToggleButton>
              <ToggleButton value="uf">Estados</ToggleButton>
              <ToggleButton value="regiao">Regiões</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {escolhido
                ? 'As cores mostram a porcentagem dos votos válidos da candidatura escolhida.'
                : 'As cores mostram quem teve mais votos em cada lugar, em ordem alfabética do nome na urna (sem relação com partidos); quanto mais forte, maior a vantagem sobre o 2º colocado.'}
            </Typography>
          </Stack>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card>
                <CardContent data-figura sx={{ p: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  {formas.loading ? (
                    <Skeleton variant="rounded" height={380} />
                  ) : formas.error || !formas.data ? (
                    <Alert severity="error">Não foi possível carregar os contornos dos municípios. A tabela abaixo traz os números.</Alert>
                  ) : (
                    <MapaCanvas
                      formas={formas.data}
                      faixas={faixas}
                      cores={cores}
                      semDado={SEM_DADO[dark ? 'dark' : 'light']}
                      fundo={fundoCartao}
                      dark={dark}
                      foco={foco}
                      selecionado={mun}
                      onSelect={(cd) => set({ mun: cd })}
                      rotulo={rotulo}
                      ariaLabel={
                        escolhido
                          ? `Mapa dos municípios com a porcentagem dos votos válidos de ${nomeProprio(escolhido.nome_urna)}. Os números estão na tabela por estado e na busca por município.`
                          : 'Mapa do Brasil pintado por quem teve mais votos em cada lugar, com cores em ordem alfabética do nome na urna. Os números estão na tabela por estado e na busca por município.'
                      }
                    />
                  )}
                  <Box sx={{ px: { xs: 1, sm: 0 }, pt: 1.5 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {lider && mapa ? (
                          <LegendaLider nivel={nivel} fundo={fundoMapa} itens={lider.legenda.map((l) => ({ nome: nomeProprio(mapa.candidatos[l.indice]?.nome_urna), cor: l.cor, n: l.n }))} />
                        ) : (
                          <Legenda cores={rampa(dark ? 'dark' : 'light')} dark={dark} teto={teto} relativa={relativa && Boolean(escolhido)} />
                        )}
                      </Box>
                      {escolhido && (
                        <ToggleButtonGroup size="small" exclusive value={relativa ? 'relativa' : 'fixa'} onChange={(_, v) => v && set({ escala: v === 'fixa' ? 'fixa' : null })} aria-label="Escala de cores">
                          <ToggleButton value="relativa" sx={{ px: 1.25, whiteSpace: 'nowrap' }}>
                            Escala da candidatura
                          </ToggleButton>
                          <ToggleButton value="fixa" sx={{ px: 1.25, whiteSpace: 'nowrap' }}>
                            0 a 100%
                          </ToggleButton>
                        </ToggleButtonGroup>
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                      Toque ou clique num município para ver a votação dele. Arraste para mover; aproxime com a pinça, com os botões ou com Ctrl + roda do
                      mouse.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  {sel ? (
                    <>
                      <Typography variant="h6" component="h2">
                        {sel.nome}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {nomeLocal(sel.uf)} · Presidente, {turno}º turno
                        {selLinha && ` · ${number(selLinha[0])} votos válidos`}
                      </Typography>
                      {selLinha ? (
                        <Votacao mapa={mapa} linha={selLinha} destaque={escolhido?.sq ?? null} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Aguardando a totalização final do TSE neste município.
                        </Typography>
                      )}
                      <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                        <Link href={urlTse(mapa, sel.uf, mun!)} target="_blank" rel="noopener noreferrer" variant="caption">
                          Arquivo oficial do município no TSE <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                        </Link>
                        {sel.uf !== 'ZZ' && (
                          <Link component={RouterLink} to={`/minha-cidade?uf=${sel.uf}&mun=${mun}`} variant="caption">
                            Mais sobre {mun === MUN_BRASILIA ? 'Brasília' : 'o município'} (prefeitura, Câmara, emendas)
                          </Link>
                        )}
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Typography variant="h6" component="h2">
                        Brasil
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Presidente, {turno}º turno · {number(totalGeral[0])} votos válidos
                        {mapa.municipios_finais < mapa.municipios_total && ' nos municípios já totalizados'}, com o exterior
                      </Typography>
                      <Votacao mapa={mapa} linha={totalGeral} destaque={escolhido?.sq ?? null} />
                      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
                        Toque num município do mapa ou use a busca para ver a votação de cada lugar.
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabela por estado: a mesma informação do mapa, acessível sem a imagem. */}
          <Card>
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Por estado{escolhido ? `: ${nomeProprio(escolhido.nome_urna)}` : ''}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <caption>
                    {escolhido
                      ? `Votos de ${nomeProprio(escolhido.nome_urna)} e porcentagem dos votos válidos em cada estado e no exterior, somando os municípios com totalização final do TSE (coluna Municípios: quantos já têm resultado final).`
                      : 'Votos válidos em cada estado e no exterior, somando os municípios com totalização final do TSE. Escolha uma candidatura para ver os votos dela.'}
                  </caption>
                  <TableHead>
                    <TableRow>
                      <TableCell>Estado</TableCell>
                      <TableCell align="right">Municípios</TableCell>
                      <TableCell align="right">Votos válidos</TableCell>
                      {escolhido && (
                        <>
                          <TableCell align="right">
                            Votos de <span translate="no">{nomeProprio(escolhido.nome_urna)}</span>
                          </TableCell>
                          <TableCell align="right">% dos válidos</TableCell>
                        </>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...resumo]
                      .sort((a, b) => (a.uf === 'ZZ' ? 1 : b.uf === 'ZZ' ? -1 : nomeLocal(a.uf).localeCompare(nomeLocal(b.uf), 'pt-BR')))
                      .map((r) => (
                        <TableRow key={r.uf} hover>
                          <TableCell component="th" scope="row">
                            {r.uf === 'ZZ' ? (
                              'Exterior'
                            ) : (
                              <Link component="button" variant="body2" onClick={() => set({ uf: r.uf })} sx={{ textAlign: 'left' }}>
                                {nomeLocal(r.uf)}
                              </Link>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.finais === r.total ? number(r.total) : `${number(r.finais)} de ${number(r.total)}`}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {number(r.linha[0])}
                          </TableCell>
                          {escolhido && (
                            <>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {number(r.linha[indice + 1])}
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {fmtPct(pctNaLinha(r.linha, indice))}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    {[
                      ['Brasil (sem o exterior)', totalBrasil],
                      ['Total, com o exterior', totalGeral],
                    ].map(([rot, linha]) => (
                      <TableRow key={rot as string} sx={{ '& > *': { fontWeight: 700 } }}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>
                          {rot as string}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {mapa.municipios_finais === mapa.municipios_total ? '' : `${number(mapa.municipios_finais)} de ${number(mapa.municipios_total)}`}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {number((linha as number[])[0])}
                        </TableCell>
                        {escolhido && (
                          <>
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                              {number((linha as number[])[indice + 1])}
                            </TableCell>
                            <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                              {fmtPct(pctNaLinha(linha as number[], indice))}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {exterior && exterior.finais > 0 && (
                <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                  O exterior ({number(exterior.total)} cidades com seção eleitoral) não aparece no mapa; a votação de cada cidade está na busca por município.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Como ler e fonte */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Como ler este mapa
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Cada município recebe a cor da faixa em que está a porcentagem dos votos válidos da candidatura escolhida, em 10 faixas iguais. Na escala da
                  candidatura (padrão), as faixas vão de 0% até um número redondo logo acima do que ela alcançou em 99% dos municípios: assim, quem teve poucos
                  votos também mostra onde foi mais forte (acima do teto, a cor mais forte). A regra é a mesma para todas as candidaturas, mas a mesma cor pode
                  significar porcentagens diferentes de uma para outra: para comparar candidaturas na mesma régua, escolha a escala de 0 a 100%.
                </Typography>
                <Typography variant="body2">
                  Sem candidatura escolhida, o mapa mostra quem teve mais votos em cada município, estado ou região (escolha o nível acima). As cores são
                  atribuídas em ordem alfabética do nome na urna, sem relação com partidos, e ficam mais fortes quanto maior a vantagem sobre o 2º colocado (até 10,
                  25 e 45 pontos, ou mais). Nos níveis de estado e região, todos os municípios da unidade recebem a cor do resultado somado dela.
                </Typography>
                <Typography variant="body2">
                  O tamanho de um município no mapa não diz quantos eleitores ele tem: áreas grandes podem ter poucos votos, e capitais pequenas no mapa reúnem milhões.
                  A tabela por estado e o quadro do município mostram os números absolutos.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Só entram os municípios com totalização final do TSE ({number(mapa.municipios_finais)} de {number(mapa.municipios_total)}, incluindo as cidades do
                  exterior). Votos válidos são os dados a candidaturas, sem brancos e nulos, como o TSE calcula as porcentagens.
                  {semContorno.length > 0 &&
                    ` Sem contorno na malha do IBGE usada no mapa (aparece só na busca e na tabela): ${semContorno.join(', ')}.`}
                </Typography>
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider', alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                  <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
                  <span>
                    Fonte oficial: {mapa.fonte.nome}. Eleição {mapa.eleicao} ({mapa.turno}º turno). Arquivo mais recente do TSE: {mapa.atualizado_tse} (horário de
                    Brasília); coletado por este site em {dateTime(mapa.gerado_em)}. Contornos: IBGE, malha municipal.
                  </span>
                </Typography>
                <Stack direction="row" spacing={2} sx={{ flexShrink: 0 }}>
                  <Link href={mapa.fonte.config} target="_blank" rel="noopener noreferrer" variant="caption">
                    Lista oficial de municípios <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                  </Link>
                  <Link href={mapa.fonte.pagina} target="_blank" rel="noopener noreferrer" variant="caption">
                    resultados.tse.jus.br <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
                  </Link>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </>
  );
}
