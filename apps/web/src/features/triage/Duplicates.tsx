import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ProviderBadge } from '@/components/ProviderBadge';
import { useStaffRequests } from '@/features/request-detail/hooks';
import { must } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import { primary } from '@/features/request-detail/ActionForm';

/** AI-flagged pairs awaiting the Manager's decision (only the Manager can merge). */
export function Duplicates() {
  const { t } = useTranslation();
  const { data: requests } = useStaffRequests();
  useRealtime('requests', ['dupes']);
  const { data } = useQuery({
    queryKey: ['dupes'],
    queryFn: async () =>
      must(
        await supabase
          .from('ai_suggestions')
          .select('id, request_id, payload, confidence, provider')
          .eq('type', 'duplicate')
          .eq('status', 'pending')
          .order('confidence', { ascending: false }),
      ),
  });
  const byId = new Map(requests?.map((r) => [r.id, r]));
  const pairs = (data ?? [])
    .map((s) => {
      const p = s.payload as { candidate_request_id?: string; distance_m?: number };
      return { s, a: byId.get(s.request_id), b: byId.get(p.candidate_request_id ?? ''), dist: p.distance_m };
    })
    .filter((x) => x.a?.state === 'SUBMITTED');

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.duplicates')}</h1>
      {!pairs.length && <p className="text-ink-muted">{t('staff.noDupes')}</p>}
      <ul className="space-y-3">
        {pairs.map(({ s, a, b, dist }) => (
          <li key={s.id} className="space-y-2 card p-3">
            <p className="flex flex-wrap items-center gap-2">
              <span className="tabular font-semibold">
                {a!.ticket_no} ↔ {b?.ticket_no ?? '—'}
              </span>
              <span className="tabular">{Number(s.confidence ?? 0).toFixed(2)}</span>
              {dist != null && <span className="tabular text-sm text-ink-muted">{Math.round(dist)} m</span>}
              <ProviderBadge provider={s.provider} />
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[a!, b].map(
                (q) =>
                  q && (
                    <p key={q.id} className="rounded-md bg-paper p-2 text-sm" lang={q.language}>
                      {q.description}
                    </p>
                  ),
              )}
            </div>
            <Link to={`/triage?open=${a!.id}`} className={primary}>
              {t('staff.openTriage')}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
