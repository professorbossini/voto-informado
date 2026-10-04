import { Link } from '@mui/material';
import { LEGAL } from '@/config/legal';
import { Contato, LegalDoc, P, Secao } from './LegalDoc';

export function PrivacidadePage() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      resumo={
        <>
          <strong>Resumo:</strong> o {LEGAL.projeto} não pede cadastro e não coleta dados pessoais de quem usa. Sem
          anúncios, sem rastreamento, sem ferramentas de análise de audiência. O que você anota (como a sua cola) fica
          só no seu aparelho. A localização, se você permitir, serve só para achar o seu estado e não sai do aparelho.
        </>
      }
      outro={{ to: '/termos', label: 'Termos de Uso' }}
    >
      <Secao n={1} title="Quem é o responsável">
        <P>
          O {LEGAL.projeto} (site e aplicativos para celular) é um projeto independente, gratuito e sem anúncios, mantido
          por {LEGAL.responsavel}, pessoa física, que atua como controlador nos termos da Lei Geral de Proteção de Dados
          (Lei nº 13.709/2018, LGPD). Contato: <Contato />.
        </P>
      </Secao>

      <Secao n={2} title="Dados que NÃO coletamos">
        <P>Não pedimos nem recebemos:</P>
        <ul>
          <li>nome, e-mail, telefone, CPF, título de eleitor ou qualquer cadastro (não existe login);</li>
          <li>sua localização (veja abaixo como o site descobre o seu estado sem recebê-la), contatos, fotos, câmera, microfone ou arquivos do aparelho;</li>
          <li>identificadores de publicidade ou de dispositivo;</li>
          <li>dados de navegação para estatística, perfil ou publicidade: não usamos Google Analytics, Firebase Analytics, pixels, cookies de rastreamento nem ferramentas parecidas.</li>
        </ul>
        <P>
          Também não vendemos, alugamos nem compartilhamos dados com terceiros, simplesmente porque não os temos. Não
          perguntamos em quem você pretende votar e não sabemos quais candidaturas você consulta.
        </P>
      </Secao>

      <Secao n={3} title="Localização: só para descobrir o seu estado, no próprio aparelho">
        <P>
          Na apuração, o site pode perguntar se você permite o uso da localização, para já mostrar os resultados do seu
          estado. Se você permitir, o navegador informa a posição à própria página, que descobre a UF comparando-a com o
          mapa oficial do IBGE embutido no site. Esse cálculo acontece no seu aparelho: a posição não é enviada para nós
          nem para nenhum serviço de mapas, e é descartada em seguida. Fica guardada só a sigla do estado (por exemplo,
          “SP”). Se você não permitir, basta escolher o estado na lista. Você pode revogar a permissão nas configurações
          do navegador quando quiser.
        </P>
      </Secao>

      <Secao n={4} title="O que fica guardado só no seu aparelho">
        <P>Para sua conveniência, algumas escolhas ficam salvas no armazenamento local do navegador ou do aplicativo:</P>
        <ul>
          <li>a “Minha cola” (estado em que você vota e os números escolhidos);</li>
          <li>a lista de candidaturas que você pôs para comparar;</li>
          <li>o estado escolhido ou detectado para a apuração e as candidaturas que você marcou para acompanhar;</li>
          <li>a preferência de tema (claro ou escuro).</li>
        </ul>
        <P>
          Esses dados nunca são enviados para nós nem para ninguém. Para apagá-los, use o botão “Limpar” da cola, limpe os
          dados do site no navegador ou do aplicativo nas configurações do celular, ou desinstale o aplicativo.
        </P>
      </Secao>

      <Secao n={5} title="Conexão com a internet e hospedagem">
        <P>
          Para mostrar as informações, o site e o aplicativo baixam arquivos públicos (dados em JSON, fotos oficiais e
          planos de governo em PDF) do serviço de hospedagem, atualmente o {LEGAL.hospedagem.nome}. Como em qualquer
          acesso à internet, esse provedor recebe tecnicamente o endereço IP e informações básicas do navegador ou do
          aparelho e pode mantê-los em registros de segurança, conforme a{' '}
          <Link href={LEGAL.hospedagem.privacidade} target="_blank" rel="noopener noreferrer">
            política de privacidade dele
          </Link>
          . O responsável pelo {LEGAL.projeto} não recebe nem armazena esses registros.
        </P>
        <P>
          Os resultados da apuração são baixados diretamente do servidor oficial de divulgação do Tribunal Superior
          Eleitoral (resultados.tse.jus.br), sem passar por nós. Nesse acesso, o TSE recebe tecnicamente o endereço IP e
          informações básicas do navegador, como em qualquer visita ao site dele, conforme a política de privacidade do
          próprio Tribunal. Nenhuma informação sua é enviada junto.
        </P>
        <P>Toda a comunicação é criptografada (HTTPS).</P>
      </Secao>

      <Secao n={6} title="Aplicativo: permissões">
        <P>
          O aplicativo pede apenas acesso à internet, necessário para baixar os dados oficiais. Não pede acesso a
          localização, contatos, câmera, microfone, armazenamento de arquivos nem notificações. No aplicativo, o estado da
          apuração é escolhido na lista.
        </P>
        <P>
          Ao tocar em “Compartilhar”, o aplicativo abre a tela de compartilhamento do próprio sistema: o conteúdo vai só
          para o app que você escolher. Ao tocar em “Imprimir”, abre o serviço de impressão do sistema (que também permite
          salvar em PDF). Links para órgãos oficiais (TSE, Câmara, Senado) abrem no seu navegador e seguem as políticas
          desses sites.
        </P>
      </Secao>

      <Secao n={7} title="Dados das candidaturas e dos parlamentares">
        <P>
          As informações sobre candidaturas e mandatos (nome, foto, partido, bens declarados, contas de campanha, gastos
          de mandato etc.) são dados que a lei manda tornar públicos e que o Tribunal Superior Eleitoral, a Câmara dos
          Deputados e o Senado Federal publicam em seus portais oficiais de dados abertos. Elas são exibidas como
          publicadas, com a fonte indicada, para a finalidade de transparência e informação do eleitor, conforme o art. 7º,
          §§ 3º e 4º, da LGPD.
        </P>
        <P>
          Números de CPF e de título de eleitor que constam nos arquivos oficiais nunca são exibidos nem publicados. Se
          você for titular de algum desses dados e encontrar divergência com a fonte oficial, entre em contato: corrigimos
          para refletir a publicação oficial, que sempre prevalece.
        </P>
      </Secao>

      <Secao n={8} title="Crianças e adolescentes">
        <P>
          O conteúdo é voltado a eleitores, inclusive aos de 16 e 17 anos, e não é direcionado a crianças. Como não há
          coleta de dados pessoais, nenhum dado de criança ou adolescente é tratado.
        </P>
      </Secao>

      <Secao n={9} title="Seus direitos">
        <P>
          A LGPD (art. 18) garante, entre outros, os direitos de confirmação, acesso, correção e eliminação de dados
          pessoais. Como não guardamos dados de quem usa o {LEGAL.projeto}, normalmente não haverá nada a acessar ou
          apagar do nosso lado; ainda assim, qualquer pedido ou dúvida pode ser enviado para <Contato />. Você também pode
          procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
      </Secao>

      <Secao n={10} title="Mudanças nesta política">
        <P>
          Se algum recurso novo passar a tratar dados pessoais (por exemplo, um login opcional), esta política será
          atualizada antes, com nova data de versão no topo da página. Mudanças relevantes também serão avisadas no site e
          no aplicativo.
        </P>
      </Secao>
    </LegalDoc>
  );
}
