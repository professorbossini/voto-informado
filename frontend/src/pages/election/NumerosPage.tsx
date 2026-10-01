import type { ReactNode } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import { useSearchParams } from 'react-router';
import { BarList, StatTile, type BarDatum } from '@/components/charts/charts';
import { SourceNote } from '@/components/election/SourceNote';
import { Concorrencia } from '@/components/numeros/Concorrencia';
import {
  CARGO_TAB_LABEL,
  CARGOS_NUMEROS,
  CARGOS_POR_UF,
  fonteReceitaLabel,
  ORDEM_FAIXA_ETARIA,
  ORDEM_INSTRUCAO,
  ordenarNatural,
  porVaga,
  type CargoNumeros,
} from '@/components/numeros/numeros';
import { data } from '@/data/api';
import { dateTime, money, moneyCompact, NAO_INFORMADO, number, percent } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import type { Estatisticas } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '../PageHeader';

/** Counts → bars with "1.234 · 12,3%" at the tip. */
function contagens(entries: [string, number][]): BarDatum[] {
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return entries.map(([label, value]) => {
    const txt = `${number(value)} · ${percent(total ? value / total : null)}`;
    return { label, value, display: txt, hint: `${label}: ${txt}` };
  });
}

function Bloco({ titulo, descricao, fontes, children }: { titulo: string; descricao?: ReactNode; fontes: string[]; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" component="h2">
          {titulo}
        </Typography>
        {descricao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {descricao}
          </Typography>
        )}
        <Box sx={{ mt: 2, flex: 1 }}>{children}</Box>
        <SourceNote keys={fontes} sx={{ mt: 2, alignSelf: 'flex-start' }} />
      </CardContent>
    </Card>
  );
}

