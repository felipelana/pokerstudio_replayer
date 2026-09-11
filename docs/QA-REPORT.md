# QA — estado verificado em 2026-09-07

Tudo abaixo foi **executado**, não estimado. Onde algo não foi verificado, está
dito explicitamente.

## 1. Automação

| Verificação                       | Comando                       | Resultado                                                                                                  |
| --------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Tipos do replayer                 | `tsc -p tsconfig.json`        | ✅ sem erros                                                                                               |
| Tipos da API                      | `tsc -p tsconfig.server.json` | ✅ sem erros                                                                                               |
| Lint (com as regras de fronteira) | `npm run lint`                | ✅ sem erros                                                                                               |
| Testes do replayer                | `npm run test:web`            | ✅ **87 testes**                                                                                           |
| Testes da API                     | `npm test`                    | ✅ **69 testes** (auth, Google, Apple/Facebook, TOTP, conta, reviews e e2e contra PostgreSQL real)         |
| Chaves de i18n                    | `npm run check:locales`       | ✅ **597 chaves × 8 idiomas**, nenhuma faltando                                                            |
| Build de produção                 | `npm run build`               | ✅                                                                                                         |
| Migrações                         | `prisma migrate deploy`       | ✅ 18 tabelas + os eventos TOTP no enum `AccessEvent`, aplicadas em `pokerstudio_dev` e `pokerstudio_test` |

## 2. Fluxos conferidos no navegador

| Fluxo                                 | Como foi verificado                                     | Resultado                                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login obrigatório                     | abrir `/` sem sessão                                    | ✅ redireciona para `/login`                                                                                                                                              |
| Cadastro → sessão → biblioteca        | preenchido e enviado pela UI                            | ✅ conta criada no Postgres, cookie emitido, nome no cabeçalho                                                                                                            |
| **Skin salva na conta**               | duplicar skin no `/admstudio` → "Salvar na minha conta" | ✅ linha em `UserSkin` (1653 bytes de JSON) ligada ao usuário                                                                                                             |
| API viva                              | `GET /health`, login errado, login sem CSRF             | ✅ `{"ok":true}`, 401 RFC 7807 genérico, 403 `csrf`                                                                                                                       |
| Sem sobreposição na mesa              | teste de colisão no DOM (2D)                            | ✅ `conflicts: []`, `outsideFelt: []`                                                                                                                                     |
| Sobreposição no 3D                    | 10 overlays HTML medidos                                | ✅ `conflicts: []`                                                                                                                                                        |
| Formatos de mesa                      | trocar skin (racetrack/oval/elipse)                     | ✅ contorno, borda, entalhe e neon acompanham                                                                                                                             |
| Relatório                             | marcar mão, capturar mesa, exportar                     | ✅ PDF e DOCX gerados (`pokerstars-demo-txt.pdf/.docx`)                                                                                                                   |
| Marca d'água                          | skins padrão                                            | ✅ logo PokerStudio centralizado, preto removido por alfa                                                                                                                 |
| **Botão do Google**                   | `/login` e `/signup` com as credenciais preenchidas     | ✅ marca oficial de quatro cores sobre branco, separador "ou" acima do formulário                                                                                         |
| **Botões escondidos sem credenciais** | subir a API sem as variáveis do provedor                | ✅ `GET /auth/providers` responde `false` e o botão não é renderizado                                                                                                     |
| **Três provedores**                   | API com Google, Facebook e Apple configurados           | ✅ os três botões aparecem com a marca de cada um, e `/auth/{google,facebook,apple}` devolvem 302 para o endereço correto do provedor                                     |
| **Início do OAuth**                   | `GET /api/v1/auth/google?redirect=/&ref=…`              | ✅ 302 para `accounts.google.com` com `scope=openid email profile`, `code_challenge_method=S256`, `prompt=select_account` e cookie `ps_oauth` httpOnly/SameSite=Lax/600 s |
| **Erro do OAuth na tela**             | `/login?error=link_requires_verification`               | ✅ aviso traduzido acima do botão, sem detalhe técnico                                                                                                                    |
| **Tela de entrada com a marca**       | `/login`, `/signup`, `/forgot-password`                 | ✅ fundo preto com halo vermelho, logotipo PokerStudio e botão primário vermelho                                                                                          |
| **Editar o perfil**                   | `/account` → trocar o nome → Salvar                     | ✅ 200, "Salvo", nome novo no cabeçalho na hora                                                                                                                           |
| **Traduções**                         | trocar o idioma no seletor                              | ✅ russo, japonês e os demais sem cair para o inglês                                                                                                                      |
| **Review para a conta**               | biblioteca → "Enviar para a conta"                      | ✅ 201, 17 mãos e os hand histories gravados em `ReviewSession`/`HandRecord`                                                                                              |
| **Posição sincronizada**              | abrir a review, pular para a 5ª mão                     | ✅ um único `PATCH` (debounce de 4 s) e `currentHandIndex = 4` no banco                                                                                                   |
| **Quota do dia**                      | painel da biblioteca                                    | ✅ "1 de 20 hoje" logo após o envio                                                                                                                                       |

## 3. Segurança conferida por teste

