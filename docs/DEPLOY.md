# Deploy — staging e produção

Uma VPS Ubuntu (`185.214.135.167`), dois ambientes isolados, um proxy só.

| Ambiente | Replayer | Landing | Projeto Docker | Diretório |
| --- | --- | --- | --- | --- |
| Staging | `stage.replayer.pokerstudio.com.br` | `web.replayer.pokerstudio.com.br` | `pokerstudio-staging` | `/opt/pokerstudio/staging` |
| Produção | `replayer.pokerstudio.com.br` | `pokerstudio.com.br` | `pokerstudio-prod` | `/opt/pokerstudio/prod` |

Os quatro nomes apontam para o mesmo IP (registro `A`). O Caddy — um único
container, no projeto `pokerstudio-edge`, dono das portas 80 e 443 — emite um
certificado por nome via HTTP‑01 e encaminha cada host ao container certo. Nada
mais publica porta: staging e produção se falam com o proxy pela rede
`pokerstudio-edge`, e cada um tem o seu Postgres numa rede interna que não sai
do host.

Staging fica atrás de basic auth e responde `X-Robots-Tag: noindex`. A única
exceção é `/api/v1/health`, aberta para o pipeline conseguir se verificar.

## 1. Primeiro provisionamento

```bash
ssh root@185.214.135.167
apt-get update && apt-get install -y git
git clone https://github.com/felipelana/pokerstudioreplayer.git /opt/pokerstudio/repo
bash /opt/pokerstudio/repo/infra/scripts/provision-vps.sh deploy
```

O script instala Docker, liga o firewall (22, 80, 443), endurece o SSH, ativa
`fail2ban` e atualizações automáticas, cria o usuário `deploy`, monta
`/opt/pokerstudio/{staging,prod,edge}` a partir dos exemplos, cria a rede
`pokerstudio-edge` e agenda o backup noturno. É idempotente: rodar de novo não
quebra nada.

Ele **não** escreve segredo nenhum. Isso é seu:

```bash
# a chave que o pipeline vai usar
ssh-keygen -t ed25519 -C "deploy@pokerstudio" -f ~/.ssh/pokerstudio_deploy
# a pública vai para o servidor:
cat ~/.ssh/pokerstudio_deploy.pub >> /home/deploy/.ssh/authorized_keys
```

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 32   # SESSION_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY (64 caracteres hex, exatamente)
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'senha-do-staging'
```

Preencha `/opt/pokerstudio/staging/.env`, `/opt/pokerstudio/prod/.env` e
`/opt/pokerstudio/edge/.env` (todos `chmod 600`).

> **Armadilha:** o hash bcrypt do Caddy começa com `$2a$14$…`. Dentro de um
> `.env` lido pelo Docker Compose, todo `$` precisa virar `$$`, senão o Compose
> interpreta como variável e o basic auth nunca confere.

Com os DNS já propagados, suba o proxy:

```bash
cd /opt/pokerstudio/edge
docker compose -p pokerstudio-edge -f docker-compose.edge.yml up -d
docker compose -p pokerstudio-edge logs -f caddy   # acompanha a emissão dos certificados
```

## 2. Secrets no GitHub

`Settings → Secrets and variables → Actions`:

| Secret | Valor |
| --- | --- |
| `VPS_HOST` | `185.214.135.167` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | conteúdo de `~/.ssh/pokerstudio_deploy` (a chave **privada**) |
| `VPS_PORT` | `22` (opcional) |
| `STAGING_USER` | usuário do basic auth de staging |
| `STAGING_PASSWORD` | a senha em texto — só o smoke test a usa |

Em `Settings → Environments`, crie **`production`** e marque *Required
reviewers*. É esse ambiente que segura o deploy de produção esperando um
humano; o de staging não passa por lá e sobe sozinho.

O registry é o GHCR do próprio repositório
(`ghcr.io/felipelana/pokerstudioreplayer/{api,web,landing}`) e usa o
`GITHUB_TOKEN` do workflow — não há token a cadastrar.

## 3. Variáveis de cada ambiente

`infra/docker/.env.staging.example` e `.env.prod.example` são a referência. As
que mudam entre ambientes:

| Variável | Staging | Produção |
| --- | --- | --- |
| `APP_ENV` | `staging` | `production` |
| `APP_URL` | `https://stage.replayer.pokerstudio.com.br` | `https://replayer.pokerstudio.com.br` |
| `GOOGLE_REDIRECT_URI` | `…stage.replayer…/api/v1/auth/google/callback` | `…replayer…/api/v1/auth/google/callback` |
| `COOKIE_DOMAIN` | vazio | vazio |
| `ROBOTS_POLICY` | `noindex` | `index` |
| `ERROR_LOG_RETENTION_DAYS` | `14` | `30` |
| `EMAIL_PROVIDER_KEY` | vazio (fica na outbox) | a chave real |

`COOKIE_DOMAIN` fica vazio nos dois de propósito. Um cookie em
`.pokerstudio.com.br` valeria para os quatro hosts, e a sessão de produção
viajaria para staging. Vazio, o cookie é *host-only*: cada ambiente com a sua.

No console do Google, cadastre **as duas** URIs de callback, senão o login
social só funciona num dos lados.

## 4. Como um deploy acontece

