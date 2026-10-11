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
import { type ComponentType, lazy, type ReactNode } from 'react';
import type { Role } from '@/features/auth/store';
import type { Access } from './access';

/** Each page is its own chunk; App wraps route elements in Suspense. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}
const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage');
const ComplaintDetail = page(() => import('@/features/citizen/ComplaintDetail'), 'ComplaintDetail');
const CitizenHome = page(() => import('@/features/citizen/MyComplaints'), 'CitizenHome');
const MyComplaints = page(() => import('@/features/citizen/MyComplaints'), 'MyComplaints');
const NotificationsPage = page(() => import('@/features/citizen/NotificationsPage'), 'NotificationsPage');
const ProfilePage = page(() => import('@/features/citizen/ProfilePage'), 'ProfilePage');
const DepartmentsPage = page(() => import('@/features/public/Departments'), 'DepartmentsPage');
const PublicHome = page(() => import('@/features/public/PublicHome'), 'PublicHome');
const TrackPage = page(() => import('@/features/public/TrackPage'), 'TrackPage');
const ReportPage = page(() => import('@/features/report/ReportPage'), 'ReportPage');
const Board = page(() => import('@/features/department/Board'), 'Board');
const Escalations = page(() => import('@/features/department/Lists'), 'Escalations');
const Officers = page(() => import('@/features/department/Lists'), 'Officers');
const ToAssign = page(() => import('@/features/department/Lists'), 'ToAssign');
const MyWork = page(() => import('@/features/officer/MyWork'), 'MyWork');
const RequestDetail = page(() => import('@/features/request-detail/RequestDetail'), 'RequestDetail');
const AllRequests = page(() => import('@/features/triage/AllRequests'), 'AllRequests');
const Duplicates = page(() => import('@/features/triage/Duplicates'), 'Duplicates');
const TriageQueue = page(() => import('@/features/triage/TriageQueue'), 'TriageQueue');
const ApiConsole = page(() => import('@/features/admin/ApiConsole'), 'ApiConsole');
const AuditLog = page(() => import('@/features/admin/AuditLog'), 'AuditLog');
const Overview = page(() => import('@/features/admin/Overview'), 'Overview');
const TimeMachine = page(() => import('@/features/admin/TimeMachine'), 'TimeMachine');
const UsersPage = page(() => import('@/features/admin/Users'), 'Users');
const WorkflowSla = page(() => import('@/features/admin/WorkflowSla'), 'WorkflowSla');
const CityExplorer = page(() => import('@/features/city/CityExplorer'), 'CityExplorer');

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

export const ROUTES: AppRoute[] = [
  // Public, also reachable when signed in
  { path: '/', key: 'home', icon: House, access: 'anyone', element: <PublicHome /> },
  { path: '/explore', key: 'explore', icon: MapIcon, access: 'anyone', element: <CityExplorer /> },
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
  { path: '/requests/:id', key: 'request', icon: Inbox, access: STAFF, element: <RequestDetail /> },
  { path: '/officer', key: 'myWork', icon: ListChecks, access: ['officer'], element: <MyWork /> },
  { path: '/dept', key: 'board', icon: SquareKanban, access: ['dept_head'], element: <Board /> },
  { path: '/dept/assign', key: 'toAssign', icon: UserPlus, access: ['dept_head'], element: <ToAssign /> },
  { path: '/dept/officers', key: 'officers', icon: Users, access: ['dept_head'], element: <Officers /> },
  {
    path: '/escalations',
    key: 'escalations',
    icon: ShieldAlert,
    access: ['dept_head', 'commissioner'],
    element: <Escalations />,
  },
  { path: '/triage', key: 'triage', icon: Inbox, access: ['manager'], element: <TriageQueue /> },
  { path: '/triage/duplicates', key: 'duplicates', icon: Copy, access: ['manager'], element: <Duplicates /> },
  {
    path: '/requests',
    key: 'allRequests',
    icon: Table2,
    access: ['manager', 'commissioner'],
    element: <AllRequests />,
  },
  // Commissioner
  { path: '/admin', key: 'overview', icon: LayoutDashboard, access: ['commissioner'], element: <Overview /> },
  { path: '/admin/audit', key: 'audit', icon: ScrollText, access: ['commissioner'], element: <AuditLog /> },
  {
    path: '/admin/workflow',
    key: 'workflow',
    icon: Workflow,
    access: ['commissioner'],
    element: <WorkflowSla />,
  },
  {
    path: '/admin/time-machine',
    key: 'timeMachine',
    icon: TimerReset,
    access: ['commissioner'],
    demo: true,
    element: <TimeMachine />,
  },
  {
    path: '/admin/api-console',
    key: 'apiConsole',
    icon: Terminal,
    access: ['commissioner'],
    demo: true,
    element: <ApiConsole />,
  },
  { path: '/admin/users', key: 'users', icon: Users, access: ['commissioner'], element: <UsersPage /> },
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
