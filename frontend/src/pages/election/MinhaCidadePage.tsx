import { useMemo } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import MyLocationRounded from '@mui/icons-material/MyLocationRounded';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import PaidRounded from '@mui/icons-material/PaidRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { CARGO_APURACAO_LABEL, parseApuracao, urlApuracao, type Apuracao, type CargoApuracao, type RawUnificado, type Turno } from '@/data/apuracao';
import { data, DataError } from '@/data/api';
import { money, moneyCompact, nomeProprio, number } from '@/data/format';
import { MUN_BRASILIA, MUN_PADRAO, useMunicipioUsuario } from '@/data/useMunicipioUsuario';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';

const UFS_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Arquivo oficial do TSE com a votação de um cargo só no município (mesmo formato do estadual). */
function urlMunicipal(turno: Turno, cargo: CargoApuracao, uf: string, mun: string) {
  const u = uf.toLowerCase();
  return urlApuracao(turno, cargo, uf).replace(`/${u}-c`, `/${u}${mun}-c`);
}

async function votacaoMunicipal(turno: Turno, cargo: CargoApuracao, uf: string, mun: string): Promise<Apuracao | null> {
  const url = urlMunicipal(turno, cargo, uf, mun);
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) return null;
  return parseApuracao((await r.json()) as RawUnificado, cargo, url);
}

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
          {icone}
          <Typography variant="h5" component="h2">
            {titulo}
          </Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/** Os mais votados no município num cargo (1º turno e, se houver, 2º). */
