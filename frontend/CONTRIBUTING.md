# Contribuindo

Obrigado por querer melhorar o template! 💜

## Rodando localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Antes de abrir um PR, rode a mesma verificação do CI:

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

## Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/), **em inglês**, curtos e no imperativo:

```
feat(auth): add supabase adapter
fix(api): retry only once after token refresh
docs: explain cookie strategy
```

Tipos mais comuns: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`.

## Princípios do template

- **Poucas dependências.** Cada pacote novo é algo a mais para manter. Prefira código pequeno e claro.
- **Agnóstico de backend.** Nada fora de `src/auth/adapters/` deve conhecer um provedor específico.
- **Acessível.** Foco visível, labels, contraste e `prefers-reduced-motion`.
- **Textos da interface em pt-BR; código e comentários em inglês.**
