import type { ReactNode } from 'react';
import { Alert, Box, Card, CardContent, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { PageHeader } from '@/pages/PageHeader';
import { useAsync } from '@/hooks/useAsync';
import { eua } from '../api';
import { LinkExterno } from '../componentes/blocos';
import { Carregando } from '../componentes/comuns';
import { dataHoraBrasilia } from '../formato';

function Secao({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <Card variant="outlined" id={id}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
          {titulo}
        </Typography>
        <Stack spacing={1.5}>{children}</Stack>
      </CardContent>
    </Card>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Typography variant="body2">{children}</Typography>;
}

function Lei({ nome, href, children }: { nome: string; href: string; children: ReactNode }) {
  return (
    <Box component="li" sx={{ mb: 1.25 }}>
      <Typography variant="body2">
        <LinkExterno href={href}>{nome}</LinkExterno>: {children}
      </Typography>
    </Box>
  );
}

const PARTES: Record<string, string> = {
  congresso: 'Composição do Congresso e retratos',
  votacoes: 'Votações nominais',
  fec: 'Candidaturas e finanças de campanha (FEC)',
  gastos_camara: 'Gastos dos gabinetes da Câmara',
  gastos_federal: 'Gasto federal por estado (USAspending)',
  eleicoes: 'Resultados, Colégio Eleitoral e calendário',
  suprema: 'Suprema Corte',
};

export function SobreEuaPage() {
  const fontes = useAsync(() => eua.fontes(), []);
  const meta = useAsync(() => eua.meta(), []);

  return (
    <>
      <PageHeader
        title="Fontes e base legal (EUA)"
        subtitle="De onde vem cada dado da parte americana do Tá na Urna, por que ele pode ser usado livremente e como mantemos tudo neutro e dentro da lei."
      />
      <Stack spacing={3}>
        <Secao titulo="O que esta parte do site é (e o que não é)">
          <P>
            Um serviço informativo, gratuito e não oficial, que reúne e organiza dados públicos publicados pelo próprio governo dos
            Estados Unidos (e duas compilações em domínio público feitas a partir deles). Não tem vínculo com o governo americano, com partidos ou com
            campanhas.
          </P>
          <P>
            <strong>Não pede voto, não faz propaganda e não apoia ninguém.</strong> Não recebe nem repassa dinheiro de campanha, não vende nem
            exibe anúncios, não impulsiona conteúdo pago, não faz enquetes, não publica pesquisas eleitorais nem projeções e não usa inteligência
            artificial para ordenar ou recomendar candidaturas.
          </P>
        </Secao>

        <Secao titulo="Como mantemos a neutralidade" id="neutralidade">
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Mesmos campos, mesmo formato e mesmo destaque para todas as pessoas; ordem alfabética por padrão (outras ordens só quando você escolhe).',
              'Nenhuma cor de partido: o vermelho e o azul associados aos partidos americanos não são usados. Mapas e gráficos usam a mesma escala neutra para todos.',
              'Resultados de eleição só depois de certificados pelos estados; nada de apuração parcial, projeções de emissoras ou "quem está na frente".',
              'Números exatamente como publicados pelo órgão oficial, com o arquivo de origem e a data da coleta em cada bloco ("Fonte").',
              'Textos oficiais em inglês (resultado de votação, resumo de decisão) aparecem como publicados, com a tradução ao lado quando ela é literal.',
              'Filtros só com critérios objetivos e opcionais (por exemplo, "candidaturas com receita declarada").',
            ].map((t) => (
              <Typography component="li" variant="body2" key={t} sx={{ mb: 0.75 }}>
                {t}
              </Typography>
            ))}
          </Box>
        </Secao>

        <Secao titulo="Por que estes dados podem ser usados livremente" id="base-legal">
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            <Lei nome="17 U.S.C. § 105 (Lei de Direitos Autorais dos EUA)" href="https://www.law.cornell.edu/uscode/text/17/105">
              obras do governo federal americano não têm proteção de direito autoral nos EUA. Vale para tudo o que coletamos de órgãos federais: Câmara
              (Clerk e Chief Administrative Officer), Senado, Biographical Directory do Congresso, Congress.gov, FEC, USAspending/Tesouro, Census
              Bureau, National Archives, Suprema Corte, Administrative Office of the U.S. Courts e USAGov.
            </Lei>
            <Lei nome="OPEN Government Data Act (Lei Pública 115-435, Título II, 2019)" href="https://www.congress.gov/bill/115th-congress/house-bill/4174">
              obriga os órgãos federais a publicar seus dados em formato aberto e legível por máquina, justamente para que qualquer pessoa os
              reutilize.
            </Lei>
            <Lei nome="Decisões judiciais (doutrina dos government edicts)" href="https://www.supremecourt.gov/opinions/19pdf/18-1150_7m58.pdf">
              decisões e opiniões de tribunais não podem ser objeto de direito autoral: Wheaton v. Peters (1834), Banks v. Manchester (1888) e
              Georgia v. Public.Resource.Org, 590 U.S. 255 (2020), decidido pela própria Suprema Corte.
            </Lei>
            <Lei nome="Fatos não têm dono: Feist Publications v. Rural Telephone, 499 U.S. 340 (1991)" href="https://www.law.cornell.edu/supremecourt/text/499/340">
              votos, valores, datas e resultados são fatos; nos EUA, fatos não são protegidos por direito autoral.
            </Lei>
            <Lei nome="CC0 1.0 (dedicação ao domínio público)" href="https://creativecommons.org/publicdomain/zero/1.0/deed.pt-br">
              licença das duas compilações não governamentais que usamos: congress-legislators (projeto @unitedstates) e os resultados eleitorais do
              MIT Election Data and Science Lab (Harvard Dataverse). Os autores abriram mão de todos os direitos, inclusive de exigir citação (que
              fazemos mesmo assim).
            </Lei>
            <Lei nome="Lei brasileira de Direitos Autorais (Lei 9.610/1998), art. 8º" href="https://www.planalto.gov.br/ccivil_03/leis/l9610.htm">
              aqui no Brasil também não são protegidos os textos de leis, decisões judiciais e demais atos oficiais (inciso IV) nem as informações de
              uso comum, como calendários e cadastros (inciso V).
            </Lei>
            <Lei nome="Lei Geral de Proteção de Dados (Lei 13.709/2018), art. 7º, §§ 3º e 4º" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm">
              os dados pessoais exibidos são de agentes públicos e candidaturas no exercício dessas funções, publicados pelos próprios órgãos oficiais
              para dar transparência, e são usados com essa mesma finalidade, de boa-fé e no interesse público.
            </Lei>
          </Box>
          <P>
            Retratos: vêm do Biographical Directory do Congresso (e, na falta dele, do Clerk ou do Congress.gov) e da coleção oficial da Suprema
            Corte, publicados por essas instituições como material oficial. Se alguém com direitos sobre um retrato discordar do uso, removemos.
          </P>
        </Secao>

        <Secao titulo="Regras que respeitamos de propósito" id="restricoes">
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            <Lei nome="52 U.S.C. § 30111(a)(4) e 11 CFR 104.15" href="https://www.law.cornell.edu/uscode/text/52/30111">
              informações de doadores copiadas da FEC não podem ser vendidas nem usadas para pedir doações ou para fins comerciais. Por isso{' '}
              <strong>não publicamos nenhum doador</strong>: só os totais de cada campanha. O endereço que a candidatura informa à FEC também fica de
              fora.
            </Lei>
            <Lei nome="52 U.S.C. § 30121 e 11 CFR 110.20 (estrangeiros e eleições americanas)" href="https://www.fec.gov/help-candidates-and-committees/foreign-nationals/">
              estrangeiros não podem doar nem gastar dinheiro para influenciar eleições americanas, nem dirigir essas decisões. O Tá na Urna não faz
              nada disso: não doa, não arrecada, não compra anúncios e não participa de campanhas. Publicar informação factual e neutra, igual para
              todos, não é doação nem gasto eleitoral.
            </Lei>
            <Lei nome="11 CFR 100.22 e 100.29 (propaganda eleitoral)" href="https://www.ecfr.gov/current/title-11/chapter-I/subchapter-A/part-100">
              não há "express advocacy" (pedir voto a favor ou contra alguém, com palavras como "vote em", "derrote", "eleja") nem "electioneering
              communication" (peça paga de rádio, TV ou satélite citando candidatura). Nenhum texto do site faz isso.
            </Lei>
            <Lei nome="18 U.S.C. § 713 e regras das instituições sobre selos oficiais" href="https://www.law.cornell.edu/uscode/text/18/713">
              não usamos selos, brasões nem logotipos oficiais (do governo, da Câmara, do Senado ou da Suprema Corte), para ninguém achar que o site é
              oficial.
            </Lei>
            <Lei nome="Declarações de bens (Ethics in Government Act, 5 U.S.C. § 13107)" href="https://www.law.cornell.edu/uscode/text/5/13107">
              as declarações financeiras de parlamentares e juízes têm limites de uso; não as reproduzimos, só indicamos onde o órgão as publica.
            </Lei>
          </Box>
          <P>
            Também não usamos cadastros de eleitores (voter files, controlados por cada estado), dados de eleitores, nomes de
            servidores das equipes dos gabinetes (que aparecem no detalhamento de gastos da Câmara) nem dados de sites que exigem cadastro ou aceite de
            termos. A coleta é automática e moderada, identificada como deste site, e só lê páginas e arquivos públicos.
          </P>
          <Alert severity="info" variant="outlined">
            Este resumo explica as regras em que o site se apoia e as escolhas feitas para cumpri-las. Não é parecer jurídico.
          </Alert>
        </Secao>

        <Secao titulo="Fontes usadas e situação da última coleta" id="fontes">
          {!fontes.data ? (
            <Carregando linhas={1} />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fonte</TableCell>
                    <TableCell>O que traz</TableCell>
                    <TableCell>Licença</TableCell>
                    <TableCell>Coleta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fontes.data.fontes.map((f) => (
                    <TableRow key={f.chave}>
                      <TableCell sx={{ verticalAlign: 'top', minWidth: 180 }}>
                        <LinkExterno href={f.pagina ?? f.url}>{f.nome}</LinkExterno>
                        <Typography variant="caption" color="text.secondary" component="p">
                          {f.orgao}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="body2">{f.descricao}</Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="caption">{f.licenca ?? '–'}</Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <Typography variant="caption">{dataHoraBrasilia(f.coletado_em)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {meta.data && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Última passada de cada parte
              </Typography>
              {Object.entries(meta.data.partes).map(([k, v]) => (
                <Typography key={k} variant="body2">
                  {PARTES[k] ?? k}: {v.ok ? `ok em ${dataHoraBrasilia(v.em)}` : `falhou na última tentativa (${dataHoraBrasilia(v.tentativa)}); os dados anteriores continuam no ar`}
                </Typography>
              ))}
            </Box>
          )}
        </Secao>

        <Secao titulo="Quando os dados são atualizados" id="agenda">
          <P>
            Tudo roda sozinho, na nuvem (GitHub Actions), nos momentos em que cada órgão costuma publicar. Cada passada só baixa o que mudou.
          </P>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Todos os dias, às 7h de Brasília: todas as fontes.',
              'Dias úteis, no fim da manhã de Washington (quando a Suprema Corte anuncia decisões, de outubro a julho): decisões e votações.',
              'Duas vezes por noite: votações nominais (fim das sessões do Congresso).',
              'De 3 a 30 de novembro dos anos pares (eleição geral) e de 1º a 10 de janeiro dos anos ímpares (posse do novo Congresso): composição, candidaturas e resultados a cada passada.',
              'Gastos da Câmara: a cada trimestre, cerca de 45 a 60 dias depois do fim do período. Resultados históricos: quando o MIT publica a eleição seguinte (meses depois da certificação).',
            ].map((t) => (
              <Typography component="li" variant="body2" key={t} sx={{ mb: 0.5 }}>
                {t}
              </Typography>
            ))}
          </Box>
        </Secao>

        <Secao titulo="Limitações conhecidas" id="limitacoes">
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            {[
              'Não há apuração nacional oficial nos EUA: na noite da eleição, o resultado está nos sites dos estados (links na página Eleições).',
              'A FEC não informa quem está na cédula; a lista de candidaturas inclui quem perdeu primárias ou desistiu.',
              'O Senado publica os gastos de gabinete só em PDF semestral, sem arquivo aberto.',
              'Governadores, legislativos estaduais e cargos locais ficam fora: cada estado publica os seus dados de um jeito.',
              'Nomes de comissões, perguntas de votação e resumos de decisões aparecem no original em inglês.',
              'Partido de cada parlamentar nas tabelas de votação: o da composição atual.',
            ].map((t) => (
              <Typography component="li" variant="body2" key={t} sx={{ mb: 0.5 }}>
                {t}
              </Typography>
            ))}
          </Box>
          <P>
            Encontrou algo diferente da fonte oficial? A fonte oficial sempre prevalece.{' '}
            <Link href="https://github.com/professorbossini/voto-informado/issues/new" target="_blank" rel="noopener noreferrer">
              Reportar erro ou divergência
            </Link>
            {' · '}
            <Link component={RouterLink} to="/privacidade">Política de Privacidade</Link>
            {' · '}
            <Link component={RouterLink} to="/termos">Termos de Uso</Link>
          </P>
        </Secao>
      </Stack>
    </>
  );
}
