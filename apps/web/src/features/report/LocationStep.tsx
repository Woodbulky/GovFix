import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CityMap2D } from '@/features/city/CityMap2D';
import { nameOf, useLandmarks, useWards } from '@/lib/reference';
import { rpc } from '@/lib/rpc';

export type Place = { ward_id: number | null; landmark_id: number | null; x: number | null; z: number | null };
export const NO_PLACE: Place = { ward_id: null, landmark_id: null, x: null, z: null };

type Located =
  | { found: true; ward_id: number; landmark: { id: number; distance_m: number } | null }
  | { found: false; message: string };

const select = 'mt-1 block min-h-[48px] w-full rounded-md border border-line bg-surface px-3';

/** "Near Ghantaghar Chowk, Ward 7 Ghantaghar" in the current language. */
export function usePlaceLabel(place: Pick<Place, 'ward_id' | 'landmark_id'>) {
  const { t, i18n } = useTranslation();
  const ward = useWards().data?.find((w) => w.id === place.ward_id);
  const lm = useLandmarks().data?.find((l) => l.id === place.landmark_id);
  if (!ward) return '';
  const w = t('place.ward', { n: ward.id, name: nameOf(ward, i18n.language) });
  return lm ? t('place.near', { landmark: nameOf(lm, i18n.language), ward: w }) : w;
}

export function LocationStep({ place, onChange }: { place: Place; onChange: (p: Place) => void }) {
  const { t, i18n } = useTranslation();
  const { data: wards } = useWards();
  const { data: landmarks } = useLandmarks();
  const [error, setError] = useState('');
  const label = usePlaceLabel(place);

  const pick = async (x: number, z: number) => {
    const r = (await rpc('locate_point', { p_x: x, p_z: z })) as Located;
    if (!r.found) return setError(t('place.outside'));
    setError('');
    onChange({ ward_id: r.ward_id, landmark_id: r.landmark?.id ?? null, x, z });
  };

  const pickWard = (id: number) => {
    const w = wards?.find((x) => x.id === id);
    onChange(w ? { ward_id: w.id, landmark_id: null, x: w.center_x, z: w.center_z } : NO_PLACE);
  };
  const pickLandmark = (id: number) => {
    const l = landmarks?.find((x) => x.id === id);
    if (l) onChange({ ward_id: l.ward_id, landmark_id: l.id, x: l.x, z: l.z });
    else onChange({ ...place, landmark_id: null });
  };

  return (
    <div className="space-y-4">
      <p>{t('report.mapHint')}</p>
      <CityMap2D
        onPick={(x, z) => void pick(x, z)}
        pins={place.x !== null && place.z !== null ? [{ x: place.x, z: place.z, label }] : []}
        className="aspect-square w-full max-w-[560px] rounded-lg border border-line"
      />
      <p aria-live="polite" className="flex items-center gap-2 font-medium">
        {label && (
          <>
            <MapPin aria-hidden className="text-nmc" size={20} /> {label}
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="text-st-rejected">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="font-medium">{t('report.ward')}</span>
          <select value={place.ward_id ?? ''} onChange={(e) => pickWard(Number(e.target.value))} className={select}>
            <option value="">{t('report.chooseWard')}</option>
            {wards?.map((w) => (
              <option key={w.id} value={w.id}>
                {t('place.ward', { n: w.id, name: nameOf(w, i18n.language) })}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="font-medium">{t('report.landmark')}</span>
          <select
            value={place.landmark_id ?? ''}
            onChange={(e) => pickLandmark(Number(e.target.value))}
            className={select}
          >
            <option value="">{t('report.chooseLandmark')}</option>
            {landmarks
              ?.filter((l) => !place.ward_id || l.ward_id === place.ward_id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {nameOf(l, i18n.language)}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}
