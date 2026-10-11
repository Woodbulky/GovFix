import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from './supabase';

type Table = 'requests' | 'notifications' | 'audit_events';

/** Refetch `queryKey` whenever a row the caller can see (RLS filters realtime too) changes. */
export function useRealtime(table: Table, queryKey: QueryKey) {
  const qc = useQueryClient();
  const key = JSON.stringify(queryKey);
  useEffect(() => {
    const channel = supabase
      .channel(`${table}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        qc.invalidateQueries({ queryKey: JSON.parse(key) as QueryKey }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, table, key]);
}
