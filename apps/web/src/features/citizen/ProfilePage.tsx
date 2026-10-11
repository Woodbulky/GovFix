import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, useRefusalToast } from '@/components/Toaster';
import { applyLargeText } from '@/app/layouts/HeaderControls';
import { useAuth } from '@/features/auth/store';
import { LANGS } from '@/i18n';
import { must } from '@/lib/queries';
import { rpc, type RpcResult } from '@/lib/rpc';
import { supabase } from '@/lib/supabase';

const input = 'mt-1 block min-h-[48px] w-full rounded-md border border-line bg-surface px-3';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const uid = useAuth((s) => s.profile?.id);
  const qc = useQueryClient();
  const refused = useRefusalToast();
  const [busy, setBusy] = useState(false);
  const { data: me } = useQuery({
    queryKey: ['me', uid],
    enabled: !!uid,
    queryFn: async () =>
      must(
        await supabase
          .from('profiles')
          .select('full_name, phone, preferred_language, large_text')
          .eq('id', uid!)
          .single(),
      ),
  });
  if (!me) return null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const language = String(f.get('language'));
    const large = f.get('large') === 'on';
    setBusy(true);
    const res = (await rpc('update_my_profile', {
      p_language: language,
      p_large_text: large,
      p_phone: String(f.get('phone') ?? ''),
    })) as RpcResult;
    setBusy(false);
    if (!res.ok) return refused(res);
    await i18n.changeLanguage(language);
    applyLargeText(large);
    useAuth.setState((s) => ({ profile: s.profile && { ...s.profile, preferred_language: language } }));
    await qc.invalidateQueries({ queryKey: ['me', uid] });
    toast(t('profile.saved'));
  };

  return (
    <section className="mx-auto max-w-[640px] space-y-4">
      <h1 className="text-2xl">{t('nav.profile')}</h1>
      <p className="text-lg">{me.full_name}</p>
      <form onSubmit={(e) => void submit(e)} className="space-y-5 rounded-lg bg-surface p-5">
        <fieldset>
          <legend className="font-medium">{t('profile.language')}</legend>
          <p className="text-sm text-ink-muted">{t('profile.languageHint')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <label
                key={l}
                lang={l}
                className="flex min-h-[48px] items-center gap-2 rounded-md border border-line px-4"
              >
                <input type="radio" name="language" value={l} defaultChecked={me.preferred_language === l} />
                {t(`lang.${l}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-[48px] items-center gap-3">
          <input type="checkbox" name="large" defaultChecked={me.large_text} className="h-5 w-5" />
          <span className="font-medium">{t('largeText')}</span>
        </label>
        <label className="block">
          <span className="font-medium">{t('profile.phone')}</span>
          <input name="phone" type="tel" defaultValue={me.phone ?? ''} className={`tabular ${input}`} />
          <span className="text-sm text-ink-muted">{t('profile.phoneHint')}</span>
        </label>
        <button
          disabled={busy}
          className="min-h-[48px] rounded-md bg-nmc px-5 font-semibold text-white disabled:opacity-60"
        >
          {t('profile.save')}
        </button>
      </form>
    </section>
  );
}
