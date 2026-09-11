# API — inventário de rotas

Prefixo `/api/v1`. Entrada e saída validadas com Zod; erros em RFC 7807
(`application/problem+json`). Toda requisição que muda estado exige o cabeçalho
`X-Requested-With: XMLHttpRequest` e uma origem conhecida.

Níveis de acesso:

- **público** — sem sessão
- **usuário** — sessão válida
- **admin** — role ADMIN **e** sessão com 2FA conferido

| Método   | Rota                               | Acesso          | O que faz                                               | Situação |
| -------- | ---------------------------------- | --------------- | ------------------------------------------------------- | -------- |
| GET      | `/health`                          | público         | verificação de vida                                     | ✅       |
| POST     | `/auth/signup`                     | público         | cria conta, aplica indicação, enfileira verificação     | ✅       |
| POST     | `/auth/login`                      | público         | abre sessão (cookie httpOnly)                           | ✅       |
| POST     | `/auth/logout`                     | usuário         | revoga a sessão atual                                   | ✅       |
| POST     | `/auth/verify-email`               | público         | consome o token de verificação                          | ✅       |
| POST     | `/auth/forgot-password`            | público         | envia o link de redefinição                             | ✅       |
| POST     | `/auth/reset-password`             | público         | troca a senha e revoga sessões                          | ✅       |
| GET      | `/auth/me`                         | usuário         | perfil e identidades vinculadas                         | ✅       |
| GET      | `/auth/sessions`                   | usuário         | sessões ativas                                          | ✅       |
| DELETE   | `/auth/sessions/:id`               | usuário         | revoga uma sessão própria                               | ✅       |
| PATCH    | `/auth/me`                         | usuário         | edita nome, telefone, país, idioma                      | ✅       |
| POST     | `/auth/change-password`            | usuário         | troca a senha (ou define a primeira)                    | ✅       |
| DELETE   | `/auth/me`                         | usuário         | encerra a conta (anonimiza e revoga tudo)               | ✅       |
| GET      | `/auth/me/export`                  | usuário         | exporta os dados em JSON                                | ✅       |
| GET      | `/auth/providers`                  | público         | provedores configurados (`{ google, facebook, apple }`) | ✅       |
| GET      | `/auth/google`                     | público         | começa a entrada pelo Google                            | ✅       |
| GET      | `/auth/facebook`                   | público         | começa a entrada pelo Facebook                          | ✅       |
| GET      | `/auth/apple`                      | público         | começa a entrada pela Apple                             | ✅       |
| GET      | `/auth/google/callback`            | público         | volta do Google, troca o código e abre a sessão         | ✅       |
| GET      | `/auth/facebook/callback`          | público         | volta do Facebook, idem                                 | ✅       |
| GET      | `/auth/apple/callback`             | público         | volta da Apple por GET                                  | ✅       |
| POST     | `/auth/apple/callback`             | público         | a Apple responde por POST quando pede nome e e-mail     | ✅       |
| GET/POST | `/auth/apple/callback`             | público         | idem, Apple responde por `form_post`                    | ✅       |
| GET      | `/auth/identities`                 | usuário         | formas de entrar desta conta                            | ✅       |
| DELETE   | `/auth/identities/:provider`       | usuário         | desvincula (409 se for a última)                        | ✅       |
| GET      | `/skins`                           | usuário         | skins salvas na conta                                   | ✅       |
| PUT      | `/skins`                           | usuário         | salva/atualiza uma skin da conta                        | ✅       |
| DELETE   | `/skins/:skinId`                   | usuário         | remove uma skin                                         | ✅       |
| GET      | `/referrals/me`                    | usuário         | código, link e indicações                               | ✅       |
| POST     | `/referrals/invite`                | usuário         | convite por e-mail ou link do WhatsApp                  | ✅       |
| GET      | `/r/:code`                         | público         | resolve o código de indicação                           | ✅       |
| GET      | `/admin/users`                     | admin           | lista com busca e filtros                               | ✅       |
| GET      | `/admin/users/:id`                 | admin           | ficha, sessões, acessos, indicações                     | ✅       |
| POST     | `/admin/users/:id/block`           | admin           | bloqueia e revoga sessões                               | ✅       |
| POST     | `/admin/users/:id/unblock`         | admin           | desbloqueia                                             | ✅       |
| POST     | `/admin/users/:id/revoke-sessions` | admin           | derruba as sessões                                      | ✅       |
| GET      | `/admin/access-logs`               | admin           | log com filtros                                         | ✅       |
| GET      | `/admin/stats`                     | admin           | cadastros, logins, dispositivos, skins                  | ✅       |
| GET      | `/admin/export/users.csv`          | admin           | exporta usuários                                        | ✅       |
| GET      | `/admin/email-outbox`              | admin           | fila de e-mails pendentes                               | ✅       |
| POST     | `/admin/email-settings`            | admin           | configura provedor e envia teste                        | ⏳       |
| GET      | `/admin/2fa`                       | admin (sem 2FA) | situação da inscrição e da sessão                       | ✅       |
| POST     | `/admin/2fa/enroll`                | admin (sem 2FA) | inicia TOTP (chave + `otpauth://`)                      | ✅       |
| POST     | `/admin/2fa/verify`                | admin (sem 2FA) | confirma o código e libera a sessão                     | ✅       |
| POST     | `/admin/2fa/recovery`              | admin (sem 2FA) | queima um código de recuperação                         | ✅       |
| DELETE   | `/admin/2fa`                       | admin (sem 2FA) | desativa o TOTP (exige um código válido)                | ✅       |
| GET      | `/reviews`                         | usuário         | reviews da conta + quota do dia                         | ✅       |
| GET      | `/reviews/:id`                     | usuário         | uma review com mãos e anotações                         | ✅       |
| PUT      | `/reviews/:id`                     | usuário         | envia (ou substitui) uma review                         | ✅       |
| PATCH    | `/reviews/:id`                     | usuário         | grava a posição atual da review                         | ✅       |
| DELETE   | `/reviews/:id`                     | usuário         | remove a review da conta                                | ✅       |
| POST     | `/usage`                           | usuário/anônimo | evento de uso (só com consentimento)                    | ⏳       |

