// Markers for the viewer: public_markers() for everyone (anonymous, rounded to 25 m, no text or photos), plus
// the requests RLS lets a signed-in user see in full, kept live with realtime.
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/features/auth/store';
import { must, useSimNow } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { rpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import { city } from './gen/layout';
import { fromPublic, fromRequests, mergeOwn, type Marker, type VisibleRequest } from './markers/data';

const SELECT =
  'id, ticket_no, category_code, category_hint, state, ward_id, landmark_id, loc_x, loc_z, sla_status_of, escalation_level, submitted_at, resolution_due_at, assigned_officer_id, citizen_id, photos:request_photos(storage_path, kind)';

// Landmark ids are positional in the generated seed (scripts/gen-city-seed.ts).
const landmark = (id: number) => city.landmarks[id - 1];

/** Anonymous pins; realtime can't reach anon (no select on requests), so poll. */
export function usePublicMarkers(enabled = true) {
  return useQuery({
    queryKey: ['public_markers'],
    enabled,
    refetchInterval: 15_000,
    queryFn: async () => fromPublic(await rpc('public_markers', {})),
  });
}

export function useCityMarkers(): { markers: Marker[]; full: boolean; ready: boolean } {
  const profile = useAuth((s) => s.profile);
  const role = profile?.role;
  const uid = profile?.id ?? null;
  const staff = !!role && role !== 'citizen';
  const nowMs = useSimNow().getTime();

  const pub = usePublicMarkers(!staff);
  const key = ['city_requests', uid];
  useRealtime('requests', key);
  const visible = useQuery({
    queryKey: key,
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('requests').select(SELECT)) as unknown as VisibleRequest[],
  });

  const markers = useMemo(() => {
    const own = visible.data ? fromRequests(visible.data, { uid, nowMs, landmark }) : [];
    if (staff) return own;
    return mergeOwn(pub.data ?? [], own);
    // nowMs only moves ages; refresh them with the data, not every 30 s.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.data, pub.data, uid, staff]);

  return { markers, full: !!uid, ready: staff ? visible.isSuccess : pub.isSuccess };
}
