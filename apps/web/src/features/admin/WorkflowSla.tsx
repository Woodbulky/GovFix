import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { primary } from '@/features/request-detail/ActionForm';
import { useStaffAct, useTransitions } from '@/features/request-detail/hooks';
import { must } from '@/lib/queries';
import { rpc } from '@/lib/rpc';
import { nameOf, useCategories } from '@/lib/reference';
import { supabase } from '@/lib/supabase';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { panel } from './Overview';

/** State diagram drawn by Mermaid from the workflow_transitions rows (lazy-loaded: it's a big library). */
function Diagram({
  edges,
  label,
}: {
  edges: { from_state: string; to_state: string; action: string }[];
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const src = [
    'stateDiagram-v2',
    '  [*] --> SUBMITTED',
    ...edges.filter((e) => e.from_state !== e.to_state).map((e) => `  ${e.from_state} --> ${e.to_state}: ${e.action}`),
  ].join('\n');
  useEffect(() => {
    let live = true;
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      const { svg } = await mermaid.render(`wf${id}`, src);
      if (live && ref.current) ref.current.innerHTML = svg;
    });
    return () => {
      live = false;
    };
  }, [src, id]);
  return <div ref={ref} role="img" aria-label={label} className="overflow-x-auto [&_svg]:mx-auto" />;
}

function SlaEditor() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data: cats = [] } = useCategories();
  const { run, busy } = useStaffAct();
  const [cat, setCat] = useState('');
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const { data: versions = [] } = useQuery({
    queryKey: ['sla_policies'],
    queryFn: async () =>
      must(await supabase.from('sla_policies').select('*').order('effective_from', { ascending: false })),
  });
  const current = (code: string) => versions.find((v) => v.category_code === code);

  const save = async () => {
    const ok = await run(
      () => rpc('update_sla_policy', { p_category_code: cat, p_hours: Number(hours), p_note: note || undefined }),
      t('admin.sla.saved'),
    );
    if (ok) {
      setHours('');
      setNote('');
    }
    await qc.invalidateQueries({ queryKey: ['sla_policies'] });
    await qc.invalidateQueries({ queryKey: ['ref', 'sla_hours'] });
  };

  const field = 'min-h-11 rounded-sm border border-line bg-surface px-3';
  return (
    <section className={panel} aria-labelledby="sla-h">
      <h2 id="sla-h" className="text-lg">
        {t('admin.sla.title')}
      </h2>
      <p className="mb-3 text-sm text-ink-muted">{t('admin.sla.hint')}</p>
      <table className="mb-4 w-full text-left text-sm">
        <thead>
          <tr>
            {['category', 'hours', 'since', 'versions'].map((c) => (
              <th key={c} scope="col" className="py-1 font-semibold">
                {t(`admin.sla.col.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => {
            const v = current(c.code);
            return (
              <tr key={c.code} className="border-t border-line">
                <td className="py-1">{nameOf(c, i18n.language)}</td>
                <td className="tabular py-1">{v?.resolution_hours ?? '—'}</td>
                <td className="tabular py-1">{v ? fmtWhen(v.effective_from, i18n.language) : '—'}</td>
                <td className="tabular py-1">{versions.filter((x) => x.category_code === c.code).length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          {t('admin.sla.col.category')}
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={field}>
            <option value="">{t('admin.pick')}</option>
            {cats.map((c) => (
              <option key={c.code} value={c.code}>
                {nameOf(c, i18n.language)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          {t('admin.sla.newHours')}
          <input
            inputMode="numeric"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))}
            className={cn(field, 'w-28')}
          />
        </label>
        <label className="flex flex-1 flex-col text-sm">
          {t('admin.sla.note')}
          <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </label>
        <button className={primary} disabled={busy || !cat} onClick={() => void save()}>
          {t('admin.sla.save')}
        </button>
      </div>
    </section>
  );
}

/** Commissioner: the workflow as data (diagram + table) and the versioned SLA editor. */
export function WorkflowSla() {
  const { t } = useTranslation();
  const { data: rows = [] } = useTransitions();
  const sorted = [...rows].sort((a, b) => a.from_state.localeCompare(b.from_state) || a.action.localeCompare(b.action));
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : '—');
  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.workflow')}</h1>
      <section className={panel}>{rows.length > 0 && <Diagram edges={rows} label={t('admin.wf.diagram')} />}</section>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper">
            <tr>
              {['action', 'from', 'to', 'roles', 'requires', 'guards'].map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {t(`admin.wf.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={`${r.action}-${r.from_state}`} className="border-t border-line">
                <td className="px-3 py-1 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-1">{t(`state.${r.from_state}`)}</td>
                <td className="px-3 py-1">{t(`state.${r.to_state}`)}</td>
                <td className="px-3 py-1">
                  {r.allowed_roles.map((x) => t(`role.${x}`, { defaultValue: x })).join(', ')}
                </td>
                <td className="px-3 py-1 font-mono text-xs">{list(r.requires)}</td>
                <td className="px-3 py-1 font-mono text-xs">{list(r.guards)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlaEditor />
    </section>
  );
}
