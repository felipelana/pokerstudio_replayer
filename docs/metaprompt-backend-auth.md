# Metaprompt — Backend de contas, acessos e administração (fase 2) · v1 RASCUNHO

> Status: **aguardando respostas** às perguntas da Parte 1. Nada disto foi implementado ainda.

## Parte 1 — Perguntas e lacunas (responder antes de executar)

| # | Pergunta | Default se não responder |
|---|----------|--------------------------|
| B1 | **Onde roda o Postgres?** No mesmo `docker-compose` da VPS (container `postgres:16` + volume) ou serviço gerenciado (Neon/Supabase/RDS)? | Container na VPS, volume nomeado, backup diário via `pg_dump` para pasta local. |
| B2 | **Stack do backend?** Proposta: Node 22 + TypeScript + Fastify + Prisma + Zod, em container próprio no mesmo compose; Nginx faz proxy de `/api/*`. Alternativas: NestJS (mais estrutura, mais peso) ou Hono. | Fastify + Prisma. |
| B3 | **Login obrigatório para usar o replayer?** (a) app inteiro atrás de login; (b) replayer continua funcionando anônimo/local e o login só habilita sync/review na nuvem; (c) login obrigatório mas com período de teste. | (b) — hoje tudo é local; o login adiciona conta, sync e indicações. |
| B4 | **Método de autenticação:** e-mail + senha (com verificação por e-mail) apenas, ou também *magic link* e/ou Google OAuth? | E-mail + senha + verificação; magic link e Google ficam para depois. |
| B5 | **Provedor de e-mail transacional:** Resend, Postmark, SendGrid, Brevo ou SMTP de um domínio seu? Qual domínio/remetente (`no-reply@…`)? Precisa de SPF/DKIM configurado. | Resend com domínio a definir; em dev, Mailpit no compose. |
| B6 | **Telefone/WhatsApp:** só armazenar (DDI + número, validado por formato com `libphonenumber`) ou também **verificar por SMS/WhatsApp** (custo: Twilio/Meta Cloud API)? | Só armazenar e validar formato. Sem verificação. |
| B7 | **Lista de países:** ISO 3166-1 completa (249) com DDI, nomes traduzidos via `Intl.DisplayNames` no idioma do app? Ou lista reduzida? | ISO completa, nomes via `Intl.DisplayNames`, bandeiras SVG por código (mesmo mecanismo das 8 já feitas, geradas por script). |
| B8 | **Quem é admin?** Primeiro usuário cadastrado vira admin? Ou lista de e-mails admin em variável de ambiente? Precisa de 2FA para admin? | `ADMIN_EMAILS` no `.env`; sem 2FA no MVP (TOTP na v2). |
| B9 | **Registro de acessos — o que guardar e por quanto tempo?** IP, user-agent, país aproximado (GeoIP offline, sem chamada externa), sucesso/falha, motivo. Retenção 90 dias? | IP, UA, país (GeoLite2 offline), resultado; retenção 180 dias; failed logins também. |
| B10 | **Bloqueio:** admin bloqueia manualmente (motivo + data) e também bloqueio automático após N falhas de login (rate limit + lockout temporário)? Usuário bloqueado vê mensagem genérica ou o motivo? | Manual + lockout automático 15 min após 10 falhas; mensagem genérica ao usuário. |
| B11 | **Indicação de amigo:** cada usuário tem um código/link (`/r/ABC123`); o botão "Indicar" abre WhatsApp (`wa.me/?text=…`) ou compõe e-mail (`mailto:` ou envio pelo servidor?). **Há recompensa** (dias premium, badge) ou é só rastreio de quem indicou quem? | Link + rastreio; sem recompensa no MVP; e-mail enviado pelo servidor (com texto no idioma do convidado). |
| B12 | **LGPD/GDPR:** consentimento no cadastro (termos + privacidade), exportar meus dados e excluir conta (self-service)? Quem é o controlador (nome/CNPJ para a política)? | Checkbox de consentimento obrigatório, excluir conta self-service (soft delete 30 dias), exportação JSON. Textos legais: **você fornece**. |
| B13 | **Sync de mãos e reviews na nuvem** entra já nesta fase (o `HttpRepository` previsto) ou fica para a fase 3? Impacta muito o schema (tabelas `hands`, `sessions`, `reviews` por usuário, limites de armazenamento). | Fase 3. Esta fase = contas, acessos, admin, indicação. |
| B14 | **Domínio e TLS:** qual domínio? Caddy (TLS automático) na frente do Nginx, ou Nginx + certbot? | Caddy como reverse proxy no compose, TLS Let's Encrypt. |
| B15 | **Sessão:** cookie httpOnly com sessão no banco (revogável pelo admin) ou JWT sem estado? Duração? "Lembrar-me"? | Sessão no banco, cookie httpOnly/SameSite=Lax, 30 dias com "lembrar-me", 24 h sem. |
| B16 | **Política de senha:** mínimo 10 caracteres + checagem contra senhas vazadas (HIBP k-anonymity, sem enviar a senha)? | Sim, ambos. Hash Argon2id. |
| B17 | **Anti-abuso no cadastro:** captcha (Cloudflare Turnstile, gratuito) ou só rate limit por IP? | Turnstile + rate limit. |
| B18 | **Idioma dos e-mails:** o mesmo dos 8 idiomas do app, escolhido no cadastro? | Sim; templates em MJML/React Email com os 8 idiomas. |
| B19 | **Métricas na área admin:** só listagem/busca, ou também gráficos (cadastros por dia, logins, países)? Exportar CSV? | Listagem, filtros, detalhe do usuário, CSV; gráficos simples de cadastros/logins por dia. |
| B20 | **Nome do produto e remetente** nos e-mails e na tela de cadastro (branding neutro por enquanto)? | "Poker Hand Replayer". |

