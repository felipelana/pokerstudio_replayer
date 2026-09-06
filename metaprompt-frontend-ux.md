# Metaprompt — Design system e revisão de UX/UI do Poker Hand Replayer · v1

> Este documento descreve o sistema visual aplicado ao replayer e serve de briefing
> para qualquer agente/pessoa que continue o trabalho de front-end. A skin **Flat**
> é a referência viva desse sistema.

## Parte 1 — Princípios

1. **A mesa é o conteúdo; o resto é moldura.** Nada compete com o feltro: painéis
   escuros, sem gradientes chamativos, sem bordas grossas.
2. **Um único acento por skin.** Botão primário, jogador da vez, anel do pote e
   destaques da lista usam a mesma cor. Duas cores de acento = ruído.
3. **Números antes de rótulos.** Valor grande, unidade pequena e esmaecida
   (`52.5` + `BB` a 66% do tamanho e 60% de opacidade). Rótulo em caixa alta
   pequena, `letter-spacing` 0.13em, cor `--text-muted`.
4. **Zero sobreposição.** Nenhum elemento de informação pode encostar em outro em
   nenhum frame. Isso é testável — ver Parte 4.
5. **Texto suave.** `-webkit-font-smoothing: antialiased`,
   `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility`,
   `letter-spacing: 0.005em` no corpo. Nada de branco puro sobre preto puro.
6. **Silêncio para o que não importa.** Assento vazio não desenha nada; jogador
   que foldou fica a 55% de opacidade; etiquetas secundárias em cinza frio.
7. **O olho vai para quem age.** O jogador da vez recebe halo colorido
   (`plates.activeGlow` + `activeGlowStrength`) — é o único brilho forte da tela.

## Parte 2 — Tokens

| Token | Papel |
|---|---|
| `ui.bg` / `ui.bgEnd` | fundo da aplicação (gradiente vertical sutil) |
| `ui.surface` / `ui.surface2` | barra lateral, rodapé / campos e chips de contagem |
| `ui.text` / `ui.textMuted` | texto principal / rótulos e unidades |
| `ui.accent` | ação primária, seleção, foco |
| `ui.border` | 1px a 7–10% de branco, nunca mais |
| `felt.*` | cor, textura, vinheta e sombra interna do pano |
| `table.rail*` | borda: madeira (GG) ou quase invisível (Flat) |
| `table.neonColor/Intensity` | brilho **interno** ao feltro; 0 desliga |
| `plates.activeGlow/Strength` | halo do jogador da vez |
| `chips.*` | denominações + botão do dealer |

Escala de raio: 4 (chips/etiquetas) · 8 (botões/campos) · 12 (placas) · 16 (pote) · full (pílulas).
Escala de texto: 9.5 (rótulo caps) · 10.5–11 (meta) · 12–13 (corpo) · 14 (stack) · 22–24 (pote).

## Parte 3 — Layout da mesa (invariantes)

- Herói (ou jogador em foco) sempre no assento inferior central.
- Placas fora do feltro; cartas **acima** da placa e **atrás** dela (`z-index`),
  para nunca cobrir o nome.
- Anel de apostas no terço externo do feltro (0.78/0.76 do raio); rótulo do valor
  **abaixo** da pilha e limitado a 88% do raio.
- Botão do dealer entre o board e o anel de apostas (0.68/0.66).
- Board logo acima do centro; **pote no centro** (rótulo caps + valor grande).
- Tamanho das cartas por lotação: 36 px (9-10 assentos), 42 (7-8), 48 (≤6);
  herói +28%.

## Parte 4 — Como validar (obrigatório antes de fechar qualquer mudança visual)

1. `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `node scripts/check-locales.mjs`.
2. Abrir o replayer e rodar o **teste de colisão no DOM**: para cada par de
   (rótulo, carta, pilha de fichas, botão do dealer, placa) verificar interseção
   de `getBoundingClientRect`. Resultado esperado: `conflicts: []` em um frame
   pré-flop com várias apostas **e** em um frame de river.
3. Repetir nos dois renderizadores (3D e 2D) e em pelo menos duas skins
   (uma clara e uma escura).
4. Conferir 8 idiomas: alemão (strings longas) e japonês (CJK) não podem quebrar
   linha nas placas nem no rodapé.

## Parte 5 — Pendências sugeridas

- Estados vazios ilustrados (biblioteca sem sessões, mão sem review).
- Foco visível consistente em todos os controles (hoje via `*:focus-visible`).
- Modo "estudo": esconder resultado e equity com um atalho só.
- Ajustar densidade para 1280×720 (hoje calibrado para ≥1440).
