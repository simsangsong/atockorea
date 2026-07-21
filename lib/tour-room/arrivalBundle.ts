/**
 * A0 — arrival one-tap bundle (docs/smart-guide-ops-detail-audit-2026-07-21.md).
 *
 * The solo join-tour lead (bus safety staff / Solati driver) announces a stop
 * with ONE send: spot briefing + meeting time + parking pin + follow-vs-free +
 * ticket step + viewing-route note, composed into a single multi-line message.
 * Every line is a pre-translated 5-locale constant (zero-LLM) — the only
 * translated-at-save-time text is the operator's own route note / meeting
 * point (T2-2 pattern, verbatim fallback).
 *
 * Pure and client-safe: the server route interpolates, the guest card and the
 * cockpit sheet import the same types so the metadata contract can't drift.
 */

import { renderSpotEventText } from '@/lib/tour-room/spotContent';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import type { FacilityPin } from '@/lib/tour-room/facilityPins';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';

export type FollowMode = 'follow' | 'free';
/** A4 — the operator's per-day confirmation for the POI's headline event. */
export type EventStatus = 'on' | 'off';

/** Sticky per-POI defaults (tour_poi_arrival_profiles row, server-resolved). */
export interface ArrivalProfile {
  poi_key: string;
  follow_mode: FollowMode;
  ticket_required: boolean;
  route_note: string | null;
  route_note_i18n: Record<string, string> | null;
  meeting_point: string | null;
  meeting_point_i18n: Record<string, string> | null;
  /** A4 — the POI's recurring headline event ("해녀 공연 14:00"); null = none. */
  event_label: string | null;
  event_label_i18n: Record<string, string> | null;
}

/** The `metadata` contract of an `arrival_bundle` message row. */
export interface ArrivalBundleMeta {
  kind: 'arrival_bundle';
  spot_id?: string | null;
  spot_title: string;
  poi_key?: string | null;
  audio_url?: string | null;
  content?: SpotArrivalContent;
  content_tier?: string;
  facility_pins?: FacilityPin[];
  follow_mode: FollowMode;
  ticket_required: boolean;
  route_note?: string | null;
  route_note_i18n?: Record<string, string> | null;
  /** HH:MM KST wall clock; null = "집합 없이" (short photo stop). */
  meeting_time: string | null;
  meeting_point?: string | null;
  meeting_point_i18n?: Record<string, string> | null;
  /** Gather-point pin = the parking spot (the vehicle IS the rally point). */
  meeting_lat?: number | null;
  meeting_lng?: number | null;
  parking_lat?: number | null;
  parking_lng?: number | null;
  /** A2 — next-stop ETA (measured matrix > synthetic haversine). */
  next_leg?: import('@/lib/tour-room/eta').NextLegMeta | null;
  /** A4 — today's operator-confirmed event status (null = unconfirmed). */
  event_status?: EventStatus | null;
  event_label?: string | null;
  event_label_i18n?: Record<string, string> | null;
  triggered_by_role?: string;
  manual?: boolean;
  [key: string]: unknown;
}

/** Default gather point when the profile names none: the vehicle itself. */
export const VEHICLE_POINT: Record<RoomLocale, string> = {
  en: 'the vehicle',
  ko: '차량',
  ja: '車両',
  es: 'el vehículo',
  zh: '车辆',
};

const FOLLOW_LINE: Record<FollowMode, Record<RoomLocale, string>> = {
  follow: {
    en: 'From here, please follow the staff.',
    ko: '여기서부터는 스태프를 따라 이동해 주세요.',
    ja: 'ここからはスタッフについて移動してください。',
    es: 'Desde aquí, sigan al personal, por favor.',
    zh: '从这里开始请跟随工作人员移动。',
  },
  free: {
    en: 'Free viewing here — explore at your own pace.',
    ko: '자유 관람입니다 — 자유롭게 둘러보세요.',
    ja: 'ここは自由見学です — ご自身のペースでお楽しみください。',
    es: 'Visita libre — recorran a su ritmo.',
    zh: '此处为自由参观 — 请按自己的节奏游览。',
  },
};

/** A4 — per-day event citation ({event} interpolates verbatim/translated). */
const EVENT_LINE: Record<EventStatus, Record<RoomLocale, string>> = {
  on: {
    en: "Confirmed for today: {event} is running. ✓",
    ko: '오늘 확인됨: {event} 진행합니다. ✓',
    ja: '本日確認済み：{event} は開催されます。✓',
    es: 'Confirmado para hoy: {event} se realiza. ✓',
    zh: '今日已确认：{event} 正常进行。✓',
  },
  off: {
    en: 'Please note: {event} is NOT running today.',
    ko: '안내: 오늘은 {event} 진행하지 않습니다.',
    ja: 'ご案内：本日 {event} は開催されません。',
    es: 'Aviso: hoy NO se realiza {event}.',
    zh: '请注意：今日 {event} 不进行。',
  },
};

