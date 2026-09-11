import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { systemApi, type HealthInfo } from '@/lib/infrastructure/http/systemApi';
import { dateTime } from './shared';

/**
 * Staging and production look identical from the inside, which is how a change
 * meant for one gets made on the other. This says which server actually
 * answered — it is read from that server, never baked into this bundle, so it
 * cannot be stale or wrong about where it is.
 */
export function BuildFooter() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<HealthInfo>();

  useEffect(() => {
    let alive = true;
    systemApi
      .health()
      .then((value) => alive && setInfo(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!info) return null;

  const live = info.env === 'production';
  const colour = live ? 'var(--result-won)' : 'var(--result-break-even)';

  return (
    <footer
      className="flex flex-wrap items-center gap-2 text-xs"
      style={{ color: 'var(--text-muted)' }}
    >
      <span className="chip-tag" style={{ color: colour, borderColor: colour }}>
        {info.env}
      </span>
      <span className="font-mono">v{info.version}</span>
      <span className="font-mono">{info.commit.slice(0, 7)}</span>
      {info.builtAt && <span>{t('admstudio.builtAt', { when: dateTime(info.builtAt) })}</span>}
    </footer>
  );
}
