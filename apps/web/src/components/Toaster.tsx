import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import type { Refusal } from '@/lib/rpc';

type Toast = { id: number; text: string; kind: 'ok' | 'refused' };
const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));

let next = 0;
export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const id = ++next;
  useToasts.setState((s) => ({ list: [...s.list, { id, text, kind }] }));
  setTimeout(() => dismiss(id), kind === 'refused' ? 9000 : 5000);
}
const dismiss = (id: number) => useToasts.setState((s) => ({ list: s.list.filter((t) => t.id !== id) }));

/** i18n key for a refusal code; ':' and '.' are i18next separators, so they become '_'. */
export const refusalKey = (code: string) => `refusal.${code.replace(/[:.]/g, '_')}`;

/** Hook: show a refusal in the user's language, falling back to the engine's English message. */
export function useRefusalToast() {
  const { t } = useTranslation();
  return (r: Refusal) => toast(t(refusalKey(r.code), { defaultValue: r.message }), 'refused');
}

export function Toaster() {
  const { t } = useTranslation();
  const list = useToasts((s) => s.list);
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {list.map((x) => (
        <div
          key={x.id}
          role={x.kind === 'refused' ? 'alert' : 'status'}
          className="flex items-start gap-2 rounded-md border bg-surface p-3 shadow-lg"
          style={{ borderColor: x.kind === 'refused' ? 'var(--sla-breach)' : 'var(--sla-ok)' }}
        >
          {x.kind === 'refused' ? (
            <TriangleAlert aria-hidden className="mt-0.5 shrink-0 text-sla-breach" size={18} />
          ) : (
            <CircleCheck aria-hidden className="mt-0.5 shrink-0 text-sla-ok" size={18} />
          )}
          <p className="flex-1">{x.text}</p>
          <button onClick={() => dismiss(x.id)} aria-label={t('close')} className="shrink-0 p-1">
            <X aria-hidden size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
