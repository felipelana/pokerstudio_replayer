import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Site } from '@/model/types';
import { filesFromDataTransfer, importFiles, importText, type ImportSummary } from '@/parsers/importer';
import { parsers } from '@/parsers/registry';
import { useDateFormatter } from '@/ui/hooks/useFormat';

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
  const [name, setName] = useState('');
  const [messages, setMessages] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string }[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const report = useCallback(
    (summaries: ImportSummary[]) => {
      const msgs: { kind: 'ok' | 'warn' | 'error'; text: string }[] = [];
      for (const s of summaries) {
        if (s.result.hands.length === 0) {
          if (s.result.site === 'unknown') msgs.push({ kind: 'error', text: `${s.session.name}: ${t('library.unknownFormat')}` });
          else if (s.result.failures.length)
            msgs.push({
              kind: 'error',
              text: `${s.session.name}: ${t('library.unsupported', { site: parsers.find((p) => p.site === s.result.site)?.displayName ?? s.result.site })}`,
            });
          else msgs.push({ kind: 'warn', text: t('library.nothingParsed', { name: s.session.name }) });
          continue;
        }
        const first = s.result.hands[0];
        const siteName = parsers.find((p) => p.site === s.result.site)?.displayName ?? s.result.site;
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
        msgs.push({ kind: warnCount ? 'warn' : 'ok', text: `${s.session.name}: ${parts.join(' · ')}` });
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
        report(await importFiles(files, override || undefined, name));
        setName('');
      } catch (e) {
        setMessages([{ kind: 'error', text: String(e) }]);
      } finally {
        setBusy(false);
      }
    },
    [override, name, report],
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
      const label = name.trim() || t('library.pasteName', { date: df.dateTime(new Date()) });
      report([await importText(label, paste, override || undefined)]);
      setPaste('');
      setName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${compact ? '' : 'md:flex-row'}`}>
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
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click();
          }}
          className={`panel flex ${compact ? 'min-h-[120px]' : 'min-h-[220px]'} cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center transition-colors`}
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
              {t('library.selectFiles')}
            </button>
            <button type="button" className="btn" onClick={() => dirInput.current?.click()} disabled={busy}>
              {t('library.selectFolder')}
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            multiple
            hidden
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <input
            ref={dirInput}
            type="file"
            hidden
            multiple
            // @ts-expect-error non-standard attribute supported by Chromium/WebKit
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              void handleFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
        <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('library.nameLabel')}
          <input
            className="input"
            value={name}
            placeholder={t('library.namePlaceholder')}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
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

      <div className="flex flex-1 flex-col gap-2">
        <textarea
          aria-label={t('library.pasteLabel')}
          id="paste-area"
          className={`input flex-1 font-mono text-xs ${compact ? 'min-h-[120px]' : 'min-h-[200px]'}`}
          placeholder={t('library.pastePlaceholder')}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void importPasted()} disabled={busy || !paste.trim()}>
            {busy ? t('library.importing') : t('library.importPaste')}
          </button>
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
      </div>
    </div>
  );
}
