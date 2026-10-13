import { useMemo } from 'react';
import { Alert, Box, Breadcrumbs, Card, CardContent, Chip, Grid, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';
import { useAsync } from '@/hooks/useAsync';
import { eua, ou404, type MembroPerfil } from '../api';
import { BlocoFinancas, BlocoGastos, BlocoVotos, LinkExterno } from '../componentes/blocos';
import { AvisoInformativo, Carregando, Erro, FonteNota, FotoMembro } from '../componentes/comuns';
import { cargoMembro, dataBr, distrito, dolar, dolarCompacto, idade, nomeEstado, nomePartido } from '../formato';

function Secao({ titulo, children, fonte, nota }: { titulo: string; children: React.ReactNode; fonte: string[]; nota?: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
          {titulo}
        </Typography>
        {children}
        <FonteNota chaves={fonte} nota={nota} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

const REDES: Record<string, (v: string) => string> = {
  twitter: (v) => `https://x.com/${v}`,
  facebook: (v) => `https://www.facebook.com/${v}`,
  youtube: (v) => `https://www.youtube.com/${v.startsWith('UC') ? `channel/${v}` : v}`,
  instagram: (v) => `https://www.instagram.com/${v}`,
};

function Cabecalho({ m }: { m: MembroPerfil }) {
  const anos = idade(m.nascimento);
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <FotoMembro foto={m.foto} nome={m.nome} largura={150} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {cargoMembro(m)} · {m.casa === 'senado' ? 'Senado dos EUA' : 'Câmara dos Representantes'}
            </Typography>
            <Typography variant="h4" component="h1" translate="no">
              {m.nome}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', my: 1 }}>
              <Chip label={nomePartido(m.partido)} variant="outlined" />
              {m.bancada && m.bancada !== m.partido && <Chip label={`Vota com a bancada ${nomePartido(m.bancada).toLowerCase()}`} variant="outlined" />}
              <Chip label={nomeEstado(m.uf)} variant="outlined" component={RouterLink} to={`/eua/estado/${m.uf}`} clickable />
              {m.casa === 'camara' && !m.delegado && <Chip label={distrito(m.distrito)} variant="outlined" />}
              {m.classe && <Chip label={`Classe ${m.classe}`} variant="outlined" />}
            </Stack>
            <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, m: 0 }}>
              {[
                ['No cargo desde', dataBr(m.desde)],
                ['Mandato atual até', dataBr(m.mandato_fim)],
                ['Próxima eleição para a cadeira', m.proxima_eleicao ? String(m.proxima_eleicao) : 'Não informado'],
                ['Nascimento', m.nascimento ? `${dataBr(m.nascimento)}${anos != null ? ` (${anos} anos)` : ''}` : 'Não informado'],
                ['Gabinete em Washington', m.gabinete ?? 'Não informado'],
                ['Telefone do gabinete', m.telefone ?? 'Não informado'],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {k}
                  </Typography>
                  <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                    {v}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.5 }}>
              {m.site && <LinkExterno href={m.site}>Site oficial</LinkExterno>}
              <LinkExterno href={m.links.bioguide}>Biografia oficial (Bioguide)</LinkExterno>
              <LinkExterno href={m.links.congress_gov}>Congress.gov</LinkExterno>
              {Object.entries(m.redes)
                .filter(([k]) => REDES[k])
                .map(([k, v]) => (
                  <LinkExterno key={k} href={REDES[k](v)}>
                    {k === 'twitter' ? 'X (Twitter)' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </LinkExterno>
                ))}
            </Stack>
          </Box>
        </Stack>
        <FonteNota chaves={['eua-clerk-membros', 'eua-legisladores', 'eua-bioguide']} sx={{ mt: 2 }} />
      </CardContent>
    </Card>
  );
}

export function MembroEuaPage() {
  const { id = '' } = useParams();
  const perfil = useAsync(() => eua.membro(id), [id]);
  const m = perfil.data;
  const votos = useAsync(() => ou404(eua.votosMembro(id)), [id]);
  const catalogo = useAsync(() => (m ? eua.votacoes(m.casa) : Promise.resolve(null)), [m?.casa]);
  const gastos = useAsync(() => ou404(eua.gastosMembro(id)), [id]);
  const fec = useAsync(() => ou404(eua.fecMembro(id)), [id]);
  const federal = useAsync(() => eua.gastoFederal(), []);
  const mapa = useMemo(() => new Map((catalogo.data?.votacoes ?? []).map((v) => [v.id, v])), [catalogo.data]);

  if (perfil.error) return <Erro onRetry={perfil.reload} />;
  if (!m) return <Carregando />;
  const chaveDistrito = `${m.uf}-${m.distrito ?? 0}`;
  const noDistrito = m.casa === 'camara' ? federal.data?.distritos[chaveDistrito] : null;
  const noEstado = federal.data?.estados[m.uf]?.anos[federal.data.ano_distritos];

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/eua">
          Estados Unidos
        </Link>
        <Link component={RouterLink} to={`/eua/congresso${m.casa === 'senado' ? '?casa=senado' : ''}`}>
          {m.casa === 'senado' ? 'Senado' : 'Câmara'}
        </Link>
        <Typography color="text.primary">{m.nome}</Typography>
      </Breadcrumbs>
      <AvisoInformativo />
      <Cabecalho m={m} />
      <Stack spacing={3}>
        <Secao titulo="Votações nominais no Plenário" fonte={[m.casa === 'senado' ? 'eua-votos-senado' : 'eua-votos-camara']}>
          {votos.data && votos.data.total > 0 && mapa.size > 0 ? (
            <BlocoVotos votos={votos.data} catalogo={mapa} />
          ) : votos.loading || catalogo.loading ? (
            <Carregando linhas={1} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nenhuma votação nominal registrada para {m.nome} no Congresso atual.
            </Typography>
          )}
        </Secao>

        {m.casa === 'camara' && (
          <Secao titulo="Gastos do gabinete" fonte={['eua-sod']} nota="verba de representação (MRA), publicada a cada trimestre">
            {gastos.data && Object.keys(gastos.data.anos).length ? (
              <BlocoGastos g={gastos.data} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Ainda não há gastos do gabinete publicados para este mandato (a Câmara publica cerca de 2 meses depois de cada trimestre).
              </Typography>
            )}
          </Secao>
        )}
        {m.casa === 'senado' && (
          <Alert severity="info" variant="outlined">
            Gastos de gabinete do Senado: o Senado dos EUA publica esses gastos só em PDF semestral (Report of the Secretary of the Senate), sem
            arquivo aberto para cruzar. <LinkExterno href="https://www.senate.gov/legislative/common/generic/report_secsen.htm">Ver os relatórios oficiais</LinkExterno>
          </Alert>
        )}

        <Secao titulo="Finanças de campanha (FEC)" fonte={['eua-fec-financas', 'eua-fec-candidatos']}>
          {fec.data?.candidaturas.length ? (
            <Stack spacing={3}>
              {fec.data.candidaturas.map((c) => (
                <Box key={c.fec}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Campanha para {c.cargo === 'Câmara' ? 'a Câmara' : c.cargo === 'Senado' ? 'o Senado' : c.cargo}
                    {c.uf ? ` (${nomeEstado(c.uf)})` : ''}, ciclo {fec.data!.ciclo} · registro {c.fec} · <LinkExterno href={c.url}>ver na FEC</LinkExterno>
                  </Typography>
                  {c.financas && <BlocoFinancas f={c.financas} />}
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nenhuma movimentação de campanha declarada à FEC neste ciclo para os registros ligados a {m.nome}.
            </Typography>
          )}
        </Secao>

        {federal.data && (noDistrito || noEstado) && (
          <Secao titulo={m.casa === 'camara' ? 'Dinheiro federal no distrito' : 'Dinheiro federal no estado'} fonte={['eua-usaspending']} nota={`ano fiscal ${federal.data.ano_distritos} (out–set)`}>
            <Typography variant="h5" component="p">
              {dolarCompacto((noDistrito ?? noEstado)!.valor)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contratos, convênios, empréstimos e outros repasses do governo federal executados{' '}
              {m.casa === 'camara' ? `no ${distrito(m.distrito)} de ${nomeEstado(m.uf)}` : `em ${nomeEstado(m.uf)}`} no ano fiscal {federal.data.ano_distritos}
              {(noDistrito ?? noEstado)!.per_capita ? `, ou ${dolar((noDistrito ?? noEstado)!.per_capita)} por habitante` : ''}. É o gasto do governo federal
              no lugar, não uma verba controlada pelo(a) parlamentar.
            </Typography>
          </Secao>
        )}

        {m.comissoes.length > 0 && (
          <Secao titulo="Comissões" fonte={[m.casa === 'senado' ? 'eua-legisladores' : 'eua-clerk-membros']} nota="nomes oficiais em inglês">
            <Grid container spacing={1}>
              {m.comissoes
                .filter((c) => !c.sub)
                .map((c) => (
                  <Grid key={c.codigo} size={{ xs: 12, md: 6 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.nome}
                      {c.cargo ? ` · ${c.cargo}` : ''}
                    </Typography>
                    {m.comissoes
                      .filter((s) => s.sub && s.codigo.startsWith(c.codigo.slice(0, 4)) && s.codigo !== c.codigo)
                      .map((s) => (
                        <Typography key={s.codigo} variant="caption" color="text.secondary" component="p" sx={{ pl: 1.5 }}>
                          Subcomissão: {s.nome}
                          {s.cargo ? ` · ${s.cargo}` : ''}
                        </Typography>
                      ))}
                  </Grid>
                ))}
            </Grid>
          </Secao>
        )}

        {m.mandatos.length > 0 && (
          <Secao titulo="Mandatos no Congresso" fonte={['eua-legisladores']}>
            <Stack spacing={0.5}>
              {[...m.mandatos].reverse().map((t) => (
                <Typography key={`${t.casa}-${t.inicio}`} variant="body2">
                  {dataBr(t.inicio)} a {dataBr(t.fim)} · {t.casa === 'senado' ? 'Senado' : 'Câmara'} · {nomeEstado(t.uf)}
                  {t.casa === 'camara' && t.distrito != null ? `, ${distrito(t.distrito)}` : ''} · {nomePartido(t.partido)}
                </Typography>
              ))}
            </Stack>
          </Secao>
        )}
      </Stack>
    </>
  );
}
