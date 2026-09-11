# 0008. Uma árvore de código, com `src`, `prisma` e `tests` na raiz

**Estado:** aceito, 11 de setembro de 2026

## Contexto

A migração para o Next foi feita sem mexer no que já existia, o que foi a
decisão certa naquele momento: `apps/web` guardava a interface, `apps/api`
guardava o servidor, e `apps/next` guardava apenas configuração que apontava
para os outros dois por caminhos relativos (`../web/src`, `../api/src`).

O arranjo funcionou, e cobrou um preço depois. Três `package.json` descreviam
uma aplicação só. O alias `@/` resolvia para uma pasta que ficava dois níveis
acima de onde o código morava. O Tailwind precisava listar três globs. Um
`git grep` por um componente respondia com um caminho que não dizia a que
assunto ele pertencia: `apps/web/src/ui/replayer/ReviewPanel.tsx` é interface,
mas `apps/web/src/ui/hooks/useFormat.ts` não era de interface nenhuma.

O ponto que decidiu: `apps/web` e `apps/api` não eram pacotes. Nada os consumia
por nome, nada os publicava, e nenhum dos dois tinha um build próprio que o
outro usasse. Eram pastas com um manifesto cada.

## Decisão

A raiz do repositório é o projeto Next. `src/app` tem as rotas, `src/domain` o
modelo e o motor, `src/features` cada assunto inteiro, `src/components` o que
serve a mais de um, `src/lib` a infraestrutura do navegador, `src/i18n` os oito
idiomas e `src/server` a API. `prisma` e `tests` sobem para a raiz, que é onde
qualquer ferramenta procura por eles.

`packages/shared` e `landingpage` continuam sendo workspaces npm, porque são as
duas coisas que de fato são consumidas por nome.

A casca Vite continua subindo, por `npm run dev:vite`, lendo a mesma `src`.
Tirá-la do ar é uma decisão separada, e não foi tomada aqui.

## Consequências

- Um import diz onde a coisa mora. `@/features/reviews/…` é um assunto,
  `@/components/…` é compartilhado, `@/server/…` é backend.
- A regra de fronteira do lint ficou mais forte: `src/{features,components,lib,domain,i18n}`
  não pode importar `@/server/*`, e `src/app` pode, porque é o adaptador.
- Um `tsconfig` para o navegador e outro para o servidor, em vez de três.
- O deploy passou a construir uma imagem em vez de quatro, porque as três
  antigas descreviam um arranjo que não existe mais.
- Nenhuma linha de lógica mudou. Os 317 caminhos de alias foram reescritos por
  um codemod determinístico, as fixtures viajaram com a regra do `.gitattributes`
  que preserva seus bytes, e as três suítes continuam com a mesma contagem:
  113 no front, 161 no servidor, 4 ponta a ponta.
