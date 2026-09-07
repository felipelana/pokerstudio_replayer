# Mapa de componentes e diff proposto — Partes 3 e 4 (v14)

> Estado atual: **61 arquivos** em `src/`, single-app Vite (ainda **não** monorepo).
> Nada abaixo foi implementado. Este documento é o passo 1 da Parte 9.

## Legenda de esforço
`P` pequeno (≤ 1 arquivo, sem risco) · `M` médio (2–5 arquivos) · `G` grande (arquitetura, migração ou nova subsistema).

---

## Parte 3 — ajustes do replayer

| # | Componentes que serão tocados | Diff proposto | Esforço | Risco |
|---|---|---|---|---|
| **R1** cantos transparentes | `ui/cards/primitives.ts`, `ui/cards/Card.tsx`, `ui/cards/cardTexture.ts`, `renderers/three/ThreeTableRenderer.tsx` (material da carta) | Hoje o canvas da carta é preenchido antes do `roundRect`, deixando o canto opaco. Passar a limpar com `clearRect`, desenhar só o `roundRect` e usar `alphaTest`/`transparent` no material 3D. Teste: ler os 4 pixels de canto e exigir `alpha === 0`. | M | baixo |
| **R2** contenção no feltro | `renderers/layout.ts` (fonte da verdade das posições), `svg/SvgTableRenderer.tsx`, `three/ThreeTableRenderer.tsx`, `seats/SeatPlate.tsx` | Introduzir `clampToFelt(x, y, w, h)` em `layout.ts` (elipse do feltro como polígono de contenção) e passar **todos** os blocos monetários por ele. Hoje há apenas um clamp pontual em 88% do raio para o rótulo da aposta. | M | médio |
| **R3** pote sem borda/fundo | `svg/SvgTableRenderer.tsx`, `three/ThreeTableRenderer.tsx` | Remover `rect`/pílula e a borda do bloco do pote; manter legibilidade só por halo de texto (ver R16). | P | baixo |
| **R4** cartas × números | `renderers/layout.ts`, ambos os renderizadores | Reservar faixas exclusivas: banda do board e banda do pote como retângulos calculados; realocar rótulos que colidirem e reduzir escala do bloco numérico em telas estreitas. Reaproveitar o **teste de colisão em DOM** já usado nesta sessão, promovido a teste automatizado. | G | médio |
| **R5** lateral recolhível | `ui/replayer/ReplayerPage.tsx`, `Sidebar.tsx`, `state/store.ts` | `sidebarCollapsed` + `sidebarWidth` no store (persistidos), chevron, *drag handle* e atalho. | M | baixo |
| **R6** ir direto à ação do herói | `engine/replay.ts` (já expõe `jumpTargets.hero`), `useKeyboard.ts`, `Sidebar.tsx` (flag) | Nova flag `skipToHeroAction`; ao trocar de mão/street, saltar para o primeiro frame de ação do herói, pulando antes/blinds. | M | baixo |
| **R7** sala no título | `parsers/registry.ts` (detecção já existe), `ui/replayer/TableArea.tsx` (cabeçalho) | Exibir `hand.site` formatado; ausente ⇒ não renderiza nada. | P | baixo |
| **R8** controles rápidos | `ui/replayer/TableArea.tsx` ou nova `QuickBar.tsx`, `state/store.ts` | Popover com baralho, disposição (`holeLayout` já existe: sobreposto/lado a lado + novo "inclinado"), ocultar herói, revelar vilão (desabilitado sem showdown). | M | baixo |
| **R9** showdown no all-in | `engine/replay.ts` | Detectar o frame em que não há mais ação possível e marcar `revealed` para quem tem cartas conhecidas — hoje a revelação só ocorre no `show`. **Mudança de motor: exige teste dedicado.** | M | **alto** |
| **R10** remover equity | apagar `src/equity/*` (5 arquivos), limpar `SeatPlate.tsx`, ambos os renderizadores, `TableRenderer.ts`, `TableArea.tsx`, `store.ts`, `SettingsPage.tsx`, chaves dos 8 locales | Remoção pura; pot odds permanece. | M | baixo |
| **R11** um quadradinho por mão | `ui/replayer/Footer.tsx`, `engine/replay.ts` (`HandMeta`) | A timeline já mapeia `rows` 1:1; o ruído vem de mãos cujo resultado deriva só de blinds. Filtrar `meta.result` sem correspondência e garantir `rows.length === hands.length`. Teste com 144 mãos. | M | baixo |
| **R12** brilho abaixo das cartas | `three/ThreeTableRenderer.tsx` (`renderOrder` do neon/halo), `svg` (ordem no DOM) | Forçar `renderOrder` do brilho abaixo de cartas e fichas. | P | baixo |
| **R13** mesa estável | `TableArea.tsx`, `ThreeTableRenderer.tsx`, `SeatPlate.tsx` | Investigar `key` por índice, recriação de textura por frame e `useMemo` ausente; memoizar por assento e estabilizar `key` pelo nome do jogador. | M | médio |
| **R14** filtros e ordenação | `Sidebar.tsx`, `engine/replay.ts` (`HandMeta` já traz posição/resultado/net) | Estado de filtro no store; combinar posição + resultado + ordenação por pote + inversão + padrão; a timeline (R11) passa a refletir o subconjunto. | M | baixo |
| **R15** background da skin | `skins/types.ts` (`ui.background`), `AdminPage.tsx`, `App.tsx`/`TableArea.tsx`, `useAssetImage.ts` | Três modos (cor, gradiente, imagem) reusando o pipeline de assets já criado para a marca d'água. | M | baixo |
| **R16** legibilidade | `SeatPlate.tsx`, `Amount.tsx`, ambos os renderizadores, novo `contrast.ts` | Luminância do fundo efetivo → cor do texto + halo; teste automatizado de contraste AA. | M | médio |
| **R17** tela cheia | `ReplayerPage.tsx`, `Footer.tsx`, `store.ts` | `requestFullscreen`, estados normal/reduzida/oculta da barra, overlay de navegação com auto-hide. | M | baixo |
| **R18** lupa SharkScope | `SeatPlate.tsx`, `SettingsPage.tsx`, novo `shared/networks.ts` | Template configurável com `{nick}`/`{network}`, mapa sala→rede, `noopener noreferrer`. | P | baixo |
| **R19** lateral mais limpa | `Sidebar.tsx` | Seções colapsáveis, chips de filtro ativo, densidade compacta. Depende de R14. | M | baixo |
| **R20** biblioteca de mesas | `skins/types.ts`, `presets.ts`, ambos os renderizadores, `AdminPage.tsx` | Formato (elipse/oval/retangular/racetrack), estilo, **entalhe interno** configurável, marca d'água (já feita), ≥ 4 presets. Mexe na geometria dos dois renderizadores. | G | médio |
| **R21** zoom | `store.ts`, ambos os renderizadores, `useKeyboard.ts` | Três escalas independentes (mesa, cartas, fichas) com faixa segura que respeita R2/R4. | M | médio |
| **R22** denominação nas fichas | `renderers/layout.ts` (`chipBreakdown` já existe), `ChipStack` no SVG, `ChipStack3D` | Estampar valor na ficha (textura canvas), com opção de ficha lisa. | M | baixo |
| **R23** frente e costa | `skins/types.ts`, `primitives.ts`, `AdminPage.tsx` | Separar `deck.face` e `deck.back` com pré-visualização lado a lado. | M | baixo |

