import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/store';
import { HOME } from './access';

const button = 'inline-flex min-h-[var(--touch)] items-center rounded-md px-5 font-semibold';

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
    <section className="mx-auto max-w-[640px] card p-6 text-center">
      <Ban aria-hidden className="mx-auto text-st-rejected" size={40} />
      <h1 className="mt-3 text-2xl">{t('notAvailable.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('notAvailable.body')}</p>
      <Link to={profile ? HOME[profile.role] : '/'} className={`${button} mt-4 bg-nmc text-white`}>
        {t('notAvailable.home')}
      </Link>
    </section>
  );
}
