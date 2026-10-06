import type { ReactNode } from 'react';
import { Alert, Box, Card, CardContent, Divider, Grid, Link, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { FonteDetalhe } from '@/components/election/SourceNote';
import { FAISCA_REPO_URL } from '@/config/brand';
import { env } from '@/config/env';
import { dateTime } from '@/data/format';
import { useMeta } from '@/data/MetaContext';
import { PageHeader } from '@/pages/PageHeader';

function Bloco({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card component="section">
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        <Stack spacing={1.25} sx={{ '& li': { mb: 0.75 } }}>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SobrePage() {
  const { meta } = useMeta();
  const fontes = meta?.fontes ?? [];
  const porOrgao = fontes.reduce<Record<string, typeof fontes>>((acc, f) => {
    (acc[f.orgao] ??= []).push(f);
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Fontes e método"
        subtitle="De onde vem cada número, como ele é tratado e o que este site não faz."
      />
      <Stack spacing={3}>
        <Alert severity="info">
          Este site é uma ferramenta de transparência: só reúne, organiza e exibe dados publicados por órgãos públicos
          oficiais. Em caso de divergência, vale sempre a fonte oficial, indicada em cada bloco de informação.
        </Alert>

        <Bloco title="Compromisso de neutralidade">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>Nenhuma opinião, nota, adjetivo ou recomendação de voto.</li>
            {env.enablePesquisas && (
              <li>Pesquisas eleitorais: só as registradas no TSE, transcritas como divulgadas pelos institutos, com todas as informações exigidas por lei (instituto, contratante, registro, período, amostra, margem de erro e confiança). Sem média, projeção ou agregação própria.</li>
            )}
            <li>Todas as candidaturas têm a mesma página, com os mesmos campos, na mesma ordem e com o mesmo destaque.</li>
            <li>Listas em ordem alfabética do nome de urna. Outras ordenações (por bens, arrecadação, gastos) só quando você escolhe.</li>
            <li>Nenhuma cor associada a partidos. Gráficos que comparam pessoas usam uma única cor neutra; cores diferentes aparecem só para categorias (como fonte de recursos).</li>
            <li>Dados ausentes aparecem como “Não informado”, nunca estimados.</li>
            <li>Valores são exibidos como publicados (inclusive possíveis erros de digitação das próprias declarações).</li>
            <li>Nenhuma inteligência artificial é usada para resumir, ordenar, classificar ou recomendar candidaturas. Planos de governo aparecem só no PDF original.</li>
            <li>Sem enquetes, sem listas de “mais vistos” e sem rastreamento de quem visita.</li>
          </Box>
        </Bloco>

        <Bloco title="Filtro opcional “chapas com 5+ parlamentares”">
          <Typography variant="body2">
            As listas de Presidente, Governador e Senado mostram sempre todas as candidaturas na urna. Há um filtro
            opcional que restringe a lista às chapas que somam pelo menos 5 deputados e senadores em exercício, contando
            todos os partidos da chapa (partido, federação e coligação). Ele é inspirado no art. 46 da Lei 9.504/1997
            (debates de rádio e TV), mas usa a composição oficial da Câmara e do Senado na data da coleta, não a data de
            referência da lei. Por isso não é a lista oficial de convidados para debates, nem pesquisa ou juízo de
            relevância.
          </Typography>
        </Bloco>

        <Bloco title="Como cada informação é calculada">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li><strong>Situação do registro e presença na urna:</strong> campos oficiais do TSE (deferido, indeferido, com recurso, renúncia etc.).</li>
            <li><strong>Idade:</strong> calculada na data do 1º turno (4/10/2026) a partir da data de nascimento publicada pelo TSE.</li>
            <li><strong>Patrimônio:</strong> soma dos itens da declaração de bens de 2026. A comparação com 2022 só aparece quando a mesma pessoa foi candidata em 2022, ligação feita pelo próprio TSE no histórico de candidaturas. A variação é nominal (sem inflação).</li>
            <li><strong>Campanha:</strong> receitas e despesas contratadas declaradas na prestação de contas. São dados parciais até a prestação final; em chapas, a movimentação costuma ficar com a candidatura titular. Linhas idênticas em todos os campos repetidas no arquivo do TSE são contadas uma vez, e linhas-modelo vazias são descartadas. Nos totais por cargo, repasses entre candidaturas não entram, para não contar o mesmo dinheiro duas vezes.</li>
            <li><strong>Situação do registro:</strong> usa o campo de situação do julgamento publicado pelo TSE. Quando uma candidatura substituída e a substituta aparecem com o mesmo número na urna, os votos são atribuídos à substituta.</li>
            <li><strong>Dados pessoais de terceiros:</strong> CPFs, placas de veículos e números de contas bancárias que aparecem nas descrições de bens são mascarados.</li>
            <li><strong>Trajetória:</strong> candidaturas desde 2004 e resultado final, conforme o histórico do TSE. Quando a base não traz o resultado de um turno, isso é dito explicitamente.</li>
            <li><strong>Mandato atual e cota parlamentar:</strong> o vínculo entre parlamentar e candidatura usa o CPF publicado pela Câmara e pelo TSE (deputados) ou o nome civil completo (senadores, pois o Senado não publica CPF). O CPF nunca é exibido.</li>
            <li><strong>Apuração (resultados):</strong> lida ao vivo, no seu navegador, do servidor oficial de divulgação do TSE (resultados.tse.jus.br, arquivo unificado de cada cargo e estado), a cada minuto, a partir das 17h de Brasília do dia da votação. Percentuais sobre os votos válidos, exatamente como publicados; a lista vem em ordem de votos (padrão de qualquer apuração) ou alfabética, à sua escolha. No mapa de Presidente, a cor indica quem lidera em cada estado, com cores atribuídas em ordem alfabética e sem relação com partidos; no de Governador, a situação da disputa. Para mostrar o seu estado, o site pode usar a localização do aparelho, convertida em UF no próprio aparelho com a malha do IBGE, sem enviá-la a ninguém.</li>
            <li><strong>Supremo Tribunal Federal:</strong> composição plenária atual, Presidência e datas de cada ministro (indicação, nomeação, posse) vêm do portal e das pastas da Biblioteca do STF; a remuneração mês a mês, com as parcelas (A) a (S) da Resolução CNJ 215/2015, vem da página de remuneração da Gestão de Pessoas do STF; diárias e passagens vêm do painel de transparência do STF (desde 2016). Quem nomeou cada ministro é o Presidente da República em exercício na data do decreto de nomeação (Constituição, art. 101). Só ministros, nunca servidores, e sem CPF. A coleta roda sozinha na nuvem: a cada 6 horas enquanto houver cadeira vaga ou no início do mês (folha nova), e uma vez por dia no resto do tempo.</li>
            <li><strong>Gastos de mandato:</strong> valores líquidos reembolsados pela cota parlamentar (CEAP/CEAPS) desde fevereiro de 2023 (57ª legislatura). A comparação justa é com colegas da mesma casa e do mesmo estado, porque o teto varia por UF.</li>
          </Box>
        </Bloco>

        <Bloco title="Limitações conhecidas">
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            <li>Os arquivos anuais da Câmara não trazem as passagens aéreas emitidas pelo sistema SIGEPA a partir de agosto de 2025: os totais de deputados em 2025 e 2026 aparecem menores do que no painel da Câmara. Por isso o ranking abre em 2024 e oferece a opção de excluir passagens aéreas.</li>
            <li>Gastos de deputados estaduais, governadores e presidente não estão incluídos: não há uma base aberta e padronizada única para todas as assembleias e governos.</li>
            <li>O Senado não publica, em formato aberto, o teto mensal da cota por UF.</li>
            <li>Bens e ocupação são autodeclarados pelas candidaturas.</li>
            <li>A prestação de contas de campanha é atualizada pelas campanhas ao longo da eleição.</li>
          </Box>
        </Bloco>

        <Bloco title="Atualização">
          {meta ? (
            <Grid container spacing={2}>
              {[
                ['Base de candidaturas do TSE gerada em', meta.atualizacao.tse_gerado_em],
                ['Coleta da base do TSE', meta.atualizacao.tse_coletado_em],
                ['Arquivo de prestação de contas gerado em', meta.atualizacao.prestacao_gerada_em],
                ['Coleta de dados da Câmara e do Senado', meta.atualizacao.parlamentares_coletado_em],
                ['Última consulta à apuração do TSE', meta.atualizacao.resultados_consultado_em],
              ].map(([k, v]) => (
                <Grid key={k} size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {k}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {dateTime(v)}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Skeleton height={80} />
          )}
        </Bloco>

        <Card component="section">
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
              Todas as fontes oficiais usadas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Para cada arquivo: quem publica, o que contém, link direto para o arquivo oficial e as datas de geração,
              publicação e coleta.
            </Typography>
            {!meta && <Skeleton variant="rounded" height={200} />}
            <Stack spacing={3}>
              {Object.entries(porOrgao).map(([orgao, lista]) => (
                <Box key={orgao}>
                  <Typography variant="overline" color="primary">
                    {orgao}
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    {lista.map((f) => (
                      <Grid key={f.chave} size={{ xs: 12, md: 6 }}>
                        <Box sx={{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                          <FonteDetalhe fonte={f} />
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Bloco title="Privacidade">
          <Typography variant="body2">
            O site e o aplicativo não usam login, cookies de rastreamento nem coletam dados pessoais. A sua cola de
            votação e a lista de comparação ficam salvas apenas no seu aparelho. Detalhes na{' '}
            <Link component={RouterLink} to="/privacidade">
              Política de Privacidade
            </Link>{' '}
            e nos{' '}
            <Link component={RouterLink} to="/termos">
              Termos de Uso
            </Link>
            .
          </Typography>
        </Bloco>

        <Divider />
        <Typography variant="caption" color="text.secondary">
          Interface construída a partir do template{' '}
          <Link href={FAISCA_REPO_URL} target="_blank" rel="noopener noreferrer">
            Faísca
          </Link>{' '}
          de Rodrigo Bossini.
        </Typography>
      </Stack>
    </>
  );
}
