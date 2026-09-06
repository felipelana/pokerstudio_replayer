import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { HandReplay } from '@/engine/replay';
import type { Hand } from '@/model/types';
import { useAppStore, type JumpTarget } from '@/state/store';
import { IconFirst, IconLast, IconNext, IconPause, IconPlay, IconPrev } from '@/ui/icons';
import { describeFrame } from './logText';
import type { HandRow } from './Sidebar';

interface Props {
  replay: HandReplay;
  rows: HandRow[];
  currentIndex: number;
  fmt: (v: number) => string;
  onSelectHand(index: number): void;
}

const JUMPS: { target: JumpTarget; label: string; key: string }[] = [
  { target: 'preflop', label: 'footer.preflop', key: '1' },
  { target: 'hero', label: 'footer.hero', key: '2' },
  { target: 'flop', label: 'footer.flop', key: '3' },
  { target: 'turn', label: 'footer.turn', key: '4' },
  { target: 'river', label: 'footer.river', key: '5' },
];

export function Footer({ replay, rows, currentIndex, fmt, onSelectHand }: Props) {
  const { t } = useTranslation();
  const frameIndex = useAppStore((s) => s.frameIndex);
  const playing = useAppStore((s) => s.playing);
  const setFrame = useAppStore((s) => s.setFrame);
  const nextFrame = useAppStore((s) => s.nextFrame);
  const prevFrame = useAppStore((s) => s.prevFrame);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const jumpTo = useAppStore((s) => s.jumpTo);
  const jumpTargets = useAppStore((s) => s.jumpTargets);
  const speed = useAppStore((s) => s.settings.speed);
  const hideResults = useAppStore((s) => s.settings.hideResults);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const logRef = useRef<HTMLOListElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(
    () => replay.frames.map((f) => describeFrame(f, replay.hand, t, fmt)),
    [replay, t, fmt],
  );

  useEffect(() => {
    const el = logRef.current?.children[frameIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [frameIndex]);

  useEffect(() => {
    const el = timelineRef.current?.querySelector<HTMLElement>(`[data-index="${currentIndex}"]`);
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [currentIndex]);

  const levelLabel = (h: Hand) =>
    h.gameType === 'tournament' ? `${fmtBlind(h.blinds.bb)}/${fmtBlind(h.blinds.sb)}${h.blinds.ante ? `-${fmtBlind(h.blinds.ante)}` : ''}` : '';

  // Blind-level separators for tournaments.
  const separators = useMemo(() => {
    const out = new Map<number, string>();
    let last = '';
    rows.forEach((r, i) => {
      const l = levelLabel(r.hand);
      if (l && l !== last) {
        out.set(i, l);
        last = l;
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    <footer className="flex h-[182px] shrink-0 flex-col gap-1.5 border-t p-2" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex min-h-0 flex-1 gap-3">
        <ol
          ref={logRef}
          className="min-h-0 flex-1 overflow-auto rounded-lg border p-1.5 font-mono text-[12px] leading-[1.5]"
          aria-label={t('footer.log')}
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          {lines.map((line, i) => (
            <li
              key={i}
              onClick={() => setFrame(i)}
              className="cursor-pointer truncate rounded px-1.5 py-[1px]"
              style={{
                background: i === frameIndex ? 'color-mix(in srgb, var(--accent) 28%, transparent)' : undefined,
                color: i > frameIndex ? 'var(--text-muted)' : 'var(--text)',
                fontWeight: i === frameIndex ? 600 : 400,
              }}
            >
              {line}
            </li>
          ))}
        </ol>
        <div className="flex w-[420px] shrink-0 flex-col gap-2">
          <div className="flex gap-1">
            {JUMPS.map((j) => (
              <button key={j.target} type="button" className="btn flex-1" disabled={jumpTargets[j.target] === undefined} onClick={() => jumpTo(j.target)} title={`${t(j.label)} (${j.key})`}>
                {t(j.label)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="btn-icon" onClick={() => setFrame(0)} title={t('footer.first')} aria-label={t('footer.first')}>
              <IconFirst size={15} />
            </button>
            <button type="button" className="btn-icon" onClick={() => { setPlaying(false); prevFrame(); }} title={t('footer.prev')} aria-label={t('footer.prev')}>
              <IconPrev size={15} />
            </button>
            <button
              type="button"
              className="btn btn-primary !px-3.5"
              onClick={() => setPlaying(!playing)}
              title={playing ? t('footer.pause') : t('footer.play')}
              aria-label={playing ? t('footer.pause') : t('footer.play')}
            >
              {playing ? <IconPause size={15} /> : <IconPlay size={15} />}
            </button>
            <button type="button" className="btn-icon" onClick={() => { setPlaying(false); nextFrame(); }} title={t('footer.next')} aria-label={t('footer.next')}>
              <IconNext size={15} />
            </button>
            <button type="button" className="btn-icon" onClick={() => setFrame(replay.frames.length - 1)} title={t('footer.last')} aria-label={t('footer.last')}>
              <IconLast size={15} />
            </button>
            <span className="ml-1 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {t('footer.frame', { current: frameIndex + 1, total: replay.frames.length })}
            </span>
            <div className="flex-1" />
            <label className="flex items-center gap-1 text-xs" title={t('footer.speed')}>
              <span style={{ color: 'var(--text-muted)' }}>{t('footer.speed')}</span>
              <select className="input !w-auto !py-0.5" value={speed} onChange={(e) => updateSettings({ speed: Number(e.target.value) })}>
                {[0.5, 1, 1.5, 2, 3].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, replay.frames.length - 1)}
            value={frameIndex}
            onChange={(e) => setFrame(Number(e.target.value))}
            aria-label={t('footer.frame', { current: frameIndex + 1, total: replay.frames.length })}
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>
      </div>
      <div ref={timelineRef} className="flex h-[30px] shrink-0 items-end gap-[3px] overflow-x-auto overflow-y-hidden" aria-label={t('footer.timeline')} role="listbox">
        {rows.map((r, i) => (
          <div key={r.hand.id} className="flex shrink-0 items-end gap-[2px]">
            {separators.has(i) && (
              <span className="mr-1 whitespace-nowrap text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {separators.get(i)}
              </span>
            )}
            <button
              type="button"
              role="option"
              aria-selected={i === currentIndex}
              data-index={i}
              onClick={() => onSelectHand(i)}
              title={`#${i + 1} · ${r.hand.handNumber}`}
              className={`flex h-[22px] w-[18px] items-center justify-center rounded-[4px] text-[10px] font-bold leading-none text-white ${r.meta.result && !hideResults ? `result-${r.meta.result}` : ''}`}
              style={{
                background: r.meta.result && !hideResults ? undefined : 'color-mix(in srgb, var(--text) 15%, transparent)',
                outline: i === currentIndex ? '2px solid var(--accent)' : undefined,
                outlineOffset: 1,
              }}
            >
              {r.meta.vpip ? t('footer.vpip') : ''}
            </button>
          </div>
        ))}
      </div>
    </footer>
  );
}

function fmtBlind(v: number): string {
  if (v >= 1000 && v % 1000 === 0) return `${v / 1000}K`;
  return String(v);
}
