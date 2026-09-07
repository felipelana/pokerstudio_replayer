# Metaprompt — Poker Hand Replayer (browser)

Documento em duas partes:

1. **Lacunas a preencher** — decisões que você precisa tomar (ou aceitar o default sugerido) antes de rodar o prompt.
2. **O metaprompt** — bloco pronto para colar em um agente de código (Claude Code, Cursor, etc.).

Onde aparecer `{{CHAVE}}` no metaprompt, substitua pelo valor escolhido na parte 1. Se deixar em branco, o agente deve usar o default indicado.

---

## Parte 1 — Lacunas (gaps) a preencher

| # | Lacuna | Por que importa | Default sugerido |
|---|--------|-----------------|------------------|
| G1 | `{{STACK}}` — stack tecnológico | Define build, testes e deploy | Vite + React 18 + TypeScript + Tailwind; zero backend |
| G2 | `{{DEPLOY}}` — onde vai rodar | Estático (GitHub Pages/Vercel) vs. embutido em outro produto | Estático, single-page, funciona via `file://` |
| G3 | `{{FORMATO_MVP}}` — formato de mão do MVP | Você disse PokerStars; confirmar **torneio, cash ou ambos** | Ambos, priorizando torneio (SNG) |
| G4 | `{{MOEDA_E_CHIPS}}` — exibição de valores | Torneio mostra chips; cash mostra $/€; blinds em BB? | Chips brutos + toggle "em BB" |
| G5 | `{{HERO}}` — como identificar o herói | Nome fixo, detectado pelo "Dealt to", ou selecionável | Detectado por "Dealt to X [..]"; override manual na UI |
| G6 | `{{FONTE_DAS_MAOS}}` — entrada de dados | Colar texto, arrastar .txt, pasta inteira, múltiplos arquivos | Colar texto + drag-and-drop de 1..N arquivos `.txt` |
| G7 | `{{PERSISTENCIA}}` — guardar mãos carregadas | Recarregar a página perde tudo? | IndexedDB (localStorage estoura com HH grandes) |
| G8 | `{{EQUITY}}` — mostrar pot odds / equity como na referência | Exige avaliador de mãos e cálculo de equity (Monte Carlo) no browser | Fase 2; deixar slot na UI vazio no MVP |
| G9 | `{{CORES_VPIP}}` — barra de resultado por mão (verde/vermelho/cinza) | Referência colore cada mão pelo resultado do herói | Verde = ganhou pot, vermelho = perdeu chips, cinza = fold sem investir |
| G10 | `{{SKINS_BARALHO}}` — quais skins | Você citou 4 cores e 2 cores P&B | 4 cores (♠ preto ♥ vermelho ♦ azul ♣ verde), 2 cores clássico, 2 cores P&B (alto contraste) |
| G11 | `{{IDIOMA_UI}}` — idioma da interface | PT-BR, EN, i18n desde o início? | EN como padrão, strings centralizadas para i18n futuro |
| G12 | `{{SITES_FASE_2}}` — ordem dos demais parsers | GG, 888, iPoker, WPN, Chico, CoinPoker têm formatos muito diferentes; GG/WPN exportam quase-PokerStars | Ordem: WPN → GGPoker → 888 → iPoker → Chico → CoinPoker |
| G13 | `{{AMOSTRAS}}` — você tem hand histories reais de cada site? | Sem amostras reais, o parser será chute | Você fornece 20+ mãos reais por site (anonimizadas) como fixtures |
| G14 | `{{ANIMACAO}}` — chips deslizando, cartas virando | Custa tempo; afeta "sensação" | Transições CSS curtas (150 ms); sem animação de física |
| G15 | `{{EXPORT}}` — screenshot / compartilhar | Referência tem botão Screenshot | Fase 2: exportar PNG da mesa via `html-to-image` |
| G16 | `{{LICENCIAMENTO}}` — uso interno, produto, integração com {{seu site de poker}} | Muda o cuidado com performance e branding | Uso interno / componente reutilizável (sem marca de terceiros) |

---

## Parte 2 — Metaprompt

