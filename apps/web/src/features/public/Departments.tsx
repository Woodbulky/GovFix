import { useTranslation } from 'react-i18next';
import { CategoryIcon } from '@/components/CategoryIcon';
import { nameOf, useCategories, useDepartments, useSlaHours } from '@/lib/reference';

/** One card per department: what it handles and the SLA hours from sla_policies. */
export function DepartmentList() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: depts } = useDepartments();
  const { data: cats } = useCategories();
  const { data: hours } = useSlaHours();
  const other = cats?.find((c) => !c.department_code);

  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {depts?.map((d) => (
          <li key={d.code} className="rounded-lg border border-line bg-surface p-4">
            <h2 className="text-lg">{nameOf(d, lang)}</h2>
            <ul className="mt-2 space-y-1">
              {cats
                ?.filter((c) => c.department_code === d.code)
                .map((c) => (
                  <li key={c.code} className="flex items-center gap-2">
                    <CategoryIcon name={c.icon} size={18} className="text-nmc" />
                    <span className="flex-1">{nameOf(c, lang)}</span>
                    {hours?.[c.code] && (
                      <span className="tabular text-sm text-ink-muted">
                        {t('departments.hours', { n: hours[c.code] })}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {other && (
        <p className="text-ink-muted">
          {t('departments.other', { name: nameOf(other, lang), n: hours?.[other.code] ?? '' })}
        </p>
      )}
    </div>
  );
}

export function DepartmentsPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.departments')}</h1>
      <p className="text-ink-muted">{t('departments.intro')}</p>
      <DepartmentList />
    </section>
  );
}
