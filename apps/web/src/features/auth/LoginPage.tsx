import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { HOME } from '@/app/access';
import { DemoSwitcher } from './DemoSwitcher';
import { signIn, useAuth } from './store';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const profile = useAuth((s) => s.profile);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  if (profile && !busy) return <Navigate to={from ?? HOME[profile.role]} replace />;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const p = await signIn(String(f.get('email')), String(f.get('password')));
    setBusy(false);
    setError(!p);
    if (p) navigate(from ?? HOME[p.role], { replace: true });
  };

  return (
    <div className="mx-auto max-w-[440px] space-y-6 rounded-lg bg-surface p-6 shadow-sm">
      <h1 className="text-2xl">{t('auth.title')}</h1>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <label className="block">
          <span className="font-medium">{t('auth.email')}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="mt-1 block min-h-[var(--touch)] w-full rounded-md border border-line px-3"
          />
        </label>
        <label className="block">
          <span className="font-medium">{t('auth.password')}</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block min-h-[var(--touch)] w-full rounded-md border border-line px-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-st-rejected">
            {t('auth.failed')}
          </p>
        )}
        <button
          disabled={busy}
          className="min-h-[var(--touch)] w-full rounded-md bg-nmc px-5 font-semibold text-white disabled:opacity-60"
        >
          {t('auth.submit')}
        </button>
      </form>
      <DemoSwitcher />
    </div>
  );
}
