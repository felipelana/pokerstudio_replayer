# QA — estado verificado em 2026-09-07

Tudo abaixo foi **executado**, não estimado. Onde algo não foi verificado, está
dito explicitamente.

## 1. Automação

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos do replayer | `tsc -p apps/web` | ✅ sem erros |
| Tipos da API | `tsc -p apps/api` | ✅ sem erros |
| Lint (com as regras de fronteira) | `npm run lint` | ✅ sem erros |
| Testes do replayer | `npm test -w @pokerstudio/web` | ✅ **87 testes** |
| Testes da API | `npm test -w @pokerstudio/api` | ✅ **23 testes** (15 unitários + 8 e2e contra PostgreSQL real) |
| Chaves de i18n | `npm run check:locales` | ✅ **489 chaves × 8 idiomas**, nenhuma faltando |
| Build de produção | `npm run build` | ✅ |
| Migrações | `prisma migrate deploy` | ✅ 18 tabelas criadas em `pokerstudio_dev` e `pokerstudio_test` |

## 2. Fluxos conferidos no navegador

| Fluxo | Como foi verificado | Resultado |
|---|---|---|
| Login obrigatório | abrir `/` sem sessão | ✅ redireciona para `/login` |
| Cadastro → sessão → biblioteca | preenchido e enviado pela UI | ✅ conta criada no Postgres, cookie emitido, nome no cabeçalho |
| **Skin salva na conta** | duplicar skin no `/admstudio` → "Salvar na minha conta" | ✅ linha em `UserSkin` (1653 bytes de JSON) ligada ao usuário |
| API viva | `GET /health`, login errado, login sem CSRF | ✅ `{"ok":true}`, 401 RFC 7807 genérico, 403 `csrf` |
| Sem sobreposição na mesa | teste de colisão no DOM (2D) | ✅ `conflicts: []`, `outsideFelt: []` |
| Sobreposição no 3D | 10 overlays HTML medidos | ✅ `conflicts: []` |
| Formatos de mesa | trocar skin (racetrack/oval/elipse) | ✅ contorno, borda, entalhe e neon acompanham |
| Relatório | marcar mão, capturar mesa, exportar | ✅ PDF e DOCX gerados (`pokerstars-demo-txt.pdf/.docx`) |
| Marca d'água | skins padrão | ✅ logo PokerStudio centralizado, preto removido por alfa |

## 3. Segurança conferida por teste

| Item | Prova |
|---|---|
| Sem enumeração de contas | login e forgot devolvem resposta idêntica para e-mail conhecido e desconhecido (2 testes) |
| Lockout | 10 falhas bloqueiam por 15 min (teste) |
| Bloqueio derruba sessão | 200 antes, 401 depois, na mesma sessão (e2e) |
| `/admin` sem role | 403 `forbidden` (e2e) |
| `/admin` com role e sem 2FA | 403 `two_factor_required` (e2e) |
| CSRF | POST sem `X-Requested-With` → 403 (e2e) |
| Skin isolada por usuário | outra conta não enxerga (teste) |
| Sem segredo em resposta | `/auth/me` não contém `passwordHash` (e2e) |
| Sem segredo em log | `AccessLog.detail` não contém a senha (e2e) |
| Dispositivo no servidor | UA de iPhone → `deviceType = MOBILE` (e2e) |

## 4. Não verificado / pendente

**Do prompt, ainda não implementado:**

- `/admstudio` como área própria: as rotas de API existem e estão protegidas,
  mas a **interface** administrativa (lista de usuários, log, dashboard,
  configurações de e-mail) ainda não foi construída. Hoje `/admin` é o editor de
  skins.
- **2FA (TOTP)**: o provider, o modelo e a exigência na porta existem e são
  testados; faltam os endpoints de *enrollment* e a tela de QR code.
- **Login com Google (5E)**: modelado (`AuthIdentity`, `googleEnabled`), não
  implementado.
- **Review na nuvem (5C)**: tabelas prontas (`ReviewSession`, `HandRecord`,
  `ReviewNote`); endpoints e sincronização ainda não.
- `PATCH /auth/me`, troca de senha autenticada, exclusão de conta e exportação
  de dados: especificados em `docs/API.md`, não implementados.
- **Parsers das novas salas** — adiado a pedido do dono do produto.
- Tradução dos textos de auth para es/de/ru/zh/ja/ko: as chaves existem em todos
  os idiomas, mas com o texto em inglês. Os demais 400+ termos estão traduzidos.
- Extração final de `domain`/`application` dentro de `apps/web` (ver
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

## 5. Anotações operacionais

- A porta **3001** estava ocupada por outro processo Node nesta máquina; a API
  local está configurada em **3005** (`PORT`), e o proxy do Vite aponta para lá.
- O banco de desenvolvimento é `pokerstudio_dev` e o de teste `pokerstudio_test`,
  ambos com a role `pokerstudio` (que tem `CREATEDB` para o shadow database).
- A conta administradora inicial foi criada pelo seed a partir de
  `ADMIN_BOOTSTRAP_*` em `apps/api/.env.local` (fora do versionamento). **Troque
  a senha no primeiro acesso e remova a variável.**