```markdown
# PAPEL
Você é um engenheiro front-end sênior especializado em aplicações interativas no browser e em parsing de texto. Você conhece o ecossistema de poker online (hand histories, posições, streets, side pots, all-in, torneios vs. cash).

# OBJETIVO
Construir um **Poker Hand Replayer** que roda 100% no browser, sem backend, com:
- Parser plugável de hand histories, começando por **PokerStars** ({{FORMATO_MVP}}), com arquitetura pronta para GGPoker, 888poker, iPoker, WPN, Chico Poker e CoinPoker.
- Replay visual da mão em uma mesa oval, no estilo dos replayers profissionais de ICM/SNG (layout descrito abaixo).
- Navegação por teclado: **← / →** avança/retrocede **uma ação** (e, na virada de street, distribui as cartas comunitárias); **↑ / ↓** troca de **mão** na lista.
- Tema **dark** e **light**, e skins de baralho: **4 cores**, **2 cores clássico**, **2 cores preto-e-branco**.
- Visual clean, tipografia legível, sem ruído.

Stack: {{STACK}}. Deploy: {{DEPLOY}}. Idioma da UI: {{IDIOMA_UI}}.

# REFERÊNCIA DE LAYOUT (descrição funcional — não copiar marcas nem logotipos)
Tela única, três regiões:

1. **Barra lateral esquerda (~220 px)**
   - Botão "Load hand histories" (colar texto ou arrastar arquivos — {{FONTE_DAS_MAOS}}).
   - Checkboxes: "Show known hands", "Color hint results", "Color VPIP only".
   - **Lista de mãos**: uma linha por mão, mostrando: número sequencial, as duas cartas do herói como mini-cards coloridas pela skin, e a posição do herói (BTN, SB, BB, UTG, MP, HJ, CO...). A mão selecionada fica destacada. Uma faixa de cor à esquerda indica o resultado ({{CORES_VPIP}}).
   - Botão "Copy" (copia o texto bruto da mão atual).

2. **Área central — a mesa**
   - Mesa oval verde (dark) / verde-claro dessaturado (light), borda escura, brilho sutil.
   - Até 10 assentos distribuídos ao redor da elipse; o **herói sempre na posição inferior central** (rotacionar assentos).
   - Cada assento: placa com nome do jogador, stack em chips e stack em BB (ex.: `27.2K  BB 20`). Cartas do jogador acima da placa: vermelhas-fechadas (não conhecidas) ou reveladas (se "Show known hands" e mão conhecida). Jogadores que deram fold ficam esmaecidos e com etiqueta "FOLD"; all-in mostra "ALL-IN".
   - Percentual de equity abaixo do jogador quando disponível ({{EQUITY}}).
   - **Botão do dealer** (D) no assento correto.
   - Fichas apostadas na frente de cada jogador com o valor (ex.: `0.7K`, `1.4K`).
   - No centro: `Pot: X` e as cartas comunitárias em tamanho grande, aparecendo conforme a street.
   - Acima da mesa: linha de informação `Pot odds X:1 · Equity Y%` (slot; pode ficar vazio no MVP).

3. **Rodapé**
   - **Log de ações** (caixa de texto rolável) à esquerda, com uma linha por ação já reproduzida: `FatsDom: posts small blind 700`, `Dealing Flop [6s 7c 9s]`, etc. A ação atual fica destacada.
   - Botões de salto de street: `Preflop | Hero | Flop | Turn | River` (Hero = pula até a primeira ação do herói).
   - Controles: voltar, play/pause (auto-avanço com velocidade configurável), avançar.
   - **Timeline de mãos** (faixa horizontal inferior): um quadradinho por mão, colorido pelo resultado; marca "P" quando o herói jogou (VPIP). Clique navega. Separadores com o nível de blinds em torneios (`1600/800-160`).
   - Cabeçalho com toggles: tema dark/light, skin de baralho, opções.

# MODELO DE DADOS CANÔNICO (independente de site)
Todos os parsers devem produzir esta estrutura. Defina os tipos em TypeScript.

Hand {
  id: string                   // identificador do site
  site: 'pokerstars' | 'ggpoker' | '888' | 'ipoker' | 'wpn' | 'chico' | 'coinpoker'
  gameType: 'cash' | 'tournament'
  variant: 'holdem' | 'omaha' | 'omaha-hilo' | 'short-deck'  // MVP: holdem
  limit: 'NL' | 'PL' | 'FL'
  currency: 'chips' | 'USD' | 'EUR' | ...
  tournament?: { id, buyIn, level, name? }
  blinds: { sb, bb, ante?, straddle? }
  tableName: string
  maxSeats: number
  buttonSeat: number
  timestamp: Date
  players: Player[]            // seat, name, startingStack, isHero, isSittingOut
  heroName?: string
  streets: { preflop: Action[], flop?: Action[], turn?: Action[], river?: Action[] }
  board: string[]              // ['6s','7c','9s','Td']
  holeCards: Record<playerName, string[]>   // conhecidas (herói + showdown + "shows")
  showdown: Action[]           // shows / mucks / collected
  summary: { totalPot, rake, pots: Pot[] } // main + side pots com vencedores
  raw: string                  // texto original
  warnings: string[]           // linhas não reconhecidas, sem quebrar o parse
}

Action {
  player: string
  type: 'post-sb' | 'post-bb' | 'post-ante' | 'post-dead' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in' | 'uncalled-return' | 'collect' | 'show' | 'muck' | 'timeout' | 'disconnect'
  amount?: number              // valor incremental colocado no pot nesta ação
  toAmount?: number            // "raises 400 to 1200" → amount=800 (ou o incremental correto), toAmount=1200
  isAllIn: boolean
  raw: string
}

# MOTOR DE REPLAY (estado derivado)
Implemente um redutor puro `applyAction(state, action)` que, a partir da Hand, reconstrói frame a frame:
- Stack corrente de cada jogador.
- Fichas "na frente" de cada jogador na street atual (bet pendente) e total investido na mão.
- Pot atual (soma do que já foi para o meio + apostas pendentes, exibidos separados se preferir).
- Street atual e cartas do board visíveis.
- Flags: folded, allIn, isActing (jogador da vez).
- Side pots calculados corretamente em all-in múltiplo; devolução de "uncalled bet".
- Antes de aplicar cartas/ações, valide: soma de stacks iniciais + mudanças == soma final (tolerar rake em cash). Registrar discrepância em `warnings`.

Pré-calcule todos os frames de uma mão (array de estados) para navegação O(1) com ← / →.

# NAVEGAÇÃO E TECLADO
- `→` próxima ação; `←` ação anterior. Na transição de street, um frame extra "Dealing Flop/Turn/River" exibe o board antes da primeira ação da street.
- `↑` mão anterior na lista; `↓` próxima mão. Ao trocar de mão, iniciar no frame **pré-ação do herói** se a opção "start at hero" estiver ligada; caso contrário, frame 0.
- `Home`/`End`: primeiro/último frame. `Space`: play/pause. `1..5`: pular para Preflop/Hero/Flop/Turn/River.
- `T`: alterna tema. `C`: alterna skin do baralho. `S`: alterna "Show known hands".
- Foco no teclado não pode ser roubado por inputs; quando o textarea de colar mãos estiver ativo, atalhos ficam suspensos.
- Mouse: clique em qualquer item da lista lateral ou da timeline seleciona a mão; scroll na lista.

# PARSER POKERSTARS — ESPECIFICAÇÃO
Suportar as variações abaixo. Escrever o parser como máquina de estados por linha, tolerante: linha não reconhecida → `warnings`, nunca exceção.

Cabeçalho (2 formas):
- Cash: `PokerStars Hand #123456789:  Hold'em No Limit ($0.05/$0.10 USD) - 2024/03/01 20:15:33 ET`
- Torneio: `PokerStars Hand #123456789: Tournament #987654321, $3.32+$0.18 USD Hold'em No Limit - Level V (75/150) - 2024/03/01 20:15:33 ET`
- Aceitar também "PokerStars Game #", "PokerStars Zoom Hand #", "PokerStars Home Game Hand #", moedas `USD|EUR|GBP|CAD|BRL`, ante no header (`Level X (100/200) - Ante 25`? — em PS o ante vem nas ações "posts the ante"), e fuso `ET|CET|BRT|...`. Timestamp com bloco duplo `[2024/03/01 17:15:33 ET]`.
- Mesa: `Table 'Nome' 9-max Seat #3 is the button` (também `6-max`, `2-max`, `10-max`).
- Assentos: `Seat 1: Nome (1500 in chips)` / `($10.50 in chips)` / com sufixo `is sitting out` / `out of hand (moved from another table into small blind)`. Nomes podem conter espaços, parênteses, colchetes e caracteres não-ASCII — parse pelo padrão de fim de linha, não por regex gulosa no nome.
- Blinds/antes: `X: posts small blind 75`, `posts big blind 150`, `posts the ante 20`, `posts small & big blinds 225`, `posts big blind 150 and is all-in`, `sits out`, `will be allowed to play after the button`.
- `*** HOLE CARDS ***` → `Dealt to Hero [Ah Kd]`.
- Ações: `folds`, `checks`, `calls 300`, `bets 300`, `raises 300 to 600`, todos com sufixo opcional ` and is all-in`. `Uncalled bet (450) returned to X`. `X: doesn't show hand`, `X: shows [Ah Kd] (a pair of Aces)`, `X: mucks hand`, `X collected 1350 from pot`, `X collected 900 from main pot`, `... from side pot`, `... from side pot-1`.
- Eventos: `X has timed out`, `X is disconnected`, `X is connected`, `X leaves the table`, `X joins the table at seat #N`, `X said, "..."` (ignorar chat), `X finished the tournament in 5th place`, `X wins the tournament`, `X re-buys and receives...`, `X was removed from the table for failing to post`.
- Streets: `*** FLOP *** [6s 7c 9s]`, `*** TURN *** [6s 7c 9s] [Td]`, `*** RIVER *** [6s 7c 9s Td] [2h]`, `*** SHOW DOWN ***`, `*** SUMMARY ***`.
- Run It Twice: `*** FIRST FLOP ***`, `*** SECOND RIVER ***`, `*** FIRST SHOW DOWN ***` — MVP: reconhecer e marcar `warnings: ['run-it-twice não suportado']`, sem quebrar.
- Summary: `Total pot 1350 | Rake 0`, `Total pot 5000 Main pot 3000. Side pot 2000. | Rake 0`, `Board [6s 7c 9s Td 2h]`, `Seat 1: Nome (button) folded before Flop (didn't bet)`, `Seat 2: Nome (small blind) folded on the Turn`, `Seat 3: Nome (big blind) showed [Ah Kd] and won (1350) with a pair of Aces`, `Seat 4: Nome mucked [Qc Qd]`, `collected (1350)`. Usar o summary para recuperar cartas mucked (aparecem só ali).
- Separador entre mãos: 1..3 linhas em branco. Arquivos podem ter BOM UTF-8 e CRLF.
- Números: `1,350` com vírgula de milhar em alguns exports; `$0.10`; `€0.10`. Normalizar para número.