const TICKET_LINE: Record<RoomLocale, string> = {
  en: 'Admission tickets are needed here — please buy yours at the ticket booth.',
  ko: '이곳은 입장권이 필요해요 — 매표소에서 구매해 주세요.',
  ja: 'ここは入場券が必要です — チケット売り場でご購入ください。',
  es: 'Aquí se necesita entrada — cómprenla en la taquilla, por favor.',
  zh: '这里需要门票 — 请在售票处购买。',
};

/** Card/badge labels shared by the guest bundle card (client) and tests. */
export const BUNDLE_COPY: Record<
  RoomLocale,
  { meeting: string; follow: string; free: string; ticket: string; route: string; parking: string; map: string }
> = {
  en: { meeting: 'Meeting time', follow: 'Follow the staff', free: 'Free viewing', ticket: 'Ticket needed', route: 'Suggested route', parking: 'Parking spot', map: 'Map' },
  ko: { meeting: '집합 시간', follow: '스태프 인솔', free: '자유 관람', ticket: '입장권 필요', route: '추천 관람 순서', parking: '주차 위치', map: '지도' },
  ja: { meeting: '集合時間', follow: 'スタッフ引率', free: '自由見学', ticket: 'チケット必要', route: 'おすすめ順路', parking: '駐車位置', map: '地図' },
  es: { meeting: 'Hora de reunión', follow: 'Sigan al personal', free: 'Visita libre', ticket: 'Entrada necesaria', route: 'Ruta sugerida', parking: 'Aparcamiento', map: 'Mapa' },
  zh: { meeting: '集合时间', follow: '跟随工作人员', free: '自由参观', ticket: '需要门票', route: '推荐路线', parking: '停车位置', map: '地图' },
};

export interface ComposeBundleArgs {
  spotTitle: string;
  followMode: FollowMode;
  ticketRequired: boolean;
  /** HH:MM (KST) or null for a no-meeting stop. */
  meetingTime: string | null;
  /** Per-locale gather-point label; falls back to VEHICLE_POINT. */
  pointByLocale?: Record<string, string> | null;
  /** Per-locale route note; a locale missing falls back to `routeNote` verbatim. */
  routeNoteI18n?: Record<string, string> | null;
  routeNote?: string | null;
  /** A4 — today's confirmed event status + label (line omitted when null). */
  eventStatus?: EventStatus | null;
  eventLabelByLocale?: Record<string, string> | null;
  eventLabel?: string | null;
}

/**
 * Compose the bundle's multi-line message text for every room locale. The
 * line order mirrors what the lead would say out loud: arrived → meeting →
 * follow/free → ticket → route.
 */
export function composeArrivalBundleText(args: ComposeBundleArgs): {
  source_locale: string;
  source_text: string;
  translations: Record<string, string>;
} {
  const translations: Record<string, string> = {};
  for (const locale of ROOM_LOCALES) {
    const lines: string[] = [renderSpotEventText('arrived', locale, { spot: args.spotTitle })];
    if (args.meetingTime) {
      const point = args.pointByLocale?.[locale]?.trim() || VEHICLE_POINT[locale];
      lines.push(renderSpotEventText('meeting_notice_timed', locale, { time: args.meetingTime, point }));
    }
    lines.push(FOLLOW_LINE[args.followMode][locale]);
    if (args.ticketRequired) lines.push(TICKET_LINE[locale]);
    if (args.eventStatus && (args.eventLabel || args.eventLabelByLocale)) {
      const event = args.eventLabelByLocale?.[locale]?.trim() || args.eventLabel?.trim() || '';
      if (event) lines.push(EVENT_LINE[args.eventStatus][locale].replaceAll('{event}', event));
    }
    const note = args.routeNoteI18n?.[locale]?.trim() || args.routeNote?.trim();
    if (note) lines.push(note);
    translations[locale] = lines.join('\n');
  }
  return { source_locale: 'en', source_text: translations.en, translations };
}

/** A4 — the card's event citation line (same template the message text uses). */
export function renderEventLine(
  status: EventStatus,
  locale: RoomLocale,
  label: string,
): string {
  return EVENT_LINE[status][locale].replaceAll('{event}', label);
}

/** Row → typed profile (tolerates a null row: returns the free-visit default). */
export function arrivalProfileFromRow(
  poiKey: string,
  row: Record<string, unknown> | null | undefined,
): ArrivalProfile {
  const followMode = row?.follow_mode === 'follow' ? 'follow' : 'free';
  const i18n = (value: unknown): Record<string, string> | null =>
    value && typeof value === 'object' ? (value as Record<string, string>) : null;
  return {
    poi_key: poiKey,
    follow_mode: followMode,
    ticket_required: row?.ticket_required === true,
    route_note: typeof row?.route_note === 'string' ? row.route_note : null,
    route_note_i18n: i18n(row?.route_note_i18n),
    meeting_point: typeof row?.meeting_point === 'string' ? row.meeting_point : null,
    meeting_point_i18n: i18n(row?.meeting_point_i18n),
    event_label: typeof row?.event_label === 'string' ? row.event_label : null,
    event_label_i18n: i18n(row?.event_label_i18n),
  };
}
