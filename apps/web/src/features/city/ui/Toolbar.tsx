// Top-right: navigation mode, layer toggles, lite (2D) mode and help.
import { Bird, CircleHelp, Eye, Layers as LayersIcon, Map as MapIcon, Plane, Footprints } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useCity, type LayerKey, type Mode } from '../store';

const MODES: { mode: Mode; icon: typeof Eye }[] = [
  { mode: 'overview', icon: Eye },
  { mode: 'fly', icon: Plane },
  { mode: 'walk', icon: Footprints },
];
const LAYERS: LayerKey[] = ['wards', 'labels', 'traffic', 'followSim'];
const btn =
  'inline-flex min-h-[var(--touch)] min-w-[var(--touch)] items-center justify-center gap-1.5 rounded-sm px-3 font-semibold';

export function Toolbar({ onLite, onHelp }: { onLite: () => void; onHelp: () => void }) {
  const { t } = useTranslation();
  const { mode, setMode, layers, toggleLayer } = useCity();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <div role="group" aria-label={t('city.modeLabel')} className="flex rounded-md bg-surface p-1 shadow-md">
          {MODES.map(({ mode: m, icon: Icon }) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(btn, mode === m ? 'bg-nmc text-white' : 'text-ink')}
            >
              <Icon aria-hidden size={18} />
              <span className="hidden sm:inline">{t(`city.mode.${m}`)}</span>
              <span className="sr-only sm:hidden">{t(`city.mode.${m}`)}</span>
            </button>
          ))}
        </div>
        <div className="flex rounded-md bg-surface p-1 shadow-md">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="city-layers"
            onClick={() => setOpen((o) => !o)}
            className={cn(btn, 'text-ink')}
          >
            <LayersIcon aria-hidden size={18} />
            <span className="hidden sm:inline">{t('city.layers')}</span>
            <span className="sr-only sm:hidden">{t('city.layers')}</span>
          </button>
          <button type="button" onClick={onLite} className={cn(btn, 'text-ink')}>
            <MapIcon aria-hidden size={18} />
            <span className="hidden sm:inline">{t('city.lite')}</span>
            <span className="sr-only sm:hidden">{t('city.lite')}</span>
          </button>
          <button type="button" onClick={onHelp} className={cn(btn, 'text-ink')}>
            <CircleHelp aria-hidden size={18} />
            <span className="sr-only">{t('city.help.open')}</span>
          </button>
        </div>
      </div>
      {open && (
        <fieldset id="city-layers" className="rounded-md bg-surface p-3 shadow-md">
          <legend className="sr-only">{t('city.layers')}</legend>
          {LAYERS.map((k) => (
            <label key={k} className="flex min-h-[var(--touch)] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={() => toggleLayer(k)}
                className="h-5 w-5 accent-[var(--nmc-green)]"
              />
              {k === 'traffic' && <Bird aria-hidden size={16} className="text-ink-muted" />}
              {t(`city.layer.${k}`)}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
