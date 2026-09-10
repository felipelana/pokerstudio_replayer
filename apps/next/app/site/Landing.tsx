'use client';

import '@landing/i18n';
import '@landing/index.css';
import App from '@landing/App';

/**
 * The landing page, as it already is.
 *
 * It sets its own title and description from the chosen language, and it reads
 * the scroll position to light the menu, so it belongs in the browser. What Next
 * adds is the metadata in the served HTML, which is what a crawler and a link
 * preview read before any script runs.
 */
export default function Landing() {
  return <App />;
}
