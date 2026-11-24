import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material';
import * as Bandeiras from 'country-flag-icons/react/3x2';
import { useAuth } from '@/auth';
import { pedirVisitas } from '@/analytics/visitas';
import { placeName } from '@/analytics/visitante';
import { PageHeader } from '@/pages/PageHeader';
import { CabecalhosOrdenaveis } from '@/components/tabela/CabecalhoOrdenavel';
import { proximaOrdem, ordenarPor, useOrdem } from '@/components/tabela/ordenacao';

/**
 * Página Visitas, só para os admins (o Worker tanaurna-visitas confere o e-mail). Tela de administração:
 * fica só em português (fora de scripts/extrair-textos.mjs).
 */

interface Visita {
  id: number;
  visitante: string;
  comLogin: boolean;
  caminho: string;
  origem: string | null;
  ip: string | null;
  pais: string | null;
  regiao: string | null;
  cidade: string | null;
  navegador: string | null;
  sistema: string | null;
  criadoEm: string;
}

interface Resposta {
  visitas: Visita[];
  resumo: {
    paginas24h: number;
    visitantes24h: number;
    paginas7d: number;
    visitantes7d: number;
    comLogin7d: number;
  };
  top: { caminho: string; visitas: number }[];
  retencao: { MESES_COM_IP: number; MESES_DETALHADA: number };
}

/** Colunas da tabela: chave de ordenação no Worker (lista branca lá) e largura proporcional (table-layout: fixed). */
const COLUNAS = [
  { chave: 'quando', titulo: 'Quando', largura: '10%' },
  { chave: 'quem', titulo: 'Quem', largura: '16%' },
  { chave: 'pagina', titulo: 'Página', largura: '16%' },
  { chave: 'origem', titulo: 'Veio de', largura: '13%' },
  { chave: 'local', titulo: 'Local', largura: '15%' },
  { chave: 'navegador', titulo: 'Navegador', largura: '10%' },
  { chave: 'sistema', titulo: 'Sistema', largura: '10%' },
  { chave: 'ip', titulo: 'IP', largura: '10%' },
] as const;
type Chave = (typeof COLUNAS)[number]['chave'];

type Estado =
  { fase: 'carregando' } | { fase: 'erro'; status: number } | { fase: 'ok'; dados: Resposta };

function Bandeira({ pais }: { pais: string | null }) {
  const Icone = pais
    ? (Bandeiras as Record<string, (typeof Bandeiras)['BR'] | undefined>)[pais.toUpperCase()]
    : undefined;
  if (!Icone) return null;
  return (
    <Icone title={pais ?? ''} style={{ width: 20, height: 14, flexShrink: 0, borderRadius: 2 }} />
  );
}

