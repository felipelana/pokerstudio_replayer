# API — inventário de rotas

Prefixo `/api/v1`. Entrada e saída validadas com Zod; erros em RFC 7807
(`application/problem+json`). Toda requisição que muda estado exige o cabeçalho
`X-Requested-With: XMLHttpRequest` e uma origem conhecida.

Níveis de acesso:

- **público** — sem sessão
- **usuário** — sessão válida
- **admin** — role ADMIN **e** sessão com 2FA conferido

| Método | Rota | Acesso | O que faz | Situação |
|---|---|---|---|---|
| GET | `/health` | público | verificação de vida | ✅ |
| POST | `/auth/signup` | público | cria conta, aplica indicação, enfileira verificação | ✅ |
| POST | `/auth/login` | público | abre sessão (cookie httpOnly) | ✅ |
| POST | `/auth/logout` | usuário | revoga a sessão atual | ✅ |
| POST | `/auth/verify-email` | público | consome o token de verificação | ✅ |
| POST | `/auth/forgot-password` | público | envia o link de redefinição | ✅ |
| POST | `/auth/reset-password` | público | troca a senha e revoga sessões | ✅ |
| GET | `/auth/me` | usuário | perfil e identidades vinculadas | ✅ |
| GET | `/auth/sessions` | usuário | sessões ativas | ✅ |
| DELETE | `/auth/sessions/:id` | usuário | revoga uma sessão própria | ✅ |
| PATCH | `/auth/me` | usuário | edita nome, telefone, país, idioma | ⏳ |
| POST | `/auth/change-password` | usuário | troca a senha autenticado | ⏳ |
| DELETE | `/auth/me` | usuário | exclusão lógica da conta | ⏳ |
| GET | `/auth/me/export` | usuário | exporta os dados em JSON | ⏳ |
| GET | `/auth/google` | público | inicia OAuth (Authorization Code + PKCE) | ⏳ |
| GET | `/auth/google/callback` | público | conclui OAuth e abre sessão | ⏳ |
| GET | `/skins` | usuário | skins salvas na conta | ✅ |
| PUT | `/skins` | usuário | salva/atualiza uma skin da conta | ✅ |
| DELETE | `/skins/:skinId` | usuário | remove uma skin | ✅ |
| GET | `/referrals/me` | usuário | código, link e indicações | ✅ |
| POST | `/referrals/invite` | usuário | convite por e-mail ou link do WhatsApp | ✅ |
| GET | `/r/:code` | público | resolve o código de indicação | ⏳ |
| GET | `/admin/users` | admin | lista com busca e filtros | ✅ |
| GET | `/admin/users/:id` | admin | ficha, sessões, acessos, indicações | ✅ |
| POST | `/admin/users/:id/block` | admin | bloqueia e revoga sessões | ✅ |
| POST | `/admin/users/:id/unblock` | admin | desbloqueia | ✅ |
| POST | `/admin/users/:id/revoke-sessions` | admin | derruba as sessões | ✅ |
| GET | `/admin/access-logs` | admin | log com filtros | ✅ |
| GET | `/admin/stats` | admin | cadastros, logins, dispositivos, skins | ✅ |
| GET | `/admin/export/users.csv` | admin | exporta usuários | ✅ |
| GET | `/admin/email-outbox` | admin | fila de e-mails pendentes | ✅ |
| POST | `/admin/email-settings` | admin | configura provedor e envia teste | ⏳ |
| POST | `/admin/2fa/enroll` | admin | inicia TOTP (QR + códigos de recuperação) | ⏳ |
| POST | `/admin/2fa/verify` | admin | confirma o código e libera a sessão | ⏳ |
| GET/POST | `/reviews` | usuário | salvar e retomar review (5C) | ⏳ |
| POST | `/usage` | usuário/anônimo | evento de uso (só com consentimento) | ⏳ |

✅ implementado e coberto por teste · ⏳ especificado, ainda não implementado

## Regras transversais

- Sessão em cookie `ps_session` (httpOnly, SameSite=Lax, Secure em produção,
  domínio `.pokerstudio.com.br` para SSO entre as ferramentas do kit).
- Rate limit global de 300 req/min; `signup` 10/10 min, `login` 20/10 min,
  `forgot-password` 10/10 min, `referrals/invite` 20/h.
- Login e recuperação respondem igual para conta existente e inexistente.
- Nenhuma rota devolve `passwordHash`, token ou segredo.
