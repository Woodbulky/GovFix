import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/store';
import { HOME } from './access';

const button = 'inline-flex min-h-[var(--touch)] items-center rounded-md px-5 font-semibold';

// ponytail: poster hero until Lane D's 3D city lands (P8b); P4 adds tiles, how-it-works and departments.
export function PublicHome() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  if (profile) return <Navigate to={HOME[profile.role]} replace />;
  return (
    <section className="rounded-lg bg-canopy p-8 text-white">
      <h1 className="text-3xl">{t('hero.title')}</h1>
      <p className="mt-2 max-w-[60ch] text-white/85">{t('hero.body')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/report" className={`${button} bg-marigold text-canopy`}>
          {t('actions.talk')}
        </Link>
        <Link to="/report" className={`${button} border border-white`}>
          {t('actions.type')}
        </Link>
      </div>
    </section>
  );
}

export function Soon({ titleKey, phase }: { titleKey: string; phase: string }) {
  const { t } = useTranslation();
  return (
    <section>
      <h1 className="text-2xl">{t(titleKey)}</h1>
      <p className="mt-2 text-ink-muted">{t('soon', { phase })}</p>
    </section>
  );
}

export function NotAvailable() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  return (
    <section className="mx-auto max-w-[640px] rounded-lg bg-surface p-6 text-center shadow-sm">
      <Ban aria-hidden className="mx-auto text-st-rejected" size={40} />
      <h1 className="mt-3 text-2xl">{t('notAvailable.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('notAvailable.body')}</p>
      <Link to={profile ? HOME[profile.role] : '/'} className={`${button} mt-4 bg-nmc text-white`}>
        {t('notAvailable.home')}
      </Link>
    </section>
  );
}
