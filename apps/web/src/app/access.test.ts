import { expect, test } from 'vitest';
import type { Role } from '@/features/auth/store';
import { canAccess, HOME } from './access';
import { navFor, ROUTES } from './routes';

const ROLES: Role[] = ['citizen', 'officer', 'dept_head', 'manager', 'commissioner'];
const route = (path: string) => ROUTES.find((r) => r.path === path)!;

test('every role lands on a home it may open, and sees only its own tabs', () => {
  for (const role of ROLES) {
    expect(canAccess(route(HOME[role]).access, role)).toBe(true);
    for (const r of navFor(role, true)) expect(canAccess(r.access, role, true, r.demo), `${role} ${r.path}`).toBe(true);
  }
  expect(navFor('officer', true).map((r) => r.key)).toEqual(['myWork', 'explore', 'notifications']);
  expect(navFor('manager', true).map((r) => r.key)).toEqual(['triage', 'duplicates', 'allRequests', 'explore']);
});

test("another role's page is refused", () => {
  expect(canAccess(route('/admin/audit').access, 'citizen')).toBe(false);
  expect(canAccess(route('/triage').access, 'dept_head')).toBe(false);
  expect(canAccess(route('/dept').access, 'officer')).toBe(false);
  expect(canAccess(route('/me').access, 'commissioner')).toBe(false);
  expect(canAccess(route('/requests/:id').access, 'citizen')).toBe(false);
  expect(canAccess(route('/me').access, undefined)).toBe(false);
});

test('demo-only tools disappear when demo mode is off', () => {
  const tm = route('/admin/time-machine');
  expect(canAccess(tm.access, 'commissioner', false, tm.demo)).toBe(false);
  expect(canAccess(tm.access, 'commissioner', true, tm.demo)).toBe(true);
  expect(navFor('commissioner', false).map((r) => r.key)).not.toContain('timeMachine');
  expect(navFor('commissioner', true).map((r) => r.key)).toContain('apiConsole');
});
