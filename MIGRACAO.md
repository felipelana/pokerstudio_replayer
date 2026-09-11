# De onde veio cada coisa

Este repositório nasceu de `C:\LanaReplayer`, que continua intacto e não recebe
push nenhum daqui. A história dos commits veio junto: são 105, dos quais os dez
últimos são a migração em si.

O princípio foi **portar, não reescrever**. Das cerca de 26 mil linhas de
TypeScript, a esmagadora maioria atravessou sem uma alteração. O que mudou está
listado abaixo, com o motivo.

## O mapa

| Módulo original               | Onde está agora                          | O que mudou                                                                    |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/web/src/parsers`        | o mesmo lugar                            | nada. Os testes e as fixtures vieram como estavam                              |
| `apps/web/src/engine`         | o mesmo lugar                            | nada                                                                           |
| `apps/web/src/model`          | o mesmo lugar                            | nada                                                                           |
| `apps/web/src/renderers`      | o mesmo lugar                            | nada                                                                           |
| `apps/web/src/skins`          | o mesmo lugar                            | só o import de imagem, abaixo                                                  |
| `apps/web/src/ui`             | o mesmo lugar                            | quatro arquivos, por causa do import de imagem                                 |
| `apps/web/src/state`          | o mesmo lugar                            | nada                                                                           |
| `apps/web/src/locales`        | o mesmo lugar                            | nada de estrutura; texto novo entrou                                           |
| `apps/api/src`                | o mesmo lugar                            | nada                                                                           |
| `apps/api/prisma`             | o mesmo lugar                            | nada. As onze migrations e o schema vieram inteiros                            |
| `packages/shared`             | o mesmo lugar                            | ganhou `assetUrl` e `disposableEmail`                                          |
| `landingpage/src`             | o mesmo lugar                            | o alias `@/` virou `@landing/`, em 22 arquivos                                 |
| `apps/web/index.html`         | `apps/next/app/layout.tsx`               | virou o layout, com os mesmos metadados                                        |
| `apps/web/src/main.tsx`       | `apps/next/app/[[...slug]]/Replayer.tsx` | o mesmo conteúdo, sem `StrictMode`, pelo motivo que o arquivo original já dava |
| `apps/web/vite.config.ts`     | `apps/next/next.config.mjs`              | aliases, worker e o proxy da API                                               |
| roteamento por `react-router` | `apps/next/app/[[...slug]]`              | ver ADR 0006                                                                   |
| as 72 rotas da API            | `apps/next/app/api/[...path]`            | ver ADR 0007                                                                   |

## O que mudou, e por quê

**Imports de imagem.** O Vite devolve uma string, o Next devolve um objeto com
`src`. Seis lugares usavam o valor direto. Em vez de escolher um empacotador,
entrou `assetUrl()` em `packages/shared`, que aceita os dois. As duas cascas
continuam funcionando.

**`import.meta.env`.** É sintaxe do Vite. No replayer havia um uso, que virou
`process.env.NODE_ENV`, que os dois substituem em tempo de build. Na landing
havia cinco, que viraram nomes `NEXT_PUBLIC_`, lidos direto pelo Next e
substituídos pelo Vite a partir dos mesmos arquivos `.env`. Os nomes `VITE_`
antigos continuam aceitos.

**O alias `@/`.** O replayer e a landing chamavam a própria pasta de `@`, e um
empacotador não dá dois sentidos ao mesmo prefixo. O da landing virou `@landing`.
São 68 imports em 22 arquivos, e ela continua construindo sozinha.

**Extensão `.js` nos imports do pacote compartilhado.** É o que a API precisa,
por consumir o pacote como ESM. O webpack do Next resolve isso com
`extensionAlias`, sem tocar no pacote.

**`?url`.** O import de arquivo do Vite, usado uma vez para o hand history de
demonstração, virou uma regra de asset no webpack e uma declaração de tipo. O
import no código ficou como estava.

**Tailwind.** Um app tem uma configuração, e havia duas. As cores já eram
idênticas nas duas, porque ambas só nomeiam variáveis CSS; a landing acrescenta
quatro que o replayer não usava. A lista de fontes ficou sendo a união, para
nenhum dos dois perder um recurso.

## O que não mudou, e é o ponto

Os parsers, o motor de replay, o modelo de domínio, os renderizadores, as skins,
os oito idiomas, a API inteira, o schema e as migrations. Os 113 testes do front
e os 148 da API rodam sobre os mesmos arquivos e dão o mesmo resultado do
baseline medido antes de começar.

## Pendências

- A estrutura de pastas ainda é a do monorepo original. O desenho com
  `src/features`, `src/domain` e `src/server` não foi aplicado.
- Dos quatro testes de ponta a ponta, três passam. O quarto, que importa uma
  mão pela tela, está marcado como pendente com o diagnóstico no arquivo.
- Os três fluxos de OAuth não foram vistos funcionar, por falta de credenciais.
  A Apple não aceita `localhost` e precisa de staging.
- A imagem Docker não foi construída, por não haver Docker nesta máquina. O
  servidor de produção que ela executa foi montado à mão e responde.
- O catálogo de leaks existe na API e no replayer; falta a tela de
  administração para editá-lo sem chamar a API à mão.

## Depois

A árvore foi reorganizada em seguida: `apps/web`, `apps/api` e `apps/next`
viraram uma `src` só na raiz. O que esta página descreve continua valendo como
relato da migração; os caminhos, não. Ver `docs/adr/0008-uma-arvore-de-codigo-na-raiz.md`.
