import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/store';
import { useAppSettings, useDemoMode } from '@/lib/queries';
import { type Access, canAccess } from './access';
import { AppShell } from './layouts/Layouts';
import { NotAvailable } from './pages';
import { ROUTES } from './routes';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } });

function Guard({ access, demoOnly, children }: { access: Access; demoOnly?: boolean; children: ReactNode }) {
  const { ready, session, profile } = useAuth();
  const demo = useDemoMode();
  const settingsPending = useAppSettings().isPending;
  const location = useLocation();
  if (access === 'anyone') return children;
  if (!ready || (demoOnly && settingsPending)) return null;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return canAccess(access, profile?.role, demo, demoOnly) ? children : <NotAvailable />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            {ROUTES.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <Guard access={r.access} demoOnly={r.demo}>
                    {r.element}
                  </Guard>
                }
              />
            ))}
            <Route path="*" element={<NotAvailable />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
