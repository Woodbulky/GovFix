import { describe, expect, it } from 'vitest';
import { dropAction } from '@/features/department/Board';
import type { Transition } from './hooks';
import { allowedActions } from './useAllowedActions';

const row = (action: string, from: string, roles: string[], guards: string[] = []) =>
  ({ action, from_state: from, allowed_roles: roles, guards, requires: [] }) as unknown as Transition;
const rows = [
  row('assign', 'TRIAGED', ['dept_head', 'commissioner'], ['is_department_head_of_request_or_commissioner']),
  row('reroute', 'TRIAGED', ['dept_head'], ['is_department_head_of_request']),
  row('start', 'ASSIGNED', ['officer'], ['is_assigned_officer']),
];
const req = (state: string, officer: string | null = null) =>
  ({ state, department_code: 'WTR', assigned_officer_id: officer }) as never;

describe('allowedActions', () => {
  it('offers dept actions only to the head of that department', () => {
    const wtr = { id: 'd', role: 'dept_head', department_code: 'WTR' };
    const swm = { ...wtr, department_code: 'SWM' };
    expect(allowedActions(rows, req('TRIAGED'), wtr).map((t) => t.action)).toEqual(['assign', 'reroute']);
    expect(allowedActions(rows, req('TRIAGED'), swm)).toEqual([]);
    expect(allowedActions(rows, req('TRIAGED'), { id: 'c', role: 'commissioner', department_code: null })).toHaveLength(
      1,
    );
  });
  it('offers start only to the assigned officer', () => {
    const patil = { id: 'patil', role: 'officer', department_code: 'WTR' };
    expect(allowedActions(rows, req('ASSIGNED', 'patil'), patil)).toHaveLength(1);
    expect(allowedActions(rows, req('ASSIGNED', 'kale'), patil)).toEqual([]);
  });
});

describe('dropAction', () => {
  it('maps board drops to engine actions', () => {
    expect(dropAction('TRIAGED', 'ASSIGNED')).toBe('assign');
    expect(dropAction('IN_PROGRESS', 'ASSIGNED')).toBe('reassign');
    expect(dropAction('ASSIGNED', 'CLOSED')).toBe('confirm');
  });
});
