# Backend de referência (Express)

API mínima que implementa o [contrato de autenticação](../../docs/backend-contract.md) do template. Serve para:

- ver o modo `VITE_AUTH_PROVIDER=backend` funcionando de ponta a ponta;
- servir de guia para implementar o contrato na sua stack (Spring, .NET, Django, Laravel...).

| Recurso            | Como foi feito                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Login com Google   | Troca do authorization code (`google-auth-library`) e validação do ID token                 |
| E-mail e senha     | Hash com `scrypt` (nativo do Node)                                                          |
| Sessão             | Access token JWT de 15 min (`jose`) + refresh token opaco em cookie `httpOnly`, com rotação |
| Tokens do Firebase | Validados com as chaves públicas do Google, sem Admin SDK (`FIREBASE_PROJECT_ID`)           |
| Proteção           | CORS restrito, rate limit em `/auth`, limite de body                                        |
| Dados              | Em memória, para rodar sem banco. **Troque por um banco de verdade.**                       |

## Rodando

```bash
cd examples/backend-express
npm install
cp .env.example .env   # preencha GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e JWT_SECRET
npm run dev            # http://localhost:3333/api
```

Gere um `JWT_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

No `.env` do front (raiz do repositório):

```env
VITE_AUTH_PROVIDER=backend
VITE_API_URL=http://localhost:3333/api
VITE_GOOGLE_CLIENT_ID=<o mesmo client ID>
```

> Para testar só e-mail/senha, qualquer valor em `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` serve.

## Endpoints

| Método | Rota                                           | Auth   | Descrição                                 |
| ------ | ---------------------------------------------- | ------ | ----------------------------------------- |
| GET    | `/api/health`                                  | não    | Health check                              |
| POST   | `/api/auth/google`                             | não    | `{ code }` → sessão                       |
| POST   | `/api/auth/login`                              | não    | `{ email, password }` → sessão            |
| POST   | `/api/auth/register`                           | não    | `{ name, email, password }` → sessão      |
| POST   | `/api/auth/password-reset`                     | não    | `{ email }` → 204                         |
| POST   | `/api/auth/refresh`                            | cookie | Rotaciona o refresh e devolve nova sessão |
| POST   | `/api/auth/logout`                             | cookie | Revoga a sessão                           |
| GET    | `/api/me`                                      | Bearer | Usuário atual                             |
| GET    | `/api/dashboard`, `/api/projects`, `/api/team` | Bearer | Dados das telas de demonstração           |
| POST   | `/api/projects`                                | Bearer | Cria projeto                              |

## Para produção

- Persistir usuários e refresh tokens num banco (e o rate limit no Redis).
- `NODE_ENV=production` (cookie `Secure`) e HTTPS.
- Se front e API estiverem em domínios diferentes, `sameSite: 'none'` no cookie.
- Enviar o e-mail de recuperação de senha de verdade (Resend, SES, SendGrid...).
