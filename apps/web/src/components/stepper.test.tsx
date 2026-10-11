import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import '@/i18n';
import { Stepper } from './Stepper';
import { refusalKey } from './Toaster';

test('branch states sit on their main step with their own label', () => {
  render(<Stepper state="NEEDS_INFO" />);
  const current = document.querySelector('[aria-current=step]')!;
  expect(current.textContent).toContain('Needs info');
  expect(current.textContent).toContain('4');
  expect(screen.queryByText('In progress')).toBeNull();
});

test('refusal codes become i18n keys without i18next separators', () => {
  expect(refusalKey('MISSING_FIELD:reply')).toBe('refusal.MISSING_FIELD_reply');
  expect(refusalKey('GUARD_FAILED:within_reopen_window')).toBe('refusal.GUARD_FAILED_within_reopen_window');
});
