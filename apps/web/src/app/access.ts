import type { Role } from '@/features/auth/store';

/** Where each role lands after sign-in. */
export const HOME: Record<Role, string> = {
  citizen: '/me',
  officer: '/officer',
  dept_head: '/dept',
  manager: '/triage',
  commissioner: '/admin',
};

export type Access = 'anyone' | Role[];

/** UI-side check only; the database (RLS + transition_request) is the authority. */
export const canAccess = (access: Access, role: Role | undefined, demo = false, demoOnly = false) =>
  (access === 'anyone' || (!!role && access.includes(role))) && (!demoOnly || demo);
