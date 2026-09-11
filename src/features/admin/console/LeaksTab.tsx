import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, type AdminLeakRow } from '@/lib/infrastructure/http/adminApi';
import { ApiError } from '@/lib/infrastructure/http/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Empty, useLoader } from './shared';

/**
 * O catálogo de leaks, que é o vocabulário compartilhado das revisões.
 *
 * O leitor continua inventando as próprias etiquetas; o que esta tela edita é a
 * lista que a ferramenta oferece a todo mundo. Isso importa porque um relatório
 * só consegue somar duas leituras quando as duas usaram a mesma palavra.
 *
 * Duas regras da tela vêm do servidor e estão aqui só para ficarem visíveis
 * antes de o leitor tentar: o identificador não se edita depois de criado, e
 * uma entrada se aposenta em vez de ser apagada, porque as mãos já marcadas
 * guardam o identificador e uma linha que sumisse deixaria marcas ilegíveis.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** O que a linha mostra do leak, do jeito que o leitor o vê na revisão. */
function LeakChip({ leak }: { leak: AdminLeakRow }) {
  return (
    <span
      className="chip-tag"
      style={{
        color: leak.color,
        borderColor: leak.color,
        opacity: leak.active ? 1 : 0.45,
      }}
    >
      {leak.label}
    </span>
  );
}

