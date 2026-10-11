// Landmark and ward names as DOM labels (real fonts, so Devanagari shapes correctly).
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { centroid } from '../gen/geom';
import { city } from '../gen/layout';
import { heightAt } from '../gen/terrain';

const WARDS = city.wards.map((w) => {
  const [x, z] = centroid(w.polygon);
  return { id: w.id, name: w.name, x, z };
});

const chip = 'pointer-events-none whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold shadow';

/** `breach`: past-deadline counts per ward, shown on the ward labels while the heat layer is on. */
export function Labels({ breach }: { breach?: Record<number, number> }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'hi' | 'mr';
  const landmarkEls = useRef<(HTMLDivElement | null)[]>([]);
  const wardEls = useRef<(HTMLDivElement | null)[]>([]);

  // Show/hide by distance without React re-renders.
  useFrame(({ camera }) => {
    const h = camera.position.y;
    city.landmarks.forEach((l, i) => {
      const el = landmarkEls.current[i];
      if (!el) return;
      const d = Math.hypot(camera.position.x - l.x, camera.position.z - l.z, h);
      el.style.display = d < (h < 60 ? 260 : 1300) ? '' : 'none';
    });
    wardEls.current.forEach((el) => {
      if (el) el.style.display = h > 520 ? '' : 'none';
    });
  });

  return (
    <group>
      {city.landmarks.map((l, i) => (
        <Html
          key={l.name.en}
          position={[l.x, heightAt(l.x, l.z) + 26, l.z]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div ref={(el) => void (landmarkEls.current[i] = el)} aria-hidden className={`${chip} bg-surface text-ink`}>
            {l.name[lang] ?? l.name.en}
          </div>
        </Html>
      ))}
      {WARDS.map((w, i) => (
        <Html key={w.id} position={[w.x, 60, w.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={(el) => void (wardEls.current[i] = el)} aria-hidden className={`${chip} bg-canopy text-white`}>
            {t('city.wardN', { n: w.id })} · {w.name[lang] ?? w.name.en}
            {breach?.[w.id] ? ` · ${t('city.clusterPast', { n: breach[w.id] })}` : ''}
          </div>
        </Html>
      ))}
    </group>
  );
}
