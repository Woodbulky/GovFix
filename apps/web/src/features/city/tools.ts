// NIVA's city tools (docs/NIVA.md): fly_to and filter_city. Lane C registers `useCityTools()` as ElevenLabs
// client tools in P7. Both open the explorer if needed, only move the camera or the filter, and never write.
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyFilter, type CityFilter } from './markers/data';
import { type FlyToArgs, resolveFlyTarget } from './markers/resolve';
import { useCity } from './store';
import { useCityMarkers } from './useCityData';

export type { FlyToArgs };
export type FilterArgs = CityFilter;

export function useCityTools() {
  const { t } = useTranslation();
  const lang = useTranslation().i18n.language;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { markers } = useCityMarkers();

  const fly_to = useCallback(
    (args: FlyToArgs) => {
      const hit = resolveFlyTarget(args, markers, lang);
      if (!hit) return { ok: false as const, reason: t('city.tool.notFound') };
      const s = useCity.getState();
      s.setLayer('complaints', true);
      if (hit.kind === 'ticket') {
        if (pathname !== '/explore') navigate(`/explore?ticket=${encodeURIComponent(hit.marker.ticket!)}`);
        else {
          s.flyTo({ x: hit.marker.x, z: hit.marker.z, distance: 160, label: t('city.showing', { place: hit.label }) });
          s.select(hit.marker.key);
        }
      } else {
        s.flyTo({ x: hit.x, z: hit.z, distance: hit.distance, label: t('city.showing', { place: hit.label }) });
        if (pathname !== '/explore') navigate('/explore');
      }
      return { ok: true as const, label: hit.label };
    },
    [markers, lang, t, navigate, pathname],
  );

  const filter_city = useCallback(
    (args: FilterArgs) => {
      const f: CityFilter = {
        category: args.category || undefined,
        status: args.status ?? 'all',
        ward_id: args.ward_id || undefined,
        mine: args.mine || undefined,
      };
      const s = useCity.getState();
      s.setFilter(f);
      s.setLayer('complaints', true);
      const count = applyFilter(markers, f).length;
      s.announce(t('city.shownAll', { n: count }));
      if (pathname !== '/explore') navigate('/explore');
      return { ok: true as const, count };
    },
    [markers, t, navigate, pathname],
  );

  return { fly_to, filter_city };
}
