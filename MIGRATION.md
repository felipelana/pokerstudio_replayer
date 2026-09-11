# Migração para Next.js

Este repositório roda a mesma aplicação de duas maneiras ao mesmo tempo. A de
Vite continua no ar e intocada; a de Next é a que está sendo construída. As duas
renderizam **o mesmo `apps/web/src`**, então não existe segunda cópia da
interface e elas não podem divergir.

## Estrutura

| Pasta             | O que é                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `apps/web`        | aplicação Vite, o legado que continua funcionando, e o `src` que ambos usam |
| `apps/next`       | casca Next, com o layout, a rota catch-all e a porta de entrada da API      |
| `apps/api`        | Fastify e Prisma, sem alteração, servido pelas duas cascas                  |
| `packages/shared` | regras e dados puros, usados pelo navegador e pelo servidor                 |
| `landingpage`     | fonte do site institucional, servida pelo Next e ainda construível em Vite  |

## Rodar

O Vite, como sempre:

```
npm run dev            # front em 5173
npm run dev:api        # API em 3001
```

O Next, que serve o front e a API juntos:

```
npm run dev    # tudo em 3100
```

O `.env` é lido da raiz do projeto pelas duas cascas, então existe um arquivo
só. Para desenvolvimento com o Next, o `APP_URL` precisa ser
`http://localhost:3100`, porque é contra ele que a guarda de CSRF compara a
origem.

**Não rode `next build` com o `next dev` de pé.** Os dois escrevem no mesmo
`.next`, e o build o reescreve debaixo do servidor que está no ar: a página
passa a receber HTML onde esperava JavaScript, e o erro que aparece é
"Unexpected token '<'" numa tela em branco, sem nada no terminal. O `prebuild`
agora recusa o build quando a porta 3100 está ocupada, justamente porque este
aviso escrito não impediu que acontecesse. Se ainda assim acontecer, pare o
dev, apague `.next` e suba de novo.

## Um servidor, dois sites

O Next escolhe pelo domínio: `pokerstudio.com.br` recebe a landing e
`replayer.pokerstudio.com.br` recebe o produto. Em desenvolvimento existe só
localhost, então `?site=1` chega à landing e o resto chega ao replayer.

## Imagem

`infra/docker/Dockerfile.next` produz uma imagem no lugar das três de antes,
com a saída standalone. O `infra/docker/docker-compose.next.yml` sobe o Postgres
e a aplicação, e é construível a partir do repositório, então uma plataforma que
clona e constrói tem o que construir.

```
docker compose -f infra/docker/docker-compose.next.yml up -d --build
```

## Voltar atrás, em menos de cinco minutos

Nada do legado foi removido, então voltar é parar de usar o Next:

```
git checkout main
npm install
npm run dev
npm run dev:api
```

Para desfazer a migração inteira no repositório:

```
git revert --no-commit e788795..HEAD
git commit -m "volta ao estado anterior a migracao"
```

E se preferir simplesmente ignorar o que foi feito, a tag
`backup/pre-nextjs-2026-09-09` marca o estado anterior a qualquer trabalho de
migração, e a branch `backup/vite-fastify-2026-09-09` guarda a mesma coisa.

## O que já está provado

- `next build` passa, incluindo o type check da API.
- A aplicação renderiza no Next com o mesmo visual, sem aviso de hidratação.
- A API responde de dentro do Next, com cookie assinado, guarda de CSRF e banco.
- O worker do parser é compilado e servido pelo Next, com a sintaxe que já
  existia.
- A mesa 3D carrega sob demanda, como antes.
- Os oito idiomas e as sessões importadas sobrevivem a uma recarga.
- 113 testes do web e 148 da API continuam verdes.

## O que ainda não

- A imagem não foi construída: não há Docker nesta máquina. O servidor de
  produção que a imagem executa foi rodado à mão e responde.
- Os três fluxos de OAuth dependem de credenciais que este ambiente não tem.
- A virada não foi dada: o servidor continua subindo as três imagens antigas.
  A imagem única já é construída e publicada pela esteira, então a troca é
  mudar qual compose o servidor usa, e é uma decisão deliberada.
- O `apps/web` em Vite continua no repositório, e só sai com autorização
  explícita, em commit isolado.

## Depois

A árvore foi reorganizada em seguida: `apps/web`, `apps/api` e `apps/next`
viraram uma `src` só na raiz, e o deploy passou a montar uma imagem em vez de
quatro. O que esta página descreve continua valendo como relato da migração; os
caminhos, não. Ver `docs/adr/0008-uma-arvore-de-codigo-na-raiz.md`.

A casca Vite continua no repositório, agora por `npm run dev:vite`, e só sai com
autorização explícita.
