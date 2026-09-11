# 0006. As rotas continuam no react-router

**Estado:** aceito, 10 de setembro de 2026

## Contexto

O produto tem dezessete rotas em `react-router` 6. Migrá-las uma a uma para o
App Router era o caminho idiomático, e foi orçado em cerca de cinco horas.

## Decisão

Uma rota catch-all, `app/[[...slug]]/page.tsx`, monta o `<App />` existente
dentro do `BrowserRouter` que ele já usava. Nenhuma rota foi reescrita.

## Consequências

Nenhuma URL mudou, nenhum componente foi tocado, e não há redirecionamento a
manter. Recarregar em qualquer endereço profundo funciona, o que foi verificado
com `/settings` pedido direto.

O que se perde é o que não servia: layouts aninhados do App Router, carregamento
de dados por rota no servidor, e `generateMetadata` por página. O replayer não
usa nada disso, porque tudo nele é cliente.

Se um dia uma rota precisar de renderização no servidor, ela pode sair do
catch-all e virar uma rota do App Router sozinha, sem mexer nas outras
dezesseis. A decisão não fecha portas.
