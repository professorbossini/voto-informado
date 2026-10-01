# Configurando o login com Google

Este guia cobre os dois modos "de verdade" do template. Se você só quer ver o app rodando, não precisa de nada disso: o modo `mock` funciona sem credenciais.

- [Opção A: Firebase Authentication](#opção-a-firebase-authentication-recomendado) (recomendado)
- [Opção B: seu próprio backend](#opção-b-seu-próprio-backend-google-identity-services)
- [Problemas comuns](#problemas-comuns)

---

## Opção A: Firebase Authentication (recomendado)

O Firebase cuida da sessão (persistência entre recarregamentos, renovação automática do token) e ainda oferece e-mail/senha e recuperação de senha sem nenhum backend.

1. Acesse o [console do Firebase](https://console.firebase.google.com/) e crie um projeto (o Google Analytics é opcional).
2. Vá em **Build → Authentication → Get started**.
3. Na aba **Sign-in method**, ative:
   - **Google**: escolha o e-mail de suporte e salve;
   - **Email/Password** (opcional, se quiser login por e-mail).
4. Na aba **Settings → Authorized domains**, confira se `localhost` está na lista. Quando publicar, adicione o domínio de produção (ex.: `meuapp.vercel.app`).
5. Em **Project settings** (engrenagem) → **Your apps**, clique no ícone **Web** (`</>`), registre o app e copie o objeto `firebaseConfig`.
6. Preencha o `.env`:

   ```env
   VITE_AUTH_PROVIDER=firebase
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=meu-projeto.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=meu-projeto
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```

7. Reinicie o `npm run dev`.

> A `apiKey` do Firebase **não é secreta**: ela identifica o projeto e é pública por design. A segurança fica nas regras do Firebase e na validação do token no seu backend.

### E quando o projeto precisar de uma API?

Nada muda no front. Aponte `VITE_API_URL` para a sua API: o cliente HTTP já envia o ID token do Firebase no cabeçalho `Authorization: Bearer <token>`. No servidor, valide o token de um destes jeitos:

- com o [Firebase Admin SDK](https://firebase.google.com/docs/auth/admin/verify-id-tokens) (`admin.auth().verifyIdToken(token)`), disponível para Node, Java, Python, Go e C#;
- com qualquer biblioteca JWT, verificando assinatura (chaves públicas do Google), `iss = https://securetoken.google.com/<projectId>` e `aud = <projectId>`. O [backend de exemplo](../examples/backend-express) faz exatamente isso com a biblioteca `jose`.

---

## Opção B: seu próprio backend (Google Identity Services)

Use quando você já tem (ou quer ter) um backend próprio que controla usuários e sessões: Spring, .NET, Django, Laravel, NestJS, Go...

### 1. Crie o OAuth Client ID

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie (ou selecione) um projeto.
2. Vá em **APIs & Services → OAuth consent screen** (em contas novas, **Google Auth Platform → Branding**) e configure:
   - tipo de usuário **External**;
   - nome do app, e-mail de suporte e logo;
   - escopos: `openid`, `email`, `profile` (não precisam de verificação).
   - Enquanto o app estiver em **Testing**, só os e-mails cadastrados em _Test users_ conseguem logar. Publique o app para liberar para todos.
3. Vá em **Credentials → Create credentials → OAuth client ID**:
   - tipo **Web application**;
   - **Authorized JavaScript origins**: `http://localhost:5173` (e o domínio de produção depois);
   - **Authorized redirect URIs**: não é necessário para o fluxo em popup.
4. Copie o **Client ID** e o **Client secret**.

### 2. Configure o front

```env
VITE_AUTH_PROVIDER=backend
VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
VITE_API_URL=http://localhost:3333/api
```

### 3. Implemente o contrato no backend

O front espera meia dúzia de endpoints, todos descritos em [backend-contract.md](./backend-contract.md). O ponto central é o `POST /auth/google`: ele recebe um `code` de uso único e troca por tokens do Google usando o **client secret** (que nunca vai para o navegador), com `redirect_uri = "postmessage"`.

Para ver tudo funcionando antes de escrever o seu, suba o [backend de exemplo em Express](../examples/backend-express).

---

## Problemas comuns

| Sintoma                                                        | Causa provável                                            | Solução                                                                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Error 400: redirect_uri_mismatch` ou `origin_mismatch`        | A origem não está autorizada no OAuth Client              | Adicione `http://localhost:5173` (exatamente, sem barra no final) em _Authorized JavaScript origins_. Pode levar alguns minutos para propagar. |
| Popup abre e fecha na hora / `popup-blocked`                   | Bloqueador de popups                                      | Permita popups para o site. No Firebase o template cai automaticamente para o fluxo por redirecionamento.                                      |
| `auth/unauthorized-domain`                                     | Domínio fora da lista do Firebase                         | Firebase → Authentication → Settings → Authorized domains.                                                                                     |
| `access_denied` para alguns usuários                           | App em modo _Testing_                                     | Adicione os e-mails em _Test users_ ou publique o app.                                                                                         |
| Login funciona no dev e falha em produção                      | Domínio de produção não autorizado ou header COOP ausente | Autorize o domínio e sirva `Cross-Origin-Opener-Policy: same-origin-allow-popups` (já configurado em `vercel.json` e `public/_headers`).       |
| Backend recebe o cookie de refresh no dev, mas não em produção | Front e API em sites diferentes                           | Use `SameSite=None; Secure` no cookie e HTTPS, ou sirva a API no mesmo domínio (ex.: `/api` via proxy).                                        |
