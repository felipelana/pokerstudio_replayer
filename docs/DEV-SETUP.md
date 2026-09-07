# Ambiente de desenvolvimento — Windows 11 Pro

Comandos em **PowerShell**. O monorepo usa npm workspaces; tudo é executado da raiz salvo indicação contrária.

## 1. Node 22+

```powershell
winget install OpenJS.NodeJS.LTS
node --version
```

## 2. PostgreSQL 16 nativo

```powershell
winget install --id PostgreSQL.PostgreSQL.16 --silent --accept-package-agreements --accept-source-agreements
```

Depois da instalação:

1. **Serviço automático** — confirme que sobe no boot:
   ```powershell
   Get-Service postgresql*        # deve aparecer Running
   Set-Service postgresql-x64-16 -StartupType Automatic
   ```
2. **PATH** — adicione o cliente:
   ```powershell
   [Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\Program Files\PostgreSQL\16\bin', 'User')
   ```
   Reabra o terminal e teste: `psql --version`
3. **Conexão do superusuário**:
   ```powershell
   $env:PGPASSWORD='<senha definida na instalação>'
   psql -U postgres -h localhost -c "SELECT version();"
   ```
4. **Firewall** — o Postgres só precisa aceitar conexões locais. Não abra a
   porta 5432 para a rede; se alguma regra existir, restrinja a `127.0.0.1`.

## 3. Role e base dedicadas

```sql
-- psql -U postgres -h localhost
CREATE ROLE pokerstudio LOGIN PASSWORD 'troque-esta-senha';
-- necessário para o shadow database das migrações em desenvolvimento
ALTER ROLE pokerstudio CREATEDB;
CREATE DATABASE pokerstudio_dev OWNER pokerstudio ENCODING 'UTF8';
CREATE DATABASE pokerstudio_test OWNER pokerstudio ENCODING 'UTF8';
\c pokerstudio_dev
CREATE EXTENSION IF NOT EXISTS citext;
\c pokerstudio_test
CREATE EXTENSION IF NOT EXISTS citext;
```

> A extensão `citext` também é criada pela migração inicial; o comando acima
> serve para bancos preparados manualmente.

**Porta ocupada?** Se 5432 já estiver em uso, instale em outra (ex.: 5433) e
reflita na `DATABASE_URL`.

## 4. Variáveis de ambiente

```powershell
Copy-Item apps\api\.env.example apps\api\.env.local
```

Edite `apps/api/.env.local`:

| Variável | O que é |
|---|---|
| `DATABASE_URL` | `postgresql://pokerstudio:<senha>@localhost:5432/pokerstudio_dev?schema=public` |
| `SESSION_SECRET` | string longa e aleatória |
| `ENCRYPTION_KEY` | 32 bytes em hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAILS` | e-mails promovidos a ADMIN no cadastro |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | conta inicial criada pelo seed; **remova a senha do ambiente após o primeiro login** |
| `EMAIL_PROVIDER_KEY` | vazio mantém tudo na fila `EmailOutbox` (o cadastro funciona sem provedor) |

`.env.local` está no `.gitignore` e **nunca** deve ser commitado.

## 5. Instalar e migrar

```powershell
npm install
npm run db:migrate -w @pokerstudio/api    # aplica as migrações versionadas
npm run db:seed -w @pokerstudio/api       # cria/promove o admin (idempotente)
```

Outros scripts:

| Comando | Efeito |
|---|---|
| `npm run db:reset -w @pokerstudio/api` | apaga e recria o banco de desenvolvimento |
| `npm run db:studio -w @pokerstudio/api` | abre o Prisma Studio |
| `npm run dev -w @pokerstudio/api` | sobe a API em `http://localhost:3001` |
| `npm run dev` | sobe o replayer em `http://localhost:5173` |

## 6. Testes

```powershell
npm test                       # todos os workspaces
npm test -w @pokerstudio/web   # replayer
npm test -w @pokerstudio/api   # unitários + e2e contra pokerstudio_test
```

Os testes e2e usam `TEST_DATABASE_URL` (padrão: `pokerstudio_test`) e limpam as
tabelas antes de rodar. Aplique as migrações nesse banco uma vez:

```powershell
$env:DATABASE_URL="postgresql://pokerstudio:<senha>@localhost:5432/pokerstudio_test?schema=public"
npm run db:migrate -w @pokerstudio/api
```

## 7. E-mails em desenvolvimento

Duas opções:

1. **Sem nada instalado (padrão)** — sem `EMAIL_PROVIDER_KEY`, as mensagens vão
   para a tabela `EmailOutbox` com status `PENDING` e o link de verificação é
   impresso no log do servidor. Dá para concluir cadastro e recuperação de
   senha sem serviço de e-mail.
2. **Mailpit** (precisa do Docker Desktop):
   ```powershell
   docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
   ```
   Interface em `http://localhost:8025`. Sem Docker na máquina, use a opção 1.

## 8. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `P1012 shadow database` | falta `ALTER ROLE pokerstudio CREATEDB` |
| `P1001 can't reach database` | serviço parado (`Get-Service postgresql*`) ou porta diferente |
| `permission denied for schema public` | rode `GRANT ALL ON SCHEMA public TO pokerstudio;` no banco |
| `prisma migrate dev` reclama de ambiente não interativo | use `npm run db:migrate` (deploy) ou rode o comando num terminal interativo |
| API sobe mas responde 404 estranho | outra aplicação já ocupa a porta 3001 — rode com `PORT=3005` e ajuste o proxy do Vite |
