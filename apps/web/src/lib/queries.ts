import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { simNow } from './time';

/** Use on every requests query so SlaBadge gets the SQL-computed status. */
export const REQUEST_SELECT = '*,sla_status_of,sla_ratio';

export function must<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

// app_settings isn't in the realtime publication; the Time Machine invalidates ['app_settings'] after a jump.
export const useAppSettings = () =>
  useQuery({
    queryKey: ['app_settings'],
    queryFn: async () => must(await supabase.from('app_settings').select('*').single()),
    refetchInterval: 30_000,
  });

export function useDemoMode() {
  const { data } = useAppSettings();
  return import.meta.env.VITE_DEMO_MODE === 'true' && !!data?.demo_mode;
}

/** Sim "now" for rendering countdowns, re-rendered every 30 s. */
export function useSimNow() {
  const offset = useAppSettings().data?.sim_offset_seconds ?? 0;
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  return simNow(offset);
}