function NumerosSkeleton() {
  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 6, md: 3 }}>
            <Skeleton variant="rounded" height={104} />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rounded" height={240} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function Conteudo({ e, cargo }: { e: Estatisticas; cargo: CargoNumeros }) {
  const { meta } = useMeta();
  const has = (k: string) => e.fontes.includes(k);
  const f = (...keys: string[]) => keys.filter(has);

  const genero = e.genero[cargo] ?? {};
  const naUrna = Object.values(genero).reduce((s, n) => s + n, 0);
  const mulheres = genero['Feminino'];
  const bens = e.bens[cargo];
  const situacao = e.situacao_registro[cargo] ?? {};
  const totalRegistros = Object.values(situacao).reduce((s, n) => s + n, 0);

  const receitas = Object.entries(e.receitas_por_fonte[cargo] ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ label: fonteReceitaLabel(k), value: v }));
  const totalReceitas = receitas.reduce((s, r) => s + r.value, 0);

  const partidos = e.por_partido
    .filter((p) => p.cargo === cargo)
    .sort((a, b) => b.n - a.n || a.partido.localeCompare(b.partido, 'pt-BR'))
    .map((p): [string, number] => [p.partido, p.n]);

  const concorrencia = e.concorrencia.filter((c) => c.cargo === cargo);
  const nomes = Object.fromEntries((meta?.ufs ?? []).map((u) => [u.uf, u.nome]));
  const porUf = CARGOS_POR_UF.includes(cargo);

  const fDemografia = f('tse_candidatos', 'tse_complementar');
  const fCandidatos = f('tse_candidatos');

  return (
    <Stack spacing={3}>
      <Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatTile label="Candidaturas na urna" value={number(naUrna)} foot={`Para ${CARGO_TAB_LABEL[cargo].toLowerCase()} · todo o país`} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatTile label="Mulheres" value={percent(mulheres != null && naUrna ? mulheres / naUrna : null)} foot={mulheres != null ? `${number(mulheres)} candidaturas` : NAO_INFORMADO} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatTile
              label="Mediana de bens declarados"
              value={bens ? moneyCompact(bens.mediana) : NAO_INFORMADO}
              foot={bens ? `Metade declarou até ${money(bens.mediana)}` : undefined}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatTile
              label="Sem bens declarados"
              value={bens ? number(bens.zero) : NAO_INFORMADO}
              foot={bens ? `${percent(bens.n ? bens.zero / bens.n : null)} das candidaturas na urna` : undefined}
            />
          </Grid>
        </Grid>
        <SourceNote keys={f('tse_candidatos', 'tse_bens')} sx={{ mt: 1 }} />
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco titulo="Gênero" descricao="Candidaturas na urna, conforme declarado ao TSE." fontes={fDemografia}>
            <BarList data={contagens(ordenarNatural(Object.entries(genero)))} format={number} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco titulo="Cor/raça" descricao="Autodeclaração feita no registro da candidatura." fontes={fDemografia}>
            <BarList data={contagens(ordenarNatural(Object.entries(e.cor_raca[cargo] ?? {})))} format={number} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco titulo="Faixa etária" descricao="Idade em anos completos." fontes={fDemografia}>
            <BarList data={contagens(ordenarNatural(Object.entries(e.faixa_etaria[cargo] ?? {}), ORDEM_FAIXA_ETARIA))} format={number} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco titulo="Grau de instrução" descricao="Do menor ao maior grau declarado." fontes={fDemografia}>
            <BarList data={contagens(ordenarNatural(Object.entries(e.instrucao[cargo] ?? {}), ORDEM_INSTRUCAO))} format={number} labelWidth={{ xs: '50%', sm: '44%' }} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco
            titulo="Ocupações mais frequentes"
            descricao="As 10 ocupações mais declaradas, com o nome usado pelo TSE (“Outros” é uma categoria do próprio TSE)."
            fontes={fCandidatos}
          >
            <BarList
              data={(e.ocupacoes[cargo] ?? []).slice(0, 10).map((o) => ({ label: o.ocupacao, value: o.n, display: `${number(o.n)} · ${percent(naUrna ? o.n / naUrna : null)}` }))}
              format={number}
              labelWidth={{ xs: '50%', sm: '44%' }}
            />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Bloco
            titulo="Situação do registro"
            descricao={`Inclui pedidos de candidatura que não estão na urna (renúncia, indeferimento, cancelamento etc.). Por isso o total (${number(totalRegistros)}) é maior que o de candidaturas na urna (${number(naUrna)}).`}
            fontes={fCandidatos}
          >
            <BarList data={contagens(Object.entries(situacao).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')))} format={number} labelWidth={{ xs: '50%', sm: '46%' }} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Bloco titulo="Candidaturas por partido" descricao="Quantidade de candidaturas na urna de cada partido para este cargo, da maior para a menor." fontes={fCandidatos}>
            <BarList data={contagens(partidos)} format={number} limit={12} labelWidth={{ xs: '40%', sm: '24%' }} />
          </Bloco>
        </Grid>
      </Grid>

      <Bloco
        titulo="Receitas de campanha por fonte"
        descricao={
          <>
            Soma das receitas declaradas pelas candidaturas a este cargo. FEFC é o Fundo Especial de Financiamento de Campanha, e o Fundo
            Partidário também é dinheiro público repassado aos partidos; “Outros recursos” reúne doações de pessoas físicas, recursos próprios e
            demais origens. Os dados são parciais até a prestação de contas final
            {meta?.atualizacao.prestacao_gerada_em ? ` (base gerada em ${dateTime(meta.atualizacao.prestacao_gerada_em)})` : ''}.
          </>
        }
        fontes={f('tse_prestacao')}
      >
        {totalReceitas > 0 && (
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Total declarado: <strong>{money(totalReceitas)}</strong>
          </Typography>
        )}
        <BarList data={receitas.map((r) => ({ ...r, display: `${moneyCompact(r.value)} · ${((r.value / (totalReceitas || 1)) * 100).toFixed(1).replace('.', ',')}%` }))} format={moneyCompact} />
      </Bloco>

      <Bloco
        titulo="Concorrência"
        descricao="Candidaturas na urna dividido pelo número de vagas em disputa. Não indica chance de vitória: em eleições proporcionais, as vagas são distribuídas pelos votos de partidos e federações."
        fontes={f('tse_vagas', 'tse_candidatos')}
      >
        {porUf && concorrencia.length > 1 ? (
          <Concorrencia linhas={concorrencia} nomes={nomes} />
        ) : concorrencia.length ? (
          <Grid container spacing={2}>
            {concorrencia.map((c) => (
              <Grid key={c.uf} size={{ xs: 12, sm: 6, md: 4 }}>
                <StatTile
                  label={c.uf === 'BR' ? 'Brasil' : (nomes[c.uf] ?? c.uf)}
                  value={porVaga(c.por_vaga)}
                  foot={`${number(c.candidatos)} candidaturas para ${number(c.vagas)} ${c.vagas === 1 ? 'vaga' : 'vagas'}`}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {NAO_INFORMADO}
          </Typography>
        )}
      </Bloco>
    </Stack>
  );
}

export function NumerosPage() {
  const { data: e, error, loading, reload } = useAsync(() => data.estatisticas(), []);
  const [sp, setSp] = useSearchParams();
  const param = sp.get('cargo') as CargoNumeros | null;
  const cargo: CargoNumeros = param && (CARGOS_NUMEROS as readonly string[]).includes(param) ? param : 'presidente';

  return (
    <>
      <PageHeader
        title="A eleição em números"
        subtitle="Perfil das candidaturas de 2026 registradas no TSE, por cargo. Contagens oficiais, sem interpretação."
      />
      <Tabs
        value={cargo}
        onChange={(_, v: CargoNumeros) => setSp(v === 'presidente' ? {} : { cargo: v }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Cargo"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {CARGOS_NUMEROS.map((c) => (
          <Tab key={c} value={c} label={CARGO_TAB_LABEL[c]} />
        ))}
      </Tabs>
      {loading && <NumerosSkeleton />}
      {!loading && error != null && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Tentar de novo
            </Button>
          }
        >
          Não foi possível carregar as estatísticas. {error instanceof Error ? error.message : ''}
        </Alert>
      )}
      {!loading && e && <Conteudo e={e} cargo={cargo} />}
    </>
  );
}
