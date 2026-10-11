import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/store';
import { useStaffRequests } from '@/features/request-detail/hooks';
import { RequestTable } from '@/features/request-detail/RequestTable';
import type { State } from '@/lib/rpc';
import { FilterChips } from '@/features/triage/AllRequests';

const TABS: Record<string, State> = {
  assigned: 'ASSIGNED',
  progress: 'IN_PROGRESS',
  info: 'NEEDS_INFO',
  citizen: 'RESOLVED',
};

/** Officer's own requests by stage, most urgent deadline first. */
export function MyWork() {
  const { t } = useTranslation();
  const uid = useAuth((s) => s.profile?.id);
  const { data } = useStaffRequests();
  const [tab, setTab] = useState('assigned');
  const mine = data?.filter((r) => r.assigned_officer_id === uid) ?? [];
  const rows = mine
    .filter((r) => r.state === TABS[tab])
    .sort((a, b) => Date.parse(a.resolution_due_at ?? '9999') - Date.parse(b.resolution_due_at ?? '9999'));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.myWork')}</h1>
      <FilterChips
        label={t('staff.filter')}
        options={Object.keys(TABS).map((k) => [
          k,
          `${t(`staff.officerTab.${k}`)} (${mine.filter((r) => r.state === TABS[k]).length})`,
        ])}
        value={tab}
        onChange={setTab}
      />
      <RequestTable rows={rows} />
    </section>
  );
}
