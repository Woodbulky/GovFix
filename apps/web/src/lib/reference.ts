import { useQuery } from '@tanstack/react-query';
import { must } from './queries';
import { supabase } from './supabase';

type Named = { name_en: string; name_hi: string; name_mr: string };

/** Localised name of a reference row (categories, departments, wards, landmarks). */
export const nameOf = (row: Named | null | undefined, lang: string) =>
  row ? (row[`name_${lang}` as keyof Named] ?? row.name_en) : '';

// Reference tables change only through migrations or the SLA editor, so cache them for the session.
const useRefTable = <T>(key: string, fn: () => Promise<T>) =>
  useQuery({ queryKey: ['ref', key], queryFn: fn, staleTime: Infinity });

/** "other" last: the Grievance Cell routes it by hand. */
export const useCategories = () =>
  useRefTable('categories', async () =>
    must(await supabase.from('categories').select('*').order('code')).sort(
      (a, b) => Number(a.code === 'other') - Number(b.code === 'other'),
    ),
  );
export const useDepartments = () =>
  useRefTable('departments', async () => must(await supabase.from('departments').select('*').order('code')));
export const useWards = () =>
  useRefTable('wards', async () => must(await supabase.from('wards').select('*').order('id')));
export const useLandmarks = () =>
  useRefTable('landmarks', async () => must(await supabase.from('landmarks').select('*').order('name_en')));

/** Current resolution hours per category: the newest version in sla_policies. */
export const useSlaHours = () =>
  useQuery({
    queryKey: ['ref', 'sla_hours'],
    queryFn: async () => {
      const rows = must(
        await supabase
          .from('sla_policies')
          .select('category_code, resolution_hours, effective_from')
          .order('effective_from', { ascending: false }),
      );
      const hours: Record<string, number> = {};
      for (const r of rows) hours[r.category_code] ??= r.resolution_hours;
      return hours;
    },
    staleTime: 60_000,
  });
