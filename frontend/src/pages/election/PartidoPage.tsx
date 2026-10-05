import type { ReactNode } from 'react';
import { Alert, Box, Button, Card, CardActionArea, Chip, Link, Skeleton, Stack, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink, useParams } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { SimboloPartido } from '@/components/partidos/SimboloPartido';
import { fotoParlamentar, SEM_PARTIDO, usePartidos } from '@/components/partidos/partidos';
import { nomeProprio } from '@/data/format';
import type { ExecutivoEleito, MembroPlenario } from '@/data/types';

const CARGO_EXEC: Record<ExecutivoEleito['cargo'], string> = {
  presidente: 'Presidente da República',
  'vice-presidente': 'Vice-presidente da República',
  governador: 'Governador(a)',
  'vice-governador': 'Vice-governador(a)',
};

/** Cartão de pessoa: foto oficial, nome e cargo; leva à página da pessoa no site, quando existe. */
function Pessoa({ nome, linha, foto, to, destaque }: { nome: string; linha: string; foto: string | null; to: string | null; destaque?: string }) {
  const corpo = (
    <Stack spacing={0.75} sx={{ p: 1, alignItems: 'center', textAlign: 'center', height: '100%' }}>
      <CandidatePhoto src={foto} alt={`Foto de ${nome}`} width="100%" rounded={10} />
      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {nome}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          {linha}
        </Typography>
        {destaque && <Chip size="small" color="primary" label={destaque} sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }} />}
      </Box>
    </Stack>
  );
  return (
    <Card sx={{ height: '100%', borderRadius: 3 }}>
      {to ? (
        <CardActionArea component={RouterLink} to={to} sx={{ height: '100%' }}>
          {corpo}
        </CardActionArea>
      ) : (
        corpo
      )}
    </Card>
  );
}

function Grade({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)', lg: 'repeat(8, 1fr)' }, gap: 1.5 }}>{children}</Box>;
}

function Secao({ titulo, n, nota, children }: { titulo: string; n: number; nota?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 4 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
        {titulo}{' '}
        <Typography component="span" color="text.secondary" sx={{ fontWeight: 500 }}>
          ({n})
        </Typography>
      </Typography>
      {nota && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0, mb: 1.5 }}>
          {nota}
        </Typography>
      )}
      {children}
    </Box>
  );
}

const parlamentar = (m: MembroPlenario, presidencia: string | null) => (
  <Pessoa
    key={m.id}
    nome={m.nome}
    linha={m.uf ?? ''}
    foto={fotoParlamentar(m.foto)}
    to={m.perfil ? `/parlamentar/${m.id}` : null}
    destaque={presidencia ?? undefined}
  />
);

const executivo = (e: ExecutivoEleito) => (
  <Pessoa
    key={e.sq_2022}
    nome={nomeProprio(e.nome_urna)}
    linha={e.cargo.endsWith('presidente') ? CARGO_EXEC[e.cargo] : `${CARGO_EXEC[e.cargo]} · ${e.uf}`}
    foto={e.foto}
    to={e.sq_2026 ? `/candidato/${e.sq_2026}` : null}
  />
);

/**
 * Página de um partido: logo no canto superior esquerdo e as fotos de todos os seus políticos com
 * mandato (Presidência, governos estaduais, Senado e Câmara), em ordem alfabética.
 */
