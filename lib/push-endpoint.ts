/**
 * Known Web Push service hosts — the ONE list, shared by every subscribe route.
 *
 * A stored endpoint is later POSTed to by the server (web-push), so an
 * unvalidated URL is a stored-SSRF vector: restrict to https on a real push
 * provider before persisting. This used to live only in the ops route while
 * the guest route stored endpoints unchecked — same table, same send path,
 * different doors.
 *
 * 🔴 `push.samsungosp.com` is Samsung Internet's push service — the browser a
 * large share of Korean Android users actually hold. Its absence meant every
 * subscribe from Samsung Internet died with 「Unsupported push endpoint」,
 * which surfaced as the owner's "알림 켜기가 계속 실패" (2026-08-04).
 */
export const PUSH_HOST_SUFFIXES = [
  'push.services.mozilla.com',
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.apple.com', // *.push.apple.com
  'notify.windows.com', // *.notify.windows.com
  'notify.live.net',
  'push.samsungosp.com', // Samsung Internet (*.push.samsungosp.com)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    return PUSH_HOST_SUFFIXES.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}
