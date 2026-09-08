/**
 * The product captures, with their intrinsic size so every <img> can reserve
 * its space before it loads and nothing shifts on the page.
 *
 * All of them come out of scripts/prepare-assets.ps1: real screenshots with the
 * player nicknames blurred. There is no full-window capture of the review
 * screen on purpose — see the script.
 */
import replayerFull from './shots/replayer-full.jpg';
import cropTable from './shots/crop-table.jpg';
import cropHandList from './shots/crop-hand-list.png';
import cropTimeline from './shots/crop-timeline.png';
import cropFilters from './shots/crop-filters.png';
import cropReviewPanel from './shots/crop-review-panel.png';
import cropStreetNotes from './shots/crop-street-notes.png';
import cropDisplayPanel from './shots/crop-display-panel.png';
import skinsFull from './shots/skins-full.jpg';
import cropDeck from './shots/crop-deck.png';
import cropLanguages from './shots/crop-languages.png';
import mark512 from './brand/pokerstudio-mark-512.png';
import mark128 from './brand/pokerstudio-mark-128.png';

export interface Shot {
  src: string;
  width: number;
  height: number;
}

export const SHOTS = {
  replayerFull: { src: replayerFull, width: 1600, height: 883 },
  table: { src: cropTable, width: 1080, height: 620 },
  handList: { src: cropHandList, width: 314, height: 672 },
  timeline: { src: cropTimeline, width: 1627, height: 183 },
  filters: { src: cropFilters, width: 314, height: 344 },
  reviewPanel: { src: cropReviewPanel, width: 290, height: 352 },
  streetNotes: { src: cropStreetNotes, width: 290, height: 278 },
  displayPanel: { src: cropDisplayPanel, width: 248, height: 428 },
  skinsFull: { src: skinsFull, width: 1600, height: 884 },
  deck: { src: cropDeck, width: 582, height: 134 },
  languages: { src: cropLanguages, width: 238, height: 298 },
} satisfies Record<string, Shot>;

export const MARK = {
  large: { src: mark512, width: 512, height: 512 },
  small: { src: mark128, width: 128, height: 128 },
} satisfies Record<string, Shot>;