export function PartidoPage() {
  const { slug } = useParams();
  const { partidos, executivos, loading } = usePartidos();
  const p = partidos.find((x) => x.slug === slug);

  if (loading) return <Skeleton variant="rounded" height={420} />;
  if (!p) {
    return (
      <Alert
        severity="info"
        action={
          <Button component={RouterLink} to="/partidos" color="inherit" size="small">
            Ver partidos
          </Button>
        }
      >
        Não encontramos políticos em mandato deste partido.
      </Alert>
    );
  }

  const nome = p.sigla === SEM_PARTIDO ? 'Sem partido' : p.nome ? nomeProprio(p.nome) : p.sigla;
  const presidencia = p.executivo.filter((e) => e.cargo.endsWith('presidente'));
  const governos = p.executivo.filter((e) => e.cargo.endsWith('governador'));

  return (
    <>
      <Button component={RouterLink} to="/partidos" startIcon={<ArrowBackRounded />} size="small" sx={{ mb: 1 }}>
        Todos os partidos
      </Button>
      <Stack direction="row" spacing={{ xs: 2, md: 3 }} sx={{ alignItems: 'center', mb: 2 }}>
        <SimboloPartido sigla={p.sigla} logo={p.logo} fundo={p.fundo} size={96} quadrado />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '1.6rem', md: '2.2rem' }, lineHeight: 1.1 }}>
            {nome}
          </Typography>
          {p.sigla !== SEM_PARTIDO && (
            <Typography variant="h6" color="text.secondary">
              {p.sigla}
            </Typography>
          )}
        </Box>
      </Stack>
      <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1 }}>
        {presidencia.length > 0 && <Chip label="Presidência da República" color="primary" />}
        {governos.filter((e) => e.cargo === 'governador').length > 0 && <Chip label={`${governos.filter((e) => e.cargo === 'governador').length} governo(s) estadual(is)`} />}
        <Chip label={`${p.senadores.length} senador(es)`} />
        <Chip label={`${p.deputados.length} deputado(s) federal(is)`} />
        {p.presideSenado && <Chip label="Preside o Senado" variant="outlined" />}
        {p.presideCamara && <Chip label="Preside a Câmara" variant="outlined" />}
      </Stack>

      {presidencia.length > 0 && (
        <Secao titulo="Presidência da República" n={presidencia.length} nota="Mandato 2023–2026, eleitos em 2022 (TSE).">
          <Grade>{presidencia.map(executivo)}</Grade>
        </Secao>
      )}
      {governos.length > 0 && (
        <Secao titulo="Governos estaduais" n={governos.length} nota="Governadores(as) e vices eleitos em 2022, mandato 2023–2026 (TSE).">
          <Grade>{governos.map(executivo)}</Grade>
        </Secao>
      )}
      <Secao titulo="Senado Federal" n={p.senadores.length} nota="Senadores(as) em exercício, segundo o Senado Federal.">
        {p.senadores.length ? <Grade>{p.senadores.map((m) => parlamentar(m, p.presideSenado?.id === m.id ? 'Presidente do Senado' : null))}</Grade> : <Typography color="text.secondary">Nenhum(a) senador(a) em exercício.</Typography>}
      </Secao>
      <Secao titulo="Câmara dos Deputados" n={p.deputados.length} nota="Deputados(as) federais em exercício, segundo a Câmara dos Deputados.">
        {p.deputados.length ? <Grade>{p.deputados.map((m) => parlamentar(m, p.presideCamara?.id === m.id ? 'Presidente da Câmara' : null))}</Grade> : <Typography color="text.secondary">Nenhum(a) deputado(a) em exercício.</Typography>}
      </Secao>
      {p.deixaram.length > 0 && (
        <Secao titulo="Deixaram o cargo para concorrer em 2026" n={p.deixaram.length} nota="Eleitos em 2022 que concorrem a outro cargo em 2026 e, por isso, tiveram de deixar o mandato até 6 meses antes da eleição (Constituição, art. 14, § 6º).">
          <Grade>{p.deixaram.map(executivo)}</Grade>
        </Secao>
      )}

      <Stack spacing={0.5} sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Fontes oficiais: Câmara dos Deputados e Senado Federal (composição em exercício, atualizada todos os dias); TSE (eleitos em 2022 e registros de candidatura de 2026).
          {executivos ? ` ${executivos.aviso}` : ''} Mandatos estaduais e municipais de vereadores, prefeitos e deputados estaduais não têm base oficial unificada e não aparecem aqui.
        </Typography>
        {p.fonteLogo && (
          <Typography variant="caption" color="text.secondary">
            Símbolo:{' '}
            <Link href={p.fonteLogo} target="_blank" rel="noopener noreferrer">
              site oficial do partido <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
            </Link>
          </Typography>
        )}
      </Stack>
    </>
  );
}
