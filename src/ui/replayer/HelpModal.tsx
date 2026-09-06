import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/store';

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ['→'], label: 'shortcuts.nextAction' },
  { keys: ['←'], label: 'shortcuts.prevAction' },
  { keys: ['↑'], label: 'shortcuts.prevHand' },
  { keys: ['↓'], label: 'shortcuts.nextHand' },
  { keys: ['Home'], label: 'shortcuts.firstFrame' },
  { keys: ['End'], label: 'shortcuts.lastFrame' },
  { keys: ['Space'], label: 'shortcuts.playPause' },
  { keys: ['1', '2', '3', '4', '5'], label: 'shortcuts.jumpStreets' },
  { keys: ['B'], label: 'shortcuts.toggleChips' },
  { keys: ['T'], label: 'shortcuts.toggleTheme' },
  { keys: ['C'], label: 'shortcuts.cycleSkin' },
  { keys: ['S'], label: 'shortcuts.toggleKnown' },
  { keys: ['?'], label: 'shortcuts.help' },
];

export function HelpModal() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.helpOpen);
  const setOpen = useAppStore((s) => s.setHelpOpen);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)} role="presentation">
      <div className="panel w-full max-w-md p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center">
          <h2 id="help-title" className="text-lg font-semibold">
            {t('shortcuts.title')}
          </h2>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="py-1.5 pr-3 whitespace-nowrap">
                  {r.keys.map((k) => (
                    <kbd key={k} className="mr-1">
                      {k}
                    </kbd>
                  ))}
                </td>
                <td className="py-1.5">{t(r.label)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('shortcuts.hint')}
        </p>
      </div>
    </div>
  );
}
