import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS } from '@/i18n';
import { cn } from '@/lib/utils';

const STATUS = ['submitted', 'triaged', 'assigned', 'progress', 'info', 'resolved', 'closed', 'rejected', 'reopened'];
const SLA = ['ok', 'risk', 'breach', 'paused'];
const SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];

// Phase 0 check page: tokens and typography in en / hi / mr. Replaced by the real home in P3/P4.
export function TokensPage() {
  const { t, i18n } = useTranslation();
  const [large, setLarge] = useState(false);

  const toggleLarge = () => {
    document.documentElement.classList.toggle('large-text', !large);
    setLarge(!large);
  };

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-3 bg-canopy px-4 py-3 text-white">
        <strong className="font-heading text-lg">{t('app.name')}</strong>
        <span className="text-white/80">{t('app.org')}</span>
        <div role="group" aria-label={t('lang.label')} className="ml-auto flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              aria-pressed={i18n.language === l}
              onClick={() => i18n.changeLanguage(l)}
              className={cn('min-h-[var(--touch)] rounded-sm px-3', i18n.language === l && 'bg-white text-canopy')}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
        <button aria-pressed={large} onClick={toggleLarge} className="min-h-[var(--touch)] rounded-sm border px-3">
          {t('largeText')}
        </button>
      </header>

      <main className="mx-auto max-w-[880px] space-y-8 p-4">
        <section className="rounded-lg bg-surface p-6 shadow-sm">
          <h1 className="text-3xl text-nmc">{t('hero.title')}</h1>
          <p className="mt-2 text-ink-muted">{t('hero.body')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="min-h-[var(--touch)] rounded-md bg-nmc px-5 font-semibold text-white">
              {t('actions.talk')}
            </button>
            <button className="min-h-[var(--touch)] rounded-md border border-nmc px-5 font-semibold text-nmc">
              {t('actions.type')}
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xl">{t('tokens.status')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {STATUS.map((s) => (
              <li
                key={s}
                className="rounded-sm px-2 py-1"
                style={{ color: `var(--st-${s})`, background: `var(--st-${s}-bg)` }}
              >
                {s}
              </li>
            ))}
          </ul>
          <h2 className="mt-4 text-xl">{t('tokens.sla')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {SLA.map((s) => (
              <li key={s} className="rounded-sm border border-line px-2 py-1" style={{ color: `var(--sla-${s})` }}>
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xl">{t('tokens.type')}</h2>
          {SIZES.map((s) => (
            <p key={s} className={cn(s, 'tabular')}>
              {t('hero.title')} · 0123456789
            </p>
          ))}
        </section>
      </main>
    </div>
  );
}