**Staging** — todo push em `develop`, sem aprovação:

```
push develop → CI → build das 3 imagens (staging-<sha>) → GHCR
             → ssh: .env recebe as tags novas → compose pull → up -d
             → prisma migrate deploy (roda dentro do container da API)
             → smoke test → ok, ou rollback
```

**Produção** — só por tag, e com aprovação:

```bash
git checkout main && git merge --no-ff develop
npm run changelog && git add CHANGELOG.md && git commit -m "docs: changelog v0.2.0"
git tag -a v0.2.0 -m "Logs de erro no admin"
git push origin main v0.2.0
```

O workflow `Production` para no ambiente `production` até alguém aprovar.

O smoke test não pergunta se o container subiu: ele lê
`/api/v1/health` até o campo `commit` ser exatamente o SHA que acabou de ser
publicado. Se em 2,5 minutos isso não acontecer, o passo falha e o rollback
restaura `.env.previous` — que ainda nomeia as imagens que estavam servindo — e
sobe de novo. Nenhuma imagem é reconstruída para voltar atrás.

## 5. Rollback manual

```bash
ssh deploy@185.214.135.167
cd /opt/pokerstudio/prod
sed -i 's|:v0.2.0|:v0.1.9|g' .env          # ou: cp .env.previous .env
docker compose -p pokerstudio-prod -f docker-compose.yml -f docker-compose.prod.yml up -d
curl -s https://replayer.pokerstudio.com.br/api/v1/health
```

Ou, pelo GitHub: `Actions → Production → Run workflow`, informando a tag antiga.

> Migração de banco não volta sozinha. Se o release trouxe uma migração
> destrutiva, o rollback do código precisa do restore do dump de antes (§7).
> Por isso migrações que removem coluna devem ir num release separado do código
> que para de usá-la.

## 6. Deploy manual de emergência

```bash
ssh deploy@185.214.135.167
cd /opt/pokerstudio/staging
docker compose -p pokerstudio-staging -f docker-compose.yml -f docker-compose.staging.yml pull
docker compose -p pokerstudio-staging -f docker-compose.yml -f docker-compose.staging.yml up -d
```

Trocando o projeto, o overlay e o diretório, o mesmo vale para produção.

## 7. Banco

```bash
# backup (o cron já faz isso às 3h; retenção de 14 dias)
/opt/pokerstudio/repo/infra/scripts/backup.sh prod

# restaurar staging a partir de um dump
/opt/pokerstudio/repo/infra/scripts/restore.sh staging /opt/pokerstudio/staging/backups/prod_2026-09-08_0300.sql.gz

# restaurar produção — exige dizer em voz alta
PS_CONFIRM=yes-restore-production /opt/pokerstudio/repo/infra/scripts/restore.sh prod <arquivo>
```

**Copiar produção para staging**, com os dados pessoais removidos:

```bash
/opt/pokerstudio/repo/infra/scripts/clone-prod-to-staging.sh
```

Ele faz um dump só-leitura de produção, restaura em staging, marca o banco como
cópia e aplica `anonymise-staging.sql`: e‑mails, nomes, telefones e nicks viram
placeholders derivados do id (a mesma conta continua sendo a mesma conta, sem
ser ninguém), e toda sessão, token, código de recuperação, dispositivo confiável
e fila de e‑mail é destruída. O dump intermediário é apagado no fim.

Enquanto produção não existir, o script diz isso e sai sem erro — staging começa
com o schema das migrações mais o seed.

## 8. Logs

**Erros da aplicação** ficam em `/admstudio` → aba **Logs**: contagem por nível
nas últimas 24 h, filtro por nível, origem (servidor ou navegador), ambiente,
período e texto, e o stack de cada ocorrência. Cada linha carrega o ambiente e o
release, então dá para separar barulho de staging de problema em produção.

Nada de credencial entra ali: chaves com cara de segredo são substituídas
*antes* da linha existir, e o pino redige cookie, authorization e campos de
senha das linhas de log. O que a redaction **não** faz é vasculhar o texto livre
da mensagem — se um erro imprimir um segredo dentro da própria mensagem, ele
será gravado. Vale lembrar disso ao lançar exceções.

Retenção: `ERROR_LOG_RETENTION_DAYS` (14 em staging, 30 em produção), com
expurgo diário. Logs de acesso continuam em 180 dias.

**Logs de container**:

```bash
cd /opt/pokerstudio/prod
docker compose -p pokerstudio-prod -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=200 api
cd /opt/pokerstudio/edge && docker compose -p pokerstudio-edge -f docker-compose.edge.yml logs -f caddy
```

Rotação: `json-file`, 10 MB por arquivo, 5 arquivos por container — configurado
no `daemon.json` pelo provisionamento e repetido no compose.

## 9. Verificação rápida

```bash
curl -s https://replayer.pokerstudio.com.br/api/v1/health | jq
curl -s -u usuario:senha https://stage.replayer.pokerstudio.com.br/api/v1/health | jq
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker network inspect pokerstudio-edge --format '{{range .Containers}}{{.Name}} {{end}}'
```

O `env` e o `version` que voltam de `/health` são os mesmos que aparecem no
rodapé do `/admstudio` — é assim que se sabe, olhando a tela, em qual ambiente
se está.
