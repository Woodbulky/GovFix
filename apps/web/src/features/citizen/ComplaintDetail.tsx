import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { EscalationBadge } from '@/components/EscalationBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { Stepper } from '@/components/Stepper';
import { toast, useRefusalToast } from '@/components/Toaster';
import { Timeline } from '@/features/public/Timeline';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { type State, transition } from '@/lib/rpc';
import { cn } from '@/lib/utils';
import { useRequestTitle } from './ComplaintCard';
import { type MyRequest, useMyRequest, usePhotoUrls } from './hooks';

const btn = 'inline-flex min-h-12 items-center justify-center rounded-md px-5 font-semibold disabled:opacity-60';
const area = 'mt-1 block w-full rounded-md border border-line bg-surface p-3';

export function ComplaintDetail() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isPending } = useMyRequest(id);
  if (isPending) return null;
  if (!data?.request) return <p>{t('detail.notFound')}</p>;
  return <Detail r={data.request} timeline={data.timeline} messages={data.messages} />;
}

type DetailData = NonNullable<ReturnType<typeof useMyRequest>['data']>;

function Detail({ r, timeline, messages }: { r: MyRequest } & Omit<DetailData, 'request'>) {
  const { t } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  const { data: photos } = usePhotoUrls(r.photos);
  const question = [...messages].reverse().find((m) => m.kind === 'info_question');

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <p className="tabular text-ink-muted">{r.ticket_no}</p>
        <h1 className="text-3xl">{title}</h1>
        <p className="text-ink-muted">{place}</p>
        <div className="flex flex-wrap gap-2">
          <StatusChip state={r.state} />
          <SlaBadge status={r.sla_status_of} dueAt={r.resolution_due_at} audience="citizen" />
          <EscalationBadge level={r.escalation_level} />
        </div>
      </header>

      <Stepper state={r.state} />

      {r.state === 'NEEDS_INFO' && <ReplyForm r={r} question={question?.body} />}
      {r.state === 'RESOLVED' && <ConfirmForm r={r} />}

      <section className="space-y-2">
        <h2 className="text-xl">{t('detail.yourReport')}</h2>
        <p className="whitespace-pre-line card p-4">{r.description}</p>
      </section>

      {!!photos?.length && (
        <section className="space-y-2">
          <h2 className="text-xl">{t('detail.photos')}</h2>
          <ul className="flex flex-wrap gap-3">
            {photos.map((p, i) => (
              <li key={p.storage_path}>
                <figure>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      <img
                        src={p.url}
                        alt={t(p.kind === 'proof' ? 'detail.proofPhoto' : 'detail.yourPhoto', { n: i + 1 })}
                        className="h-36 w-36 rounded-md object-cover"
                      />
                    </a>
                  )}
                  <figcaption className="text-sm text-ink-muted">
                    {t(p.kind === 'proof' ? 'detail.proofCaption' : 'detail.yourCaption')}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline && (
        <section className="space-y-2">
          <h2 className="text-xl">{t('detail.history')}</h2>
          <Timeline data={timeline} messages={messages} />
        </section>
      )}
    </article>
  );
}

/** Runs a citizen action through transition_request and reports the outcome in the user's language. */
function useAct(r: MyRequest) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const refused = useRefusalToast();
  const [busy, setBusy] = useState(false);
  const act = async (action: string, payload: Record<string, string>, okKey: string) => {
    setBusy(true);
    try {
      const res = await transition(r.id, action, r.state as State, payload);
      if (res.ok) toast(t(okKey));
      else refused(res);
      await qc.invalidateQueries({ queryKey: ['my_request', r.id] });
      return res.ok;
    } catch {
      toast(t('errors.network'), 'refused');
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { act, busy };
}

function ReplyForm({ r, question }: { r: MyRequest; question?: string }) {
  const { t } = useTranslation();
  const { act, busy } = useAct(r);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void act('provide_info', { reply: String(new FormData(e.currentTarget).get('reply')) }, 'detail.replySent');
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border-2 border-st-info bg-st-info-bg p-4">
      <h2 className="text-lg">{t('detail.needsInfo')}</h2>
      {question && <p className="whitespace-pre-line">{question}</p>}
      <label className="block">
        <span className="font-medium">{t('detail.yourReply')}</span>
        <textarea name="reply" rows={3} maxLength={2000} className={area} />
      </label>
      <button disabled={busy} className={cn(btn, 'bg-nmc text-white')}>
        {t('detail.sendReply')}
      </button>
    </form>
  );
}

function ConfirmForm({ r }: { r: MyRequest }) {
  const { t } = useTranslation();
  const { act, busy } = useAct(r);
  const [reopening, setReopening] = useState(false);
  const reopen = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void act('reopen', { reason: String(new FormData(e.currentTarget).get('reason')) }, 'detail.reopened');
  };
  return (
    <section className="space-y-3 rounded-lg border-2 border-st-resolved bg-st-resolved-bg p-4">
      <h2 className="text-lg">{t('detail.isItFixed')}</h2>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          onClick={() => void act('confirm', {}, 'detail.confirmed')}
          className={cn(btn, 'bg-nmc text-white')}
        >
          {t('detail.yesFixed')}
        </button>
        <button
          disabled={busy}
          aria-expanded={reopening}
          onClick={() => setReopening(!reopening)}
          className={cn(btn, 'border border-nmc bg-surface text-nmc')}
        >
          {t('detail.stillProblem')}
        </button>
      </div>
      {reopening && (
        <form onSubmit={reopen} className="space-y-3">
          <label className="block">
            <span className="font-medium">{t('detail.whatsWrong')}</span>
            <textarea name="reason" rows={3} maxLength={2000} className={area} />
          </label>
          <button disabled={busy} className={cn(btn, 'bg-nmc text-white')}>
            {t('detail.reopen')}
          </button>
        </form>
      )}
    </section>
  );
}
