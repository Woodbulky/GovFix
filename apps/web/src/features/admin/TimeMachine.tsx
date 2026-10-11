import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/Toaster';
import { primary, secondary } from '@/features/request-detail/ActionForm';
import { refusedToast } from '@/features/request-detail/hooks';
import { useAppSettings, useSimNow } from '@/lib/queries';
import { type RpcResult, rpc } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { panel } from './Overview';

const JUMPS: [string, number][] = [
  ['+1h', 3600],
  ['+4h', 4 * 3600],
  ['+12h', 12 * 3600],
  ['+1 day', 86400],
];
type Sweep = { sweep?: { escalated: number; auto_closed: number }; escalated?: number; auto_closed?: number };

/** Demo mode: shifts now_sim() (the only business clock), runs the sweep, toggles AI, resets the scenario. */
export function TimeMachine() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const settings = useAppSettings().data;
  const now = useSimNow();
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const call = async (fn: () => Promise<unknown>, ok: (r: Sweep) => string) => {
    setBusy(true);
    try {
      const res = (await fn()) as RpcResult<Sweep>;
      if (res.ok) toast(ok(res));
      else refusedToast(res);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'refused');
    } finally {
      setBusy(false);
      await qc.invalidateQueries(); // the clock moved: every deadline, badge and list may change
    }
  };
  const swept = (r: Sweep) => {
    const s = r.sweep ?? r;
    return t('admin.tm.swept', { escalated: s.escalated ?? 0, closed: s.auto_closed ?? 0 });
  };
  const jump = (seconds: number) => call(() => rpc('time_machine_advance', { p_seconds: seconds }), swept);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl">{t('nav.timeMachine')}</h1>
      <section className={panel} aria-labelledby="clock-h">
        <h2 id="clock-h" className="text-lg">
          {t('admin.tm.clock')}
        </h2>
        <p className="tabular text-3xl font-semibold">{fmtWhen(now, i18n.language)}</p>
        <p className="text-sm text-ink-muted">
          {t('admin.tm.offset', { hours: ((settings?.sim_offset_seconds ?? 0) / 3600).toFixed(1) })}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {JUMPS.map(([label, s]) => (
            <button key={label} className={secondary} disabled={busy} onClick={() => void jump(s)}>
              {label}
            </button>
          ))}
          <label className="flex flex-col text-sm">
            {t('admin.tm.custom')}
            <input
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ''))}
              className="min-h-11 w-24 rounded-sm border border-line bg-surface px-3"
            />
          </label>
          <button
            className={primary}
            disabled={busy || !Number(hours)}
            onClick={() => void jump(Math.round(Number(hours) * 3600))}
          >
            {t('admin.tm.jump')}
          </button>
        </div>
      </section>

      <section className={cn(panel, 'flex flex-wrap items-center gap-3')}>
        <button
          className={primary}
          disabled={busy}
          onClick={() => void call(() => rpc('run_escalation_sweep', {}), swept)}
        >
          {t('admin.tm.sweep')}
        </button>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            className="size-5"
            checked={!!settings?.ai_offline}
            disabled={busy}
            onChange={(e) =>
              void call(
                () => rpc('set_ai_offline', { p_offline: e.target.checked }),
                () => t(e.target.checked ? 'admin.tm.aiOff' : 'admin.tm.aiOn'),
              )
            }
          />
          {t('admin.tm.aiOffline')}
        </label>
        <span className="ml-auto flex gap-2">
          {confirmReset ? (
            <>
              <button
                className={primary}
                disabled={busy}
                onClick={() => {
                  setConfirmReset(false);
                  void call(
                    () => rpc('reset_demo', {}),
                    () => t('admin.tm.resetDone'),
                  );
                }}
              >
                {t('admin.tm.resetConfirm')}
              </button>
              <button className={secondary} onClick={() => setConfirmReset(false)}>
                {t('admin.cancel')}
              </button>
            </>
          ) : (
            <button className={secondary} disabled={busy} onClick={() => setConfirmReset(true)}>
              {t('admin.tm.reset')}
            </button>
          )}
        </span>
      </section>
    </section>
  );
}
