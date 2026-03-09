/**
 * API client for AtoC Korea app.
 * Uses the same backend as the web app (atockorea.com).
 * 모든 데이터는 웹과 동일한 Supabase를 공유합니다 (same DB, same API).
 * For authenticated endpoints (bookings, profile, tour-mode), pass accessToken.
 */

const BASE_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://www.atockorea.com';

function headers(accessToken?: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) h['Authorization'] = `Bearer ${accessToken}`;
  return h;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
  accessToken?: string | null
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: headers(accessToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPost<T>(
  path: string,
  body?: object,
  accessToken?: string | null
): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiPatch<T>(path: string, body?: object, accessToken?: string | null): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: headers(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiDelete<T>(path: string, accessToken?: string | null): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: headers(accessToken),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

export { BASE_URL };