function Numero({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: number | string;
  nota?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {rotulo}
        </Typography>
        <Typography variant="h4" component="p" sx={{ fontWeight: 800 }}>
          {valor}
        </Typography>
        {nota && (
          <Typography variant="caption" color="text.secondary">
            {nota}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return {
    data: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
};

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  } catch {
    return null;
  }
})();
const nomePais = (c: string | null) => {
  if (!c) return '';
  try {
    return regionNames?.of(c.toUpperCase()) ?? c;
  } catch {
    return c;
  }
};

function Quem({ v }: { v: Visita }) {
  return (
    <>
      Visitante {v.visitante.slice(0, 6)}
      {v.comLogin && <Chip label="com login" size="small" sx={{ ml: 0.5 }} />}
    </>
  );
}

/** Bandeira + "Cidade, Estado" na 1ª linha e o país na 2ª; texto longo vira reticências (inteiro no title). */
function Local({ v }: { v: Visita }) {
  const linha1 = [v.cidade, v.regiao].filter(Boolean).join(', ');
  const pais = nomePais(v.pais);
  const corte = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflowWrap: 'normal',
  } as const;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'flex-start', minWidth: 0 }}
      title={placeName({ city: v.cidade, region: v.regiao, country: v.pais })}
    >
      <Box sx={{ pt: 0.4, display: 'flex' }}>
        <Bandeira pais={v.pais} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={corte}>
          {linha1 || pais || '–'}
        </Typography>
        {linha1 && pais && (
          <Typography variant="caption" color="text.secondary" component="div" sx={corte}>
            {pais}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export function VisitasPage() {
  const { getAccessToken } = useAuth();
  const [caminho, setCaminho] = useState('');
  const [quem, setQuem] = useState('todos');
  const [ordem, setOrdem] = useState<{ sort: Chave; dir: 'asc' | 'desc' }>({
    sort: 'quando',
    dir: 'desc',
  });
  const [estado, setEstado] = useState<Estado>({ fase: 'carregando' });
  const largo = useMediaQuery((t: Theme) => t.breakpoints.up('md'));

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return vivo && setEstado({ fase: 'erro', status: 401 });
          const r = await pedirVisitas<Resposta>(
            `/admin/visitas?caminho=${encodeURIComponent(caminho)}&quem=${quem}&sort=${ordem.sort}&dir=${ordem.dir}`,
            token,
          );
          if (!vivo) return;
          setEstado(r.dados ? { fase: 'ok', dados: r.dados } : { fase: 'erro', status: r.status });
        } catch {
          if (vivo) setEstado({ fase: 'erro', status: 0 });
        }
      })();
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [caminho, quem, ordem, getAccessToken]);

  // A tabela das visitas ordena no servidor (vale para todas, não só as 200 que chegam).
  const ordenar = (c: Chave) =>
    setOrdem((o) => {
      const p = proximaOrdem(
        { coluna: o.sort, sentido: o.dir },
        c,
        c === 'quando' ? 'desc' : 'asc',
      );
      return { sort: p.coluna, dir: p.sentido };
    });
  // "Mais vistas" chega inteira (10 linhas): ordena aqui.
  const ordTop = useOrdem<'caminho' | 'visitas'>(null, (c) => (c === 'visitas' ? 'desc' : 'asc'));

  if (estado.fase === 'erro' && (estado.status === 401 || estado.status === 403)) {
    return (
      <>
        <PageHeader title="Visitas" />
        <Alert severity="warning">Esta página é só para administradores.</Alert>
      </>
    );
  }

  const d = estado.fase === 'ok' ? estado.dados : null;
  const s = d?.resumo;
  return (
    <>
      <PageHeader
        title="Visitas"
        subtitle={
          d
            ? `Páginas vistas no site. IP e navegador completo ficam ${d.retencao.MESES_COM_IP} meses; depois de ${d.retencao.MESES_DETALHADA} meses, só a estatística anônima.`
            : 'Páginas vistas no site.'
        }
      />
      {estado.fase === 'erro' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Não foi possível carregar as visitas agora.
        </Alert>
      )}
      <Stack spacing={2.5}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <Numero rotulo="Páginas vistas em 24 h" valor={s?.paginas24h ?? '–'} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Numero rotulo="Visitantes em 24 h" valor={s?.visitantes24h ?? '–'} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Numero
              rotulo="Visitantes em 7 dias"
              valor={s?.visitantes7d ?? '–'}
              nota={`${s?.paginas7d ?? 0} páginas vistas`}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Numero rotulo="Com login em 7 dias" valor={s?.comLogin7d ?? '–'} />
          </Grid>
        </Grid>

        <TableContainer component={Card} variant="outlined" sx={{ overflowX: 'hidden' }}>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                <CabecalhosOrdenaveis
                  ordem={ordTop.ordem}
                  onOrdenar={ordTop.ordenar}
                  colunas={[
                    { coluna: 'caminho', rotulo: 'Mais vistas em 7 dias' },
                    { coluna: 'visitas', rotulo: 'Visitas', align: 'right', sx: { width: 90 } },
                  ]}
                />
              </TableRow>
            </TableHead>
            <TableBody>
              {ordenarPor(
                d?.top ?? [],
                { caminho: (t) => t.caminho, visitas: (t) => Number(t.visitas) },
                ordTop.ordem,
              ).map((t) => (
                <TableRow key={t.caminho}>
                  <TableCell sx={{ overflowWrap: 'anywhere' }}>{t.caminho}</TableCell>
                  <TableCell align="right">{t.visitas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            size="small"
            label="Página"
            value={caminho}
            onChange={(e) => setCaminho(e.target.value)}
          />
          <TextField
            select
            size="small"
            label="Quem"
            value={quem}
            onChange={(e) => setQuem(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="login">Só com login</MenuItem>
          </TextField>
          {!largo && (
            <Stack direction="row" spacing={1.5}>
              <TextField
                select
                size="small"
                label="Ordenar por"
                value={ordem.sort}
                onChange={(e) => setOrdem((o) => ({ ...o, sort: e.target.value as Chave }))}
                sx={{ flex: 1 }}
              >
                {COLUNAS.map((c) => (
                  <MenuItem key={c.chave} value={c.chave}>
                    {c.titulo}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Sentido"
                value={ordem.dir}
                onChange={(e) => setOrdem((o) => ({ ...o, dir: e.target.value as 'asc' | 'desc' }))}
                sx={{ flex: 1 }}
              >
                <MenuItem value="asc">Crescente</MenuItem>
                <MenuItem value="desc">Decrescente</MenuItem>
              </TextField>
            </Stack>
          )}
          {estado.fase === 'carregando' && (
            <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
          )}
        </Stack>

        {d && d.visitas.length === 0 && (
          <Typography color="text.secondary">Nenhuma visita encontrada.</Typography>
        )}

        {largo ? (
          // Nunca rola na horizontal: colunas proporcionais e texto longo quebra dentro da própria coluna.
          <Card variant="outlined">
            <Table
              size="small"
              sx={{
                width: '100%',
                tableLayout: 'fixed',
                '& td, & th': { overflowWrap: 'anywhere', verticalAlign: 'top', px: 1 },
              }}
            >
              <TableHead>
                <TableRow>
                  <CabecalhosOrdenaveis
                    ordem={{ coluna: ordem.sort, sentido: ordem.dir }}
                    onOrdenar={ordenar}
                    colunas={COLUNAS.map((c) => ({
                      coluna: c.chave,
                      rotulo: c.titulo,
                      sx: { width: c.largura },
                    }))}
                  />
                </TableRow>
              </TableHead>
              <TableBody>
                {(d?.visitas ?? []).map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      {dataHora(v.criadoEm).data}
                      <br />
                      {dataHora(v.criadoEm).hora}
                    </TableCell>
                    <TableCell>
                      <Quem v={v} />
                    </TableCell>
                    <TableCell>{v.caminho}</TableCell>
                    <TableCell>{v.origem ?? '–'}</TableCell>
                    <TableCell>
                      <Local v={v} />
                    </TableCell>
                    <TableCell>{v.navegador ?? '–'}</TableCell>
                    <TableCell>{v.sistema ?? '–'}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem' }}>{v.ip ?? '–'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {(d?.visitas ?? []).map((v) => (
              <Card key={v.id} variant="outlined">
                <CardContent
                  sx={{ '& *': { overflowWrap: 'anywhere' }, py: 1.5, '&:last-child': { pb: 1.5 } }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary" component="div">
                      {dataHora(v.criadoEm).data} {dataHora(v.criadoEm).hora} · <Quem v={v} />
                    </Typography>
                    <Typography variant="subtitle2">{v.caminho}</Typography>
                    {v.origem && <Typography variant="body2">Veio de {v.origem}</Typography>}
                    <Local v={v} />
                    <Typography variant="body2">
                      {v.navegador ?? '–'} · {v.sistema ?? '–'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      IP {v.ip ?? '–'}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </>
  );
}
