import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { must } from '@/lib/queries';
import { nameOf, useDepartments } from '@/lib/reference';
import { supabase } from '@/lib/supabase';

const ORDER = ['commissioner', 'manager', 'dept_head', 'officer', 'citizen'];

/** Read-only list of everyone with a profile (all demo users), grouped by role. */
export function Users() {
  const { t, i18n } = useTranslation();
  const { data: depts = [] } = useDepartments();
  const { data = [] } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const [people, wards] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, department_code, preferred_language'),
        supabase.from('officer_wards').select('officer_id, ward_id'),
      ]);
      const w = must(wards);
      return must(people)
        .map((p) => ({ ...p, wards: w.filter((x) => x.officer_id === p.id).map((x) => x.ward_id) }))
        .sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role) || a.full_name.localeCompare(b.full_name));
    },
  });
  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.users')}</h1>
      <div className="overflow-x-auto card">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {['name', 'role', 'department', 'wards', 'language'].map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {t(`admin.users.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="h-10 border-t border-line">
                <td className="px-3">{p.full_name}</td>
                <td className="px-3">{t(`role.${p.role}`)}</td>
                <td className="px-3">
                  {nameOf(
                    depts.find((d) => d.code === p.department_code),
                    i18n.language,
                  ) || '—'}
                </td>
                <td className="tabular px-3">{p.wards.join(', ') || '—'}</td>
                <td className="px-3 uppercase">{p.preferred_language}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
