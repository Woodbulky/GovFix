import { useQueryClient } from '@tanstack/react-query';
import { Fragment, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProviderBadge } from '@/components/ProviderBadge';
import { toast } from '@/components/Toaster';
import { primary, secondary } from '@/features/request-detail/ActionForm';
import { type Suggestion, useStaffAct } from '@/features/request-detail/hooks';
import { aiPost } from '@/lib/ai';
import type { Json } from '@/lib/database.types';
import { nameOf, useCategories } from '@/lib/reference';
import { rpc } from '@/lib/rpc';

type Payload = Record<string, unknown>;
type Span = { field: string; start: number; end: number; text: string };
export const payloadOf = (s: Suggestion) => (s.payload ?? {}) as Payload;

/** Marks a suggestion accepted / edited / dismissed. Changes nothing on the request (golden rule 3). */
export function useDecide() {
  const { t } = useTranslation();
  const { run, busy } = useStaffAct();
  const decide = (s: Suggestion, decision: 'accepted' | 'edited' | 'dismissed', edited?: Json) =>
    s.status !== 'pending'
      ? Promise.resolve(true)
      : run(
          () => rpc('decide_suggestion', { p_id: s.id, p_decision: decision, p_edited_payload: edited }),
          t('staff.aiAct.decided', { decision: t(`staff.suggStatus.${decision}`) }),
        );
  return { decide, busy };
}

/** The complaint text with the AI's extracted phrases highlighted (offsets come from the AI service). */
export function Highlighted({ text, lang, suggestions }: { text: string; lang: string; suggestions: Suggestion[] }) {
  const { t } = useTranslation();
  const ex = suggestions.find((s) => s.type === 'extraction' && s.status !== 'dismissed');
  // Keep only spans that still match the text, in order and non-overlapping.
  const spans = ((ex && (payloadOf(ex).spans as Span[])) ?? [])
    .filter((s) => text.slice(s.start, s.end) === s.text)
    .filter((s, i, all) => i === 0 || s.start >= all[i - 1].end);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    parts.push(text.slice(at, s.start));
    parts.push(
      <mark key={s.start} className="rounded bg-[color-mix(in_srgb,var(--marigold)_35%,transparent)] px-0.5 text-ink">
        {s.text}
        <span className="sr-only"> ({t(`staff.span.${s.field}`)})</span>
      </mark>,
    );
    at = s.end;
  }
  parts.push(text.slice(at));
  return (
    <div className="space-y-1">
      <p className="whitespace-pre-line" lang={lang}>
        {parts.map((p, i) => (
          <Fragment key={i}>{p}</Fragment>
        ))}
      </p>
      {ex && spans.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {t('staff.aiAct.extracted')} {spans.map((s) => t(`staff.span.${s.field}`)).join(' · ')}
          <ProviderBadge provider={ex.provider} />
        </p>
      )}
    </div>
  );
}

function label(s: Suggestion, catName: (c: unknown) => string) {
  const p = payloadOf(s);
  if (s.type === 'category' || s.type === 'photo_category') return catName(p.category_code);
  if (s.type === 'duplicate') return String(p.ticket_no ?? '');
  if (s.type === 'extraction') return String(p.problem_summary_en ?? '');
  return String(p.text ?? '');
}

