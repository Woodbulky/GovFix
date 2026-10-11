// NIVA's client tools (docs/NIVA.md). Names and parameters must match the agent in the ElevenLabs dashboard.
// None of them can change a request: the only write is create_request() with the citizen's own session, after
// a spoken "yes" (submit_complaint). Every result goes back to the agent as a JSON string.
import { useConversationClientTool } from '@elevenlabs/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { canAccess, HOME } from '@/app/access';
import { applyLargeText } from '@/app/layouts/HeaderControls';
import { ROUTES } from '@/app/routes';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { type FilterArgs, type FlyToArgs, useCityTools } from '@/features/city/tools';
import { attachReportPhotos } from '@/features/report/file';
import { requestSuggestions } from '@/lib/ai';
import { useDemoMode } from '@/lib/queries';
import { nameOf, useCategories, useLandmarks, useWards } from '@/lib/reference';
import { rpc, type RpcResult } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';
import { fmtWhen } from '@/lib/time';
import { EMPTY_DRAFT, patchDraft, type Picked, useNiva } from './store';

const PAGES: Record<string, string> = {
  report: '/report',
  my_complaints: '/me/complaints',
  city: '/explore',
  notifications: '/notifications',
  profile: '/profile',
  triage: '/triage',
  board: '/dept',
  escalations: '/escalations',
  my_work: '/officer',
  overview: '/admin',
  audit: '/admin/audit',
};
const WAIT_MS = 120_000;
const json = (v: unknown) => JSON.stringify(v);
const STATUS_SELECT =
  'id, ticket_no, category_code, category_hint, state, sla_status_of, resolution_due_at, updated_at, officer:profiles!requests_assigned_officer_id_fkey(full_name)';

/** "142", "000142" or "NMC-2026-000142" → the 6-digit suffix used in ticket numbers. */
export const ticketSuffix = (s: string) => s.replace(/\D/g, '').slice(-6).padStart(6, '0');

/** Resolves when the person acts, or with `fallback` after two minutes so the agent is never stuck. */
function waitFor<T>(set: (resolve: (v: T) => void) => void, clear: () => void, fallback: T) {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => done(fallback), WAIT_MS);
    const done = (v: T) => {
      clearTimeout(timer);
      clear();
      resolve(v);
    };
    set(done);
  });
}

