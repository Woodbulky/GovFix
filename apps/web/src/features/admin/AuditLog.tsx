import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/components/Toaster';
import { FilterChips } from '@/features/triage/AllRequests';
import { primary, secondary } from '@/features/request-detail/ActionForm';
import { refusedToast } from '@/features/request-detail/hooks';
import { must, useDemoMode } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { type Refusal, rpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { panel } from './Overview';

type Verify = { ok: boolean; checked: number; broken_at: number | null };
const input = 'min-h-11 rounded-sm border border-line bg-surface px-3';

/** Every audit row, newest first, filterable by ticket, outcome and action; plus chain verification. */
export function AuditLog() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const demo = useDemoMode();
  const [params, setParams] = useSearchParams();
  const ticket = params.get('ticket') ?? '';
  const focus = Number(params.get('id')) || null;
  const [outcome, setOutcome] = useState('all');
  const [action, setAction] = useState('');
  const [verify, setVerify] = useState<Verify | null>(null);
  const [tamperId, setTamperId] = useState('');
  // Everyone, citizens included (the Commissioner may read all profiles), so refused citizen calls show a name.
  const { data: people } = useQuery({
    queryKey: ['audit_people'],
    staleTime: Infinity,
    queryFn: async () => must(await supabase.from('profiles').select('id, full_name')),
  });

  const key = ['audit', ticket, outcome, action];
  useRealtime('audit_events', key);
  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      // ponytail: newest 500 rows; add paging if a demo ever outgrows that.
      let q = supabase
        .from('audit_events')
        .select(`*, request:requests${ticket ? '!inner' : ''}(ticket_no)`)
        .order('id', { ascending: false })
        .limit(500);
      if (ticket) q = q.ilike('request.ticket_no', `%${ticket.trim()}%`);
      if (outcome !== 'all') q = q.eq('outcome', outcome as 'accepted' | 'refused');
      if (action) q = q.eq('action', action);
      return must(await q);
    },
  });
  const { data: actions = [] } = useQuery({
    queryKey: ['audit_actions'],
    queryFn: async () => [
      ...new Set(must(await supabase.from('audit_events').select('action').limit(2000)).map((r) => r.action)),
    ],
  });

  const who = (id: string | null, role: string) =>
    (id && people?.find((p) => p.id === id)?.full_name) || t(`role.${role}`, { defaultValue: role });

  const runVerify = async () => {
    const res = (await rpc('verify_audit_chain', {})) as unknown as Verify | Refusal;
    if ('code' in res) return refusedToast(res);
    setVerify(res);
  };
  const tamper = async () => {
    const res = (await rpc('tamper_demo', { p_event_id: Number(tamperId) })) as unknown as { ok: true } | Refusal;
    if (!res.ok) return refusedToast(res);
    toast(t('admin.audit.tampered', { id: tamperId }));
    setVerify(null);
    await qc.invalidateQueries({ queryKey: ['audit'] });
  };
  const broken = verify && !verify.ok ? verify.broken_at : null;

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.audit')}</h1>
      <div className={cn(panel, 'flex flex-wrap items-center gap-3')}>
        <button className={primary} onClick={() => void runVerify()}>
          {t('admin.audit.verify')}
        </button>
        {verify && (
          <p role="status" className={cn('font-semibold', verify.ok ? 'text-sla-ok' : 'text-sla-breach')}>
            {verify.ok
              ? `✓ ${t('admin.audit.intact', { count: verify.checked })}`
              : `✗ ${t('admin.audit.broken', { id: verify.broken_at })}`}
          </p>
        )}
        {demo && (
          <span className="ml-auto flex items-center gap-2">
            <label htmlFor="tamper-id" className="text-sm">
              {t('admin.audit.tamperLabel')}
            </label>
            <input
              id="tamper-id"
              inputMode="numeric"
              value={tamperId}
              onChange={(e) => setTamperId(e.target.value.replace(/\D/g, ''))}
              placeholder={rows[0] ? String(rows[0].id) : ''}
              className={cn(input, 'w-24')}
            />
            <button className={secondary} disabled={!tamperId} onClick={() => void tamper()}>
              {t('admin.audit.tamper')}
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm">
          {t('admin.audit.ticket')}
          <input
            value={ticket}
            onChange={(e) => setParams(e.target.value ? { ticket: e.target.value } : {}, { replace: true })}
            placeholder="000142"
            className={input}
          />
        </label>
        <label className="flex flex-col text-sm">
          {t('admin.audit.action')}
          <select value={action} onChange={(e) => setAction(e.target.value)} className={input}>
            <option value="">{t('admin.all')}</option>
            {actions.sort().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <FilterChips
          label={t('admin.audit.outcome')}
          value={outcome}
          onChange={setOutcome}
          options={[
            ['all', t('admin.all')],
            ['accepted', t('admin.audit.accepted')],
            ['refused', t('admin.audit.refused')],
          ]}
        />
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-paper">
            <tr>
              {['id', 'time', 'actor', 'channel', 'ticket', 'action', 'change', 'outcome', 'reason', 'hash'].map(
                (c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                    {t(`admin.audit.col.${c}`)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const refused = e.outcome === 'refused';
              return (
                <tr
                  key={e.id}
                  className={cn(
                    'border-t border-line align-top',
                    e.id === broken && 'outline outline-4 -outline-offset-4 outline-sla-breach',
                    e.id === focus && 'outline outline-4 -outline-offset-4 outline-marigold',
                  )}
                >
                  <td className="tabular px-3 py-2">
                    #{e.id}
                    {e.id === broken && <span className="font-semibold text-sla-breach"> ✗</span>}
                  </td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{fmtWhen(e.sim_ts, i18n.language)}</td>
                  <td className="px-3 py-2">
                    {who(e.actor_id, e.actor_role)}
                    <span className="block text-ink-muted">
                      {t(`role.${e.actor_role}`, { defaultValue: e.actor_role })}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t(`staff.channel.${e.channel}`, { defaultValue: e.channel })}</td>
                  <td className="tabular whitespace-nowrap px-3 py-2">{e.request?.ticket_no ?? '—'}</td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {/* A refused attempt has no to-state: show only where it stood. */}
                    {e.from_state ? t(`state.${e.from_state}`) : '—'}
                    {e.to_state && ` → ${t(`state.${e.to_state}`)}`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {refused ? `⛔ ${t('admin.audit.refused')}` : `✓ ${t('admin.audit.accepted')}`}
                  </td>
                  <td className="px-3 py-2">{[e.code, e.reason].filter(Boolean).join(': ') || '—'}</td>
                  <td className="tabular px-3 py-2 font-mono text-xs">{e.hash.slice(0, 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-4 text-ink-muted">{t('admin.noData')}</p>}
      </div>
    </section>
  );
}
