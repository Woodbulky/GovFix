import { useTranslation } from 'react-i18next';
import { CategoryIcon, TINT } from '@/components/CategoryIcon';
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
          <li key={d.code} className="card p-5">
            <h2 className="font-sans text-lg font-semibold text-ink">{nameOf(d, lang)}</h2>
            <ul className="mt-3 space-y-2">
              {cats
                ?.filter((c) => c.department_code === d.code)
                .map((c) => (
                  <li key={c.code} className="flex items-center gap-2">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm ${TINT[c.icon ?? ''] ?? TINT['circle-help']}`}
                    >
                      <CategoryIcon name={c.icon} size={18} />
                    </span>
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
    <section className="space-y-5">
      <p className="eyebrow">{t('app.org')}</p>
      <h1 className="text-4xl">{t('nav.departments')}</h1>
      <p className="text-ink-muted">{t('departments.intro')}</p>
      <DepartmentList />
    </section>
  );
}
