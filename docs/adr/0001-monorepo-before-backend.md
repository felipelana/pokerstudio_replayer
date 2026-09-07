# ADR 0001 — Reorganizar em monorepo antes de criar o backend

- **Data:** 2026-09-07
- **Status:** aceito

## Contexto

O prompt v14 pede Clean Architecture em camadas e a criação de `apps/api`. O
repositório era um único app Vite na raiz. As Partes 3 e 4 (ajustes do
replayer) tocavam exatamente os arquivos que a reorganização iria mover.

## Decisão

1. Concluir as Partes 3 e 4 no repositório antigo.
2. Reorganizar em monorepo (`apps/web`, `packages/shared`, `infra`, `docs`) em
   commits **somente de movimentação**, com `git mv` para preservar histórico.
3. Só então criar `apps/api`.

## Consequências

- O diff de comportamento fica separado do diff de movimentação, e cada um pode
  ser revisado por conta própria.
- O app precisa buildar ao final de cada commit — verificado com
  `npm run build`, `npm run test` e `npm run lint` na raiz.
- A extração de `domain`/`application` dentro de `apps/web` fica para uma etapa
  posterior: `engine`, `parsers` e `model` já são puros, então é renomeação.
