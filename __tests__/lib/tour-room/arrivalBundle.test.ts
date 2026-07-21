/**
 * A0 — arrival one-tap bundle: pure composition + notice integration.
 * (docs/smart-guide-ops-detail-audit-2026-07-21.md)
 */
import {
  arrivalProfileFromRow,
  composeArrivalBundleText,
  VEHICLE_POINT,
} from '@/lib/tour-room/arrivalBundle';
import { activeNotice } from '@/lib/tour-room/notices';
import { kstStartOfDayMs } from '@/lib/tour-room/time';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

describe('composeArrivalBundleText', () => {
  it('composes arrived + meeting + follow + ticket + note lines per locale', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: '성산일출봉',
      followMode: 'follow',
      ticketRequired: true,
      meetingTime: '15:40',
      pointByLocale: null,
      routeNoteI18n: { en: 'Crater rim first, then the beach.', ko: '분화구 먼저, 그다음 해변.' },
      routeNote: '분화구 먼저, 그다음 해변.',
    });
    expect(bundle.source_locale).toBe('en');
    const ko = bundle.translations.ko.split('\n');
    expect(ko[0]).toContain('성산일출봉');
    expect(ko[1]).toContain('15:40');
    expect(ko[1]).toContain(VEHICLE_POINT.ko); // no named point → vehicle default
    expect(ko[2]).toContain('스태프');
    expect(ko[3]).toContain('입장권');
    expect(ko[4]).toBe('분화구 먼저, 그다음 해변.');
    const en = bundle.translations.en.split('\n');
    expect(en[1]).toContain('the vehicle');
    expect(en[4]).toBe('Crater rim first, then the beach.');
  });

  it('a no-meeting stop omits the meeting line; free mode + no ticket = 2 lines', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: 'Photo Stop',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
    });
    const lines = bundle.translations.en.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('own pace');
  });

  it('a named gather point interpolates per locale (verbatim fallback)', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: 'X',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: '12:00',
      pointByLocale: { en: 'Main gate', ko: '정문 앞' },
      routeNote: null,
    });
    expect(bundle.translations.en).toContain('Main gate');
    expect(bundle.translations.ko).toContain('정문 앞');
    // ja missing from the map → VEHICLE_POINT fallback keeps the line whole.
    expect(bundle.translations.ja).toContain(VEHICLE_POINT.ja);
  });

  it('a locale missing from routeNoteI18n falls back to the verbatim note', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: 'X',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
      routeNoteI18n: { en: 'English note' },
      routeNote: '한국어 원문',
    });
    expect(bundle.translations.en).toContain('English note');
    expect(bundle.translations.ja).toContain('한국어 원문');
  });
});

describe('A4 event line', () => {
  it('adds the confirmed-on citation with the localized label', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: '성산일출봉',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
      eventStatus: 'on',
      eventLabel: '해녀 공연 14:00',
      eventLabelByLocale: { en: 'Haenyeo show 14:00' },
    });
    expect(bundle.translations.ko).toContain('오늘 확인됨: 해녀 공연 14:00 진행합니다');
    expect(bundle.translations.en).toContain('Haenyeo show 14:00 is running');
  });

  it('adds the not-running notice', () => {
    const bundle = composeArrivalBundleText({
      spotTitle: 'X',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
      eventStatus: 'off',
      eventLabel: '해녀 공연',
    });
    expect(bundle.translations.ko).toContain('오늘은 해녀 공연 진행하지 않습니다');
  });

  it('unconfirmed (null) or label-less events add no line', () => {
    const noStatus = composeArrivalBundleText({
      spotTitle: 'X',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
      eventStatus: null,
      eventLabel: '해녀 공연',
    });
    expect(noStatus.translations.en.split('\n')).toHaveLength(2);
    const noLabel = composeArrivalBundleText({
      spotTitle: 'X',
      followMode: 'free',
      ticketRequired: false,
      meetingTime: null,
      eventStatus: 'on',
    });
    expect(noLabel.translations.en.split('\n')).toHaveLength(2);
  });
});

describe('arrivalProfileFromRow', () => {
  it('null row → free-visit defaults', () => {
    const profile = arrivalProfileFromRow('seongsan', null);
    expect(profile).toMatchObject({
      poi_key: 'seongsan',
      follow_mode: 'free',
      ticket_required: false,
      route_note: null,
      meeting_point: null,
    });
  });

  it('maps a full row', () => {
    const profile = arrivalProfileFromRow('seongsan', {
      follow_mode: 'follow',
      ticket_required: true,
      route_note: 'note',
      route_note_i18n: { en: 'note-en' },
      meeting_point: '정문',
      meeting_point_i18n: { en: 'Main gate' },
    });
    expect(profile.follow_mode).toBe('follow');
    expect(profile.ticket_required).toBe(true);
    expect(profile.route_note_i18n?.en).toBe('note-en');
    expect(profile.meeting_point_i18n?.en).toBe('Main gate');
  });
});

describe('activeNotice × arrival_bundle (A0)', () => {
  const today = '2099-07-21';
  const dayStart = kstStartOfDayMs(today);
  const msg = (id: string, metadata: Record<string, unknown>, atMinutes = 0): RoomMessage =>
    ({
      id,
      created_at: new Date(dayStart + atMinutes * 60 * 1000).toISOString(),
      metadata,
    }) as unknown as RoomMessage;

  it('a bundle WITH a meeting time acts as a meeting notice (countdown on)', () => {
    const messages = [
      msg('m1', { kind: 'arrival_bundle', meeting_time: '15:40', meeting_point: 'the vehicle', meeting_lat: 33.4, meeting_lng: 126.9 }),
    ];
    const now = dayStart + (15 * 60 + 20) * 60 * 1000; // 15:20
    const state = activeNotice(messages, today, now)!;
    expect(state).not.toBeNull();
    expect(state.kind).toBe('meeting_notice');
    expect(state.remainingMs).toBe(20 * 60 * 1000);
    expect(state.lat).toBe(33.4);
  });

  it('a bundle WITHOUT a meeting time is skipped and never clears an active timer', () => {
    const messages = [
      msg('m1', { kind: 'free_time_timer', until_time: '16:00', meeting_point: 'bus' }, 60),
      msg('m2', { kind: 'arrival_bundle', meeting_time: null }, 90),
    ];
    const now = dayStart + 15.5 * 60 * 60 * 1000; // 15:30
    const state = activeNotice(messages, today, now)!;
    expect(state).not.toBeNull();
    expect(state.kind).toBe('free_time_timer');
    expect(state.messageId).toBe('m1');
  });

  it('a newer bundle meeting supersedes an older timer', () => {
    const messages = [
      msg('m1', { kind: 'free_time_timer', until_time: '15:00' }, 60),
      msg('m2', { kind: 'arrival_bundle', meeting_time: '16:30' }, 120),
    ];
    const now = dayStart + 16 * 60 * 60 * 1000;
    const state = activeNotice(messages, today, now)!;
    expect(state.messageId).toBe('m2');
    expect(state.kind).toBe('meeting_notice');
  });
});
