# Migração para Next.js

Este repositório roda a mesma aplicação de duas maneiras ao mesmo tempo. A de
Vite continua no ar e intocada; a de Next é a que está sendo construída. As duas
renderizam **o mesmo `apps/web/src`**, então não existe segunda cópia da
interface e elas não podem divergir.

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/web` | aplicação Vite, o legado que continua funcionando, e o `src` que ambos usam |
| `apps/next` | casca Next, com o layout, a rota catch-all e a porta de entrada da API |
| `apps/api` | Fastify e Prisma, sem alteração, servido pelas duas cascas |
| `packages/shared` | regras e dados puros, usados pelo navegador e pelo servidor |
| `landingpage` | site institucional, ainda em Vite |

## Rodar

O Vite, como sempre:

```
npm run dev            # front em 5173
npm run dev:api        # API em 3001
```

O Next, que serve o front e a API juntos:

```
npm run dev -w @pokerstudio/next    # tudo em 3100
```

O `.env` da API é lido de `apps/api/.env` pelas duas cascas, então existe um
arquivo só. Para desenvolvimento com o Next, o `APP_URL` precisa ser
`http://localhost:3100`, porque é contra ele que a guarda de CSRF compara a
origem.

**Não rode `next build` com o `next dev` de pé.** Os dois escrevem no mesmo
`.next` e o servidor de desenvolvimento passa a responder 404. Se acontecer,
pare o dev, apague `apps/next/.next` e suba de novo.

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

- A landing continua em Vite, fora do app Next.
- Não há Dockerfile para a saída standalone.
- A matriz de paridade completa não foi preenchida.
- O `apps/web` em Vite continua no repositório, e só sai com autorização
  explícita, em commit isolado.
