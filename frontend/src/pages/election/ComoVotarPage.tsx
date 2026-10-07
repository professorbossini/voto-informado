import { Alert, Box, Button, Card, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
import EventRounded from '@mui/icons-material/EventRounded';
import BadgeRounded from '@mui/icons-material/BadgeRounded';
import PhonelinkEraseRounded from '@mui/icons-material/PhonelinkEraseRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import ListAltRounded from '@mui/icons-material/ListAltRounded';
import EventBusyRounded from '@mui/icons-material/EventBusyRounded';
import BarChartRounded from '@mui/icons-material/BarChartRounded';
import HowToVoteRounded from '@mui/icons-material/HowToVoteRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { useUfUsuario } from '@/components/resultados/hooks';
import { data } from '@/data/api';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/pages/PageHeader';
import { AvisoResultado } from '@/components/avisos/AvisoResultado';
import { TURNOS } from '@/data/calendario';

/** Páginas oficiais do TSE usadas nesta página (fonte de cada regra). */
const TSE = {
  horario: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/faltam-26-dias-votacao-comeca-e-termina-no-mesmo-horario-em-todo-o-pais',
  documentos: 'https://www.tse.jus.br/comunicacao/noticias/2026/Abril/eleitor-em-dia-saiba-quais-documentos-sao-validos-para-votar-nas-eleicoes-2026',
  celular: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/faltam-10-dias-equipamentos-que-comprometem-o-sigilo-do-voto-nao-podem-entrar-na-cabine',
  cola: 'https://www.tse.jus.br/comunicacao/noticias/2026/Agosto/colinha-eleitoral-ajuda-a-lembrar-os-numeros-de-candidatos-nas-eleicoes-2026',
  dezoito: 'https://www.tse.jus.br/comunicacao/noticias/2026/Marco/eleitor-em-dia-quem-completa-18-anos-entre-o-1o-e-o-2o-turno-das-eleicoes-deve-votar-1',
  etitulo: 'https://www.tse.jus.br/servicos-eleitorais/e-titulo-perguntas-frequentes',
  autoatendimento: 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral',
  manual: 'https://www.tse.jus.br/eleicoes/arquivos/manual-do-eleitor-2026/@@display-file/file/MANUAL%20DO%20ELEITOR%202026.pdf',
};

function Fonte({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" variant="caption">
      {children} <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
    </Link>
  );
}

function Bloco({ icone, titulo, children, fonte }: { icone: ReactNode; titulo: string; children: ReactNode; fonte?: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1 }}>
          {icone}
          <Typography variant="h6" component="h2">
            {titulo}
          </Typography>
        </Stack>
        <Box sx={{ '& p': { m: 0, mb: 1 }, '& ul': { mt: 0, mb: 1, pl: 2.5 } }}>{children}</Box>
        {fonte && <Box sx={{ mt: 1 }}>{fonte}</Box>}
      </CardContent>
    </Card>
  );
}

/** "2026-10-25" → "25/10/2026". */
const diaBr = (iso: string) => iso.split('-').reverse().join('/');

