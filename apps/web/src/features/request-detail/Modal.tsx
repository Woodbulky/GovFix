import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Native <dialog>: focus trap, Esc and inert background come from the browser. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="w-full max-w-[560px] rounded-lg bg-paper p-0 backdrop:bg-canopy/40"
    >
      <div className="space-y-3 p-4">
        <header className="flex items-start gap-2">
          <h2 className="flex-1 text-xl">{title}</h2>
          <button onClick={() => ref.current?.close()} aria-label={t('close')} className="p-2">
            <X aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
