// NIVA's client-side state: the call, live captions and the complaint draft. The draft lives here, outside the
// call, so "Switch to typing" (or a dropped connection) hands it to the typed Report form unchanged.
import { useEffect } from 'react';
import { create } from 'zustand';
import type { Place } from '@/features/report/LocationStep';

const NO_PLACE: Place = { ward_id: null, landmark_id: null, x: null, z: null };

export type Draft = {
  description: string;
  category_hint: string;
  place: Place;
  since_text: string;
  risk_to_people: boolean;
  photos: File[];
};
export const EMPTY_DRAFT: Draft = {
  description: '',
  category_hint: '',
  place: NO_PLACE,
  since_text: '',
  risk_to_people: false,
  photos: [],
};

export type Caption = { role: 'user' | 'agent'; text: string };
export type Picked = { ward_id: number; ward_name: string; nearest_landmark: string | null; x: number; z: number };

type NivaState = {
  open: boolean;
  /** Collapsed to a bottom bar so the page NIVA navigated to stays visible. */
  docked: boolean;
  captions: Caption[];
  draft: Draft;
  /** Field names that changed last, for the card's highlight. */
  changed: string[];
  conversationId: string | null;
  submitted: { id: string; ticket: string } | null;
  /** Pending tool promises that wait for the person: map pick and photo. */
  picker: ((p: Picked | null) => void) | null;
  photoAsk: ((n: number) => void) | null;
  /** Short spoken description of the current screen, set by pages through useNivaSummary. */
  summary: string;
};

export const useNiva = create<NivaState>(() => ({
  open: false,
  docked: false,
  captions: [],
  draft: EMPTY_DRAFT,
  changed: [],
  conversationId: null,
  submitted: null,
  picker: null,
  photoAsk: null,
  summary: '',
}));

export const startNiva = () => useNiva.setState({ open: true, docked: false, captions: [], submitted: null });

export function patchDraft(p: Partial<Draft>) {
  useNiva.setState((s) => ({ draft: { ...s.draft, ...p }, changed: Object.keys(p) }));
}

/** The draft is "worth keeping" once NIVA has heard something. */
export const hasDraft = (d: Draft) => !!(d.description || d.place.ward_id || d.photos.length || d.category_hint);

/** Pages describe themselves for read_screen_summary. */
export function useNivaSummary(text: string | null | undefined) {
  useEffect(() => {
    if (!text) return;
    useNiva.setState({ summary: text });
    return () => {
      if (useNiva.getState().summary === text) useNiva.setState({ summary: '' });
    };
  }, [text]);
}
