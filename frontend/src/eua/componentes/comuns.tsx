import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  ButtonBase,
  Card,
  CardActionArea,
  Chip,
  Divider,
  Link,
  Popover,
  Skeleton,
  Stack,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import { Link as RouterLink } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { useAsync } from '@/hooks/useAsync';
import { arquivoEua, eua, type FonteEua, type MembroResumo } from '../api';
import { cargoMembro, dataHoraBrasilia, distrito, nomeEstado, nomePartido } from '../formato';

/** Fontes dos EUA (fontes.json), carregadas uma vez por sessão. */
export function useFontesEua() {
  const r = useAsync(() => eua.fontes(), []);
  return new Map((r.data?.fontes ?? []).map((f) => [f.chave, f]));
}

function DetalheFonte({ f }: { f: FonteEua }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2">{f.nome}</Typography>
      <Typography variant="caption" color="text.secondary">
        {f.orgao}
      </Typography>
      <Typography variant="body2">{f.descricao}</Typography>
      {f.licenca && (
        <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
          <GavelRounded sx={{ fontSize: 14, mt: '2px' }} /> {f.licenca}
        </Typography>
      )}
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25 }}>
        {f.publicado_em && (
          <>
            <Typography component="dt" variant="caption" color="text.secondary">
              Publicado no servidor oficial
            </Typography>
            <Typography component="dd" variant="caption" sx={{ m: 0 }}>
              {dataHoraBrasilia(f.publicado_em)}
            </Typography>
          </>
        )}
        <Typography component="dt" variant="caption" color="text.secondary">
          Coletado por este site
        </Typography>
        <Typography component="dd" variant="caption" sx={{ m: 0 }}>
          {dataHoraBrasilia(f.coletado_em)}
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <Link href={f.url} target="_blank" rel="noopener noreferrer" variant="caption">
          Arquivo oficial <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
        </Link>
        {f.pagina && f.pagina !== f.url && (
          <Link href={f.pagina} target="_blank" rel="noopener noreferrer" variant="caption">
            Página da fonte <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
          </Link>
        )}
      </Stack>
    </Stack>
  );
}

/** "Fonte oficial: ..." sob cada bloco de dados; ao clicar, arquivo, licença e datas. */
export function FonteNota({ chaves, nota, sx }: { chaves: string[]; nota?: string; sx?: SxProps<Theme> }) {
  const fontes = useFontesEua();
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const lista = chaves.map((k) => fontes.get(k)).filter((f): f is FonteEua => Boolean(f));
  const rotulo = lista.length ? `Fonte: ${[...new Set(lista.map((f) => f.orgao.split(' · ')[0]))].join(', ')}` : 'Fonte oficial';
  return (
    <>
      <ButtonBase
        onClick={(e) => setAncora(e.currentTarget)}
        aria-label={`${rotulo}. Ver detalhes da fonte`}
        sx={[
          { display: 'inline-flex', alignItems: 'flex-start', gap: 0.75, textAlign: 'left', borderRadius: 1, px: 0.5, py: 0.25, mx: -0.5, color: 'text.secondary', '&:hover': { color: 'text.primary' } },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
        <Typography variant="caption" component="span" sx={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
          {rotulo}
          {nota ? ` · ${nota}` : ''}
        </Typography>
      </ButtonBase>
      <Popover
        open={Boolean(ancora)}
        anchorEl={ancora}
        onClose={() => setAncora(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 440, borderRadius: 3 } } }}
      >
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {lista.length === 0 && <Typography variant="body2">Carregando fontes…</Typography>}
          {lista.map((f) => (
            <DetalheFonte key={f.chave} f={f} />
          ))}
        </Stack>
      </Popover>
    </>
  );
}

export function FotoMembro({ foto, nome, largura = 72 }: { foto: string | null; nome: string; largura?: number | string }) {
  return <CandidatePhoto src={arquivoEua(foto)} alt={`Retrato oficial de ${nome}`} width={largura} rounded={10} />;
}

/** Linha "Senador · Republicano · Texas" ou "Deputada · Democrata · Califórnia, 12º distrito". */
export function descricaoMembro(m: MembroResumo, comEstado = true) {
  const onde = comEstado ? ` · ${nomeEstado(m.uf)}${m.casa === 'camara' && !m.delegado ? `, ${distrito(m.distrito)}` : ''}` : m.casa === 'camara' && !m.delegado ? ` · ${distrito(m.distrito)}` : '';
  return `${cargoMembro(m)} · ${nomePartido(m.partido)}${onde}`;
}

/** Cartão de parlamentar: mesmo formato e destaque para todos. */
export function CartaoMembro({ m, extra, comEstado = true }: { m: MembroResumo; extra?: ReactNode; comEstado?: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: 1 }}>
      <CardActionArea component={RouterLink} to={`/eua/membro/${m.id}`} sx={{ height: 1, p: 1.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1.5 }}>
        <FotoMembro foto={m.foto} nome={m.nome} largura={56} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" translate="no" sx={{ lineHeight: 1.25 }}>
            {m.nome}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {descricaoMembro(m, comEstado)}
          </Typography>
          {extra}
        </Box>
      </CardActionArea>
    </Card>
  );
}

/** Aviso fixo das páginas dos EUA: informativo, neutro e sem pedido de voto. */
export function AvisoInformativo() {
  return (
    <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
      Página informativa com dados públicos oficiais dos Estados Unidos. O Tá na Urna não apoia candidaturas ou partidos, não pede voto
      e não faz propaganda: todos aparecem com os mesmos campos, na mesma ordem (alfabética, salvo quando você escolhe outra) e com o
      mesmo destaque. Serviço não oficial, sem vínculo com o governo dos EUA.{' '}
      <Link component={RouterLink} to="/eua/sobre">
        Fontes e base legal
      </Link>
    </Alert>
  );
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={i ? 72 : 180} />
      ))}
    </Stack>
  );
}

export function Erro({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert severity="warning" action={onRetry ? <Link component="button" onClick={onRetry}>Tentar de novo</Link> : undefined}>
      Não foi possível carregar estes dados agora. Os dados ficam disponíveis assim que a coleta automática roda (todos os dias).
    </Alert>
  );
}

export function ChipPartido({ p }: { p: string | null | undefined }) {
  return <Chip size="small" variant="outlined" label={nomePartido(p)} />;
}
