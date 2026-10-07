import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AccountBalanceRounded from '@mui/icons-material/AccountBalanceRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { BarList, StatTile } from '@/components/charts/charts';
import {
  ABA_CASA,
  alinhar,
  barrasPercentuais,
  CASAS_PERFIL,
  contagemDe,
  escalaComum,
  fracao,
  pontosPercentuais,
  rotuloContagem,
} from '@/components/congresso/perfil';
import { ORDEM_FAIXA_ETARIA, ORDEM_INSTRUCAO } from '@/components/numeros/numeros';
import { data, DataError } from '@/data/api';
import { dateTime, NAO_INFORMADO, number, percent } from '@/data/format';
import type { CasaPerfil, ContagemPerfil, PerfilEleitos, PerfilGrupo, RenovacaoPerfil } from '@/data/types';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '../PageHeader';

type Visao = 'eleitos' | 'completo';
type Grupo = PerfilGrupo & { renovacao?: RenovacaoPerfil };

/** Aba do plenário com os eleitos da mesma Casa. */
const PLENARIO: Record<CasaPerfil, string> = {
  camara: '/plenario?composicao=eleitos',
  senado: '/plenario?casa=senado&composicao=eleitos',
  assembleias: '/plenario?casa=assembleia&composicao=eleitos',
};

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: ReactNode; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" component="h2">
          {titulo}
        </Typography>
        {descricao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {descricao}
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

/** Cabeçalho de cada coluna: "Eleitos em 2022 · 513 no total". */
function Coluna({ titulo, total, children }: { titulo: string; total: number; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        {titulo}{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          · {number(total)} no total
        </Typography>
      </Typography>
      {children}
    </Box>
  );
}

/** Os dois anos lado a lado (empilhados no celular), na mesma régua de porcentagem. */
function LadoALado({
  antes,
  depois,
  rotulos,
  ordem,
  alinhado = true,
  labelWidth,
}: {
  antes: { lista: ContagemPerfil[]; total: number };
  depois: { lista: ContagemPerfil[]; total: number };
  rotulos: [string, string];
  ordem?: string[];
  /** false nas ocupações: cada ano tem as suas 10 mais frequentes. */
  alinhado?: boolean;
  labelWidth?: Record<string, string>;
}) {
  const linhas = alinhado ? alinhar(antes.lista, depois.lista, ordem) : null;
  const a = barrasPercentuais(linhas ? linhas.map((l) => ({ nome: l.nome, n: l.antes })) : antes.lista, antes.total);
  const d = barrasPercentuais(linhas ? linhas.map((l) => ({ nome: l.nome, n: l.depois })) : depois.lista, depois.total);
  const max = escalaComum(a, d);
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Coluna titulo={rotulos[0]} total={antes.total}>
          <BarList data={a} max={max} format={percent} labelWidth={labelWidth} />
        </Coluna>
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <Coluna titulo={rotulos[1]} total={depois.total}>
          <BarList data={d} max={max} format={percent} labelWidth={labelWidth} />
        </Coluna>
      </Grid>
    </Grid>
  );
}

function Renovacao({ antes, depois, rotulos }: { antes: Grupo; depois: Grupo; rotulos: [string, string] }) {
  const barras = (g: Grupo) =>
    barrasPercentuais(
      [
        { nome: 'Reeleitos', n: g.renovacao?.reeleitos ?? 0 },
        { nome: 'Novos na Casa', n: g.renovacao?.novos ?? 0 },
      ],
      g.total,
    );
  const a = barras(antes);
  const d = barras(depois);
  const max = escalaComum(a, d);
  const declarou = (g: Grupo) =>
    g.renovacao?.declararam_reeleicao != null ? (
      <>Declararam ao TSE que concorriam à reeleição: {rotuloContagem(g.renovacao.declararam_reeleicao, g.total)}</>
    ) : (
      <>O TSE ainda não publicou quem declarou concorrer à reeleição neste ano.</>
    );
  return (
    <Bloco
      titulo="Renovação"
      descricao="Reeleito é quem já tinha sido eleito para a mesma Casa, pelo mesmo estado, na eleição anterior (no Senado, em qualquer das duas anteriores, porque o mandato é de 8 anos). O critério é o mesmo nos dois anos. Quem foi parlamentar em outra Casa, em mandatos mais antigos ou como suplente conta como novo."
    >
      <Grid container spacing={3}>
        {(
          [
            [rotulos[0], antes, a],
            [rotulos[1], depois, d],
          ] as const
        ).map(([rotulo, g, barrasAno]) => (
          <Grid key={rotulo} size={{ xs: 12, sm: 6 }}>
            <Coluna titulo={rotulo} total={g.total}>
              <BarList data={barrasAno} max={max} format={percent} />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                {declarou(g)}
              </Typography>
            </Coluna>
          </Grid>
        ))}
      </Grid>
    </Bloco>
  );
}

function Fontes({ p }: { p: PerfilEleitos }) {
  return (
    <Bloco titulo="Como contamos">
      <Stack spacing={1.5}>
        <Typography variant="body2">
          Eleitos são as candidaturas com a situação “Eleito”, “Eleito por QP” ou “Eleito por média” nos arquivos de candidaturas do TSE, só na eleição
          geral ordinária. Gênero, cor/raça, grau de instrução e ocupação são os declarados no registro da candidatura, com os nomes usados pelo TSE.
        </Typography>
        <Typography variant="body2">
          A idade é a de cada eleito no dia da posse, 1º de fevereiro do ano seguinte à eleição, calculada pela data de nascimento informada ao TSE. As
          datas de nascimento não são publicadas aqui, nem nomes: esta página só mostra contagens.
        </Typography>
        <Typography variant="body2">
          A pessoa reeleita é reconhecida pelo nome completo, nome social ou nome de urna, dentro da mesma Casa e do mesmo estado, nos arquivos do TSE
          das eleições anteriores. Nas Assembleias, a Câmara Legislativa do Distrito Federal está somada às 26 Assembleias Legislativas.
        </Typography>
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {p.fontes.map((f) => (
            <Stack component="li" key={f.url} direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
              <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
              <Typography variant="caption" component="p" color="text.secondary" sx={{ m: 0 }}>
                TSE · {f.nome}
                {f.publicado_em ? ` · arquivo de ${dateTime(f.publicado_em)}` : ''} ·{' '}
                <Link href={f.url} target="_blank" rel="noopener noreferrer">
                  arquivo oficial <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
                </Link>{' '}
                ·{' '}
                <Link href={f.pagina} target="_blank" rel="noopener noreferrer">
                  dados abertos <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
                </Link>
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Atualizado em {dateTime(p.gerado_em)}.
        </Typography>
      </Stack>
    </Bloco>
  );
}

function Conteudo({ p, casa, visao, onVisao }: { p: PerfilEleitos; casa: CasaPerfil; visao: Visao; onVisao: (v: Visao) => void }) {
  const c = p.casas[casa];
  const anoA = String(p.comparacao);
  const anoD = String(p.eleicao);
  const completo = casa === 'senado' && visao === 'completo' && c.composicao != null;
  const antes: Grupo = completo ? c.composicao![anoA] : c.anos[anoA];
  const depois: Grupo = completo ? c.composicao![anoD] : c.anos[anoD];
  if (!antes || !depois) {
    return <Alert severity="info">Ainda não há dados desta Casa.</Alert>;
  }
  // Senado inteiro: legislaturas (eleitos 4 anos antes + eleitos no ano); senão, a eleição.
  const rotulos: [string, string] = completo
    ? [`A partir de ${Number(anoA) + 1}`, `A partir de ${Number(anoD) + 1}`]
    : [`Eleitos em ${anoA}`, `Eleitos em ${anoD}`];

  const fA = fracao(contagemDe(antes.genero, 'Feminino'), antes.total);
  const fD = fracao(contagemDe(depois.genero, 'Feminino'), depois.total);
  const rA = antes.renovacao ? fracao(antes.renovacao.reeleitos, antes.total) : null;
  const rD = depois.renovacao ? fracao(depois.renovacao.reeleitos, depois.total) : null;
  const anos = (g: Grupo) => (g.idade_mediana != null ? `${number(g.idade_mediana)} anos` : NAO_INFORMADO);
  const variacao = (a: number | null, d: number | null) => {
    const pp = pontosPercentuais(a, d);
    return pp ? ` (${pp})` : '';
  };

  return (
    <Stack spacing={3}>
      {!c.completo && (
        <Alert severity="warning">A totalização do TSE ainda não terminou em todos os estados: os números desta Casa podem mudar.</Alert>
      )}

      {casa === 'senado' && (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            O Senado renova um terço das cadeiras (27) e dois terços (54) em eleições alternadas: por isso em 2022 foram eleitos 27 senadores e em 2026,
            54. As porcentagens permitem comparar grupos de tamanhos diferentes. O Senado completo soma os eleitos na eleição com os eleitos 4 anos antes,
            que continuam no mandato (titulares eleitos; suplentes em exercício não entram).
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={visao} onChange={(_, v: Visao | null) => v && onVisao(v)} aria-label="O que comparar no Senado">
            <ToggleButton value="eleitos">Eleitos em cada eleição</ToggleButton>
            <ToggleButton value="completo">Senado completo</ToggleButton>
          </ToggleButtonGroup>
          {completo && (antes.total < antes.vagas || depois.total < depois.vagas) && (
            <Typography variant="caption" color="text.secondary">
              Quando o eleito perdeu o mandato e a vaga foi preenchida em eleição suplementar, ela não entra na soma: por isso o total pode ser menor que 81.
            </Typography>
          )}
        </Stack>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label={completo ? 'Senadores' : 'Eleitos'} value={number(depois.total)} foot={`${rotulos[0]}: ${number(antes.total)}`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Mulheres" value={percent(fD)} foot={`${rotulos[0]}: ${percent(fA)}${variacao(fA, fD)}`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Idade mediana na posse" value={anos(depois)} foot={`${rotulos[0]}: ${anos(antes)}`} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          {completo ? (
            <StatTile label="Com curso superior completo" value={percent(fracao(contagemDe(depois.instrucao, 'Superior completo'), depois.total))} foot={`${rotulos[0]}: ${percent(fracao(contagemDe(antes.instrucao, 'Superior completo'), antes.total))}`} />
          ) : (
            <StatTile label="Reeleitos" value={percent(rD)} foot={`${rotulos[0]}: ${percent(rA)}${variacao(rA, rD)}`} />
          )}
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Bloco titulo="Gênero" descricao="Conforme declarado ao TSE.">
            <LadoALado antes={{ lista: antes.genero, total: antes.total }} depois={{ lista: depois.genero, total: depois.total }} rotulos={rotulos} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Bloco titulo="Cor/raça" descricao="Autodeclaração feita no registro da candidatura.">
            <LadoALado antes={{ lista: antes.cor_raca, total: antes.total }} depois={{ lista: depois.cor_raca, total: depois.total }} rotulos={rotulos} />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Bloco titulo="Faixa etária" descricao="Idade em anos completos no dia da posse.">
            <LadoALado
              antes={{ lista: antes.faixa_etaria, total: antes.total }}
              depois={{ lista: depois.faixa_etaria, total: depois.total }}
              rotulos={rotulos}
              ordem={ORDEM_FAIXA_ETARIA}
            />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Bloco titulo="Grau de instrução" descricao="Do menor ao maior grau declarado.">
            <LadoALado
              antes={{ lista: antes.instrucao, total: antes.total }}
              depois={{ lista: depois.instrucao, total: depois.total }}
              rotulos={rotulos}
              ordem={ORDEM_INSTRUCAO}
              labelWidth={{ xs: '50%', sm: '46%' }}
            />
          </Bloco>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Bloco
            titulo="Ocupações mais frequentes"
            descricao="As 10 ocupações mais declaradas em cada ano, com o nome usado pelo TSE (“Deputado” e “Senador” são ocupações declaradas por quem já tinha mandato; “Outros” é uma categoria do próprio TSE)."
          >
            <LadoALado
              antes={{ lista: antes.ocupacoes, total: antes.total }}
              depois={{ lista: depois.ocupacoes, total: depois.total }}
              rotulos={rotulos}
              alinhado={false}
              labelWidth={{ xs: '50%', sm: '46%' }}
            />
          </Bloco>
        </Grid>
      </Grid>

      {!completo && <Renovacao antes={antes} depois={depois} rotulos={rotulos} />}

      <Box>
        <Button component={RouterLink} to={PLENARIO[casa]} variant="outlined" startIcon={<AccountBalanceRounded />}>
          Ver os eleitos no plenário
        </Button>
      </Box>

      <Fontes p={p} />
    </Stack>
  );
}

function Esqueleto() {
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
          <Grid key={i} size={{ xs: 12, lg: 6 }}>
            <Skeleton variant="rounded" height={260} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export function CongressoEleitoPage() {
  const { data: p, error, loading, reload } = useAsync(() => data.perfilEleitos(), []);
  const [sp, setSp] = useSearchParams();
  const param = sp.get('casa') as CasaPerfil | null;
  const casa: CasaPerfil = param && CASAS_PERFIL.includes(param) ? param : 'camara';
  const visao: Visao = sp.get('senado') === 'completo' ? 'completo' : 'eleitos';

  return (
    <>
      <PageHeader
        title="Perfil do Congresso eleito"
        subtitle="Quem foi eleito em 2026 para a Câmara dos Deputados, o Senado e as Assembleias Legislativas, comparado com a eleição de 2022: gênero, idade, cor/raça, instrução, ocupação e renovação. Contagens oficiais do TSE, sem interpretação."
      />
      <Tabs
        value={casa}
        onChange={(_, v: CasaPerfil) => setSp(v === 'camara' ? {} : { casa: v }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label="Casa legislativa"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {CASAS_PERFIL.map((c) => (
          <Tab key={c} value={c} label={ABA_CASA[c]} />
        ))}
      </Tabs>
      {loading && <Esqueleto />}
      {!loading && error != null && (
        error instanceof DataError && error.status === 404 ? (
          <Alert severity="info">O perfil dos eleitos ainda não foi publicado. Ele é atualizado automaticamente a partir dos dados abertos do TSE.</Alert>
        ) : (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={reload}>
                Tentar de novo
              </Button>
            }
          >
            Não foi possível carregar o perfil dos eleitos. {error instanceof Error ? error.message : ''}
          </Alert>
        )
      )}
      {!loading && p && (
        <Conteudo p={p} casa={casa} visao={visao} onVisao={(v) => setSp(v === 'completo' ? { casa: 'senado', senado: 'completo' } : { casa: 'senado' }, { replace: true })} />
      )}
    </>
  );
}
