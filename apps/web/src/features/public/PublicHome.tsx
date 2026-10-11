import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { HOME } from '@/app/access';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useAuth } from '@/features/auth/store';
import { CityHero } from '@/features/city/CityHero';
import { useAppSettings } from '@/lib/queries';
import { nameOf, useCategories } from '@/lib/reference';
import { DepartmentList } from './Departments';

const button = 'inline-flex min-h-12 items-center rounded-md px-5 font-semibold';

/** Category tiles from the database. Each opens the typed report with that category picked. */
export function CategoryTiles() {
  const { i18n } = useTranslation();
  const { data: cats } = useCategories();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cats?.map((c) => (
        <li key={c.code}>
          <Link
            to={`/report?category=${c.code}`}
            className="flex min-h-[96px] flex-col items-start justify-between rounded-lg border border-line bg-surface p-4 hover:border-nmc"
          >
            <CategoryIcon name={c.icon} size={28} className="text-nmc" />
            <span className="font-medium">{nameOf(c, i18n.language)}</span>
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
    t('how.report'),
    triageHours ? t('how.review', { n: triageHours }) : t('how.reviewPlain'),
    t('how.fix'),
    t('how.confirm'),
  ];

  return (
    <div className="space-y-10">
      {/* The live city behind (anonymous pins only); the canopy colour is the poster until it is ready. */}
      <section className="relative isolate flex min-h-[460px] items-end overflow-hidden rounded-lg bg-canopy p-4 text-white sm:p-8 lg:items-center">
        <CityHero />
        <div className="relative z-20 max-w-md rounded-lg bg-canopy p-6 shadow-xl">
          <h1 className="text-3xl">{t('hero.title')}</h1>
          <p className="mt-2 max-w-[60ch] text-white/85">{t('hero.body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/report?mode=talk" className={`${button} bg-marigold text-canopy`}>
              {t('actions.talk')}
            </Link>
            <Link to="/report" className={`${button} border border-white`}>
              {t('actions.type')}
            </Link>
            <Link to="/explore" className={`${button} text-white underline underline-offset-4`}>
              {t('home.exploreCity')}
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t('home.categories')}</h2>
        <CategoryTiles />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t('how.title')}</h2>
        <ol className="grid gap-3 sm:grid-cols-4">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-lg bg-surface p-4">
              <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nmc font-semibold text-white">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">{t('nav.departments')}</h2>
        <DepartmentList />
      </section>
    </div>
  );
}
