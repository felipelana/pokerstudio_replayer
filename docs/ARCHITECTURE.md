# Arquitetura — PokerStudio Replayer

## 1. Visão geral

Uma aplicação, uma árvore de código. A raiz do repositório é o projeto Next:

```
pokerstudio/
├─ src/
│  ├─ app/          # rotas do Next: landing, replayer, e a porta da API
│  ├─ domain/       # modelo e motor de replay, sem React e sem navegador
│  ├─ features/     # cada assunto inteiro: parsers, replayer, reviews, admin, auth
│  ├─ components/   # o que serve a mais de uma feature
│  ├─ lib/          # banco local, estado, skins, clientes HTTP, assets
│  ├─ i18n/         # a configuração e os oito idiomas
│  └─ server/       # backend (Node 22 + Fastify 5 + Prisma 5)
├─ prisma/          # schema, migrações e seed
├─ tests/           # ponta a ponta e os testes do servidor
├─ packages/
│  └─ shared/       # contratos: tipos, países, idiomas, salas, cotas
├─ landingpage/     # o site institucional, também construível sozinho
├─ infra/
│  ├─ docker/       # Dockerfile, compose, Caddy
│  └─ scripts/      # as verificações que o CI roda
└─ docs/            # esta pasta
```

`packages/shared` e `landingpage` continuam sendo workspaces npm, porque são
publicáveis e consumíveis por conta própria. O resto não era: eram pastas com
um `package.json` cada, e três caminhos relativos para se acharem.

O workflow do GitHub Actions permanece em `.github/workflows/` porque o GitHub
exige esse caminho; scripts auxiliares ficam em `infra/ci`.

## 2. Regra da dependência

As dependências apontam **sempre para dentro**:

```
interface (http, ui) → application (casos de uso) → domain (entidades, regras)
                                   ↑
                        infrastructure implementa as portas
```

- `domain` não importa nada externo: nem Prisma, nem Fastify, nem React, nem
  `fetch`, nem `process.env`. Só TypeScript puro.
- Tipos gerados pelo Prisma não saem de `infrastructure`: existem _mappers_
  entre o modelo de persistência e a entidade de domínio.
- Casos de uso devolvem `Result` explícito; o mapeamento para HTTP e RFC 7807
  acontece só na camada de interface.
- A injeção de dependência é manual e explícita em `main.ts` (composition root).

## 3. Fronteira entre web e API

O frontend conversa com o backend **apenas por HTTP**, através de um único
cliente em `src/infrastructure/http`. Nenhum componente React faz
`fetch` direto e nenhum acesso a banco parte do navegador.

Os contratos vivem em `packages/shared` e são importados pelos dois lados, de
modo que uma divergência quebra o build.

O replayer continua funcionando **sem conta**: seus casos de uso dependem de
portas (`Repository`) implementadas ora por IndexedDB, ora pela API quando
houver sessão autenticada — a troca não altera `domain` nem `application`.

## 4. Automação da fronteira

`.eslintrc.cjs` aplica `no-restricted-imports` em dois níveis e **falha o CI**:

| Regra                                          | Efeito                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/shared/**`                           | não pode importar React, Three, Dexie, i18next nem código de app                                              |
| `src/{features,components,lib,domain,i18n}/**` | não pode importar `@/server/*`. O backend só é alcançado por HTTP, e a exceção é `src/app`, que é o adaptador |

## 5. Migrações e dados

- Toda alteração de schema é uma migração Prisma versionada em
  `prisma/migrations`. `db push` só em ambiente local descartável.
- Migração destrutiva exige script de dados junto e nota no CHANGELOG.
- `seed.ts` é idempotente.

## 6. Estado da reorganização

| Etapa                                                | Situação                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/shared` com contratos                      | **feito** (idiomas, salas, países, DTOs, cotas)                                   |
| `infra/docker` e `docs/`                             | **feito**                                                                         |
| Fronteira validada no lint                           | **feito**                                                                         |
| `src/server` em camadas                              | **feito**                                                                         |
| `domain` extraído no front                           | **feito**. `engine` e `model` viraram `src/domain`, e `parsers` virou uma feature |
| Uma árvore só, com `src`, `prisma` e `tests` na raiz | **feito** (ver ADR 0008)                                                          |

A extração do front foi deixada por último de propósito: `engine`, `parsers` e
`model` já eram puros, sem React e sem I/O, então a mudança foi de nomenclatura
e de imports, sem risco de comportamento, e não bloqueou o backend em momento
algum.

## 7. ADRs

Ver `docs/adr/`.
