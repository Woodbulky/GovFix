import { useTranslation } from 'react-i18next';
import { type StaffRequest, useStaffDirectory, useStaffRequests } from '@/features/request-detail/hooks';
import { cn } from '@/lib/utils';

const OPEN = ['ASSIGNED', 'IN_PROGRESS', 'NEEDS_INFO'];

type Props = {
  r: Pick<StaffRequest, 'department_code' | 'ward_id' | 'assigned_officer_id'>;
  value: string;
  onChange: (id: string) => void;
};

/**
 * Officers of the request's department with open workload and ward coverage.
 * Greyed reasons mirror the officer_in_department / officer_covers_ward / different_officer guards;
 * the engine still checks them on submit.
 */
export function OfficerPicker({ r, value, onChange }: Props) {
  const { t } = useTranslation();
  const { data: staff } = useStaffDirectory();
  const { data: requests } = useStaffRequests();
  const officers = staff?.filter((p) => p.role === 'officer' && p.department_code === r.department_code) ?? [];
  const load = (id: string) =>
    requests?.filter((q) => q.assigned_officer_id === id && OPEN.includes(q.state)).length ?? 0;

  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{t('staff.pickOfficer')}</legend>
      {!officers.length && <p className="text-ink-muted">{t('staff.noOfficers')}</p>}
      {officers.map((o) => {
        const why =
          o.id === r.assigned_officer_id
            ? t('staff.alreadyAssigned')
            : !o.wards.includes(r.ward_id)
              ? t('staff.notCovering', { ward: r.ward_id })
              : '';
        return (
          <label
            key={o.id}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-md border p-2',
              why ? 'cursor-not-allowed border-line text-ink-muted' : 'cursor-pointer border-line bg-surface',
              value === o.id && 'border-nmc ring-2 ring-nmc',
            )}
          >
            <input
              type="radio"
              name="officer_id"
              value={o.id}
              checked={value === o.id}
              disabled={!!why}
              onChange={() => onChange(o.id)}
            />
            <span className="flex-1">
              <span className="font-medium">{o.full_name}</span>
              <span className="block text-sm">
                {t('staff.wards', { list: o.wards.join(', ') })} ·{' '}
                <span className="tabular">{t('staff.openLoad', { n: load(o.id) })}</span>
              </span>
            </span>
            {why && <span className="text-sm">{why}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
