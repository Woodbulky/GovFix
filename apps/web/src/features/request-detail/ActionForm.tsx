import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { OfficerPicker } from '@/features/department/OfficerPicker';
import { compress } from '@/features/report/PhotoStep';
import { nameOf, useCategories, useDepartments } from '@/lib/reference';
import { rpc } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { refusedToast, type StaffRequest, uploadProof, useStaffAct, useStaffRequests } from './hooks';

export const btn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold disabled:opacity-60';
export const primary = cn(btn, 'bg-nmc text-white');
export const secondary = cn(btn, 'border border-nmc bg-surface text-nmc');
const field = 'mt-1 block w-full rounded-md border border-line bg-surface p-2';
const TEXT = ['reason', 'question', 'resolution_note'];
const REASON_CODES = ['invalid', 'out_of_jurisdiction', 'insufficient_detail'];

type Props = {
  r: StaffRequest;
  action: string;
  /** workflow_transitions.requires for (action, state) */
  requires: string[];
  initial?: Record<string, string>;
  /** Set when the form was pre-filled from an AI suggestion; the audit row references it (golden rule 3). */
  suggestionId?: string;
  onDone?: () => void;
};

/** One form for every staff transition: fields come from the workflow's `requires` list. */
export function ActionForm({ r, action, requires, initial = {}, suggestionId, onDone }: Props) {
  const { t } = useTranslation();
  const uid = useAuth((s) => s.profile?.id);
  const { act, busy } = useStaffAct();
  const [v, setV] = useState<Record<string, string>>(initial);
  const [proof, setProof] = useState<File | null>(null);
  const set = (k: string) => (val: string) => setV((s) => ({ ...s, [k]: val }));
  const fields = [...requires, ...(v.category_code === 'other' ? ['department_code'] : [])];
  const { data: all } = useStaffRequests();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string> = { ...v };
    if (fields.includes('duplicate_of')) {
      // The manager types a ticket number; the engine wants the request id.
      const target = all?.find((q) => q.ticket_no === v.duplicate_of?.trim().toUpperCase());
      payload.duplicate_of = target?.id ?? v.duplicate_of ?? '';
    }
    if (action === 'resolve' && proof && uid) {
      try {
        const res = await uploadProof(r.id, uid, await compress(proof));
        if (!res.ok) return refusedToast(res);
      } catch (err) {
        return toast(String(err), 'refused');
      }
    }
    // The suggestion is referenced only if its pre-filled values were kept.
    const applied = Object.entries(initial).every(([k, val]) => v[k] === val);
    if (await act(r, action, payload, t(`staff.done.${action}`), applied ? suggestionId : undefined)) onDone?.();
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      {fields.map((f) => (
        <Field key={f} name={f} r={r} value={v[f] ?? ''} onChange={set(f)} />
      ))}
      {action === 'resolve' && (
        <label className="block">
          <span className="font-medium">{t('staff.proofPhoto')}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            className={field}
          />
          <span className="text-sm text-ink-muted">{t('staff.proofHint')}</span>
        </label>
      )}
      {action === 'triage' && <DeadlinePreview r={r} category={v.category_code} dept={v.department_code} />}
      <button disabled={busy} className={action === 'reject' ? secondary : primary}>
        {t(`staff.action.${action}`)}
      </button>
    </form>
  );
}

function Field({
  name,
  r,
  value,
  onChange,
}: {
  name: string;
  r: StaffRequest;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: cats } = useCategories();
  const { data: depts } = useDepartments();
  const label = <span className="font-medium">{t(`staff.field.${name}`)}</span>;

  if (name === 'officer_id') return <OfficerPicker r={r} value={value} onChange={onChange} />;
  if (TEXT.includes(name))
    return (
      <label className="block">
        {label}
        <textarea
          rows={3}
          maxLength={2000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      </label>
    );
  const options =
    name === 'category_code'
      ? cats?.map((c) => [c.code, nameOf(c, i18n.language)])
      : name === 'department_code'
        ? depts?.map((d) => [d.code, nameOf(d, i18n.language)])
        : name === 'reason_code'
          ? REASON_CODES.map((c) => [c, t(`staff.reasonCode.${c}`)])
          : null;
  return (
    <label className="block">
      {label}
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(field, 'min-h-11')}>
          <option value="">{t('staff.choose')}</option>
          {options.map(([code, text]) => (
            <option key={code} value={code}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cn(field, 'tabular min-h-11')} />
      )}
    </label>
  );
}

/** "Will go to Water Supply · due Fri 10:40 AM", computed by SQL (preview_deadline). */
function DeadlinePreview({ r, category, dept }: { r: StaffRequest; category?: string; dept?: string }) {
  const { t, i18n } = useTranslation();
  const { data: cats } = useCategories();
  const { data: depts } = useDepartments();
  const deptCode = category === 'other' ? dept : cats?.find((c) => c.code === category)?.department_code;
  const { data: due } = useQuery({
    queryKey: ['preview_deadline', r.id, category],
    enabled: !!category,
    queryFn: () => rpc('preview_deadline', { p_request_id: r.id, p_category_code: category! }),
  });
  if (!category || !deptCode) return null;
  const d = depts?.find((x) => x.code === deptCode);
  return (
    <p className="tabular rounded-md bg-st-triaged-bg p-2 text-st-triaged">
      {t('staff.preview', { dept: nameOf(d, i18n.language), when: due ? fmtWhen(due, i18n.language) : '…' })}
    </p>
  );
}
