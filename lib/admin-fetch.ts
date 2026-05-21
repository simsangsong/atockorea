'use client';

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const SESSION_WAIT_MS = 1200;

/**
 * Headers so `/api/admin/*` routes receive the session: browser Supabase keeps the
 * access token in localStorage, not cookies — `credentials: 'include'` alone is not enough.
 */
export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    session = await waitForAdminSession();
  }

  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function waitForAdminSession(): Promise<Session | null> {
  const client = supabase as SupabaseClient | null;
  if (!client || typeof window === 'undefined') return null;

  return new Promise<Session | null>((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    let timeoutId: number;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      subscription?.unsubscribe();
      window.clearTimeout(timeoutId);
      resolve(session ?? null);
    };

    timeoutId = window.setTimeout(async () => {
      const {
        data: { session },
      } = await client.auth.getSession();
      finish(session ?? null);
    }, SESSION_WAIT_MS);

    client.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) finish(data.session);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) finish(session);
    });
    subscription = data.subscription;
  });
}

async function refreshAdminAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const {
    data: { session },
  } = await supabase.auth.refreshSession();
  if (!session?.access_token) return getAdminAuthHeaders();
  return { Authorization: `Bearer ${session.access_token}` };
}

function mergeHeaders(init: RequestInit | undefined, auth: Record<string, string>): Headers {
  const headers = new Headers(init?.headers);
  if (auth.Authorization) headers.set('Authorization', auth.Authorization);
  headers.set('Cache-Control', 'no-store');
  return headers;
}

/** Same-origin fetch with session Bearer for admin APIs. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const auth = await getAdminAuthHeaders();
  const firstResponse = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: mergeHeaders(init, auth),
  });

  if (firstResponse.status !== 401 || !supabase) {
    return firstResponse;
  }

  const refreshedAuth = await refreshAdminAuthHeaders();
  if (!refreshedAuth.Authorization || refreshedAuth.Authorization === auth.Authorization) {
    return firstResponse;
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: mergeHeaders(init, refreshedAuth),
  });
}
