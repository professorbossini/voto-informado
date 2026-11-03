# voto-informado

Instruções para o Claude Code neste repositório.

## Commits

- Faça commit e push continuamente: a cada bloco de trabalho coerente que estiver pronto, commite e envie para o remoto, sem esperar pedido.
- Mensagens em Conventional Commits (`tipo(escopo): descrição`, com `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`; `!` ou `BREAKING CHANGE:` para mudança incompatível), no idioma que o histórico do repositório já usa.
- O único autor é o Rodrigo: nunca acrescente `Co-Authored-By` nem qualquer assinatura.
- Nunca commite segredos (`.env`, chaves, tokens) nem artefatos de build. Force push e reescrita de histórico exigem confirmação; a `main` é protegida contra force push e exclusão.
