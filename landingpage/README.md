# PokerStudio landing page

A one-page site for PokerStudio, with the PokerStudio Replayer as the product.
It is a separate static site: same stack and conventions as `apps/web`
(Vite 5 + React 18 + TypeScript + Tailwind + i18next), no API, no shared runtime.

Everything it needs is inside this folder — captures, logo, fonts declaration,
translations. Nothing is read from a temporary path.

## Running it

The workspace shares the monorepo's `node_modules`, so from the repository root:

```bash
npm run dev:landing
```

That serves it on <http://localhost:5180>. From inside `landingpage/` the usual
scripts work too:

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server on 5180 |
| `npm run build` | type-check and build into `dist/` |
| `npm run preview` | serve the built `dist/` |
| `npm run check:locales` | fail if any of the 8 locales drifts from `en.json` |
| `npm run assets` | rebuild the captures from `_source/` (Windows, PowerShell) |

## Where the CTA points

Every "Experimente grátis" button reads `replayerUrl()` in `src/config.ts`:

1. `VITE_REPLAYER_URL`, when set. `.env.development` sets it to
   `http://localhost:5173`, and `vite build` does not read that file.
2. Otherwise the destination follows the hostname the page is served from:
   localhost or a private address → `VITE_REPLAYER_URL_DEV`
   (`http://localhost:5173`); anything else → `VITE_REPLAYER_URL_PROD`
   (`https://replayer.pokerstudio.com.br`).

So a production build served from a real domain can never send a visitor to
localhost, even if someone forgets to set an environment variable. `.env.example`
lists all of them.

## Checking it

- **Anchors and navigation** — the menu scrolls smoothly to each section, offset
  by the header height, and the active section is underlined in the desktop nav
  and marked in the mobile one. Choosing a section closes the mobile menu.
- **Carousel** — advances on its own every 4 s, and stops while the pointer is
  over it, while focus is inside it, and while the tab is in the background. The
  pause button next to the arrows stops it for good. Arrows, dots,
  ← / → / Home / End and a swipe on touch all work at any time.
- **Languages** — the button shows the flag and a short label; the list spells
  all eight out in full. The choice is kept in `localStorage`
  (`pokerstudio-landing-lang`) and also rewrites `<html lang>`, the page title
  and the meta description.
- **Reduced motion** — with `prefers-reduced-motion: reduce`, scrolling is
  instant, the entrance animations are off, the carousel does not slide and it
  does not advance on its own.
- **Responsive** — one column below 640, two from 640, the full navigation from
  1024.

## Deploying

`npm run build` produces a fully static `dist/`. Serve it with any web server;
`base` is `./`, so it works from a subdirectory too.

Two values in `index.html` are placeholders until the host is decided: the
`<link rel="canonical">` and `og:image`, which assume the site is served from
`https://pokerstudio.com.br/`. Point them at the real origin before going live.

## What is claimed on the page

Only what the product does today, checked against this repository:

- Scores 0–100, leak tags, comment per hand and per street: `Assessment`,
  `HandAssessment` and `RubricBand` in `apps/api/prisma/schema.prisma`.
- Coach invitations by link and password with an expiry: `CoachInvite`; the
  allowed range lives in `ShareSettings` and is administered, so the page says
  the expiry is chosen within a range rather than quoting a number.
- Resuming where each assessor stopped: `currentHandIndex` / `currentFrameIndex`.
- PDF and DOCX export: `apps/web/src/report/export.ts`.

The "Em breve" section is explicitly labelled and carries no buttons, and the
reports section states that these are assessments of decisions — no profit
promise and no AI analysis.

**One thing the page states that the code does not yet back:** the rooms section
lists ten rooms as importable, on the product owner's word. In this repository
only the PokerStars parser is implemented (`apps/web/src/parsers/pokerstars`);
WPN, GGPoker, 888poker, iPoker, Chico and CoinPoker are detect-only stubs that
throw `NotImplementedError` (`apps/web/src/parsers/stubs.ts`), and Winamax,
Ignition/Bodog and PartyPoker have no entry at all. The list is one array in
`src/data/rooms.ts`, so trimming it is a one-line change.

See `ASSETS.md` for where every image comes from and how the player names were
blurred.
