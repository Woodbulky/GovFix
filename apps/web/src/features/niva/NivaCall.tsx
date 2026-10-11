// The NIVA call (docs/NIVA.md, DESIGN.md): a canopy call screen that docks to a bottom bar when NIVA navigates,
// so the person sees the page it opened. The session comes from the AI service's /niva/session (signed URL;
// the ElevenLabs key never reaches the browser). Any failure falls back to the typed form with the draft kept.
import {
  ConversationProvider,
  useConversationControls,
  useConversationInput,
  useConversationMode,
  useConversationStatus,
} from '@elevenlabs/react';
import { Keyboard, Maximize2, Mic, MicOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { toast } from '@/components/Toaster';
import { useAuth } from '@/features/auth/store';
import { aiGet } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { DraftCard, PhotoAsk, PickerAsk } from './DraftCard';
import { useNiva } from './store';
import { NivaTools } from './tools';

type Session = { signed_url: string; language: 'en' | 'hi' | 'mr'; dynamic_variables: Record<string, string> };
type Phase = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

const round = 'flex h-16 w-16 items-center justify-center rounded-full';

export function Niva() {
  const open = useNiva((s) => s.open);
  return (
    <ConversationProvider>
      {open && (
        <>
          <NivaTools />
          <Call />
        </>
      )}
    </ConversationProvider>
  );
}

/** Closes the call and releases any tool still waiting on the person. */
function close() {
  const { picker, photoAsk, draft } = useNiva.getState();
  picker?.(null);
  photoAsk?.(draft.photos.length);
  useNiva.setState({ open: false, docked: false });
}

function usePageKey() {
  const { pathname } = useLocation();
  return ROUTES.find((r) => matchPath(r.path, pathname))?.key ?? 'home';
}

function Call() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuth((s) => s.profile?.role);
  const page = usePageKey();
  const { startSession, endSession, setVolume, getOutputVolume } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const { isMuted, setMuted } = useConversationInput();
  const { captions, docked } = useNiva();
  const [speaker, setSpeaker] = useState(true);
  const [failed, setFailed] = useState(false);
  const pageRef = useRef(page);
  pageRef.current = page;

  const toTyping = () => {
    close();
    if (role === 'citizen') navigate('/report');
  };
  // Citizens go straight to the typed form (draft kept); staff keep the error state to read.
  const fallback = () => {
    toast(t('niva.fallback'), 'refused');
    if (role === 'citizen') toTyping();
    else setFailed(true);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await aiGet<Session>('/niva/session');
      if (!alive) return;
      if (!s) return fallback();
      try {
        // Ask first so a denied microphone lands on the typed form, not a silent call.
        (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((tr) => tr.stop());
      } catch {
        return alive && fallback();
      }
      if (!alive) return;
      startSession({
        signedUrl: s.signed_url,
        connectionType: 'websocket',
        overrides: { agent: { language: s.language } },
        dynamicVariables: { ...s.dynamic_variables, current_page: pageRef.current },
        onConnect: ({ conversationId }) => useNiva.setState({ conversationId }),
        onMessage: ({ message, role: who }) =>
          message.trim() && useNiva.setState((st) => ({ captions: [...st.captions, { role: who, text: message }] })),
        onDisconnect: (d) => (d.reason === 'error' ? fallback() : d.reason === 'agent' && close()),
        onError: () => fallback(),
      });
    })();
    return () => {
      alive = false;
      endSession();
    };
    // Once per call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = captions.at(-1);
  const phase: Phase = failed
    ? 'error'
    : status !== 'connected'
      ? status === 'error'
        ? 'error'
        : 'connecting'
      : isSpeaking
        ? 'speaking'
        : last?.role === 'user'
          ? 'thinking'
          : 'listening';
  const stateText = t(`niva.phase.${phase}`);

  const controls = (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-pressed={isMuted}
        aria-label={isMuted ? t('niva.unmute') : t('niva.mute')}
        disabled={phase === 'error'}
        onClick={() => setMuted(!isMuted)}
        className={cn(round, 'bg-white/15 disabled:opacity-50')}
      >
        {isMuted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
      </button>
      <button
        type="button"
        aria-label={t('niva.end')}
        onClick={() => {
          endSession();
          close();
        }}
        className={cn(round, 'bg-st-rejected text-white')}
      >
        <PhoneOff aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={!speaker}
        aria-label={speaker ? t('niva.speakerOff') : t('niva.speakerOn')}
        disabled={phase === 'error'}
        onClick={() => {
          setVolume({ volume: speaker ? 0 : 1 });
          setSpeaker(!speaker);
        }}
        className={cn(round, 'bg-white/15 disabled:opacity-50')}
      >
        {speaker ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
      </button>
    </div>
  );

  if (docked)
    return (
      <div
        role="region"
        aria-label="NIVA"
        className="fixed inset-x-2 bottom-2 z-40 flex items-center gap-3 rounded-lg bg-canopy p-2 text-white shadow-lg sm:left-auto sm:w-[420px]"
      >
        <Avatar phase={phase} small />
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          <strong className="block">{stateText}</strong>
          <span className="line-clamp-1 text-white/85">{last?.text}</span>
        </p>
        <button
          type="button"
          aria-label={t('niva.expand')}
          onClick={() => useNiva.setState({ docked: false })}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"
        >
          <Maximize2 aria-hidden size={18} />
        </button>
        <button
          type="button"
          aria-label={t('niva.end')}
          onClick={() => {
            endSession();
            close();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-st-rejected"
        >
          <PhoneOff aria-hidden size={18} />
        </button>
        <PickerAsk />
        <PhotoAsk />
      </div>
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('niva.title')}
      className="fixed inset-0 z-40 overflow-y-auto bg-canopy text-white"
    >
      <div className="mx-auto grid min-h-full max-w-[1100px] gap-6 p-4 md:grid-cols-[1fr_380px] md:p-8">
        <div className="flex flex-col items-center justify-center gap-5 text-center">
          <Avatar phase={phase} />
          <Wave active={phase === 'speaking'} level={getOutputVolume} />
          <p className="font-heading text-xl" aria-live="polite">
            {stateText}
          </p>
          <ol className="w-full max-w-[560px] space-y-2 text-left" aria-label={t('niva.captions')} aria-live="polite">
            {captions.slice(-6).map((c, i) => (
              <li key={captions.length - 6 + i} className={c.role === 'agent' ? 'text-white' : 'text-[#B7E4C7]'}>
                <span className="sr-only">{c.role === 'agent' ? 'NIVA: ' : t('niva.you')}</span>
                {c.text}
              </li>
            ))}
          </ol>
          {phase === 'error' ? (
            <button
              type="button"
              onClick={toTyping}
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-marigold px-5 font-semibold text-canopy"
            >
              <Keyboard aria-hidden size={20} /> {t('niva.typeInstead')}
            </button>
          ) : (
            controls
          )}
          {phase !== 'error' && role === 'citizen' && (
            <button type="button" onClick={toTyping} className="min-h-11 font-medium underline">
              {t('niva.switchToTyping')}
            </button>
          )}
        </div>
        {role === 'citizen' && (
          <div className="self-start md:sticky md:top-8">
            <DraftCard />
          </div>
        )}
      </div>
      <PickerAsk />
      <PhotoAsk />
    </div>
  );
}

function Avatar({ phase, small }: { phase: Phase; small?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'shrink-0 rounded-full border-marigold',
        small ? 'h-11 w-11 border-2' : 'h-40 w-40 border-[6px]',
        phase === 'listening' && 'motion-safe:animate-pulse',
      )}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle cx="50" cy="50" r="48" fill="#13493A" />
        <path d="M22 52c0-20 12-32 28-32s28 12 28 32c-6-10-16-14-28-14s-22 4-28 14z" fill="#1B1B1B" />
        <circle cx="50" cy="55" r="22" fill="#C98B5E" />
        <circle cx="50" cy="40" r="2.5" fill="#B3261E" />
        <circle cx="42" cy="54" r="2.5" fill="#1B1B1B" />
        <circle cx="58" cy="54" r="2.5" fill="#1B1B1B" />
        <path d="M42 64q8 6 16 0" stroke="#1B1B1B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M20 100c4-16 16-22 30-22s26 6 30 22z" fill="#E8A317" />
      </svg>
    </div>
  );
}

/** Five bars following NIVA's output volume. Static when the person prefers reduced motion. */
function Wave({ active, level }: { active: boolean; level: () => number }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!active || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = bars.current;
    let id = 0;
    const tick = () => {
      const v = Math.min(1, level() * 2.5);
      els.forEach((b, i) => b && (b.style.transform = `scaleY(${0.2 + v * (0.5 + 0.5 * Math.sin(i * 1.7))})`));
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(id);
      els.forEach((b) => b && (b.style.transform = 'scaleY(0.2)'));
    };
  }, [active, level]);
  return (
    <div aria-hidden className="flex h-12 items-center gap-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          ref={(el) => (bars.current[i] = el)}
          className="block h-12 w-2 origin-center rounded-full bg-marigold"
          style={{ transform: 'scaleY(0.2)' }}
        />
      ))}
    </div>
  );
}
