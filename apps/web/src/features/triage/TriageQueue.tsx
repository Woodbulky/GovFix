import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { duration } from '@/components/SlaBadge';
import { ProviderBadge } from '@/components/ProviderBadge';
import { EscalationBadge } from '@/components/EscalationBadge';
import { Highlighted, useDecide } from '@/features/ai/AiPanel';
import { useRequestTitle } from '@/features/citizen/ComplaintCard';
import { usePhotoUrls } from '@/features/citizen/hooks';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { ActionForm, primary, secondary } from '@/features/request-detail/ActionForm';
import {
  type StaffRequest,
  type Suggestion,
  useRequest,
  useStaffRequests,
  useTransitions,
} from '@/features/request-detail/hooks';
import { useSimNow } from '@/lib/queries';
import { nameOf, useCategories } from '@/lib/reference';
import { cn } from '@/lib/utils';

/** Grievance Cell: SUBMITTED requests, oldest first, each with its triage countdown. */
export function TriageQueue() {
  const { t } = useTranslation();
  const { data } = useStaffRequests();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const queue = data?.filter((r) => r.state === 'SUBMITTED') ?? [];
  const open = data?.find((r) => r.id === openId);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">
        {t('nav.triage')} <span className="tabular">({queue.length})</span>
      </h1>
      {!queue.length && <p className="text-ink-muted">{t('staff.queueEmpty')}</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {queue.map((r) => (
          <li key={r.id}>
            <TriageCard r={r} onOpen={() => setParams({ open: r.id })} />
          </li>
        ))}
      </ul>
      {open && <TriageDrawer r={open} onClose={() => setParams({})} />}
    </section>
  );
}

export function TriageCountdown({ dueAt }: { dueAt: string }) {
  const { t } = useTranslation();
  const left = Date.parse(dueAt) - useSimNow().getTime();
  return (
    <span className={cn('tabular text-sm font-medium', left < 0 ? 'text-sla-breach' : 'text-ink')}>
      {left < 0 ? t('staff.triageLate', { dur: duration(t, left) }) : t('staff.triageLeft', { dur: duration(t, left) })}
    </span>
  );
}