function VotacaoCargo({ cargo, uf, mun }: { cargo: CargoApuracao; uf: string; mun: string }) {
  const segundo = cargo === 'presidente' || cargo === 'governador';
  const q = useAsync(
    () => Promise.all([votacaoMunicipal(1, cargo, uf, mun), segundo ? votacaoMunicipal(2, cargo, uf, mun).catch(() => null) : Promise.resolve(null)]),
    [cargo, uf, mun],
  );
  const proporcional = cargo === 'deputado-federal' || cargo === 'deputado-estadual' || cargo === 'deputado-distrital';
  const quantos = proporcional ? 10 : 5;
  const [t1, t2] = q.data ?? [null, null];
  const ap = t2 && t2.candidatos.length ? t2 : t1;
  return (
    <Box sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {CARGO_APURACAO_LABEL[cargo]}
        </Typography>
        {ap && <Chip size="small" label={`${ap.turno}º turno${ap.final ? '' : ` · ${pct.format(ap.secoes.pct)}% das seções`}`} />}
      </Stack>
      {q.loading ? (
        <Skeleton variant="rounded" height={90} />
      ) : !ap || !ap.candidatos.length ? (
        <Typography variant="body2" color="text.secondary">
          Votação no município ainda não publicada pelo TSE.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {ap.candidatos.slice(0, quantos).map((c) => (
            <Stack key={c.sq} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ width: 22, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {c.posicao}º
              </Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link component={RouterLink} to={`/candidato/${c.sq}`} variant="body2" sx={{ fontWeight: 700 }}>
                  {nomeProprio(c.nomeUrna)}
                </Link>{' '}
                <Typography component="span" variant="caption" color="text.secondary">
                  {c.partido}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                {number(c.votos)} · {pct.format(c.pct)}%
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function MinhaCidadePage() {
  const [params, setParams] = useSearchParams();
  const local = useMunicipioUsuario(true);
  const semEscolha = !params.get('uf') && !params.get('mun');
  const padrao = semEscolha ? (local.salvo ?? (local.status === 'df' ? MUN_BRASILIA : MUN_PADRAO)) : null;
  const uf = (padrao?.uf ?? params.get('uf') ?? '').toUpperCase() || null;
  const mun = padrao?.mun ?? params.get('mun');

  const base = useAsync(() => (uf && UFS_NOMES[uf] ? data.vereadores(uf) : Promise.resolve(null)), [uf]);
  const emendas = useAsync(
    () =>
      uf && mun
        ? data.emendasMunicipio(uf, mun).catch((e: unknown) => {
            if (e instanceof DataError && e.status === 404) return null;
            throw e;
          })
        : Promise.resolve(null),
    [uf, mun],
  );
  const resumoEmendas = useAsync(() => data.emendasResumo().catch(() => null), []);
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
    () =>
      Object.entries(base.data?.municipios ?? {})
        .map(([codigo, m]) => ({ codigo, nome: nomeProprio(m.nome) }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [base.data],
  );
  const cidade = mun ? base.data?.municipios[mun] : undefined;
  const nomeCidade = cidade ? nomeProprio(cidade.nome) : null;
  const exe = cidade?.executivo;
  const cargos: CargoApuracao[] = ['presidente', 'governador', 'senador', 'deputado-federal', uf === 'DF' ? 'deputado-distrital' : 'deputado-estadual'];
  const em = emendas.data;
  const avisoLocal =
    local.status === 'buscando'
      ? 'Procurando o seu município…'
      : padrao && local.salvo
        ? 'Município pela sua localização, calculado no seu aparelho (a posição não sai dele).'
        : padrao
          ? `Mostrando ${padrao === MUN_BRASILIA ? 'Brasília' : 'São Paulo'}. Use a sua localização ou escolha o município.`
          : null;

  return (
    <Stack spacing={3}>
      <PageHeader
        title={nomeCidade ? `Minha cidade: ${nomeCidade}` : 'Minha cidade'}
        subtitle="Quem governa e legisla no município, como a cidade votou em 2026 e quanto recebeu de emendas parlamentares. Tudo de fontes oficiais."
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="cidade-uf">Estado</InputLabel>
          <Select labelId="cidade-uf" label="Estado" value={uf ?? ''} onChange={(e) => set({ uf: e.target.value, mun: e.target.value === 'DF' ? MUN_BRASILIA.mun : null })}>
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
            loading={base.loading}
            value={municipios.find((m) => m.codigo === mun) ?? null}
            onChange={(_, v) => set({ mun: v?.codigo ?? null, uf })}
            getOptionLabel={(o) => o.nome}
            isOptionEqualToValue={(a, b) => a.codigo === b.codigo}
            renderInput={(p) => <TextField {...p} label="Município" placeholder="Digite o nome do município" />}
            noOptionsText="Nenhum município"
          />
        )}
        <Button size="small" startIcon={<MyLocationRounded />} disabled={local.status === 'buscando'} onClick={() => local.detectar(() => set({ uf: null, mun: null }))} sx={{ alignSelf: { sm: 'center' }, flexShrink: 0 }}>
          Usar minha localização
        </Button>
      </Stack>
      {avisoLocal && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
          {avisoLocal}
        </Typography>
      )}

      {!uf || !mun ? (
        <Alert severity="info">Escolha o estado e o município.</Alert>
      ) : base.loading ? (
        <Skeleton variant="rounded" height={320} />
      ) : (
        <>
          <Secao icone={<AccountBalanceRounded color="primary" />} titulo="Prefeitura e Câmara Municipal">
            {uf === 'DF' ? (
              <Typography variant="body2">
                Brasília não tem prefeitura nem Câmara Municipal: o Distrito Federal é governado pelo governador e legislado pela Câmara Legislativa (
                <Link component={RouterLink} to="/plenario?casa=assembleia&uf=DF">
                  ver os deputados distritais
                </Link>
                ).
              </Typography>
            ) : (
              <>
                {exe?.prefeito ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 2 }}>
                    {[
                      ['Prefeito(a) eleito(a) em 2024', exe.prefeito],
                      ['Vice-prefeito(a) eleito(a) em 2024', exe.vice],
                    ].map(([rotulo, p]) =>
                      p && typeof p === 'object' ? (
                        <Box key={rotulo as string} sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
                          <Typography variant="caption" color="text.secondary">
                            {rotulo as string}
                          </Typography>
                          <Typography sx={{ fontWeight: 800 }}>{nomeProprio(p.nome)}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {p.partido} · nº {p.numero}
                            {p.turno === '2' ? ' · eleito(a) no 2º turno' : ''}
                          </Typography>
                        </Box>
                      ) : null,
                    )}
                  </Box>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    O arquivo do TSE não traz prefeito(a) eleito(a) em 2024 neste município (pode ter havido eleição anulada ou suplementar).
                  </Alert>
                )}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {cidade ? `${number(cidade.membros.length)} vereadores eleitos em 2024 (mandato 2025–2028).` : ''}{' '}
                  <Link component={RouterLink} to={`/plenario?casa=municipal&uf=${uf}&mun=${mun}`}>
                    Ver a Câmara Municipal
                  </Link>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Eleitos em 2024 segundo o TSE (consulta_cand_2024). Mudanças depois da eleição (renúncias, cassações, suplentes) não aparecem aqui.
                </Typography>
              </>
            )}
          </Secao>

          <Secao icone={<HowToVoteRounded color="primary" />} titulo={`Como ${nomeCidade ?? 'a cidade'} votou em 2026`}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Os mais votados no município, com a porcentagem dos votos válidos da cidade, lidos ao vivo do arquivo oficial do TSE. Quem vence é definido
              pelo total do estado (ou do país), não só pelo município.
            </Typography>
            {cargos.map((c) => (
              <VotacaoCargo key={c} cargo={c} uf={uf} mun={mun} />
            ))}
            <Link href={urlMunicipal(1, 'presidente', uf, mun)} target="_blank" rel="noopener noreferrer" variant="caption">
              Fonte: TSE, resultados.tse.jus.br (arquivo do município) <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>
          </Secao>

          <Secao icone={<PaidRounded color="primary" />} titulo="Emendas parlamentares recebidas">
            {emendas.loading ? (
              <Skeleton variant="rounded" height={100} />
            ) : !em ? (
              <Typography variant="body2" color="text.secondary">
                {resumoEmendas.data
                  ? 'Sem pagamentos de emendas a favorecidos com sede no município nos dados da CGU (desde 2019).'
                  : 'As emendas aparecem aqui depois da próxima coleta semanal no Portal da Transparência.'}
              </Typography>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
                  {[
                    [`Pago a favorecidos no município (desde ${em.periodo.desde})`, money(em.recebido.total)],
                    ['Só para a prefeitura e órgãos municipais', money(em.recebido.prefeitura)],
                    ['Emendas diferentes', number(em.recebido.emendas)],
                  ].map(([r, v]) => (
                    <Box key={r} sx={{ p: 1.5, borderRadius: 3, bgcolor: 'action.hover' }}>
                      <Typography variant="caption" color="text.secondary">
                        {r}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {v}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {em.recebido.por_autor.length > 0 && (
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Quem mais indicou (por valor pago)
                    </Typography>
                    <Stack spacing={0.25} sx={{ mb: 1.5 }}>
                      {em.recebido.por_autor.slice(0, 5).map((a) => (
                        <Typography key={a.autor} variant="body2">
                          {a.id ? (
                            <Link component={RouterLink} to={`/parlamentar/${a.id}`}>
                              {a.nome ?? a.autor}
                            </Link>
                          ) : (
                            nomeProprio(a.autor)
                          )}
                          {a.partido ? ` (${a.partido}${a.uf ? `-${a.uf}` : ''})` : ''} · {moneyCompact(a.valor)}
                        </Typography>
                      ))}
                    </Stack>
                  </>
                )}
                <Button component={RouterLink} to={`/emendas?uf=${uf}&mun=${mun}`} variant="tonal" size="small">
                  Ver todas as emendas do município
                </Button>
              </>
            )}
          </Secao>
        </>
      )}
    </Stack>
  );
}
