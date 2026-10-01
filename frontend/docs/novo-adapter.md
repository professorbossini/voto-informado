# Criando um adapter de autenticação

Toda a autenticação do app passa pela interface `AuthAdapter` ([`src/auth/types.ts`](../src/auth/types.ts)). Telas, rotas protegidas e o cliente HTTP só conhecem essa interface, então trocar de provedor é escrever **um arquivo**.

## Passo a passo

1. Crie `src/auth/adapters/<nome>.ts` exportando uma função `create<Nome>Adapter()` que retorna um `AuthAdapter`.
2. Adicione o nome em `AUTH_PROVIDERS` e as variáveis necessárias em `assertValidEnv` ([`src/config/env.ts`](../src/config/env.ts)).
3. Registre o adapter no `switch` de [`src/auth/adapters/index.ts`](../src/auth/adapters/index.ts) com `await import(...)`, para que o SDK só seja baixado quando for usado.
4. Documente as variáveis no `.env.example`.

## Regras do contrato

| Método                                                    | O que precisa fazer                                                                                                                       |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `onAuthStateChanged(cb)`                                  | Chamar `cb` **uma vez** assim que souber a sessão inicial (usuário ou `null`) e de novo a cada mudança. Retornar a função de unsubscribe. |
| `signInWithGoogle()`                                      | Resolver com o `AuthUser` ou rejeitar com `AuthError`. Popup fechado pelo usuário → `AuthError('cancelled')` (não aparece como erro).     |
| `signInWithEmail`, `signUpWithEmail`, `sendPasswordReset` | Se o provedor não suportar, chame `notSupported('...')` e marque `capabilities` como `false`: a UI esconde os campos sozinha.             |
| `getAccessToken({ forceRefresh })`                        | Devolver um token que a sua API valide, ou `null`. Com `forceRefresh`, pedir um novo (é chamado após um 401).                             |
| `signOut()`                                               | Encerrar a sessão e notificar os listeners com `null`.                                                                                    |

Converta os erros do SDK para `AuthError` com um dos códigos de [`src/auth/errors.ts`](../src/auth/errors.ts). As mensagens exibidas ficam todas lá.

## Exemplo: Supabase

```bash
npm i @supabase/supabase-js
```

```ts
// src/auth/adapters/supabase.ts
import { createClient, type User } from '@supabase/supabase-js';
import { AuthError } from '../errors';
import type { AuthAdapter, AuthUser } from '../types';

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: (user.user_metadata.full_name ?? user.user_metadata.name ?? null) as string | null,
    photoUrl: (user.user_metadata.avatar_url ?? null) as string | null,
    emailVerified: Boolean(user.email_confirmed_at),
    signInMethod: user.app_metadata.provider === 'google' ? 'google' : 'password',
  };
}

export function createSupabaseAdapter(url: string, anonKey: string): AuthAdapter {
  const supabase = createClient(url, anonKey);

  return {
    id: 'supabase' as never, // adicione 'supabase' em AUTH_PROVIDERS
    capabilities: { emailPassword: true, signUp: true, passwordReset: true },

    onAuthStateChanged(listener) {
      // INITIAL_SESSION é emitido logo na inscrição, cumprindo o contrato.
      const { data } = supabase.auth.onAuthStateChange((_event, session) =>
        listener(session?.user ? toAuthUser(session.user) : null),
      );
      return () => data.subscription.unsubscribe();
    },

    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw new AuthError('unknown', error.message, error);
      return new Promise<AuthUser>(() => {}); // o navegador redireciona
    },

    async signInWithEmail(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new AuthError('invalid-credentials', error.message, error);
      return toAuthUser(data.user);
    },

    async signUpWithEmail({ name, email, password }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error || !data.user) throw new AuthError('unknown', error?.message, error);
      return toAuthUser(data.user);
    },

    async sendPasswordReset(email) {
      await supabase.auth.resetPasswordForEmail(email);
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async getAccessToken({ forceRefresh } = {}) {
      if (forceRefresh) await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };
}
```

O mesmo roteiro serve para Auth0 (`@auth0/auth0-spa-js`), Clerk, AWS Cognito (Amplify) ou Keycloak (`keycloak-js`).

## Testando

Veja [`src/auth/adapters/backend.test.ts`](../src/auth/adapters/backend.test.ts): o adapter recebe `fetch` por injeção de dependência, o que permite testar todo o fluxo sem rede. Faça o mesmo com o SDK do seu provedor.
