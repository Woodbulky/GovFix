import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test } from 'vitest';
import i18n from '@/i18n';
import { EscalationBadge } from './EscalationBadge';
import { SlaBadge } from './SlaBadge';
import { StatusChip } from './StatusChip';

function wrap(ui: ReactNode, offset = 0) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  qc.setQueryData(['app_settings'], { sim_offset_seconds: offset, demo_mode: true });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
const inMs = (ms: number) => new Date(Date.now() + ms).toISOString();
const H = 3_600_000;

afterEach(() => void i18n.changeLanguage('en'));

test('SlaBadge words every status, never colour alone', () => {
  wrap(
    <>
      <SlaBadge status="untriaged" />
      <SlaBadge status="at_risk" dueAt={inMs(3 * H + 10 * 60_000)} />
      <SlaBadge status="breached" dueAt={inMs(-2 * H)} />
      <SlaBadge status="paused" audience="citizen" />
      <SlaBadge status="done" />
    </>,
  );
  for (const text of ['Under review', 'Due in 3h 10m', 'Past deadline by 2h', 'Paused, waiting for you', 'Done'])
    expect(screen.getByText(text)).toBeTruthy();
});

test('SlaBadge counts down in sim time', () => {
  // Due in 5h real time, but the sim clock is 4h ahead: 1h left.
  wrap(<SlaBadge status="at_risk" dueAt={inMs(5 * H)} />, 4 * 3600);
  expect(screen.getByText('Due in 1h')).toBeTruthy();
});

test('StatusChip and EscalationBadge follow the language', async () => {
  await i18n.changeLanguage('mr');
  wrap(
    <>
      <StatusChip state="IN_PROGRESS" />
      <EscalationBadge level={2} />
      <EscalationBadge level={0} />
    </>,
  );
  expect(screen.getByText('काम सुरू')).toBeTruthy();
  expect(screen.getByText('आयुक्तांकडे पाठवली')).toBeTruthy();
});
