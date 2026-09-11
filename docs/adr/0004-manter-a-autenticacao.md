# 0004. Manter a autenticação própria, não adotar Auth.js

**Estado:** aceito, 10 de setembro de 2026

## Contexto

O plano da migração sugeria Auth.js como camada de autenticação.

O que já existe: senha com Argon2id, cookie de sessão httpOnly e assinado,
segundo fator por TOTP com segredo cifrado em AES-256-GCM, três fluxos OAuth
escritos à mão, limitação de tentativas por endereço, e uma regra de vinculação
que só liga uma conta existente a um provedor quando o e-mail dela já foi
verificado aqui. Cento e quarenta e oito testes cobrem isso.

## Decisão

Fica como está. A camada de aplicação não conhece o framework, então atravessou
para o Next sem uma linha alterada, e isso foi verificado.

## Consequências

O ganho de adotar Auth.js seria menos código próprio para manter. O custo seria
descartar uma implementação testada e reescrever, com risco, a parte do sistema
onde um erro é mais caro. A regra de vinculação, em particular, é fácil de
reescrever errado: ligar automaticamente por e-mail sem exigir verificação prévia
é uma forma conhecida de tomada de conta.

A escolha não é definitiva. Se um dia o PokerStudio tiver várias ferramentas
dividindo contas, vale reavaliar, e aí o critério será a necessidade de
federação, não a idade do código.
