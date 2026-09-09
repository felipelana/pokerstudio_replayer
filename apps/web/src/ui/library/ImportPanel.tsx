import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Site } from '@/model/types';
import { roomName } from '@pokerstudio/shared';
import { filesFromDataTransfer, importFiles, importText, type ImportSummary } from '@/parsers/importer';
import { parsers } from '@/parsers/registry';
import { useDateFormatter } from '@/ui/hooks/useFormat';
import { IconClose, IconNote, IconUpload } from '@/ui/icons';

interface Props {
  onImported(summaries: ImportSummary[]): void;
  compact?: boolean;
}

export function ImportPanel({ onImported, compact }: Props) {
  const { t } = useTranslation();
  const df = useDateFormatter();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [override, setOverride] = useState<Site | ''>('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [messages, setMessages] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const report = useCallback(
    (summaries: ImportSummary[]) => {
      const msgs: { kind: 'ok' | 'warn' | 'error'; text: string }[] = [];
      for (const s of summaries) {
        if (s.result.hands.length === 0) {
          if (s.result.site === 'unknown') msgs.push({ kind: 'error', text: `${s.session.name}: ${t('library.unknownFormat')}` });
          else if (s.result.failures.length)
            msgs.push({
              kind: 'error',
              text: `${s.session.name}: ${t('library.unsupported', { site: roomName(s.result.site) ?? s.result.site })}`,
            });
          else msgs.push({ kind: 'warn', text: t('library.nothingParsed', { name: s.session.name }) });
          continue;
        }
        const first = s.result.hands[0];
        const siteName = roomName(s.result.site) ?? s.result.site;
        const game =
          first.gameType === 'tournament'
            ? `${t('game.tournament')} #${first.tournament?.id ?? ''}`
            : t('game.cash');
        const parts = [
          t('library.imported', { hands: s.result.hands.length, site: siteName, game }),
        ];
        const warnCount = s.session.warnings.length;
        if (warnCount) parts.push(t('common.warnings', { count: warnCount }));
        if (s.duplicates) parts.push(t('library.importedDuplicates', { count: s.duplicates }));
        msgs.push({
          kind: warnCount ? 'warn' : 'ok',
          text: `${t('library.importedOk')} — ${s.session.name}: ${parts.join(' · ')}`,
        });
      }
      setMessages(msgs);
      onImported(summaries.filter((s) => s.result.hands.length > 0));
    },
    [onImported, t],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setBusy(true);
      try {
        // One tournament at a time: a session is a sitting, and importing a
        // pile of files at once only makes the library harder to read. When
        // more arrive — a dropped folder — the first is taken and the rest are
        // named in the message rather than silently dropped.
        const [first, ...rest] = files.filter((f) => /\.txt$/i.test(f.name) || f.type.startsWith('text/'));
        if (!first) return;
        const summaries = await importFiles([first], override || undefined);
        report(summaries);
        if (rest.length) {
          setMessages((current) => [
            ...current,
            { kind: 'warn', text: t('library.onlyFirstFile', { count: rest.length, name: first.name }) },
          ]);
        }
      } catch (e) {
        setMessages([{ kind: 'error', text: String(e) }]);
      } finally {
        setBusy(false);
      }
    },
    [override, report, t],
  );

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = await filesFromDataTransfer(e.dataTransfer);
    await handleFiles(files);
  };

  const importPasted = async () => {
    if (!paste.trim()) return;
    setBusy(true);
    try {
      const label = t('library.pasteName', { date: df.dateTime(new Date()) });
      report([await importText(label, paste, override || undefined)]);
      setPaste('');
      setPasteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-1 flex-col gap-3">
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-tour="import"
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click();
          }}
          className={`panel flex ${compact ? 'min-h-[96px]' : 'min-h-[150px]'} cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center transition-colors`}
          style={{
            borderColor: dragging ? 'var(--accent)' : 'var(--border)',
            background: dragging ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : undefined,
          }}
        >
          <div className="text-3xl" aria-hidden="true">
            ⬇
          </div>
          <div className="text-base font-semibold">{t('library.dropzone')}</div>
          <div className="max-w-md text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('library.dropzoneHint')}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
              <IconUpload size={15} />
              {t('library.selectFiles')}
            </button>
            <button type="button" className="btn" onClick={() => setPasteOpen(true)} disabled={busy}>
              <IconNote size={15} />
              {t('library.pasteButton')}
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('library.siteOverride')}
          <select className="input !w-auto !py-1" value={override} onChange={(e) => setOverride(e.target.value as Site | '')}>
            <option value="">{t('library.autoDetect')}</option>
            {parsers.map((p) => (
              <option key={p.site} value={p.site}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {messages.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className="rounded-md px-2 py-1"
              style={{
                background:
                  m.kind === 'ok'
                    ? 'color-mix(in srgb, var(--result-won) 18%, transparent)'
                    : m.kind === 'warn'
                      ? 'color-mix(in srgb, var(--result-break-even) 18%, transparent)'
                      : 'color-mix(in srgb, var(--result-lost) 18%, transparent)',
              }}
            >
              {m.text}
            </li>
          ))}
        </ul>
      )}

      {pasteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setPasteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('library.pasteButton')}
            className="panel flex w-full max-w-[640px] flex-col gap-3 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <h2 className="flex-1 text-lg font-semibold">{t('library.pasteButton')}</h2>
              <button type="button" className="btn-icon" onClick={() => setPasteOpen(false)} aria-label={t('common.cancel')}>
                <IconClose size={15} />
              </button>
            </div>
            <textarea
              autoFocus
              className="input min-h-[240px] font-mono text-xs"
              placeholder={t('library.pastePlaceholder')}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setPasteOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void importPasted()} disabled={busy || !paste.trim()}>
                {busy ? t('library.importing') : t('library.importPaste')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
