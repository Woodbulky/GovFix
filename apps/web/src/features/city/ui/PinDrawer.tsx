// Side drawer for the selected pin. Anonymous pins show category, status, ward and age only; the owner and
// staff get the request: photos, stepper, SLA and (staff) the actions their role may take.
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CategoryIcon } from '@/components/CategoryIcon';
import { duration, SlaBadge } from '@/components/SlaBadge';
import { EscalationBadge } from '@/components/EscalationBadge';
import { StatusChip } from '@/components/StatusChip';
import { Stepper } from '@/components/Stepper';
import { useAuth } from '@/features/auth/store';
import { useMyRequest, usePhotoUrls } from '@/features/citizen/hooks';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { useRequest } from '@/features/request-detail/hooks';
import { Work } from '@/features/request-detail/RequestDetail';
import type { State } from '@/lib/rpc';
import type { Marker, MarkerPhoto } from '../markers/data';
import { useMarkerText } from '../markers/PinLayer';

const link = 'inline-flex min-h-[var(--touch)] items-center rounded-md bg-nmc px-4 font-semibold text-white';

export function PinDrawer({ marker, onClose }: { marker: Marker; onClose: () => void }) {
  const { t } = useTranslation();
  const role = useAuth((s) => s.profile?.role);
  const text = useMarkerText()(marker);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => heading.current?.focus(), [marker.key]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <aside
      aria-labelledby="pin-drawer-h"
      className="absolute bottom-4 right-4 top-20 z-40 flex w-[min(420px,calc(100%-2rem))] flex-col overflow-hidden rounded-lg bg-surface shadow-xl"
    >
      <header className="flex items-start gap-3 border-b border-line p-4">
        <CategoryIcon name={text.icon} size={28} className="mt-1 shrink-0 text-nmc" />
        <div className="min-w-0 flex-1">
          <h2 id="pin-drawer-h" ref={heading} tabIndex={-1} className="text-xl">
            {text.name}
          </h2>
          <p className="tabular text-sm text-ink-muted">
            {[
              marker.ticket,
              t('city.wardN', { n: marker.ward_id }),
              t('city.pin.age', { dur: duration(t, marker.ageHours * 3_600_000) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-m-2 inline-flex min-h-[var(--touch)] min-w-[var(--touch)] items-center justify-center"
        >
          <X aria-hidden size={20} />
          <span className="sr-only">{t('close')}</span>
        </button>
      </header>
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {!marker.id ? (
          <PublicSummary m={marker} />
        ) : role === 'citizen' ? (
          <CitizenSummary m={marker} />
        ) : (
          <StaffSummary m={marker} />
        )}
      </div>
    </aside>
  );
}

function Badges({ m, audience }: { m: Marker; audience: 'citizen' | 'staff' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip state={m.state as State} />
      <SlaBadge status={m.sla} dueAt={m.dueAt} audience={audience} />
      <EscalationBadge level={m.level} />
    </div>
  );
}

function PublicSummary({ m }: { m: Marker }) {
  const { t } = useTranslation();
  return (
    <>
      <Badges m={m} audience="staff" />
      <Stepper state={m.state as State} />
      <p className="text-sm text-ink-muted">{t('city.pin.private')}</p>
    </>
  );
}

function CitizenSummary({ m }: { m: Marker }) {
  const { t } = useTranslation();
  const { data } = useMyRequest(m.id!);
  const r = data?.request;
  const place = usePlaceLabel({ ward_id: r?.ward_id ?? m.ward_id, landmark_id: r?.landmark_id ?? null });
  return (
    <>
      <p className="text-ink-muted">{place}</p>
      <Badges m={m} audience="citizen" />
      <Photos photos={m.photos} ticket={m.ticket} />
      <Stepper state={m.state as State} />
      {r?.description && (
        <p className="whitespace-pre-line" lang={r.language}>
          {r.description}
        </p>
      )}
      <Link to={`/me/complaints/${m.id}`} className={link}>
        {t('city.pin.openMine')}
      </Link>
    </>
  );
}

function StaffSummary({ m }: { m: Marker }) {
  const { t } = useTranslation();
  const { data } = useRequest(m.id!);
  const r = data?.request;
  const place = usePlaceLabel({ ward_id: r?.ward_id ?? m.ward_id, landmark_id: r?.landmark_id ?? null });
  return (
    <>
      <p className="text-ink-muted">{place}</p>
      <Photos photos={m.photos} ticket={m.ticket} />
      {r?.description && (
        <p className="line-clamp-4 whitespace-pre-line" lang={r.language}>
          {r.description}
        </p>
      )}
      {r && data && <Work r={r} messages={data.messages} />}
      <Link to={`/requests/${m.id}`} className={link}>
        {t('city.pin.openRequest')}
      </Link>
    </>
  );
}

/** Report and proof photos, one at a time. Signed URLs, so only viewers RLS allows ever get one. */
function Photos({ photos, ticket }: { photos: MarkerPhoto[]; ticket: string | null }) {
  const { t } = useTranslation();
  const { data } = usePhotoUrls(photos.length ? photos : undefined);
  const [i, setI] = useState(0);
  const shots = (data ?? []).filter((p) => p.url);
  if (!shots.length) return null;
  const n = Math.min(i, shots.length - 1);
  const p = shots[n];
  const nav =
    'inline-flex min-h-[var(--touch)] min-w-[var(--touch)] items-center justify-center rounded-md bg-surface shadow';
  return (
    <figure className="relative">
      <img
        src={p.url!}
        alt={t(p.kind === 'proof' ? 'city.proofOf' : 'city.photoOf', { ticket })}
        className="aspect-[4/3] w-full rounded-md object-cover"
      />
      <figcaption className="mt-1 text-sm text-ink-muted">
        {t(p.kind === 'proof' ? 'city.pin.proofPhoto' : 'city.pin.reportPhoto')} · {n + 1}/{shots.length}
      </figcaption>
      {shots.length > 1 && (
        <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
          <button type="button" className={nav} onClick={() => setI((n - 1 + shots.length) % shots.length)}>
            <ChevronLeft aria-hidden />
            <span className="sr-only">{t('city.prevPhoto')}</span>
          </button>
          <button type="button" className={nav} onClick={() => setI((n + 1) % shots.length)}>
            <ChevronRight aria-hidden />
            <span className="sr-only">{t('city.nextPhoto')}</span>
          </button>
        </div>
      )}
    </figure>
  );
}