# ARQUITETURA DE PARSERS
interface HandHistoryParser {
  site: Site
  detect(text: string): number      // 0..1, confiança de que o texto é deste site
  split(text: string): string[]     // separa um arquivo em mãos individuais
  parse(handText: string): Hand     // uma mão → modelo canônico (com warnings)
}
- Um `ParserRegistry` roda `detect` de todos e usa o de maior confiança; permitir override manual.
- Cada parser em `src/parsers/<site>/` com `fixtures/` (arquivos reais anonimizados) e testes unitários que asseguram: nº de mãos, stacks finais, pot total, vencedor, board, cartas conhecidas.
- Deixar stubs para {{SITES_FASE_2}} com `detect` implementado (assinaturas de cabeçalho conhecidas: `Poker Hand #TM...` GG; `#Game No :` 888; `GAME #` iPoker; `Game Hand #` WPN/ACR; Chico e CoinPoker — pesquisar/confirmar com amostras {{AMOSTRAS}}) e `parse` lançando `NotImplemented`, registrado na UI como "formato reconhecido, ainda não suportado".

# TEMAS E SKINS
- Tokens de design em CSS variables: `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--accent`, `--felt`, `--felt-edge`, `--card-bg`, `--suit-s`, `--suit-h`, `--suit-d`, `--suit-c`.
- Tema dark (padrão): fundo cinza-chumbo (#2b2f36 → #1f2227), superfícies um tom acima, texto claro, feltro verde profundo. Tema light: fundo #f4f5f7, superfícies brancas, texto #1f2227, feltro verde suavizado.
- Skins de baralho ({{SKINS_BARALHO}}):
  - `four-color`: ♠ preto, ♥ vermelho, ♦ azul, ♣ verde (fundo da carta na cor do naipe com rank branco, como na referência, OU carta branca com naipe colorido — oferecer as duas variantes: `filled` e `outlined`).
  - `two-color`: ♠♣ preto, ♥♦ vermelho, carta branca.
  - `mono`: preto-e-branco de alto contraste, naipes diferenciados apenas pelo glifo.
- Cartas em **SVG** gerado por componente (rank + glifo do naipe), sem imagens externas; escala fluida.
- Persistir tema e skin em {{PERSISTENCIA}}.

# REQUISITOS NÃO FUNCIONAIS
- Sem backend, sem chamadas de rede. Tudo processado localmente (hand histories são dados sensíveis).
- Carregar 10.000 mãos (~30 MB) sem travar a UI: parse em Web Worker, lista virtualizada.
- Layout responsivo mínimo 1280×720; mesa mantém proporção da elipse.
- Acessibilidade: foco visível, atalhos documentados em um painel `?`, contraste AA em ambos os temas.
- Sem marcas, logotipos ou nomes de produtos de terceiros na UI.

# ENTREGÁVEIS
1. Repositório com `README` (instalação, atalhos, como adicionar um novo parser).
2. `src/model/` (tipos), `src/engine/` (redutor de replay + side pots), `src/parsers/`, `src/ui/`.
3. Parser PokerStars completo + ≥ 30 testes com fixtures cobrindo: cash, torneio, ante, all-in múltiplo com side pot, uncalled bet, mucked no summary, sitting out, run-it-twice (marcado), nomes com caracteres especiais.
4. UI completa conforme layout, com temas e skins.
5. Um arquivo `samples/pokerstars-demo.txt` com ≥ 15 mãos sintéticas para demonstração imediata.

# CRITÉRIOS DE ACEITAÇÃO
- Colar um arquivo real de PokerStars → lista lateral preenchida, primeira mão na mesa, sem erro no console.
- Em qualquer frame, `pot exibido == soma das contribuições` e `stacks == iniciais − contribuições + coletas`.
- ← → ↑ ↓ funcionam sem clicar em nada após o carregamento.
- Trocar tema e skin não recarrega nem perde a posição do replay.
- Mão com 3 all-ins e 2 side pots mostra vencedor correto de cada pot no último frame.
- Linhas desconhecidas geram `warnings` visíveis em um painel, nunca quebram o parse.

# PROCESSO DE TRABALHO
1. Antes de codar, liste as suposições que você fez sobre as lacunas não preenchidas e prossiga com os defaults.
2. Implemente na ordem: modelo → parser PokerStars com testes → engine com testes → UI estática → interatividade/teclado → temas/skins → polimento.
3. Ao final de cada etapa, mostre como rodar e o que testar manualmente.
4. Não invente formatos dos outros sites sem amostras; deixe o stub e peça as amostras.
```

---

## Amostra sintética para o primeiro teste

Cole isto na aplicação para validar o parser antes de usar arquivos reais:

```
PokerStars Hand #250000000001: Tournament #3400000001, $3.32+$0.18 USD Hold'em No Limit - Level VIII (400/800) - 2026/09/01 21:14:02 ET
Table '3400000001 1' 9-max Seat #4 is the button
Seat 1: FatsDom (48900 in chips)
Seat 2: Universe33 (25700 in chips)
Seat 3: overgreenw (27200 in chips)
Seat 4: Leethomas5555 (40000 in chips)
Seat 5: BrownButBritish (137600 in chips)
Seat 6: Pentakilator (25900 in chips)
Seat 7: PokerHero (154200 in chips)
FatsDom: posts the ante 100
Universe33: posts the ante 100
overgreenw: posts the ante 100
Leethomas5555: posts the ante 100
BrownButBritish: posts the ante 100
Pentakilator: posts the ante 100
PokerHero: posts the ante 100
BrownButBritish: posts small blind 400
Pentakilator: posts big blind 800
*** HOLE CARDS ***
Dealt to PokerHero [Kh 7s]
PokerHero: raises 800 to 1600
FatsDom: folds
Universe33: folds
overgreenw: folds
Leethomas5555: folds
BrownButBritish: calls 1200
Pentakilator: folds
*** FLOP *** [6s 7c 9s]
BrownButBritish: checks
PokerHero: bets 1400
BrownButBritish: raises 2800 to 4200
PokerHero: calls 2800
*** TURN *** [6s 7c 9s] [Td]
BrownButBritish: bets 9000
PokerHero: folds
Uncalled bet (9000) returned to BrownButBritish
BrownButBritish collected 12800 from pot
BrownButBritish: doesn't show hand
*** SUMMARY ***
Total pot 12800 | Rake 0
Board [6s 7c 9s Td]
Seat 1: FatsDom folded before Flop (didn't bet)
Seat 2: Universe33 folded before Flop (didn't bet)
Seat 3: overgreenw folded before Flop (didn't bet)
Seat 4: Leethomas5555 (button) folded before Flop (didn't bet)
Seat 5: BrownButBritish (small blind) collected (12800)
Seat 6: Pentakilator (big blind) folded before Flop
Seat 7: PokerHero folded on the Turn
```

---

## Próximo passo recomendado

Responda G1, G3, G5, G6 e G13 (são as que mudam a arquitetura); o resto pode seguir com os defaults. Com isso o metaprompt fica fechado e pronto para execução.
