# Decisões

Uma linha por decisão, com o porquê. O que estiver aqui foi escolhido de
propósito — quem for mudar, mude sabendo o que estava em jogo.

## Parser

**Dialeto, não sala.** O parser trabalha com gramáticas registradas e a sala é
um rótulo derivado. A Chico publica sob o cabeçalho do PokerStars: sem essa
separação, 660 mãos reais seriam lidas pela gramática errada em silêncio.

**A Chico estende o PokerStars em vez de copiá-lo.** Os verbos são os mesmos;
duas cópias divergiriam na primeira vez que uma das salas mudasse um. O que a
Chico redefine é a detecção, o nome e a ausência de herói.

**Sala sem export real não ganha parser.** GGPoker, 888, WPN, Winamax,
CoinPoker, iPoker, partypoker e Bovada continuam reconhecidas com aviso até
haver arquivo. Um parser adivinhado reproduz a mão errada sem avisar, o que é
pior do que não ter suporte. *(07/09/2026: decidido usar os fixtures públicos do
projeto FPDB como base, documentando que podem ser anonimizados ou adaptados de
teste e que não provam o formato atual da sala.)*

**WPT Global fica fora do registry.** Não há arquivo completo e verificável, e
as fontes públicas se contradizem. Ver anexo B do metaprompt v9.

## Importação

**Um arquivo por vez é o padrão; juntar vários é uma opção explícita.**
O jogador comum importa um torneio de cada vez. Quem tiver um torneio fatiado
em vários arquivos — 888 e WPN fazem isso — usa "juntar arquivos do mesmo
torneio" e recebe **uma** sessão, com todas as mãos ordenadas por data e hora.
*(07/09/2026 — resolve a contradição entre a instrução anterior e a v9 §5.5.)*

## Avaliação

**Nota de 0 a 100, e 0 é uma nota.** Ausência de nota é `null`. Nada converte
uma mão pendente em zero, nem um zero em pendência.

**Cobertura conta só as mãos com VPIP.** Passar pela mão no replayer não é
avaliá-la: é preciso nota, OK, comentário ou tag.

**A conclusão é definitiva.** Vale para o jogador e para o coach, mesmo com o
link ainda válido, e a conclusão de um não conclui a de ninguém.

**Estrelas antigas convertem por régua explícita:** ★1=10, ★2=30, ★3=50, ★4=75,
★5=95 — o meio de cada faixa da rubrica inicial. A conversão é registrada como
tal, e a nota antiga permanece no registro. *(07/09/2026 — a alternativa era
mantê-las como legado sem uso.)*

**A régua da rubrica não recalcula o passado.** Mudar as faixas muda como uma
nota é descrita daqui em diante, nunca o número já atribuído.

## Dashboard

**O gráfico é organizado pela data em que a sessão foi jogada** — o horário da
primeira mão — e não pela data de conclusão da avaliação. Assim um ponto não se
desloca quando um segundo coach conclui a avaliação da mesma sessão. Sem
timestamp na mão, cai para a data de importação.

## Compartilhamento

**A senha nunca entra na URL nem em log.** Só o hash é guardado; o texto é
mostrado uma vez, na tela, para o jogador entregar como quiser.

**Prazo e revogação são verificados a cada requisição**, não uma vez na entrada.
Uma aba deixada aberta depois da hora é barrada como qualquer outra.