✅ implementado e coberto por teste · ⏳ especificado, ainda não implementado

## Regras transversais

- Sessão em cookie `ps_session` (httpOnly, SameSite=Lax, Secure em produção,
  domínio `.pokerstudio.com.br` para SSO entre as ferramentas do kit).
- Rate limit global de 300 req/min; `signup` 10/10 min, `login` 20/10 min,
  `forgot-password` 10/10 min, `referrals/invite` 20/h.
- Login e recuperação respondem igual para conta existente e inexistente.
- Nenhuma rota devolve `passwordHash`, token ou segredo.

## Entrar com um provedor

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

### Facebook e Apple

O fluxo é o mesmo para os três; só o objeto do provedor muda.

- **Facebook** é OAuth 2.0 puro, sem `id_token`: o perfil é lido no Graph API pelo canal
  servidor-a-servidor, com `appsecret_proof` (HMAC-SHA256 do access token sob o app secret), de
  modo que um token roubado não serve fora do nosso servidor. Conta sem e-mail é recusada.
- **Apple** não tem client secret: ele é um JWT **ES256** assinado por nós com a chave `.p8`,
  válido por uma hora. O `id_token` é verificado contra a JWKS da Apple, aceitando `aud` como
  lista e `email_verified` como a string `"true"`, que é o que a Apple manda. Como a Apple
  responde por `form_post`, o cookie de estado desse provedor vai com `SameSite=None; Secure`.

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

## Conta do próprio usuário

- `PATCH /auth/me` aceita apenas nome, telefone, país, idioma e a opção de novidades. E-mail,
  papel, plano e situação **não** se editam por aqui. País e idioma são validados contra as listas
  do pacote `shared`; telefone vazio limpa o campo.
- `POST /auth/change-password` exige a senha atual, recusa senha vazada (HIBP) e **revoga todas
  as sessões**, mantendo apenas a que fez a troca. Numa conta criada pelo Google (sem senha), a
  mesma rota define a primeira senha.
- `GET /auth/me/export` devolve perfil, formas de entrada, sessões, skins, indicações e o log de
  acesso — sem nenhum hash nem token (LGPD art. 18, V).
- `DELETE /auth/me` exige a senha quando existe uma. A linha permanece como `DELETED` com nome,
  telefone e senha apagados e o e-mail substituído por `deleted+<id>@invalid`, para que cadastros,
  indicações e o log continuem fechando as contas. Os vínculos e as sessões caem junto.

## Avaliação de mãos e compartilhamento com coach

O jogador avalia as próprias mãos e pode entregar a review a um coach por um
link com senha e prazo. O coach não tem conta: o que ele recebe é um cookie que
vale uma review, e o servidor confere o prazo e a revogação **a cada
requisição**, não uma vez na entrada.

