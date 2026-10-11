import { supabase } from './supabase';

const BASE = import.meta.env.VITE_AI_SERVICE_URL;

/** POST to the AI service with the caller's JWT. Returns null when the service is down or slow. */
export async function aiPost<T>(path: string, body: unknown, timeoutMs = 10_000): Promise<T | null> {
  if (!BASE) return null;
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Ask for triage suggestions after filing. Failure is fine: the Manager can triage without AI (golden rule 5). */
export const requestSuggestions = (requestId: string) => void aiPost('/suggest', { request_id: requestId }, 30_000);