| Item                        | Prova                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Sem enumeração de contas    | login e forgot devolvem resposta idêntica para e-mail conhecido e desconhecido (2 testes) |
| Lockout                     | 10 falhas bloqueiam por 15 min (teste)                                                    |
| Bloqueio derruba sessão     | 200 antes, 401 depois, na mesma sessão (e2e)                                              |
| `/admin` sem role           | 403 `forbidden` (e2e)                                                                     |
| `/admin` com role e sem 2FA | 403 `two_factor_required` (e2e)                                                           |
| CSRF                        | POST sem `X-Requested-With` → 403 (e2e)                                                   |
| Skin isolada por usuário    | outra conta não enxerga (teste)                                                           |
| Sem segredo em resposta     | `/auth/me` não contém `passwordHash` (e2e)                                                |
| Sem segredo em log          | `AccessLog.detail` não contém a senha (e2e)                                               |
| Dispositivo no servidor     | UA de iPhone → `deviceType = MOBILE` (e2e)                                                |

## 4. Não verificado / pendente

**Do prompt, ainda não implementado:**

- `/admstudio` como área própria: as rotas de API existem e estão protegidas,
  mas a **interface** administrativa (lista de usuários, log, dashboard,
  configurações de e-mail) ainda não foi construída. Hoje `/admin` é o editor de
  skins.
- **2FA (TOTP)**: o provider, o modelo e a exigência na porta existem e são
  testados; faltam os endpoints de _enrollment_ e a tela de QR code.
- **Login com Google (5E)**: modelado (`AuthIdentity`, `googleEnabled`), não
  implementado.
- **Review na nuvem (5C)**: tabelas prontas (`ReviewSession`, `HandRecord`,
  `ReviewNote`); endpoints e sincronização ainda não.
- `PATCH /auth/me`, troca de senha autenticada, exclusão de conta e exportação
  de dados: especificados em `docs/API.md`, não implementados.
- **Parsers das novas salas** — adiado a pedido do dono do produto.
- Tradução dos textos de auth para es/de/ru/zh/ja/ko: as chaves existem em todos
  os idiomas, mas com o texto em inglês. Os demais 400+ termos estão traduzidos.
- Extração final de `domain` no front, concluída em `src/domain` (ver
  `docs/ARCHITECTURE.md` §6).

**Verificações que dependem de ambiente que não existe aqui:**

- `docker compose up` na VPS (sem Docker nesta máquina).
- TLS em `replayer.pokerstudio.com.br` (domínio ainda não publicado).
- Envio real de e-mail (sem provedor configurado — tudo cai em `EmailOutbox`,
  que é o comportamento desenhado).
- Captcha Turnstile (sem chave, o verificador passa direto).
- GeoIP (sem base MaxMind, o país não é resolvido).

**Limitação conhecida:**

- A captura da mesa para o relatório inclui feltro, cartas e fichas, mas **não
  as placas dos jogadores** — elas são HTML sobre o canvas/SVG. Duas saídas:
  desenhar os pods no canvas de captura ou adicionar `html2canvas`.

### /admstudio no navegador

| Fluxo                     | Como foi verificado                                         | Resultado                                                            |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Acesso negado sem o papel | abrir `/admstudio` como `USER`                              | ✅ "Só para administradores", e a API recusa igual                   |
| Portão do segundo fator   | abrir como `ADMIN` sem TOTP                                 | ✅ a área não aparece; a tela de inscrição toma o lugar              |
| Inscrição TOTP            | "Começar" → chave na tela → código gerado pelo autenticador | ✅ confirmada, 10 códigos de recuperação exibidos uma vez            |
| Painel                    | após a confirmação                                          | ✅ 5 números, duas séries de 30 dias, dispositivos e skins           |
| Usuários                  | lista, busca, paginação, ficha lateral                      | ✅ 2 contas, sessões, acessos, bloquear/desbloquear/derrubar sessões |
| Acessos                   | filtro por evento e data                                    | ✅ 6 registros, incluindo `TOTP_ENROLL_STARTED` e `TOTP_ENROLLED`    |
| Fila de e-mail            | aba E-mail                                                  | ✅ mensagem `PENDING` de verificação listada                         |

A conta de teste usada nessa passagem foi promovida a `ADMIN` só para o exercício e devolvida a
`USER` em seguida, com a inscrição TOTP apagada.

### O QR ainda não é uma imagem

A tela de inscrição mostra a **chave de configuração** (para digitar no autenticador) e um link
`otpauth://`, não um QR desenhado: renderizar o código exigiria uma dependência nova
(`qrcode` ou equivalente), que ainda não foi autorizada. O fluxo funciona por inteiro sem ela.

### Conta com o Google — o que ainda não foi exercitado

A **volta completa do Google** (consentimento real → `callback` → sessão) não foi executada:
depende de um `client_id` de verdade, que só existe depois de criar o projeto no Google Cloud
(passo a passo no README). O que está coberto: os 14 testes de `tests/google.test.ts` — validação
do `id_token` (assinatura, `aud`, `iss`, `exp`, `nonce`, `email_verified`), criação de conta,
vínculo com conta verificada, recusa de conta não verificada e de conta bloqueada, indicação
preservada e método registrado no log — mais a ida ao Google conferida no navegador.
A seção "Contas conectadas" da página `/account` foi checada por tipos e build, não por clique
(exigiria entrar com uma senha real).

## 5. Anotações operacionais

- A porta **3001** estava ocupada por outro processo Node nesta máquina; a API
  local está configurada em **3005** (`PORT`), e o proxy do Vite aponta para lá.
- O banco de desenvolvimento é `pokerstudio_dev` e o de teste `pokerstudio_test`,
  ambos com a role `pokerstudio` (que tem `CREATEDB` para o shadow database).
- A conta administradora inicial foi criada pelo seed a partir de
  `ADMIN_BOOTSTRAP_*` em `.env.local` (fora do versionamento). **Troque
  a senha no primeiro acesso e remova a variável.**
