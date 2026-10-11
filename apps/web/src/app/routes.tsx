import {
  Bell,
  Building2,
  Copy,
  FilePlus,
  House,
  Inbox,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  ScrollText,
  Search,
  ShieldAlert,
  SquareKanban,
  Table2,
  Terminal,
  TimerReset,
  User,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { LoginPage } from '@/features/auth/LoginPage';
import type { Role } from '@/features/auth/store';
import type { Access } from './access';
import { ComplaintDetail } from '@/features/citizen/ComplaintDetail';
import { CitizenHome, MyComplaints } from '@/features/citizen/MyComplaints';
import { NotificationsPage } from '@/features/citizen/NotificationsPage';
import { ProfilePage } from '@/features/citizen/ProfilePage';
import { DepartmentsPage } from '@/features/public/Departments';
import { PublicHome } from '@/features/public/PublicHome';
import { TrackPage } from '@/features/public/TrackPage';
import { ReportPage } from '@/features/report/ReportPage';
import { Soon } from './pages';

export type AppRoute = {
  path: string;
  /** i18n key under nav.* */
  key: string;
  icon: LucideIcon;
  access: Access;
  /** Hidden and refused unless demo mode is on. */
  demo?: boolean;
  element: ReactNode;
};

const STAFF: Role[] = ['officer', 'dept_head', 'manager', 'commissioner'];
const soon = (key: string, phase: string) => <Soon titleKey={`nav.${key}`} phase={phase} />;

// ponytail: placeholder screens; P5 (staff), P8 (city) and P9 (admin) swap in the real elements.
export const ROUTES: AppRoute[] = [
  // Public, also reachable when signed in
  { path: '/', key: 'home', icon: House, access: 'anyone', element: <PublicHome /> },
  { path: '/explore', key: 'explore', icon: MapIcon, access: 'anyone', element: soon('explore', 'P8') },
  { path: '/track', key: 'track', icon: Search, access: 'anyone', element: <TrackPage /> },
  { path: '/departments', key: 'departments', icon: Building2, access: 'anyone', element: <DepartmentsPage /> },
  { path: '/login', key: 'login', icon: User, access: 'anyone', element: <LoginPage /> },
  // Citizen
  { path: '/me', key: 'citizenHome', icon: House, access: ['citizen'], element: <CitizenHome /> },
  { path: '/report', key: 'report', icon: FilePlus, access: ['citizen'], element: <ReportPage /> },
  {
    path: '/me/complaints',
    key: 'myComplaints',
    icon: Inbox,
    access: ['citizen'],
    element: <MyComplaints />,
  },
  { path: '/me/complaints/:id', key: 'complaint', icon: Inbox, access: ['citizen'], element: <ComplaintDetail /> },
  {
    path: '/notifications',
    key: 'notifications',
    icon: Bell,
    access: ['citizen', 'officer'],
    element: <NotificationsPage />,
  },
  { path: '/profile', key: 'profile', icon: User, access: ['citizen'], element: <ProfilePage /> },
  // Staff
  { path: '/requests/:id', key: 'request', icon: Inbox, access: STAFF, element: soon('request', 'P5') },
  { path: '/officer', key: 'myWork', icon: ListChecks, access: ['officer'], element: soon('myWork', 'P5') },
  { path: '/dept', key: 'board', icon: SquareKanban, access: ['dept_head'], element: soon('board', 'P5') },
  { path: '/dept/assign', key: 'toAssign', icon: UserPlus, access: ['dept_head'], element: soon('toAssign', 'P5') },
  { path: '/dept/officers', key: 'officers', icon: Users, access: ['dept_head'], element: soon('officers', 'P5') },
  {
    path: '/escalations',
    key: 'escalations',
    icon: ShieldAlert,
    access: ['dept_head', 'commissioner'],
    element: soon('escalations', 'P5'),
  },
  { path: '/triage', key: 'triage', icon: Inbox, access: ['manager'], element: soon('triage', 'P5') },
  { path: '/triage/duplicates', key: 'duplicates', icon: Copy, access: ['manager'], element: soon('duplicates', 'P5') },
  {
    path: '/requests',
    key: 'allRequests',
    icon: Table2,
    access: ['manager', 'commissioner'],
    element: soon('allRequests', 'P5'),
  },
  // Commissioner
  { path: '/admin', key: 'overview', icon: LayoutDashboard, access: ['commissioner'], element: soon('overview', 'P9') },
  { path: '/admin/audit', key: 'audit', icon: ScrollText, access: ['commissioner'], element: soon('audit', 'P9') },
  {
    path: '/admin/workflow',
    key: 'workflow',
    icon: Workflow,
    access: ['commissioner'],
    element: soon('workflow', 'P9'),
  },
  {
    path: '/admin/time-machine',
    key: 'timeMachine',
    icon: TimerReset,
    access: ['commissioner'],
    demo: true,
    element: soon('timeMachine', 'P9'),
  },
  {
    path: '/admin/api-console',
    key: 'apiConsole',
    icon: Terminal,
    access: ['commissioner'],
    demo: true,
    element: soon('apiConsole', 'P9'),
  },
  { path: '/admin/users', key: 'users', icon: Users, access: ['commissioner'], element: soon('users', 'P9') },
];

/** Sidebar / top-bar items per role, in docs/PRD.md order. */
export const NAV: Record<Role | 'public', string[]> = {
  public: ['/', '/explore', '/track', '/departments'],
  citizen: ['/me', '/report', '/me/complaints', '/explore', '/notifications', '/profile'],
  officer: ['/officer', '/explore', '/notifications'],
  dept_head: ['/dept', '/dept/assign', '/escalations', '/dept/officers', '/explore'],
  manager: ['/triage', '/triage/duplicates', '/requests', '/explore'],
  commissioner: [
    '/admin',
    '/requests',
    '/escalations',
    '/admin/audit',
    '/admin/workflow',
    '/admin/time-machine',
    '/admin/api-console',
    '/admin/users',
  ],
};

const byPath = new Map(ROUTES.map((r) => [r.path, r]));
export const navFor = (role: Role | undefined, demo: boolean) =>
  NAV[role ?? 'public'].map((p) => byPath.get(p)!).filter((r) => !r.demo || demo);
