/**
 * Moldura da área dos EUA no layout comum: faixa de confiança, rodapé e busca de parlamentares.
 * Fica no pacote principal (é pequena); as páginas dos EUA continuam carregadas sob demanda.
 */
import { LinkPreferenciasMedicao } from '@/components/AvisoMedicao';
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Container, Dialog, DialogContent, DialogTitle, Link, Stack, TextField, Typography } from '@mui/material';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { Link as RouterLink, useNavigate } from 'react-router';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FaiscaCredito } from '@/components/brand/FaiscaCredito';
import { AvisoTraducao } from '@/components/IdiomaMenu';
import { eua, type MembroResumo } from '../api';
import { cargoMembro, nomeEstado, nomePartido } from '../formato';

export function TrustBarEua() {
  return (
    <Box className="vi-chrome" sx={(theme) => ({ bgcolor: 'primary.container', color: 'primary.onContainer', borderBottom: `1px solid ${theme.vars.palette.divider}` })}>
      <Container maxWidth="lg" sx={{ py: 0.75, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          <VerifiedRounded sx={{ fontSize: 15, verticalAlign: 'text-bottom', mr: 0.5 }} />
          Estados Unidos · só dados públicos oficiais (Congresso, FEC, Suprema Corte e outros órgãos federais) · informativo, sem pedido de voto
        </Typography>
        <Link component={RouterLink} to="/eua/sobre" variant="caption" sx={{ color: 'inherit', ml: 'auto' }}>
          Fontes e base legal
        </Link>
      </Container>
    </Box>
  );
}

const FONTES = [
  ['Office of the Clerk, U.S. House of Representatives', 'https://clerk.house.gov/'],
  ['U.S. Senate', 'https://www.senate.gov/'],
  ['Biographical Directory of the U.S. Congress', 'https://bioguide.congress.gov/'],
  ['Federal Election Commission (FEC)', 'https://www.fec.gov/data/'],
  ['USAspending.gov', 'https://www.usaspending.gov/'],
  ['Supreme Court of the United States', 'https://www.supremecourt.gov/'],
  ['National Archives: Electoral College', 'https://www.archives.gov/electoral-college'],
  ['MIT Election Data and Science Lab', 'https://electionlab.mit.edu/data'],
] as const;

export function RodapeEua() {
  return (
    <Box component="footer" className="vi-chrome" sx={{ borderTop: 1, borderColor: 'divider', mt: 6, py: 4, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ justifyContent: 'space-between' }}>
          <Stack spacing={1} sx={{ maxWidth: 560 }}>
            <BrandLogo size="small" />
            <Typography variant="body2" color="text.secondary">
              A área dos Estados Unidos apenas reúne e organiza dados públicos publicados pelo governo federal americano. É informativa: não pede
              voto, não faz propaganda, não apoia candidaturas ou partidos e não recebe nem repassa dinheiro de campanha. Todos aparecem com os
              mesmos campos, na mesma ordem e com o mesmo destaque, e sem cores de partido.
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Obras do governo federal dos EUA são de domínio público (17 U.S.C. § 105). Não publicamos doadores de campanha, cadastros de eleitores
              nem selos oficiais, e sempre citamos a fonte.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Serviço não oficial:</strong> sem vínculo com o governo dos EUA, o Congresso, a FEC, a Suprema Corte ou qualquer partido ou
              campanha. A fonte oficial sempre prevalece.
            </Typography>
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="subtitle2">Fontes oficiais</Typography>
            {FONTES.map(([nome, url]) => (
              <Link key={url} href={url} target="_blank" rel="noopener noreferrer" variant="body2">
                {nome}
              </Link>
            ))}
            <Link component={RouterLink} to="/eua/sobre" variant="body2">
              Fontes, método e base legal
            </Link>
            <Link href="https://github.com/professorbossini/voto-informado/issues/new" target="_blank" rel="noopener noreferrer" variant="body2">
              Reportar erro ou divergência
            </Link>
            <Link component={RouterLink} to="/privacidade" variant="body2">
              Política de Privacidade
            </Link>
            <LinkPreferenciasMedicao />
            <Link component={RouterLink} to="/termos" variant="body2">
              Termos de Uso
            </Link>
          </Stack>
        </Stack>
        {/* Crédito do template Faísca: centralizado, no fim da página. */}
        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>
          <FaiscaCredito />
        </Box>
        <AvisoTraducao />
      </Container>
    </Box>
  );
}

/** Busca de parlamentares dos EUA (nome ou estado), aberta pela lupa do topo na área /eua. */
export function BuscaMembrosEua({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const navigate = useNavigate();
  const [membros, setMembros] = useState<MembroResumo[]>([]);
  useEffect(() => {
    if (!aberto || membros.length) return;
    eua
      .congresso()
      .then((c) => setMembros([...c.senado.membros, ...c.camara.membros].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))))
      .catch(() => undefined);
  }, [aberto, membros.length]);
  return (
    <Dialog open={aberto} onClose={fechar} fullWidth maxWidth="sm">
      <DialogTitle>Buscar parlamentar dos EUA</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Senadores(as), deputados(as) e delegados(as) em exercício. Busque pelo nome ou pelo estado.
        </Typography>
        <Autocomplete
          options={membros}
          loading={!membros.length}
          getOptionLabel={(m) => m.nome}
          filterOptions={(ops, { inputValue }) => {
            const q = inputValue.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
            return ops.filter((m) => `${m.nome} ${nomeEstado(m.uf)} ${m.uf}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(q)).slice(0, 50);
          }}
          renderOption={(props, m) => (
            <Box component="li" {...props} key={m.id}>
              <Box>
                <Typography variant="body2" translate="no">
                  {m.nome}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cargoMembro(m)} · {nomePartido(m.partido)} · {nomeEstado(m.uf)}
                </Typography>
              </Box>
            </Box>
          )}
          onChange={(_, m) => {
            if (m) {
              fechar();
              void navigate(`/eua/membro/${m.id}`);
            }
          }}
          renderInput={(p) => <TextField {...p} autoFocus label="Nome ou estado" />}
        />
      </DialogContent>
    </Dialog>
  );
}
