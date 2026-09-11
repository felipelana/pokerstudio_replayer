# 0003. Manter o Prisma

**Estado:** aceito, 10 de setembro de 2026

## Contexto

A migração perguntava se o ORM deveria ser revisto.

## Decisão

Fica o Prisma 5.22, com o `schema.prisma`, as onze migrations e os seeds
exatamente como estão. Tabelas novas entram como migrations incrementais sobre
esse histórico.

## Consequências

Nada a fazer, que é o ponto. O schema tem 26 models e o histórico de migrations
é a única descrição confiável de como o banco chegou ao estado atual. Recriá-lo
significaria perder isso e reintroduzir, uma a uma, decisões que já foram
tomadas com cuidado, como o `@@unique([userId, room])` dos nicks ou o
`onDelete: Cascade` que faz uma conta apagada levar embora o que era dela.

O Prisma exige uma atenção no Next: o cliente e o engine são carregados pelo
Node em tempo de execução, nunca empacotados, e por isso estão declarados como
externos na configuração. A instância do servidor é guardada em `globalThis`, ou
cada recarga em desenvolvimento abriria mais um pool contra o banco.
