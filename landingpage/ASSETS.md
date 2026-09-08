# Assets used on the landing page

Everything the page loads lives inside this folder. Nothing is read from a
temporary directory, and nothing is hot-linked from another site.

## Product captures

Three real screenshots of PokerStudio Replayer were supplied for this page:

| Source capture (kept in `_source/`, git-ignored) | Native size | What it shows |
| --- | --- | --- |
| `shot-replayer.png` | 1945 × 1073 | The replayer with a tournament hand in play |
| `shot-skins.png` | 1935 × 1069 | The skin editor with the live table preview and the language menu |
| `shot-review.png` | 1934 × 1068 | The replayer with the review panel and the display popover open |

`scripts/prepare-assets.ps1` turns them into what the page ships, in
`src/assets/shots/`:

| File | Size | From |
| --- | --- | --- |
| `replayer-full.jpg` | 1600 × 883 | whole replayer window (hero) |
| `crop-table.jpg` | 1080 × 620 | the 3D table mid-hand |
| `crop-hand-list.png` | 314 × 672 | hand list with the Report button |
| `crop-filters.png` | 314 × 344 | filters and display options |
| `crop-timeline.png` | 1627 × 183 | playback controls and hand timeline |
| `crop-review-panel.png` | 290 × 352 | leak tags, notes, include in report |
| `crop-street-notes.png` | 290 × 278 | notes per street |
| `crop-display-panel.png` | 248 × 428 | skin, deck colours and zoom sliders |
| `skins-full.jpg` | 1600 × 884 | the skin editor |
| `crop-deck.png` | 582 × 134 | card fronts and back patterns |
| `crop-languages.png` | 238 × 298 | the eight-language menu |
| `public/og-image.jpg` | 1200 × 630 | social preview, built from `replayer-full` |

### Player names

Every nickname is pixelated in 6 px blocks and then blurred three times, on the
seat plates **and** in the action history — TheLIPE7 and every other player.
Cards, stacks, positions, pot sizes, badges and all controls are untouched: the
redaction boxes only cover the name line of a plate, and in the history they
stop before the verb, so "raises to 2.5 BB" still reads.

The untreated originals stay in `_source/`, which is listed in `.gitignore` and
is never copied into `public/` or `dist/`.

`scripts/zoom.ps1` renders a magnified, ruler-annotated crop of any capture; it
is how the redaction boxes were measured, and how they should be re-measured if
new screenshots arrive.

### The review capture and the star widget

No full-window image is published from `shot-review.png`. The top of its review
panel still shows the previous five-star rating widget, and the scale is 0–100
now, so only crops taken from below it are used. The script marks that output
`skip = $true` and says why.

## Brand

| File | From |
| --- | --- |
| `src/assets/brand/pokerstudio-mark-512.png` | `img/logopsreplayer` (1254 × 1254), downscaled |
| `src/assets/brand/pokerstudio-mark-128.png` | the same, for the header and footer |
| `public/favicon.svg` | copied from `apps/web/public/favicon.svg` |

The palette is taken from that logo: near-black grounds (`#08080a`, `#0d0d10`,
`#131318`), light greys for text, and `#e10600` as the single accent — the same
accent the Replayer uses.

## Illustrations

Four diagrams are drawn as inline SVG in `src/components/Illustrations.tsx`:
sharing, resuming a review, saved reviews, the report, and the evolution chart.
They are not screenshots and every place they appear says so — an "illustration"
badge on the carousel slide and a caption under the chart. The evolution chart's
series are shaped to show what the chart looks like; they are not real scores.

## Poker room marks

`src/components/RoomLogos.tsx` holds one mark per room, drawn as inline SVG.

They were redrawn from the logos Felipe supplied with the request, each reduced
to a single colour and a single stroke weight: no gradients, no background
plates, no brand typography. That is what makes the ten sit together as one row
of white marks on black instead of ten competing colour schemes, and it keeps
them sharp at any size. The room's name is set beside each mark in the page's
own font.

**WPN** is the exception — its mark is the actual path from the vector file
Felipe provided (`winning-logo.svg`), with the gradient plate and the small
"WINNING POKER NETWORK" lettering removed, since that lettering is unreadable at
the size the grid uses.

None of these rooms publishes a first-party press page with a redistributable
logo; what search returns is aggregators such as
[Brandfetch's PokerStars page](https://brandfetch.com/pokerstars.com) and
[Brandfetch's GGPoker page](https://brandfetch.com/ggpoker.com), which state that
use of a mark needs written permission from its holder. Nothing was taken from
those. The section carries a line saying PokerStudio has no commercial
relationship with any of the rooms, and the marks are shown only to say whose
export format is read.

Should a licensed original ever replace a drawing, these are the official sites
to request it from:

| Room | Official site |
| --- | --- |
| PokerStars | https://www.pokerstars.com |
| 888poker | https://www.888poker.com |
| GGPoker | https://ggpoker.com |
| iPoker | https://www.playtech.com (Playtech, the network operator) |
| WPN | https://www.winningpokernetwork.com |
| Chico | https://www.betonline.ag / https://www.tigergaming.com (network skins) |
| Winamax | https://www.winamax.fr |
| CoinPoker | https://coinpoker.com |
| Ignition / Bodog | https://ignitioncasino.eu / https://www.bodog.eu |
| PartyPoker | https://www.partypoker.com |

## Fonts

Inter and the Noto Sans CJK families are loaded from Google Fonts, the same
families and weights the Replayer uses, with a system-font fallback stack.
