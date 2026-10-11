import { Leaf } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { useNotifications } from '@/features/citizen/hooks';
import { useDemoMode } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { navFor } from '../routes';
import { HeaderControls } from './HeaderControls';

function Logo({ dark }: { dark: boolean }) {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex min-h-[var(--touch)] items-center gap-2">
      <Leaf aria-hidden className={dark ? 'text-marigold' : 'text-nmc'} />
      <span className="leading-tight">
        <strong className="block font-heading text-lg">{t('app.name')}</strong>
        <span className={cn('text-sm', dark ? 'text-white/80' : 'text-ink-muted')}>{t('app.org')}</span>
      </span>
    </Link>
  );
}

function Nav({ dark, vertical }: { dark: boolean; vertical: boolean }) {
  const { t } = useTranslation();
  const role = useAuth((s) => s.profile?.role);
  const items = navFor(role, useDemoMode());
  const idle = dark ? 'text-white/85' : 'text-ink';
  const active = dark ? 'bg-white/15 text-white' : 'bg-nmc text-white';
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
                  'flex min-h-[var(--touch)] items-center gap-2 whitespace-nowrap rounded-sm px-3 font-medium',
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

/** Public and citizen screens: top bar, single column. */
function TopBarLayout() {
  return (
    <div className="min-h-screen">
      <SkipLink />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-2">
          <Logo dark={false} />
          <HeaderControls />
        </div>
        <div className="mx-auto max-w-[1200px] px-4 pb-2">
          <Nav dark={false} vertical={false} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[880px] p-4">
        <Outlet />
      </main>
    </div>
  );
}

/** Staff screens: 240 px canopy sidebar (a strip under the header on small screens). */
function StaffLayout() {
  return (
    <div className="min-h-screen md:flex">
      <SkipLink />
      <aside className="hidden w-[240px] shrink-0 space-y-6 bg-canopy p-4 text-white md:block">
        <Logo dark />
        <Nav dark vertical />
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-end gap-3 border-b border-line bg-surface px-4 py-2">
          <div className="mr-auto md:hidden">
            <Logo dark={false} />
          </div>
          <HeaderControls />
        </header>
        <div className="bg-canopy px-2 py-1 md:hidden">
          <Nav dark vertical={false} />
        </div>
        <main id="main" className="mx-auto max-w-[1440px] p-4">
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
      <Toaster />
    </>
  );
}
