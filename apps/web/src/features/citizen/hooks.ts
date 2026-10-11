import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/store';
import type { PublicTimeline } from '@/features/public/Timeline';
import { must } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { rpc } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';

// RLS limits citizens to their own requests; the embeds give the card its officer name and photos.
const SELECT =
  '*, sla_status_of, officer:profiles!requests_assigned_officer_id_fkey(full_name), photos:request_photos(storage_path, kind, created_at)';

export function useMyRequests() {
  const uid = useAuth((s) => s.profile?.id);
  const key = ['my_requests', uid];
  useRealtime('requests', key);
  return useQuery({
    queryKey: key,
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('requests').select(SELECT).order('updated_at', { ascending: false })),
  });
}
export type MyRequest = NonNullable<ReturnType<typeof useMyRequests>['data']>[number];

export function useMyRequest(id: string) {
  const key = ['my_request', id];
  useRealtime('requests', key);
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const [req, timeline, messages] = await Promise.all([
        supabase.from('requests').select(SELECT).eq('id', id).maybeSingle(),
        rpc('my_request_timeline', { p_request_id: id }),
        supabase.from('request_messages').select('kind, body, created_at').eq('request_id', id).order('created_at'),
      ]);
      const t = timeline as PublicTimeline | { found: false };
      if (req.error) throw new Error(req.error.message);
      return { request: req.data, timeline: t.found ? t : null, messages: must(messages) };
    },
  });
}

const BUCKET = { report: 'complaint-photos', proof: 'proof-photos' } as const;

/** Signed URLs for request photos (both buckets are private). */
export function usePhotoUrls(photos: { storage_path: string; kind: string }[] | undefined) {
  return useQuery({
    queryKey: ['photo_urls', photos?.map((p) => p.storage_path)],
    enabled: !!photos?.length,
    staleTime: 30 * 60_000,
    queryFn: async () =>
      Promise.all(
        photos!.map(async (p) => {
          const bucket = BUCKET[p.kind as keyof typeof BUCKET] ?? BUCKET.report;
          const { data } = await supabase.storage.from(bucket).createSignedUrl(p.storage_path, 3600);
          return { ...p, url: data?.signedUrl ?? null };
        }),
      ),
  });
}

export function useNotifications() {
  const uid = useAuth((s) => s.profile?.id);
  const key = ['notifications', uid];
  useRealtime('notifications', key);
  return useQuery({
    queryKey: key,
    enabled: !!uid,
    queryFn: async () =>
      must(
        await supabase
          .from('notifications')
          .select('id, request_id, kind, title, body, language, audio_path, read_at, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ),
  });
}
