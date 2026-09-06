# Poker Hand Replayer

Browser-only replayer for poker hand histories. Import PokerStars files (cash and tournament), step through every action on a 3D-lite table, see equity and pot odds per frame, and keep local review notes. Nothing leaves the browser — hands live in IndexedDB.

- Vite + React 18 + TypeScript (strict) + Tailwind, Zustand, Dexie, i18next (8 languages)
- Table rendered with Three.js / React Three Fiber; automatic SVG fallback without WebGL
- Pluggable parsers: PokerStars implemented; WPN, GGPoker, 888, iPoker, Chico and CoinPoker are detected but not parsed until real fixtures exist
- 7-card evaluator + Monte Carlo equity in a Web Worker (exact enumeration on turn/river)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173, drop a `.txt` hand history (or click **Load the demo sample**).

| Script                  | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                         |
| `npm test`              | Vitest (parser, engine, evaluator, sample invariants)   |
| `npm run build`         | Type-check + production build into `dist/`              |
| `npm run lint`          | ESLint                                                  |
| `npm run check:locales` | Verifies all 8 locale files have exactly `en.json` keys |
| `node scripts/gen-sample.ts` | Regenerates `samples/pokerstars-demo.txt`         |

## Keyboard shortcuts

| Key         | Action                                     |
| ----------- | ------------------------------------------ |
| `→` / `←`   | Next / previous action                     |
| `↓` / `↑`   | Next / previous hand                       |
| `Home`/`End`| First / last frame                         |
| `Space`     | Play / pause                               |
| `1`…`5`     | Preflop / Hero / Flop / Turn / River       |
| `B`         | Chips ↔ big blinds                         |
| `T`         | Dark ↔ light theme                         |
| `C`         | Cycle skins                                |
| `S`         | Show known hands                           |
| `?`         | Shortcut panel                             |

Shortcuts pause while a text field has focus.

## Project layout

```
src/model      canonical Hand/Action types, cards, positions, number formatting
src/parsers    HandHistoryParser interface, registry, PokerStars parser + fixtures/tests, stubs
src/engine     pure replay reducer, frame builder, side pots, pot odds, quick results
src/equity     evaluator, Monte Carlo, worker, React hook
src/renderers  layout math, SeatPlate (HTML), SvgTableRenderer, ThreeTableRenderer
src/ui         pages (library, replayer, settings, admin), cards, flags, hooks
src/skins      Skin type + built-in presets; src/locales the 8 translation files
src/db         Dexie schema and the Repository interface (IndexedDb implementation)
```

## Adding a parser

1. Create `src/parsers/<site>/index.ts` implementing `HandHistoryParser` (`detect`, `split`, `parse`). Never throw on unknown lines — push to `warnings`.
2. Put real, anonymised hand histories in `src/parsers/<site>/fixtures/` and write tests that assert hand count, final stacks, pots, winners, board and known cards.
3. Replace the stub in `src/parsers/stubs.ts` with the new parser in `src/parsers/registry.ts`.

The replay engine only consumes the canonical model, so a correct parser gets the full UI for free.

## Deploy on the VPS (Docker + Nginx)

The image is built by GitHub Actions on every push to `main`, pushed to GHCR, and pulled on the VPS over SSH.

### One-time VPS setup

```bash
# on the VPS
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # re-login afterwards
mkdir -p ~/lana-replayer && cd ~/lana-replayer
curl -O https://raw.githubusercontent.com/<owner>/<repo>/main/docker-compose.yml
echo "REPLAYER_IMAGE=ghcr.io/<owner>/<repo>:latest" > .env
echo "REPLAYER_PORT=8080" >> .env
docker compose up -d
```

Put a reverse proxy (Caddy, Traefik or the host Nginx) in front of port 8080 for TLS.

### GitHub secrets

| Secret        | Value                                              |
| ------------- | -------------------------------------------------- |
| `VPS_HOST`    | VPS hostname or IP                                 |
| `VPS_USER`    | SSH user (member of the `docker` group)            |
| `VPS_SSH_KEY` | Private key for that user                          |
| `VPS_PORT`    | SSH port (optional, default 22)                    |
| `VPS_APP_DIR` | Directory containing `docker-compose.yml` on the VPS |

`GITHUB_TOKEN` is provided automatically and is used to log in to GHCR from the VPS. If the package is private, create a classic PAT with `read:packages` and use it instead in the deploy step.

### Manual build

```bash
docker build -t lana-replayer .
docker run -p 8080:80 lana-replayer
```

## Data & privacy

- Hands, sessions, reviews, settings and custom skins are stored in IndexedDB (`lana-replayer` database).
- The app makes no network requests at runtime except Google Fonts (Inter / Roboto Mono / Noto CJK).
- **Library → Export** downloads a JSON backup; **Import** restores it. `Hand.id` is the SHA-256 of the normalised raw text so re-imports never duplicate.

## Roadmap (phase 2)

- `HttpRepository` against a backend on the VPS with login and synced reviews
- Parsers for the other sites once fixtures arrive
- Screenshot export via `renderer.domElement.toDataURL()` + HTML overlay
