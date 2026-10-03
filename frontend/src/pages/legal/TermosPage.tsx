import { Link } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { FAISCA_REPO_URL } from '@/config/brand';
import { LEGAL } from '@/config/legal';
import { Contato, LegalDoc, P, Secao } from './LegalDoc';

export function TermosPage() {
  return (
    <LegalDoc
      title="Termos de Uso"
      resumo={
        <>
          <strong>Resumo:</strong> o {LEGAL.projeto} é gratuito, não é oficial e não tem vínculo com a Justiça Eleitoral,
          com o Congresso, com partidos ou com candidaturas. Ele só organiza dados públicos oficiais. Em caso de dúvida,
          vale sempre a fonte oficial.
        </>
      }
      outro={{ to: '/privacidade', label: 'Política de Privacidade' }}
    >
      <Secao n={1} title="Aceitação">
        <P>
          Ao usar o site ou os aplicativos do {LEGAL.projeto}, você concorda com estes Termos e com a{' '}
          <Link component={RouterLink} to="/privacidade">
            Política de Privacidade
          </Link>
          . Se não concordar, não use o serviço.
        </P>
      </Secao>

      <Secao n={2} title="O que é o serviço">
        <P>
          Uma ferramenta gratuita de transparência que reúne, organiza e exibe dados públicos publicados pelo Tribunal
          Superior Eleitoral (TSE), pela Câmara dos Deputados e pelo Senado Federal sobre as eleições de 2026 e sobre
          gastos de mandato.
        </P>
        <P>
          <strong>
            O {LEGAL.projeto} não é um serviço oficial e não tem nenhum vínculo com o TSE, com a Justiça Eleitoral, com a
            Câmara, com o Senado, com qualquer órgão de governo, partido, coligação, federação ou candidatura.
          </strong>{' '}
          Os sites oficiais estão indicados em cada bloco de informação e na página{' '}
          <Link component={RouterLink} to="/sobre">
            Fontes e método
          </Link>
          .
        </P>
      </Secao>

      <Secao n={3} title="Neutralidade">
        <P>
          O serviço não produz opinião, não apoia nem critica candidaturas ou partidos e não recomenda votos. Todas as
          candidaturas aparecem com os mesmos campos, na mesma ordem (alfabética) e com o mesmo destaque. Não é propaganda
          eleitoral, não tem anúncios e não usa inteligência artificial para resumir, ordenar ou recomendar candidaturas.
        </P>
      </Secao>

      <Secao n={4} title="Exatidão das informações">
        <ul>
          <li>Os dados são exibidos como publicados pelas fontes oficiais, inclusive com eventuais erros das próprias declarações.</li>
          <li>Pode haver atraso entre uma atualização oficial e a sua chegada aqui. Cada bloco informa a data da fonte e da coleta.</li>
          <li>Em qualquer divergência, prevalece a fonte oficial. Resultados oficiais de eleição são os divulgados pelo TSE.</li>
          <li>O “Simulador de urna” é educativo e não reproduz com exatidão a urna eletrônica nem substitui o simulador oficial do TSE.</li>
          <li>A “Minha cola” é uma anotação pessoal. Lembre-se: é proibido levar celular para a cabine de votação (Lei nº 9.504/1997, art. 91-A). Leve a cola impressa ou escrita à mão.</li>
        </ul>
      </Secao>

      <Secao n={5} title="Uso permitido">
        <P>Você pode usar, consultar e compartilhar livremente as páginas e links do serviço. Não é permitido:</P>
        <ul>
          <li>apresentar o {LEGAL.projeto} como serviço oficial ou como apoiador de qualquer candidatura;</li>
          <li>alterar dados e atribuí-los ao {LEGAL.projeto} ou às fontes oficiais;</li>
          <li>tentar prejudicar o funcionamento do serviço (por exemplo, com acessos automatizados em volume abusivo).</li>
        </ul>
        <P>
          Os dados vêm de portais de dados abertos e podem ser reutilizados conforme as regras de cada órgão. A interface
          foi construída com o template{' '}
          <Link href={FAISCA_REPO_URL} target="_blank" rel="noopener noreferrer">
            Faísca
          </Link>
          , de Rodrigo Bossini, sujeito à licença dele.
        </P>
      </Secao>

      <Secao n={6} title="Disponibilidade e responsabilidade">
        <P>
          O serviço é oferecido gratuitamente, “no estado em que se encontra”, e pode ficar fora do ar, mudar ou ser
          encerrado (por exemplo, ao fim do período eleitoral). Na medida permitida pela lei, o responsável não responde
          por decisões tomadas exclusivamente com base nas informações exibidas, por erros das fontes oficiais nem por
          indisponibilidade de sites de terceiros.
        </P>
      </Secao>

      <Secao n={7} title="Alterações destes Termos">
        <P>
          Estes Termos podem ser atualizados. A versão vigente fica sempre nesta página, com a data no topo.
        </P>
      </Secao>

      <Secao n={8} title="Lei aplicável e contato">
        <P>
          Estes Termos seguem as leis brasileiras. Dúvidas, pedidos de correção ou reclamações: <Contato />.
        </P>
      </Secao>
    </LegalDoc>
  );
}
