# 0007. A API atende de dentro do Next, pelo Fastify

**Estado:** aceito, 10 de setembro de 2026

## Contexto

A API tem 72 rotas em Fastify, com hooks de CSRF, limitação de tentativas,
cookies assinados, e 148 testes que a exercitam por `app.inject`. O objetivo era
um app só, o que implicava trazê-la para dentro do Next.

Reescrever as 72 rotas como route handlers foi orçado em oito horas, com o custo
adicional de refazer o arranjo dos testes.

## Decisão

`app/api/[...path]/route.ts` constrói a instância Fastify uma vez e despacha
cada requisição por `fastify.inject`, que é o mesmo mecanismo que os testes já
usavam. As rotas, os hooks e os testes ficaram onde estavam.

## Consequências

Uma aplicação, um build, uma imagem, um deploy, sem reescrever a parte do
sistema que mais tem regra de segurança.

A porta de entrada precisa acertar três coisas, e acerta: o endereço de origem,
porque é o que o limitador conta; todos os `set-cookie`, porque um objeto comum
guardaria só o último; e os cabeçalhos de tamanho, que esta camada reescreve.

O custo é uma indireção: um `inject` por requisição, em vez de o Fastify falar
com o socket. A diferença medida foi de poucos milissegundos, contra um banco
real. Se um dia isso pesar, o caminho é migrar rota a rota para route handlers,
e a camada de aplicação, que não conhece framework, atravessa de novo sem
alteração.
