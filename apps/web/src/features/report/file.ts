import { rpc, type RpcResult } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';

/** Uploads report photos to `complaint-photos/{uid}/…` and attaches them. Returns how many failed. */
export async function attachReportPhotos(requestId: string, uid: string | undefined, photos: File[]) {
  let failed = 0;
  for (const file of photos) {
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from('complaint-photos').upload(path, file, { contentType: 'image/jpeg' });
    const att = up.error
      ? null
      : ((await rpc('attach_photo', { p_request_id: requestId, p_storage_path: path, p_kind: 'report' })) as RpcResult);
    if (!att?.ok) failed++;
  }
  return failed;
}
