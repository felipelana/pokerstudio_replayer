# Arquitetura — PokerStudio Replayer

## 1. Visão geral

Monorepo com npm workspaces:

```
pokerstudio/
├─ apps/
│  ├─ web/        # replayer (Vite + React 18 + TS)
│  └─ api/        # backend (Node 22 + Fastify 5 + Prisma 5)
├─ packages/
│  └─ shared/     # contratos: tipos, países, idiomas, salas, cotas
├─ infra/
│  ├─ docker/     # Dockerfile, compose, nginx
│  └─ ci/         # scripts de apoio ao CI
└─ docs/          # esta pasta
```

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
- Tipos gerados pelo Prisma não saem de `infrastructure`: existem *mappers*
  entre o modelo de persistência e a entidade de domínio.
- Casos de uso devolvem `Result` explícito; o mapeamento para HTTP e RFC 7807
  acontece só na camada de interface.
- A injeção de dependência é manual e explícita em `main.ts` (composition root).

## 3. Fronteira entre web e API

O frontend conversa com o backend **apenas por HTTP**, através de um único
cliente em `apps/web/src/infrastructure/http`. Nenhum componente React faz
`fetch` direto e nenhum acesso a banco parte do navegador.

Os contratos vivem em `packages/shared` e são importados pelos dois lados, de
modo que uma divergência quebra o build.

O replayer continua funcionando **sem conta**: seus casos de uso dependem de
portas (`Repository`) implementadas ora por IndexedDB, ora pela API quando
houver sessão autenticada — a troca não altera `domain` nem `application`.

## 4. Automação da fronteira

`.eslintrc.cjs` aplica `no-restricted-imports` em dois níveis e **falha o CI**:

| Regra | Efeito |
|---|---|
| `packages/shared/**` | não pode importar React, Three, Dexie, i18next nem código de app |
| `apps/web/**` | não pode importar `apps/api/*` — o backend só é alcançado por HTTP |

## 5. Migrações e dados

- Toda alteração de schema é uma migração Prisma versionada em
  `apps/api/prisma/migrations`. `db push` só em ambiente local descartável.
- Migração destrutiva exige script de dados junto e nota no CHANGELOG.
- `seed.ts` é idempotente.

## 6. Estado da reorganização

| Etapa | Situação |
|---|---|
| Monorepo com workspaces | **feito** |
| `apps/web` isolado, buildando e testando | **feito** |
| `packages/shared` com contratos | **feito** (idiomas, salas, países, DTOs, cotas) |
| `infra/docker` e `docs/` | **feito** |
| Fronteira validada no lint | **feito** |
| `apps/api` em camadas | em andamento |
| Extração de `domain`/`application` no web | pendente — o replayer ainda tem regra em `src/engine`, `src/parsers` e `src/model`, que já são puros e serão renomeados para `domain/` numa etapa dedicada |

A extração final do front foi deixada por último de propósito: `engine`,
`parsers` e `model` **já são puros** (sem React, sem I/O), então a mudança é de
nomenclatura e imports, sem risco de comportamento — e não bloqueia o backend.

## 7. ADRs

Ver `docs/adr/`.
