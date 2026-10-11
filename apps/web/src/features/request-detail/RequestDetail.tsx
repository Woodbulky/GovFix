import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { EscalationBadge } from '@/components/EscalationBadge';
import { ProviderBadge } from '@/components/ProviderBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { Stepper } from '@/components/Stepper';
import { useAuth } from '@/features/auth/store';
import { CityMap2D } from '@/features/city/CityMap2D';
import { useRequestTitle } from '@/features/citizen/ComplaintCard';
import { usePhotoUrls } from '@/features/citizen/hooks';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { rpc } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { ActionForm, primary, secondary } from './ActionForm';
import { type RequestBundle, type StaffRequest, useRequest, useStaffAct, useStaffDirectory } from './hooks';
import { useAllowedActions } from './useAllowedActions';

const panel = 'space-y-4 rounded-lg border border-line bg-surface p-4';

export function RequestDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isPending } = useRequest(id);
  if (isPending) return null;
  if (!data?.request) return <p>{t('staff.notFound')}</p>;
  const r = data.request;
  return (
    <div className="grid gap-4 xl:grid-cols-[32fr_36fr_32fr]">
      <Complaint r={r} />
      <Work r={r} messages={data.messages} />
      <div className="space-y-4">
        <AiPanel suggestions={data.suggestions} />
        <AuditTimeline audit={data.audit} />
      </div>
    </div>
  );
}

function Complaint({ r }: { r: StaffRequest }) {
  const { t } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  const { data: photos } = usePhotoUrls(r.photos);
  return (
    <section className={panel} aria-labelledby="complaint-h">
      <header>
        <p className="tabular text-ink-muted">
          {r.ticket_no} · {t(`staff.channel.${r.channel}`, { defaultValue: r.channel })} · {r.language}
        </p>
        <h1 id="complaint-h" className="text-2xl">
          {title}
        </h1>
        <p className="text-ink-muted">{place}</p>
      </header>
      <p className="whitespace-pre-line" lang={r.language}>
        {r.description}
      </p>
      {r.transcript && (
        <details>
          <summary className="cursor-pointer font-medium">{t('staff.transcript')}</summary>
          <p className="mt-2 whitespace-pre-line text-sm" lang={r.language}>
            {r.transcript}
          </p>
        </details>
      )}
      {!!photos?.length && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <li key={p.storage_path}>
              {p.url && (
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img
                    src={p.url}
                    alt={t(p.kind === 'proof' ? 'staff.proofN' : 'staff.photoN', { n: i + 1 })}
                    className="h-28 w-28 rounded-md object-cover"
                  />
                </a>
              )}
              <span className="text-sm text-ink-muted">{t(p.kind === 'proof' ? 'staff.proof' : 'staff.report')}</span>
            </li>
          ))}
        </ul>
      )}
      {r.loc_x != null && r.loc_z != null && (
        <CityMap2D pins={[{ x: r.loc_x, z: r.loc_z, label: place }]} className="w-full rounded-md border border-line" />
      )}
    </section>
  );
}