| Método | Rota                             | Acesso  | O que faz                                                      | Situação |
| ------ | -------------------------------- | ------- | -------------------------------------------------------------- | -------- |
| GET    | `/reviews/:id/assessment`        | usuário | a própria avaliação de uma review, criando se não existir      | ✅       |
| GET    | `/reviews/:id/assessments`       | usuário | todas as leituras de uma review: a sua e a de cada coach       | ✅       |
| GET    | `/assessments/:id`               | usuário | uma avaliação, mão a mão, com os números                       | ✅       |
| PATCH  | `/assessments/:id/hands/:index`  | usuário | nota, marca de jogada certa, comentário e etiquetas de uma mão | ✅       |
| PATCH  | `/assessments/:id/progress`      | usuário | onde a leitura parou                                           | ✅       |
| POST   | `/assessments/:id/complete`      | usuário | conclui, e a partir daí não se altera                          | ✅       |
| GET    | `/share-settings`                | usuário | prazo padrão e prazo máximo de um link                         | ✅       |
| GET    | `/reviews/:id/invites`           | usuário | os links desta review, com o estado de cada um                 | ✅       |
| POST   | `/reviews/:id/invites`           | usuário | cria o link; `handIndex` opcional entrega uma mão só           | ✅       |
| POST   | `/invites/:id/revoke`            | usuário | fecha o acesso; o que o coach escreveu permanece               | ✅       |
| POST   | `/coach/open`                    | público | token do link mais senha, devolve o cookie do coach            | ✅       |
| POST   | `/coach/close`                   | coach   | encerra a visita                                               | ✅       |
| GET    | `/coach/session`                 | coach   | a review, o jogador e o prazo. O token na consulta é conferido | ✅       |
| GET    | `/coach/hands`                   | coach   | as mãos, só quando o jogador guardou os históricos             | ✅       |
| GET    | `/coach/assessment`              | coach   | a própria leitura do coach                                     | ✅       |
| PATCH  | `/coach/assessment/hands/:index` | coach   | escreve sobre uma mão                                          | ✅       |
| PATCH  | `/coach/assessment/progress`     | coach   | onde parou                                                     | ✅       |
| POST   | `/coach/assessment/complete`     | coach   | conclui e devolve ao jogador                                   | ✅       |

Notas que importam:

- A senha do link é guardada como hash Argon2id e **nunca viaja na URL**. O
  token vai no endereço, a senha vai por outro caminho, e um link encaminhado
  sozinho não abre nada.
- Um cookie de coach obtido por um link **não responde por outro**: quando o
  endereço nomeia um token, ele tem que ser o mesmo da invitação.
- `/coach/hands` devolve uma mão só quando o convite nomeia uma, e o filtro é
  no servidor, não no que a tela escolhe desenhar.
- O coach é recusado em todo o resto do produto: biblioteca, skins, admin e a
  autoavaliação do jogador.

## Sugestões e erros do navegador

| Método | Rota                         | Acesso  | O que faz                                            | Situação |
| ------ | ---------------------------- | ------- | ---------------------------------------------------- | -------- |
| POST   | `/feedback`                  | usuário | envia uma sugestão, assunto até 200 e texto até 1000 | ✅       |
| GET    | `/feedback/mine`             | usuário | as próprias sugestões                                | ✅       |
| GET    | `/admin/feedback`            | admin   | a fila                                               | ✅       |
| PATCH  | `/admin/feedback/:id`        | admin   | muda a situação de uma sugestão                      | ✅       |
| POST   | `/client-errors`             | público | uma falha no navegador, registrada para ser vista    | ✅       |
| PUT    | `/auth/me/room-nicks`        | usuário | os nicks por sala                                    | ✅       |
| GET    | `/admin/email-settings`      | admin   | como o envio esta configurado                        | ✅       |
| POST   | `/admin/email-settings/test` | admin   | dispara um e-mail de teste                           | ✅       |
| GET    | `/admin/error-logs`          | admin   | as falhas registradas, do servidor e do navegador    | ✅       |
| GET    | `/admin/error-logs/:id`      | admin   | uma falha, com a pilha e o contexto                  | ✅       |
| GET    | `/auth/me/room-nicks`        | usuário | os nicks por sala desta conta                        | ✅       |

## Reviews na conta (5C)

A biblioteca continua **local** (IndexedDB). O que vai para o servidor é uma cópia, para retomar
o estudo em outra máquina.

- O **id é do cliente**: é o id da sessão local. Mandar a mesma review duas vezes atualiza a linha
  em vez de criar outra — e só uma review nova conta contra a quota.
- **Quota**: `REVIEW_UPLOADS_PER_DAY` (padrão 20, resposta 3 do questionário), contada por
  `ReviewSession.createdAt` desde a meia-noite UTC. Estourou, `429 quota_exceeded`; atualizar uma
  review que já existe continua funcionando.
- `storeHandHistory` decide se o texto cru das mãos sobe. Sem o "sim", o servidor guarda o formato
  da review (resultado, posição, anotações) e **nenhum hand history**.
- `PUT` substitui as mãos por inteiro, para que o que está guardado seja igual ao que o cliente
  acabou de mandar — não é um merge de dois históricos de edição.
- `PATCH` é a escrita barata que o replayer faz enquanto o usuário anda pelas mãos, com 4 s de
  debounce; ao chegar na última mão a review vira `COMPLETED`.
- Toda rota é filtrada por `userId`: a review de outra conta não aparece, não é lida, não é
  alterada e não é apagada (`403`/`404`, nunca o dado do outro).