export function LeaksTab() {
  const { t } = useTranslation();
  const { data, error, busy, reload } = useLoader<{ items: AdminLeakRow[] }>(
    () => adminApi.leaks(),
    [],
  );
  const [notice, setNotice] = useState({ text: '', failed: false });
  const [retiring, setRetiring] = useState<AdminLeakRow>();

  const items = data?.items ?? [];
  const active = items.filter((leak) => leak.active);
  const retired = items.filter((leak) => !leak.active);

  const report = (err: unknown) =>
    setNotice({
      text: err instanceof ApiError ? err.problem.title : t('auth.offline'),
      failed: true,
    });

  const save = async (id: string, patch: Parameters<typeof adminApi.updateLeak>[1]) => {
    try {
      await adminApi.updateLeak(id, patch);
      setNotice({ text: t('admstudio.saved'), failed: false });
      reload();
    } catch (err) {
      report(err);
    }
  };

  const retire = async () => {
    if (!retiring) return;
    const leak = retiring;
    setRetiring(undefined);
    try {
      await adminApi.retireLeak(leak.id);
      setNotice({ text: t('admstudio.leakRetired', { label: leak.label }), failed: false });
      reload();
    } catch (err) {
      report(err);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('admstudio.leaksHint')}
      </p>

      <NewLeakForm
        taken={new Set(items.map((leak) => leak.slug))}
        onCreated={(label) => {
          setNotice({ text: t('admstudio.leakCreated', { label }), failed: false });
          reload();
        }}
        onFailed={report}
      />

      {notice.text && (
        <p
          className="text-sm"
          role="status"
          style={{ color: notice.failed ? 'var(--result-lost)' : 'var(--result-won)' }}
        >
          {notice.text}
        </p>
      )}

      <section
        className="panel overflow-x-auto"
        aria-label={t('admstudio.leaksOffered', { count: active.length })}
      >
        <h3 className="p-3 pb-0 font-semibold">
          {t('admstudio.leaksOffered', { count: active.length })}
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="p-2 text-left font-medium">{t('admstudio.colOrder')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colLeak')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colSlug')}</th>
              <th className="p-2 text-left font-medium">{t('admstudio.colHint')}</th>
              <th className="p-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {active.map((leak) => (
              <LeakRow key={leak.id} leak={leak} onSave={save} onRetire={setRetiring} />
            ))}
          </tbody>
        </table>
        <Empty busy={busy} error={error} empty={!busy && !error && active.length === 0} />
      </section>

      {retired.length > 0 && (
        <section className="panel overflow-x-auto" aria-label={t('admstudio.leaksRetired')}>
          <h3 className="p-3 pb-0 font-semibold">{t('admstudio.leaksRetired')}</h3>
          <p className="px-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('admstudio.leaksRetiredHint')}
          </p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {retired.map((leak) => (
                <tr key={leak.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="p-2">
                    <LeakChip leak={leak} />
                  </td>
                  <td className="p-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    {leak.slug}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => save(leak.id, { active: true })}
                    >
                      {t('admstudio.leakRestore')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <ConfirmDialog
        open={!!retiring}
        title={t('admstudio.leakRetireTitle')}
        body={t('admstudio.leakRetireBody', { label: retiring?.label ?? '' })}
        confirmLabel={t('admstudio.leakRetireConfirm')}
        danger
        onConfirm={retire}
        onCancel={() => setRetiring(undefined)}
      />
    </div>
  );
}

/**
 * Uma linha que se edita no lugar. O slug aparece, e não aceita edição: é ele
 * que as avaliações guardam, então renomear é seguro e trocá-lo não seria.
 */
function LeakRow({
  leak,
  onSave,
  onRetire,
}: {
  leak: AdminLeakRow;
  onSave(
    id: string,
    patch: { label?: string; color?: string; hint?: string | null; position?: number },
  ): void;
  onRetire(leak: AdminLeakRow): void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(leak);

  useEffect(() => setDraft(leak), [leak]);

  const changed =
    draft.label !== leak.label ||
    draft.color !== leak.color ||
    (draft.hint ?? '') !== (leak.hint ?? '') ||
    draft.position !== leak.position;
  const valid = draft.label.trim().length > 0 && HEX.test(draft.color);

  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <td className="p-2">
        <input
          className="input w-16 tabular-nums"
          type="number"
          min={0}
          aria-label={t('admstudio.colOrder')}
          value={draft.position}
          onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
        />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <input
            className="input w-12 p-1"
            type="color"
            aria-label={t('admstudio.colColour')}
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
          />
          <input
            className="input min-w-[10rem]"
            aria-label={t('admstudio.colLeak')}
            maxLength={60}
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <LeakChip leak={draft} />
        </div>
      </td>
      <td className="p-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
        {leak.slug}
      </td>
      <td className="p-2">
        <input
          className="input w-full min-w-[12rem]"
          aria-label={t('admstudio.colHint')}
          maxLength={200}
          placeholder={t('admstudio.leakHintPlaceholder')}
          value={draft.hint ?? ''}
          onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
        />
      </td>
      <td className="p-2">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!changed || !valid}
            onClick={() =>
              onSave(leak.id, {
                label: draft.label.trim(),
                color: draft.color,
                hint: draft.hint?.trim() || null,
                position: draft.position,
              })
            }
          >
            {t('common.save')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onRetire(leak)}>
            {t('admstudio.leakRetire')}
          </button>
        </div>
      </td>
    </tr>
  );
}

/** O formulário de criação. O slug é sugerido a partir do nome e pode ser trocado. */
function NewLeakForm({
  taken,
  onCreated,
  onFailed,
}: {
  taken: Set<string>;
  onCreated(label: string): void;
  onFailed(err: unknown): void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [slug, setSlug] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [colour, setColour] = useState('#4fa3ff');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  /** Sugere o identificador enquanto ninguém o tiver escrito à mão. */
  const suggest = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

  const effectiveSlug = touchedSlug ? slug : suggest(label);
  const duplicate = taken.has(effectiveSlug);
  const valid = label.trim().length > 0 && SLUG.test(effectiveSlug) && !duplicate;

  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.createLeak({
        slug: effectiveSlug,
        label: label.trim(),
        color: colour,
        hint: hint.trim() || undefined,
      });
      onCreated(label.trim());
      setLabel('');
      setSlug('');
      setTouchedSlug(false);
      setHint('');
    } catch (err) {
      onFailed(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4" aria-label={t('admstudio.leakNew')}>
      <h3 className="mb-2 font-semibold">{t('admstudio.leakNew')}</h3>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.colLeak')}
          <input
            className="input"
            maxLength={60}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.colSlug')}
          <input
            className="input font-mono"
            maxLength={40}
            value={effectiveSlug}
            onChange={(e) => {
              setTouchedSlug(true);
              setSlug(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.colColour')}
          <input
            className="input h-9 p-1"
            type="color"
            value={colour}
            onChange={(e) => setColour(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('admstudio.colHint')}
          <input
            className="input"
            maxLength={200}
            placeholder={t('admstudio.leakHintPlaceholder')}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </label>
      </div>

      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        {duplicate ? t('admstudio.leakSlugTaken') : t('admstudio.leakSlugHint')}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid || busy}
          onClick={submit}
        >
          {t('admstudio.leakCreate')}
        </button>
        {label.trim() && (
          <span
            className="chip-tag"
            style={{ color: colour, borderColor: colour }}
            aria-hidden="true"
          >
            {label.trim()}
          </span>
        )}
      </div>
    </section>
  );
}
