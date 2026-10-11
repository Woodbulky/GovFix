import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HOME } from '@/app/access';
import { useDemoMode } from '@/lib/queries';
import { signIn, useAuth } from './store';

// Seeded by scripts/seed-users.ts (docs/PRD.md "Demo users"). Emails only; names come from profiles.
export const DEMO_USERS: [string, string[]][] = [
  ['citizen', ['sunita', 'ramesh', 'aisha']],
  ['officer', ['patil', 'kale', 'more', 'shaikh', 'gaikwad', 'pawar', 'joshi']],
  ['dept_head', ['deshmukh', 'bhosale', 'wagh', 'rao', 'sawant', 'sayyed']],
  ['manager', ['meera']],
  ['commissioner', ['commissioner']],
];

/** Demo mode only: really signs in as a seeded user, so the JWT (and RLS) changes. */
export function DemoSwitcher({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const demo = useDemoMode();
  const email = useAuth((s) => s.session?.user.email ?? '');
  const [error, setError] = useState(false);
  const password = import.meta.env.VITE_DEMO_PASSWORD;
  if (!demo || !password) return null;

  const pick = async (next: string) => {
    if (!next) return;
    const profile = await signIn(next, password);
    setError(!profile);
    if (profile) navigate(HOME[profile.role]);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className={dark ? 'text-white/80' : 'text-ink-muted'}>{t('demo.switch')}</span>
      <select
        value={email}
        onChange={(e) => void pick(e.target.value)}
        className="min-h-[var(--touch)] rounded-sm border border-line bg-surface px-2 text-ink"
      >
        <option value="">{t('demo.pick')}</option>
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
      {error && <span role="alert">{t('auth.failed')}</span>}
    </label>
  );
}
