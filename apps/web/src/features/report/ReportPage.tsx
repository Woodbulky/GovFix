import { Volume2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CategoryIcon, TINT } from '@/components/CategoryIcon';
import { toast, useRefusalToast } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { requestSuggestions } from '@/lib/ai';
import { useAppSettings } from '@/lib/queries';
import { nameOf, useCategories } from '@/lib/reference';
import { rpc, type RpcResult } from '@/lib/rpc';
import { cn } from '@/lib/utils';
import { speak } from '@/lib/voice';
import { EMPTY_DRAFT, hasDraft, startNiva, useNiva } from '@/features/niva/store';
import { attachReportPhotos } from './file';
import { LocationStep, type Place, usePlaceLabel } from './LocationStep';
import { PhotoStep } from './PhotoStep';

const STEPS = ['issue', 'location', 'photos', 'review'] as const;
const NOT_SURE = '';
const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 font-semibold';

type Created = RpcResult<{ request: { id: string; ticket_no: string } }>;

export function ReportPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const uid = useAuth((s) => s.profile?.id);
  const { data: cats } = useCategories();
  const refused = useRefusalToast();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(params.get('category') ?? NOT_SURE);
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<Place>(EMPTY_DRAFT.place);
  const [photos, setPhotos] = useState<File[]>([]);

  // Whatever NIVA understood carries over when the call ends or the citizen switches to typing (NIVA.md).
  const nivaOpen = useNiva((s) => s.open);
  useEffect(() => {
    const d = useNiva.getState().draft;
    if (nivaOpen || !hasDraft(d)) return;
    setDescription((x) => x || d.description);
    setCategory((x) => x || d.category_hint);
    setPlace((x) => (x.ward_id ? x : d.place));
    setPhotos((x) => (x.length ? x : d.photos));
  }, [nivaOpen]);

  useEffect(() => {
    if (params.get('mode') !== 'talk') return;
    startNiva();
    setParams({}, { replace: true });
  }, [params, setParams]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; ticket: string } | null>(null);
  const placeLabel = usePlaceLabel(place);

  if (done) return <Success {...done} />;

  const submit = async () => {
    setBusy(true);
    try {
      const res = (await rpc('create_request', {
        p: {
          description,
          ward_id: place.ward_id,
          landmark_id: place.landmark_id,
          loc_x: place.x,
          loc_z: place.z,
          category_hint: category || null,
          language: i18n.language,
        },
      })) as Created;
      if (!res.ok) {
        refused(res);
        // Send the citizen back to the step that needs fixing.
        if (res.code.endsWith('description') || res.code.endsWith('category_hint')) setStep(0);
        else if (/ward_id|landmark_id|location/.test(res.code)) setStep(1);
        return;
      }
      const { id, ticket_no } = res.request;
      const failed = await attachReportPhotos(id, uid, photos);
      if (failed) toast(t('report.photoFailed', { n: failed }), 'refused');
      requestSuggestions(id);
      setDone({ id, ticket: ticket_no });
    } catch {
      toast(t('errors.network'), 'refused');
    } finally {
      setBusy(false);
    }
  };

  const catName = (code: string) => {
    const c = cats?.find((x) => x.code === code);
    return c ? nameOf(c, i18n.language) : t('report.notSure');
  };

  return (
    <section className="card mx-auto max-w-[760px] space-y-6 rounded-[24px_24px_24px_6px] p-5 sm:p-8">
      <p className="eyebrow">{t('app.org')}</p>
      <h1 className="!mt-2 text-4xl">{t('nav.report')}</h1>
      <ol className="flex gap-2" aria-label={t('report.progress')}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex-1 border-t-4 pt-2 text-sm',
              i < step ? 'border-nmc-600' : i === step ? 'border-marigold font-semibold' : 'border-line text-ink-muted',
            )}
          >
            {i + 1}. {t(`report.step.${s}`)}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <fieldset>
            <legend className="font-medium">{t('report.whatKind')}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...(cats ?? []).map((c) => [c.code, c.icon] as const), [NOT_SURE, 'circle-help'] as const].map(
                ([code, icon]) => (
                  <label
                    key={code || 'not-sure'}
                    className={cn(
                      'flex min-h-[56px] cursor-pointer items-center gap-3 rounded-md border bg-surface p-3 transition focus-within:outline focus-within:outline-2 hover:border-nmc-600',
                      category === code ? 'border-nmc bg-mint/40 ring-2 ring-nmc' : 'border-line',
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={code}
                      checked={category === code}
                      onChange={() => setCategory(code)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-md',
                        TINT[icon ?? ''] ?? TINT['circle-help'],
                      )}
                    >
                      <CategoryIcon name={icon} size={22} />
                    </span>
                    {catName(code)}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <label className="block">
            <span className="font-medium">{t('report.describe')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={t('report.describeHint')}
              className="mt-1 block w-full rounded-md border border-line bg-surface p-3"
            />
          </label>
        </div>
      )}
      {step === 1 && <LocationStep place={place} onChange={setPlace} />}
      {step === 2 && <PhotoStep photos={photos} onChange={setPhotos} />}
      {step === 3 && (
        <dl className="space-y-3 card p-4">
          <Row label={t('report.step.issue')} onEdit={() => setStep(0)}>
            <strong>{catName(category)}</strong>
            <p className="whitespace-pre-line">{description || '—'}</p>
          </Row>
          <Row label={t('report.step.location')} onEdit={() => setStep(1)}>
            {placeLabel || '—'}
          </Row>
          <Row label={t('report.step.photos')} onEdit={() => setStep(2)}>
            {t('report.photoCount', { count: photos.length })}
          </Row>
        </dl>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className={cn(btn, 'border border-line bg-surface', step === 0 && 'invisible')}
        >
          {t('report.back')}
        </button>
        {step < 3 ? (
          <button type="button" onClick={() => setStep(step + 1)} className={cn(btn, 'bg-nmc text-white')}>
            {t('report.next')}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className={cn(btn, 'bg-nmc text-white disabled:opacity-60')}
          >
            {busy ? t('report.submitting') : t('report.submit')}
          </button>
        )}
      </div>
    </section>
  );
}

function Row({ label, onEdit, children }: { label: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <div className="flex-1">
        <dt className="text-sm text-ink-muted">{label}</dt>
        <dd>{children}</dd>
      </div>
      <button type="button" onClick={onEdit} className="min-h-11 px-2 font-medium text-nmc underline">
        {t('report.edit')}
      </button>
    </div>
  );
}

function Success({ id, ticket }: { id: string; ticket: string }) {
  const { t, i18n } = useTranslation();
  const hours = useAppSettings().data?.triage_hours ?? 4;
  const message = t('report.successBody', { n: hours });
  return (
    <section className="mx-auto max-w-[640px] space-y-5 card p-6 text-center">
      <p className="text-ink-muted">{t('report.successTitle')}</p>
      <p className="tabular font-heading text-5xl text-nmc">{ticket}</p>
      <p>{message}</p>
      <button
        type="button"
        onClick={() => speak(`${t('report.successTitle')} ${ticket.split('').join(' ')}. ${message}`, i18n.language)}
        className={cn(btn, 'border border-line')}
      >
        <Volume2 aria-hidden size={20} /> {t('listen')}
      </button>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to={`/me/complaints/${id}`} className={cn(btn, 'bg-nmc text-white')}>
          {t('report.trackIt')}
        </Link>
        <Link to="/me/complaints" className={cn(btn, 'border border-line')}>
          {t('nav.myComplaints')}
        </Link>
      </div>
    </section>
  );
}
