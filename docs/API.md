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
| GET | `/auth/providers` | público | quais provedores estão configurados (`{ google }`) | ✅ |
| GET | `/auth/google` | público | inicia OAuth (Authorization Code + PKCE) | ✅ |
| GET | `/auth/google/callback` | público | conclui OAuth e abre sessão | ✅ |
| GET | `/auth/google/link` | usuário | diz se a conta já tem o Google vinculado | ✅ |
| DELETE | `/auth/google/link` | usuário | desvincula o Google (409 se for a única credencial) | ✅ |
| GET | `/skins` | usuário | skins salvas na conta | ✅ |
| PUT | `/skins` | usuário | salva/atualiza uma skin da conta | ✅ |
| DELETE | `/skins/:skinId` | usuário | remove uma skin | ✅ |
| GET | `/referrals/me` | usuário | código, link e indicações | ✅ |
| POST | `/referrals/invite` | usuário | convite por e-mail ou link do WhatsApp | ✅ |
| GET | `/r/:code` | público | resolve o código de indicação | ✅ |
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
| GET | `/admin/2fa` | admin (sem 2FA) | situação da inscrição e da sessão | ✅ |
| POST | `/admin/2fa/enroll` | admin (sem 2FA) | inicia TOTP (chave + `otpauth://`) | ✅ |
| POST | `/admin/2fa/verify` | admin (sem 2FA) | confirma o código e libera a sessão | ✅ |
| POST | `/admin/2fa/recovery` | admin (sem 2FA) | queima um código de recuperação | ✅ |
| DELETE | `/admin/2fa` | admin (sem 2FA) | desativa o TOTP (exige um código válido) | ✅ |
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

## Entrar com o Google

### Fluxo

1. O front pergunta `GET /auth/providers`. Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`
   a resposta é `{ "google": false }` e o botão simplesmente não aparece.
2. O botão é um link para `GET /auth/google?redirect=/&ref=CODIGO`. A rota sorteia `state`, `nonce` e
   `code_verifier` (PKCE S256), guarda os três num cookie `ps_oauth` assinado, httpOnly, `SameSite=Lax`,
   com validade de 10 minutos, e redireciona para o Google.
3. `GET /auth/google/callback` compara o `state`, troca o `code` pelo `id_token` e valida o token:
   assinatura RS256 contra a JWKS do Google, `iss`, `aud` igual ao nosso `client_id`, `exp`, `nonce`
   e `email_verified`.
4. A conta é resolvida nesta ordem: identidade já vinculada → conta local **com e-mail verificado**
   (vincula) → conta nova, já ativa. Uma conta local que nunca verificou o e-mail é recusada com
   `link_requires_verification`, para que ninguém tome uma conta apenas registrando o endereço.

### Erros

Qualquer falha volta para `${APP_URL}/login?error=<código>`, nunca com detalhe técnico na URL:
`google_cancelled`, `google_state` (pedido expirado ou adulterado), `google_failed`,
`google_email_unverified`, `link_requires_verification`, `account_unavailable`.

### Vínculo

`GET /auth/google/link` responde `{ linked }`. `DELETE /auth/google/link` desvincula, mas responde
409 `password_required` quando o Google é a única forma de entrar — o usuário precisa definir uma
senha antes.

### O parâmetro `redirect`

Só caminhos internos (`startsWith('/')`) são aceitos; qualquer outra coisa vira `/`. Isso fecha a
porta para usar o callback como redirecionador aberto.

## Segundo fator (administração)

As rotas `/admin/2fa/*` são as **únicas** sob `/admin` que não exigem o segundo fator já verificado —
apenas o papel `ADMIN`. Se exigissem, ninguém conseguiria se inscrever da primeira vez.

- `POST /admin/2fa/enroll` sorteia a semente, guarda cifrada (AES-256-GCM) e devolve a chave **uma
  única vez**, em texto e como `otpauth://`. Uma inscrição já confirmada recusa com
  `two_factor_already_enrolled`.
- `POST /admin/2fa/verify` aceita o código de 6 dígitos. O primeiro código válido confirma a
  inscrição e devolve **10 códigos de recuperação** (mostrados só nessa resposta; ficam salvos
  apenas como hash). Os seguintes apenas marcam a sessão como verificada.
- O mesmo código **não passa duas vezes**: o passo TOTP aceito fica gravado em `lastUsedStep`.
- `POST /admin/2fa/recovery` queima um código de recuperação e libera a sessão.
- `DELETE /admin/2fa` exige um código válido — a sessão sozinha não desliga a proteção.
