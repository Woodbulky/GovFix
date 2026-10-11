import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DEMO_USERS } from '@/features/auth/DemoSwitcher';
import { primary } from '@/features/request-detail/ActionForm';
import { useStaffRequests, useTransitions } from '@/features/request-detail/hooks';
import type { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { panel } from './Overview';

// One throwaway client per acting user, signed in with their own password: the call carries THEIR JWT,
// so the engine (not this page) decides. No session is persisted and the Commissioner stays signed in.
const clients = new Map<string, Promise<SupabaseClient<Database>>>();
function clientFor(email: string) {
  if (!clients.has(email)) {
    const c = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: `api-console-${email}` },
    });
    clients.set(
      email,
      c.auth.signInWithPassword({ email, password: import.meta.env.VITE_DEMO_PASSWORD ?? '' }).then(({ error }) => {
        if (error) {
          clients.delete(email);
          throw new Error(error.message);
        }
        return c;
      }),
    );
  }
  return clients.get(email)!;
}

const field = 'min-h-11 rounded-sm border border-line bg-surface px-3';

/** Demo mode: send a raw transition_request as any demo user and show exactly what the engine answered. */
export function ApiConsole() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: requests = [] } = useStaffRequests();
  const { data: transitions = [] } = useTransitions();
  const [as, setAs] = useState('');
  const [ticket, setTicket] = useState('');
  const [action, setAction] = useState('');
  const [payload, setPayload] = useState('{}');
  const [out, setOut] = useState<{ status: string; body: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const actions = [...new Set(transitions.map((r) => r.action))].sort();
  const req = requests.find((r) => r.ticket_no === ticket);

  const send = async () => {
    if (!req) return;
    setBusy(true);
    try {
      const body = JSON.parse(
        payload || '{}',
      ) as Database['public']['Functions']['transition_request']['Args']['p_payload'];
      const client = as ? await clientFor(as) : supabase;
      const res = await client.rpc('transition_request', {
        p_request_id: req.id,
        p_action: action,
        p_expected_state: req.state,
        p_payload: body,
        p_channel: 'api',
      });
      setOut(res.error ? { status: `error`, body: res.error } : { status: '200', body: res.data });
    } catch (e) {
      setOut({ status: 'error', body: { message: e instanceof Error ? e.message : String(e) } });
    } finally {
      setBusy(false);
      await qc.invalidateQueries({ queryKey: ['staff_requests'] });
      await qc.invalidateQueries({ queryKey: ['audit'] });
    }
  };

  const auditId = (out?.body as { audit_id?: number } | null)?.audit_id;
  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.apiConsole')}</h1>
      <p className="text-ink-muted">{t('admin.api.hint')}</p>
      <div className={`${panel} grid gap-3 md:grid-cols-2`}>
        <label className="flex flex-col text-sm">
          {t('admin.api.actAs')}
          <select value={as} onChange={(e) => setAs(e.target.value)} className={field}>
            <option value="">{t('admin.api.me')}</option>
            {DEMO_USERS.map(([role, handles]) => (
              <optgroup key={role} label={t(`role.${role}`)}>
                {handles.map((h) => (
                  <option key={h} value={`${h}@navnagar.test`}>
                    {h}@navnagar.test
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          {t('admin.api.ticket')}
          <input
            list="api-tickets"
            value={ticket}
            onChange={(e) => setTicket(e.target.value.trim())}
            placeholder="NMC-2026-000142"
            className={field}
          />
          <datalist id="api-tickets">
            {requests.map((r) => (
              <option key={r.id} value={r.ticket_no}>
                {t(`state.${r.state}`)}
              </option>
            ))}
          </datalist>
          <span className="text-ink-muted">
            {req ? t('admin.api.current', { state: t(`state.${req.state}`) }) : ticket && t('admin.api.noTicket')}
          </span>
        </label>
        <label className="flex flex-col text-sm">
          {t('admin.api.action')}
          <select value={action} onChange={(e) => setAction(e.target.value)} className={field}>
            <option value="">{t('admin.pick')}</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          {t('admin.api.payload')}
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={3}
            spellCheck={false}
            className={`${field} py-2 font-mono text-xs`}
          />
        </label>
        <div className="md:col-span-2">
          <button className={primary} disabled={busy || !req || !action} onClick={() => void send()}>
            {t('admin.api.send')}
          </button>
        </div>
      </div>
      {out && (
        <section className={panel} aria-live="polite" aria-labelledby="api-out">
          <h2 id="api-out" className="mb-2 text-lg">
            {t('admin.api.response')} · {out.status}
          </h2>
          <pre className="overflow-x-auto rounded-sm bg-paper p-3 font-mono text-xs">
            {JSON.stringify(out.body, null, 2)}
          </pre>
          {auditId && (
            <Link
              to={`/admin/audit?ticket=${encodeURIComponent(ticket)}&id=${auditId}`}
              className="mt-2 inline-block font-semibold text-nmc underline"
            >
              {t('admin.api.auditLink', { id: auditId })}
            </Link>
          )}
        </section>
      )}
    </section>
  );
}
