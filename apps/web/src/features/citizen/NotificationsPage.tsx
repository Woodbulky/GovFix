import { useQueryClient } from '@tanstack/react-query';
import { Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/store';
import { rpc } from '@/lib/rpc';
import { fmtWhen } from '@/lib/time';
import { cn } from '@/lib/utils';
import { playNotification } from '@/lib/voice';
import { useNotifications } from './hooks';

/** Citizens and officers. Each update has a voice note (ElevenLabs via /tts, browser voice as fallback). */
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const role = useAuth((s) => s.profile?.role);
  const { data, isPending } = useNotifications();
  const unread = data?.filter((n) => !n.read_at).length ?? 0;
  const read = async (id?: string) => {
    await rpc('mark_read', id ? { p_notification_id: id } : {});
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const link = (requestId: string) => (role === 'citizen' ? `/me/complaints/${requestId}` : `/requests/${requestId}`);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl">{t('nav.notifications')}</h1>
        {!!unread && (
          <button onClick={() => void read()} className="min-h-[44px] rounded-md border border-line bg-surface px-4">
            {t('notifications.markAll', { count: unread })}
          </button>
        )}
      </div>
      {!isPending && !data?.length && <p className="text-ink-muted">{t('notifications.empty')}</p>}
      <ul className="space-y-2">
        {data?.map((n) => (
          <li
            key={n.id}
            className={cn('flex gap-3 rounded-lg border bg-surface p-3', n.read_at ? 'border-line' : 'border-nmc')}
          >
            <div className="min-w-0 flex-1" lang={n.language}>
              <p className="font-semibold">
                {!n.read_at && <span className="sr-only">{t('notifications.unread')} </span>}
                {n.request_id ? (
                  <Link to={link(n.request_id)} onClick={() => void read(n.id)} className="text-nmc hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </p>
              <p>{n.body}</p>
              <p className="tabular text-sm text-ink-muted">{fmtWhen(n.created_at, i18n.language)}</p>
            </div>
            <button
              onClick={() => {
                void playNotification(n);
                if (!n.read_at) void read(n.id);
              }}
              aria-label={t('notifications.listen', { title: n.title })}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line"
            >
              <Volume2 aria-hidden size={20} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
