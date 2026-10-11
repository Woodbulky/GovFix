import { aiPost } from './ai';
import { supabase } from './supabase';
import { locale } from './time';

/** Browser speech, the fallback when there's no ElevenLabs voice note. */
export function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale(lang);
  const voice = speechSynthesis.getVoices().find((v) => v.lang === u.lang);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
  return true;
}

async function playPath(path: string) {
  const { data } = await supabase.storage.from('voice-notes').createSignedUrl(path, 600);
  if (!data) return false;
  await new Audio(data.signedUrl).play();
  return true;
}

type Note = { id: string; body: string; language: string; audio_path: string | null };

/** Voice note for a notification: stored mp3, else ask /tts to make one, else browser speech. */
export async function playNotification(n: Note) {
  try {
    if (n.audio_path && (await playPath(n.audio_path))) return;
    const made = await aiPost<{ audio_path?: string }>('/tts', { notification_id: n.id }, 15_000);
    if (made?.audio_path && (await playPath(made.audio_path))) return;
  } catch {
    /* autoplay blocked or file missing: fall through to browser speech */
  }
  speak(n.body, n.language);
}