function TriageCard({ r, onOpen }: { r: StaffRequest; onOpen: () => void }) {
  const { t } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  const { data: thumb } = usePhotoUrls(r.photos.filter((p) => p.kind === 'report').slice(0, 1));
  return (
    <article className="flex h-full gap-3 card p-3">
      {thumb?.[0]?.url && <img src={thumb[0].url} alt="" className="h-20 w-20 shrink-0 rounded-md object-cover" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{title}</span>
          <span className="tabular text-sm text-ink-muted">{r.ticket_no}</span>
        </p>
        <p className="line-clamp-2" lang={r.language}>
          {r.description}
        </p>
        {r.transcript && (
          <p className="line-clamp-1 text-sm italic text-ink-muted" lang={r.language}>
            {r.transcript}
          </p>
        )}
        <p className="text-sm text-ink-muted">
          {place} · {t(`lang.${r.language}`, { defaultValue: r.language })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <TriageCountdown dueAt={r.triage_due_at} />
          <EscalationBadge level={0} triage={!!r.triage_escalated_at} />
        </div>
        <button onClick={onOpen} className={cn(primary, 'mt-2')}>
          {t('staff.openTriage')}
        </button>
      </div>
    </article>
  );
}

/** Side drawer on a native <dialog>: focus trap, Esc to close and inert background for free. */
function TriageDrawer({ r, onClose }: { r: StaffRequest; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const { data } = useRequest(r.id);
  const { data: all } = useStaffRequests();
  const { data: cats } = useCategories();
  const { data: transitions } = useTransitions();
  const [mode, setMode] = useState<'triage' | 'merge_duplicate' | 'reject'>('triage');
  const [pick, setPick] = useState<{ code: string; id: string } | null>(null);
  const [dupe, setDupe] = useState<Suggestion | null>(null);
  const { decide, busy } = useDecide();
  useEffect(() => ref.current?.showModal(), []);

  const sugg = data?.suggestions ?? [];
  const categories = sugg.filter(
    (s) => (s.type === 'category' || s.type === 'photo_category') && s.status !== 'dismissed',
  );
  const dupes = sugg.filter((s) => s.type === 'duplicate' && s.status !== 'dismissed');
  const payload = (s: Suggestion) => (s.payload ?? {}) as Record<string, string | number | undefined>;
  const candidate = dupe && all?.find((q) => q.id === payload(dupe).candidate_request_id);
  const catName = (code: unknown) =>
    nameOf(
      cats?.find((c) => c.code === code),
      i18n.language,
    ) || String(code);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="drawer-h"
      className="m-0 ml-auto h-full max-h-none w-full max-w-[640px] overflow-y-auto bg-paper p-0 backdrop:bg-canopy/40"
    >
      <div className="space-y-4 p-4">
        <header className="flex items-start gap-2">
          <div className="flex-1">
            <p className="tabular text-ink-muted">{r.ticket_no}</p>
            <h2 id="drawer-h" className="text-xl">
              {t('staff.triageTitle')}
            </h2>
          </div>
          <button onClick={() => ref.current?.close()} aria-label={t('close')} className="p-2">
            <X aria-hidden />
          </button>
        </header>
        <div className="rounded-md bg-surface p-3">
          <Highlighted text={r.description} lang={r.language} suggestions={sugg} />
        </div>

        <section className="space-y-2" aria-label={t('staff.ai')}>
          {!categories.length && !dupes.length && <p className="text-ink-muted">{t('staff.noSuggestion')}</p>}
          {categories.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-2">
              <strong>{catName(payload(s).category_code)}</strong>
              <span className="tabular">{Number(s.confidence ?? 0).toFixed(2)}</span>
              <ProviderBadge provider={s.provider} />
              {payload(s).rationale && <span className="w-full text-sm">{payload(s).rationale}</span>}
              {/* Accept marks the suggestion decided and pre-fills the form; only Confirm changes the request. */}
              <button
                disabled={busy}
                onClick={async () => {
                  if (!(await decide(s, 'accepted'))) return;
                  setMode('triage');
                  setPick({ code: String(payload(s).category_code), id: s.id });
                }}
                className={pick?.id === s.id ? primary : secondary}
              >
                {t('staff.aiAct.accept')}
              </button>
              {s.status === 'pending' && (
                <button disabled={busy} onClick={() => void decide(s, 'dismissed')} className={secondary}>
                  {t('staff.aiAct.dismiss')}
                </button>
              )}
            </div>
          ))}
          {dupes.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-2">
              <span>{t('staff.possibleDupe', { ticket: payload(s).ticket_no })}</span>
              <span className="tabular">{Number(s.confidence ?? payload(s).score ?? 0).toFixed(2)}</span>
              <ProviderBadge provider={s.provider} />
              <button
                aria-expanded={dupe?.id === s.id}
                onClick={() => setDupe(dupe?.id === s.id ? null : s)}
                className={secondary}
              >
                {t('staff.compare')}
              </button>
              {s.status === 'pending' && (
                <button disabled={busy} onClick={() => void decide(s, 'dismissed')} className={secondary}>
                  {t('staff.aiAct.dismiss')}
                </button>
              )}
            </div>
          ))}
          {candidate && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[r, candidate].map((q) => (
                <div key={q.id} className="rounded-md bg-surface p-2 text-sm">
                  <p className="tabular font-semibold">{q.ticket_no}</p>
                  <p lang={q.language}>{q.description}</p>
                  <PlaceLine r={q} />
                </div>
              ))}
            </div>
          )}
        </section>

        <div role="group" aria-label={t('staff.decision')} className="flex flex-wrap gap-2">
          {(['triage', 'merge_duplicate', 'reject'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={mode === m ? primary : secondary}
            >
              {t(`staff.mode.${m}`)}
            </button>
          ))}
        </div>
        <ActionForm
          key={`${mode}-${pick?.id ?? ''}-${candidate?.id ?? ''}`}
          r={r}
          action={mode}
          requires={transitions?.find((x) => x.action === mode && x.from_state === 'SUBMITTED')?.requires ?? []}
          initial={
            mode === 'triage' && pick
              ? { category_code: pick.code }
              : mode === 'merge_duplicate' && candidate
                ? { duplicate_of: candidate.ticket_no }
                : {}
          }
          suggestionId={mode === 'triage' ? pick?.id : mode === 'merge_duplicate' ? dupe?.id : undefined}
          onDone={() => ref.current?.close()}
        />
      </div>
    </dialog>
  );
}

function PlaceLine({ r }: { r: StaffRequest }) {
  return <p className="text-ink-muted">{usePlaceLabel(r)}</p>;
}
