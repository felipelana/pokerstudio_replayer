# Segurança — PokerStudio Replayer

Decisões implementadas, com o arquivo onde vivem.

## Senhas e segredos

| Item | Decisão |
|---|---|
| Hash de senha | **Argon2id** (`memoryCost 19456`, `timeCost 2`, `parallelism 1`) — `infrastructure/crypto` |
| Política | mínimo **10 caracteres** + verificação **HIBP k-anonymity** (só os 5 primeiros caracteres do SHA-1 saem do servidor; nunca a senha). Falha do serviço não bloqueia o cadastro |
| Tokens de sessão e e-mail | 32 bytes aleatórios entregues ao usuário; no banco só o **SHA-256** — vazamento do banco não permite replay |
| Segredos em repouso | **AES-256-GCM** com `ENCRYPTION_KEY` (semente TOTP, chave do provedor de e-mail) |
| Senha do admin inicial | nunca no repositório: lida de `ADMIN_BOOTSTRAP_PASSWORD` e gravada só como hash. Remover do ambiente após o primeiro login |

## Sessões

- Cookie `ps_session`: **httpOnly**, `SameSite=Lax`, `Secure` em produção,
  escopo `.pokerstudio.com.br` para SSO entre subdomínios.
- Persistida no banco e **revogável** (pelo usuário e pelo admin).
- 24 h por padrão, 30 dias com "lembrar-me".
- Bloquear um usuário revoga todas as sessões dele no mesmo passo; a próxima
  requisição recebe 401 — coberto por teste e2e.
- Trocar a senha revoga todas as sessões.

## Autenticação e enumeração

- Login e "esqueci minha senha" respondem **exatamente igual** para e-mail
  existente e inexistente; nada é enviado para endereço desconhecido.
- **Lockout**: 10 falhas em 15 min bloqueiam por 15 min, por e-mail **e** por IP.
- Rate limit global (300/min) e específico nas rotas de auth.
- Conta `BLOCKED`/`DELETED` não autentica, com mensagem genérica.
- Tokens de e-mail são de **uso único**: 24 h (verificação) e 1 h (reset).

## Área administrativa

- `/admstudio` exige **role ADMIN** e sessão com o **segundo fator conferido**;
  sem 2FA a resposta é 403 `two_factor_required` — coberto por teste e2e.
- TOTP com janela ±1 e **proteção contra replay** pelo número do passo.
- Códigos de recuperação guardados como hash, de uso único.
- Login administrativo **não** aceita Google: federar o painel ampliaria a
  superfície de ataque.

## Cabeçalhos e CSRF

- Helmet com CSP sem `unsafe-eval`, `frame-ancestors 'none'`, HSTS em produção,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **CORS restrito** às origens do produto.
- **CSRF**: toda requisição que muda estado exige `X-Requested-With` e origem
  conhecida — um formulário cross-site não consegue enviar esse cabeçalho.

## Registro

- `AccessLog` guarda IP, país (GeoIP **offline**), user-agent, dispositivo, SO,
  navegador, origem e o resultado — **nunca** senha, token ou segredo.
- Retenção de **180 dias** com expurgo automático diário.
- GeoIP sem banco configurado não resolve nada em vez de chamar serviço externo
  com o endereço do usuário.

## Dados e LGPD

- Exportar dados e excluir conta são self-service.
- Exclusão é lógica, com remoção definitiva em 30 dias.
- Gravar hand history e anotações no servidor é **opt-in explícito**.
- Medição de uso só é gravada após o aceite no aviso de cookies.

## Erros

- Falha inesperada nunca devolve stack trace: em produção a mensagem é genérica.
- Erros de framework preservam o status real (um corpo malformado é 400, não 500).
- Todas as respostas de erro seguem **RFC 7807**.

## Pendências antes de ir ao ar

- [ ] SPF, DKIM e DMARC para `pokerstudio.com.br` no provedor de e-mail.
- [ ] Chave real do Turnstile (sem chave, o captcha passa — só aceitável localmente).
- [ ] Base GeoLite2 em `GEOIP_DB_PATH`.
- [ ] `npm audit` sem severidade alta/crítica e Dependabot ligado.
- [ ] Revisão jurídica dos termos e da política de privacidade.
- [ ] Varredura do histórico do git em busca de segredo commitado.
