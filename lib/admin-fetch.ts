'use client';

import { supabase } from '@/lib/supabase';

/**
 * Headers so `/api/admin/*` routes receive the session: browser Supabase keeps the
 * access token in localStorage, not cookies — `credentials: 'include'` alone is not enough.
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

/** Same-origin fetch with session Bearer for admin APIs. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const auth = await getAdminAuthHeaders();
  const headers = new Headers(init?.headers);
  if (auth.Authorization) headers.set('Authorization', auth.Authorization);
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
