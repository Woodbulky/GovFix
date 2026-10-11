import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { Stepper } from '@/components/Stepper';
import { rpc } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';
import { type PublicTimeline, Timeline } from './Timeline';

const input = 'mt-1 block min-h-[var(--touch)] w-full rounded-md border border-line bg-surface px-3';

export function TrackPage() {
  const { t } = useTranslation();
  const [result, setResult] = useState<PublicTimeline | 'none' | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = (await rpc('track_request', {
      p_ticket_no: String(f.get('ticket')),
      p_phone_last4: String(f.get('last4')),
    })) as PublicTimeline | { found: false };
    setBusy(false);
    setResult(r.found ? r : 'none');
  };

  return (
    <section className="space-y-6">
      <p className="eyebrow">{t('app.org')}</p>
      <h1 className="!mt-2 text-4xl">{t('nav.track')}</h1>
      <form
        onSubmit={(e) => void submit(e)}
        className="card grid gap-4 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end sm:p-6"
      >
        <label>
          <span className="font-medium">{t('track.ticket')}</span>
          <input name="ticket" required placeholder="NMC-2026-000142" autoCapitalize="characters" className={input} />
        </label>
        <label>
          <span className="font-medium">{t('track.last4')}</span>
          <input
            name="last4"
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className={`tabular ${input}`}
          />
        </label>
        <button
          disabled={busy}
          className="min-h-[var(--touch)] rounded-sm bg-nmc px-5 font-bold text-white hover:bg-nmc-600"
        >
          {t('track.submit')}
        </button>
      </form>
      {result === 'none' && <p role="alert">{t('track.none')}</p>}
      {result && result !== 'none' && <TrackResult data={result} />}
    </section>
  );
}

function TrackResult({ data }: { data: PublicTimeline }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';
  return (
    <article className="space-y-4 card p-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="tabular mr-auto text-xl">{data.ticket_no}</h2>
        <StatusChip state={data.state} />
        <SlaBadge status={data.sla_status} dueAt={data.resolution_due_at} audience="citizen" />
      </header>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-muted">{t('track.category')}</dt>
        <dd>{data.category?.[lang] ?? t('report.notSure')}</dd>
        <dt className="text-ink-muted">{t('track.department')}</dt>
        <dd>{data.department?.[lang] ?? t('track.notYet')}</dd>
        <dt className="text-ink-muted">{t('track.officer')}</dt>
        <dd>{data.officer_name ?? t('track.notYet')}</dd>
        <dt className="text-ink-muted">{t('track.deadline')}</dt>
        <dd className="tabular">
          {data.resolution_due_at ? fmtWhen(data.resolution_due_at, i18n.language) : t('sla.untriaged')}
        </dd>
      </dl>
      <Stepper state={data.state} />
      <Timeline data={data} />
    </article>
  );
}
