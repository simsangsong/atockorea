/**
 * T1.7 → A6 (plan §11.A) — role-scoped quick-reply presets: fully separate
 * customer / guide / driver sets, all 5 locales filled, globally-unique keys
 * (§M-2 ② — these ARE the translations; no runtime LLM), and a server-side
 * resolver that still accepts retired (legacy) keys from old bundles.
 */
import {
  getQuickReplyPreset,
  quickRepliesForRole,
  CUSTOMER_QUICK_REPLIES,
  DRIVER_QUICK_REPLIES,
  GUIDE_QUICK_REPLIES,
  QUICK_REPLY_PRESETS,
} from '@/lib/tour-room/quickReplies';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

const ALL_SETS = [
  ['customer', CUSTOMER_QUICK_REPLIES],
  ['guide', GUIDE_QUICK_REPLIES],
  ['driver', DRIVER_QUICK_REPLIES],
] as const;

describe('role-scoped quick replies (A6)', () => {
  it.each(ALL_SETS)('%s set has unique keys and every locale filled', (_role, set) => {
    expect(set.length).toBeGreaterThan(0);
    expect(new Set(set.map((p) => p.key)).size).toBe(set.length);
    for (const preset of set) {
      for (const locale of ROOM_LOCALES) {
        expect(typeof preset.text[locale]).toBe('string');
        expect(preset.text[locale].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('driver set is the owner-specified driving context', () => {
    expect(DRIVER_QUICK_REPLIES.map((p) => p.key)).toEqual([
      'departing_soon',
      'arriving_soon',
      'rest_stop',
      'vehicle_delay',
      'moving_to_parking',
      'seatbelt_check',
      'check_belongings',
    ]);
    // No guest phrases in the driver strip.
    for (const key of ['need_toilet_urgent', 'where_bus', 'where_meet', 'need_restroom']) {
      expect(DRIVER_QUICK_REPLIES.some((p) => p.key === key)).toBe(false);
    }
  });

  it('customer set is the riding-context redesign (restroom / A-C / carsick / stop / late)', () => {
    const keys = CUSTOMER_QUICK_REPLIES.map((p) => p.key);
    for (const key of [
      'need_toilet_urgent',
      'too_cold',
      'too_hot',
      'feeling_carsick',
      'request_short_stop',
      'running_late',
    ]) {
      expect(keys).toContain(key);
    }
    // Pickup board still finds its reply keys in the customer set (T6.x).
    expect(keys).toContain('arrived');
    // The ops attention-queue trigger stays one tap away (W6.2).
    expect(keys).toContain('need_help');
    // No driver announcements in the guest strip.
    expect(keys).not.toContain('departing_soon');
    expect(keys).not.toContain('seatbelt_check');
  });

  it('guide set keeps the staff-legitimate presets (따라오세요 등)', () => {
    const keys = GUIDE_QUICK_REPLIES.map((p) => p.key);
    expect(keys).toContain('follow_me');
    expect(keys).toContain('gather_here');
    expect(keys).toContain('on_my_way');
    expect(keys).not.toContain('feeling_carsick');
    expect(keys).not.toContain('departing_soon');
  });

  it('quickRepliesForRole maps roles and defaults unknown roles to customer', () => {
    expect(quickRepliesForRole('driver')).toBe(DRIVER_QUICK_REPLIES);
    expect(quickRepliesForRole('guide')).toBe(GUIDE_QUICK_REPLIES);
    expect(quickRepliesForRole('customer')).toBe(CUSTOMER_QUICK_REPLIES);
    expect(quickRepliesForRole('admin')).toBe(CUSTOMER_QUICK_REPLIES);
    expect(quickRepliesForRole(null)).toBe(CUSTOMER_QUICK_REPLIES);
  });

  it('back-compat alias QUICK_REPLY_PRESETS is the customer set', () => {
    expect(QUICK_REPLY_PRESETS).toBe(CUSTOMER_QUICK_REPLIES);
  });

  it('getQuickReplyPreset resolves keys from every role set', () => {
    expect(getQuickReplyPreset('departing_soon')?.text.ko).toBe('곧 출발합니다.');
    expect(getQuickReplyPreset('follow_me')?.text.ko).toBe('저를 따라오세요.');
    expect(getQuickReplyPreset('need_toilet_urgent')?.text.ko).toBe('화장실이 급해요.');
  });

  it('getQuickReplyPreset still resolves retired legacy keys (old open clients)', () => {
    expect(getQuickReplyPreset('where_bus')?.text.ko).toBe('버스가 어디에 있나요?');
    expect(getQuickReplyPreset('where_meet')).not.toBeNull();
    expect(getQuickReplyPreset('need_restroom')).not.toBeNull();
    // But legacy keys never appear in any role's strip.
    for (const [, set] of ALL_SETS) {
      expect(set.some((p) => p.key === 'where_bus')).toBe(false);
    }
  });

  it('getQuickReplyPreset rejects garbage', () => {
    expect(getQuickReplyPreset('nope')).toBeNull();
    expect(getQuickReplyPreset(null)).toBeNull();
    expect(getQuickReplyPreset(42)).toBeNull();
  });
});
