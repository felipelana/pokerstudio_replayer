# PokerStudio Replayer

Replayer de hand histories para estudo: importa, reproduz mão a mão, anota
leaks e gera relatório. Roda no navegador; a conta guarda perfil, skins e
indicações.

```
apps/web        replayer (Vite + React 18 + TypeScript)
apps/api        backend (Node 22 + Fastify 5 + Prisma 5 + PostgreSQL 16)
packages/shared contratos compartilhados (tipos, países, idiomas, salas)
infra           Docker, Caddy, scripts de backup
docs            arquitetura, setup, segurança, API, QA
```

## Começar

```powershell
npm install
Copy-Item apps\api\.env.example apps\api\.env.local   # edite as variáveis
npm run db:migrate
npm run db:seed
npm run dev:api      # API em http://localhost:3001
npm run dev          # replayer em http://localhost:5173
```

O passo a passo completo (PostgreSQL 16 no Windows 11, role, base, e-mail em
desenvolvimento) está em **[docs/DEV-SETUP.md](docs/DEV-SETUP.md)**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | replayer em modo desenvolvimento |
| `npm run dev:api` | API com recarga automática |
| `npm run build` | build de produção do replayer |
| `npm test` | testes de todos os workspaces |
| `npm run lint` | ESLint, incluindo as regras de fronteira entre camadas |
| `npm run check:locales` | garante que nenhum idioma tem chave faltando |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | banco |

## Atalhos do replayer

`→` próxima ação · `←` anterior · `↑`/`↓` troca de mão · `Home`/`End` primeiro
e último frame · `Space` play/pause · `1–5` preflop/herói/flop/turn/river ·
`B` fichas/BB · `T` tema · `C` skin · `S` mostrar cartas conhecidas ·
`F` tela cheia · `[` recolher a lista · `+`/`-` zoom · `?` ajuda.

## Adicionar um parser

1. Crie `apps/web/src/parsers/<sala>/index.ts` implementando
   `HandHistoryParser` (`detect`, `split`, `parse`).
2. Registre em `apps/web/src/parsers/registry.ts`.
3. Coloque hand histories reais em `apps/web/src/parsers/<sala>/fixtures/` e
   escreva os testes a partir delas — **não invente o formato**.

## Deploy

- `infra/docker/docker-compose.yml` sobe `postgres`, `api`, `web` e `caddy`.
  O Caddy emite TLS para `replayer.pokerstudio.com.br` e roteia `/api/*`.
- As migrações rodam antes da API subir (ver `Dockerfile.api`).
- Backup diário e restore: `infra/scripts/backup.sh` e `restore.sh`.
- Segredos obrigatórios no ambiente: `POSTGRES_PASSWORD`, `SESSION_SECRET`,
  `ENCRYPTION_KEY`. Opcionais: `EMAIL_PROVIDER_KEY`, `TURNSTILE_SECRET`,
  `GOOGLE_CLIENT_*`.

### DNS do e-mail

No provedor (Resend), publique para `pokerstudio.com.br`: **SPF**, **DKIM** e
**DMARC**. Sem provedor configurado, as mensagens ficam na fila `EmailOutbox` e
o cadastro continua funcionando.

### Promover um admin

Inclua o e-mail em `ADMIN_EMAILS` (promoção no cadastro) ou rode
`npm run db:seed` com `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD`.
A senha nunca entra no repositório: só o hash Argon2id vai para o banco.

## Documentação

- [Arquitetura e regras de dependência](docs/ARCHITECTURE.md)
- [Setup de desenvolvimento](docs/DEV-SETUP.md)
- [Segurança](docs/SECURITY.md)
- [Inventário da API](docs/API.md)
- [Relatório de QA](docs/QA-REPORT.md)
- [Plano das Partes 3 e 4](docs/PLAN-partes-3-4.md)
