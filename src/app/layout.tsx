import type { Metadata, Viewport } from 'next';
import '@/index.css';

/**
 * The document the replayer lives in. It carries what index.html carried: the
 * title, the icon, the manifest and the brand colour. The stylesheet still
 * addresses #root, so the element it expects is here.
 */
export const metadata: Metadata = {
  title: 'PokerStudio Replayer',
  description: 'Replay and review poker hand histories in your browser.',
  icons: { icon: '/favicon.svg' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e10600',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