## Parte 4 — leaks e relatório

| # | Componentes | Diff proposto | Esforço |
|---|---|---|---|
| **L1** tags por usuário | `ui/replayer/ReviewPanel.tsx`, `SettingsPage.tsx`, `db/db.ts` (nova tabela `tags`), `model/types.ts` (`LeakTag` deixa de ser enum fixo) | CRUD de tags com cor e ordem, mantendo as atuais como padrão. | M |
| **L2** incluir no relatório | `ReviewPanel.tsx`, `model/types.ts` (`Review.includeInReport`) | Checkbox por item, persistido. | P |
| **L3** captura opcional | `ReviewPanel.tsx`, novo `infrastructure/capture.ts` | Por item: só texto ou print da área da mesa (`canvas.toDataURL` no 3D, serialização do SVG no 2D), guardado como asset. | M |
| **L4** pré-visualizar e exportar | nova rota `/report`, novo `report/` (PDF e DOCX client-side) | Pré-visualização + exportação. **Precisa de 2 dependências novas** (ver pergunta 13). | G |

---

## Sequência proposta (menor risco primeiro)
1. **Limpeza**: R10 (remover equity) → R3, R7, R12, R1.
2. **Layout**: R2 + R4 + R16 juntos (mesma fonte de verdade em `layout.ts`), com o teste de colisão promovido a automatizado.
3. **Navegação e listas**: R11 → R14 → R19 → R5 → R6 → R17.
4. **Motor**: R9 (isolado, com testes antes).
5. **Skins**: R15, R20, R21, R22, R23, R8, R18.
6. **Parte 4**: L1 → L2 → L3 → L4.
7. Só então **Parte 0** (monorepo/Clean Architecture) e a camada de contas.

## Observação sobre a ordem da Parte 9
O prompt manda começar pela Parte 0 (reorganização em monorepo + Clean Architecture). Recomendo **inverter**: fazer as Partes 3 e 4 no repositório atual e mover depois. Motivo: R2/R4/R9/R13 mexem exatamente nos arquivos que a reorganização vai mover; fazer as duas coisas juntas transforma cada `git mv` num conflito e torna impossível revisar o diff de comportamento separado do diff de movimentação. A Parte 0 fica melhor **entre** a Parte 4 e a camada de contas — que é quando o `apps/api` passa a existir de fato.
