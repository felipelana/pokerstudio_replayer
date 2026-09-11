# PokerStudio Replayer

Replayer de hand histories para estudo: importa, reproduz mão a mão, anota
leaks e gera relatório. Roda no navegador; a conta guarda perfil, skins e
indicações.

```
apps/next       a aplicação: landing, replayer e API num servidor só (Next 14)
apps/web        o replayer em Vite, ainda funcionando, e o src que as duas cascas usam
apps/api        backend (Node 22 + Fastify 5 + Prisma 5 + PostgreSQL 16)
landingpage     o site institucional, servido pelo Next e ainda construível em Vite
packages/shared contratos compartilhados (tipos, países, idiomas, salas)
infra           Docker, Caddy, scripts de backup
docs            arquitetura, setup, segurança, API, QA
```

O Next serve os três: `pokerstudio.com.br` recebe a landing,
`replayer.pokerstudio.com.br` recebe o produto, e a API responde em `/api/v1`.
Em desenvolvimento existe só `localhost`, então a landing atende em `?site=1`.

## Começar

```powershell
npm install
Copy-Item apps\api\.env.example apps\api\.env.local   # edite as variáveis
npm run db:migrate
npm run db:seed
npm run dev:next     # tudo junto em http://localhost:3100
```

O `APP_URL` do `.env` precisa nomear a porta em que o navegador está, ou a
guarda de CSRF recusa a requisição. As duas cascas antigas continuam
disponíveis, se você precisar comparar:

```
npm run dev:api      # API em http://localhost:3001
npm run dev          # replayer em Vite, em http://localhost:5173
```

O passo a passo completo (PostgreSQL 16 no Windows 11, role, base, e-mail em
desenvolvimento) está em **[docs/DEV-SETUP.md](docs/DEV-SETUP.md)**.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev:next` | landing, replayer e API juntos, em 3100 |
| `npm run build:next` | build de produção da aplicação |
| `npm run typecheck` | TypeScript da aplicação e da API |
| `npm run dev` | o replayer em Vite, em modo desenvolvimento |
| `npm run dev:api` | API com recarga automática |
| `npm run build` | build de produção do replayer |
| `npm test` | testes de todos os workspaces |
| `npm run lint` | ESLint, incluindo as regras de fronteira entre camadas |
| `npm run check:locales` | garante que nenhum idioma tem chave faltando |
| `npm run check:copy` | recusa travessão e clichê de IA em qualquer texto de interface |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | banco |

## Texto de interface

O texto que o leitor vê não usa travessão. Onde a vontade for de abrir um
aparte, use vírgula, dois-pontos ou ponto; para separar dois campos na mesma
linha use `·`; para um valor que não existe use `-`. `npm run check:copy`
varre os oito idiomas do replayer, os oito da landing page e os literais de
texto no código, e falha se algum travessão ou clichê de IA voltar. Comentários
de código ficam de fora da varredura.

## Atalhos do replayer

`→` próxima ação · `←` anterior · `↑`/`↓` troca de mão · `Home`/`End` primeiro
e último frame · `Space` play/pause · `1–5` preflop/herói/flop/turn/river ·
`B` fichas/BB · `T` tema · `C` skin · `S` mostrar cartas conhecidas ·
`F` tela cheia · `[` recolher a lista · `+`/`-` zoom · `?` ajuda.

## Salas que o importador lê

**PokerStars** e a rede **Chico**, que é BetOnline, TigerGaming e SportsBetting.
As outras salas são reconhecidas pelo cabeçalho e recusadas com uma mensagem
clara, em vez de remontar a mão errado em silêncio. O catálogo vive em
`packages/shared/src/rooms.ts`, e é dele que a landing, o importador e o
formulário de nicks tiram a lista, para que os três não possam discordar.

## Adicionar um parser

1. Crie `apps/web/src/parsers/<sala>/index.ts` implementando
   `HandHistoryParser` (`detect`, `split`, `parse`).
2. Registre em `apps/web/src/parsers/registry.ts`.
3. Coloque hand histories reais em `apps/web/src/parsers/<sala>/fixtures/` e
   escreva os testes a partir delas — **não invente o formato**.

## Entrar com uma rede social

Os botões só aparecem quando as variáveis do provedor estão preenchidas em
`apps/api/.env` — sem elas o app segue funcionando com e-mail e senha.

### Google

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e abra
   **APIs e serviços → Tela de permissão OAuth**. Tipo **Externo**, nome "PokerStudio Replayer",
   e-mail de suporte, logotipo e o link da política de privacidade (`/privacidade`) e dos termos (`/termos`).
2. Em **Escopos**, use apenas `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile`.
3. Em **Credenciais → ID do cliente OAuth**, tipo **Aplicativo da Web**:
   - Origens: `http://localhost:5173` e `https://replayer.pokerstudio.com.br`
   - Redirecionamento: `.../api/v1/auth/google/callback` nos dois domínios
4. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

### Facebook

1. Em [developers.facebook.com](https://developers.facebook.com/), crie um app do tipo
   **Consumidor** e adicione o produto **Login do Facebook → Web**.
2. Em **Configurações → Básico**, preencha a URL da política de privacidade e o e-mail de contato;
   sem isso o app não sai do modo de desenvolvimento.
3. Em **Login do Facebook → Configurações**, informe o URI de redirecionamento
   `.../api/v1/auth/facebook/callback`.
4. Peça a permissão **email** na revisão do app — sem ela, contas criadas por telefone chegam sem
   endereço e o login é recusado.
5. `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`.

### Apple (iCloud)

Exige a conta paga do **Apple Developer Program**.

1. Em **Certificates, Identifiers & Profiles**, crie um **App ID** e depois um **Services ID**
   (ex.: `com.pokerstudio.replayer.web`) com *Sign in with Apple* habilitado.
2. No Services ID, configure o domínio `replayer.pokerstudio.com.br` e o *Return URL*
   `https://replayer.pokerstudio.com.br/api/v1/auth/apple/callback`. A Apple **não aceita
   `localhost`**: para testar em desenvolvimento use um túnel HTTPS.
3. Em **Keys**, crie uma chave com *Sign in with Apple* e baixe o `.p8` (só é possível uma vez).
4. `APPLE_CLIENT_ID` (o Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
   (conteúdo do `.p8`, com `\\n` no lugar das quebras de linha) e `APPLE_REDIRECT_URI`.

### Duas coisas que não dá para fazer

- **Instagram não serve para login.** A API Basic Display foi desligada em dezembro de 2024, e o
  que restou (*Instagram API with Instagram Login*) atende contas **business/creator**, não devolve
  e-mail e não é um provedor de identidade. Quem usa Instagram entra pelo Facebook.
- **Nenhum provedor devolve telefone.** O Google exige escopo sensível com verificação do app e
  ainda assim só entrega se a pessoa publicou o número; o Facebook removeu esse acesso; a Apple
  nunca forneceu. O telefone continua sendo um campo que o usuário preenche na conta.

Os segredos vivem **só no servidor**. Nunca use o prefixo `VITE_`: tudo que começa com `VITE_`
entra no bundle e fica público.

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
