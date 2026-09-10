import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

/**
 * Unlike the replayer, this page is worth describing to a machine that will
 * never run its JavaScript. The title and the description are served in the
 * HTML; the page itself still renders in the browser, and rewrites them when
 * the reader picks another language.
 */
export const metadata: Metadata = {
  title: 'PokerStudio Replayer: reveja suas mãos e estude melhor',
  description:
    'Reveja seus hand histories de cash e torneio no navegador, mão a mão, street a street, e avalie suas decisões.',
  alternates: { canonical: 'https://pokerstudio.com.br/' },
  openGraph: {
    title: 'PokerStudio Replayer',
    description: 'Reveja seus hand histories no navegador e estude melhor.',
    url: 'https://pokerstudio.com.br/',
    siteName: 'PokerStudio',
    locale: 'pt_BR',
    type: 'website',
  },
};

const Landing = dynamic(() => import('./Landing'), { ssr: false });

export default function Page() {
  return <Landing />;
}
