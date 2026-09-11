import { LANGUAGES } from '@/i18n';
import { FLAGS } from '@/components/flags';

/**
 * A language picker that shows the flag beside the name. A native <select>
 * cannot hold an SVG, so the flag sits to its left and follows the choice.
 */
export function LanguageChoice({
  value,
  onChange,
  id,
  className = '',
}: {
  value: string;
  onChange(code: string): void;
  id?: string;
  className?: string;
}) {
  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];
  const Flag = FLAGS[current.flag];

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <Flag size={20} />
      <select
        id={id}
        className="input flex-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </span>
  );
}