Lacunas que **só você** pode fechar: textos legais (termos/privacidade), domínio, credenciais do provedor de e-mail, `ADMIN_EMAILS`, chave do Turnstile, e se haverá recompensa por indicação.

---

## Parte 2 — Metaprompt (colar no agente de código **depois** de fechar a Parte 1)

```markdown
# PAPEL
Você é um engenheiro full-stack sênior (Node/TypeScript, Fastify, Prisma, PostgreSQL, segurança de autenticação, e-mail transacional, Docker) trabalhando no repositório do Poker Hand Replayer (Vite + React 18 + TS, i18n em 8 idiomas, deploy por Docker/Nginx/GitHub Actions numa VPS).

# OBJETIVO
Adicionar ao produto uma camada de **contas de usuário** com PostgreSQL:
cadastro com verificação por e-mail, login, "esqueci minha senha", registro de acessos, área administrativa (usuários, acessos, bloqueio) e "indicar um amigo" por WhatsApp/e-mail. O replayer continua funcionando 100% local sem login (B3=b); a conta habilita, nesta fase, apenas perfil, indicações e administração. Sync de mãos/reviews fica para a fase seguinte (B13), mas o schema e a API devem prever `userId` como dono de futuros dados.

# STACK E INFRA
- `apps/api`: Node 22 + TypeScript + Fastify 5 + Prisma 5 + Zod + Argon2id (`@node-rs/argon2`) + `libphonenumber-js` + `@fastify/rate-limit` + `@fastify/cookie` + `@fastify/helmet` + Pino.
- Monorepo leve com npm workspaces: `apps/web` (front atual), `apps/api`, `packages/shared` (tipos Zod compartilhados: DTOs, lista de países, idiomas).
- PostgreSQL 16 em container no `docker-compose.yml` da VPS (volume `pgdata`), Mailpit no compose de dev, Caddy como reverse proxy com TLS (B14). Nginx serve o front; Caddy roteia `/api/*` para a API.
- Migrações Prisma versionadas; `npm run db:migrate` no deploy (job antes do `up -d`).
- Backup: cron diário `pg_dump | gzip` para `./backups`, retenção 14 dias; documentar restore no README.
- Variáveis: `DATABASE_URL`, `SESSION_SECRET`, `EMAIL_PROVIDER_KEY`, `EMAIL_FROM`, `APP_URL`, `ADMIN_EMAILS`, `TURNSTILE_SECRET`, `GEOIP_DB_PATH`. `.env.example` obrigatório. Nunca commitar segredos.

# MODELO DE DADOS (Prisma)
User { id uuid, email citext unique, emailVerifiedAt?, passwordHash, name, phoneE164?, phoneCountry? (ISO2), countryCode (ISO2), language (enum dos 8 códigos do app), status enum(PENDING, ACTIVE, BLOCKED, DELETED), blockedReason?, blockedAt?, blockedById?, role enum(USER, ADMIN), referralCode unique (8 chars, sem 0/O/1/I), referredById?, termsAcceptedAt, marketingOptIn bool, createdAt, updatedAt, deletedAt? }
Session { id, userId, tokenHash unique, createdAt, expiresAt, lastSeenAt, ip, userAgent, revokedAt? }
EmailToken { id, userId, type enum(VERIFY_EMAIL, RESET_PASSWORD, CHANGE_EMAIL), tokenHash unique, expiresAt, usedAt?, createdAt }
AccessLog { id bigserial, userId?, email? (tentativa), event enum(LOGIN_OK, LOGIN_FAIL, LOGOUT, SIGNUP, VERIFY, RESET_REQUEST, RESET_OK, BLOCKED_ATTEMPT, ADMIN_BLOCK, ADMIN_UNBLOCK, SESSION_REVOKE), ip inet, country?, userAgent, detail? jsonb, createdAt } — índice (userId, createdAt), (createdAt); purga > 180 dias (B9).
Referral { id, referrerId, channel enum(WHATSAPP, EMAIL, LINK), inviteeEmail?, inviteePhone?, code, sentAt, acceptedById?, acceptedAt? }
LoginAttempt (ou usar Redis-less: tabela pequena) { key (email|ip), count, windowStart } para lockout (B10).
Countries: não vai no banco — `packages/shared/countries.ts` com ISO 3166-1 alpha-2, DDI (calling code) e ordenação; nomes via `Intl.DisplayNames(locale, {type:'region'})`.

# API (prefixo /api/v1, JSON, Zod em entrada e saída, erros RFC 7807)
Auth: POST /auth/signup · POST /auth/verify-email · POST /auth/resend-verification · POST /auth/login · POST /auth/logout · POST /auth/forgot-password · POST /auth/reset-password · GET /auth/me · PATCH /auth/me (nome, telefone, país, idioma) · POST /auth/change-password · DELETE /auth/me (soft delete, B12) · GET /auth/me/export (JSON dos dados do usuário, B12) · GET /auth/sessions · DELETE /auth/sessions/:id.
Referral: GET /referrals/me (código + link + estatísticas) · POST /referrals/invite { channel, email? , phone? } (e-mail enviado pelo servidor no idioma do convidado quando conhecido; WhatsApp devolve a URL `https://wa.me/<phone>?text=` já codificada com mensagem traduzida + link `APP_URL/r/<code>`) · GET /r/:code (front: guarda o código em localStorage e abre o cadastro com `referredBy`).
Admin (role ADMIN, todas com AccessLog): GET /admin/users?q=&status=&country=&page= · GET /admin/users/:id (perfil + últimas 50 sessões/acessos + indicações) · POST /admin/users/:id/block { reason } · POST /admin/users/:id/unblock · POST /admin/users/:id/revoke-sessions · GET /admin/access-logs?userId=&event=&from=&to=&page= · GET /admin/stats (cadastros/logins por dia, top países) · GET /admin/export/users.csv.
Regras: cookies httpOnly + SameSite=Lax + Secure; CSRF por cabeçalho `X-Requested-With` + Origin check; rate limit por IP e por e-mail nos endpoints de auth; lockout 15 min após 10 falhas; respostas de login/forgot idênticas para e-mail inexistente (não vazar cadastro); tokens de e-mail de uso único, 24 h (verify) / 1 h (reset), armazenados como hash; senha mínima 10 chars + checagem HIBP k-anonymity (B16); Turnstile no signup e no forgot (B17); usuário BLOCKED/DELETED não autentica e sessões são revogadas ao bloquear.

# E-MAILS (8 idiomas, templates React Email)
verify-email, reset-password, welcome (após verificação), referral-invite, account-blocked (opcional, B10). Remetente `EMAIL_FROM`; links absolutos com `APP_URL`; texto simples alternativo; assunto e corpo no idioma do usuário (ou do convidado). Em dev, tudo cai no Mailpit.

# FRONT (apps/web)
- Rotas novas: `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/account` (perfil, sessões, indicações, excluir conta), `/r/:code`, `/admin/users`, `/admin/users/:id`, `/admin/access-logs` (a área de skins existente passa para `/admin/skins`; `/admin/*` exige ADMIN).
- Cabeçalho: avatar/nome ou botão "Entrar"; o replayer segue acessível sem conta.
- Formulário de cadastro: nome, e-mail, senha (medidor), telefone com seletor de país (bandeira + DDI, busca), país de origem (lista com bandeiras, pré-selecionado pelo idioma do browser), idioma principal (8 do app, pré-selecionado pelo idioma atual), checkbox termos/privacidade, opt-in marketing, Turnstile.
- Indicar amigo: botão na conta e no cabeçalho → modal com link copiável, botão WhatsApp (abre `wa.me`) e formulário de e-mail.
- Admin: tabela paginada com busca, filtros, status colorido, ações bloquear/desbloquear com motivo, detalhe com timeline de acessos (país, IP, UA), gráficos simples (cadastros e logins por dia) e exportar CSV.
- Todos os textos via i18next (chaves novas nos 8 JSON; `check:locales` continua obrigatório).

# TESTES E QUALIDADE
- API: Vitest + Supertest contra Postgres de teste (Testcontainers ou compose de CI): signup→verify→login→logout, forgot→reset, lockout, bloqueio revoga sessões, admin sem role recebe 403, referral aceito vincula `referredById`, purga de logs.
- Front: testes de formulário (validação de telefone/país) e do fluxo de login com MSW.
- CI: lint + testes API e web + build + migrações `prisma migrate diff --exit-code`.

# ENTREGÁVEIS
1. `apps/api` completo com Prisma schema, migrações, seed (admin de `ADMIN_EMAILS`, países não vão no banco).
2. Front com as rotas acima e i18n nos 8 idiomas.
3. `docker-compose.yml` atualizado (postgres, api, web, caddy, mailpit em dev), workflow com job de migração, README (variáveis, backup/restore, como promover admin).
4. Documento `SECURITY.md` resumindo as decisões (hash, sessões, tokens, rate limit, lockout, CSRF, LGPD).

# CRITÉRIOS DE ACEITAÇÃO
- Cadastro em pt-BR envia e-mail em pt-BR; link verifica e faz login automático.
- Login com senha errada 10× bloqueia por 15 min; admin vê os `LOGIN_FAIL` com IP e país.
- Admin bloqueia usuário → sessões dele caem em < 1 s (próxima requisição recebe 401 com motivo genérico).
- "Esqueci minha senha" com e-mail inexistente responde igual ao existente e não envia nada.
- Indicar por WhatsApp abre `wa.me` com mensagem no idioma do usuário e link `/r/<code>`; quem se cadastra por esse link aparece na lista de indicados do referenciador.
- `docker compose up` sobe postgres+api+web+caddy; push na `main` roda migrações e faz deploy.
- Nenhuma senha, token ou segredo aparece em logs; `AccessLog` não guarda senhas nem tokens.

# PROCESSO
1. Confirmar as respostas da Parte 1 (B1–B20); listar as suposições restantes e prosseguir com os defaults.
2. Ordem: schema Prisma + migrações → API de auth + testes → e-mails → front de auth → indicação → área admin → compose/CI/README → SECURITY.md.
3. Ao final de cada etapa: como rodar e o que testar manualmente.
```
