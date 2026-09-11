import { LegalBody, legalTitle, type LegalDocName } from './LegalDialog';

/**
 * One legal document on its own page, for a direct link or a printout. In the
 * app itself the same text opens in a dialog, so the reader never loses the
 * form they were filling in.
 */
export function LegalPage({ doc }: { doc: LegalDocName }) {
  return (
    <div className="mx-auto max-w-[760px] px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">{legalTitle(doc)}</h1>
      <LegalBody doc={doc} />
    </div>
  );
}
