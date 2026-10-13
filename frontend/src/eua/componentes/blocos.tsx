import { useMemo, useState } from 'react';
import { Box, Chip, Grid, Link, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { Link as RouterLink } from 'react-router';
import { BarList, ColumnChart, StatTile } from '@/components/charts/charts';
import type { Financas, GastosMembro, VotacaoResumo, VotosMembro } from '../api';
import { CATEGORIAS_GASTO, dataBr, dataHoraBrasilia, dolar, dolarCompacto, pct, resultadoPt, rotuloVoto, trimestre } from '../formato';

/** Finanças de campanha declaradas à FEC: só totais, como publicados. */
export function BlocoFinancas({ f }: { f: Financas }) {
  const itens: [string, number | null, string][] = [
    ['Receitas no ciclo', f.receitas, 'Tudo o que entrou na campanha principal no ciclo de 2 anos.'],
    ['Despesas no ciclo', f.despesas, 'Tudo o que saiu, inclusive repasses.'],
    ['Caixa no fim do período', f.caixa, 'Saldo declarado na data de cobertura.'],
    ['Dívidas declaradas', f.dividas, 'Dívidas da campanha na data de cobertura.'],
  ];
  const origens = [
    { label: 'Pessoas físicas (total)', value: f.pessoas_fisicas ?? 0 },
    { label: 'Outros comitês (PACs)', value: f.outros_comites ?? 0 },
    { label: 'Partido', value: f.partido ?? 0 },
    { label: 'Recursos próprios', value: f.proprio ?? 0 },
    { label: 'Empréstimos do(a) candidato(a)', value: f.emprestimos_proprios ?? 0 },
  ].filter((o) => o.value > 0);
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        {itens.map(([rotulo, v, dica]) => (
          <Grid key={rotulo} size={{ xs: 6, md: 3 }}>
            <StatTile label={rotulo} value={dolarCompacto(v)} foot={dica} />
          </Grid>
        ))}
      </Grid>
      {origens.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            De onde veio o dinheiro (totais declarados)
          </Typography>
          <BarList data={origens} format={dolarCompacto} />
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">
        Valores declarados até {dataBr(f.ate)}. A FEC publica os totais; os nomes de doadores pessoas físicas não são reproduzidos aqui (a lei
        americana proíbe usá-los para pedir doações ou para fins comerciais).
      </Typography>
    </Stack>
  );
}

/** Gastos do gabinete na Câmara (Statement of Disbursements), por ano e trimestre. */
export function BlocoGastos({ g }: { g: GastosMembro }) {
  const anos = Object.keys(g.anos).sort().reverse();
  const [ano, setAno] = useState(anos[0]);
  const atual = g.anos[ano];
  return (
    <Stack spacing={2}>
      <ToggleButtonGroup size="small" exclusive value={ano} onChange={(_, v: string | null) => v && setAno(v)}>
        {anos.map((a) => (
          <ToggleButton key={a} value={a}>
            {a}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {atual && (
        <>
          <Typography variant="h5" component="p">
            {dolar(atual.total)}{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              gastos pelo gabinete em {ano} (acumulado publicado)
            </Typography>
          </Typography>
          <BarList
            data={Object.entries(atual.categorias)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ label: CATEGORIAS_GASTO[k] ?? k, value: v }))}
            format={dolarCompacto}
          />
        </>
      )}
      {g.trimestres.length > 1 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Gasto em cada trimestre
          </Typography>
          <ColumnChart data={g.trimestres.map((t) => ({ label: trimestre(t.trimestre), value: t.total }))} format={dolarCompacto} />
        </Box>
      )}
    </Stack>
  );
}

const COR_VOTO: Record<string, 'default' | 'primary' | 'secondary'> = { S: 'primary', N: 'secondary', P: 'default', A: 'default' };

export function ChipVoto({ c }: { c: string }) {
  return <Chip size="small" label={rotuloVoto(c)} color={COR_VOTO[c] ?? 'default'} variant={c === 'S' || c === 'N' ? 'filled' : 'outlined'} />;
}

/** Linha de uma votação: data, pergunta, proposição, resultado e (opcional) o voto de alguém. */
export function LinhaVotacao({ v, voto }: { v: VotacaoResumo; voto?: string }) {
  const placar = ['S', 'N', 'P', 'A']
    .map((k) => (v.placar[k as 'S'] ? `${rotuloVoto(k)}: ${v.placar[k as 'S']}` : null))
    .filter(Boolean)
    .join(' · ');
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {dataHoraBrasilia(v.data)} (Brasília) · votação nº {v.n}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <Link component={RouterLink} to={`/eua/votacoes/${v.id}`} underline="hover" color="inherit">
              {v.descricao || v.pergunta || 'Votação'}
            </Link>
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {v.pergunta}
            {v.proposicao ? ` · ${v.proposicao}` : ''} · <strong>{resultadoPt(v.resultado)}</strong>
            {v.resultado && resultadoPt(v.resultado) !== v.resultado ? ` (${v.resultado})` : ''}
            {placar ? ` · ${placar}` : ''}
          </Typography>
        </Box>
        {voto && <ChipVoto c={voto} />}
      </Stack>
    </Box>
  );
}

/** Participação e votos de um parlamentar, com o catálogo da casa para os detalhes. */
export function BlocoVotos({ votos, catalogo }: { votos: VotosMembro; catalogo: Map<string, VotacaoResumo> }) {
  const [filtro, setFiltro] = useState<'todos' | 'S' | 'N' | 'A'>('todos');
  const itens = useMemo(() => votos.itens.filter((i) => filtro === 'todos' || (filtro === 'A' ? i.voto === 'A' : i.voto === filtro)), [votos, filtro]);
  const [limite, setLimite] = useState(20);
  const c = votos.contagem;
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Participação" value={pct(votos.pct_participou)} foot={`${votos.participou} de ${votos.total} votações em que estava em exercício`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Votou Sim" value={c.S} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Votou Não" value={c.N} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Não votou" value={c.A} foot={c.P ? `e ${c.P} "presente"` : undefined} />
        </Grid>
      </Grid>
      <ToggleButtonGroup size="small" exclusive value={filtro} onChange={(_, v) => v && setFiltro(v)}>
        <ToggleButton value="todos">Todas</ToggleButton>
        <ToggleButton value="S">Sim</ToggleButton>
        <ToggleButton value="N">Não</ToggleButton>
        <ToggleButton value="A">Não votou</ToggleButton>
      </ToggleButtonGroup>
      <Box>
        {itens.slice(0, limite).map((i) => {
          const v = catalogo.get(i.id);
          return v ? <LinhaVotacao key={i.id} v={v} voto={i.voto} /> : null;
        })}
        {itens.length > limite && (
          <Link component="button" variant="body2" onClick={() => setLimite((l) => l + 40)} sx={{ mt: 1 }}>
            Mostrar mais ({itens.length - limite})
          </Link>
        )}
        {!itens.length && (
          <Typography variant="body2" color="text.secondary">
            Nenhuma votação com esse filtro.
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        As {votos.itens.length} votações mais recentes (o resumo conta todas). "Presente" é a resposta registrada sem votar sim ou não; nas
        chamadas de quórum é a única opção. Resultado exibido como publicado, com a tradução ao lado.
      </Typography>
    </Stack>
  );
}

export function LinkExterno({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
      {children} <OpenInNewRounded sx={{ fontSize: 14 }} />
    </Link>
  );
}