/** Request-detail panel: every suggestion with confidence, provider and Accept / Edit / Dismiss. */
export function AiPanel({ requestId, suggestions }: { requestId: string; suggestions: Suggestion[] }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: cats } = useCategories();
  const { decide, busy } = useDecide();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [asking, setAsking] = useState(false);
  const catName = (code: unknown) =>
    nameOf(
      cats?.find((c) => c.code === code),
      i18n.language,
    ) || String(code);

  const ask = async () => {
    setAsking(true);
    const res = await aiPost('/suggest', { request_id: requestId }, 30_000);
    setAsking(false);
    if (!res) toast(t('staff.aiAct.unavailable'), 'refused');
    await qc.invalidateQueries({ queryKey: ['request', requestId] });
  };
  const edit = (s: Suggestion) => {
    setEditing(s.id);
    setValue(String(payloadOf(s)[s.type === 'draft_reply' ? 'text' : 'category_code'] ?? ''));
  };
  const save = async (s: Suggestion) => {
    const key = s.type === 'draft_reply' ? 'text' : 'category_code';
    if (await decide(s, 'edited', { [key]: value })) setEditing(null);
  };

  return (
    <section className="space-y-4 card p-4" aria-labelledby="ai-h">
      <h2 id="ai-h" className="text-lg">
        {t('staff.ai')}
      </h2>
      {!suggestions.length && (
        <div className="space-y-2">
          <p className="text-ink-muted">{t('staff.noSuggestion')}</p>
          <button onClick={() => void ask()} disabled={asking} className={secondary}>
            {t(asking ? 'staff.aiAct.asking' : 'staff.aiAct.get')}
          </button>
        </div>
      )}
      <ul className="space-y-3">
        {suggestions.map((s) => {
          const p = payloadOf(s);
          const editable = s.type === 'category' || s.type === 'photo_category' || s.type === 'draft_reply';
          return (
            <li key={s.id} className="space-y-1 border-b border-line pb-3 text-sm last:border-0">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(`staff.sugg.${s.type}`, { defaultValue: s.type })}</span>
                <span>{label(s, catName)}</span>
                {s.confidence != null && <span className="tabular">{Number(s.confidence).toFixed(2)}</span>}
                <ProviderBadge provider={s.provider} />
                <span className="text-ink-muted">{t(`staff.suggStatus.${s.status}`)}</span>
              </p>
              {typeof p.rationale === 'string' && <p className="text-ink-muted">{p.rationale}</p>}
              {typeof p.visible_issue === 'string' && <p className="text-ink-muted">{p.visible_issue}</p>}
              {editing === s.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(s);
                  }}
                >
                  {s.type === 'draft_reply' ? (
                    <textarea
                      aria-label={t('staff.aiAct.edit')}
                      rows={3}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="block w-full rounded-md border border-line bg-surface p-2"
                    />
                  ) : (
                    <select
                      aria-label={t('staff.sugg.category')}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="block min-h-11 w-full rounded-md border border-line bg-surface px-2"
                    >
                      {cats?.map((c) => (
                        <option key={c.code} value={c.code}>
                          {catName(c.code)}
                        </option>
                      ))}
                    </select>
                  )}
                  <button disabled={busy} className={primary}>
                    {t('staff.aiAct.save')}
                  </button>
                </form>
              ) : (
                s.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => void decide(s, 'accepted')} className={secondary}>
                      {t('staff.aiAct.accept')}
                    </button>
                    {editable && (
                      <button onClick={() => edit(s)} className={secondary}>
                        {t('staff.aiAct.edit')}
                      </button>
                    )}
                    <button disabled={busy} onClick={() => void decide(s, 'dismissed')} className={secondary}>
                      {t('staff.aiAct.dismiss')}
                    </button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Draft with AI" for a citizen update: the draft lands in ai_suggestions and in the textarea, never sent by itself. */
export function DraftButton({
  requestId,
  onDraft,
}: {
  requestId: string;
  onDraft: (text: string, id: string) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={secondary}
      onClick={async () => {
        setBusy(true);
        const res = await aiPost<{ ok: boolean; text?: string; suggestion_id?: string; message?: string }>(
          '/draft-reply',
          { request_id: requestId, event: 'update' },
          15_000,
        );
        setBusy(false);
        if (res?.ok && res.text && res.suggestion_id) {
          onDraft(res.text, res.suggestion_id);
          await qc.invalidateQueries({ queryKey: ['request', requestId] });
        } else toast(res?.message ?? t('staff.aiAct.unavailable'), 'refused');
      }}
    >
      {t(busy ? 'staff.aiAct.drafting' : 'staff.aiAct.draft')}
    </button>
  );
}
