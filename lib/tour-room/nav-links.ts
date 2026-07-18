/**
 * W3.2 — navigation deep-link builders (smart-guide private-mode plan J1).
 *
 * Pure URL builders, no SDKs:
 *   guests  → Naver walking route first (Korea's reliable pedestrian data),
 *             Google Maps alongside (the app foreigners actually have).
 *   drivers → KakaoNavi (Kakao Maps app car route) + TMAP schemes, with the
 *             Kakao Maps web route as the no-app fallback.
 * App schemes fail silently on devices without the app — callers should
 * present the web fallback link next to the scheme link.
 */

export interface NavDestination {
  lat: number;
  lng: number;
  name?: string;
}

function encodedName(dest: NavDestination, fallback: string): string {
  return encodeURIComponent((dest.name ?? '').trim() || fallback);
}

/** Naver Map app — walking route to the destination (guest-facing). */
export function naverWalkUrl(dest: NavDestination): string {
  return `nmap://route/walk?dlat=${dest.lat}&dlng=${dest.lng}&dname=${encodedName(dest, 'Destination')}&appname=atockorea.com`;
}

/** Naver Map app — car route to the destination (driver-facing). */
export function naverCarUrl(dest: NavDestination): string {
  return `nmap://route/car?dlat=${dest.lat}&dlng=${dest.lng}&dname=${encodedName(dest, '목적지')}&appname=atockorea.com`;
}

/** Naver Map web fallback (place view centred on the destination). */
export function naverWebUrl(dest: NavDestination): string {
  return `https://map.naver.com/p?c=${dest.lng},${dest.lat},17,0,0,0,dh&title=${encodedName(dest, 'Destination')}`;
}

/** Google Maps directions (guest-facing; mode: walking|driving). */
export function googleDirectionsUrl(dest: NavDestination, mode: 'walking' | 'driving' = 'walking'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${mode}`;
}

/** Kakao Maps app — car route (driver-facing). */
export function kakaoNaviUrl(dest: NavDestination): string {
  return `kakaomap://route?ep=${dest.lat},${dest.lng}&by=CAR`;
}

/** Kakao Maps web fallback — car route (driver-facing, no app needed). */
export function kakaoWebRouteUrl(dest: NavDestination): string {
  return `https://map.kakao.com/link/to/${encodedName(dest, '목적지')},${dest.lat},${dest.lng}`;
}

/** TMAP app — car route (driver-facing). */
export function tmapUrl(dest: NavDestination): string {
  return `tmap://route?goalname=${encodedName(dest, '목적지')}&goalx=${dest.lng}&goaly=${dest.lat}`;
}
