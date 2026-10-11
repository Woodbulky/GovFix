// Bottom-left: map key and the controls help shown on first use.
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const swatch = (style: React.CSSProperties) => (
  <span aria-hidden className="inline-block h-1.5 w-6 rounded-full" style={style} />
);

export function Legend() {
  const { t } = useTranslation();
  const rows: [React.ReactNode, string][] = [
    [swatch({ background: 'var(--marigold)' }), t('city.legend.ward')],
    [swatch({ background: 'var(--river)', height: 8 }), t('city.legend.river')],
    [
      swatch({ background: 'repeating-linear-gradient(90deg,#4a4644 0 6px,transparent 6px 10px)' }),
      t('city.legend.rail'),
    ],
    [swatch({ background: '#3b3d40', height: 8 }), t('city.legend.road')],
    [
      <span aria-hidden className="rounded-full bg-surface px-1.5 text-xs shadow">
        Aa
      </span>,
      t('city.legend.landmark'),
    ],
  ];
  return (
    <section aria-labelledby="city-legend" className="hidden rounded-md bg-surface p-3 shadow-md sm:block">
      <h2 id="city-legend" className="text-base">
        {t('city.legend.title')}
      </h2>
      <ul className="mt-1 space-y-1 text-sm">
        {rows.map(([icon, label]) => (
          <li key={label} className="flex items-center gap-2">
            {icon}
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Help({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="city-help" className="max-w-sm rounded-md bg-surface p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <h2 id="city-help" className="text-lg">
          {t('city.help.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="-m-2 inline-flex min-h-[var(--touch)] min-w-[var(--touch)] items-center justify-center"
        >
          <X aria-hidden size={20} />
          <span className="sr-only">{t('city.help.close')}</span>
        </button>
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        <li>{t('city.help.overview')}</li>
        <li>{t('city.help.fly')}</li>
        <li>{t('city.help.walk')}</li>
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 inline-flex min-h-[var(--touch)] items-center rounded-md bg-nmc px-4 font-semibold text-white"
      >
        {t('city.help.close')}
      </button>
    </section>
  );
}
