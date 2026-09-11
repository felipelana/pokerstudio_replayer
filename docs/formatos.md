# Formatos de hand history

Uma página por dialeto. É isto que permite manter o parser quando uma sala
mudar o formato — o que elas fazem sem avisar.

## Estado

| Dialeto      | Sala                            | Situação                  | Fixtures                                             |
| ------------ | ------------------------------- | ------------------------- | ---------------------------------------------------- |
| `pokerstars` | PokerStars                      | **Completo**              | 1 export real de torneio KO (36 mãos) + 2 sintéticos |
| `chico`      | Chico / BetOnline / TigerGaming | **Completo**              | 2 torneios reais de 2026, 660 mãos                   |
| `wpn`        | WPN / ACR                       | Reconhece, não interpreta | —                                                    |
| `ggpoker`    | GGPoker                         | Reconhece, não interpreta | —                                                    |
| `888`        | 888poker                        | Reconhece, não interpreta | —                                                    |
| `ipoker`     | iPoker                          | Reconhece, não interpreta | —                                                    |
| `coinpoker`  | CoinPoker                       | Reconhece, não interpreta | —                                                    |

"Reconhece, não interpreta" significa que a detecção acerta a sala e a
importação diz que o formato ainda não é suportado. É deliberado: um parser
adivinhado reproduz a mão errada em silêncio, o que é pior do que não ter.

Winamax, partypoker, Bovada/Ignition e BetOnline no formato antigo ainda não
têm nem detecção. WPT Global fica de fora enquanto não houver um arquivo real
— ver o anexo B do metaprompt v9.

## `chico` — Chico Poker Network

### Cabeçalho

```
PokerStars Hand #1639532875: Tournament #916-1a5ca85, $33 USD Hold'em No Limit - Level (3500/7000) - 2026/06/14 15:09:25 UTC
Table 'CHC_1827491784 2' 8-max Seat #6 is the button
```

**O cabeçalho mente.** Diz PokerStars. As marcas que desmentem:

| Marca                       | Exemplo                           |
| --------------------------- | --------------------------------- |
| Mesa com prefixo `CHC_`     | `Table 'CHC_1827491784 2'`        |
| Id de torneio não numérico  | `916-1a5ca85`                     |
| Nível sem número nem romano | `Level (3500/7000)`               |
| Pote lateral com hífen      | `collected 45000 from side pot-1` |

Duas marcas bastam para confiança 0,95. Uma só vale 0,5 — e o PokerStars se
retira assim que qualquer uma aparece, porque errar aqui reproduz a mão sob a
gramática errada sem dizer nada.

### O que a Chico não escreve

- **`Dealt to`** — nunca. Toda mão é de observador; ninguém é o herói.
- **Cartas fechadas fora do showdown** — só aparecem quem mostrou.
- **`and is all-in`** — nenhum marcador. O all-in teria de ser inferido pelo
  stack; nas 660 mãos não foi necessário para reproduzir.
- **Nome do torneio** — o `$33 USD` é o buy-in total, sem separar a taxa.
- **Detalhamento do pote** — a linha é `Total pot N | Rake N` e nada mais. Quando
  há pote lateral, o rateio só aparece nas linhas de recolhimento, e é de lá que
  o parser o reconstrói.

### O que ela escreve e o PokerStars não

- Linha de sumário `Seat 5: Fulano (big blind) showed [Jh 6h]`, sem "and won"
  nem "and lost". São 47 nas duas fixtures.
- `Rake 0` em torneio.
- Vocabulário de mão próprio: `Pair, AA`, `Two pairs, KKJJ`, `Three of a kind, AAA`,
  `Straight, A-T`, `Flush, A high`, `High card, A`. Não tente reconciliar com o
  vocabulário do Stars — mapeie por conta própria quando for traduzir.

### Como está implementado

`ChicoParser` estende `PokerStarsParser`: o corpo é a mesma gramática, linha por
linha, e copiá-la garantiria divergência na primeira vez que uma das duas salas
mudasse um verbo. O que a Chico redefine é a detecção, o nome da sala e a
garantia de que nenhuma mão sai com herói.

Para acomodar as duas, a gramática compartilhada foi alargada em três pontos,
todos verificados contra as fixtures do PokerStars:

1. o id de torneio aceita `[\w-]+`, não só dígitos;
2. o nível é opcional — sem ele, o campo fica ausente, não vira `"undefined"`;
3. o sumário aceita `showed [..]` sem cláusula, e o pote lateral pode ser
   reconstruído das linhas de recolhimento quando o cabeçalho do pote não o
   detalha.

### Teste de aceite

`src/features/parsers/chico/chico.test.ts` — as 660 mãos das duas fixtures reais
parseiam sem um único aviso, do parser ou do motor de replay; tudo o que entrou
no pote, menos o que voltou, é igual ao pote declarado; e o que foi pago é igual
ao pote menos o rake. Mais a garantia de que a Chico nunca é lida como
PokerStars, e o PokerStars nunca como Chico.
