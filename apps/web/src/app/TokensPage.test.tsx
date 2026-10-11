import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import '@/i18n';
import { TokensPage } from './TokensPage';

test('switches between en, hi and mr', () => {
  render(<TokensPage />);
  const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;
  fireEvent.click(screen.getByText('EN'));
  expect(h1()).toBe('Report a problem in your ward');
  fireEvent.click(screen.getByText('हिंदी'));
  expect(h1()).toBe('अपने वार्ड की समस्या दर्ज करें');
  fireEvent.click(screen.getByText('मराठी'));
  expect(h1()).toBe('तुमच्या प्रभागातील समस्या नोंदवा');
  expect(document.documentElement.lang).toBe('mr');
});
