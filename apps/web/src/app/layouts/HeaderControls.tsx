import { Clock, LogIn, LogOut, Mic } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { DemoSwitcher } from '@/features/auth/DemoSwitcher';
import { signOut, useAuth } from '@/features/auth/store';
import { LANGS } from '@/i18n';
import { useAppSettings, useSimNow } from '@/lib/queries';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';

const ctl = 'inline-flex min-h-[var(--touch)] items-center gap-1 rounded-sm px-3';

const readLarge = () => {
  try {
    return localStorage.getItem('largeText') === '1';
  } catch {
    return false;
  }
};
export const applyLargeText = (on = readLarge()) => {
  document.documentElement.classList.toggle('large-text', on);
  try {
    localStorage.setItem('largeText', on ? '1' : '0');
  } catch {
    /* private mode: not remembered */
  }
};

function SimTimeBadge() {
  const { t, i18n } = useTranslation();
  const offset = useAppSettings().data?.sim_offset_seconds ?? 0;
  const now = useSimNow();
  if (!offset) return null;
  return (
    <span className="tabular inline-flex items-center gap-1 rounded-sm bg-marigold px-2 py-1 text-sm font-semibold text-canopy">
      <Clock aria-hidden size={16} />
      {t('simTime', { when: fmtWhen(now, i18n.language) })}
    </span>
  );
}

export function HeaderControls() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);
  const [large, setLarge] = useState(readLarge);
  const staff = profile && profile.role !== 'citizen';
  const outline = 'border border-line bg-surface';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SimTimeBadge />
      <div role="group" aria-label={t('lang.label')} className="flex gap-1">
        {LANGS.map((l) => (
          <button
            key={l}
            lang={l}
            aria-pressed={i18n.language === l}
            onClick={() => void i18n.changeLanguage(l)}
            className={cn(ctl, i18n.language === l && 'bg-nmc text-white')}
          >
            {t(`lang.${l}`)}
          </button>
        ))}
      </div>
      <button
        aria-pressed={large}
        onClick={() => {
          applyLargeText(!large);
          setLarge(!large);
        }}
        className={cn(ctl, outline)}
      >
        {t('largeText')}
      </button>
      {/* ponytail: placeholder until P7 wires the NIVA call screen and the staff navigation tools */}
      {staff ? (
        <button
          aria-disabled
          title={t('niva.soon')}
          className={cn(ctl, 'bg-marigold font-semibold text-canopy opacity-70')}
        >
          <Mic aria-hidden size={18} /> NIVA
        </button>
      ) : (
        <Link to="/report?mode=talk" className={cn(ctl, 'bg-marigold font-semibold text-canopy')}>
          <Mic aria-hidden size={18} /> {t('actions.talk')}
        </Link>
      )}
      <DemoSwitcher />
      {profile ? (
        <span className="flex items-center gap-2">
          <span className="text-sm leading-tight">
            <strong className="block">{profile.full_name}</strong>
            <span className="text-ink-muted">{t(`role.${profile.role}`)}</span>
          </span>
          <button onClick={() => void signOut().then(() => navigate('/login'))} className={cn(ctl, outline)}>
            <LogOut aria-hidden size={18} /> {t('auth.signOut')}
          </button>
        </span>
      ) : (
        <Link to="/login" className={cn(ctl, outline)}>
          <LogIn aria-hidden size={18} /> {t('auth.signIn')}
        </Link>
      )}
    </div>
  );
}
