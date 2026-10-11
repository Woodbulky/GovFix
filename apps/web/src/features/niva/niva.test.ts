import { expect, test } from 'vitest';
import { EMPTY_DRAFT, hasDraft } from './store';
import { ticketSuffix } from './tools';

test('spoken ticket numbers match the stored 6-digit suffix', () => {
  expect(ticketSuffix('NMC-2026-000142')).toBe('000142');
  expect(ticketSuffix('one four two: 142')).toBe('000142');
  expect(ticketSuffix('0 0 0 1 4 2')).toBe('000142');
});

test('only a draft with something in it is handed to the typed form', () => {
  expect(hasDraft(EMPTY_DRAFT)).toBe(false);
  expect(hasDraft({ ...EMPTY_DRAFT, description: 'पाणी गळतंय' })).toBe(true);
  expect(hasDraft({ ...EMPTY_DRAFT, place: { ward_id: 7, landmark_id: null, x: 1, z: 2 } })).toBe(true);
});
