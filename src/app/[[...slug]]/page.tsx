'use client';

import dynamic from 'next/dynamic';

/**
 * Nothing here renders on the server.
 *
 * The replayer reads IndexedDB, draws with WebGL and detects the language from
 * the browser. Rendering it server side would buy nothing and would only
 * produce hydration warnings, so it is loaded in the browser and only there.
 */
const Replayer = dynamic(() => import('./Replayer'), {
  ssr: false,
});

export default function Page() {
  return <Replayer />;
}
