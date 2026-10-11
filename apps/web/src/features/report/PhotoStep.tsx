import imageCompression from 'browser-image-compression';
import { ImagePlus, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const MAX_PHOTOS = 3;

/** ≤1600 px, ≤1 MB JPEG. Re-encoding through a canvas drops EXIF, GPS included (DATABASE.md). */
export const compress = (file: File) =>
  imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 1,
    fileType: 'image/jpeg',
    preserveExif: false,
    useWebWorker: true,
  });

export function PhotoStep({ photos, onChange }: { photos: File[]; onChange: (p: File[]) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const urls = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const add = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    setBusy(true);
    try {
      onChange([...photos, ...(await Promise.all(files.map(compress)))]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p>{t('report.photoHint', { n: MAX_PHOTOS })}</p>
      <ul className="flex flex-wrap gap-3">
        {urls.map((u, i) => (
          <li key={u} className="relative">
            <img src={u} alt={t('report.photoN', { n: i + 1 })} className="h-32 w-32 rounded-md object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              aria-label={t('report.removePhoto', { n: i + 1 })}
              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-canopy/80 text-white"
            >
              <X aria-hidden size={18} />
            </button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li>
            <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-center text-sm focus-within:outline focus-within:outline-2">
              <ImagePlus aria-hidden className="text-nmc" />
              {busy ? t('report.preparing') : t('report.addPhoto')}
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => void add(e)}
                className="sr-only"
              />
            </label>
          </li>
        )}
      </ul>
      <p className="text-sm text-ink-muted">{t('report.photoPrivacy')}</p>
    </div>
  );
}