/** 60 dias depois do turno (prazo para justificar a ausência). */
function mais60(iso: string) {
  const d = new Date(`${iso}T12:00:00-03:00`);
  d.setDate(d.getDate() + 60);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function ComoVotarPage() {
  const segundo = TURNOS.find((t) => t.turno === 2)!;
  const st = useAsync(() => data.segundoTurno().catch(() => null), []);
  const { uf } = useUfUsuario({ detectarSozinho: false });
  const governo = (st.data?.disputas ?? []).filter((d) => d.cargo === 'governador').sort((a, b) => a.nome_uf.localeCompare(b.nome_uf, 'pt-BR'));
  const temPresidente = (st.data?.disputas ?? []).some((d) => d.cargo === 'presidente');
  const meuEstado = uf ? governo.find((d) => d.uf === uf) : undefined;

  return (
    <>
      <PageHeader
        title="Como votar no 2º turno"
        subtitle="O essencial para o dia da votação, conforme as regras do Tribunal Superior Eleitoral (TSE). Cada item tem o link da fonte oficial."
      />
      <Stack spacing={2.5}>
        <Bloco
          icone={<EventRounded color="primary" />}
          titulo={`Domingo, ${diaBr(segundo.data)}, das 8h às 17h (horário de Brasília)`}
          fonte={<Fonte href={TSE.horario}>TSE: horário unificado de votação (Res. TSE 23.751/2026)</Fonte>}
        >
          <p>
            O horário é o mesmo em todo o país, pelo relógio de Brasília. Em estados com outro fuso, a votação começa e termina mais cedo no horário
            local. Quem estiver na fila às 17h ainda vota.
          </p>
        </Bloco>

        <Bloco icone={<HowToVoteRounded color="primary" />} titulo="O que está em disputa">
          {st.loading ? (
            <p>Carregando…</p>
          ) : (
            <>
              <p>
                {temPresidente ? 'Presidente da República, em todo o país' : 'Presidente da República, se houver 2º turno'}
                {governo.length ? `, e governador em ${governo.length} ${governo.length === 1 ? 'estado' : 'estados'}:` : '.'}
              </p>
              {governo.length > 0 && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                  {governo.map((d) => (
                    <Chip key={d.uf} label={d.nome_uf} color={d.uf === uf ? 'primary' : 'default'} variant={d.uf === uf ? 'filled' : 'outlined'} size="small" />
                  ))}
                </Stack>
              )}
              {uf && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  {meuEstado ? 'No seu estado, você vota para governador e para presidente.' : 'No seu estado não há 2º turno para governador: você vota só para presidente.'}
                </Alert>
              )}
              <p>
                Quem não votou no 1º turno pode votar normalmente no 2º. Quem completou 18 anos entre os dois turnos também deve votar (
                <Link href={TSE.dezoito} target="_blank" rel="noopener noreferrer">
                  TSE
                </Link>
                ).
              </p>
              <Button component={RouterLink} to="/segundo-turno" variant="tonal" size="small">
                Ver quem disputa o 2º turno
              </Button>
            </>
          )}
        </Bloco>

        <Bloco
          icone={<BadgeRounded color="primary" />}
          titulo="Documento: um oficial com foto"
          fonte={<Fonte href={TSE.documentos}>TSE: documentos válidos para votar em 2026</Fonte>}
        >
          <p>Leve um documento oficial com foto, por exemplo:</p>
          <ul>
            <li>carteira de identidade (RG) ou Carteira Nacional de Habilitação (CNH);</li>
            <li>passaporte, carteira de trabalho ou certificado de reservista;</li>
            <li>o aplicativo e-Título, se tiver a sua foto (só aparece para quem fez a biometria).</li>
          </ul>
          <p>O título de eleitor em papel não é obrigatório.</p>
        </Bloco>

        <Bloco
          icone={<PhonelinkEraseRounded color="primary" />}
          titulo="Celular: fora da cabine"
          fonte={<Fonte href={TSE.celular}>TSE: equipamentos que comprometem o sigilo do voto não entram na cabine</Fonte>}
        >
          <p>
            É proibido entrar na cabine com celular, câmera ou qualquer aparelho que comprometa o sigilo do voto. Dá para usar o celular para mostrar o
            e-Título aos mesários; depois, desligue-o e deixe-o no local indicado antes de votar.
          </p>
        </Bloco>

        <Bloco
          icone={<ListAltRounded color="primary" />}
          titulo="Pode levar os números anotados"
          fonte={<Fonte href={TSE.cola}>TSE: a colinha eleitoral ajuda a lembrar os números</Fonte>}
        >
          <p>Anotações em papel com os números são permitidas e agilizam a votação.</p>
          <Button component={RouterLink} to="/cola" variant="tonal" size="small">
            Montar a minha cola
          </Button>
        </Bloco>

        <Bloco
          icone={<PlaceRounded color="primary" />}
          titulo="Onde votar"
          fonte={
            <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap' }}>
              <Fonte href={TSE.autoatendimento}>Autoatendimento do TSE (título e local de votação)</Fonte>
              <Fonte href={TSE.etitulo}>e-Título</Fonte>
            </Stack>
          }
        >
          <p>
            No mesmo local do 1º turno. Para conferir, use o aplicativo e-Título ou o autoatendimento no site do TSE. O Tá na Urna não pede nem guarda
            seu CPF ou título: a consulta é feita direto no TSE.
          </p>
        </Bloco>

        <Bloco
          icone={<EventBusyRounded color="primary" />}
          titulo="Não vai conseguir votar?"
          fonte={<Fonte href={TSE.etitulo}>TSE: e-Título e justificativa</Fonte>}
        >
          <p>
            Justifique a ausência no dia, pelo e-Título ou em um local de votação, ou até {mais60(segundo.data)} (60 dias depois do 2º turno), pelo
            e-Título ou pelo Sistema Justifica. Cada turno é justificado separadamente.
          </p>
        </Bloco>

        <Bloco icone={<BarChartRounded color="primary" />} titulo="Resultados">
          <p>A partir das 17h (horário de Brasília), os resultados aparecem ao vivo no site, direto do TSE.</p>
          <Button component={RouterLink} to="/resultados" variant="tonal" size="small">
            Acompanhar a apuração
          </Button>
        </Bloco>

        <AvisoResultado />

        <Typography variant="caption" color="text.secondary">
          Resumo informativo. Em caso de dúvida, vale o que diz o TSE:{' '}
          <Link href={TSE.manual} target="_blank" rel="noopener noreferrer">
            Manual do Eleitor 2026
          </Link>
          .
        </Typography>
      </Stack>
    </>
  );
}
