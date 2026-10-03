# Publicar o app Voto Informado

O app Android (e, depois, o iOS) é feito com [Capacitor](https://capacitorjs.com): a mesma interface React
do site, empacotada como app nativo. Ele **embute a interface** e **lê os dados oficiais do site público**
(`https://professorbossini.dev/voto-informado`). Por isso, atualizar os dados (`make dados && make publicar`)
atualiza o app na hora, sem lançar versão nova na loja.

**Para preencher o Play Console, abra o [kit-google-play.html](kit-google-play.html) no navegador**: todos os
textos, respostas e imagens, com botão de copiar.

| O quê | Onde |
|---|---|
| Projeto Android | `frontend/android/` (id `dev.professorbossini.votoinformado`, Android 7+ / API 24, alvo API 36) |
| Configuração do app | `frontend/capacitor.config.ts` e `frontend/.env.app` (URLs do site) |
| Código só do app | `frontend/src/native/` (compartilhar, imprimir, barras do sistema, botão voltar) |
| Plugin nativo | `frontend/android/app/src/main/java/dev/professorbossini/votoinformado/AparelhoPlugin.java` |
| Política de Privacidade e Termos | `/privacidade` e `/termos` no site; dados do responsável em `frontend/src/config/legal.ts` |
| Ícone e splash (fonte) | `frontend/assets/` (`npm run app:assets` regenera todos os tamanhos) |
| Artes e textos da loja | `loja/play/` (prontos) e `loja/fontes/` (para regenerar) |
| Chave de upload | **fora do repositório**: `~/.android-keystores/voto-informado/` |

---

## Passo 0. Backup da chave de upload (5 min, faça já)

A chave que assina o pacote foi gerada em `~/.android-keystores/voto-informado/` (`upload.jks` + `keystore.properties`
com a senha). `frontend/android/keystore.properties` é só um atalho para lá e nunca vai para o git
(o repositório é público).

Copie a pasta inteira para um lugar seguro (gerenciador de senhas, pendrive, nuvem privada). Se ela se perder, o
app não se perde: com a Assinatura de apps do Google Play, dá para pedir uma nova chave de upload no Play Console
(Configuração → Integridade do app). Mas isso leva alguns dias.

## Passo 1. Pôr no ar as páginas de Privacidade e Termos

A loja exige a URL da política **funcionando** antes do envio.

```bash
make publicar
```

Depois confira: https://professorbossini.dev/voto-informado/privacidade e `/termos`.

> Antes, revise `frontend/src/config/legal.ts`: o e-mail de contato aparece publicamente na política
> (e também fica público na página da loja). Se quiser um e-mail só para o app, troque lá e no kit
> (`loja/fontes/textos-loja.json`, depois `make app-loja`).

## Passo 2. Gerar o pacote

```bash
make app-release
```

Gera `frontend/android/app/build/outputs/bundle/release/app-release.aab` (≈4 MB), assinado com a chave de upload.
Já existe um gerado desta versão (1.0.0, código 1).

## Passo 3. Play Console

Sua conta é de 2013. Contas pessoais criadas **antes de 13/11/2023 não precisam** do teste fechado com 12 testadores
por 14 dias, então dá para ir direto para Produção.

1. **Criar app** (https://play.google.com/console → Criar app)
   - Nome: `Voto Informado: Eleições 2026` · Idioma padrão: Português (Brasil) · App · Gratuito
   - Marque as declarações (Políticas do programa para desenvolvedores e Leis de exportação dos EUA).
2. **Painel → Configurar o app**: preencha cada item com as respostas das seções 4 e 5 do kit
   (Política de Privacidade, Acesso ao app, Anúncios, Classificação do conteúdo, Público-alvo, App de notícias,
   Segurança dos dados, Apps governamentais, Recursos financeiros, Saúde, ID de publicidade).
3. **Crescimento → Presença na loja → Ficha principal da loja**: textos, ícone, imagem de destaque e os 7 prints
   (seções 1 e 2 do kit). Categoria e contato ficam em **Configurações da loja** (seção 3 do kit).
4. **Visão geral da publicação → Publicação gerenciada: ATIVAR.** Assim, mesmo aprovado, o app só entra no ar quando
   você clicar em "Publicar". Não deixe o lançamento cair em **4/10 (dia da votação)**.
5. *(Recomendado, em paralelo)* **Testar → Teste interno**: crie uma versão com o mesmo `.aab`, adicione o seu e-mail
   como testador e instale pelo link. Não passa pela revisão demorada e serve para ver o app vindo da loja.
6. **Produção → Países/regiões**: adicione só o Brasil.
7. **Produção → Criar nova versão**
   - Aceite a **Assinatura de apps do Google Play** (padrão; o Google guarda a chave final, você só usa a de upload).
   - Envie o `app-release.aab`, cole as notas da versão (seção 6 do kit) → Avançar → **Enviar para revisão**.

**Prazo realista:** a primeira revisão de um app novo costuma levar de algumas horas a vários dias (às vezes mais de
uma semana, e temas eleitorais podem ter revisão mais cuidadosa). Ou seja, é provável que ele só entre no ar depois
do 1º turno (4/10). Mesmo assim ele serve para o 2º turno (25/10), que tem página própria no app, e para os gastos de
mandato. Se a revisão pedir algo, a resposta costuma estar no kit (aviso de não oficial, fontes, política).

## Atualizações

- **Dados** (candidaturas, apuração, gastos): `make dados && make publicar`. O app lê do site; nada a fazer na loja.
- **Interface ou recursos do app**: em `frontend/android/app/build.gradle`, some 1 ao `versionCode` e ajuste o
  `versionName` (ex.: `1.0.1`). Depois `make app-release` e crie uma nova versão em Produção com o novo `.aab`.
- **Mudou o endereço do site?** Ajuste `frontend/.env.app` e publique uma versão nova do app (ou mantenha o endereço
  antigo redirecionando para o novo).
- **Textos jurídicos**: edite as páginas em `frontend/src/pages/legal/` e a data `vigencia` em `src/config/legal.ts`.

## Testar no celular antes de publicar

- Com o celular em modo desenvolvedor e depuração USB: `cd frontend && npm run app:run`.
- Ou abra no Android Studio: `make app` (▶ Run).
- Ou instale o APK de teste: `cd frontend/android && ./gradlew assembleDebug`, arquivo em `app/build/outputs/apk/debug/`.

Testado em emulador Android 16 (API 36): abertura, splash, navegação, dados e fotos vindos do site.

## iOS (App Store): quando for a hora

O código já é compatível (áreas seguras do iPhone, compartilhar nativo; o botão "Imprimir" se esconde sozinho
onde o plugin nativo não existe). O que falta depende de um Mac:

1. Mac com Xcode atualizado e inscrição no **Apple Developer Program** (US$ 99/ano). Inscrição de pessoa física
   sai em 1 ou 2 dias; com empresa precisa de D-U-N-S e leva mais.
2. No Mac, a partir de `frontend/`:
   ```bash
   npm install @capacitor/ios
   npx cap add ios
   npm run app:assets   # ícones e splash do iOS a partir de frontend/assets
   npm run app:build    # build + cap sync
   npx cap open ios     # no Xcode: Signing & Capabilities → seu Team; Product → Archive → Distribute
   ```
3. **App Store Connect**: mesmo nome, Bundle ID `dev.professorbossini.votoinformado`, categoria Referência ou
   Educação, classificação 4+, "Privacidade do app" → **Dados não coletados**, URL da política igual à do Android.
   A descrição do kit serve com poucas mudanças (troque "Android" por "iPhone" nas notas da versão).
4. **Prints**: a Apple pede tamanhos de iPhone (ex.: 1320×2868). Regenere com `loja/fontes/gerar-artes.mjs`,
   trocando o tamanho do quadro.
5. *(Opcional)* imprimir no iPhone: versão iOS do plugin `Aparelho` (método `imprimir` com
   `UIPrintInteractionController`). Sem isso, a cola continua com "Copiar texto" e "Compartilhar".

A Apple é mais rigorosa com apps que "só embrulham um site" (diretriz 4.2). Os argumentos a favor deste app:
interface embutida (abre sem carregar o site), compartilhamento e impressão nativos, cola guardada no aparelho.

## Sobre os textos jurídicos

A Política de Privacidade e os Termos seguem a LGPD e o que o app realmente faz (nenhuma coleta, só armazenamento
local, hospedagem no GitHub Pages). São uma base sólida para um projeto pessoal e gratuito, mas não substituem a revisão
de um advogado. Se um dia entrar login, analytics ou anúncio, a política precisa mudar **antes**, e a seção Segurança
dos dados do Play Console também.
