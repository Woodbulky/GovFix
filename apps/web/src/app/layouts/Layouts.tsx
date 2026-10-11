import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CivicMark } from '@/components/CivicMark';
import { Toaster } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { useNotifications } from '@/features/citizen/hooks';
import { useDemoMode } from '@/lib/queries';
import { rpc } from '@/lib/rpc';
import { cn } from '@/lib/utils';
import { navFor } from '../routes';
import { HeaderControls } from './HeaderControls';

// The ElevenLabs SDK is heavy; it loads after the shell, not with it.
const Niva = lazy(() => import('@/features/niva/NivaCall').then((m) => ({ default: m.Niva })));

function Logo({ dark }: { dark: boolean }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex min-h-[var(--touch)] items-center gap-3">
      <span className={cn('grid place-items-center', dark && 'h-11 w-11 rounded-md bg-paper')}>
        <CivicMark size={dark ? 38 : 42} />
      </span>
      <span className="leading-tight">
        <strong className="block font-heading text-xl font-normal">{t('app.name')}</strong>
        <span className={cn('text-sm', dark ? 'text-mint/80' : 'text-ink-muted')}>{t('app.org')}</span>
        {dark && (
          <span className="mt-1 block text-sm font-bold uppercase tracking-[0.12em] text-marigold">
            {t('brand.staffOps')}
          </span>
        )}
      </span>
    </Link>
  );
}

function Nav({ dark, vertical }: { dark: boolean; vertical: boolean }) {
  const { t } = useTranslation();
  const role = useAuth((s) => s.profile?.role);
  const items = navFor(role, useDemoMode());
  // govfix2: forest pill on ivory; mint pill with an amber rail on the forest sidebar.
  const idle = dark ? 'text-mint/80 hover:bg-white/10 hover:text-white' : 'text-ink hover:bg-mint/60';
  const active = dark
    ? 'bg-mint font-bold text-nmc shadow-md before:absolute before:-left-4 before:h-6 before:w-[3px] before:rounded-r before:bg-marigold'
    : 'bg-nmc text-white shadow-sm';
  return (
    <nav aria-label={t('nav.label')}>
      <ul className={cn('flex gap-1', vertical ? 'flex-col' : 'overflow-x-auto')}>
        {items.map(({ path, key, icon: Icon }) => (
          <li key={path}>
            <NavLink
              to={path}
              end
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[var(--touch)] items-center gap-2 whitespace-nowrap rounded-sm px-3 font-medium transition-colors',
                  isActive ? active : idle,
                )
              }
            >
              <Icon aria-hidden size={18} />
              {t(`nav.${key}`)}
              {key === 'notifications' && <UnreadCount />}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function UnreadCount() {
  const { t } = useTranslation();
  const n = useNotifications().data?.filter((x) => !x.read_at).length;
  if (!n) return null;
  return (
    <span className="tabular ml-auto rounded-full bg-marigold px-2 text-sm font-semibold text-canopy">
      {n}
      <span className="sr-only"> {t('notifications.unread')}</span>
    </span>
  );
}

function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-2">
      {t('skip')}
    </a>
  );
}

/** Staff profile card at the bottom of the sidebar (govfix2 .manager-role). */
function SidebarProfile() {
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  if (!profile) return null;
  const initials = profile.full_name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 border-t border-mint/15 pt-4">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-mint text-sm font-bold text-nmc">
        {initials}
      </span>
      <span className="min-w-0 text-sm leading-tight">
        <strong className="block truncate">{profile.full_name}</strong>
        <span className="text-mint/70">{t(`role.${profile.role}`)}</span>
      </span>
    </div>
  );
}

/** The city explorer is full bleed: no page padding or max width (DESIGN.md). */
const useBleed = () => useLocation().pathname === '/explore';
/** Landing-style pages use the wide govfix2 grid; forms and reading pages stay narrow. */
const WIDE = ['/', '/departments', '/me', '/me/complaints'];

/** Public and citizen screens: govfix2 top bar (brand, pill nav, tools), civic footer. */
function TopBarLayout() {
  const { t } = useTranslation();
  const bleed = useBleed();
  const wide = WIDE.includes(useLocation().pathname);
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
          <Logo dark={false} />
          <div className="order-last w-full xl:order-none xl:w-auto xl:flex-1">
            <Nav dark={false} vertical={false} />
          </div>
          <div className="ml-auto">
            <HeaderControls />
          </div>
        </div>
      </header>
      <main
        id="main"
        className={
          bleed
            ? 'relative flex-1'
            : cn('mx-auto w-full flex-1 px-4 py-8 lg:px-8', wide ? 'max-w-[1300px]' : 'max-w-[920px]')
        }
      >
        <Outlet />
      </main>
      {!bleed && (
        <footer className="bg-canopy text-white">
          <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-4 px-4 py-6 lg:px-8">
            <span className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-paper">
                <CivicMark size={38} />
              </span>
              <span className="leading-tight">
                <strong className="block font-heading text-lg font-normal">{t('app.name')}</strong>
                <span className="text-sm text-mint/80">{t('app.org')}</span>
              </span>
            </span>
            <span className="text-right text-sm leading-snug">
              <strong className="block">{t('brand.tagline')}</strong>
              <span className="text-mint/80">{t('brand.fictional')}</span>
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}

/** Staff screens: govfix2 forest sidebar (a strip under the header on small screens). */
function StaffLayout() {
  const bleed = useBleed();
  // Idempotent; covers venues where pg_cron is late or unavailable (WORKFLOW.md).
  useEffect(() => {
    const id = setInterval(() => void rpc('run_escalation_sweep', {}).catch(() => {}), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="min-h-screen md:flex">
      <SkipLink />
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-6 overflow-y-auto bg-canopy px-4 pb-5 pt-6 text-white shadow-[8px_0_28px_rgb(7_56_45/0.1)] md:flex">
        <div className="border-b border-mint/15 pb-5">
          <Logo dark />
        </div>
        <Nav dark vertical />
        <div className="mt-auto">
          <SidebarProfile />
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-end gap-3 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur lg:px-8">
          <div className="mr-auto md:hidden">
            <Logo dark={false} />
          </div>
          <HeaderControls />
        </header>
        <div className="bg-canopy px-2 py-1 md:hidden">
          <Nav dark vertical={false} />
        </div>
        <main id="main" className={bleed ? 'relative flex-1' : 'mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Layout follows the signed-in role, so shared pages (Explore, Track) keep the user's chrome. */
export function AppShell() {
  const role = useAuth((s) => s.profile?.role);
  return (
    <>
      {role && role !== 'citizen' ? <StaffLayout /> : <TopBarLayout />}
      {role && (
        <Suspense fallback={null}>
          <Niva />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}
