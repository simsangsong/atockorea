'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * U-1 — admin realtime live feed. Subscribes to Postgres changes on a table and
 * counts events that arrive *after* the current load, so a list can surface a
 * non-disruptive "N new — load" affordance instead of reordering rows under the
 * operator. Realtime enforces SELECT RLS, so a subscriber only receives the
 * rows it is already allowed to read.
 *
 * The tables must be in the `supabase_realtime` publication (enabled for
 * bookings / contact_inquiries / support_tickets).
 */
export function useRealtimeActivity(
  table: string,
  opts?: { event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*' },
): { newCount: number; reset: () => void } {
  const [newCount, setNewCount] = useState(0);
  const event = opts?.event ?? 'INSERT';

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`admin-activity:${table}:${event}`);
    // supabase-js keys postgres_changes overloads by the literal event, so a
    // dynamic event union doesn't match — cast the filter to keep it generic.
    channel.on(
      'postgres_changes' as never,
      { event, schema: 'public', table } as never,
      () => setNewCount((c) => c + 1),
    );
    channel.subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [table, event]);

  return { newCount, reset: () => setNewCount(0) };
}
