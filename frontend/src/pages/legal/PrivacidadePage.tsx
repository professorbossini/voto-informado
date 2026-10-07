import { Link } from '@mui/material';
import { LEGAL } from '@/config/legal';
import { Contato, LegalDoc, P, Secao } from './LegalDoc';

export function PrivacidadePage() {
  return (
    <LegalDoc
      title="Política de Privacidade"
      resumo={
        <>
          <strong>Resumo:</strong> o {LEGAL.projeto} funciona sem cadastro. Sem anúncios, sem rastreamento, sem
          ferramentas de análise de audiência. O que você anota (como a sua cola) fica no seu aparelho. Se você quiser,
          pode entrar com o Google para guardar suas escolhas: elas são criptografadas no seu aparelho com uma frase que
          só você conhece, e ninguém mais consegue lê-las. A localização, se você permitir, serve só para achar o seu
          estado e o seu município, e não sai do aparelho.
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
          <li>telefone, CPF, título de eleitor ou qualquer cadastro (o login com Google é opcional; veja o item 4);</li>
          <li>sua localização (veja abaixo como o site descobre o seu estado e o seu município sem recebê-la), contatos, fotos, câmera, microfone ou arquivos do aparelho;</li>
          <li>identificadores de publicidade ou de dispositivo;</li>
          <li>dados de navegação para estatística, perfil ou publicidade: não usamos Google Analytics, Firebase Analytics, pixels, cookies de rastreamento nem ferramentas parecidas.</li>
        </ul>
        <P>
          Também não vendemos, alugamos nem compartilhamos dados com terceiros. Não perguntamos em quem você pretende votar
          e não sabemos quais candidaturas você consulta ou acompanha, nem com login (as escolhas vão criptografadas).
        </P>
      </Secao>

      <Secao n={3} title="Localização: só para descobrir o seu estado e o seu município, no próprio aparelho">
        <P>
          Na apuração, o site pode perguntar se você permite o uso da localização, para já mostrar os resultados do seu
          estado. Se você permitir, o navegador informa a posição à própria página, que descobre a UF comparando-a com o
          mapa oficial do IBGE embutido no site. Esse cálculo acontece no seu aparelho: a posição não é enviada para nós
          nem para nenhum serviço de mapas, e é descartada em seguida. Fica guardada só a sigla do estado (por exemplo,
          “SP”). Se você não permitir, basta escolher o estado na lista. Você pode revogar a permissão nas configurações
          do navegador quando quiser.
        </P>
        <P>
          Do mesmo jeito, no plenário das Câmaras Municipais, o site pode usar a localização para abrir a Câmara do seu
          município: compara a posição com a malha municipal oficial do IBGE, publicada no próprio site, e o cálculo
          também acontece no seu aparelho. Fica guardado só o código do município. Sem localização, aparece São Paulo
          e você escolhe o seu na lista.
        </P>
      </Secao>

      <Secao n={4} title="Login opcional com Google e suas escolhas criptografadas">
        <P>
          Entrar é opcional e serve só para guardar suas escolhas (candidaturas que você acompanha, cola, comparação,
          estado, tema e idioma) e reencontrá-las em outro aparelho. Antes de entrar, você vê um aviso e precisa
          concordar com o que está descrito aqui.
        </P>
        <ul>
          <li>
            <strong>Dados do login:</strong> o Google informa ao serviço de login (Firebase Authentication, do Google, que atua
            como operador) seu nome, e-mail, foto de perfil e um identificador da conta. Esses dados podem ser processados
            em servidores do Google fora do Brasil, com as garantias contratuais do Google (LGPD, art. 33).
          </li>
          <li>
            <strong>Suas escolhas:</strong> são criptografadas no seu aparelho (AES-256) com uma chave derivada de uma frase que
            só você conhece, antes de irem para o banco de dados (Firestore, do Google, em São Paulo). O servidor guarda
            apenas o texto cifrado: nem o responsável pelo {LEGAL.projeto} nem o Google conseguem ler. Como escolhas de
            candidaturas podem revelar opinião política (dado pessoal sensível, LGPD art. 5º, II), esse tratamento se
            baseia no seu consentimento específico (art. 7º, I, e art. 11, I).
          </li>
          <li>
            <strong>Frase:</strong> não é enviada a ninguém. Se você a esquecer, as escolhas guardadas no servidor não podem ser
            recuperadas (as do seu aparelho continuam).
          </li>
          <li>
            <strong>Apagar:</strong> no menu da conta, “Apagar minha conta e meus dados” remove a conta e tudo o que estava no
            servidor. “Sair” encerra a sincronização neste aparelho. Você pode retirar o consentimento a qualquer momento
            dessa forma.
          </li>
        </ul>
      </Secao>

      <Secao n={5} title="O que fica guardado só no seu aparelho">
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

      <Secao n={6} title="Avisos (notificações), só se você pedir">
        <P>
          Se você ligar os avisos de resultado, o navegador cria um endereço de entrega de notificações (Web Push), que fica
          guardado num banco de dados na Cloudflare junto com os resultados que você escolheu (Presidência e, se houver,
          o governo do seu estado). Não guardamos nome, e-mail, CPF, localização nem nada que identifique você. As
          notificações passam pelo serviço de push do seu navegador (do Google, da Mozilla, da Apple ou da Microsoft), como
          em qualquer site que envia notificações, e o conteúdo vai criptografado.
        </P>
        <P>
          Se você tocar em “Seguir” na página de um parlamentar, partido ou ministro, o mesmo endereço de entrega fica
          associado aos códigos de quem você segue (por exemplo, “parlamentar:camara-123”), para o aviso de notícia ou
          votação nova chegar só a quem pediu. Sem login, essa lista fica também no seu aparelho; com login, vai
          criptografada para o seu perfil, como as demais escolhas.
        </P>
        <P>
          Você pode desligar os avisos a qualquer momento no próprio site (deixando de seguir ou desligando os avisos de
          resultado) ou nas configurações do navegador; os dados são apagados ao desligar ou quando o navegador informa
          que o endereço expirou.
        </P>
      </Secao>

      <Secao n={7} title="Conexão com a internet e hospedagem">
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

      <Secao n={8} title="Aplicativo: permissões">
        <P>
          O aplicativo usa acesso à internet, necessário para baixar os dados oficiais. Não pede acesso a
          contatos, câmera, microfone, armazenamento de arquivos nem notificações. A única outra permissão é a de
          localização aproximada, opcional, pedida pelo Android na primeira vez que você abre a apuração, só para
          descobrir o seu estado, do jeito descrito no item 3 (no aparelho, sem enviar a posição). Se você negar, é só
          escolher o estado na lista; dá para mudar a decisão em Configurações → Apps → Tá na Urna → Permissões.
        </P>
        <P>
          Ao tocar em “Compartilhar”, o aplicativo abre a tela de compartilhamento do próprio sistema: o conteúdo vai só
          para o app que você escolher. Ao tocar em “Imprimir”, abre o serviço de impressão do sistema (que também permite
          salvar em PDF). Links para órgãos oficiais (TSE, Câmara, Senado) abrem no seu navegador e seguem as políticas
          desses sites.
        </P>
      </Secao>

      <Secao n={9} title="Dados das candidaturas e dos parlamentares">
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

      <Secao n={10} title="Crianças e adolescentes">
        <P>
          O conteúdo é voltado a eleitores, inclusive aos de 16 e 17 anos, e não é direcionado a crianças. O login
          opcional segue as regras de idade da conta Google.
        </P>
      </Secao>

      <Secao n={11} title="Seus direitos">
        <P>
          A LGPD (art. 18) garante, entre outros, os direitos de confirmação, acesso, correção e eliminação de dados
          pessoais. Sem login, não guardamos dados seus. Com login, você mesmo pode apagar a conta e os dados no menu da
          conta; qualquer outro pedido ou dúvida pode ser enviado para <Contato />. Você também pode
          procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
      </Secao>

      <Secao n={12} title="Mudanças nesta política">
        <P>
          Se algum recurso novo passar a tratar dados pessoais, esta política será atualizada antes, com nova data de
          versão no topo da página. Mudanças relevantes também serão avisadas no site e
          no aplicativo.
        </P>
      </Secao>
    </LegalDoc>
  );
}
