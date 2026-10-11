import { Camera, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EscalationBadge } from '@/components/EscalationBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { nameOf, useCategories } from '@/lib/reference';
import { fmtWhen } from '@/lib/time';
import { speak } from '@/lib/voice';
import { type MyRequest, usePhotoUrls } from './hooks';

export function useRequestTitle(r: Pick<MyRequest, 'category_code' | 'category_hint' | 'description'>) {
  const { i18n } = useTranslation();
  const cat = useCategories().data?.find((c) => c.code === (r.category_code ?? r.category_hint));
  return cat ? nameOf(cat, i18n.language) : r.description.slice(0, 60);
}

export function ComplaintCard({ r }: { r: MyRequest }) {
  const { t, i18n } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  const first = r.photos.filter((p) => p.kind === 'report').slice(0, 1);
  const { data: thumb } = usePhotoUrls(first);
  const url = thumb?.[0]?.url;

  return (
    <article className="flex gap-3 card p-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera aria-hidden className="text-ink-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link to={`/me/complaints/${r.id}`} className="font-semibold text-nmc underline-offset-2 hover:underline">
            {title}
          </Link>
          <span className="tabular text-sm text-ink-muted">{r.ticket_no}</span>
        </div>
        <p className="text-sm text-ink-muted">{place}</p>
        <div className="flex flex-wrap gap-2">
          <StatusChip state={r.state} />
          <SlaBadge status={r.sla_status_of} dueAt={r.resolution_due_at} audience="citizen" />
          <EscalationBadge level={r.escalation_level} />
        </div>
        <p className="text-sm text-ink-muted">
          {r.officer?.full_name && <>{t('card.officer', { name: r.officer.full_name })} · </>}
          {t('card.updated', { when: fmtWhen(r.updated_at, i18n.language) })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => speak(`${title}. ${t(`state.${r.state}`)}. ${place}`, i18n.language)}
        aria-label={t('card.listen', { ticket: r.ticket_no })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
      >
        <Volume2 aria-hidden size={20} />
      </button>
    </article>
  );
}