/** Status, stepper, SLA clock, role-valid actions and messages. Also the city pin drawer (P8b). */
export function Work({ r, messages }: { r: StaffRequest; messages: RequestBundle['messages'] }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const { act, run, busy } = useStaffAct();
  const actions = useAllowedActions(r);
  const role = useAuth((s) => s.profile?.role);
  const canUpdate = actions.canUpdateCitizen;

  return (
    <section className={panel} aria-labelledby="work-h">
      <h2 id="work-h" className="sr-only">
        {t('staff.work')}
      </h2>
      <div className="flex flex-wrap gap-2">
        <StatusChip state={r.state} />
        <SlaBadge status={r.sla_status_of} dueAt={r.resolution_due_at} />
        <EscalationBadge level={r.escalation_level} triage={!!r.triage_escalated_at && r.state === 'SUBMITTED'} />
      </div>
      <Stepper state={r.state} />
      <SlaClock r={r} />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {actions.list.map((a) =>
            a.requires.length || a.action === 'resolve' ? (
              <button
                key={a.action}
                aria-expanded={open === a.action}
                onClick={() => setOpen(open === a.action ? null : a.action)}
                className={open === a.action ? primary : secondary}
              >
                {t(`staff.action.${a.action}`)}
              </button>
            ) : (
              <button
                key={a.action}
                disabled={busy}
                onClick={() => void act(r, a.action, {}, t(`staff.done.${a.action}`))}
                className={primary}
              >
                {t(`staff.action.${a.action}`)}
              </button>
            ),
          )}
          {canUpdate && (
            <button
              aria-expanded={open === 'update'}
              onClick={() => setOpen(open === 'update' ? null : 'update')}
              className={secondary}
            >
              {t('staff.action.update')}
            </button>
          )}
          {role && (
            <button
              aria-expanded={open === 'note'}
              onClick={() => setOpen(open === 'note' ? null : 'note')}
              className={secondary}
            >
              {t('staff.action.note')}
            </button>
          )}
        </div>
        {!actions.list.length && <p className="text-sm text-ink-muted">{t('staff.noActions')}</p>}
        {actions.list
          .filter((a) => a.action === open)
          .map((a) => (
            <ActionForm key={a.action} r={r} action={a.action} requires={a.requires} onDone={() => setOpen(null)} />
          ))}
        {(open === 'update' || open === 'note') && (
          <MessageForm
            label={t(open === 'update' ? 'staff.field.update' : 'staff.field.note')}
            button={t(`staff.action.${open}`)}
            busy={busy}
            onSend={async (body) => {
              const ok = await run(
                () =>
                  open === 'update'
                    ? rpc('send_citizen_update', { p_request_id: r.id, p_body: body })
                    : rpc('add_staff_note', { p_request_id: r.id, p_body: body }),
                t(`staff.done.${open}`),
              );
              if (ok) setOpen(null);
            }}
          />
        )}
      </div>

      {!!messages.length && (
        <div className="space-y-2">
          <h3 className="text-lg">{t('staff.messages')}</h3>
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className={cn('rounded-md p-2', m.visibility === 'staff' ? 'bg-paper' : 'bg-st-info-bg')}>
                <p className="text-sm text-ink-muted">
                  {t(`staff.msg.${m.kind}`)} · <span className="tabular">{fmtWhen(m.created_at, i18n.language)}</span>
                </p>
                <p className="whitespace-pre-line" lang={m.language ?? undefined}>
                  {m.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function MessageForm(p: {
  label: string;
  button: string;
  busy: boolean;
  onSend: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void p.onSend(body);
      }}
      className="space-y-2"
    >
      <label className="block">
        <span className="font-medium">{p.label}</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full rounded-md border border-line bg-surface p-2"
        />
      </label>
      <button disabled={p.busy} className={primary}>
        {p.button}
      </button>
    </form>
  );
}

/** Elapsed share of the resolution SLA (sla_ratio is computed in SQL, paused time already excluded). */
function SlaClock({ r }: { r: StaffRequest }) {
  const { t, i18n } = useTranslation();
  if (r.state === 'SUBMITTED')
    return <p className="tabular text-sm">{t('staff.triageDue', { when: fmtWhen(r.triage_due_at, i18n.language) })}</p>;
  if (r.sla_ratio == null || !r.resolution_due_at || r.sla_status_of === 'done') return null;
  const pct = Math.round(r.sla_ratio * 100);
  const color =
    r.sla_status_of === 'breached'
      ? 'var(--sla-breach)'
      : r.sla_status_of === 'at_risk'
        ? 'var(--sla-risk)'
        : 'var(--sla-ok)';
  return (
    <div className="space-y-1">
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={t('staff.slaUsed')}
        className="h-3 overflow-hidden rounded-full bg-paper"
      >
        <div className="h-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <p className="tabular text-sm text-ink-muted">
        {t('staff.slaUsedPct', { pct, when: fmtWhen(r.resolution_due_at, i18n.language) })}
        {r.paused_since && ` · ${t('staff.pausedSince', { when: fmtWhen(r.paused_since, i18n.language) })}`}
      </p>
    </div>
  );
}

/** P6 fills ai_suggestions and adds Accept / Edit / Dismiss; until then this lists what's there. */
function AiPanel({ suggestions }: { suggestions: RequestBundle['suggestions'] }) {
  const { t } = useTranslation();
  return (
    <section className={panel} aria-labelledby="ai-h">
      <h2 id="ai-h" className="text-lg">
        {t('staff.ai')}
      </h2>
      {!suggestions.length && <p className="text-ink-muted">{t('staff.noSuggestion')}</p>}
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t(`staff.sugg.${s.type}`, { defaultValue: s.type })}</span>
            <SuggestionText s={s} />
            {s.confidence != null && <span className="tabular">{Number(s.confidence).toFixed(2)}</span>}
            <ProviderBadge provider={s.provider} />
            <span className="text-ink-muted">{t(`staff.suggStatus.${s.status}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SuggestionText({ s }: { s: RequestBundle['suggestions'][number] }) {
  const p = (s.payload ?? {}) as Record<string, unknown>;
  const text = p.category_code ?? p.ticket_no ?? p.duplicate_ticket ?? p.text ?? '';
  return text ? <span>{String(text)}</span> : null;
}

function AuditTimeline({ audit }: { audit: RequestBundle['audit'] }) {
  const { t, i18n } = useTranslation();
  const { data: staff } = useStaffDirectory();
  const who = (id: string | null, role: string) =>
    (id && staff?.find((p) => p.id === id)?.full_name) || t(`role.${role}`, { defaultValue: role });
  return (
    <section className={panel} aria-labelledby="audit-h">
      <h2 id="audit-h" className="text-lg">
        {t('staff.auditTrail')}
      </h2>
      <ol className="space-y-3">
        {audit.map((e) => {
          const refused = e.outcome === 'refused';
          return (
            <li key={e.id} className={cn('border-l-4 pl-3', refused ? 'border-sla-breach' : 'border-line')}>
              <p className="font-medium">
                {refused ? (
                  // A refused attempt didn't happen: name what was tried, not the past-tense outcome.
                  <>
                    <span aria-hidden>⛔ </span>
                    {t('staff.refusedAction', {
                      action: t(`staff.action.${e.action}`, { defaultValue: e.action }),
                    })}
                  </>
                ) : (
                  t(`staff.audit.${e.action}`, { defaultValue: e.action })
                )}
                {e.to_state && e.from_state !== e.to_state && (
                  <span className="text-ink-muted">
                    {' '}
                    · {e.from_state ? `${t(`state.${e.from_state}`)} → ` : ''}
                    {t(`state.${e.to_state}`)}
                  </span>
                )}
              </p>
              <p className="text-sm">
                {who(e.actor_id, e.actor_role)} · {t(`staff.channel.${e.channel}`, { defaultValue: e.channel })} ·{' '}
                <span className="tabular">{fmtWhen(e.sim_ts, i18n.language)}</span> ·{' '}
                <span className="tabular text-ink-muted">#{e.id}</span>
              </p>
              {(e.code || e.reason) && (
                <p className="text-sm text-ink-muted">{[e.code, e.reason].filter(Boolean).join(': ')}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
