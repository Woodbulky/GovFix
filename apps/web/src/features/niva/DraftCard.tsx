// "What NIVA understood": the complaint draft, filling field by field as the agent calls update_draft.
// Also hosts the two moments NIVA waits for the person: the map pick and the photo.
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Modal } from '@/features/request-detail/Modal';
import { LocationStep, type Place, usePlaceLabel } from '@/features/report/LocationStep';
import { PhotoStep } from '@/features/report/PhotoStep';
import { nameOf, useCategories, useLandmarks, useWards } from '@/lib/reference';
import { cn } from '@/lib/utils';
import { patchDraft, useNiva } from './store';

export function DraftCard() {
  const { t, i18n } = useTranslation();
  const { draft, changed, submitted } = useNiva();
  const cat = useCategories().data?.find((c) => c.code === draft.category_hint);
  const place = usePlaceLabel(draft.place);

  if (submitted)
    return (
      <section className="space-y-3 rounded-lg bg-surface p-4 text-ink" aria-live="polite">
        <p className="text-ink-muted">{t('report.successTitle')}</p>
        <p className="tabular font-heading text-3xl font-bold text-nmc">{submitted.ticket}</p>
        <Link
          to={`/me/complaints/${submitted.id}`}
          className="inline-flex min-h-12 items-center font-semibold underline"
        >
          {t('report.trackIt')}
        </Link>
      </section>
    );

  const rows: [string, string, string][] = [
    ['description', t('niva.draft.problem'), draft.description],
    ['category_hint', t('niva.draft.category'), cat ? nameOf(cat, i18n.language) : ''],
    ['place', t('niva.draft.place'), place],
    ['since_text', t('niva.draft.since'), draft.since_text],
    [
      'photos',
      t('niva.draft.photos'),
      draft.photos.length ? t('report.photoCount', { count: draft.photos.length }) : '',
    ],
  ];
  return (
    <section className="space-y-3 rounded-lg bg-surface p-4 text-ink" aria-labelledby="niva-draft">
      <h2 id="niva-draft" className="text-lg">
        {t('niva.draft.title')}
      </h2>
      {draft.risk_to_people && (
        <p role="alert" className="flex items-center gap-2 rounded-md bg-st-rejected/10 p-2 font-semibold">
          <AlertTriangle aria-hidden size={18} /> {t('niva.draft.danger')}
        </p>
      )}
      <dl className="space-y-2">
        {rows.map(([key, label, value]) => (
          <div
            key={key}
            className={cn(
              'rounded-md p-2 motion-safe:transition-colors motion-safe:duration-700',
              changed.includes(key) && 'bg-marigold/25',
            )}
          >
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className={value ? 'whitespace-pre-line' : 'text-ink-muted'}>{value || t('niva.draft.empty')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Opened by request_photo. The file picker needs a tap, so NIVA waits for the person here. */
export function PhotoAsk() {
  const { t } = useTranslation();
  const ask = useNiva((s) => s.photoAsk);
  const photos = useNiva((s) => s.draft.photos);
  if (!ask) return null;
  return (
    <Modal title={t('niva.photoTitle')} onClose={() => ask(useNiva.getState().draft.photos.length)}>
      <PhotoStep photos={photos} onChange={(p) => patchDraft({ photos: p })} />
      <button
        type="button"
        onClick={() => ask(useNiva.getState().draft.photos.length)}
        className="min-h-12 w-full rounded-md bg-nmc px-5 font-semibold text-white"
      >
        {t('niva.done')}
      </button>
    </Modal>
  );
}

/** Opened by open_location_picker: the same 3D/2D picker as the typed form. */
export function PickerAsk() {
  const resolve = useNiva((s) => s.picker);
  return resolve ? <PickerModal resolve={resolve} /> : null;
}

function PickerModal({ resolve }: { resolve: NonNullable<ReturnType<typeof useNiva.getState>['picker']> }) {
  const { t } = useTranslation();
  const wards = useWards().data;
  const landmarks = useLandmarks().data;
  const [place, setPlace] = useState<Place>(() => useNiva.getState().draft.place);
  const confirm = () => {
    const w = wards?.find((x) => x.id === place.ward_id);
    if (!w || place.x === null || place.z === null) return;
    patchDraft({ place });
    resolve({
      ward_id: w.id,
      ward_name: w.name_en,
      nearest_landmark: landmarks?.find((l) => l.id === place.landmark_id)?.name_en ?? null,
      x: place.x,
      z: place.z,
    });
  };
  return (
    <Modal title={t('niva.pickTitle')} onClose={() => resolve(null)}>
      <LocationStep place={place} onChange={setPlace} />
      <button
        type="button"
        disabled={!place.ward_id}
        onClick={confirm}
        className="min-h-12 w-full rounded-md bg-nmc px-5 font-semibold text-white disabled:opacity-60"
      >
        {t('niva.usePlace')}
      </button>
    </Modal>
  );
}
