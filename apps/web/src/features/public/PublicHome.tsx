import { ChevronRight, ClipboardCheck, FilePlus, Map as MapIcon, Mic, ScrollText, ShieldCheck, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { HOME } from '@/app/access';
import { CategoryIcon, TINT } from '@/components/CategoryIcon';
import { useAuth } from '@/features/auth/store';
import { CityHero } from '@/features/city/CityHero';
import { useAppSettings } from '@/lib/queries';
import { nameOf, useCategories } from '@/lib/reference';
import { DepartmentList } from './Departments';

const action = 'inline-flex min-h-12 items-center gap-2 rounded-sm px-5 font-bold transition-shadow';

/** Category tiles from the database. Each opens the typed report with that category picked. */
export function CategoryTiles() {
  const { i18n } = useTranslation();
  const { data: cats } = useCategories();
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cats?.map((c) => (
        <li key={c.code}>
          <Link
            to={`/report?category=${c.code}`}
            className="card group flex min-h-[96px] items-center gap-3 p-4 transition hover:-translate-y-1 hover:border-nmc-600 hover:shadow-md"
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md ${TINT[c.icon ?? ''] ?? TINT['circle-help']}`}>
              <CategoryIcon name={c.icon} size={26} />
            </span>
            <span className="flex-1 font-semibold">{nameOf(c, i18n.language)}</span>
            <ChevronRight aria-hidden size={18} className="text-ink-muted group-hover:text-nmc" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PublicHome() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const triageHours = useAppSettings().data?.triage_hours;
  if (profile) return <Navigate to={HOME[profile.role]} replace />;
  const steps = [
    { text: t('how.report'), Icon: Mic },
    { text: triageHours ? t('how.review', { n: triageHours }) : t('how.reviewPlain'), Icon: ClipboardCheck },
    { text: t('how.fix'), Icon: Wrench },
    { text: t('how.confirm'), Icon: ShieldCheck },
  ];

  return (
    <div className="space-y-14">
      {/* The live city behind (anonymous pins only, framed to the right); the forest colour is the poster until it is ready. */}
      <section className="relative isolate flex min-h-[560px] items-end overflow-hidden rounded-[30px_30px_30px_8px] bg-canopy p-4 shadow-[0_28px_58px_rgb(7_56_45/0.19)] sm:p-8 lg:items-center">
        <CityHero />
        <div className="relative z-20 max-w-[520px] rounded-[24px_24px_24px_6px] bg-paper/95 p-6 text-ink shadow-xl backdrop-blur sm:p-8">
          <p className="eyebrow">{t('app.org')}</p>
          <h1 className="mt-3 text-4xl text-nmc">{t('hero.title')}</h1>
          <p className="mt-3 max-w-[60ch] text-lg text-ink-muted">{t('hero.body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/report?mode=talk"
              className={`${action} bg-nmc pl-2 text-white shadow-[0_8px_18px_rgb(7_56_45/0.16)] hover:bg-nmc-600`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-marigold text-canopy">
                <Mic aria-hidden size={18} />
              </span>
              {t('actions.talk')}
            </Link>
            <Link to="/report" className={`${action} border border-nmc/20 bg-surface text-nmc hover:shadow-md`}>
              <FilePlus aria-hidden size={18} />
              {t('actions.type')}
            </Link>
            <Link to="/explore" className={`${action} text-nmc underline-offset-4 hover:underline`}>
              <MapIcon aria-hidden size={18} />
              {t('home.exploreCity')}
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink-muted">
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden size={16} className="text-nmc-600" />
              {t('home.trustReadBack')}
            </li>
            <li className="flex items-center gap-2">
              <ScrollText aria-hidden size={16} className="text-nmc-600" />
              {t('home.trustAudit')}
            </li>
          </ul>
        </div>
        <p className="absolute bottom-4 right-4 z-20 hidden items-center gap-2 rounded-full bg-canopy/90 px-3 py-1 text-sm font-semibold text-mint sm:flex">
          <span aria-hidden className="h-2 w-2 rounded-full bg-marigold" />
          {t('home.cityCaption')}
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl">{t('home.categories')}</h2>
        <CategoryTiles />
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl">{t('how.title')}</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ text, Icon }, i) => (
            <li key={i} className="card relative p-5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-mint text-nmc">
                <Icon aria-hidden size={20} />
              </span>
              <span className="tabular mt-4 block text-sm font-bold tracking-[0.14em] text-coral-ink">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="mt-1 block font-semibold">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl">{t('nav.departments')}</h2>
        <DepartmentList />
      </section>
    </div>
  );
}
