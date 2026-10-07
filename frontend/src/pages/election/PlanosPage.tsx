import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Link,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import PictureAsPdfRounded from '@mui/icons-material/PictureAsPdfRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { useSearchParams } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SourceNote } from '@/components/election/SourceNote';
import { buscarPaginas, dobrar, linkPagina, MIN_LETRAS, prepararTermo, trecho, type PaginaAchada } from '@/components/planos/busca';
import { assetUrl, data } from '@/data/api';
import { dateTime, nomeProprio } from '@/data/format';
import type { CandidatoPlano } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '../PageHeader';

/** Sugestões de tema, em ordem alfabética (só atalhos para a busca). */
const TEMAS = ['Agricultura', 'Cultura', 'Educação', 'Emprego', 'Impostos', 'Meio ambiente', 'Moradia', 'Saúde', 'Segurança', 'Transporte'];
/** Páginas mostradas por candidatura antes de "Mostrar mais". */
const POR_VEZ = 8;

const idDisputa = (arquivo: string) => arquivo.replace(/\.json$/, '');

function Trecho({ texto, termo }: { texto: string; termo: string }) {
  const partes = trecho(texto, termo);
  if (!partes) return null;
  return (
    // Texto oficial do plano, como registrado: não passa pela tradução da interface.
    <Typography variant="body2" translate="no" sx={{ overflowWrap: 'anywhere' }}>
      {partes.map((p, i) =>
        p.destaque ? (
          <Box
            key={i}
            component="mark"
            sx={(t) => ({ bgcolor: t.alpha(t.vars.palette.primary.main, 0.16), color: 'inherit', fontWeight: 700, borderRadius: 0.5, px: 0.25 })}
          >
            {p.texto}
          </Box>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </Typography>
  );
}

function Achado({ c, a, termo }: { c: CandidatoPlano; a: PaginaAchada; termo: string }) {
  const doc = c.documentos[a.documento];
  const url = assetUrl(doc.pdf) ?? doc.pdf;
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
        <Link href={linkPagina(url, a.pagina)} target="_blank" rel="noopener noreferrer" variant="subtitle2">
          {c.documentos.length > 1 ? `Parte ${a.documento + 1}, página ${a.pagina}` : `Página ${a.pagina}`}{' '}
          <OpenInNewRounded sx={{ fontSize: 13, verticalAlign: 'middle' }} />
        </Link>
        {a.ocorrencias > 1 && (
          <Typography variant="caption" color="text.secondary">
            {`${a.ocorrencias} menções nesta página`}
          </Typography>
        )}
      </Stack>
      <Trecho texto={doc.paginas[a.pagina - 1]} termo={termo} />
    </Box>
  );
}

function Coluna({ c, achados, termo }: { c: CandidatoPlano; achados: PaginaAchada[]; termo: string }) {
  const [mostrar, setMostrar] = useState(POR_VEZ);
  const nome = nomeProprio(c.nome_urna);
  const buscando = termo.length >= MIN_LETRAS;
  const mencoes = achados.reduce((s, a) => s + a.ocorrencias, 0);
  const comTexto = c.documentos.filter((d) => !d.sem_texto);
  const paginasSemTexto = comTexto.reduce((s, d) => s + d.paginas.filter((p) => !p).length, 0);

  return (
    <Stack spacing={1.5} component="section" aria-label={`Plano de governo de ${nome}`} sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <CandidatePhoto src={c.foto} alt={`Foto de ${nome}`} width={64} rounded={10} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="h3" translate="no">
            {nome}
          </Typography>
          <Typography variant="body2" color="text.secondary" translate="no">
            {c.partido} · {c.numero}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        {c.documentos.map((d, i) => (
          <Button
            key={d.pdf}
            size="small"
            variant="tonal"
            href={assetUrl(d.pdf) ?? d.pdf}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<PictureAsPdfRounded />}
          >
            {c.documentos.length > 1 ? `Parte ${i + 1} (PDF)` : 'Plano de governo (PDF)'}
          </Button>
        ))}
        {c.divulgacand && (
          <Button size="small" href={c.divulgacand} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewRounded />}>
            Ver no TSE
          </Button>
        )}
      </Stack>

      {c.documentos.length === 0 && <Alert severity="info">Não há plano de governo desta candidatura publicado pelo TSE.</Alert>}
      {c.documentos.some((d) => d.sem_texto) && (
        <Alert severity="info">
          {c.documentos.length > 1
            ? 'Parte do plano é imagem digitalizada, sem texto que possa ser lido automaticamente: a busca não alcança esse conteúdo. Consulte o documento oficial.'
            : 'O PDF deste plano é imagem digitalizada, sem texto que possa ser lido automaticamente: a busca não alcança esse conteúdo. Consulte o documento oficial.'}
        </Alert>
      )}
      {paginasSemTexto > 0 && (
        <Typography variant="caption" color="text.secondary">
          {paginasSemTexto === 1 ? '1 página só com imagem não entra na busca.' : `${paginasSemTexto} páginas só com imagem não entram na busca.`}
        </Typography>
      )}

      {buscando && comTexto.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ pt: 0.5, borderTop: 1, borderColor: 'divider' }}>
            {achados.length === 0
              ? 'Nenhuma menção encontrada neste plano.'
              : `${mencoes === 1 ? '1 menção' : `${mencoes} menções`} em ${achados.length === 1 ? '1 página' : `${achados.length} páginas`}`}
          </Typography>
          {achados.slice(0, mostrar).map((a) => (
            <Achado key={`${a.documento}-${a.pagina}`} c={c} a={a} termo={termo} />
          ))}
          {achados.length > mostrar && (
            <Button variant="outlined" size="small" onClick={() => setMostrar((n) => n + 20)} sx={{ alignSelf: 'flex-start' }}>
              Mostrar mais páginas ({achados.length - mostrar})
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}

export function PlanosPage() {
  const [params, setParams] = useSearchParams();
  const indice = useAsync(() => data.planosIndice(), []);
  const disputas = indice.data?.disputas ?? [];
  const escolhida = disputas.find((d) => idDisputa(d.arquivo) === params.get('d')) ?? disputas[0];
  const arquivo = escolhida?.arquivo;
  const plano = useAsync(() => (arquivo ? data.planosDisputa(arquivo) : Promise.resolve(undefined)), [arquivo]);

  // O termo fica na URL (dá para compartilhar a busca); o campo escreve nela com um pequeno atraso.
  const termoUrl = params.get('q') ?? '';
  const [texto, setTexto] = useState(termoUrl);
  const [ultimoUrl, setUltimoUrl] = useState(termoUrl);
  if (termoUrl !== ultimoUrl) {
    // Voltar/avançar no navegador: o campo acompanha a URL.
    setUltimoUrl(termoUrl);
    setTexto(termoUrl);
  }
  const definir = (mudancas: Record<string, string>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        Object.entries(mudancas).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
        return n;
      },
      { replace: true },
    );
  useEffect(() => {
    if (texto === termoUrl) return;
    const t = setTimeout(
      () =>
        setParams(
          (p) => {
            const n = new URLSearchParams(p);
            if (texto.trim()) n.set('q', texto);
            else n.delete('q');
            return n;
          },
          { replace: true },
        ),
      350,
    );
    return () => clearTimeout(t);
  }, [texto, termoUrl, setParams]);
  const termo = prepararTermo(termoUrl);
  const curto = prepararTermo(texto).length > 0 && prepararTermo(texto).length < MIN_LETRAS;

  // Sempre em ordem alfabética do nome de urna; o texto de cada página é dobrado uma vez por disputa.
  const candidatos = useMemo(
    () => [...(plano.data?.candidatos ?? [])].sort((a, b) => a.nome_urna.localeCompare(b.nome_urna, 'pt-BR', { sensitivity: 'base' })),
    [plano.data],
  );
  const dobradas = useMemo(() => candidatos.map((c) => c.documentos.map((d) => d.paginas.map(dobrar))), [candidatos]);
  const achados = useMemo(() => dobradas.map((d) => buscarPaginas(d, termo)), [dobradas, termo]);

  return (
    <>
      <PageHeader
        title="Planos de governo"
        subtitle="Busque um tema nos planos de governo que os finalistas do 2º turno registraram no TSE e veja, lado a lado, onde cada plano trata dele."
      />

      <Stack spacing={3}>
        {indice.loading && <Skeleton variant="rounded" height={160} />}
        {indice.error != null && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={indice.reload}>
                Tentar de novo
              </Button>
            }
          >
            Não foi possível carregar os planos de governo agora.
          </Alert>
        )}
        {indice.data && disputas.length === 0 && (
          <Alert severity="info">
            Ainda não há disputas de 2º turno confirmadas. Os planos aparecem aqui assim que o TSE confirmar os finalistas.
          </Alert>
        )}

        {escolhida && (
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" component="h2" sx={{ mb: 1 }}>
                    Disputa
                  </Typography>
                  <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} component="nav" aria-label="Escolher a disputa">
                    {disputas.map((d) => {
                      const ativa = d.arquivo === escolhida.arquivo;
                      return (
                        <Chip
                          key={d.arquivo}
                          clickable
                          label={d.cargo === 'presidente' ? 'Presidente' : d.nome_uf}
                          color={ativa ? 'primary' : 'default'}
                          variant={ativa ? 'filled' : 'outlined'}
                          aria-pressed={ativa}
                          onClick={() => definir({ d: idDisputa(d.arquivo) })}
                        />
                      );
                    })}
                  </Stack>
                </Box>
                <TextField
                  label={escolhida.cargo === 'presidente' ? 'Buscar nos planos para Presidente' : `Buscar nos planos para Governador(a) · ${escolhida.nome_uf}`}
                  placeholder="Ex.: creche, saneamento, emprego"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  helperText={curto ? `Digite pelo menos ${MIN_LETRAS} letras.` : 'Acentos e maiúsculas não fazem diferença. A busca acha palavras que começam pelo termo (“escola” acha “escolas”).'}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRounded />
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { enterKeyHint: 'search' },
                  }}
                />
                <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} aria-label="Temas sugeridos">
                  {TEMAS.map((tema) => (
                    <Chip
                      key={tema}
                      size="small"
                      clickable
                      label={tema}
                      variant={termo === prepararTermo(tema) ? 'filled' : 'outlined'}
                      color={termo === prepararTermo(tema) ? 'primary' : 'default'}
                      onClick={() => {
                        setTexto(tema);
                        definir({ q: tema });
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        )}

        {escolhida && (
          <Alert severity="info">
            O número de menções não mede a qualidade, a viabilidade nem o compromisso com uma proposta: um plano pode tratar de um tema
            com outras palavras, em mais ou menos páginas. Os textos são reproduzidos como registrados no TSE, sem edição. A leitura
            automática do PDF pode ter falhas; cada resultado leva à página do documento oficial.
          </Alert>
        )}

        {plano.loading && arquivo && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={320} />
            <Typography variant="caption" color="text.secondary">
              Carregando o texto dos planos…
            </Typography>
          </Stack>
        )}
        {plano.error != null && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={plano.reload}>
                Tentar de novo
              </Button>
            }
          >
            Não foi possível carregar o texto dos planos desta disputa agora.
          </Alert>
        )}

        {!plano.loading && plano.data && (
          <Stack spacing={2}>
            {!termo && (
              <Typography color="text.secondary">
                Digite um termo ou escolha um tema para ver os trechos de cada plano. Candidaturas em ordem alfabética.
              </Typography>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.max(1, candidatos.length)}, minmax(0, 1fr))` },
                gap: { xs: 4, md: 3 },
                alignItems: 'start',
              }}
            >
              {candidatos.map((c, i) => (
                <Coluna key={`${c.sq}-${termo}`} c={c} achados={achados[i] ?? []} termo={termo} />
              ))}
            </Box>
            <Stack spacing={0.5}>
              <SourceNote keys={['tse_propostas']} note="texto lido dos PDFs registrados, sem OCR" />
              <Typography variant="caption" color="text.secondary">
                {`Texto extraído em ${dateTime(plano.data.gerado_em)}.`}{' '}
                <Link href={plano.data.fonte.pagina} target="_blank" rel="noopener noreferrer">
                  DivulgaCandContas (TSE) <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
                </Link>
              </Typography>
            </Stack>
          </Stack>
        )}
      </Stack>
    </>
  );
}