export function NivaTools() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const demo = useDemoMode();
  const cats = useCategories().data ?? [];
  const wards = useWards().data ?? [];
  const landmarks = useLandmarks().data ?? [];
  const { fly_to, filter_city } = useCityTools();

  type Row = {
    id: string;
    ticket_no: string;
    category_code: string | null;
    category_hint: string | null;
    state: string;
    sla_status_of: string | null;
    resolution_due_at: string | null;
    updated_at: string;
    officer: { full_name: string } | null;
  };
  const speakable = (r: Row) => ({
    ticket_no: r.ticket_no,
    category: nameOf(
      cats.find((c) => c.code === (r.category_code ?? r.category_hint)),
      lang,
    ),
    state: t(`state.${r.state}`),
    sla_status: r.sla_status_of ? t(`sla.${r.sla_status_of}`) : null,
    due: r.resolution_due_at ? fmtWhen(r.resolution_due_at, lang) : null,
    officer_first_name: r.officer?.full_name.split(' ')[0] ?? null,
    last_update: fmtWhen(r.updated_at, lang),
  });
  const findTicket = async (ticket: string) =>
    (
      await supabase
        .from('requests')
        .select(STATUS_SELECT)
        .like('ticket_no', `NMC-%-${ticketSuffix(ticket)}`)
        .maybeSingle()
    ).data as Row | null;

  const placeOf = (ward_id: number | null, landmark_id: number | null) => {
    const l = landmarks.find((x) => x.id === landmark_id);
    if (l) return { ward_id: l.ward_id, landmark_id: l.id, x: l.x, z: l.z };
    const w = wards.find((x) => x.id === ward_id);
    return w ? { ward_id: w.id, landmark_id: null, x: w.center_x, z: w.center_z } : null;
  };

  useConversationClientTool('update_draft', (p: Record<string, unknown>) => {
    const d: Parameters<typeof patchDraft>[0] = {};
    if (typeof p.description === 'string') d.description = p.description;
    if (typeof p.category_hint === 'string' && cats.some((c) => c.code === p.category_hint))
      d.category_hint = p.category_hint;
    if (typeof p.since_text === 'string') d.since_text = p.since_text;
    if (typeof p.risk_to_people === 'boolean') d.risk_to_people = p.risk_to_people;
    if (p.landmark_id != null || p.ward_id != null) {
      const place = placeOf(Number(p.ward_id) || null, Number(p.landmark_id) || null);
      if (place) d.place = place;
    }
    patchDraft(d);
    const { photos, ...draft } = useNiva.getState().draft;
    return json({ ok: true, draft: { ...draft, photos: photos.length } });
  });

  useConversationClientTool('resolve_landmark', async (p: { query?: string; ward_hint?: number }) => {
    const r = (await rpc('resolve_landmark', {
      p_query: String(p.query ?? ''),
      p_ward_hint: p.ward_hint ?? undefined,
    })) as { found: boolean; landmark_id?: number; ward_id?: number };
    if (r.found && r.landmark_id) {
      const place = placeOf(r.ward_id ?? null, r.landmark_id);
      if (place) patchDraft({ place });
    }
    return json(r);
  });

  useConversationClientTool('open_location_picker', async () => {
    const picked = await waitFor<Picked | null>(
      (resolve) => useNiva.setState({ picker: resolve, docked: false }),
      () => useNiva.setState({ picker: null }),
      null,
    );
    return json(picked ?? { cancelled: true });
  });

  useConversationClientTool('request_photo', async () => {
    const attached = await waitFor<number>(
      (resolve) => useNiva.setState({ photoAsk: resolve, docked: false }),
      () => useNiva.setState({ photoAsk: null }),
      useNiva.getState().draft.photos.length,
    );
    return json({ attached });
  });

  useConversationClientTool('submit_complaint', async (p: { confirmation_text?: string }) => {
    const { draft, captions, conversationId } = useNiva.getState();
    const missing = [
      draft.description.trim().length < 5 && 'description',
      !draft.place.ward_id && 'ward_id',
      !p.confirmation_text?.trim() && 'confirmation_text',
    ].filter(Boolean);
    if (missing.length) return json({ ok: false, missing });
    const description = draft.since_text ? `${draft.description}\n(${draft.since_text})` : draft.description;
    const res = (await rpc('create_request', {
      p: {
        description,
        ward_id: draft.place.ward_id,
        landmark_id: draft.place.landmark_id,
        loc_x: draft.place.x,
        loc_z: draft.place.z,
        category_hint: draft.category_hint || null,
        language: lang,
        channel: 'voice',
        transcript: captions.map((c) => `${c.role === 'agent' ? 'NIVA' : 'Citizen'}: ${c.text}`).join('\n'),
        confirmation_text: p.confirmation_text,
        conversation_id: conversationId,
      },
    })) as RpcResult<{ request: { id: string; ticket_no: string } }>;
    if (!res.ok) return json({ ok: false, code: res.code, message: res.message });
    const { id, ticket_no } = res.request;
    const failed = await attachReportPhotos(id, profile?.id, draft.photos);
    if (failed) toast(t('report.photoFailed', { n: failed }), 'refused');
    requestSuggestions(id);
    useNiva.setState({ submitted: { id, ticket: ticket_no }, draft: EMPTY_DRAFT, changed: [] });
    return json({ ok: true, ticket_no, ticket_digits: ticket_no.slice(-6).split('').join(' ') });
  });

  useConversationClientTool('get_my_complaints', async () => {
    const { data } = await supabase
      .from('requests')
      .select(STATUS_SELECT)
      .order('updated_at', { ascending: false })
      .limit(10);
    return json(((data ?? []) as unknown as Row[]).map(speakable));
  });

  useConversationClientTool('get_status', async (p: { ticket_no?: string }) => {
    const r = p.ticket_no ? await findTicket(p.ticket_no) : null;
    return json(r ? speakable(r) : { found: false });
  });

  useConversationClientTool('navigate', async (p: { page?: string; ticket_no?: string }) => {
    const role = profile?.role;
    let path = p.page === 'home' ? (role ? HOME[role] : '/') : PAGES[p.page ?? ''];
    if (p.page === 'complaint_detail') {
      const r = p.ticket_no ? await findTicket(p.ticket_no) : null;
      if (!r) return json({ ok: false, reason: 'ticket not found' });
      path = role === 'citizen' ? `/me/complaints/${r.id}` : `/requests/${r.id}`;
    }
    const route = path && ROUTES.find((x) => x.path === path.replace(/\/[0-9a-f-]{36}$/, '/:id'));
    if (!route || !canAccess(route.access, role, demo, route.demo))
      return json({ ok: false, reason: 'not available for your role' });
    navigate(path);
    useNiva.setState({ docked: true });
    return json({ ok: true });
  });

  useConversationClientTool('fly_to', (p: Record<string, unknown>) => {
    useNiva.setState({ docked: true });
    return json(fly_to(p as FlyToArgs));
  });

  useConversationClientTool('filter_city', (p: Record<string, unknown>) => {
    useNiva.setState({ docked: true });
    return json(filter_city((p ?? {}) as FilterArgs));
  });

  useConversationClientTool('set_language', async (p: { lang?: string }) => {
    if (!p.lang || !['en', 'hi', 'mr'].includes(p.lang)) return json({ ok: false });
    await i18n.changeLanguage(p.lang);
    if (profile) {
      await rpc('update_my_profile', { p_language: p.lang });
      useAuth.setState((s) => ({ profile: s.profile && { ...s.profile, preferred_language: p.lang! } }));
    }
    return json({ ok: true });
  });

  useConversationClientTool('set_text_size', async (p: { size?: string }) => {
    const large = p.size === 'large';
    applyLargeText(large);
    if (profile) await rpc('update_my_profile', { p_large_text: large });
    return json({ ok: true });
  });

  useConversationClientTool('read_screen_summary', () => {
    const own = useNiva.getState().summary;
    if (own) return json({ summary: own });
    // Pages without their own summary: the heading plus the start of the visible text.
    const main = document.getElementById('main');
    const h1 = main?.querySelector('h1')?.textContent ?? '';
    const text = (main?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 500);
    return json({ summary: `${h1}. ${text}` });
  });

  return null;
}
