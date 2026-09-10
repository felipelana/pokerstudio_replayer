'use client';

import { BrowserRouter } from 'react-router-dom';
import '@/i18n';
import { App } from '@/App';
import { installErrorReporter } from '@/infrastructure/observability/errorReporter';

// A crash in the browser is only ever seen in the browser, unless it is sent.
installErrorReporter();

/**
 * The whole product, unchanged.
 *
 * The routing stays where it was: react-router owns every path under this
 * catch-all, so the seventeen routes, their URLs and their components are the
 * same files they were before Next arrived.
 */
export default function Replayer() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
